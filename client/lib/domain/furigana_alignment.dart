/// Ghép chuỗi cách đọc kana của cả đoạn với từng cụm Hán tự trong văn bản gốc (popup furigana của bài
/// luyện đọc). Nội dung chỉ có MỘT chuỗi hiragana cho cả đoạn nên cách đọc của từng cụm được suy ra từ các
/// "mốc" kana nằm giữa các cụm Hán tự (ví dụ 来週|の|月曜日|から): mốc phải khớp lần lượt trong chuỗi cách đọc.
library;

/// Một đoạn của văn bản gốc: cụm Hán tự (có thể bấm được) hoặc phần còn lại (kana, dấu câu, xuống dòng…).
class PassageSegment {
  const PassageSegment(this.text, {this.reading, this.isWord = false});

  /// Văn bản gốc của đoạn.
  final String text;

  /// Cách đọc kana của cụm Hán tự; `null` khi không suy ra được (hoặc đoạn không phải cụm Hán tự).
  final String? reading;

  /// `true` với cụm có chứa chữ Hán: đây là phần người học bấm vào được.
  final bool isWord;

  @override
  bool operator ==(Object other) =>
      other is PassageSegment &&
      other.text == text &&
      other.reading == reading &&
      other.isWord == isWord;

  @override
  int get hashCode => Object.hash(text, reading, isWord);

  @override
  String toString() => 'PassageSegment($text, $reading, $isWord)';
}

/// Chữ Hán (CJK thống nhất, mở rộng A, tương thích) hoặc dấu lặp 々.
bool isHan(int rune) =>
    (rune >= 0x3400 && rune <= 0x4dbf) ||
    (rune >= 0x4e00 && rune <= 0x9fff) ||
    (rune >= 0xf900 && rune <= 0xfaff) ||
    rune == 0x3005;

bool _isKana(int rune) =>
    (rune >= 0x3041 && rune <= 0x3096) || // hiragana
    (rune >= 0x30a1 && rune <= 0x30fa) || // katakana
    rune == 0x30fc; // ー

/// Chữ số, chữ Latin (cả dạng full-width) và dấu `,` `.` `:` `/` `-` giữa số (5,000円; 10:30): nội dung giữ
/// nguyên các ký tự này trong cách đọc hoặc đọc ra kana, nên chúng đi cùng cụm Hán tự bên cạnh.
bool _isAlnum(int rune) =>
    (rune >= 0x30 && rune <= 0x39) ||
    (rune >= 0x41 && rune <= 0x5a) ||
    (rune >= 0x61 && rune <= 0x7a) ||
    (rune >= 0xff10 && rune <= 0xff19) ||
    (rune >= 0xff21 && rune <= 0xff3a) ||
    (rune >= 0xff41 && rune <= 0xff5a) ||
    rune == 0x2c ||
    rune == 0x2e ||
    rune == 0x3a ||
    rune == 0x2f ||
    rune == 0x2d;

/// Katakana → hiragana để so khớp mốc không phân biệt hai bảng chữ.
String _toHiragana(String s) {
  final out = StringBuffer();
  for (final r in s.runes) {
    out.writeCharCode((r >= 0x30a1 && r <= 0x30f6) ? r - 0x60 : r);
  }
  return out.toString();
}

bool _isSpace(int rune) =>
    rune == 0x20 ||
    rune == 0x09 ||
    rune == 0x0a ||
    rune == 0x0d ||
    rune == 0x3000;

/// Mức giữ lại của ký tự không phải kana khi so khớp: dấu câu và khoảng trắng đều là mốc, chỉ dấu câu là mốc,
/// hoặc bỏ cả hai (nội dung không thống nhất dấu câu giữa văn bản và cách đọc).
enum _Strictness { punctAndSpace, punct, none }

/// Chuẩn hóa cách đọc để so khớp: quy katakana về hiragana và lọc ký tự theo [strictness].
String _normalizeReading(String reading, _Strictness strictness) {
  final out = StringBuffer();
  for (final r in reading.runes) {
    final keep = switch (strictness) {
      _Strictness.punctAndSpace => true,
      _Strictness.punct => !_isSpace(r),
      _Strictness.none => _isKana(r) || _isAlnum(r),
    };
    if (keep) out.writeCharCode(r);
  }
  return _toHiragana(out.toString());
}

enum _Kind { wild, kana, other }

class _Run {
  _Run(this.kind, this.text);
  final _Kind kind;
  String text;
}

_Kind _kindOf(int rune) {
  if (isHan(rune) || _isAlnum(rune)) return _Kind.wild;
  if (_isKana(rune)) return _Kind.kana;
  return _Kind.other;
}

/// Tách [japanese] thành các đoạn liên tiếp cùng loại (không mất ký tự nào: nối lại bằng văn bản gốc).
List<_Run> _runsOf(String japanese) {
  final runs = <_Run>[];
  for (final rune in japanese.runes) {
    final kind = _kindOf(rune);
    if (runs.isNotEmpty && runs.last.kind == kind) {
      runs.last.text += String.fromCharCode(rune);
    } else {
      runs.add(_Run(kind, String.fromCharCode(rune)));
    }
  }
  return runs;
}

/// Ghép [japanese] với [reading] thành danh sách đoạn. Cụm Hán tự có cách đọc khi chuỗi mốc (kana, và dấu câu
/// nếu cách đọc giữ nguyên chúng) khớp được toàn bộ chuỗi cách đọc; không khớp (cách đọc lệch văn bản) thì mọi
/// cụm vẫn bấm được nhưng `reading = null`. Hai cụm liền nhau không có mốc giữa không chia được cách đọc.
/// Đoạn nhiều dòng mà cách đọc có cùng số dòng được ghép từng dòng để một dòng lệch không kéo theo cả đoạn.
List<PassageSegment> alignPassage(String japanese, String? reading) {
  final lines = japanese.split('\n');
  final readingLines = (reading ?? '').split('\n');
  if (lines.length > 1 && lines.length == readingLines.length) {
    final segments = <PassageSegment>[];
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) segments.add(const PassageSegment('\n'));
      segments.addAll(_alignText(lines[i], readingLines[i]));
    }
    return segments;
  }
  return _alignText(japanese, reading ?? '');
}

List<PassageSegment> _alignText(String japanese, String reading) {
  final runs = _runsOf(japanese);
  final readings = _alignRuns(runs, reading);
  final segments = <PassageSegment>[];
  for (var i = 0; i < runs.length; i++) {
    final run = runs[i];
    final isWord = run.kind == _Kind.wild && run.text.runes.any(isHan);
    segments.add(
      PassageSegment(run.text, reading: readings[i], isWord: isWord),
    );
  }
  return segments;
}

/// Thử từ chặt đến lỏng: mức giữ dấu câu/khoảng trắng, và số đứng riêng là mốc (giữ nguyên) hay đọc ra kana.
List<String?> _alignRuns(List<_Run> runs, String reading) {
  for (final strictness in _Strictness.values) {
    for (final literalDigits in const <bool>[true, false]) {
      final result = _alignPass(
        runs,
        _normalizeReading(reading, strictness),
        strictness: strictness,
        literalDigits: literalDigits,
      );
      if (result != null) return result;
    }
  }
  return List<String?>.filled(runs.length, null);
}

typedef _Item = ({bool isWild, String text, List<int> runIndexes});

/// Một lượt ghép; `null` khi các mốc không khớp trọn chuỗi cách đọc.
List<String?>? _alignPass(
  List<_Run> runs,
  String reading, {
  required _Strictness strictness,
  required bool literalDigits,
}) {
  final result = List<String?>.filled(runs.length, null);
  if (reading.isEmpty) return null;

  // Dãy mục: mốc (`isWild = false`, văn bản đã quy hiragana, bỏ khoảng trắng) hoặc cụm cần cách đọc. Mốc liền
  // nhau được nối; cụm liền nhau (không có mốc ở giữa) gộp thành một nhóm không chia được cách đọc.
  final items = <_Item>[];
  void addAnchor(String text) {
    if (text.isEmpty) return;
    if (items.isNotEmpty && !items.last.isWild) {
      final last = items.removeLast();
      items.add((
        isWild: false,
        text: last.text + text,
        runIndexes: last.runIndexes,
      ));
    } else {
      items.add((isWild: false, text: text, runIndexes: <int>[]));
    }
  }

  for (var i = 0; i < runs.length; i++) {
    final run = runs[i];
    switch (run.kind) {
      case _Kind.kana:
        addAnchor(_toHiragana(run.text));
      case _Kind.other:
        if (strictness != _Strictness.none) {
          final keep = strictness == _Strictness.punctAndSpace
              ? run.text
              : String.fromCharCodes(run.text.runes.where((r) => !_isSpace(r)));
          addAnchor(_toHiragana(keep));
        }
      case _Kind.wild:
        if (literalDigits && !run.text.runes.any(isHan)) {
          addAnchor(run.text);
        } else if (items.isNotEmpty && items.last.isWild) {
          items.last.runIndexes.add(i);
        } else {
          items.add((isWild: true, text: run.text, runIndexes: <int>[i]));
        }
    }
  }

  // Độ dài cách đọc kỳ vọng của một cụm: ≈ 2 kana mỗi chữ Hán, 1 ký tự cho chữ số/Latin; tối đa 6 mỗi chữ Hán.
  final expected = List<int>.filled(items.length, 0);
  final maxLen = List<int>.filled(items.length, 0);
  for (var g = 0; g < items.length; g++) {
    if (!items[g].isWild) continue;
    var han = 0;
    var other = 0;
    for (final i in items[g].runIndexes) {
      for (final r in runs[i].text.runes) {
        if (isHan(r)) {
          han++;
        } else {
          other++;
        }
      }
    }
    expected[g] = 2 * han + other;
    maxLen[g] = 6 * han + 4 * other;
  }

  // Quy hoạch động: cắt cách đọc sao cho các mốc khớp trọn và độ dài cách đọc của từng cụm gần kỳ vọng nhất
  // (cùng một mốc kana có thể xuất hiện ở nhiều chỗ, ví dụ 彼女の → かのじょの: không được cắt ở の đầu tiên).
  const inf = 1 << 30;
  final memo = <int, int>{};
  final choice = <int, int>{};

  int cost(int g, int len) {
    final d = len - expected[g];
    return d * d;
  }

  int solve(int g, int pos) {
    if (g == items.length) return pos == reading.length ? 0 : inf;
    final key = g * (reading.length + 1) + pos;
    final cached = memo[key];
    if (cached != null) return cached;
    final item = items[g];
    var best = inf;
    if (!item.isWild) {
      if (reading.startsWith(item.text, pos)) {
        best = solve(g + 1, pos + item.text.length);
        choice[key] = pos + item.text.length;
      }
    } else if (g == items.length - 1) {
      // Cụm cuối nhận phần còn lại (không rỗng, không dài quá mức).
      final len = reading.length - pos;
      if (len >= 1 && len <= maxLen[g]) {
        best = cost(g, len);
        choice[key] = reading.length;
      }
    } else {
      final anchor = items[g + 1].text;
      final last = (pos + maxLen[g]).clamp(0, reading.length - anchor.length);
      for (var end = pos + 1; end <= last; end++) {
        if (!reading.startsWith(anchor, end)) continue;
        final rest = solve(g + 1, end);
        if (rest >= inf) continue;
        final total = rest + cost(g, end - pos);
        if (total < best) {
          best = total;
          choice[key] = end;
        }
      }
    }
    memo[key] = best;
    return best;
  }

  if (solve(0, 0) >= inf) return null;
  var pos = 0;
  for (var g = 0; g < items.length; g++) {
    final end = choice[g * (reading.length + 1) + pos]!;
    final item = items[g];
    if (item.isWild && item.runIndexes.length == 1) {
      result[item.runIndexes.single] = reading.substring(pos, end);
    }
    pos = end;
  }
  return result;
}

/// Các cụm cần tra cho một cụm Hán tự: chính cụm và cụm kèm 1–3 kana okurigana đứng sau (để khớp động từ,
/// tính từ như 借りる), theo thứ tự ngắn → dài.
List<String> lookupCandidates(List<PassageSegment> segments, int index) {
  final word = segments[index].text;
  final candidates = <String>[word];
  if (index + 1 < segments.length && !segments[index + 1].isWord) {
    final tail = segments[index + 1].text.runes.takeWhile(_isKana).toList();
    for (var n = 1; n <= tail.length && n <= 3; n++) {
      candidates.add(word + String.fromCharCodes(tail.take(n)));
    }
  }
  return candidates;
}
