import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/progress_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../competency/competency_chip.dart';
import '../competency/competency_legend.dart';
import '../path/scope_notice_banner.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';

/// Màn hình tiến độ (T087, FR-026 → FR-029): thời gian học, số bài hoàn thành, độ chính xác khi ôn,
/// chuỗi ngày, tiến độ hướng tới mục tiêu (kèm đúng/chậm tiến độ) và các mảng làm kém. Mọi số liệu do
/// server tính từ dữ liệu đã ghi; người học mới thấy trạng thái trống thân thiện.
///
/// Từ màn hình "Hôm nay" vào đây trong ≤ 2 lần nhấp (SC-007): thanh điều hướng 1 lần nhấp, hoặc nút
/// "Xem tiến độ" ngay trên màn hình.
class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final progress = ref.watch(progressProvider);
    return PageFrame(
      title: l10n.navProgress,
      child: progress.when(
        loading: () => const LoadingView(),
        error: (Object error, StackTrace _) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(progressProvider),
        ),
        data: (ProgressSummary data) => data.isEmpty == true
            ? EmptyView(
                key: const Key('progress-empty'),
                icon: Icons.insights_outlined,
                title: l10n.progressEmptyTitle,
                message: l10n.progressEmptyMessage,
                action: FilledButton(
                  key: const Key('progress-go-today'),
                  onPressed: () => context.go(AppRoutes.today),
                  child: Text(l10n.progressEmptyAction),
                ),
              )
            : _ProgressContent(summary: data),
      ),
    );
  }
}

class _ProgressContent extends StatelessWidget {
  const _ProgressContent({required this.summary});

  final ProgressSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final accuracy = summary.reviewAccuracy;
    final streak = summary.currentStreakDays ?? 0;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.progressHeading, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: <Widget>[
              _MetricCard(
                key: const Key('metric-time'),
                icon: Icons.timer_outlined,
                label: l10n.progressStudyTime,
                value: l10n.progressMinutesValue(
                  formatMinutes(summary.totalMinutes ?? 0, locale),
                ),
              ),
              _MetricCard(
                key: const Key('metric-lessons'),
                icon: Icons.menu_book_outlined,
                label: l10n.progressLessons,
                value: '${summary.lessonsCompleted ?? 0}',
              ),
              _MetricCard(
                key: const Key('metric-review'),
                icon: Icons.replay,
                label: l10n.progressReviewAccuracy,
                value: accuracy == null
                    ? l10n.progressReviewAccuracyNone
                    : '${(accuracy * 100).round()}%',
              ),
              _MetricCard(
                key: const Key('metric-streak'),
                icon: Icons.local_fire_department_outlined,
                label: l10n.progressStreak,
                value: l10n.progressStreakDays(streak),
                note: l10n.progressStreakHint,
              ),
            ],
          ),
          if (summary.kanji != null) ...<Widget>[
            const SizedBox(height: 24),
            _KanjiSection(kanji: summary.kanji!, locale: locale),
          ],
          const SizedBox(height: 24),
          _GoalSection(goal: summary.goal, locale: locale),
          // Năng lực theo kỹ năng/chủ đề: máy chủ cũ không trả `competency` ⇒ bỏ qua cả khối.
          if (summary.competency != null) ...<Widget>[
            const SizedBox(height: 24),
            _CompetencySection(
              competency: summary.competency!,
              weakTopics: summary.weakTopics ?? const [],
            ),
          ],
          const SizedBox(height: 24),
          _WeakTopicsSection(topics: summary.weakTopics ?? const []),
          const SizedBox(height: 24),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              key: const Key('progress-adjust-plan'),
              icon: const Icon(Icons.tune),
              label: Text(l10n.progressAdjustPlan),
              onPressed: () => context.go(AppRoutes.pathAdjust),
            ),
          ),
        ],
      ),
    );
  }
}

/// Số phút hiển thị gọn: bỏ phần thập phân khi là số nguyên (17 thay vì 17,0).
String formatMinutes(num minutes, String locale) {
  final format = NumberFormat('#0.#', locale);
  return format.format(minutes);
}

/// Khối tiến độ Kanji (US4, FR-017): số chữ đã học, số bài Kanji, thời gian học Kanji và độ chính xác ôn
/// Kanji. Chỉ hiện khi server trả `kanji` (người học đã chọn Kanji hoặc đã có dữ liệu Kanji).
class _KanjiSection extends StatelessWidget {
  const _KanjiSection({required this.kanji, required this.locale});

  final ProgressSummaryKanji kanji;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final accuracy = kanji.reviewAccuracy;
    return Column(
      key: const Key('kanji-progress'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.progressKanjiHeading, style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            _MetricCard(
              key: const Key('kanji-characters'),
              icon: Icons.translate,
              label: l10n.progressKanjiCharacters,
              value: '${kanji.charactersLearned}',
            ),
            _MetricCard(
              key: const Key('kanji-lessons'),
              icon: Icons.menu_book_outlined,
              label: l10n.progressKanjiLessons,
              value: '${kanji.lessonsCompleted}',
            ),
            _MetricCard(
              key: const Key('kanji-time'),
              icon: Icons.timer_outlined,
              label: l10n.progressKanjiTime,
              value: l10n.progressMinutesValue(
                formatMinutes(kanji.minutes, locale),
              ),
              note: l10n.progressKanjiTimeNote,
            ),
            _MetricCard(
              key: const Key('kanji-accuracy'),
              icon: Icons.replay,
              label: l10n.progressKanjiAccuracy,
              value: accuracy == null
                  ? l10n.progressReviewAccuracyNone
                  : '${(accuracy * 100).round()}%',
            ),
          ],
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.note,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 220,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(icon, color: theme.colorScheme.primary),
              const SizedBox(height: 8),
              Text(label, style: theme.textTheme.labelLarge),
              const SizedBox(height: 4),
              Text(value, style: theme.textTheme.headlineSmall),
              if (note != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(note!, style: theme.textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _GoalSection extends StatelessWidget {
  const _GoalSection({required this.goal, required this.locale});

  final ProgressSummaryGoal? goal;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ratio = (goal?.completionRatio ?? 0).toDouble().clamp(0.0, 1.0);
    final percent = (ratio * 100).round();
    final onTrack = goal?.onTrack;
    final targetDate = goal?.targetDate;
    // `notices` (1.15.0): thông báo trần N3 và "chưa có phần nghe hiểu" (mục tiêu JLPT); máy chủ cũ lùi về `scopeNotice`.
    final notices = scopeNoticeCodes(
      notices: goal?.notices?.toList(),
      scopeNotice: goal?.scopeNotice,
    );

    return Card(
      key: const Key('goal-section'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(l10n.progressGoalHeading, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              l10n.progressGoalCompletion(percent),
              key: const Key('goal-completion'),
            ),
            const SizedBox(height: 4),
            LinearProgressIndicator(value: ratio),
            if (notices.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              ScopeNoticeBanner(notices: notices),
            ],
            const SizedBox(height: 12),
            if (targetDate != null)
              Text(
                l10n.progressGoalTargetDate(
                  DateFormat.yMMMd(locale).format(targetDate),
                ),
                key: const Key('goal-target-date'),
              ),
            if (onTrack == null)
              Text(
                l10n.progressGoalNoDeadline,
                key: const Key('goal-no-deadline'),
              )
            else
              Row(
                children: <Widget>[
                  Icon(
                    onTrack ? Icons.check_circle_outline : Icons.schedule,
                    color: onTrack
                        ? theme.colorScheme.primary
                        : theme.colorScheme.error,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      onTrack
                          ? l10n.progressGoalOnTrack
                          : l10n.progressGoalBehind,
                      key: Key(onTrack ? 'goal-on-track' : 'goal-behind'),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

/// Dải "Năng lực theo kỹ năng" (tối đa 5 chip), danh sách chủ đề có dữ liệu (gồm mảng yếu) và chú giải
/// (spec 007, FR-016…FR-020). Mức do máy chủ tính; client chỉ hiển thị.
class _CompetencySection extends StatelessWidget {
  const _CompetencySection({
    required this.competency,
    required this.weakTopics,
  });

  final ProgressSummaryCompetency competency;
  final List<ProgressSummaryWeakTopicsInner> weakTopics;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    // Tên chủ đề chỉ có ở danh sách mảng yếu; chủ đề khác hiển thị theo tên kỹ năng.
    final names = <String, String>{
      for (final w in weakTopics)
        if (w.topicId != null && w.name != null) w.topicId!: w.name!,
    };
    return Column(
      key: const Key('progress-competency'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.progressCompetencyTitle, style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: <Widget>[
            for (final s in competency.skills)
              Row(
                key: Key('competency-skill-${s.skill.value}'),
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(competencySkillLabel(l10n, s.skill)),
                  const SizedBox(width: 6),
                  CompetencyChip(
                    level: s.level,
                    label: competencySkillLabel(l10n, s.skill),
                  ),
                ],
              ),
          ],
        ),
        if (competency.topics.isNotEmpty) ...<Widget>[
          const SizedBox(height: 16),
          Text(
            l10n.progressCompetencyTopics,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          for (final t in competency.topics)
            Card(
              child: ListTile(
                key: Key('competency-topic-${t.topicId}'),
                title: Text(
                  names[t.topicId] ?? competencySkillLabel(l10n, t.skill),
                ),
                subtitle: t.accuracy == null
                    ? null
                    : Text(
                        l10n.progressWeakAccuracy((t.accuracy! * 100).round()),
                      ),
                trailing: CompetencyChip(
                  level: t.level,
                  label:
                      names[t.topicId] ?? competencySkillLabel(l10n, t.skill),
                ),
              ),
            ),
        ],
        const SizedBox(height: 12),
        const CompetencyLegend(),
      ],
    );
  }
}

class _WeakTopicsSection extends StatelessWidget {
  const _WeakTopicsSection({required this.topics});

  final List<ProgressSummaryWeakTopicsInner> topics;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(l10n.progressWeakHeading, style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (topics.isEmpty)
          Text(l10n.progressWeakNone, key: const Key('weak-none'))
        else
          for (final topic in topics)
            Card(
              child: ListTile(
                key: Key('weak-topic-${topic.topicId}'),
                leading: const Icon(Icons.flag_outlined),
                title: Text(topic.name ?? ''),
                subtitle: Text(
                  l10n.progressWeakAccuracy(
                    ((topic.accuracy ?? 0) * 100).round(),
                  ),
                ),
                // Nhãn kỹ năng của mảng yếu: phân biệt chủ đề Kanji với từ vựng/ngữ pháp (US4.3).
                trailing: topic.skill == null
                    ? null
                    : Chip(
                        key: Key('weak-skill-${topic.topicId}'),
                        label: Text(switch (topic.skill!) {
                          Skill.vocabulary => l10n.progressWeakSkillVocabulary,
                          Skill.grammar => l10n.progressWeakSkillGrammar,
                          Skill.kanji => l10n.progressWeakSkillKanji,
                          Skill.reading => l10n.progressWeakSkillReading,
                          Skill.writing => l10n.progressWeakSkillWriting,
                        }),
                      ),
              ),
            ),
      ],
    );
  }
}
