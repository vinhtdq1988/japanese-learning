import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../platform/platform_providers.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'class_dashboard_screen.dart'
    show classAlertLabel, formatRatio, progressStatusLabel;
import 'learner_adjust_sheet.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Chi tiết một học viên của lớp (spec 004, US4, FR-029): tiến độ từng đơn vị lộ trình lớp, biểu đồ phút học
/// 30 ngày, độ chính xác ôn, mảng yếu, bài giao và kết quả kiểm tra trình độ. KHÔNG có từng câu trả lời
/// (FR-035). Học viên đã rời lớp ⇒ server trả 404 và màn hình báo lỗi chung.
class LearnerDetailScreen extends ConsumerStatefulWidget {
  const LearnerDetailScreen({
    super.key,
    required this.classId,
    required this.userId,
  });

  final String classId;
  final String userId;

  @override
  ConsumerState<LearnerDetailScreen> createState() =>
      _LearnerDetailScreenState();
}

class _LearnerDetailScreenState extends ConsumerState<LearnerDetailScreen> {
  ClassLearnerDetail? _detail;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _detail == null;
      _error = null;
    });
    try {
      final detail = await ref
          .read(classRepositoryProvider)
          .learnerDetail(widget.classId, widget.userId);
      if (mounted) setState(() => _detail = detail);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Tải CSV chi tiết học viên và lưu qua giao diện nền tảng.
  Future<void> _exportCsv() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final file = await ref
          .read(classRepositoryProvider)
          .exportLearnerCsv(widget.classId, widget.userId);
      await ref.read(fileTransferProvider).saveCsv(file.filename, file.bytes);
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.classExportDone(file.filename))),
      );
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.learnerDetailTitle,
      actions: <Widget>[
        TextButton.icon(
          key: const Key('learner-export'),
          onPressed: _exportCsv,
          icon: const Icon(Icons.download),
          label: Text(l10n.classExportLearnerCsv),
        ),
        TextButton.icon(
          key: const Key('learner-back'),
          onPressed: () =>
              context.go('${AppRoutes.classes}/${widget.classId}/dashboard'),
          icon: const Icon(Icons.arrow_back),
          label: Text(l10n.learnerDetailBack),
        ),
      ],
      child: _loading && _detail == null
          ? const LoadingView()
          : _error != null && _detail == null
          ? ErrorView(error: _error, onRetry: _load)
          : _content(l10n, _detail!),
    );
  }

  Widget _content(AppLocalizations l10n, ClassLearnerDetail detail) {
    final theme = Theme.of(context);
    final row = detail.row;
    return ListView(
      children: <Widget>[
        Text(detail.displayName, style: theme.textTheme.headlineSmall),
        Text(row.email),
        if (row.alerts.isNotEmpty)
          Wrap(
            spacing: 8,
            children: <Widget>[
              for (final alert in row.alerts)
                Chip(
                  key: Key('detail-alert-${alert.value}'),
                  avatar: const Icon(Icons.warning_amber, size: 16),
                  label: Text(
                    classAlertLabel(l10n, alert, row.absentDays ?? 0),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: <Widget>[
            Chip(
              key: const Key('detail-status'),
              label: Text(progressStatusLabel(l10n, row.progressStatus)),
            ),
            if (row.joinedAt != null)
              Text(l10n.learnerDetailJoined(_dateFormat.format(row.joinedAt!))),
            if (!row.hasStarted)
              Text(
                l10n.classDashboardNotStarted,
                key: const Key('detail-not-started'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            key: const Key('learner-adjust-open'),
            onPressed: () async {
              final saved = await showLearnerAdjustSheet(
                context,
                classId: widget.classId,
                detail: detail,
              );
              if (saved) await _load();
            },
            icon: const Icon(Icons.tune),
            label: Text(l10n.learnerAdjustOpen),
          ),
        ),
        const SizedBox(height: 12),
        _section(
          l10n.learnerDetailAccuracy,
          Text(
            formatRatio(detail.reviewAccuracy),
            key: const Key('detail-accuracy'),
          ),
        ),
        _section(l10n.learnerDetailMinutes30, _minutesChart(detail)),
        _section(l10n.learnerDetailUnits, _units(l10n, detail)),
        _section(l10n.learnerDetailWeak, _weakTopics(l10n, detail)),
        _section(l10n.learnerDetailAssignments, _assignments(l10n, detail)),
        _section(l10n.learnerDetailPlacement, _placement(l10n, detail)),
      ],
    );
  }

  Widget _section(String title, Widget body) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          body,
        ],
      ),
    ),
  );

  /// Biểu đồ cột đơn giản: chiều cao cột tỷ lệ với phút học trong ngày (cột cao nhất = 100%).
  Widget _minutesChart(ClassLearnerDetail detail) {
    final days = detail.dailyMinutes30;
    final peak = days.fold<num>(0, (m, d) => d.minutes > m ? d.minutes : m);
    return SizedBox(
      key: const Key('detail-minutes-chart'),
      height: 80,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          for (final d in days)
            Expanded(
              child: Tooltip(
                message: '${_dateFormat.format(d.date)}: ${d.minutes}',
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: FractionallySizedBox(
                    heightFactor: peak == 0
                        ? 0.02
                        : (d.minutes / peak).clamp(0.02, 1).toDouble(),
                    child: ColoredBox(
                      key: Key('minutes-${_dateFormat.format(d.date)}'),
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _unitStatus(
    AppLocalizations l10n,
    ClassLearnerDetailUnitsInnerStatusEnum status,
  ) => switch (status) {
    ClassLearnerDetailUnitsInnerStatusEnum.pending => l10n.learnerUnitPending,
    ClassLearnerDetailUnitsInnerStatusEnum.inProgress =>
      l10n.learnerUnitInProgress,
    ClassLearnerDetailUnitsInnerStatusEnum.completed =>
      l10n.learnerUnitCompleted,
    ClassLearnerDetailUnitsInnerStatusEnum.mastered => l10n.learnerUnitMastered,
    ClassLearnerDetailUnitsInnerStatusEnum.exempt => l10n.learnerUnitExempt,
  };

  Widget _units(AppLocalizations l10n, ClassLearnerDetail detail) => Column(
    children: <Widget>[
      for (final u in detail.units)
        ListTile(
          key: Key('unit-${u.unitId}'),
          dense: true,
          title: Text(u.title),
          subtitle: u.dueOn == null ? null : Text(_dateFormat.format(u.dueOn!)),
          trailing: Text(_unitStatus(l10n, u.status)),
        ),
    ],
  );

  Widget _weakTopics(AppLocalizations l10n, ClassLearnerDetail detail) {
    if (detail.weakTopics.isEmpty) {
      return Text(l10n.learnerDetailNoWeak, key: const Key('detail-no-weak'));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (final t in detail.weakTopics)
          Text(
            l10n.learnerDetailWeakItem(
              t.name,
              formatRatio(t.accuracy),
              t.answers ?? 0,
            ),
            key: Key('weak-${t.topicId}'),
          ),
      ],
    );
  }

  String _assignmentState(
    AppLocalizations l10n,
    ClassLearnerDetailAssignmentStatesInnerStateEnum state,
  ) => switch (state) {
    ClassLearnerDetailAssignmentStatesInnerStateEnum.pending =>
      l10n.learnerAssignmentPending,
    ClassLearnerDetailAssignmentStatesInnerStateEnum.onTime =>
      l10n.learnerAssignmentOnTime,
    ClassLearnerDetailAssignmentStatesInnerStateEnum.late_ =>
      l10n.learnerAssignmentLate,
    ClassLearnerDetailAssignmentStatesInnerStateEnum.overdue =>
      l10n.learnerAssignmentOverdue,
  };

  Widget _assignments(AppLocalizations l10n, ClassLearnerDetail detail) {
    if (detail.assignmentStates.isEmpty) {
      return Text(
        l10n.learnerDetailNoAssignments,
        key: const Key('detail-no-assignments'),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (final a in detail.assignmentStates)
          Text(
            _assignmentState(l10n, a.state),
            key: Key('assignment-${a.assignmentId}'),
          ),
      ],
    );
  }

  Widget _placement(AppLocalizations l10n, ClassLearnerDetail detail) {
    final p = detail.placement;
    if (p == null) {
      return Text(
        l10n.learnerDetailNoPlacement,
        key: const Key('detail-no-placement'),
      );
    }
    return Text(
      l10n.learnerDetailPlacementValue(
        p.estimatedLevel?.value ?? '—',
        p.score ?? 0,
        p.total ?? 0,
      ),
      key: const Key('detail-placement'),
    );
  }
}
