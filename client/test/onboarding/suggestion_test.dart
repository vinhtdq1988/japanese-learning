import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/domain/study_suggestion.dart';

// Gợi ý kỹ năng theo quỹ thời gian (spec 007, US1, T028): hàm thuần `reconcileSuggestion` theo bảng
// research.md §P11 và `isPracticeLockedFor`.

const Map<int, List<String>> _table = <int, List<String>>{
  5: <String>['vocabulary'],
  10: <String>['vocabulary', 'grammar'],
  15: <String>['vocabulary', 'grammar', 'kanji'],
  30: <String>['vocabulary', 'grammar', 'kanji', 'reading', 'writing'],
};

const List<String> _available = <String>['vocabulary', 'grammar', 'kanji'];

SuggestionResult _run(
  Set<String> current, {
  int? oldMinutes,
  required int newMinutes,
  List<String> available = _available,
}) {
  return reconcileSuggestion(
    currentSkills: current,
    oldMinutes: oldMinutes,
    newMinutes: newMinutes,
    table: _table,
    availableSkills: available,
  );
}

void main() {
  group('reconcileSuggestion', () {
    test(
      'kỹ năng đang bằng gợi ý của phút cũ ⇒ điền gợi ý phút mới, không lời mời',
      () {
        final result = _run(
          <String>{'vocabulary', 'grammar'},
          oldMinutes: 10,
          newMinutes: 15,
        );
        expect(result.filled, isTrue);
        expect(result.skills, <String>['vocabulary', 'grammar', 'kanji']);
        expect(result.invite, isNull);
      },
    );

    test('chưa chọn gì (rỗng) ⇒ điền gợi ý, kể cả khi chưa có phút cũ', () {
      final result = _run(<String>{}, newMinutes: 10);
      expect(result.filled, isTrue);
      expect(result.skills, <String>['vocabulary', 'grammar']);
      expect(result.invite, isNull);
    });

    test('đã chỉnh (khác gợi ý phút cũ) ⇒ giữ nguyên và trả lời mời', () {
      final result = _run(
        <String>{'vocabulary', 'kanji'},
        oldMinutes: 15,
        newMinutes: 30,
      );
      expect(result.filled, isFalse);
      expect(result.skills, <String>['vocabulary', 'kanji']);
      expect(result.invite, <String>['vocabulary', 'grammar', 'kanji']);
    });

    test('thứ tự kỹ năng không ảnh hưởng phép so sánh với gợi ý phút cũ', () {
      final result = _run(
        <String>{'grammar', 'vocabulary'},
        oldMinutes: 10,
        newMinutes: 5,
      );
      expect(result.filled, isTrue);
      expect(result.skills, <String>['vocabulary']);
    });

    test('chỉ giữ kỹ năng nằm trong danh sách lựa chọn khả dụng', () {
      // Mức 30 gợi ý cả reading/writing nhưng màn chưa cho chọn hai kỹ năng này.
      final filled = _run(
        <String>{'vocabulary', 'grammar', 'kanji'},
        oldMinutes: 15,
        newMinutes: 30,
      );
      expect(filled.filled, isTrue);
      expect(filled.skills, <String>['vocabulary', 'grammar', 'kanji']);

      final invited = _run(<String>{'grammar'}, oldMinutes: 15, newMinutes: 30);
      expect(invited.invite, <String>['vocabulary', 'grammar', 'kanji']);

      // Khi danh sách khả dụng đã có reading/writing thì gợi ý mức 30 có đủ năm kỹ năng.
      final all = _run(
        <String>{},
        newMinutes: 30,
        available: const <String>[
          'vocabulary',
          'grammar',
          'kanji',
          'reading',
          'writing',
        ],
      );
      expect(all.skills, _table[30]);
    });

    test('so với gợi ý phút cũ cũng chỉ xét kỹ năng khả dụng', () {
      // Đang ở đúng gợi ý mức 30 (đã lọc theo khả dụng) rồi hạ xuống 15 ⇒ vẫn là "chưa chỉnh".
      final result = _run(
        <String>{'vocabulary', 'grammar', 'kanji'},
        oldMinutes: 30,
        newMinutes: 10,
      );
      expect(result.filled, isTrue);
      expect(result.skills, <String>['vocabulary', 'grammar']);
    });

    test('lựa chọn đã chỉnh trùng với gợi ý mới ⇒ không cần lời mời', () {
      final result = _run(
        <String>{'vocabulary', 'grammar', 'kanji'},
        oldMinutes: 10,
        newMinutes: 15,
      );
      // Khác gợi ý phút cũ nhưng đã bằng gợi ý mới: giữ nguyên, không mời.
      expect(result.filled, isFalse);
      expect(result.skills, <String>['vocabulary', 'grammar', 'kanji']);
      expect(result.invite, isNull);
    });

    test('không đổi phút ⇒ không làm gì', () {
      final result = _run(
        <String>{'vocabulary'},
        oldMinutes: 10,
        newMinutes: 10,
      );
      expect(result.filled, isFalse);
      expect(result.skills, <String>['vocabulary']);
      expect(result.invite, isNull);
    });

    test('mức phút không có trong bảng ⇒ giữ nguyên', () {
      final result = _run(<String>{'kanji'}, oldMinutes: 10, newMinutes: 7);
      expect(result.filled, isFalse);
      expect(result.skills, <String>['kanji']);
      expect(result.invite, isNull);
    });

    test('không sửa tập đầu vào', () {
      final current = <String>{'vocabulary', 'grammar'};
      _run(current, oldMinutes: 10, newMinutes: 15);
      expect(current, <String>{'vocabulary', 'grammar'});
    });
  });

  group('isPracticeLockedFor', () {
    test('dưới ngưỡng hoặc chưa có phút ⇒ khóa', () {
      expect(isPracticeLockedFor(null, 30), isTrue);
      expect(isPracticeLockedFor(5, 30), isTrue);
      expect(isPracticeLockedFor(15, 30), isTrue);
    });

    test('đạt ngưỡng ⇒ không khóa', () {
      expect(isPracticeLockedFor(30, 30), isFalse);
      expect(isPracticeLockedFor(45, 30), isFalse);
    });
  });
}
