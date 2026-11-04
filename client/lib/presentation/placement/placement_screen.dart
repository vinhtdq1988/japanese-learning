import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/learning_repository.dart';
import '../../data/locale_provider.dart';
import '../../data/placement_repository.dart';
import '../../data/trial_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/confirm_dialog.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import '../trial/trial_state.dart';
import 'placement_result_card.dart';

/// Nơi quay về sau bài kiểm tra: tiếp tục onboarding, về lộ trình (khi làm lại) hoặc về trang dùng thử
/// (khách chưa đăng ký, T100: chấm không lưu, câu trả lời giữ ở trình duyệt để mang sang khi đăng ký).
enum PlacementOrigin {
  onboarding,
  retake,
  trial;

  static PlacementOrigin fromQuery(String? value) => value == 'onboarding'
      ? PlacementOrigin.onboarding
      : PlacementOrigin.retake;
}

/// Bài kiểm tra trình độ (T054, FR-007, FR-009): 20 câu, đồng hồ 10 phút, bỏ qua bất cứ lúc nào. Server
/// chấm và lưu kết quả; khi làm lại người học chọn xây dựng lại hay giữ lộ trình (US1.6).
class PlacementScreen extends ConsumerStatefulWidget {
  const PlacementScreen({super.key, this.origin = PlacementOrigin.retake});

  final PlacementOrigin origin;

  @override
  ConsumerState<PlacementScreen> createState() => _PlacementScreenState();
}

class _PlacementScreenState extends ConsumerState<PlacementScreen> {
  PlacementQuestionSet? _set;
  bool _loading = true;
  Object? _loadError;

  bool _started = false;
  int _index = 0;
  final Map<String, int?> _choices = <String, int?>{};
  Timer? _timer;
  int _remaining = 0;

  bool _submitting = false;
  Object? _submitError;
  PlacementResult? _result;
  bool _rebuilding = false;

  /// Khách đã bỏ kết quả dùng thử đã lưu để làm lại.
  bool _retaking = false;

  bool get _isTrial => widget.origin == PlacementOrigin.trial;

  /// Kết quả đang hiển thị: vừa nộp, hoặc (dùng thử) kết quả đã lưu ở trình duyệt từ lần trước.
  PlacementResult? get _shownResult =>
      _result ??
      (_isTrial && !_retaking
          ? ref.watch(trialStateProvider).valueOrNull?.placementResult
          : null);

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  List<PlacementQuestionSetQuestionsInner> get _questions =>
      _set?.questions ?? const <PlacementQuestionSetQuestionsInner>[];

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final set = await ref
          .read(placementRepositoryProvider)
          .questions(ref.read(localeProvider).languageCode);
      if (!mounted) return;
      setState(() {
        _set = set;
        _remaining = set.timeLimitSeconds ?? 600;
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

  void _start() {
    setState(() => _started = true);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_remaining <= 1) {
        _timer?.cancel();
        setState(() => _remaining = 0);
        // Hết giờ: nộp những câu đã trả lời.
        _submit();
        return;
      }
      setState(() => _remaining -= 1);
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    _timer?.cancel();
    final limit = _set?.timeLimitSeconds ?? 600;
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final choices = <String, int?>{
        for (final q in _questions) q.id!: _choices[q.id],
      };
      final duration = (limit - _remaining).clamp(0, limit).toInt();
      final PlacementResult result;
      if (_isTrial) {
        // Khách: server chấm không lưu; câu trả lời được giữ ở trình duyệt để mang sang khi đăng ký (FR-039).
        result = await ref
            .read(trialRepositoryProvider)
            .gradePlacement(choices: choices, durationSeconds: duration);
        await ref
            .read(trialStateProvider.notifier)
            .savePlacement(
              answers: choices,
              durationSeconds: duration,
              result: result,
            );
      } else {
        result = await ref
            .read(placementRepositoryProvider)
            .submit(choices: choices, durationSeconds: duration);
      }
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) setState(() => _submitError = e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _exit() {
    _timer?.cancel();
    context.go(switch (widget.origin) {
      PlacementOrigin.onboarding => AppRoutes.onboarding,
      PlacementOrigin.retake => AppRoutes.path,
      PlacementOrigin.trial => AppRoutes.trial,
    });
  }

  /// Khách bỏ kết quả kiểm tra dùng thử để làm lại: câu trả lời cũ không còn được mang sang (FR-039).
  Future<void> _discardTrialResult() async {
    await ref.read(trialStateProvider.notifier).discardPlacement();
    if (!mounted) return;
    final limit = _set?.timeLimitSeconds ?? 600;
    setState(() {
      _result = null;
      _retaking = true;
      _started = false;
      _index = 0;
      _choices.clear();
      _remaining = limit;
      _submitError = null;
    });
  }

  Future<void> _rebuild() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: l10n.placementRebuildConfirmTitle,
      message: l10n.placementRebuildConfirmMessage,
    );
    if (!confirmed || !mounted) return;
    setState(() => _rebuilding = true);
    try {
      await ref
          .read(learningRepositoryProvider)
          .rebuildWithPlacement(_result!.id!);
      ref.invalidate(pathProvider);
      ref.invalidate(todayProvider);
      if (mounted) context.go(AppRoutes.path);
    } catch (e) {
      if (mounted) setState(() => _submitError = e);
    } finally {
      if (mounted) setState(() => _rebuilding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final Widget body;
    final shown = _shownResult;
    if (shown != null) {
      body = _buildResult(context, l10n, shown);
    } else if (_loading) {
      body = const LoadingView();
    } else if (_loadError != null) {
      body = ErrorView(error: _loadError, onRetry: _loadQuestions);
    } else if (_submitting) {
      body = LoadingView(message: l10n.placementSubmitting);
    } else if (!_started) {
      body = _buildIntro(context, l10n);
    } else {
      body = _buildQuestion(context, l10n);
    }
    return PageFrame(
      title: l10n.placementTitle,
      showNavigation: widget.origin == PlacementOrigin.retake,
      child: body,
    );
  }

  Widget _buildIntro(BuildContext context, AppLocalizations l10n) {
    final theme = Theme.of(context);
    final minutes = ((_set?.timeLimitSeconds ?? 600) / 60).round();
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(l10n.placementIntroTitle, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(l10n.placementIntroBody(_questions.length, minutes)),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            children: <Widget>[
              FilledButton(
                key: const Key('placement-start'),
                onPressed: _questions.isEmpty ? null : _start,
                child: Text(l10n.placementStart),
              ),
              TextButton(
                key: const Key('placement-skip'),
                onPressed: _exit,
                child: Text(l10n.placementSkip),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion(BuildContext context, AppLocalizations l10n) {
    final theme = Theme.of(context);
    final q = _questions[_index];
    final isLast = _index == _questions.length - 1;
    final minutes = (_remaining ~/ 60).toString();
    final seconds = (_remaining % 60).toString().padLeft(2, '0');
    final answered = _choices.values.where((c) => c != null).length;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(
                l10n.placementQuestionProgress(_index + 1, _questions.length),
                key: const Key('placement-progress'),
                style: theme.textTheme.labelLarge,
              ),
              const Spacer(),
              Semantics(
                label: l10n.placementTimeLeft,
                child: Text(
                  '$minutes:$seconds',
                  key: const Key('placement-timer'),
                  style: theme.textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(value: (_index + 1) / _questions.length),
          const SizedBox(height: 24),
          Text(
            q.prompt ?? '',
            key: const Key('placement-prompt'),
            style: theme.textTheme.headlineSmall,
          ),
          const SizedBox(height: 16),
          for (final (i, choice) in (q.choices ?? const <String>[]).indexed)
            Semantics(
              inMutuallyExclusiveGroup: true,
              checked: _choices[q.id] == i,
              child: ListTile(
                key: Key('choice-$i'),
                selected: _choices[q.id] == i,
                leading: Icon(
                  _choices[q.id] == i
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                ),
                title: Text(choice),
                onTap: () => setState(() => _choices[q.id!] = i),
              ),
            ),
          if (_submitError != null) ...<Widget>[
            const SizedBox(height: 16),
            ErrorView(error: _submitError, onRetry: _submit),
          ],
          const SizedBox(height: 24),
          Row(
            children: <Widget>[
              OutlinedButton(
                key: const Key('placement-prev'),
                onPressed: _index == 0
                    ? null
                    : () => setState(() => _index -= 1),
                child: Text(l10n.actionBack),
              ),
              TextButton(
                key: const Key('placement-skip'),
                onPressed: _exit,
                child: Text(l10n.placementSkip),
              ),
              const Spacer(),
              if (isLast)
                FilledButton(
                  key: const Key('placement-submit'),
                  onPressed: _submit,
                  child: Text(
                    l10n.placementSubmit(answered, _questions.length),
                  ),
                )
              else
                FilledButton(
                  key: const Key('placement-next'),
                  onPressed: () => setState(() => _index += 1),
                  child: Text(l10n.actionContinue),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildResult(
    BuildContext context,
    AppLocalizations l10n,
    PlacementResult result,
  ) {
    final theme = Theme.of(context);
    final onboarding = widget.origin == PlacementOrigin.onboarding;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.placementResultTitle, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 16),
          PlacementResultCard(result: result),
          const SizedBox(height: 24),
          if (_submitError != null) ...<Widget>[
            ErrorView(error: _submitError),
            const SizedBox(height: 16),
          ],
          if (_isTrial) ...<Widget>[
            Text(l10n.trialPlacementNote),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(
                  key: const Key('trial-placement-register'),
                  onPressed: () => context.go(AppRoutes.register),
                  child: Text(l10n.trialPlacementRegister),
                ),
                OutlinedButton(
                  key: const Key('trial-placement-discard'),
                  onPressed: _discardTrialResult,
                  child: Text(l10n.trialPlacementDiscard),
                ),
                TextButton(
                  key: const Key('trial-placement-back'),
                  onPressed: _exit,
                  child: Text(l10n.trialPlacementBack),
                ),
              ],
            ),
          ] else if (onboarding)
            FilledButton(
              key: const Key('placement-continue'),
              onPressed: _exit,
              child: Text(l10n.actionContinue),
            )
          else ...<Widget>[
            Text(
              l10n.placementRetakeChoice,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(l10n.placementRetakeChoiceHint),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(
                  key: const Key('placement-rebuild'),
                  onPressed: _rebuilding ? null : _rebuild,
                  child: Text(l10n.placementRebuildPath),
                ),
                OutlinedButton(
                  key: const Key('placement-keep'),
                  onPressed: _rebuilding ? null : _exit,
                  child: Text(l10n.placementKeepPath),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
