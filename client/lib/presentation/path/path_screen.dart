import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/learning_repository.dart';
import '../../data/plan_adjustment_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/confirm_dialog.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import '../classroom/locked_control.dart';
import '../competency/competency_chip.dart';
import '../competency/competency_legend.dart';
import '../onboarding/onboarding_labels.dart';
import 'plan_adjust_screen.dart';
import 'scope_notice_banner.dart';

/// Màn hình lộ trình (T055, T094): tiến độ tổng quát, thứ tự đơn vị do server tính động, đánh dấu một
/// đơn vị là "đã thành thạo" (loại khỏi bài sắp tới, FR-016), lối vào làm lại bài kiểm tra trình độ
/// (US1.6) và sang màn hình điều chỉnh kế hoạch.
class PathScreen extends ConsumerStatefulWidget {
  const PathScreen({super.key});

  @override
  ConsumerState<PathScreen> createState() => _PathScreenState();
}

class _PathScreenState extends ConsumerState<PathScreen> {
  PathFilter _filter = noPathFilter;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final path = ref.watch(pathListProvider(_filter));
    return PageFrame(
      title: l10n.navPath,
      child: path.when(
        loading: () => _framed(const LoadingView()),
        error: (Object error, StackTrace _) {
          if (error is ApiError && error.statusCode == 404) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted) context.go(AppRoutes.onboarding);
            });
            return const LoadingView();
          }
          return ErrorView(
            error: error,
            onRetry: () => ref.invalidate(pathListProvider),
          );
        },
        data: (PathDetail data) => _framed(
          _PathContent(
            // Đổi bộ lọc thì dựng lại; làm mới dữ liệu (đánh dấu thành thạo…) chỉ bỏ các trang nạp thêm, giữ thông báo.
            key: ValueKey<PathFilter>(_filter),
            path: data,
            filter: _filter,
          ),
        ),
      ),
    );
  }

  /// Thanh lọc (loại, trình độ) luôn hiển thị phía trên danh sách, kể cả khi đang tải lại sau đổi bộ lọc.
  Widget _framed(Widget body) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _PathFilterBar(
          filter: _filter,
          onChanged: (f) => setState(() => _filter = f),
        ),
        Expanded(child: body),
      ],
    );
  }
}

/// Bộ lọc danh sách lộ trình theo loại và trình độ (gửi `kind`/`level` cho `GET /path`).
class _PathFilterBar extends StatelessWidget {
  const _PathFilterBar({required this.filter, required this.onChanged});

  final PathFilter filter;
  final ValueChanged<PathFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 12,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: <Widget>[
          DropdownButton<Skill?>(
            key: const Key('path-filter-kind'),
            hint: Text(l10n.adminFilterKind),
            value: filter.kind,
            items: <DropdownMenuItem<Skill?>>[
              DropdownMenuItem<Skill?>(
                value: null,
                child: Text(l10n.adminFilterAll),
              ),
              for (final k in Skill.values)
                DropdownMenuItem<Skill?>(
                  value: k,
                  child: Text(skillLabel(l10n, k.value)),
                ),
            ],
            onChanged: (v) => onChanged((kind: v, level: filter.level)),
          ),
          DropdownButton<ContentLevel?>(
            key: const Key('path-filter-level'),
            hint: Text(l10n.adminFilterLevel),
            value: filter.level,
            items: <DropdownMenuItem<ContentLevel?>>[
              DropdownMenuItem<ContentLevel?>(
                value: null,
                child: Text(l10n.adminFilterAll),
              ),
              for (final l in ContentLevel.values)
                DropdownMenuItem<ContentLevel?>(value: l, child: Text(l.value)),
            ],
            onChanged: (v) => onChanged((kind: filter.kind, level: v)),
          ),
        ],
      ),
    );
  }
}

/// Trình độ kế tiếp khi người học nâng trình độ sau khi hết bài mới ("chưa biết gì" bắt đầu từ N5 nên
/// nâng lên N4). Trả null khi đã ở trần nội dung (N3).
String? nextLevelAfter(Level? level) {
  return switch (level) {
    Level.none || Level.N5 => 'N4',
    Level.N4 => 'N3',
    _ => null,
  };
}

class _PathContent extends ConsumerStatefulWidget {
  const _PathContent({super.key, required this.path, required this.filter});

  /// Trang đầu của danh sách theo bộ lọc [filter]; các trang sau nạp thêm bằng `offset`.
  final PathDetail path;
  final PathFilter filter;

  @override
  ConsumerState<_PathContent> createState() => _PathContentState();
}

class _PathContentState extends ConsumerState<_PathContent> {
  bool _busy = false;
  String? _message;
  bool _messageIsError = false;

  /// Các trang đã nạp thêm sau trang đầu (danh sách dựng lười, ≈ 600 đơn vị).
  final List<PathDetailAllOfItems> _more = <PathDetailAllOfItems>[];
  bool _loadingMore = false;
  String? _loadMoreError;

  List<PathDetailAllOfItems> get _items => <PathDetailAllOfItems>[
    ...(widget.path.items ?? const <PathDetailAllOfItems>[]),
    ..._more,
  ];

  @override
  void didUpdateWidget(covariant _PathContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Trang đầu vừa được tải lại: các trang nạp thêm trước đó đã cũ.
    if (!identical(oldWidget.path, widget.path)) {
      _more.clear();
      _loadMoreError = null;
    }
  }

  /// Còn đơn vị khớp bộ lọc chưa nạp (máy chủ cũ không trả `itemsTotal` ⇒ đã có đủ).
  bool get _hasMore {
    final total = widget.path.itemsTotal;
    return total != null && _items.length < total;
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    final firstPage = widget.path;
    setState(() {
      _loadingMore = true;
      _loadMoreError = null;
    });
    try {
      final page = await ref
          .read(learningRepositoryProvider)
          .path(
            kind: widget.filter.kind,
            level: widget.filter.level,
            limit: pathPageSize,
            offset: _items.length,
          );
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        // Trang đầu đã được tải lại trong lúc chờ: bỏ trang này (sẽ nạp lại theo trang đầu mới).
        if (identical(firstPage, widget.path)) {
          _more.addAll(page.items ?? const <PathDetailAllOfItems>[]);
        }
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingMore = false;
        _loadMoreError = describeError(context, e);
      });
    }
  }

  /// Đơn vị còn có thể học (chưa học hoặc đang học dở): "bài sắp tới".
  int get _upcomingCount => _items
      .where(
        (i) =>
            i.status == PathDetailAllOfItemsStatusEnum.pending ||
            i.status == PathDetailAllOfItemsStatusEnum.inProgress,
      )
      .length;

  Future<void> _setMastered(
    PathDetailAllOfItems item, {
    required bool mastered,
  }) async {
    final l10n = AppLocalizations.of(context);
    final isUpcoming =
        item.status == PathDetailAllOfItemsStatusEnum.pending ||
        item.status == PathDetailAllOfItemsStatusEnum.inProgress;
    // Đánh dấu đơn vị cuối cùng còn lại sẽ khiến lộ trình hết bài mới: hỏi xác nhận trước.
    if (mastered && isUpcoming && _upcomingCount == 1) {
      final confirmed = await showConfirmDialog(
        context,
        title: l10n.pathMasterLastTitle,
        message: l10n.pathMasterLastMessage,
        confirmLabel: l10n.pathMarkMastered,
      );
      if (!confirmed || !mounted) return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    final repo = ref.read(planAdjustmentRepositoryProvider);
    try {
      final result = await repo.setMastered(item.unitId!, mastered: mastered);
      if (!mounted) return;
      invalidatePlanViews(ref);
      final title = item.title ?? '';
      setState(() {
        _busy = false;
        _message = mastered
            ? l10n.pathMasteredSnack(title)
            : l10n.pathUnmasteredSnack(title);
        _messageIsError = false;
      });
      if (result.remainingUnits == 0 && result.suggestion != null) {
        await _showSuggestion(result.suggestion!);
      }
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = describeError(context, e);
        _messageIsError = true;
      });
    }
  }

  /// Hết bài mới sau khi đánh dấu: mời nâng trình độ hoặc làm lại kiểm tra (`raise_level`), hoặc báo đã
  /// học hết nội dung hiện có (`content_exhausted`).
  Future<void> _showSuggestion(MasterResultSuggestionEnum suggestion) async {
    final l10n = AppLocalizations.of(context);
    final next = nextLevelAfter(widget.path.startLevel);

    if (suggestion == MasterResultSuggestionEnum.raiseLevel && next != null) {
      final choice = await showDialog<String>(
        context: context,
        builder: (BuildContext dialogContext) => AlertDialog(
          key: const Key('suggestion-raise-level'),
          title: Text(l10n.pathSuggestionRaiseTitle),
          content: Text(l10n.pathSuggestionRaiseMessage),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop('close'),
              child: Text(l10n.actionClose),
            ),
            OutlinedButton(
              key: const Key('suggestion-retake'),
              onPressed: () => Navigator.of(dialogContext).pop('retake'),
              child: Text(l10n.pathRetakePlacement),
            ),
            FilledButton(
              key: const Key('suggestion-raise'),
              onPressed: () => Navigator.of(dialogContext).pop('raise'),
              child: Text(l10n.pathSuggestionRaiseAction(next)),
            ),
          ],
        ),
      );
      if (!mounted) return;
      if (choice == 'retake') {
        context.go(AppRoutes.placement);
      } else if (choice == 'raise') {
        await _raiseLevel(next);
      }
      return;
    }

    await showDialog<void>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        key: const Key('suggestion-exhausted'),
        title: Text(l10n.pathSuggestionExhaustedTitle),
        content: Text(l10n.pathSuggestionExhaustedMessage),
        actions: <Widget>[
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.actionClose),
          ),
        ],
      ),
    );
  }

  Future<void> _raiseLevel(String level) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await ref
          .read(planAdjustmentRepositoryProvider)
          .update(ProfileChange(currentLevel: level));
      if (!mounted) return;
      invalidatePlanViews(ref);
      setState(() => _busy = false);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = describeError(context, e);
        _messageIsError = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final path = widget.path;
    final items = _items;
    final total = path.totalUnits ?? items.length;
    final completed = path.completedUnits ?? 0;
    final start = path.startLevel;

    // Học viên thuộc lớp: nhãn nguồn lớp và điều khiển "thành thạo" bị khóa (spec 004, US3, FR-018).
    final inClass = path.source_ == PathDetailSource_Enum.class_;
    final notices = scopeNoticeCodes(
      notices: path.notices,
      scopeNotice: path.scopeNotice,
    );
    // Cuộn gần cuối danh sách thì nạp trang kế (danh sách dựng lười bằng SliverList).
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (_hasMore && n.metrics.extentAfter < 400) _loadMore();
        return false;
      },
      child: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                const ClassSourceBanner(),
                Text(l10n.pathHeading, style: theme.textTheme.headlineSmall),
                const SizedBox(height: 4),
                if (start != null)
                  Text(
                    (start == Level.none
                        ? l10n.pathStartBeginner
                        : l10n.pathStartLevel(start.value)),
                    key: const Key('path-start'),
                  ),
                if (path.reason != null) Text(_reasonText(l10n, path.reason!)),
                const SizedBox(height: 12),
                Text(
                  l10n.pathProgress(completed, total),
                  key: const Key('path-progress'),
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                LinearProgressIndicator(
                  value: total == 0 ? 0 : completed / total,
                ),
                if (notices.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 12),
                  ScopeNoticeBanner(notices: notices),
                ],
                if (_message != null) ...<Widget>[
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      _message!,
                      key: const Key('path-message'),
                      style: TextStyle(
                        color: _messageIsError
                            ? theme.colorScheme.error
                            : theme.colorScheme.primary,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (items.isEmpty)
                  EmptyView(
                    key: const Key('path-empty'),
                    icon: Icons.route_outlined,
                    title: l10n.pathEmptyTitle,
                    message: l10n.pathEmptyMessage,
                  ),
              ],
            ),
          ),
          if (items.isNotEmpty)
            SliverList.builder(
              itemCount: items.length,
              itemBuilder: (BuildContext context, int index) {
                final item = items[index];
                return _UnitTile(
                  item: item,
                  busy: _busy,
                  locked: inClass,
                  onToggleMastered: () => _setMastered(
                    item,
                    mastered:
                        item.status != PathDetailAllOfItemsStatusEnum.mastered,
                  ),
                );
              },
            ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                if (_hasMore)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Center(
                      child: _loadingMore
                          ? const CircularProgressIndicator(
                              key: Key('path-loading-more'),
                            )
                          : OutlinedButton(
                              key: const Key('path-load-more'),
                              onPressed: _loadMore,
                              child: Text(
                                l10n.pathLoadMore(
                                  items.length,
                                  path.itemsTotal ?? items.length,
                                ),
                              ),
                            ),
                    ),
                  ),
                if (_loadMoreError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _loadMoreError!,
                      key: const Key('path-load-more-error'),
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
                // Chú giải màu năng lực (FR-020); chỉ khi máy chủ có trả mức.
                if (items.any((i) => i.competency != null)) ...<Widget>[
                  const SizedBox(height: 8),
                  const CompetencyLegend(),
                ],
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: <Widget>[
                    OutlinedButton.icon(
                      key: const Key('adjust-plan'),
                      icon: const Icon(Icons.tune),
                      label: Text(l10n.pathAdjustPlan),
                      onPressed: () => context.go(AppRoutes.pathAdjust),
                    ),
                    OutlinedButton.icon(
                      key: const Key('retake-placement'),
                      icon: const Icon(Icons.fact_check_outlined),
                      label: Text(l10n.pathRetakePlacement),
                      onPressed: () => context.go(AppRoutes.placement),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _reasonText(
    AppLocalizations l10n,
    PathDetailReasonEnum reason,
  ) {
    return switch (reason) {
      PathDetailReasonEnum.onboarding => l10n.pathReasonOnboarding,
      PathDetailReasonEnum.rebuildRequest => l10n.pathReasonRebuild,
      PathDetailReasonEnum.goalChange => l10n.pathReasonGoalChange,
      PathDetailReasonEnum.levelChange => l10n.pathReasonLevelChange,
      PathDetailReasonEnum.placementRetake => l10n.pathReasonPlacementRetake,
    };
  }
}

class _UnitTile extends StatelessWidget {
  const _UnitTile({
    required this.item,
    required this.busy,
    required this.onToggleMastered,
    this.locked = false,
  });

  final PathDetailAllOfItems item;
  final bool busy;

  /// Thuộc lớp: không đánh dấu thành thạo được (do lớp quyết định).
  final bool locked;
  final VoidCallback onToggleMastered;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final kind = item.kind == null
        ? l10n.skillVocabulary
        : skillLabel(l10n, item.kind!.value);
    final mastered = item.status == PathDetailAllOfItemsStatusEnum.mastered;
    final (icon, status) = switch (item.status) {
      PathDetailAllOfItemsStatusEnum.completed => (
        Icons.check_circle,
        l10n.statusCompleted,
      ),
      PathDetailAllOfItemsStatusEnum.mastered => (
        Icons.verified,
        l10n.statusMastered,
      ),
      PathDetailAllOfItemsStatusEnum.inProgress => (
        Icons.timelapse,
        l10n.statusInProgress,
      ),
      _ => (Icons.radio_button_unchecked, l10n.statusPending),
    };
    return Card(
      child: ListTile(
        key: Key('unit-${item.unitId}'),
        leading: Icon(icon),
        title: Text(item.title ?? ''),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              '$kind · ${item.level?.value ?? ''} · ${l10n.minutesShort(item.estMinutes ?? 0)}',
            ),
            // Mức năng lực của CHỦ ĐỀ của đơn vị (chưa có dữ liệu ⇒ chip trung tính).
            if (item.competency != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: CompetencyChip(
                  key: Key('competency-${item.unitId}'),
                  level: item.competency,
                  label: item.title ?? '',
                ),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(status),
            const SizedBox(width: 8),
            if (locked)
              Tooltip(
                message:
                    '${l10n.lockedByClassReason}. ${l10n.lockedByClassHint}',
                child: Icon(
                  Icons.lock_outline,
                  key: Key('master-locked-${item.unitId}'),
                ),
              )
            else
              TextButton(
                key: Key('master-${item.unitId}'),
                onPressed: busy ? null : onToggleMastered,
                child: Text(
                  mastered ? l10n.pathUnmarkMastered : l10n.pathMarkMastered,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
