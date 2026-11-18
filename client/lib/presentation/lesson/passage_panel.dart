import 'package:flutter/material.dart';

import '../../data/lookup_repository.dart';
import '../../l10n/app_localizations.dart';
import 'furigana_text.dart';

/// Bảng đoạn văn của bài luyện đọc (spec 007, US2, research §P5): được GHIM phía trên câu hỏi để người học
/// vừa đọc vừa trả lời. Thu gọn/mở được; trạng thái thu gọn chỉ nằm trong `State` (không lưu bền, mất khi rời
/// màn hình). Bản dịch mặc định ẩn, chỉ hiện khi người học bấm "Hiện bản dịch". Xuống dòng tự nhiên nên không tràn ở màn hẹp; giữ ký tự xuống dòng của đoạn và cuộn trong khung
/// khi đoạn dài (spec 008, FR-019). Có [lookup] thì các cụm Hán tự bấm được để xem furigana và nghĩa trong popup.
class PassagePanel extends StatefulWidget {
  const PassagePanel({
    super.key,
    required this.japanese,
    required this.translation,
    this.reading,
    this.lookup,
  });

  /// Đoạn văn tiếng Nhật.
  final String japanese;

  /// Bản dịch theo ngôn ngữ giao diện (có thể rỗng).
  final String translation;

  /// Cách đọc kana của cả đoạn, dùng suy ra furigana của từng cụm Hán tự (có thể `null`).
  final String? reading;

  /// Hàm tra nghĩa cụm Hán tự; `null` thì đoạn văn không bấm được.
  final TermLookup? lookup;

  @override
  State<PassagePanel> createState() => _PassagePanelState();
}

class _PassagePanelState extends State<PassagePanel> {
  bool _expanded = true;
  bool _showTranslation = false;
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Khung đoạn văn cao tối đa ≈ 40% màn hình (160–360 px): đoạn dài hơn thì cuộn trong khung.
  double _maxTextHeight(BuildContext context) =>
      (MediaQuery.sizeOf(context).height * 0.4).clamp(160.0, 360.0);

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
              // Đoạn đọc N3 dài tới 700 ký tự và có thể nhiều dòng (bảng giá, lịch, danh sách; FR-019): giữ nguyên
              // ký tự xuống dòng của nội dung và giới hạn chiều cao (cuộn trong khung) để không đẩy câu hỏi ra khỏi màn hình.
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: _maxTextHeight(context)),
                child: Scrollbar(
                  controller: _scroll,
                  child: SingleChildScrollView(
                    key: const Key('passage-scroll'),
                    controller: _scroll,
                    child: widget.lookup == null
                        ? Text(
                            widget.japanese,
                            key: const Key('passage-text'),
                            style: theme.textTheme.titleMedium,
                          )
                        : FuriganaText(
                            key: const Key('passage-text'),
                            japanese: widget.japanese,
                            reading: widget.reading,
                            style: theme.textTheme.titleMedium,
                            lookup: widget.lookup,
                          ),
                  ),
                ),
              ),
              if (widget.lookup != null) ...<Widget>[
                const SizedBox(height: 4),
                Text(l10n.lessonFuriganaHint, style: theme.textTheme.bodySmall),
              ],
              // Bản dịch mặc định ẩn để người học tự đọc hiểu; chỉ hiện khi bấm nút.
              if (widget.translation.isNotEmpty) ...<Widget>[
                const SizedBox(height: 8),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    key: const Key('passage-translation-toggle'),
                    onPressed: () =>
                        setState(() => _showTranslation = !_showTranslation),
                    icon: Icon(
                      _showTranslation
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                    label: Text(
                      _showTranslation
                          ? l10n.lessonPassageHideTranslation
                          : l10n.lessonPassageShowTranslation,
                    ),
                  ),
                ),
                if (_showTranslation)
                  Text(
                    widget.translation,
                    key: const Key('passage-translation'),
                    style: theme.textTheme.bodySmall,
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
