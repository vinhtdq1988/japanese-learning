import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../data/lookup_repository.dart';
import '../../domain/furigana_alignment.dart';
import '../../l10n/app_localizations.dart';
import 'kanji/kanji_card.dart' show formatKunReading;

/// Đoạn văn tiếng Nhật mà các cụm Hán tự bấm được: bấm vào mở popup nhỏ gọn hiện furigana và nghĩa, thay cho
/// dòng cách đọc hiragana dài ở dưới đoạn văn. Cách đọc của cụm được ghép từ chuỗi [reading] của cả đoạn
/// (`alignPassage`); nghĩa lấy từ [lookup] (từ vựng trùng khít và từng chữ Kanji trong thư viện).
///
/// Khi [lookup] là `null` (ví dụ dùng thử không đăng nhập) đoạn văn hiển thị như văn bản thường.
class FuriganaText extends StatefulWidget {
  const FuriganaText({
    super.key,
    required this.japanese,
    this.reading,
    this.style,
    this.lookup,
  });

  final String japanese;

  /// Cách đọc kana của cả đoạn (có thể `null`/rỗng: nội dung N3 chưa có).
  final String? reading;
  final TextStyle? style;
  final TermLookup? lookup;

  @override
  State<FuriganaText> createState() => _FuriganaTextState();
}

class _FuriganaTextState extends State<FuriganaText> {
  List<PassageSegment> _segments = const <PassageSegment>[];
  final List<TapGestureRecognizer> _recognizers = <TapGestureRecognizer>[];
  final Map<String, Future<LookupResult>> _cache =
      <String, Future<LookupResult>>{};
  OverlayEntry? _popup;

  @override
  void initState() {
    super.initState();
    _align();
  }

  @override
  void didUpdateWidget(FuriganaText old) {
    super.didUpdateWidget(old);
    if (old.japanese != widget.japanese || old.reading != widget.reading) {
      _closePopup();
      _align();
    }
  }

  void _align() {
    _disposeRecognizers();
    _segments = alignPassage(widget.japanese, widget.reading);
  }

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _closePopup();
    _disposeRecognizers();
    super.dispose();
  }

  void _closePopup() {
    _popup?.remove();
    _popup = null;
  }

  /// Tra cụm ở [index] (kèm các dạng có okurigana); mỗi cụm chỉ gọi mạng một lần cho đến khi lỗi.
  Future<LookupResult> _lookup(int index) {
    final key = _segments[index].text;
    final candidates = lookupCandidates(_segments, index);
    final cached = _cache[key];
    if (cached != null) return cached;
    final future = widget.lookup!(candidates).catchError((Object e) {
      _cache.remove(key);
      throw e;
    });
    // Popup đăng ký lắng nghe sau một khung hình: đánh dấu đã xử lý để lỗi không bị báo là "chưa bắt".
    // Popup vẫn nhận được lỗi qua FutureBuilder.
    future.ignore();
    return _cache[key] = future;
  }

  void _open(int index, Offset anchor) {
    _closePopup();
    final overlay = Overlay.of(context);
    final segment = _segments[index];
    final candidates = lookupCandidates(_segments, index);
    final future = _lookup(index);
    _popup = OverlayEntry(
      builder: (context) => _FuriganaPopup(
        anchor: anchor,
        word: segment.text,
        alignedReading: segment.reading,
        candidates: candidates,
        result: future,
        onClose: _closePopup,
      ),
    );
    overlay.insert(_popup!);
  }

  @override
  Widget build(BuildContext context) {
    final style = widget.style ?? DefaultTextStyle.of(context).style;
    if (widget.lookup == null) {
      return Text(widget.japanese, style: widget.style);
    }
    _disposeRecognizers();
    final wordStyle = style.copyWith(
      decoration: TextDecoration.underline,
      decorationStyle: TextDecorationStyle.dotted,
      decorationColor: Theme.of(context).colorScheme.primary,
    );
    final spans = <InlineSpan>[];
    for (var i = 0; i < _segments.length; i++) {
      final segment = _segments[i];
      if (!segment.isWord) {
        spans.add(TextSpan(text: segment.text));
        continue;
      }
      final recognizer = TapGestureRecognizer()
        ..onTapUp = (details) => _open(i, details.globalPosition);
      _recognizers.add(recognizer);
      spans.add(
        TextSpan(text: segment.text, style: wordStyle, recognizer: recognizer),
      );
    }
    return Text.rich(TextSpan(style: style, children: spans));
  }
}

/// Popup nhỏ gọn neo gần điểm bấm: furigana + nghĩa của từ, rồi từng chữ Kanji (nghĩa, âm On/Kun).
class _FuriganaPopup extends StatelessWidget {
  const _FuriganaPopup({
    required this.anchor,
    required this.word,
    required this.alignedReading,
    required this.candidates,
    required this.result,
    required this.onClose,
  });

  final Offset anchor;
  final String word;
  final String? alignedReading;
  final List<String> candidates;
  final Future<LookupResult> result;
  final VoidCallback onClose;

  static const double _width = 280;
  static const double _margin = 8;
  static const double _gap = 12;
  static const double _flipBelow = 260;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final width = _width.clamp(0, size.width - _margin * 2).toDouble();
    final left = (anchor.dx - width / 2).clamp(
      _margin,
      size.width - width - _margin,
    );
    // Đủ chỗ phía dưới điểm bấm thì mở xuống, không thì mở lên trên.
    final below = size.height - anchor.dy > _flipBelow;
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: GestureDetector(
            key: const Key('furigana-barrier'),
            behavior: HitTestBehavior.translucent,
            onTap: onClose,
          ),
        ),
        Positioned(
          left: left,
          width: width,
          top: below ? anchor.dy + _gap : null,
          bottom: below ? null : size.height - anchor.dy + _gap,
          child: Material(
            key: const Key('furigana-popup'),
            elevation: 6,
            borderRadius: BorderRadius.circular(12),
            color: Theme.of(context).colorScheme.surfaceContainerHigh,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 10),
              child: FutureBuilder<LookupResult>(
                future: result,
                builder: (context, snapshot) => _content(context, snapshot),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _content(BuildContext context, AsyncSnapshot<LookupResult> snapshot) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final data = snapshot.data;

    // Từ vựng khớp dài nhất (cụm kèm okurigana ưu tiên hơn cụm trần).
    LookupWord? match;
    if (data != null) {
      for (final candidate in candidates.reversed) {
        final hit = data.words.where((w) => w.term == candidate);
        if (hit.isNotEmpty) {
          match = hit.first;
          break;
        }
      }
    }
    final shownWord = match?.term ?? word;
    final reading =
        (match != null && match.term == word
            ? alignedReading ?? match.reading
            : match?.reading) ??
        alignedReading;
    final kanji = <LookupKanji>[
      for (final ch in _uniqueHan(word))
        ...?data?.kanji.where((k) => k.char == ch),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  if (reading != null && reading.isNotEmpty)
                    Text(
                      reading,
                      key: const Key('furigana-reading'),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.primary,
                      ),
                    ),
                  Text(
                    shownWord,
                    key: const Key('furigana-word'),
                    style: theme.textTheme.headlineSmall,
                  ),
                ],
              ),
            ),
            IconButton(
              key: const Key('furigana-close'),
              tooltip: l10n.lessonFuriganaClose,
              visualDensity: VisualDensity.compact,
              iconSize: 18,
              onPressed: onClose,
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        if (snapshot.connectionState != ConnectionState.done)
          const Padding(
            padding: EdgeInsets.only(top: 6, right: 8),
            child: LinearProgressIndicator(
              key: Key('furigana-loading'),
              minHeight: 2,
            ),
          )
        else if (snapshot.hasError)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Text(
              l10n.lessonFuriganaFailed,
              key: const Key('furigana-error'),
              style: TextStyle(color: theme.colorScheme.error),
            ),
          )
        else ...<Widget>[
          if (match != null)
            Padding(
              padding: const EdgeInsets.only(right: 8, top: 2),
              child: Text(
                match.meaning,
                key: const Key('furigana-meaning'),
                style: theme.textTheme.bodyLarge,
              ),
            ),
          for (final k in kanji)
            Padding(
              padding: const EdgeInsets.only(right: 8, top: 4),
              child: _KanjiLine(kanji: k),
            ),
          if (match == null && kanji.isEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 8, top: 2),
              child: Text(
                l10n.lessonFuriganaNoMeaning,
                key: const Key('furigana-no-meaning'),
                style: theme.textTheme.bodySmall,
              ),
            ),
        ],
      ],
    );
  }

  static List<String> _uniqueHan(String text) {
    final seen = <String>[];
    for (final rune in text.runes) {
      final ch = String.fromCharCode(rune);
      if (isHan(rune) && rune != 0x3005 && !seen.contains(ch)) seen.add(ch);
    }
    return seen;
  }
}

/// Một dòng gọn cho một chữ Kanji: `来  đến · On ライ · Kun く(る)`.
class _KanjiLine extends StatelessWidget {
  const _KanjiLine({required this.kanji});

  final LookupKanji kanji;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final parts = <String>[
      kanji.meaning,
      if (kanji.onReadings.isNotEmpty)
        '${l10n.kanjiOnLabel} ${kanji.onReadings.join('、')}',
      if (kanji.kunReadings.isNotEmpty)
        '${l10n.kanjiKunLabel} ${kanji.kunReadings.map(formatKunReading).join('、')}',
    ];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          kanji.char,
          key: Key('furigana-kanji-${kanji.char}'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(parts.join(' · '), style: theme.textTheme.bodySmall),
        ),
      ],
    );
  }
}
