import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Bảng đoạn văn của bài luyện đọc (spec 007, US2, research §P5): được GHIM phía trên câu hỏi để người học
/// vừa đọc vừa trả lời. Thu gọn/mở được; trạng thái thu gọn chỉ nằm trong `State` (không lưu bền, mất khi rời
/// màn hình). Xuống dòng tự nhiên nên không tràn ở màn hẹp.
class PassagePanel extends StatefulWidget {
  const PassagePanel({
    super.key,
    required this.japanese,
    required this.translation,
  });

  /// Đoạn văn tiếng Nhật.
  final String japanese;

  /// Bản dịch theo ngôn ngữ giao diện (có thể rỗng).
  final String translation;

  @override
  State<PassagePanel> createState() => _PassagePanelState();
}

class _PassagePanelState extends State<PassagePanel> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      key: const Key('passage-panel'),
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.lessonPassageTitle,
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                TextButton.icon(
                  key: const Key('passage-toggle'),
                  onPressed: () => setState(() => _expanded = !_expanded),
                  icon: Icon(_expanded ? Icons.expand_less : Icons.expand_more),
                  label: Text(
                    _expanded
                        ? l10n.lessonPassageCollapse
                        : l10n.lessonPassageExpand,
                  ),
                ),
              ],
            ),
            if (_expanded) ...<Widget>[
              const SizedBox(height: 4),
              Text(widget.japanese, style: theme.textTheme.titleMedium),
              if (widget.translation.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                Text(widget.translation, style: theme.textTheme.bodySmall),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
