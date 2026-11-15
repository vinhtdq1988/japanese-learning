import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';
import 'competency_palette.dart';

/// Biểu tượng của mức năng lực: màu không bao giờ là kênh thông tin duy nhất (FR-019).
IconData competencyIcon(CompetencyLevel level) => switch (level) {
  CompetencyLevel.good => Icons.check_circle,
  CompetencyLevel.needsImprovement => Icons.trending_up,
  CompetencyLevel.insufficient => Icons.hourglass_empty,
};

/// Nhãn chữ của mức năng lực.
String competencyLabel(AppLocalizations l10n, CompetencyLevel level) =>
    switch (level) {
      CompetencyLevel.good => l10n.competencyGood,
      CompetencyLevel.needsImprovement => l10n.competencyNeedsImprovement,
      CompetencyLevel.insufficient => l10n.competencyInsufficient,
    };

/// Tên kỹ năng dùng cho nhãn trợ năng của chip năng lực theo kỹ năng.
String competencySkillLabel(AppLocalizations l10n, Skill skill) =>
    switch (skill) {
      Skill.vocabulary => l10n.progressWeakSkillVocabulary,
      Skill.grammar => l10n.progressWeakSkillGrammar,
      Skill.kanji => l10n.progressWeakSkillKanji,
      Skill.reading => l10n.progressWeakSkillReading,
      Skill.writing => l10n.progressWeakSkillWriting,
    };

/// Màu của một mức theo bảng màu hiện tại.
CompetencyColors competencyColors(
  CompetencyPalette palette,
  CompetencyLevel level,
) => switch (level) {
  CompetencyLevel.good => palette.good,
  CompetencyLevel.needsImprovement => palette.needsImprovement,
  CompetencyLevel.insufficient => palette.insufficient,
};

/// Chip hiển thị mức năng lực của một đầu mục: biểu tượng + nhãn chữ + màu (spec 007, FR-016…FR-019).
/// Client chỉ HIỂN THỊ mức nhận từ API; `level == null` (máy chủ cũ không trả trường) ⇒ không hiển thị gì.
/// [label] là tên đầu mục (kỹ năng hoặc chủ đề) dùng cho nhãn trợ năng, ví dụ "Từ vựng: Tốt".
class CompetencyChip extends StatelessWidget {
  const CompetencyChip({super.key, required this.level, required this.label});

  final CompetencyLevel? level;
  final String label;

  @override
  Widget build(BuildContext context) {
    final level = this.level;
    if (level == null) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final colors = competencyColors(CompetencyPalette.of(context), level);
    final text = competencyLabel(l10n, level);
    return Semantics(
      label: l10n.competencySemantics(label, text),
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.background,
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(competencyIcon(level), size: 16, color: colors.foreground),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  text,
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: colors.foreground),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
