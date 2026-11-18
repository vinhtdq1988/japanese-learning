import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/domain/furigana_alignment.dart';

// Ghép cách đọc cả đoạn với từng cụm Hán tự (popup furigana bài luyện đọc).

Map<String, String?> _words(String ja, String? rd) => <String, String?>{
  for (final s in alignPassage(ja, rd))
    if (s.isWord) s.text: s.reading,
};

void main() {
  group('alignPassage', () {
    test('ghép theo mốc kana giữa các cụm Hán tự', () {
      final words = _words('来週の月曜日から休みです。', 'らいしゅうのげつようびからやすみです。');
      expect(words, <String, String?>{
        '来週': 'らいしゅう',
        '月曜日': 'げつようび',
        '休': 'やす',
      });
    });

    test('đoạn không mất ký tự nào khi nối lại', () {
      const ja = '【東町スーパー】\n牛肉　100グラム、298円';
      final text = alignPassage(ja, null).map((s) => s.text).join();
      expect(text, ja);
    });

    test('không có cách đọc → cụm vẫn bấm được nhưng reading = null', () {
      final words = _words('来週の月曜日', null);
      expect(words, <String, String?>{'来週': null, '月曜日': null});
      expect(_words('来週の月曜日', ''), <String, String?>{'来週': null, '月曜日': null});
    });

    test('cách đọc lệch văn bản → mọi cụm reading = null', () {
      expect(_words('来週の月曜日', 'ぜんぜんちがう'), <String, String?>{
        '来週': null,
        '月曜日': null,
      });
    });

    test('katakana trong văn bản khớp hiragana trong cách đọc', () {
      expect(_words('駅でコーヒーを飲む', 'えきでこーひーをのむ'), <String, String?>{
        '駅': 'えき',
        '飲': 'の',
      });
    });

    test('số và dấu `,` được giữ nguyên trong cách đọc N4', () {
      final words = _words('5,000円以上買うと', '5,000えんいじょうかうと');
      // Chữ Hán liền nhau tạo thành một cụm: 5,000円以上買 (okurigana う là mốc).
      expect(words, <String, String?>{'5,000円以上買': '5,000えんいじょうか'});
    });

    test('số đọc ra kana (午前9時 → ごぜんくじ) vẫn ghép được', () {
      final words = _words('午前9時から', 'ごぜんくじから');
      expect(words['午前9時'], 'ごぜんくじ');
    });

    test('đoạn nhiều dòng: dòng lệch không kéo theo dòng khác', () {
      final words = _words('駅に行く\n学校へ行く', 'えきにいく\nがっこうへ');
      expect(words['駅'], 'えき');
      expect(words['学校'], isNull);
    });

    test('hai cụm cách nhau dấu câu: có dấu trong cách đọc thì chia được', () {
      expect(_words('月、火', 'げつ、か'), <String, String?>{'月': 'げつ', '火': 'か'});
    });

    test(
      'hai cụm cách nhau dấu câu mà cách đọc không có dấu → không chia được',
      () {
        expect(_words('月、火', 'げつか'), <String, String?>{'月': null, '火': null});
      },
    );

    test('chọn điểm cắt khiến phần còn lại vẫn khớp (quay lui)', () {
      // 「の」 xuất hiện trong cách đọc của cụm đầu (あの) nhưng mốc thật là の sau 人.
      final words = _words('彼女の本', 'かのじょのほん');
      expect(words['彼女'], 'かのじょ');
      expect(words['本'], 'ほん');
    });
  });

  group('lookupCandidates', () {
    test('thêm 1–3 kana okurigana đứng sau cụm', () {
      final segments = alignPassage('本を借りる。', 'ほんをかりる。');
      final index = segments.indexWhere((s) => s.text == '借');
      expect(lookupCandidates(segments, index), <String>['借', '借り', '借りる']);
    });

    test('cụm cuối không có kana phía sau chỉ có chính nó', () {
      final segments = alignPassage('月曜日', null);
      expect(lookupCandidates(segments, 0), <String>['月曜日']);
    });
  });

  group('nội dung thật', () {
    test('mọi bài luyện đọc có `reading` đều ghép được ≥ 95% cụm Hán tự', () {
      final dir = Directory('../content/units');
      if (!dir.existsSync()) return; // chạy ngoài kho mã: bỏ qua
      var words = 0;
      var matched = 0;
      for (final file in dir.listSync().whereType<File>()) {
        if (!file.path.contains('reading')) continue;
        final json =
            jsonDecode(file.readAsStringSync(encoding: utf8))
                as Map<String, dynamic>;
        if (json['kind'] != 'reading') continue;
        for (final item in json['items'] as List<dynamic>) {
          final map = item as Map<String, dynamic>;
          final reading = map['reading'] as String?;
          if (reading == null || reading.isEmpty) continue;
          for (final s in alignPassage(map['japanese'] as String, reading)) {
            if (!s.isWord) continue;
            words++;
            if (s.reading != null) matched++;
          }
        }
      }
      expect(words, greaterThan(0));
      expect(matched / words, greaterThanOrEqualTo(0.95));
    });
  });
}
