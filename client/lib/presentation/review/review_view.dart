import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';
import '../lesson/kanji/kanji_card.dart' show kanjiFontFamily;
import '../lesson/kanji/kanji_master_toggle.dart';
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
            : ReviewSummary(
                summary: state.summary!,
                kanjiItems: <ContentItem>[
                  for (final item
                      in state.session.items ?? const <ContentItem>[])
                    if (item.kind == Skill.kanji) item,
                ],
              ),
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
  const ReviewSummary({
    super.key,
    required this.summary,
    this.kanjiItems = const <ContentItem>[],
  });

  final SessionSummary summary;

  /// Các chữ Kanji vừa ôn: cho phép đánh dấu đã thành thạo để dừng ôn chữ đó (US3, research K7).
  final List<ContentItem> kanjiItems;

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
          if (kanjiItems.isNotEmpty) _ReviewedKanji(items: kanjiItems),
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

/// Danh sách chữ Kanji vừa ôn kèm nút đánh dấu thành thạo (chữ hiển thị bằng phông Nhật đóng gói).
class _ReviewedKanji extends StatelessWidget {
  const _ReviewedKanji({required this.items});

  final List<ContentItem> items;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        key: const Key('review-kanji'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(l10n.reviewKanjiHeading, style: theme.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l10n.reviewKanjiHint, style: theme.textTheme.bodySmall),
          const SizedBox(height: 8),
          for (final item in items.where((i) => i.id != null))
            Card(
              key: Key('review-kanji-${item.id}'),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      item.japanese ?? '',
                      style: const TextStyle(
                        fontFamily: kanjiFontFamily,
                        fontSize: 36,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(item.meaning ?? ''),
                          KanjiMasterToggle(itemId: item.id!),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
