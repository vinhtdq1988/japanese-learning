import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

// tests for AchievementEarned
void main() {
  final AchievementEarned? instance = /* AchievementEarned(...) */ null;
  // TODO add properties to the entity

  group(AchievementEarned, () {
    // Mã ổn định trong danh mục cố định (xem specs/005-reward-feedback-effects/contracts/achievement-catalog.md), ví dụ `streak_7`, `items_100`, `goal_50`, `first_lesson`, `perfect_lesson`.
    // String code
    test('to test the property `code`', () async {
      // TODO
    });

    // AchievementKind kind
    test('to test the property `kind`', () async {
      // TODO
    });

    // Ngưỡng của mốc (ngày, số mục hoặc phần trăm). Vắng với `first_lesson` và `perfect_lesson`.
    // int threshold
    test('to test the property `threshold`', () async {
      // TODO
    });

    // Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
    // String name
    test('to test the property `name`', () async {
      // TODO
    });

    // Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
    // String description
    test('to test the property `description`', () async {
      // TODO
    });

  });
}
