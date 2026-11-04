import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/learning_repository.dart';
import '../../data/lesson_repository.dart';
import '../../data/plan_adjustment_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../path/plan_adjust_screen.dart';
import '../path/scope_notice_banner.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

/// Màn hình "Hôm nay" (T055, T070): bài mới, bài ôn và tổng thời lượng ước tính so với quỹ thời gian
/// đã khai báo; mở/tiếp tục từng mục, trạng thái và tóm tắt khi hoàn thành ngày, nút "Học thêm" (US2.5).
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final plan = ref.watch(todayProvider);
    // Thông báo giới hạn nội dung lấy từ lộ trình; lỗi ở đây không làm hỏng màn hình chính.
    final scopeNotice = ref.watch(pathProvider).valueOrNull?.scopeNotice;

    return PageFrame(
      title: l10n.navToday,
      child: plan.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => _buildError(context, ref, error),
        data: (DailyPlan data) =>
            _TodayContent(plan: data, scopeNotice: scopeNotice),
      ),
    );
  }

  /// Tiếp tục lộ trình đang tạm dừng ngay từ màn hình "Hôm nay" (Nguyên tắc III).
  Future<void> _resume(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(planAdjustmentRepositoryProvider).resume();
      invalidatePlanViews(ref);
    } on ApiError catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(describeError(context, e))));
    }
  }

  Widget _buildError(BuildContext context, WidgetRef ref, Object error) {
    final l10n = AppLocalizations.of(context);
    if (error is ApiError) {
      // Chưa onboarding → chưa có lộ trình: đưa người học vào luồng onboarding.
      if (error.statusCode == 404) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) context.go(AppRoutes.onboarding);
        });
        return const LoadingView();
      }
      if (error.code == 'PATH_PAUSED') {
        return EmptyView(
          key: const Key('today-paused'),
          icon: Icons.pause_circle_outline,
          title: l10n.todayPausedTitle,
          message: l10n.todayPausedMessage,
          action: FilledButton(
            key: const Key('resume-path'),
            onPressed: () => _resume(context, ref),
            child: Text(l10n.todayResumePath),
          ),
        );
      }
    }
    return ErrorView(
      error: error,
      onRetry: () => ref.invalidate(todayProvider),
    );
  }
}

class _TodayContent extends ConsumerStatefulWidget {
  const _TodayContent({required this.plan, required this.scopeNotice});

  final DailyPlan plan;
  final ScopeNotice? scopeNotice;

  @override
  ConsumerState<_TodayContent> createState() => _TodayContentState();
}

class _TodayContentState extends ConsumerState<_TodayContent> {
  bool _loadingExtra = false;

  /// Thông báo khi "Học thêm" không còn nội dung phù hợp (kèm gợi ý bước tiếp theo).
  String? _extraMessage;

  Future<void> _studyMore() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _loadingExtra = true;
      _extraMessage = null;
    });
    try {
      final unit = await ref.read(lessonRepositoryProvider).extraUnit();
      if (!mounted) return;
      context.go(_lessonLocation(unit.id!));
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingExtra = false;
        _extraMessage = e.code == 'CONTENT_EXHAUSTED'
            ? switch (e.fields['suggestion']) {
                'raise_level' => l10n.todayExtraRaiseLevel,
                'add_skill' => l10n.todayExtraAddSkill,
                _ => l10n.todayExtraExhausted,
              }
            : describeError(context, e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final plan = widget.plan;
    final items = plan.items ?? const <PlanItem>[];
    final date = plan.localDate;
    final dateText = date == null
        ? ''
        : DateFormat.yMMMMEEEEd(
            Localizations.localeOf(context).toString(),
          ).format(date);
    final dayCompleted = plan.status == DailyPlanStatusEnum.completed;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.todayHeading, style: theme.textTheme.headlineSmall),
          if (dateText.isNotEmpty) Text(dateText, key: const Key('today-date')),
          const SizedBox(height: 12),
          Text(
            l10n.todayTimeSummary(
              plan.estimatedMinutes ?? 0,
              plan.budgetMinutes ?? 0,
            ),
            key: const Key('today-time-summary'),
            style: theme.textTheme.titleMedium,
          ),
          if (widget.scopeNotice != null) ...<Widget>[
            const SizedBox(height: 12),
            ScopeNoticeBanner(notice: widget.scopeNotice!),
          ],
          const SizedBox(height: 16),
          if (dayCompleted) ...<Widget>[
            _DayCompletedCard(summary: plan.summary),
            const SizedBox(height: 12),
          ],
          if (items.isEmpty)
            EmptyView(
              key: const Key('today-empty'),
              icon: Icons.check_circle_outline,
              title: l10n.todayEmptyTitle,
              message: _noticeText(l10n, plan.notice) ?? l10n.todayEmptyMessage,
            )
          else ...<Widget>[
            if (plan.notice != null) ...<Widget>[
              Text(_noticeText(l10n, plan.notice) ?? plan.notice!),
              const SizedBox(height: 12),
            ],
            for (final item in items) _PlanItemCard(item: item),
          ],
          if (dayCompleted || items.isEmpty) ...<Widget>[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                key: const Key('study-more'),
                icon: const Icon(Icons.add_circle_outline),
                label: Text(l10n.todayStudyMore),
                onPressed: _loadingExtra ? null : _studyMore,
              ),
            ),
            if (_extraMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_extraMessage!, key: const Key('extra-message')),
              ),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            children: <Widget>[
              TextButton.icon(
                key: const Key('open-path'),
                icon: const Icon(Icons.route_outlined),
                label: Text(l10n.todayViewPath),
                onPressed: () => context.go(AppRoutes.path),
              ),
              TextButton.icon(
                key: const Key('open-progress'),
                icon: const Icon(Icons.insights_outlined),
                label: Text(l10n.todayViewProgress),
                onPressed: () => context.go(AppRoutes.progress),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String? _noticeText(AppLocalizations l10n, String? code) {
    switch (code) {
      case 'content_exhausted':
        return l10n.todayNoticeContentExhausted;
      case 'no_fitting_unit':
        return l10n.todayNoticeNoFittingUnit;
      case 'replanned_after_gap':
        return l10n.todayNoticeReplanned;
    }
    return null;
  }
}

/// Đường dẫn màn hình bài học cho một mục kế hoạch (hoặc đơn vị "học thêm").
String _lessonLocation(String id) =>
    '${AppRoutes.lesson}?item=${Uri.encodeQueryComponent(id)}';

/// Khối "hoàn thành ngày": tóm tắt kết quả của mọi phiên trong kế hoạch (US2.3).
class _DayCompletedCard extends StatelessWidget {
  const _DayCompletedCard({required this.summary});

  final SessionSummary? summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final summary = this.summary;
    return Card(
      key: const Key('day-completed'),
      color: theme.colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            const Icon(Icons.emoji_events_outlined, size: 32),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    l10n.todayDayCompletedTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                  if (summary != null)
                    Text(
                      l10n.todayDayCompletedSummary(
                        summary.correct ?? 0,
                        summary.total ?? 0,
                        (summary.minutesSpent ?? 0).toStringAsFixed(1),
                      ),
                      key: const Key('day-summary'),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanItemCard extends StatelessWidget {
  const _PlanItemCard({required this.item});

  final PlanItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isReview = item.type == PlanItemTypeEnum.reviewBatch;
    final done = item.status == PlanItemStatusEnum.completed;
    final started = item.status == PlanItemStatusEnum.inProgress;
    final detail = <String>[
      l10n.minutesShort(item.estMinutes ?? 0),
      if (isReview && item.itemCount != null)
        l10n.todayReviewItemCount(item.itemCount!),
    ].join(' · ');

    return Card(
      child: ListTile(
        key: Key('plan-item-${item.id}'),
        leading: Icon(isReview ? Icons.replay : Icons.menu_book_outlined),
        title: Text(item.title ?? ''),
        subtitle: Text(
          '${isReview ? l10n.todayTypeReview : l10n.todayTypeNew} · $detail',
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _StatusChip(status: item.status),
            if (!done) ...<Widget>[
              const SizedBox(width: 8),
              FilledButton(
                key: Key('start-${item.id}'),
                onPressed: () => context.go(_lessonLocation(item.id!)),
                child: Text(started ? l10n.todayContinue : l10n.todayStart),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final PlanItemStatusEnum? status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = switch (status) {
      PlanItemStatusEnum.completed => l10n.statusCompleted,
      PlanItemStatusEnum.inProgress => l10n.statusInProgress,
      _ => l10n.statusPending,
    };
    return Chip(label: Text(text));
  }
}
