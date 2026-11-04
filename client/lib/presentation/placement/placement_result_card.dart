import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';

/// Kết quả kiểm tra trình độ: trình độ ước tính, điểm và mảng mạnh/yếu (FR-007). Dùng ở cả màn hình
/// kiểm tra lẫn bước placement của onboarding (kết quả mang sang từ dùng thử).
class PlacementResultCard extends StatelessWidget {
  const PlacementResultCard({super.key, required this.result});

  final PlacementResult result;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final level = result.estimatedLevel;
    final levelText = (level == null || level == Level.none)
        ? l10n.placementLevelBeginner
        : l10n.placementLevelEstimated(level.value);
    final strong = result.strongTopics ?? const <String>[];
    final weak = result.weakTopics ?? const <String>[];

    return Card(
      key: const Key('placement-result'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              levelText,
              style: theme.textTheme.titleLarge,
              key: const Key('placement-level'),
            ),
            const SizedBox(height: 4),
            Text(l10n.placementScore(result.score ?? 0, result.total ?? 0)),
            if (result.guessSuspected ?? false) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                l10n.placementGuessNote,
                key: const Key('placement-guess-note'),
              ),
            ],
            const SizedBox(height: 12),
            _TopicList(
              title: l10n.placementStrongTopics,
              topics: strong,
              emptyText: l10n.placementNoTopics,
            ),
            const SizedBox(height: 8),
            _TopicList(
              title: l10n.placementWeakTopics,
              topics: weak,
              emptyText: l10n.placementNoTopics,
            ),
          ],
        ),
      ),
    );
  }
}

class _TopicList extends StatelessWidget {
  const _TopicList({
    required this.title,
    required this.topics,
    required this.emptyText,
  });

  final String title;
  final List<String> topics;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: theme.textTheme.titleSmall),
        const SizedBox(height: 4),
        if (topics.isEmpty)
          Text(emptyText, style: theme.textTheme.bodySmall)
        else
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: <Widget>[for (final t in topics) Chip(label: Text(t))],
          ),
      ],
    );
  }
}
