import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../../l10n/app_localizations.dart';

/// Phông chữ Nhật đóng gói trong `assets/fonts` (khai báo ở `pubspec.yaml`): CanvasKit không dùng phông hệ
/// thống nên chữ Kanji PHẢI chỉ định phông này để không thành ô vuông (FR-006).
const String kanjiFontFamily = 'Noto Sans JP';

/// Cỡ chữ Kanji chính: 96 px, tối thiểu 72 px ở cửa sổ hẹp (research K9).
const double kanjiGlyphSize = 96;
const double kanjiGlyphSizeNarrow = 72;
const double _narrowWidth = 480;

/// Chuyển âm Kun dạng dữ liệu `た.べる` sang dạng hiển thị `た(べる)` (phần okurigana đặt trong ngoặc).
String formatKunReading(String reading) {
  final dot = reading.indexOf('.');
  if (dot < 0) return reading;
  final stem = reading.substring(0, dot);
  final okurigana = reading.substring(dot + 1);
  return okurigana.isEmpty ? stem : '$stem($okurigana)';
}

/// Thẻ chữ Kanji (US1, FR-002): chữ lớn, nghĩa, âm On/Kun, số nét, thành phần và các từ ví dụ.
/// Chỉ hiện nhóm âm có dữ liệu (chữ chỉ có âm Kun không hiện nhãn "Âm On" trống – trường hợp biên).
class KanjiCard extends StatelessWidget {
  const KanjiCard({super.key, required this.item});

  final ContentItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final details = item.kanji;
    final onReadings = details?.onReadings ?? const <String>[];
    final kunReadings = details?.kunReadings ?? const <String>[];
    final components = details?.components;
    final examples = item.examples ?? const <ContentItemExamplesInner>[];
    final narrow = MediaQuery.sizeOf(context).width < _narrowWidth;

    return Card(
      key: Key('item-${item.id}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Center(
              child: Text(
                item.japanese ?? '',
                key: const Key('kanji-glyph'),
                style: TextStyle(
                  fontFamily: kanjiFontFamily,
                  fontSize: narrow ? kanjiGlyphSizeNarrow : kanjiGlyphSize,
                  height: 1.2,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                item.meaning ?? '',
                key: const Key('kanji-meaning'),
                style: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 12),
            if (onReadings.isNotEmpty)
              _ReadingRow(
                rowKey: const Key('kanji-on'),
                label: l10n.kanjiOnLabel,
                value: onReadings.join('、'),
              ),
            if (kunReadings.isNotEmpty)
              _ReadingRow(
                rowKey: const Key('kanji-kun'),
                label: l10n.kanjiKunLabel,
                value: kunReadings.map(formatKunReading).join('、'),
              ),
            if (details != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  l10n.kanjiStrokeCount(details.strokeCount),
                  key: const Key('kanji-strokes'),
                ),
              ),
            if (components != null && components.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  l10n.kanjiComponents(components),
                  key: const Key('kanji-components'),
                ),
              ),
            if (item.explanation != null && item.explanation!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(item.explanation!),
              ),
            if (examples.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              Text(l10n.kanjiExamplesLabel, style: theme.textTheme.labelLarge),
              for (final (index, example) in examples.indexed)
                _ExampleWord(index: index, example: example),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReadingRow extends StatelessWidget {
  const _ReadingRow({
    required this.rowKey,
    required this.label,
    required this.value,
  });

  final Key rowKey;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      key: rowKey,
      padding: const EdgeInsets.only(top: 2),
      child: Text.rich(
        TextSpan(
          children: <InlineSpan>[
            TextSpan(text: '$label: ', style: theme.textTheme.labelLarge),
            TextSpan(
              text: value,
              style: const TextStyle(fontFamily: kanjiFontFamily),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExampleWord extends StatelessWidget {
  const _ExampleWord({required this.index, required this.example});

  final int index;
  final ContentItemExamplesInner example;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final reading = example.reading;
    final kanjiReading = example.kanjiReading;
    return Padding(
      key: Key('kanji-example-$index'),
      padding: const EdgeInsets.only(top: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            example.ja ?? '',
            style: theme.textTheme.titleMedium?.copyWith(
              fontFamily: kanjiFontFamily,
            ),
          ),
          if (reading != null && reading.isNotEmpty)
            Text(reading, style: theme.textTheme.bodySmall),
          Text(example.translation ?? '', style: theme.textTheme.bodySmall),
          if (kanjiReading != null && kanjiReading.isNotEmpty)
            Text(
              l10n.kanjiReadingInWord(formatKunReading(kanjiReading)),
              key: Key('kanji-example-$index-reading'),
              style: theme.textTheme.bodySmall,
            ),
        ],
      ),
    );
  }
}
