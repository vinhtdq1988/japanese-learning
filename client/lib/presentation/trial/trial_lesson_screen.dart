import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/locale_provider.dart';
import '../../data/trial_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../lesson/exercises/exercise_view.dart';
import '../lesson/lesson_screen.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'trial_state.dart';

/// Nội dung bài mẫu theo ngôn ngữ giao diện (công khai, không cần đăng nhập). Tự hủy khi rời màn hình
/// nên mỗi lần vào bài mẫu đọc lại nội dung mới nhất.
final trialContentProvider = FutureProvider.autoDispose<List<TrialUnitData>>((
  ref,
) {
  final language = ref.watch(localeProvider).languageCode;
  return ref.watch(trialRepositoryProvider).content(language);
});

/// Bài mẫu dùng thử (T100, FR-037): từng đơn vị gồm phần giải thích rồi các bài tập chấm NGAY phía client
/// với phản hồi tức thì. Tiến độ lưu ở trình duyệt nên mở lại thì tiếp tục từ câu chưa làm. Khi xong đơn
/// vị cuối, gọi `POST /trial/events` một lần rồi sang màn hình mời đăng ký.
class TrialLessonScreen extends ConsumerStatefulWidget {
  const TrialLessonScreen({super.key});

  @override
  ConsumerState<TrialLessonScreen> createState() => _TrialLessonScreenState();
}

class _TrialLessonScreenState extends ConsumerState<TrialLessonScreen> {
  /// Đơn vị vừa học xong, đang hiển thị màn hình tổng kết trước khi sang đơn vị kế.
  TrialUnitData? _doneUnit;
  bool _finishing = false;

  Future<void> _onUnitFinished(TrialUnitData unit) async {
    // Đặt trước khi lưu: lưu xong sẽ đổi trạng thái và dựng lại, không được nhảy sang đơn vị kế.
    setState(() => _doneUnit = unit);
    await ref.read(trialStateProvider.notifier).completeUnit(unit.id);
  }

  Future<void> _continueAfterDone(List<TrialUnitData> units) async {
    setState(() => _doneUnit = null);
    final state = ref.read(trialStateProvider).valueOrNull ?? TrialState.empty;
    if (units.every((u) => state.isUnitCompleted(u.id))) await _finishTrial();
  }

  /// Hoàn thành bài mẫu: báo một lần (best-effort, chỉ tăng bộ đếm ẩn danh) rồi sang màn hình mời đăng ký.
  Future<void> _finishTrial() async {
    if (_finishing) return;
    _finishing = true;
    final state = ref.read(trialStateProvider).valueOrNull ?? TrialState.empty;
    if (!state.lessonEventSent) {
      final sent = await ref
          .read(trialRepositoryProvider)
          .recordLessonCompleted();
      if (sent) {
        await ref.read(trialStateProvider.notifier).markLessonEventSent();
      }
    }
    if (mounted) context.go(AppRoutes.trialFinished);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final content = ref.watch(trialContentProvider);
    final trial = ref.watch(trialStateProvider).valueOrNull;

    final Widget body;
    if (trial == null) {
      body = const LoadingView();
    } else {
      body = content.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(trialContentProvider),
        ),
        data: (units) => _buildBody(context, units, trial),
      );
    }
    return PageFrame(
      title: l10n.trialTitle,
      showNavigation: false,
      actions: <Widget>[
        TextButton(
          key: const Key('trial-back'),
          onPressed: () => context.go(AppRoutes.trial),
          child: Text(l10n.trialBackToTrial),
        ),
      ],
      child: body,
    );
  }

  Widget _buildBody(
    BuildContext context,
    List<TrialUnitData> units,
    TrialState trial,
  ) {
    final l10n = AppLocalizations.of(context);
    if (units.isEmpty) {
      return EmptyView(
        icon: Icons.menu_book_outlined,
        title: l10n.trialNoContent,
      );
    }

    final done = _doneUnit;
    if (done != null) {
      return _UnitDone(
        unit: done,
        answers: trial.answers,
        hasNext: units.any(
          (u) => u.id != done.id && !trial.isUnitCompleted(u.id),
        ),
        onContinue: () => _continueAfterDone(units),
      );
    }

    final pendingIndex = units.indexWhere((u) => !trial.isUnitCompleted(u.id));
    if (pendingIndex < 0) {
      // Đã học hết (ví dụ mở lại đường dẫn sau khi hoàn thành): sang màn hình mời đăng ký.
      if (!_finishing) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.go(AppRoutes.trialFinished);
        });
      }
      return const LoadingView();
    }
    final unit = units[pendingIndex];
    return _UnitFlow(
      key: ValueKey<String>(unit.id),
      unit: unit,
      position: pendingIndex + 1,
      total: units.length,
      answers: trial.answers,
      onFinished: () => _onUnitFinished(unit),
    );
  }
}

/// Một đơn vị: giải thích → bài tập. Vị trí ban đầu suy ra từ các câu đã trả lời được lưu.
class _UnitFlow extends ConsumerStatefulWidget {
  const _UnitFlow({
    super.key,
    required this.unit,
    required this.position,
    required this.total,
    required this.answers,
    required this.onFinished,
  });

  final TrialUnitData unit;
  final int position;
  final int total;

  /// Câu trả lời đã lưu tại thời điểm vào đơn vị (chỉ dùng để khôi phục vị trí).
  final Map<String, bool> answers;
  final VoidCallback onFinished;

  @override
  ConsumerState<_UnitFlow> createState() => _UnitFlowState();
}

class _UnitFlowState extends ConsumerState<_UnitFlow> {
  late int _index;
  late bool _intro;
  AnswerResult? _result;

  List<TrialExerciseData> get _exercises => widget.unit.exercises;

  @override
  void initState() {
    super.initState();
    final answered = _exercises
        .map((e) => e.exercise.id)
        .where(widget.answers.containsKey)
        .length;
    final firstOpen = _exercises.indexWhere(
      (e) => !widget.answers.containsKey(e.exercise.id),
    );
    _index = firstOpen < 0 ? _exercises.length : firstOpen;
    _intro = answered == 0;
    if (_exercises.isNotEmpty && firstOpen < 0) {
      // Đã trả lời hết nhưng chưa kịp đánh dấu hoàn thành đơn vị (đóng trình duyệt giữa chừng).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onFinished();
      });
    }
  }

  void _start() {
    if (_exercises.isEmpty) {
      widget.onFinished();
      return;
    }
    setState(() => _intro = false);
  }

  void _submit(Object answer) {
    final data = _exercises[_index];
    final result = data.grade(answer);
    setState(() => _result = result);
    ref
        .read(trialStateProvider.notifier)
        .recordAnswer(data.exercise.id, correct: result.isCorrect ?? false);
  }

  void _next() {
    if (_index >= _exercises.length - 1) {
      widget.onFinished();
    } else {
      setState(() {
        _index += 1;
        _result = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final unit = widget.unit;
    final header = Text(
      l10n.trialUnitProgress(widget.position, widget.total, unit.title),
      key: const Key('trial-unit-title'),
      style: theme.textTheme.titleMedium,
    );

    if (_intro) {
      return SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            header,
            const SizedBox(height: 4),
            Text(l10n.lessonIntroHeading, style: theme.textTheme.headlineSmall),
            const SizedBox(height: 12),
            for (final item in unit.items) LessonItemCard(item: item),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                key: const Key('trial-start-exercises'),
                onPressed: _start,
                child: Text(l10n.lessonStartExercises),
              ),
            ),
          ],
        ),
      );
    }

    if (_index >= _exercises.length) return const LoadingView();
    final data = _exercises[_index];
    final total = _exercises.length;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          header,
          const SizedBox(height: 8),
          LinearProgressIndicator(value: (_index + 1) / total),
          const SizedBox(height: 4),
          Text(
            l10n.lessonProgress(_index + 1, total),
            key: const Key('lesson-progress'),
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          ExerciseView(
            exercise: data.exercise,
            enabled: _result == null,
            result: _result,
            onSubmit: _submit,
          ),
          const SizedBox(height: 16),
          if (_result != null)
            LessonFeedback(
              exercise: data.exercise,
              result: _result!,
              showNextReview: false,
              isLast: _index == total - 1,
              busy: false,
              onContinue: _next,
            ),
        ],
      ),
    );
  }
}

/// Tổng kết một đơn vị bài mẫu.
class _UnitDone extends StatelessWidget {
  const _UnitDone({
    required this.unit,
    required this.answers,
    required this.hasNext,
    required this.onContinue,
  });

  final TrialUnitData unit;
  final Map<String, bool> answers;
  final bool hasNext;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ids = unit.exercises.map((e) => e.exercise.id);
    final correct = ids.where((id) => answers[id] ?? false).length;
    return Center(
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Icon(
              Icons.check_circle_outline,
              size: 56,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.trialUnitDoneHeading(unit.title),
              key: const Key('trial-unit-done'),
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.trialUnitDoneScore(correct, unit.exercises.length),
              key: const Key('trial-unit-score'),
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 24),
            Center(
              child: FilledButton(
                key: const Key('trial-next-unit'),
                onPressed: onContinue,
                child: Text(
                  hasNext ? l10n.trialNextUnit : l10n.trialLessonDoneAction,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
