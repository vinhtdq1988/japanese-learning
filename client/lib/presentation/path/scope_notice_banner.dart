import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../l10n/app_localizations.dart';

/// Danh sách thông báo phạm vi cần hiển thị: ưu tiên `notices` (OpenAPI 1.15.0, tính lúc đọc); máy chủ cũ chưa có
/// trường này thì lùi về `scopeNotice` (chỉ `content_ceiling_n3`).
List<ScopeNoticeCode> scopeNoticeCodes({
  List<ScopeNoticeCode>? notices,
  ScopeNotice? scopeNotice,
}) {
  if (notices != null) return notices;
  return <ScopeNoticeCode>[
    if (scopeNotice == ScopeNotice.contentCeilingN3)
      ScopeNoticeCode.contentCeilingN3,
  ];
}

/// Thông báo phạm vi nội dung: trình độ/mục tiêu vượt N3 (`content_ceiling_n3`, research R7) và ứng dụng chưa có
/// phần nghe hiểu cho mục tiêu JLPT (`listening_not_available`, spec 008, FR-022). Hiển thị theo đúng thứ tự máy
/// chủ trả; danh sách rỗng thì không hiển thị gì.
class ScopeNoticeBanner extends StatelessWidget {
  const ScopeNoticeBanner({super.key, required this.notices});

  final List<ScopeNoticeCode> notices;

  static String _message(AppLocalizations l10n, ScopeNoticeCode notice) =>
      switch (notice) {
        ScopeNoticeCode.contentCeilingN3 => l10n.scopeNoticeContentCeiling,
        ScopeNoticeCode.listeningNotAvailable =>
          l10n.scopeNoticeListeningNotAvailable,
      };

  @override
  Widget build(BuildContext context) {
    if (notices.isEmpty) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      liveRegion: true,
      child: Column(
        key: const Key('scope-notice'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (var i = 0; i < notices.length; i++) ...<Widget>[
            if (i > 0) const SizedBox(height: 8),
            Container(
              key: Key('scope-notice-${notices[i].name}'),
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
                    child: Text(
                      _message(l10n, notices[i]),
                      style: TextStyle(color: scheme.onSecondaryContainer),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
