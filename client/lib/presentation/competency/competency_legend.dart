import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';
import 'competency_chip.dart';
import 'competency_palette.dart';

/// Chú giải ba mức năng lực (FR-020): tiêu đề + một dòng `Wrap` biểu tượng và nhãn như chip, xuống dòng ở màn hẹp.
class CompetencyLegend extends StatelessWidget {
  const CompetencyLegend({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final palette = CompetencyPalette.of(context);
    return Column(
      key: const Key('competency-legend'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(l10n.competencyLegendTitle, style: theme.textTheme.labelLarge),
        const SizedBox(height: 4),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: <Widget>[
            for (final level in CompetencyLevel.values)
              Row(
                key: Key('competency-legend-${level.value}'),
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    competencyIcon(level),
                    size: 16,
                    color: competencyColors(palette, level).foreground,
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      competencyLabel(l10n, level),
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}
