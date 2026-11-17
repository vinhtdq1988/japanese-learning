import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

// tests for ProgressSummaryCompetency
void main() {
  final ProgressSummaryCompetency? instance = /* ProgressSummaryCompetency(...) */ null;
  // TODO add properties to the entity

  group(ProgressSummaryCompetency, () {
    // Mỗi kỹ năng hiệu lực của người học (và kỹ năng đã có dữ liệu), theo thứ tự vocabulary, grammar, kanji, reading, writing
    // List<ProgressSummaryCompetencySkillsInner> skills
    test('to test the property `skills`', () async {
      // TODO
    });

    // Mọi chủ đề có dữ liệu; luôn gồm các chủ đề trong `weakTopics`
    // List<ProgressSummaryCompetencyTopicsInner> topics
    test('to test the property `topics`', () async {
      // TODO
    });

  });
}
