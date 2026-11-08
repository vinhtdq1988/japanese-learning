import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/learning_repository.dart';
import '../../data/plan_adjustment_repository.dart';
import '../../data/progress_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../classroom/locked_control.dart';
import '../onboarding/onboarding_labels.dart';
import '../shared/confirm_dialog.dart';
import '../shared/error_messages.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

const List<String> _goalTypes = <String>['daily_conversation', 'work', 'jlpt'];
const List<String> _targetLevels = <String>['N5', 'N4', 'N3', 'N2', 'N1'];
const List<int> _dailyMinutes = <int>[5, 10, 15, 30];

/// Kỹ năng chưa có trong phiên bản này: hiển thị là tùy chọn bị khóa (giống onboarding).
const List<String> _lockedSkills = <String>['listening', 'reading'];

/// Kỹ năng bật/tắt được trong kế hoạch (Kanji từ spec 003).
const List<String> _selectableSkills = <String>[
  'vocabulary',
  'grammar',
  'kanji',
];

/// Làm mới mọi màn hình phụ thuộc lộ trình/kế hoạch sau khi người học ghi đè.
void invalidatePlanViews(WidgetRef ref) {
  ref.invalidate(pathProvider);
  ref.invalidate(todayProvider);
  ref.invalidate(progressProvider);
}

/// Màn hình điều chỉnh kế hoạch (T094, FR-016, Nguyên tắc III): đổi mục tiêu và mốc thời gian, thời gian
/// mỗi ngày, ưu tiên kỹ năng, tạm dừng/tiếp tục và xây dựng lại lộ trình. Đánh dấu "đã thành thạo" nằm
/// ngay trên từng đơn vị ở màn hình Lộ trình. Mọi thay đổi có hiệu lực từ kế hoạch kế tiếp; lịch sử học
/// và lịch ôn luôn được giữ nguyên.
class PlanAdjustScreen extends ConsumerWidget {
  const PlanAdjustScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(profileProvider);
    // Học viên thuộc lớp: mọi điều khiển lộ trình do lớp quyết định → hiện dạng khóa kèm lý do (FR-018).
    final classSummary = ref.watch(meProvider).valueOrNull?.classSummary;
    if (classSummary != null) {
      return PageFrame(
        title: l10n.planAdjustTitle,
        child: _ClassManagedAdjust(className: classSummary.className),
      );
    }
    return PageFrame(
      title: l10n.planAdjustTitle,
      child: profile.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(profileProvider),
        ),
        data: (Profile data) => _AdjustForm(profile: data),
      ),
    );
  }
}

/// Màn hình điều chỉnh kế hoạch khi thuộc lớp: các điều khiển ở dạng [LockedControl] (spec 004, US3, FR-018).
/// Giá trị hiện tại do lớp đặt lấy từ `GET /me/class`; máy chủ vẫn từ chối bằng `CLASS_MANAGED`.
class _ClassManagedAdjust extends ConsumerWidget {
  const _ClassManagedAdjust({required this.className});

  final String className;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final mine = ref.watch(_myClassForLockProvider).value;
    final path = mine?.path;
    final minutes = path?.dailyMinutes.value;
    final skills = path?.skills.map((s) => s.value).join(', ');
    return ListView(
      key: const Key('plan-adjust-class-managed'),
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(l10n.planAdjustClassIntro(className)),
        ),
        LockedControl(
          label: l10n.lockedGoal,
          value: path == null
              ? null
              : '${path.startLevel.value} → ${path.targetLevel.value} · '
                    '${_ymd(path.startsOn)} – ${_ymd(path.endsOn)}',
          showOpenClass: true,
        ),
        LockedControl(
          label: l10n.lockedMinutes,
          value: minutes == null
              ? null
              : l10n.classPathMinutesValue(int.parse(minutes)),
        ),
        LockedControl(label: l10n.lockedSkills, value: skills),
        LockedControl(label: l10n.lockedPriority),
        LockedControl(label: l10n.lockedPause),
        LockedControl(label: l10n.lockedMastered),
        LockedControl(label: l10n.lockedRebuild),
      ],
    );
  }

  static String _ymd(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
}

/// Lớp của tôi, chỉ để hiện giá trị lớp đặt trên các điều khiển bị khóa (lỗi/đang tải ⇒ không hiện giá trị).
final _myClassForLockProvider = FutureProvider.autoDispose<MyClass?>((
  ref,
) async {
  try {
    return await ref.watch(classroomRepositoryProvider).myClass();
  } on Object {
    return null;
  }
});

class _AdjustForm extends ConsumerStatefulWidget {
  const _AdjustForm({required this.profile});

  final Profile profile;

  @override
  ConsumerState<_AdjustForm> createState() => _AdjustFormState();
}

class _AdjustFormState extends ConsumerState<_AdjustForm> {
  late Profile _profile;

  // Bản nháp phần mục tiêu (chỉ gửi khi người học bấm "Áp dụng mục tiêu").
  late String _goalType;
  String? _targetLevel;
  DateTime? _targetDate;

  bool _busy = false;
  String? _message;
  bool _messageIsError = false;

  @override
  void initState() {
    super.initState();
    _adopt(widget.profile);
  }

  /// Lấy hồ sơ mới từ server làm cả giá trị hiện tại lẫn bản nháp của phần mục tiêu.
  void _adopt(Profile profile) {
    _profile = profile;
    _goalType = profile.goalType?.value ?? 'daily_conversation';
    _targetLevel = profile.targetLevel?.value;
    _targetDate = profile.targetDate;
  }

  int? get _currentMinutes => int.tryParse(_profile.dailyMinutes?.value ?? '');

  bool get _goalChanged =>
      _goalType != (_profile.goalType?.value ?? '') ||
      (_goalType == 'jlpt' && _targetLevel != _profile.targetLevel?.value) ||
      !_sameDay(_targetDate, _profile.targetDate);

  bool get _goalValid => _goalType != 'jlpt' || _targetLevel != null;

  static bool _sameDay(DateTime? a, DateTime? b) {
    if (a == null || b == null) return a == b;
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  /// Chạy một thao tác ghi đè: khóa nút khi đang gửi, hiển thị kết quả hoặc lỗi cụ thể, làm mới các màn hình.
  Future<void> _run(
    Future<Profile?> Function() action,
    String doneMessage,
  ) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final updated = await action();
      if (!mounted) return;
      invalidatePlanViews(ref);
      setState(() {
        if (updated != null) _adopt(updated);
        _busy = false;
        _message = doneMessage;
        _messageIsError = false;
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = describeError(context, e);
        _messageIsError = true;
      });
    }
  }

  Future<void> _applyGoal() {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(planAdjustmentRepositoryProvider);
    return _run(
      () => repo.update(
        ProfileChange(
          goalType: _goalType,
          targetLevel: _goalType == 'jlpt' ? _targetLevel : null,
          targetDate: _targetDate,
          clearTargetDate: _targetDate == null && _profile.targetDate != null,
        ),
      ),
      l10n.planAdjustGoalSaved,
    );
  }

  Future<void> _setMinutes(int minutes) {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(planAdjustmentRepositoryProvider);
    return _run(
      () => repo.update(ProfileChange(dailyMinutes: minutes)),
      l10n.planAdjustTimeSaved,
    );
  }

  /// Bật/tắt một kỹ năng (US2.4): chỉ đổi phạm vi kế hoạch kế tiếp, không mất tiến độ hay lịch ôn. Server tự
  /// bỏ ưu tiên nếu kỹ năng đó đang được ưu tiên; UI hiển thị ưu tiên theo kỹ năng còn chọn.
  Future<void> _toggleSkill(String skill, {required bool enabled}) {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(planAdjustmentRepositoryProvider);
    final next = <String>[
      for (final s in _selectableSkills)
        if (s == skill ? enabled : _selectedSkills.contains(s)) s,
    ];
    return _run(
      () => repo.update(ProfileChange(skills: next)),
      l10n.planAdjustSkillsSaved,
    );
  }

  List<String> get _selectedSkills =>
      (_profile.skills ?? const <Skill>[]).map((s) => s.value).toList();

  Future<void> _setPriority(String? skill) {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(planAdjustmentRepositoryProvider);
    return _run(
      () => repo.update(
        skill == null
            ? const ProfileChange(clearPrioritizedSkill: true)
            : ProfileChange(prioritizedSkill: skill),
      ),
      l10n.planAdjustSkillSaved,
    );
  }

  Future<void> _setPaused({required bool paused}) {
    final l10n = AppLocalizations.of(context);
    final repo = ref.read(planAdjustmentRepositoryProvider);
    return _run(() async {
      if (paused) {
        await repo.pause();
      } else {
        await repo.resume();
      }
      return repo.profile();
    }, paused ? l10n.planAdjustPaused : l10n.planAdjustResumed);
  }

  Future<void> _rebuild() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: l10n.planAdjustRebuildConfirmTitle,
      message: l10n.planAdjustRebuildConfirmMessage,
      confirmLabel: l10n.planAdjustRebuildButton,
    );
    if (!confirmed || !mounted) return;
    final repo = ref.read(planAdjustmentRepositoryProvider);
    await _run(() async {
      await repo.rebuild();
      return null;
    }, l10n.planAdjustRebuilt);
  }

  Future<void> _pickDeadline() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _targetDate != null && _targetDate!.isAfter(now)
          ? _targetDate!
          : now.add(const Duration(days: 30)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 5, now.month, now.day),
    );
    if (picked != null && mounted) setState(() => _targetDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final paused = _profile.paused ?? false;
    final selectedSkills = _selectedSkills;
    // Ưu tiên chỉ hợp lệ với kỹ năng còn được chọn (bỏ Kanji khi đang ưu tiên Kanji thì xóa lựa chọn ưu tiên).
    final rawPriority = _profile.prioritizedSkill?.value;
    final priority = selectedSkills.contains(rawPriority) ? rawPriority : null;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.planAdjustTitle, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(l10n.planAdjustIntro),
          if (_message != null) ...<Widget>[
            const SizedBox(height: 12),
            Semantics(
              liveRegion: true,
              child: Text(
                _message!,
                key: const Key('adjust-message'),
                style: TextStyle(
                  color: _messageIsError
                      ? theme.colorScheme.error
                      : theme.colorScheme.primary,
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          _Section(
            title: l10n.planAdjustGoalHeading,
            children: <Widget>[
              DropdownButtonFormField<String>(
                key: const Key('goal-select'),
                initialValue: _goalType,
                decoration: InputDecoration(
                  labelText: l10n.planAdjustGoalHeading,
                ),
                items: <DropdownMenuItem<String>>[
                  for (final goal in _goalTypes)
                    DropdownMenuItem<String>(
                      value: goal,
                      child: Text(goalLabel(l10n, goal)),
                    ),
                ],
                onChanged: _busy
                    ? null
                    : (String? value) {
                        if (value != null) setState(() => _goalType = value);
                      },
              ),
              if (_goalType == 'jlpt') ...<Widget>[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  key: const Key('target-level-select'),
                  initialValue: _targetLevel,
                  decoration: InputDecoration(
                    labelText: l10n.planAdjustTargetLevel,
                  ),
                  items: <DropdownMenuItem<String>>[
                    for (final level in _targetLevels)
                      DropdownMenuItem<String>(
                        value: level,
                        child: Text(levelLabel(l10n, level)),
                      ),
                  ],
                  onChanged: _busy
                      ? null
                      : (String? value) => setState(() => _targetLevel = value),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: <Widget>[
                  OutlinedButton.icon(
                    key: const Key('pick-deadline'),
                    icon: const Icon(Icons.event_outlined),
                    label: Text(
                      _targetDate == null
                          ? l10n.onboardingDeadlinePick
                          : l10n.onboardingDeadlineSelected(
                              DateFormat.yMMMd(locale).format(_targetDate!),
                            ),
                    ),
                    onPressed: _busy ? null : _pickDeadline,
                  ),
                  if (_targetDate != null) ...<Widget>[
                    const SizedBox(width: 8),
                    TextButton(
                      key: const Key('clear-deadline'),
                      onPressed: _busy
                          ? null
                          : () => setState(() => _targetDate = null),
                      child: Text(l10n.planAdjustDeadlineClear),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  key: const Key('apply-goal'),
                  onPressed: _busy || !_goalChanged || !_goalValid
                      ? null
                      : _applyGoal,
                  child: Text(l10n.planAdjustApplyGoal),
                ),
              ),
            ],
          ),
          _Section(
            title: l10n.planAdjustTimeHeading,
            children: <Widget>[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  for (final minutes in _dailyMinutes)
                    ChoiceChip(
                      key: Key('minutes-$minutes'),
                      label: Text(l10n.onboardingMinutesOption(minutes)),
                      selected: _currentMinutes == minutes,
                      onSelected: _busy || _currentMinutes == minutes
                          ? null
                          : (_) => _setMinutes(minutes),
                    ),
                ],
              ),
            ],
          ),
          _Section(
            title: l10n.planAdjustSkillsHeading,
            children: <Widget>[
              Text(l10n.planAdjustSkillsHint),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  for (final skill in _selectableSkills)
                    FilterChip(
                      key: Key('skill-toggle-$skill'),
                      label: Text(skillLabel(l10n, skill)),
                      selected: selectedSkills.contains(skill),
                      // Luôn giữ ít nhất một kỹ năng được chọn.
                      onSelected:
                          _busy ||
                              (selectedSkills.contains(skill) &&
                                  selectedSkills.length == 1)
                          ? null
                          : (bool value) => _toggleSkill(skill, enabled: value),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                l10n.planAdjustSkillsKeepOne,
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
          _Section(
            title: l10n.planAdjustSkillHeading,
            children: <Widget>[
              Text(l10n.planAdjustSkillHint),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  ChoiceChip(
                    key: const Key('priority-none'),
                    label: Text(l10n.planAdjustSkillNone),
                    selected: priority == null,
                    onSelected: _busy || priority == null
                        ? null
                        : (_) => _setPriority(null),
                  ),
                  for (final skill in _selectableSkills.where(
                    selectedSkills.contains,
                  ))
                    ChoiceChip(
                      key: Key('priority-$skill'),
                      label: Text(skillLabel(l10n, skill)),
                      selected: priority == skill,
                      onSelected: _busy || priority == skill
                          ? null
                          : (_) => _setPriority(skill),
                    ),
                  for (final skill in _lockedSkills)
                    Tooltip(
                      message: l10n.onboardingSkillLocked,
                      child: FilterChip(
                        key: Key('skill-locked-$skill'),
                        label: Text(skillLabel(l10n, skill)),
                        onSelected: null,
                        selected: false,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                l10n.onboardingSkillLocked,
                style: theme.textTheme.bodySmall,
                key: const Key('skills-locked-note'),
              ),
            ],
          ),
          _Section(
            title: l10n.planAdjustPauseHeading,
            children: <Widget>[
              Text(l10n.planAdjustPauseMessage),
              const SizedBox(height: 8),
              if (paused) ...<Widget>[
                Text(
                  l10n.planAdjustPausedStatus,
                  key: const Key('paused-status'),
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                FilledButton(
                  key: const Key('resume-path'),
                  onPressed: _busy ? null : () => _setPaused(paused: false),
                  child: Text(l10n.planAdjustResumeButton),
                ),
              ] else
                OutlinedButton(
                  key: const Key('pause-path'),
                  onPressed: _busy ? null : () => _setPaused(paused: true),
                  child: Text(l10n.planAdjustPauseButton),
                ),
            ],
          ),
          _Section(
            title: l10n.planAdjustMasteredHeading,
            children: <Widget>[
              Text(l10n.planAdjustMasteredHint),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  key: const Key('open-path-from-adjust'),
                  icon: const Icon(Icons.route_outlined),
                  label: Text(l10n.navPath),
                  onPressed: () => context.go(AppRoutes.path),
                ),
              ),
            ],
          ),
          _Section(
            title: l10n.planAdjustRebuildHeading,
            children: <Widget>[
              Text(l10n.planAdjustRebuildMessage),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  key: const Key('rebuild-path'),
                  icon: const Icon(Icons.autorenew),
                  label: Text(l10n.planAdjustRebuildButton),
                  onPressed: _busy ? null : _rebuild,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(title, style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}
