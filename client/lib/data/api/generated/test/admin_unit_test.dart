import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

// tests for AdminUnit
void main() {
  final AdminUnit? instance = /* AdminUnit(...) */ null;
  // TODO add properties to the entity

  group(AdminUnit, () {
    // Skill kind
    test('to test the property `kind`', () async {
      // TODO
    });

    // I18nText title
    test('to test the property `title`', () async {
      // TODO
    });

    // ContentLevel level
    test('to test the property `level`', () async {
      // TODO
    });

    // List<GoalType> goalTags
    test('to test the property `goalTags`', () async {
      // TODO
    });

    // String topicId
    test('to test the property `topicId`', () async {
      // TODO
    });

    // int difficulty
    test('to test the property `difficulty`', () async {
      // TODO
    });

    // `foundation` = nền tảng người mới, chỉ hợp lệ với level N5
    // String tier (default value: 'core')
    test('to test the property `tier`', () async {
      // TODO
    });

    // int estMinutes
    test('to test the property `estMinutes`', () async {
      // TODO
    });

    // int sequence
    test('to test the property `sequence`', () async {
      // TODO
    });

    // Khi sửa: phần tử có `id` được cập nhật, phần tử không có `id` được tạo mới; mục hiện có vắng mặt trong payload bị chuyển `inactive`, KHÔNG xóa cứng (giữ `study_records`/`review_schedules` – data-model §2.9).
    // List<AdminUnitWriteItemsInner> items
    test('to test the property `items`', () async {
      // TODO
    });

    // Cùng quy tắc với `items` – bài tập vắng mặt trong payload sửa bị chuyển `inactive`, không xóa cứng.
    // List<AdminUnitWriteExercisesInner> exercises
    test('to test the property `exercises`', () async {
      // TODO
    });

    // String id
    test('to test the property `id`', () async {
      // TODO
    });

    // String status
    test('to test the property `status`', () async {
      // TODO
    });

    // bool isTrial
    test('to test the property `isTrial`', () async {
      // TODO
    });

    // DateTime updatedAt
    test('to test the property `updatedAt`', () async {
      // TODO
    });
  });
}
