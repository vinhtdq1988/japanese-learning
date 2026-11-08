import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../path/plan_adjust_screen.dart';
import '../shared/confirm_dialog.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'locked_control.dart';

final DateFormat _dateFormat = DateFormat('yyyy-MM-dd');

/// "Lớp của tôi" của học viên thuộc lớp (spec 004, US2, FR-036, FR-037): tên lớp, tổ chức, giáo viên, lộ trình
/// lớp, danh sách dữ liệu giáo viên xem được (CÙNG thông báo với màn hình lời mời) và nút chuyển sang lộ trình
/// cá nhân (rời lớp) kèm giải thích hậu quả, cùng khối tiến độ trong lớp (US4). Bài giao bổ sung ở US5.
class MyClassScreen extends ConsumerStatefulWidget {
  const MyClassScreen({super.key});

  @override
  ConsumerState<MyClassScreen> createState() => _MyClassScreenState();
}

class _MyClassScreenState extends ConsumerState<MyClassScreen> {
  MyClass? _class;
  Object? _error;
  bool _loading = true;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final mine = await ref.read(classroomRepositoryProvider).myClass();
      if (mounted) setState(() => _class = mine);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _leave() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showConfirmDialog(
      context,
      title: l10n.myClassLeaveTitle,
      message: l10n.myClassLeaveMessage,
      confirmLabel: l10n.myClassLeave,
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _leaving = true);
    try {
      await ref.read(classroomRepositoryProvider).leave();
      if (!mounted) return;
      // Tự chuyển sang cá nhân: không phải "bị gỡ" nên không hiện thông báo mất tư cách thành viên. Làm mới
      // nguồn học để mọi điều khiển cá nhân mở lại ngay và Hôm nay/Lộ trình lấy lại lộ trình cá nhân.
      ref.read(lastClassNameProvider.notifier).set(null);
      ref.invalidate(meProvider);
      ref.invalidate(navRolesProvider);
      invalidatePlanViews(ref);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.myClassLeft)));
      context.go(AppRoutes.today);
    } on ApiError catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(describeError(context, e))));
    } finally {
      if (mounted) setState(() => _leaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.myClassTitle,
      child: _loading
          ? const LoadingView()
          : _error != null
          ? _errorView(l10n)
          : _content(l10n, _class!),
    );
  }

  Widget _errorView(AppLocalizations l10n) {
    final api = _error;
    // 404 = không thuộc lớp nào (kể cả vừa rời lớp).
    if (api is ApiError && api.statusCode == 404) {
      return EmptyView(
        key: const Key('my-class-none'),
        icon: Icons.school_outlined,
        title: l10n.myClassNone,
        message: l10n.myClassNoneRemoved,
        action: FilledButton(
          onPressed: () => context.go(AppRoutes.join),
          child: Text(l10n.joinTitle),
        ),
      );
    }
    return ErrorView(error: _error, onRetry: _load);
  }

  /// Khối "tiến độ trong lớp" (US4, FR-030): CÙNG nguồn số liệu với bảng điều khiển của giáo viên; chưa có
  /// hoạt động nào kể từ lúc vào lớp thì nói rõ "chưa bắt đầu" thay vì hiện số 0.
  Widget _progressCard(AppLocalizations l10n, MyClassProgress progress) {
    final theme = Theme.of(context);
    final ratio = progress.completionRatio;
    final accuracy = progress.reviewAccuracy;
    final lastActive = progress.lastActiveOn;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          key: const Key('my-class-progress'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.myClassProgressTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            if (!progress.hasStarted)
              Text(
                l10n.myClassProgressNotStarted,
                key: const Key('my-class-progress-empty'),
              )
            else ...<Widget>[
              if (ratio != null)
                Text(l10n.myClassProgressCompletion((ratio * 100).round())),
              Text(
                l10n.myClassProgressMinutes(
                  _minutes(progress.minutesTotal),
                  _minutes(progress.minutesLast7Days),
                ),
              ),
              Text(l10n.myClassProgressStreak(progress.streakDays)),
              if (accuracy != null)
                Text(l10n.myClassProgressAccuracy((accuracy * 100).round())),
              if (lastActive != null)
                Text(
                  l10n.myClassProgressLastActive(
                    _dateFormat.format(lastActive),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  /// Bài giao của lớp kèm hạn và trạng thái (US5, FR-024): chưa tới hạn, đúng hạn, trễ hạn hoặc quá hạn.
  Widget _assignmentsCard(
    AppLocalizations l10n,
    List<MyClassAssignmentsInner> assignments,
  ) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          key: const Key('my-class-assignments'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.myClassAssignmentsTitle,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            if (assignments.isEmpty)
              Text(
                l10n.myClassAssignmentsNone,
                key: const Key('my-class-assignments-none'),
              ),
            for (final a in assignments)
              ListTile(
                key: Key('my-assignment-${a.id}'),
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  l10n.myClassAssignmentItem(
                    a.title,
                    _dateFormat.format(a.dueOn),
                  ),
                ),
                trailing: Chip(
                  key: Key('my-assignment-state-${a.id}'),
                  label: Text(assignmentStateLabel(l10n, a.state)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// "Giáo viên đã điều chỉnh cho bạn" (FR-026): phút riêng, dời mốc và số bài được miễn.
  Widget _adjustmentsCard(AppLocalizations l10n, LearnerOverride adjust) {
    final minutes = int.tryParse(adjust.dailyMinutes?.value ?? '');
    final shift = adjust.shiftDays ?? 0;
    final exempt = adjust.exemptUnitIds?.length ?? 0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          key: const Key('my-class-adjustments'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.myClassAdjustTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            if (minutes != null) Text(l10n.myClassAdjustMinutes(minutes)),
            if (shift != 0) Text(l10n.myClassAdjustShift(shift)),
            if (exempt > 0) Text(l10n.myClassAdjustExempt(exempt)),
          ],
        ),
      ),
    );
  }

  /// Thông báo sau khi trung tâm chuyển học viên sang lớp này (FR-014, FR-016): nêu lớp cũ, nhắc quyền rời lớp.
  Widget _movedNoticeCard(AppLocalizations l10n, MyClassMovedNotice notice) {
    final from = notice.fromClassName;
    return Card(
      key: const Key('my-class-moved'),
      color: Theme.of(context).colorScheme.tertiaryContainer,
      child: ListTile(
        leading: const Icon(Icons.swap_horiz),
        title: Text(
          from == null || from.isEmpty
              ? l10n.myClassMovedNoticeGeneric
              : l10n.myClassMovedNotice(from),
        ),
      ),
    );
  }

  /// Giáo viên yêu cầu cả lớp làm bài kiểm tra trình độ (US8, FR-034): chỉ hiện khi học viên chưa nộp. Kết quả
  /// chỉ gửi cho giáo viên, không đổi lộ trình lớp hay lộ trình cá nhân.
  Widget _placementRequestCard(
    AppLocalizations l10n,
    MyClassPlacementRequest request,
  ) {
    return Card(
      key: const Key('my-class-placement'),
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.myClassPlacementTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(l10n.myClassPlacementBody),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('my-class-placement-start'),
              onPressed: request.id == null
                  ? null
                  : () => context.go(
                      '${AppRoutes.placement}?context=class&request=${request.id}',
                    ),
              child: Text(l10n.myClassPlacementStart),
            ),
          ],
        ),
      ),
    );
  }

  /// Phút hiển thị gọn: bỏ phần thập phân khi là số nguyên.
  String _minutes(num value) => value == value.roundToDouble()
      ? value.round().toString()
      : value.toStringAsFixed(1);

  Widget _content(AppLocalizations l10n, MyClass mine) {
    final theme = Theme.of(context);
    final path = mine.path;
    final teachers = mine.class_.teachers
        .map((t) => t.displayName)
        .where((n) => n.isNotEmpty)
        .join(', ');
    final disclosure = mine.disclosure;
    return ListView(
      children: <Widget>[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  mine.class_.name,
                  key: const Key('my-class-name'),
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.myClassOrg(mine.class_.organizationName),
                  key: const Key('my-class-org'),
                ),
                if (teachers.isNotEmpty)
                  Text(l10n.classChoiceTeachers(teachers)),
                Text(
                  l10n.myClassJoinedOn(
                    _dateFormat.format(mine.joinedAt.toLocal()),
                  ),
                ),
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(l10n.myClassPathTitle, style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  l10n.myClassPathSummary(
                    path.startLevel.value,
                    path.targetLevel.value,
                    int.tryParse(path.dailyMinutes.value) ?? 0,
                    _dateFormat.format(path.startsOn),
                    _dateFormat.format(path.endsOn),
                  ),
                  key: const Key('my-class-path'),
                ),
              ],
            ),
          ),
        ),
        if (mine.movedNotice != null) _movedNoticeCard(l10n, mine.movedNotice!),
        if (mine.placementRequest != null)
          _placementRequestCard(l10n, mine.placementRequest!),
        if (mine.pausedToday ?? false)
          Card(
            key: const Key('my-class-paused'),
            color: Theme.of(context).colorScheme.tertiaryContainer,
            child: ListTile(
              leading: const Icon(Icons.pause_circle_outline),
              title: Text(l10n.myClassPausedToday),
            ),
          ),
        _progressCard(l10n, mine.progress),
        _assignmentsCard(l10n, mine.assignments),
        if (mine.teacherAdjustments != null)
          _adjustmentsCard(l10n, mine.teacherAdjustments!),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              key: const Key('my-class-disclosure'),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  l10n.myClassSharedTitle,
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                for (final item in disclosure.visible) Text('• ${item.label}'),
                const SizedBox(height: 8),
                Text(
                  l10n.classChoiceNotVisibleTitle,
                  style: theme.textTheme.titleSmall,
                ),
                for (final line in disclosure.notVisible) Text('• $line'),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        // Onboarding rút gọn (tên, ngôn ngữ, múi giờ) mở từ đây vì Hôm nay không đưa học viên lớp vào onboarding.
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            key: const Key('my-class-setup'),
            onPressed: () => context.go(AppRoutes.onboarding),
            icon: const Icon(Icons.badge_outlined),
            label: Text(l10n.myClassSetup),
          ),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: OutlinedButton.icon(
            key: const Key('my-class-leave'),
            onPressed: _leaving ? null : _leave,
            icon: const Icon(Icons.logout),
            label: Text(l10n.myClassLeave),
          ),
        ),
      ],
    );
  }
}

/// Nhãn trạng thái bài giao của học viên (dùng chung "Lớp của tôi" và nhãn trên Hôm nay).
String assignmentStateLabel(
  AppLocalizations l10n,
  MyClassAssignmentsInnerStateEnum state,
) => switch (state) {
  MyClassAssignmentsInnerStateEnum.pending => l10n.learnerAssignmentPending,
  MyClassAssignmentsInnerStateEnum.onTime => l10n.learnerAssignmentOnTime,
  MyClassAssignmentsInnerStateEnum.late_ => l10n.learnerAssignmentLate,
  MyClassAssignmentsInnerStateEnum.overdue => l10n.learnerAssignmentOverdue,
};
