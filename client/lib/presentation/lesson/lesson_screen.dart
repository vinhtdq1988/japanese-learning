import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/learning_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../effects/answer_effect.dart';
import '../effects/effects_controller.dart';
import '../effects/effects_quick_control.dart';
import '../shared/page_frame.dart';
import '../review/review_view.dart';
import '../shared/state_views.dart';
import 'exercises/exercise_view.dart';
import 'kanji/kanji_card.dart';
import 'kanji/kanji_master_toggle.dart';
import 'lesson_controller.dart';

/// Màn hình bài học (T069): giải thích từ vựng/ngữ pháp → bài tập có phản hồi tức thì → hỏi lại câu sai
/// một lần ở cuối phiên (R6) → tóm tắt. Mở lại cùng mục thì tiếp tục từ câu chưa trả lời (FR-020).
/// Mất kết nối: câu trả lời được giữ lại và gửi lại; không báo hoàn thành khi chưa lưu xong (R12).
class LessonScreen extends ConsumerWidget {
  const LessonScreen({super.key, required this.planItemId});

  /// Id mục kế hoạch, hoặc id đơn vị khi là "học thêm".
  final String planItemId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final provider = lessonControllerProvider(planItemId);
    final lesson = ref.watch(provider);
    final title = lesson.valueOrNull?.session.title ?? l10n.navToday;

    return PageFrame(
      title: title,
      // Tắt/bật âm thanh bằng một thao tác mà không rời bài (spec 005, FR-020).
      actions: const <Widget>[EffectsQuickControl()],
      child: lesson.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => _buildLoadError(
          context,
          error,
          onRetry: () => ref.invalidate(provider),
        ),
        data: (LessonState state) {
          final controller = ref.read(provider.notifier);
          // Phiên ôn tập (T080) dùng chung bộ điều khiển và widget bài tập nhưng không có phần giải thích.
          return state.session.kind == LessonSessionKindEnum.review
              ? ReviewBody(state: state, controller: controller)
              : _LessonBody(state: state, controller: controller);
        },
      ),
    );
  }

  Widget _buildLoadError(
    BuildContext context,
    Object error, {
    required VoidCallback onRetry,
  }) {
    final l10n = AppLocalizations.of(context);
    if (error is ApiError && error.statusCode == 404) {
      return EmptyView(
        icon: Icons.menu_book_outlined,
        title: l10n.lessonUnavailable,
        action: const BackToTodayButton(),
      );
    }
    return ErrorView(error: error, onRetry: onRetry);
  }
}

class BackToTodayButton extends ConsumerWidget {
  const BackToTodayButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return FilledButton(
      key: const Key('back-to-today'),
      onPressed: () {
        ref.invalidate(todayProvider);
        context.go(AppRoutes.today);
      },
      child: Text(l10n.lessonBackToToday),
    );
  }
}

class _LessonBody extends StatelessWidget {
  const _LessonBody({required this.state, required this.controller});

  final LessonState state;
  final LessonController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return switch (state.phase) {
      LessonPhase.intro => _Intro(state: state, controller: controller),
      LessonPhase.exercises ||
      LessonPhase.retry => LessonPractice(state: state, controller: controller),
      LessonPhase.summary =>
        state.summary == null
            ? LessonCompleteOffline(
                message: l10n.lessonCompleteOffline,
                onRetry: controller.finish,
                busy: state.completing,
              )
            : _Summary(summary: state.summary!),
    };
  }
}

// --- Giải thích ---

class _Intro extends StatelessWidget {
  const _Intro({required this.state, required this.controller});

  final LessonState state;
  final LessonController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final items = state.session.items ?? const <ContentItem>[];
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.lessonIntroHeading, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 12),
          for (final item in items) LessonItemCard(item: item),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              key: const Key('start-exercises'),
              onPressed: controller.startExercises,
              child: Text(l10n.lessonStartExercises),
            ),
          ),
        ],
      ),
    );
  }
}

class LessonItemCard extends StatelessWidget {
  const LessonItemCard({super.key, required this.item});

  final ContentItem item;

  @override
  Widget build(BuildContext context) {
    // Chữ Kanji có thẻ riêng: chữ lớn, âm On/Kun, số nét, từ ví dụ (US1).
    if (item.kind == Skill.kanji || item.kanji != null) {
      return KanjiCard(item: item);
    }
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final examples = item.examples ?? const <ContentItemExamplesInner>[];
    return Card(
      key: Key('item-${item.id}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(item.japanese ?? '', style: theme.textTheme.headlineMedium),
            if (item.reading != null && item.reading!.isNotEmpty)
              Text(l10n.lessonReading(item.reading!)),
            const SizedBox(height: 4),
            Text(item.meaning ?? '', style: theme.textTheme.titleMedium),
            if (item.explanation != null) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                l10n.lessonExplanationLabel,
                style: theme.textTheme.labelLarge,
              ),
              Text(item.explanation!),
            ],
            if (examples.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Text(l10n.lessonExamplesLabel, style: theme.textTheme.labelLarge),
              for (final e in examples)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(e.ja ?? ''),
                      if (e.reading != null && e.reading!.isNotEmpty)
                        Text(e.reading!, style: theme.textTheme.bodySmall),
                      Text(
                        e.translation ?? '',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// --- Bài tập và hỏi lại ---

/// Phần làm bài tập và hỏi lại câu sai, dùng chung cho bài học và phiên ôn tập.
/// [showNextReview] hiển thị ngày ôn kế tiếp trong phản hồi (phiên ôn tập, US3).
class LessonPractice extends ConsumerWidget {
  const LessonPractice({
    super.key,
    required this.state,
    required this.controller,
    this.showNextReview = false,
  });

  final LessonState state;
  final LessonController controller;
  final bool showNextReview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final exercise = state.exercise;
    if (exercise == null) return const LoadingView();
    final isRetry = state.phase == LessonPhase.retry;
    final total = state.queue.length;

    // Hiệu ứng đúng/sai phủ lên khu vực làm bài, không chặn thao tác và không đổi bố cục (FR-004, FR-026).
    return AnswerEffect(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (isRetry) ...<Widget>[
              Text(
                l10n.lessonRetryHeading,
                key: const Key('retry-heading'),
                style: theme.textTheme.headlineSmall,
              ),
              Text(l10n.lessonRetryIntro),
              const SizedBox(height: 12),
            ],
            LinearProgressIndicator(
              value: total == 0 ? 0 : (state.index + 1) / total,
            ),
            const SizedBox(height: 4),
            Text(
              l10n.lessonProgress(state.index + 1, total),
              key: const Key('lesson-progress'),
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            ExerciseView(
              exercise: exercise,
              enabled: !state.submitting && state.pending == null,
              result: state.current,
              onSubmit: (answer) {
                // Mở khóa âm thanh ngay trong thao tác người học (FR-025).
                ref.read(effectsControllerProvider.notifier).prime();
                controller.submit(answer);
              },
            ),
            const SizedBox(height: 16),
            if (state.pending != null)
              _OfflineBanner(
                busy: state.submitting,
                onRetry: controller.retryPending,
              ),
            if (state.errorCode != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  l10n.errorGeneric,
                  key: const Key('lesson-error'),
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
            if (state.current != null)
              LessonFeedback(
                exercise: exercise,
                result: state.current!,
                showNextReview: showNextReview,
                isLast: state.isLastQuestion && !_hasRetry(state),
                busy: state.completing,
                onContinue: controller.next,
              ),
            if (state.completeOffline)
              LessonCompleteOffline(
                message: l10n.lessonCompleteOffline,
                onRetry: controller.finish,
                busy: state.completing,
              ),
          ],
        ),
      ),
    );
  }

  /// Sau câu cuối của giai đoạn bài tập còn câu sai để hỏi lại thì chưa phải bước hoàn thành.
  static bool _hasRetry(LessonState s) =>
      s.phase == LessonPhase.exercises && s.wrongIds.isNotEmpty;
}

class LessonFeedback extends StatelessWidget {
  const LessonFeedback({
    super.key,
    required this.exercise,
    required this.result,
    required this.showNextReview,
    required this.isLast,
    required this.busy,
    required this.onContinue,
  });

  final Exercise exercise;
  final AnswerResult result;
  final bool showNextReview;
  final bool isLast;
  final bool busy;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final correct = result.isCorrect ?? false;
    final answerText = correct ? null : formatCorrectAnswer(exercise, result);
    // Vùng thông báo trực tiếp: trình đọc màn hình đọc kết quả ngay khi thẻ xuất hiện (FR-008).
    return Semantics(
      liveRegion: true,
      container: true,
      label: correct
          ? l10n.effectsFeedbackCorrectLabel
          : l10n.effectsFeedbackIncorrectLabel,
      child: Card(
        key: const Key('feedback'),
        color: resultColor(context, correct: correct),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(correct ? Icons.check_circle : Icons.cancel_outlined),
                  const SizedBox(width: 8),
                  Text(
                    correct ? l10n.lessonCorrect : l10n.lessonIncorrect,
                    key: Key(
                      correct ? 'feedback-correct' : 'feedback-incorrect',
                    ),
                    style: theme.textTheme.titleMedium,
                  ),
                ],
              ),
              if (result.feedback != null && result.feedback!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(result.feedback!),
                ),
              if (answerText != null && answerText.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    l10n.lessonCorrectAnswer(answerText),
                    key: const Key('correct-answer'),
                  ),
                ),
              if (showNextReview && result.nextReviewDate != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    l10n.reviewNextDate(
                      DateFormat.yMMMd(
                        Localizations.localeOf(context).toString(),
                      ).format(result.nextReviewDate!),
                    ),
                    key: const Key('next-review-date'),
                  ),
                ),
              const SizedBox(height: 12),
              FilledButton(
                key: const Key('continue'),
                onPressed: busy ? null : onContinue,
                child: Text(isLast ? l10n.lessonFinish : l10n.lessonContinue),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Đáp án đúng ở dạng đọc được (server chỉ trả `correctAnswer` khi sai).
String? formatCorrectAnswer(Exercise exercise, AnswerResult result) {
  final answer = result.correctAnswer;
  if (answer == null) return null;
  switch (exercise.type) {
    case ExerciseTypeEnum.multipleChoice:
      final payload = exercise.payload;
      final choices = payload is Map ? stringList(payload['choices']) : [];
      return answer is int && answer >= 0 && answer < choices.length
          ? choices[answer]
          : null;
    case ExerciseTypeEnum.matching:
      if (answer is! List) return null;
      return answer
          .whereType<List<dynamic>>()
          .map((pair) => pair.join(' → '))
          .join(' · ');
    case ExerciseTypeEnum.fillBlank:
      return answer.toString();
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner({required this.busy, required this.onRetry});

  final bool busy;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      key: const Key('offline-banner'),
      color: theme.colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.lessonOfflineTitle, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l10n.lessonOfflineMessage),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('retry-send'),
              onPressed: busy ? null : onRetry,
              child: Text(l10n.lessonRetrySend),
            ),
          ],
        ),
      ),
    );
  }
}

class LessonCompleteOffline extends StatelessWidget {
  const LessonCompleteOffline({
    super.key,
    required this.message,
    required this.onRetry,
    required this.busy,
  });

  final String message;
  final VoidCallback onRetry;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      key: const Key('complete-offline'),
      color: theme.colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(message),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('retry-complete'),
              onPressed: busy ? null : onRetry,
              child: Text(l10n.lessonRetrySend),
            ),
          ],
        ),
      ),
    );
  }
}

// --- Tóm tắt ---

class _Summary extends StatelessWidget {
  const _Summary({required this.summary});

  final SessionSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final minutes = (summary.minutesSpent ?? 0).toStringAsFixed(1);
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Icon(
            Icons.emoji_events_outlined,
            size: 56,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.lessonSummaryHeading,
            key: const Key('summary-heading'),
            textAlign: TextAlign.center,
            style: theme.textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          Text(
            l10n.lessonSummaryScore(summary.correct ?? 0, summary.total ?? 0),
            key: const Key('summary-score'),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          Text(
            l10n.lessonSummaryTime(minutes),
            textAlign: TextAlign.center,
            key: const Key('summary-time'),
          ),
          if (summary.attentionItems?.isNotEmpty ?? false)
            _AttentionKanji(items: summary.attentionItems!),
          if (summary.dayCompleted ?? false) ...<Widget>[
            const SizedBox(height: 12),
            Text(
              l10n.lessonSummaryDayDone,
              key: const Key('summary-day-done'),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 20),
          const Center(child: BackToTodayButton()),
        ],
      ),
    );
  }
}

/// Mục "Chữ cần chú ý" của tóm tắt bài Kanji (US1.4): các chữ có câu trả lời sai trong phiên.
class _AttentionKanji extends StatelessWidget {
  const _AttentionKanji({required this.items});

  final List<SessionSummaryAttentionItemsInner> items;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        key: const Key('attention-kanji'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(l10n.kanjiAttentionHeading, style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l10n.kanjiAttentionHint, style: theme.textTheme.bodySmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              for (final item in items)
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Chip(
                      key: Key('attention-${item.itemId}'),
                      label: Text(
                        item.japanese,
                        style: const TextStyle(
                          fontFamily: kanjiFontFamily,
                          fontSize: 28,
                        ),
                      ),
                    ),
                    // Chữ đã thuộc hẳn có thể đánh dấu thành thạo để dừng ôn (US3, research K7).
                    KanjiMasterToggle(itemId: item.itemId),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
