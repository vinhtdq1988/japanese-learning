import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

// tests for KanjiDetails
void main() {
  final KanjiDetails? instance = /* KanjiDetails(...) */ null;
  // TODO add properties to the entity

  group(KanjiDetails, () {
    // Âm On (katakana); có thể rỗng
    // List<String> onReadings
    test('to test the property `onReadings`', () async {
      // TODO
    });

    // Âm Kun (hiragana, `.` phân cách okurigana); có thể rỗng. onReadings ∪ kunReadings không rỗng
    // List<String> kunReadings
    test('to test the property `kunReadings`', () async {
      // TODO
    });

    // int strokeCount
    test('to test the property `strokeCount`', () async {
      // TODO
    });

    // Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
    // String components
    test('to test the property `components`', () async {
      // TODO
    });
  });
}
