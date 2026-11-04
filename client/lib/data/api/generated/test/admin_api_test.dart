import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for AdminApi
void main() {
  final instance = JapaneseApi().getAdminApi();

  group(AdminApi, () {
    // Tạo câu hỏi kiểm tra trình độ
    //
    //Future<AdminPlacementQuestion> adminCreatePlacementQuestion(AdminPlacementQuestion adminPlacementQuestion) async
    test('test adminCreatePlacementQuestion', () async {
      // TODO
    });

    // Tạo đơn vị học (kèm mục nội dung và bài tập) – FR-030
    //
    //Future<AdminUnit> adminCreateUnit(AdminUnitWrite adminUnitWrite) async
    test('test adminCreateUnit', () async {
      // TODO
    });

    // Chi tiết đơn vị học
    //
    //Future<AdminUnit> adminGetUnit(String unitId) async
    test('test adminGetUnit', () async {
      // TODO
    });

    // Nhật ký hành động quản trị (FR-032)
    //
    //Future<List<AdminActionLog>> adminListActionLogs({ String cursor }) async
    test('test adminListActionLogs', () async {
      // TODO
    });

    // Danh sách câu hỏi kiểm tra trình độ
    //
    //Future<List<AdminPlacementQuestion>> adminListPlacementQuestions() async
    test('test adminListPlacementQuestions', () async {
      // TODO
    });

    // Danh sách đơn vị học (lọc theo trạng thái, trình độ, loại)
    //
    //Future<List<AdminUnit>> adminListUnits({ String status, String level, String kind }) async
    test('test adminListUnits', () async {
      // TODO
    });

    // Tìm tài khoản người học (FR-031)
    //
    //Future<AdminUserPage> adminListUsers({ String q, String cursor }) async
    test('test adminListUsers', () async {
      // TODO
    });

    // Kích hoạt nguyên tử một bộ câu hỏi (thay thế bộ hiện hành) – PHẢI đúng 20 câu (8 N5, 6 N4, 6 N3) (FR-007, FR-030)
    //
    //Future adminSetActivePlacementSet(AdminSetActivePlacementSetRequest adminSetActivePlacementSetRequest) async
    test('test adminSetActivePlacementSet', () async {
      // TODO
    });

    // Kích hoạt / vô hiệu hóa; đánh dấu thuộc tập dùng thử (FR-037)
    //
    //Future<AdminUnit> adminSetUnitStatus(String unitId, AdminSetUnitStatusRequest adminSetUnitStatusRequest) async
    test('test adminSetUnitStatus', () async {
      // TODO
    });

    // Vô hiệu hóa / kích hoạt lại tài khoản
    //
    //Future adminSetUserStatus(String userId, AdminSetUserStatusRequest adminSetUserStatusRequest) async
    test('test adminSetUserStatus', () async {
      // TODO
    });

    // Sửa câu hỏi kiểm tra trình độ (nội dung, lựa chọn, đáp án, position) – ghi nhật ký quản trị (FR-030, FR-032)
    //
    //Future<AdminPlacementQuestion> adminUpdatePlacementQuestion(String questionId, AdminPlacementQuestion adminPlacementQuestion) async
    test('test adminUpdatePlacementQuestion', () async {
      // TODO
    });

    // Sửa đơn vị học (có hiệu lực với phiên mới; phiên đang học giữ nguyên ảnh chụp)
    //
    //Future<AdminUnit> adminUpdateUnit(String unitId, AdminUnitWrite adminUnitWrite) async
    test('test adminUpdateUnit', () async {
      // TODO
    });
  });
}
