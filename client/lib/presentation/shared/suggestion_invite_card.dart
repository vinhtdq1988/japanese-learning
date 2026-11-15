import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../onboarding/onboarding_labels.dart';

/// Thẻ lời mời "Gợi ý mới cho N phút" (spec 007, US1, FR-024): người học đã chỉnh kỹ năng riêng rồi đổi
/// quỹ thời gian nên hệ thống KHÔNG tự đổi, chỉ mời áp dụng bộ gợi ý mới hoặc giữ nguyên lựa chọn.
class SuggestionInviteCard extends StatelessWidget {
  const SuggestionInviteCard({
    super.key,
    required this.minutes,
    required this.skills,
    required this.onApply,
    required this.onKeep,
    this.enabled = true,
  });

  final int minutes;
  final List<String> skills;
  final VoidCallback onApply;
  final VoidCallback onKeep;

  /// `false` khi đang gửi yêu cầu: khóa hai nút để tránh bấm đôi.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Container(
      key: const Key('suggestion-invite'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.secondaryContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.suggestionInviteTitle(minutes),
            style: theme.textTheme.titleSmall?.copyWith(
              color: scheme.onSecondaryContainer,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            l10n.suggestionInviteBody(
              skills.map((skill) => skillLabel(l10n, skill)).join(', '),
            ),
            style: TextStyle(color: scheme.onSecondaryContainer),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              FilledButton(
                key: const Key('suggestion-apply'),
                onPressed: enabled ? onApply : null,
                child: Text(l10n.suggestionApply),
              ),
              OutlinedButton(
                key: const Key('suggestion-keep'),
                onPressed: enabled ? onKeep : null,
                child: Text(l10n.suggestionKeep),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
