import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/account_repository.dart';
import '../../data/learning_repository.dart';
import '../../data/onboarding_repository.dart';
import '../../data/placement_repository.dart';
import '../../domain/onboarding_form.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../auth/auth_support.dart';
import 'class_onboarding_screen.dart';
import '../placement/placement_result_card.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import '../trial/trial_state.dart';
import 'onboarding_labels.dart';

/// Trình hướng dẫn onboarding nhiều bước (T053, FR-005): trình độ → mục tiêu → thời gian mỗi ngày →
/// mốc thời gian → kỹ năng → kiểm tra trình độ (tùy chọn). Tự lưu nháp sau mỗi bước để bỏ dở rồi tiếp
/// tục được; người học bỏ qua kiểm tra vẫn nhận lộ trình (FR-008).
///
/// Học viên thuộc lớp (spec 004, US3, FR-021) nhận bản RÚT GỌN ([ClassOnboardingScreen]): chỉ tên, ngôn ngữ, múi
/// giờ vì mục tiêu/trình độ/thời gian/kỹ năng do lớp quyết định.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    if (me.isLoading) return const Scaffold(body: LoadingView());
    final value = me.valueOrNull;
    if (value?.classSummary != null) return ClassOnboardingScreen(me: value!);
    return const _PersonalOnboardingScreen();
  }
}

class _PersonalOnboardingScreen extends ConsumerStatefulWidget {
  const _PersonalOnboardingScreen();

  @override
  ConsumerState<_PersonalOnboardingScreen> createState() =>
      _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<_PersonalOnboardingScreen> {
  OnboardingForm _form = OnboardingForm.empty;
  PlacementResult? _carried;

  /// Dùng kết quả kiểm tra đang có (mang từ dùng thử/vừa làm) cho lộ trình; người học có thể bỏ.
  bool _useCarried = true;
  OnboardingStep _step = OnboardingStep.level;
  bool _loading = true;
  Object? _loadError;
  bool _completing = false;
  AuthFormError? _completeError;

  static const List<OnboardingStep> _steps = OnboardingStep.values;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final snapshot = await ref.read(onboardingRepositoryProvider).load();
      if (!mounted) return;
      if (snapshot.completed) {
        context.go(AppRoutes.today);
        return;
      }
      // Khách vừa dùng thử trên cùng trình duyệt: mang câu trả lời kiểm tra trình độ sang (FR-039).
      final carried = snapshot.carriedPlacement ?? await _carryTrialPlacement();
      if (!mounted) return;
      setState(() {
        _form = snapshot.form;
        _carried = carried;
        // Tiếp tục từ bước đầu tiên chưa nhập đủ; nháp đủ hết thì vào bước cuối.
        _step = _steps.firstWhere(
          (s) => !snapshot.form.isStepComplete(s),
          orElse: () => OnboardingStep.placement,
        );
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadError = e;
          _loading = false;
        });
      }
    }
  }

  /// Mang kết quả kiểm tra trình độ dùng thử sang tài khoản mới (T101, FR-039). Gửi CÂU TRẢ LỜI (không
  /// phải kết quả) tới `POST /placement/submit` để server chấm lại; xong thì xóa trạng thái dùng thử khỏi
  /// trình duyệt. Trình duyệt khác không có trạng thái dùng thử nên không mang gì sang. Lỗi thì giữ nguyên
  /// câu trả lời và bỏ qua: người học vẫn làm kiểm tra lại hoặc bỏ qua được (FR-008).
  Future<PlacementResult?> _carryTrialPlacement() async {
    try {
      final trial = await ref.read(trialStateProvider.future);
      if (!trial.hasPlacement) return null;
      final result = await ref
          .read(placementRepositoryProvider)
          .submit(
            choices: trial.placementAnswers,
            durationSeconds: trial.placementDurationSeconds ?? 0,
          );
      await ref.read(trialStateProvider.notifier).clear();
      return result;
    } catch (_) {
      return null;
    }
  }

  /// Lưu nháp tự động; lỗi lưu không chặn người học đi tiếp (nháp chỉ để tiện bỏ dở/tiếp tục).
  Future<void> _saveDraft() async {
    try {
      await ref.read(onboardingRepositoryProvider).saveDraft(_form);
    } catch (_) {
      // Bỏ qua: bước hoàn tất gửi lại toàn bộ dữ liệu.
    }
  }

  void _update(OnboardingForm form) => setState(() => _form = form);

  Future<void> _next() async {
    await _saveDraft();
    if (!mounted) return;
    final index = _steps.indexOf(_step);
    if (index < _steps.length - 1) setState(() => _step = _steps[index + 1]);
  }

  void _back() {
    final index = _steps.indexOf(_step);
    if (index > 0) setState(() => _step = _steps[index - 1]);
  }

  Future<void> _restart() async {
    setState(() {
      _form = OnboardingForm.empty;
      _step = OnboardingStep.level;
    });
    await _saveDraft();
  }

  Future<void> _takePlacement() async {
    await _saveDraft();
    if (!mounted) return;
    context.go('${AppRoutes.placement}?context=onboarding');
  }

  Future<void> _finish() async {
    setState(() {
      _completing = true;
      _completeError = null;
    });
    final carried = _carried;
    final form = _form.copyWith(
      placementResultId: carried != null && _useCarried ? carried.id : null,
      clearPlacementResultId: !(carried != null && _useCarried),
    );
    try {
      await ref.read(onboardingRepositoryProvider).complete(form);
      // Đã chuyển sang tài khoản thật: dữ liệu dùng thử còn lại (bài mẫu) không còn ý nghĩa.
      await ref.read(trialStateProvider.notifier).clear();
      ref.invalidate(todayProvider);
      ref.invalidate(pathProvider);
      if (mounted) context.go(AppRoutes.today);
    } catch (e) {
      if (mounted) setState(() => _completeError = mapAuthError(context, e));
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final Widget body;
    if (_loading) {
      body = const LoadingView();
    } else if (_loadError != null) {
      body = ErrorView(error: _loadError, onRetry: _load);
    } else {
      body = _buildWizard(context, l10n);
    }
    return PageFrame(
      title: l10n.onboardingTitle,
      showNavigation: false,
      child: body,
    );
  }

  Widget _buildWizard(BuildContext context, AppLocalizations l10n) {
    final index = _steps.indexOf(_step);
    final isLast = index == _steps.length - 1;
    final theme = Theme.of(context);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.onboardingStepProgress(index + 1, _steps.length),
            key: const Key('onboarding-progress'),
            style: theme.textTheme.labelLarge,
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: (index + 1) / _steps.length),
          const SizedBox(height: 24),
          _buildStep(context, l10n),
          if (_form.exceedsContentScope &&
              (_step == OnboardingStep.level ||
                  _step == OnboardingStep.goal ||
                  _step == OnboardingStep.placement)) ...<Widget>[
            const SizedBox(height: 16),
            _Notice(
              key: const Key('scope-notice'),
              message: l10n.scopeNoticeContentCeiling,
            ),
          ],
          if (_completeError?.banner != null) ...<Widget>[
            const SizedBox(height: 16),
            FormBanner(message: _completeError!.banner!),
          ],
          const SizedBox(height: 24),
          Row(
            children: <Widget>[
              if (index > 0)
                OutlinedButton(
                  key: const Key('back'),
                  onPressed: _completing ? null : _back,
                  child: Text(l10n.actionBack),
                ),
              TextButton(
                key: const Key('restart'),
                onPressed: _completing ? null : _restart,
                child: Text(l10n.onboardingRestart),
              ),
              const Spacer(),
              if (!isLast)
                FilledButton(
                  key: const Key('next'),
                  onPressed: _form.isStepComplete(_step) ? _next : null,
                  child: Text(l10n.actionContinue),
                )
              else
                FilledButton(
                  key: const Key('finish'),
                  onPressed: (_form.isComplete && !_completing)
                      ? _finish
                      : null,
                  child: _completing
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.onboardingFinish),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStep(BuildContext context, AppLocalizations l10n) {
    switch (_step) {
      case OnboardingStep.level:
        return _SingleChoice<String>(
          title: l10n.onboardingLevelQuestion,
          value: _form.currentLevel,
          options: OnboardingOptions.levels,
          keyPrefix: 'level',
          labelOf: (v) => levelLabel(l10n, v),
          onChanged: (v) => _update(_form.copyWith(currentLevel: v)),
        );
      case OnboardingStep.goal:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _SingleChoice<String>(
              title: l10n.onboardingGoalQuestion,
              value: _form.goalType,
              options: OnboardingOptions.goals,
              keyPrefix: 'goal',
              labelOf: (v) => goalLabel(l10n, v),
              onChanged: (v) => _update(
                v == 'jlpt'
                    ? _form.copyWith(goalType: v)
                    : _form.copyWith(goalType: v, clearTargetLevel: true),
              ),
            ),
            if (_form.needsTargetLevel) ...<Widget>[
              const SizedBox(height: 24),
              _SingleChoice<String>(
                title: l10n.onboardingTargetLevelQuestion,
                value: _form.targetLevel,
                options: OnboardingOptions.targetLevels,
                keyPrefix: 'target',
                labelOf: (v) => levelLabel(l10n, v),
                onChanged: (v) => _update(_form.copyWith(targetLevel: v)),
              ),
            ],
          ],
        );
      case OnboardingStep.time:
        return _SingleChoice<int>(
          title: l10n.onboardingTimeQuestion,
          subtitle: l10n.onboardingTimeHint,
          value: _form.dailyMinutes,
          options: OnboardingOptions.dailyMinutes,
          keyPrefix: 'minutes',
          labelOf: (v) => l10n.onboardingMinutesOption(v),
          onChanged: (v) => _update(_form.copyWith(dailyMinutes: v)),
        );
      case OnboardingStep.deadline:
        return _DeadlineStep(
          value: _form.targetDate,
          onPicked: (date) => _update(
            _form.copyWith(targetDate: OnboardingRepository.formatDate(date)),
          ),
          onCleared: () => _update(_form.copyWith(clearTargetDate: true)),
        );
      case OnboardingStep.skills:
        return _SkillsStep(
          selected: _form.skills,
          onChanged: (skills) => _update(_form.copyWith(skills: skills)),
        );
      case OnboardingStep.placement:
        return _PlacementStep(
          carried: _carried,
          useCarried: _useCarried,
          onUseCarriedChanged: (v) => setState(() => _useCarried = v),
          onTake: _takePlacement,
        );
    }
  }
}

class _Notice extends StatelessWidget {
  const _Notice({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(
            Icons.info_outline,
            color: scheme.onSecondaryContainer,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: scheme.onSecondaryContainer),
            ),
          ),
        ],
      ),
    );
  }
}

/// Câu hỏi chọn một đáp án, mỗi đáp án là một dòng radio có khóa `<keyPrefix>-<giá trị>`.
class _SingleChoice<T> extends StatelessWidget {
  const _SingleChoice({
    required this.title,
    required this.value,
    required this.options,
    required this.keyPrefix,
    required this.labelOf,
    required this.onChanged,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final T? value;
  final List<T> options;
  final String keyPrefix;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(title, style: theme.textTheme.titleLarge),
        if (subtitle != null) ...<Widget>[
          const SizedBox(height: 4),
          Text(subtitle!, style: theme.textTheme.bodyMedium),
        ],
        const SizedBox(height: 8),
        for (final option in options)
          Semantics(
            inMutuallyExclusiveGroup: true,
            checked: option == value,
            child: ListTile(
              key: Key('$keyPrefix-$option'),
              selected: option == value,
              leading: Icon(
                option == value
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
              ),
              title: Text(labelOf(option)),
              onTap: () => onChanged(option),
            ),
          ),
      ],
    );
  }
}

class _DeadlineStep extends StatelessWidget {
  const _DeadlineStep({
    required this.value,
    required this.onPicked,
    required this.onCleared,
  });

  final String? value;
  final ValueChanged<DateTime> onPicked;
  final VoidCallback onCleared;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          l10n.onboardingDeadlineQuestion,
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(l10n.onboardingDeadlineHint),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: <Widget>[
            OutlinedButton.icon(
              key: const Key('deadline-pick'),
              icon: const Icon(Icons.event),
              label: Text(
                value == null
                    ? l10n.onboardingDeadlinePick
                    : l10n.onboardingDeadlineSelected(value!),
              ),
              onPressed: () async {
                final now = DateTime.now();
                final picked = await showDatePicker(
                  context: context,
                  initialDate: value == null
                      ? now.add(const Duration(days: 90))
                      : DateTime.parse(value!),
                  firstDate: DateTime(now.year, now.month, now.day),
                  lastDate: DateTime(now.year + 5, now.month, now.day),
                );
                if (picked != null) onPicked(picked);
              },
            ),
            if (value != null)
              TextButton(
                key: const Key('deadline-clear'),
                onPressed: onCleared,
                child: Text(l10n.onboardingDeadlineNone),
              ),
          ],
        ),
      ],
    );
  }
}

class _SkillsStep extends StatelessWidget {
  const _SkillsStep({required this.selected, required this.onChanged});

  final List<String> selected;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingSkillsQuestion, style: theme.textTheme.titleLarge),
        const SizedBox(height: 8),
        for (final skill in OnboardingOptions.skills)
          CheckboxListTile(
            key: Key('skill-$skill'),
            value: selected.contains(skill),
            title: Text(skillLabel(l10n, skill)),
            onChanged: (checked) {
              final next = <String>[...selected];
              if (checked ?? false) {
                if (!next.contains(skill)) next.add(skill);
              } else {
                next.remove(skill);
              }
              onChanged(next);
            },
          ),
        // Kỹ năng chưa có ở Giai đoạn 1: hiển thị nhưng khóa, kèm ghi chú.
        for (final skill in OnboardingOptions.lockedSkills)
          CheckboxListTile(
            key: Key('skill-$skill'),
            value: false,
            enabled: false,
            title: Text(skillLabel(l10n, skill)),
            subtitle: Text(l10n.onboardingSkillLocked),
            onChanged: null,
          ),
      ],
    );
  }
}

class _PlacementStep extends StatelessWidget {
  const _PlacementStep({
    required this.carried,
    required this.useCarried,
    required this.onUseCarriedChanged,
    required this.onTake,
  });

  final PlacementResult? carried;
  final bool useCarried;
  final ValueChanged<bool> onUseCarriedChanged;
  final VoidCallback onTake;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final result = carried;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.onboardingPlacementTitle, style: theme.textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(l10n.onboardingPlacementIntro),
        const SizedBox(height: 16),
        if (result != null) ...<Widget>[
          Text(
            l10n.onboardingPlacementCarriedTitle,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          PlacementResultCard(result: result),
          const SizedBox(height: 8),
          if (useCarried)
            TextButton(
              key: const Key('placement-discard'),
              onPressed: () => onUseCarriedChanged(false),
              child: Text(l10n.onboardingPlacementDiscard),
            )
          else ...<Widget>[
            Text(
              l10n.onboardingPlacementDiscarded,
              key: const Key('placement-discarded'),
            ),
            TextButton(
              key: const Key('placement-use'),
              onPressed: () => onUseCarriedChanged(true),
              child: Text(l10n.onboardingPlacementUseResult),
            ),
          ],
          const SizedBox(height: 8),
        ],
        OutlinedButton(
          key: const Key('placement-take'),
          onPressed: onTake,
          child: Text(
            result != null && !useCarried
                ? l10n.onboardingPlacementRetake
                : l10n.onboardingPlacementTake,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          result != null && useCarried
              ? l10n.onboardingPlacementUsingHint
              : l10n.onboardingPlacementSkipHint,
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
