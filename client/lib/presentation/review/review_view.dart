import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';
import '../lesson/lesson_controller.dart';
import '../lesson/lesson_screen.dart';

/// Màn hình ôn tập (T080, US3): hiển thị phiên `kind='review'` của gói ôn trong "Hôm nay". Dùng lại bộ
/// điều khiển phiên và widget bài tập của bài học (phản hồi tức thì, hỏi lại câu sai một lần, hàng đợi
/// khi mất kết nối), khác ở chỗ: không có phần giải thích, phản hồi kèm ngày ôn kế tiếp, tóm tắt riêng.
class ReviewBody extends StatelessWidget {
  const ReviewBody({super.key, required this.state, required this.controller});

  final LessonState state;
  final LessonController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return switch (state.phase) {
      // Phiên ôn bắt đầu thẳng ở bài tập; `intro` chỉ xuất hiện khi phiên không có câu hỏi nào.
      LessonPhase.intro => EmptyReview(controller: controller),
      LessonPhase.exercises || LessonPhase.retry => LessonPractice(
        state: state,
        controller: controller,
        showNextReview: true,
      ),
      LessonPhase.summary =>
        state.summary == null
            ? LessonCompleteOffline(
                message: l10n.lessonCompleteOffline,
                onRetry: controller.finish,
                busy: state.completing,
              )
            : ReviewSummary(summary: state.summary!),
    };
  }
}

/// Phiên ôn không còn câu hỏi nào (mục bị gỡ sau khi kế hoạch được sinh): cho phép hoàn thành để đóng mục.
class EmptyReview extends StatelessWidget {
  const EmptyReview({super.key, required this.controller});

  final LessonController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(l10n.reviewEmpty, key: const Key('review-empty')),
        const SizedBox(height: 12),
        FilledButton(
          key: const Key('review-empty-finish'),
          onPressed: controller.finish,
          child: Text(l10n.reviewFinish),
        ),
      ],
    );
  }
}

/// Tóm tắt phiên ôn: số câu nhớ đúng, thời gian, nhắc rằng lịch ôn đã được cập nhật theo kết quả.
class ReviewSummary extends StatelessWidget {
  const ReviewSummary({super.key, required this.summary});

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
            Icons.replay_circle_filled_outlined,
            size: 56,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.reviewSummaryHeading,
            key: const Key('review-summary-heading'),
            textAlign: TextAlign.center,
            style: theme.textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          Text(
            l10n.reviewSummaryScore(summary.correct ?? 0, summary.total ?? 0),
            key: const Key('review-summary-score'),
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          Text(
            l10n.lessonSummaryTime(minutes),
            key: const Key('summary-time'),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.reviewSummaryHint,
            key: const Key('review-summary-hint'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
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
