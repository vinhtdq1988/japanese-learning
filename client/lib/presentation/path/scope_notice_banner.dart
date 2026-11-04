import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';

/// Thông báo trình độ/mục tiêu vượt phạm vi nội dung hiện có (chỉ đến N3, research R7).
class ScopeNoticeBanner extends StatelessWidget {
  const ScopeNoticeBanner({super.key, required this.notice});

  final ScopeNotice notice;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Container(
        key: const Key('scope-notice'),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: scheme.secondaryContainer,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              Icons.info_outline,
              color: scheme.onSecondaryContainer,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(switch (notice) {
                ScopeNotice.contentCeilingN3 => l10n.scopeNoticeContentCeiling,
              }, style: TextStyle(color: scheme.onSecondaryContainer)),
            ),
          ],
        ),
      ),
    );
  }
}
