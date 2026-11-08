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
import '../shared/sortable_table.dart';
import '../shared/state_views.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// Tỷ lệ 0–1 → "75%". Dùng chung cho bảng điều khiển và chi tiết học viên.
String formatRatio(num? ratio) =>
    ratio == null ? '—' : '${(ratio * 100).round()}%';

/// Nhãn trạng thái tiến độ của lớp.
String progressStatusLabel(AppLocalizations l10n, ClassProgressStatus status) =>
    switch (status) {
      ClassProgressStatus.onTrack => l10n.classProgressOnTrack,
      ClassProgressStatus.behind => l10n.classProgressBehind,
      ClassProgressStatus.ahead => l10n.classProgressAhead,
      ClassProgressStatus.paused => l10n.classProgressPaused,
    };

/// Nhãn một cảnh báo của học viên (FR-031); `absent` kèm số ngày vắng.
String classAlertLabel(
  AppLocalizations l10n,
  ClassAlert alert,
  int absentDays,
) => switch (alert) {
  ClassAlert.absent => l10n.classAlertAbsent(absentDays),
  ClassAlert.behind => l10n.classAlertBehind,
  ClassAlert.overdueAssignment => l10n.classAlertOverdue,
};

/// Bảng điều khiển lớp (spec 004, US4, FR-027 → FR-030): tỷ lệ hoàn thành so với mong đợi, chuỗi ngày, phút học,
/// độ chính xác ôn, ngày học gần nhất và trạng thái tiến độ của từng học viên, kèm dòng tổng hợp. Số liệu chỉ
/// tính từ lúc học viên vào lớp; học viên chưa học gì hiện "chưa bắt đầu" thay vì số 0. Tối ưu cho desktop.
class ClassDashboardScreen extends ConsumerStatefulWidget {
  const ClassDashboardScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassDashboardScreen> createState() =>
      _ClassDashboardScreenState();
}

class _ClassDashboardScreenState extends ConsumerState<ClassDashboardScreen> {
  ClassDashboard? _dashboard;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _dashboard == null;
      _error = null;
    });
    try {
      final dashboard = await ref
          .read(classRepositoryProvider)
          .dashboard(widget.classId);
      if (mounted) setState(() => _dashboard = dashboard);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Tải CSV cả lớp và lưu qua giao diện nền tảng (Nguyên tắc V); lỗi quyền/đường truyền hiện thông báo.
  Future<void> _exportCsv() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final file = await ref
          .read(classRepositoryProvider)
          .exportClassCsv(widget.classId);
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
      title: l10n.classDashboardTitle,
      actions: <Widget>[
        TextButton.icon(
          key: const Key('dashboard-weak-topics'),
          onPressed: () =>
              context.go('${AppRoutes.classes}/${widget.classId}/weak-topics'),
          icon: const Icon(Icons.trending_down),
          label: Text(l10n.classWeakTopicsOpen),
        ),
        TextButton.icon(
          key: const Key('dashboard-export'),
          onPressed: _exportCsv,
          icon: const Icon(Icons.download),
          label: Text(l10n.classExportCsv),
        ),
        TextButton.icon(
          key: const Key('dashboard-back'),
          onPressed: () => context.go('${AppRoutes.classes}/${widget.classId}'),
          icon: const Icon(Icons.arrow_back),
          label: Text(l10n.classDashboardBack),
        ),
      ],
      child: _loading && _dashboard == null
          ? const LoadingView()
          : _error != null && _dashboard == null
          ? ErrorView(error: _error, onRetry: _load)
          : _content(l10n, _dashboard!),
    );
  }

  Widget _content(AppLocalizations l10n, ClassDashboard dashboard) {
    final theme = Theme.of(context);
    final summary = dashboard.summary;
    return ListView(
      children: <Widget>[
        Text(l10n.classDashboardIntro, style: theme.textTheme.bodySmall),
        const SizedBox(height: 12),
        if (dashboard.teacherlessWarning ?? false)
          Card(
            key: const Key('dashboard-teacherless'),
            color: theme.colorScheme.tertiaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(l10n.classDashboardTeacherless),
            ),
          ),
        for (final notice in dashboard.contentNotices)
          Card(
            key: Key('dashboard-notice-${notice.unitId}'),
            color: theme.colorScheme.secondaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(l10n.classDashboardContentNotice(notice.title)),
            ),
          ),
        Card(
          key: const Key('dashboard-summary'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  l10n.classDashboardSummaryLine(
                    summary.learnerCount,
                    summary.onTrack,
                    summary.behind,
                    summary.ahead,
                    summary.paused,
                  ),
                  style: theme.textTheme.titleMedium,
                ),
                if (summary.needAttention > 0)
                  Text(
                    l10n.classDashboardNeedAttention(summary.needAttention),
                    key: const Key('dashboard-need-attention'),
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                if (summary.avgCompletionRatio != null ||
                    summary.avgReviewAccuracy != null)
                  Text(
                    l10n.classDashboardAverages(
                      formatRatio(summary.avgCompletionRatio),
                      formatRatio(summary.avgReviewAccuracy),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        SortableTable<ClassLearnerRow>(
          columns: _columns(l10n),
          rows: dashboard.learners,
          initialSortId: 'learner',
          rowKey: (row) => ValueKey<String>('learner-${row.userId}'),
          onRowTap: (row) => context.go(
            '${AppRoutes.classes}/${widget.classId}/learners/${row.userId}',
          ),
          filters: <TableFilter<ClassLearnerRow>>[
            TableFilter(
              id: 'needs-attention',
              label: l10n.classDashboardFilterNeedsAttention,
              test: (r) => r.alerts.isNotEmpty,
            ),
            TableFilter(
              id: 'absent',
              label: l10n.classDashboardFilterAbsent,
              test: (r) => r.alerts.contains(ClassAlert.absent),
            ),
            TableFilter(
              id: 'behind',
              label: l10n.classDashboardFilterBehind,
              test: (r) => r.progressStatus == ClassProgressStatus.behind,
            ),
            TableFilter(
              id: 'paused',
              label: l10n.classDashboardFilterPaused,
              test: (r) => r.progressStatus == ClassProgressStatus.paused,
            ),
            TableFilter(
              id: 'not-started',
              label: l10n.classDashboardFilterNotStarted,
              test: (r) => !r.hasStarted,
            ),
          ],
        ),
      ],
    );
  }

  List<SortableColumn<ClassLearnerRow>> _columns(AppLocalizations l10n) {
    // Học viên chưa bắt đầu: ô số liệu hiện "—" (không phải số 0 gây hiểu nhầm); nhãn "chưa bắt đầu" ở cột tên.
    Widget number(ClassLearnerRow r, String Function() text) =>
        Text(r.hasStarted ? text() : '—');
    int byNum(num? a, num? b) => (a ?? -1).compareTo(b ?? -1);
    return <SortableColumn<ClassLearnerRow>>[
      SortableColumn(
        id: 'learner',
        label: l10n.classDashboardColLearner,
        compare: (a, b) =>
            a.displayName.toLowerCase().compareTo(b.displayName.toLowerCase()),
        cell: (_, r) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(r.displayName),
            if (!r.hasStarted)
              Text(
                l10n.classDashboardNotStarted,
                key: Key('not-started-${r.userId}'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            if (r.pathCompleted)
              Text(
                l10n.classPathCompletedBadge,
                key: Key('path-completed-${r.userId}'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
      ),
      SortableColumn(
        id: 'completion',
        label: l10n.classDashboardColCompletion,
        numeric: true,
        compare: (a, b) => byNum(a.completionRatio, b.completionRatio),
        cell: (_, r) => number(r, () => formatRatio(r.completionRatio)),
      ),
      SortableColumn(
        id: 'expected',
        label: l10n.classDashboardColExpected,
        numeric: true,
        compare: (a, b) => byNum(a.expectedRatio, b.expectedRatio),
        cell: (_, r) => Text(formatRatio(r.expectedRatio)),
      ),
      SortableColumn(
        id: 'streak',
        label: l10n.classDashboardColStreak,
        numeric: true,
        compare: (a, b) => byNum(a.streakDays, b.streakDays),
        cell: (_, r) => number(r, () => '${r.streakDays ?? 0}'),
      ),
      SortableColumn(
        id: 'minutes7',
        label: l10n.classDashboardColMinutes7,
        numeric: true,
        compare: (a, b) => byNum(a.minutesLast7Days, b.minutesLast7Days),
        cell: (_, r) => number(r, () => '${r.minutesLast7Days ?? 0}'),
      ),
      SortableColumn(
        id: 'minutes-total',
        label: l10n.classDashboardColMinutesTotal,
        numeric: true,
        compare: (a, b) => byNum(a.minutesTotal, b.minutesTotal),
        cell: (_, r) => number(r, () => '${r.minutesTotal ?? 0}'),
      ),
      SortableColumn(
        id: 'accuracy',
        label: l10n.classDashboardColAccuracy,
        numeric: true,
        compare: (a, b) => byNum(a.reviewAccuracy, b.reviewAccuracy),
        cell: (_, r) => Text(formatRatio(r.reviewAccuracy)),
      ),
      SortableColumn(
        id: 'last-active',
        label: l10n.classDashboardColLastActive,
        compare: (a, b) => (a.lastActiveOn ?? DateTime(1970)).compareTo(
          b.lastActiveOn ?? DateTime(1970),
        ),
        cell: (_, r) => Text(
          r.lastActiveOn == null ? '—' : _dateFormat.format(r.lastActiveOn!),
        ),
      ),
      SortableColumn(
        id: 'alerts',
        label: l10n.classDashboardColAlerts,
        compare: (a, b) => a.alerts.length.compareTo(b.alerts.length),
        cell: (_, r) => Wrap(
          spacing: 4,
          children: <Widget>[
            for (final alert in r.alerts)
              Chip(
                key: Key('alert-${r.userId}-${alert.value}'),
                avatar: const Icon(Icons.warning_amber, size: 16),
                label: Text(classAlertLabel(l10n, alert, r.absentDays ?? 0)),
                visualDensity: VisualDensity.compact,
              ),
          ],
        ),
      ),
      SortableColumn(
        id: 'status',
        label: l10n.classDashboardColStatus,
        compare: (a, b) =>
            a.progressStatus.index.compareTo(b.progressStatus.index),
        cell: (_, r) => Chip(
          key: Key('status-${r.userId}'),
          label: Text(progressStatusLabel(l10n, r.progressStatus)),
        ),
      ),
    ];
  }
}
