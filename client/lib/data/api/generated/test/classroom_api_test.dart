import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for ClassroomApi
void main() {
  final instance = JapaneseApi().getClassroomApi();

  group(ClassroomApi, () {
    // Xem trước lời mời (kèm danh sách dữ liệu chia sẻ khi mời học viên)
    //
    // Người gọi PHẢI có email trùng email lời mời. Token sai/hết hạn/đã dùng/email không khớp → 404 chung (không lộ lời mời).
    //
    //Future<InvitationPreview> getInvitation(String token) async
    test('test getInvitation', () async {
      // TODO
    });

    // Lớp của tôi (lộ trình lớp, bài giao, tiến độ trong lớp, dữ liệu chia sẻ)
    //
    //Future<MyClass> getMyClass() async
    test('test getMyClass', () async {
      // TODO
    });

    // Nhập mã tham gia lớp (hai bước không trạng thái - xem trước rồi xác nhận)
    //
    // Không `decision` → 200 xem trước `{class, disclosure}`. `decision=join_class` + `confirmed:true` → tham gia. `decision=stay_personal` → 204, không đổi gì. Sai mã/đã tắt/hết hạn/lớp lưu trữ/lớp chưa lộ trình → cùng một 404 chung; sai liên tiếp → 429 (khóa theo tài khoản).
    //
    //Future<JoinByCodeResult> joinClassByCode(JoinByCode joinByCode) async
    test('test joinClassByCode', () async {
      // TODO
    });

    // Chuyển sang lộ trình cá nhân (rời lớp bất cứ lúc nào)
    //
    //Future leaveMyClass(LeaveMyClassRequest leaveMyClassRequest) async
    test('test leaveMyClass', () async {
      // TODO
    });

    // Trả lời lời mời (học viên - hai lựa chọn ngang nhau; giáo viên/chủ tổ chức - chấp nhận/từ chối)
    //
    // Học viên `join_class` PHẢI kèm `confirmed:true`; `stay_personal` đóng lời mời, không tốn seat, không đổi hồ sơ. Mất seat khi chấp nhận: 409 `SEAT_UNAVAILABLE`/422 `SEAT_REASSIGN_LIMIT`, lời mời giữ `pending`.
    //
    //Future<InvitationRespondResult> respondInvitation(String token, InvitationRespond invitationRespond) async
    test('test respondInvitation', () async {
      // TODO
    });
  });
}
