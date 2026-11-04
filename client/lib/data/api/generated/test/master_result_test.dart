import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

// tests for MasterResult
void main() {
  final MasterResult? instance = /* MasterResult(...) */ null;
  // TODO add properties to the entity

  group(MasterResult, () {
    // Số đơn vị chưa thành thạo còn lại trong khoảng trình độ của lộ trình hiện tại
    // int remainingUnits
    test('to test the property `remainingUnits`', () async {
      // TODO
    });

    // Chỉ có khi remainingUnits = 0. raise_level: còn nội dung ở trình độ cao hơn (≤ N3) – client mời nâng trình độ (PATCH /me currentLevel → level_change) hoặc làm lại placement; content_exhausted: đã ở trần N3 – dùng chung mã với thông báo hết nội dung
    // String suggestion
    test('to test the property `suggestion`', () async {
      // TODO
    });
  });
}
