import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../admin/admin_support.dart';
import '../shared/confirm_dialog.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

/// Kiểm tra trình độ cho cả lớp và mời chuyển lớp (spec 004, US8, FR-034, FR-014): giáo viên yêu cầu cả lớp làm
/// bài kiểm tra trình độ hiện có, xem kết quả từng học viên và phân bố, đóng yêu cầu. Kết quả KHÔNG tự đổi lộ
/// trình lớp. Từ danh sách có thể MỜI một học viên sang lớp khác — học viên phải đồng ý lại thì mới chuyển.
class ClassPlacementScreen extends ConsumerStatefulWidget {
  const ClassPlacementScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassPlacementScreen> createState() =>
      _ClassPlacementScreenState();
}

class _ClassPlacementScreenState extends ConsumerState<ClassPlacementScreen> {
  ClassPlacementResults? _results;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _results == null;
      _error = null;
    });
    try {
      final results = await ref
          .read(classRepositoryProvider)
          .placementResults(widget.classId);
      if (mounted) setState(() => _results = results);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Thao tác ghi: lỗi hiện hộp thoại, thành công báo và tải lại.
  Future<void> _act(Future<void> Function() action, String doneMessage) async {
    try {
      await action();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(doneMessage)));
    await _load();
  }

  Future<void> _create() async {
    final l10n = AppLocalizations.of(context);
    await _act(
      () => ref
          .read(classRepositoryProvider)
          .createPlacementRequest(widget.classId),
      l10n.classPlacementCreated,
    );
  }

  Future<void> _close() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.classPlacementClose,
      message: l10n.classPlacementCloseConfirm,
      confirmLabel: l10n.classPlacementClose,
    );
    if (!ok) return;
    await _act(
      () => ref
          .read(classRepositoryProvider)
          .closePlacementRequest(widget.classId),
      l10n.classPlacementClosed,
    );
  }

  /// Chọn lớp đích trong các lớp đang hoạt động khác rồi gửi lời mời chuyển lớp (học viên đồng ý lại mới chuyển).
  Future<void> _inviteMove(ClassPlacementResultsResultsInner learner) async {
    final l10n = AppLocalizations.of(context);
    final List<ClassRow> classes;
    try {
      classes = (await ref.read(classRepositoryProvider).classes())
          .where(
            (c) =>
                c.id != widget.classId &&
                c.status == ClassRowStatusEnum.active &&
                c.hasPath,
          )
          .toList();
    } on ApiError catch (e) {
      if (mounted) await showAdminErrorDialog(context, e);
      return;
    }
    if (!mounted) return;
    if (classes.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.classPlacementMoveNoOther)));
      return;
    }
    final target = await showDialog<ClassRow>(
      context: context,
      builder: (BuildContext dialogContext) => SimpleDialog(
        key: const Key('move-dialog'),
        title: Text(l10n.classPlacementMoveTitle),
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              '${learner.displayName}\n${l10n.classPlacementMoveHint}',
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(l10n.classPlacementMoveTarget),
          ),
          for (final c in classes)
            SimpleDialogOption(
              key: Key('move-target-${c.id}'),
              onPressed: () => Navigator.of(dialogContext).pop(c),
              child: Text(c.name),
            ),
        ],
      ),
    );
    if (target == null) return;
    await _act(
      () => ref
          .read(classRepositoryProvider)
          .inviteMove(widget.classId, learner.userId, target.id),
      l10n.classPlacementMoveSent,
    );
  }

  String _levelLabel(AppLocalizations l10n, Level? level) =>
      level == null || level == Level.none
      ? l10n.classPlacementLevelNone
      : level.value;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classPlacementTitle,
      actions: <Widget>[
        TextButton.icon(
          key: const Key('placement-back'),
          onPressed: () => context.go('${AppRoutes.classes}/${widget.classId}'),
          icon: const Icon(Icons.arrow_back),
          label: Text(l10n.classPlacementBack),
        ),
      ],
      child: _loading && _results == null
          ? const LoadingView()
          : _error != null && _results == null
          ? ErrorView(error: _error, onRetry: _load)
          : _content(l10n),
    );
  }

  Widget _content(AppLocalizations l10n) {
    final theme = Theme.of(context);
    final results = _results;
    return ListView(
      children: <Widget>[
        Text(l10n.classPlacementIntro, style: theme.textTheme.bodySmall),
        const SizedBox(height: 12),
        if (results == null) ...<Widget>[
          Text(
            l10n.classPlacementNoRequest,
            key: const Key('placement-no-request'),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              key: const Key('placement-create'),
              onPressed: _create,
              icon: const Icon(Icons.assignment_outlined),
              label: Text(l10n.classPlacementCreate),
            ),
          ),
        ] else ...<Widget>[
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              key: const Key('placement-close'),
              onPressed: _close,
              icon: const Icon(Icons.stop_circle_outlined),
              label: Text(l10n.classPlacementClose),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            key: const Key('placement-distribution'),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    l10n.classPlacementDistribution,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: <Widget>[
                      for (final level in const <String>[
                        'none',
                        'N5',
                        'N4',
                        'N3',
                      ])
                        Chip(
                          key: Key('distribution-$level'),
                          label: Text(
                            '${level == 'none' ? l10n.classPlacementLevelNone : level}: '
                            '${results.distribution[level] ?? 0}',
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(l10n.classPlacementLearners, style: theme.textTheme.titleMedium),
          for (final r in results.results)
            Card(
              key: Key('placement-row-${r.userId}'),
              child: ListTile(
                title: Text(r.displayName),
                subtitle: Text(
                  r.status == ClassPlacementResultsResultsInnerStatusEnum.done
                      ? '${l10n.classPlacementDone} · ${_levelLabel(l10n, r.estimatedLevel)}'
                            ' · ${l10n.classPlacementScore(r.score ?? 0, r.total ?? 0)}'
                      : l10n.classPlacementPending,
                  key: Key('placement-status-${r.userId}'),
                ),
                trailing: TextButton.icon(
                  key: Key('placement-move-${r.userId}'),
                  onPressed: () => _inviteMove(r),
                  icon: const Icon(Icons.swap_horiz),
                  label: Text(l10n.classPlacementMoveButton),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
