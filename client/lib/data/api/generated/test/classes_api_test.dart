import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for ClassesApi
void main() {
  final instance = JapaneseApi().getClassesApi();

  group(ClassesApi, () {
    // Lưu trữ lớp (một chiều) - đóng mọi thành viên, vô hiệu mã và lời mời chờ
    //
    //Future<ArchiveClass200Response> archiveClass(String id, LeaveMyClassRequest leaveMyClassRequest) async
    test('test archiveClass', () async {
      // TODO
    });

    // Hủy bài giao
    //
    //Future cancelClassAssignment(String id, String assignmentId) async
    test('test cancelClassAssignment', () async {
      // TODO
    });

    // Đóng yêu cầu kiểm tra trình độ
    //
    //Future closeClassPlacementRequest(String id) async
    test('test closeClassPlacementRequest', () async {
      // TODO
    });

    // Tạo lớp (giáo viên tự là phụ trách; `teacherIds` chỉ chủ tổ chức)
    //
    //Future<ClassDetail> createClass(CreateClassRequest createClassRequest) async
    test('test createClass', () async {
      // TODO
    });

    // Giao bài (1-20 đơn vị, một hạn)
    //
    //Future<CreateClassAssignments201Response> createClassAssignments(String id, CreateClassAssignmentsRequest createClassAssignmentsRequest) async
    test('test createClassAssignments', () async {
      // TODO
    });

    // Tạm dừng cả lớp (vắng `userId`) hoặc một học viên
    //
    //Future<ClassPause> createClassPause(String id, CreateClassPauseRequest createClassPauseRequest) async
    test('test createClassPause', () async {
      // TODO
    });

    // Yêu cầu cả lớp làm bài kiểm tra trình độ
    //
    //Future<ClassPlacementRequest> createClassPlacementRequest(String id) async
    test('test createClassPlacementRequest', () async {
      // TODO
    });

    // Kết thúc khoảng tạm dừng (mặc định hôm nay)
    //
    //Future<ClassPause> endClassPause(String id, String pauseId, { EndClassPauseRequest endClassPauseRequest }) async
    test('test endClassPause', () async {
      // TODO
    });

    // Miễn một đơn vị cho học viên
    //
    //Future exemptLearnerUnit(String id, String userId, String unitId) async
    test('test exemptLearnerUnit', () async {
      // TODO
    });

    // Xuất báo cáo lớp (CSV có BOM, chống công thức; ghi nhật ký `class.export`)
    //
    //Future<String> exportClassCsv(String id) async
    test('test exportClassCsv', () async {
      // TODO
    });

    // Xuất CSV chi tiết một học viên
    //
    //Future<String> exportClassLearnerCsv(String id, String userId) async
    test('test exportClassLearnerCsv', () async {
      // TODO
    });

    // Chi tiết cấu trúc lớp (không có dữ liệu học); lớp lưu trữ vẫn xem được
    //
    //Future<ClassDetail> getClass(String id) async
    test('test getClass', () async {
      // TODO
    });

    // Bảng điều khiển lớp (số liệu kể từ ngày vào lớp của từng học viên)
    //
    //Future<ClassDashboard> getClassDashboard(String id, { String sort, String order, String filter }) async
    test('test getClassDashboard', () async {
      // TODO
    });

    // Chi tiết một học viên - KHÔNG có từng câu trả lời
    //
    //Future<ClassLearnerDetail> getClassLearnerDetail(String id, String userId) async
    test('test getClassLearnerDetail', () async {
      // TODO
    });

    // Lộ trình lớp (`path` là null khi chưa đặt)
    //
    //Future<GetClassPath200Response> getClassPath(String id) async
    test('test getClassPath', () async {
      // TODO
    });

    // Kết quả kiểm tra trình độ của lớp (không tự đổi lộ trình lớp)
    //
    //Future<ClassPlacementResults> getClassPlacementRequest(String id) async
    test('test getClassPlacementRequest', () async {
      // TODO
    });

    // Danh sách học viên theo trạng thái (đã vào, chờ, từ chối, tự chuyển cá nhân, bị gỡ)
    //
    //Future<List<RosterRow>> getClassRoster(String id) async
    test('test getClassRoster', () async {
      // TODO
    });

    // Điểm yếu chung của lớp (mức yếu giảm dần)
    //
    //Future<List<ClassWeakTopic>> getClassWeakTopics(String id) async
    test('test getClassWeakTopics', () async {
      // TODO
    });

    // Xem mã tham gia (chỉ người quản lý lớp)
    //
    //Future<JoinCode> getJoinCode(String id) async
    test('test getJoinCode', () async {
      // TODO
    });

    // Nhập danh sách học viên từ CSV - đúng một kết quả cho mỗi dòng dữ liệu
    //
    // Thân là nội dung file CSV (`text/csv; charset=utf-8`), ≤ `CSV_IMPORT_MAX_ROWS` dòng và `CSV_IMPORT_MAX_BYTES` byte; sai định dạng/quá cỡ → 422 toàn file. Định dạng: `contracts/csv-formats.md` của spec 004.
    //
    //Future<ImportResults> importClassLearnersCsv(String id, String body) async
    test('test importClassLearnersCsv', () async {
      // TODO
    });

    // Mời học viên bằng email (≤ 50 mỗi lần) - mỗi lời mời giữ chỗ một seat
    //
    //Future<ImportResults> inviteClassLearners(String id, InviteClassLearnersRequest inviteClassLearnersRequest) async
    test('test inviteClassLearners', () async {
      // TODO
    });

    // Các khoảng tạm dừng (cả lớp và từng học viên)
    //
    //Future<List<ClassPause>> listClassPauses(String id) async
    test('test listClassPauses', () async {
      // TODO
    });

    // Danh sách lớp (giáo viên - lớp mình phụ trách; chủ tổ chức - mọi lớp)
    //
    //Future<List<ClassRow>> listClasses() async
    test('test listClasses', () async {
      // TODO
    });

    // Chuyển học viên sang lớp khác trong cùng tổ chức (giữ seat, tiến độ, lịch ôn)
    //
    //Future moveClassMember(String id, String userId, MoveClassMemberRequest moveClassMemberRequest) async
    test('test moveClassMember', () async {
      // TODO
    });

    // Tạo/sửa lộ trình lớp theo mẫu (không có thao tác xóa)
    //
    // Có hiệu lực từ kế hoạch được sinh kế tiếp; tiến độ và lịch ôn giữ nguyên. Lưu trọn vẹn hoặc không đổi; cảnh báo khả thi không chặn lưu.
    //
    //Future<ClassPath> putClassPath(String id, ClassPathTemplate classPathTemplate) async
    test('test putClassPath', () async {
      // TODO
    });

    // Chọn bài, thứ tự và ngày mở (`units` rỗng quay lại chế độ mẫu)
    //
    //Future<ClassPath> putClassPathUnits(String id, PutClassPathUnitsRequest putClassPathUnitsRequest) async
    test('test putClassPathUnits', () async {
      // TODO
    });

    // Ghi đè riêng một học viên (phút mỗi ngày, dời mốc)
    //
    //Future<LearnerOverride> putLearnerOverride(String id, String userId, PutLearnerOverrideRequest putLearnerOverrideRequest) async
    test('test putLearnerOverride', () async {
      // TODO
    });

    // Gỡ học viên khỏi lớp, giải phóng seat
    //
    //Future removeClassMember(String id, String userId) async
    test('test removeClassMember', () async {
      // TODO
    });

    // Đổi mã tham gia (mã cũ vô hiệu ngay)
    //
    //Future<JoinCode> rotateJoinCode(String id) async
    test('test rotateJoinCode', () async {
      // TODO
    });

    // Đặt danh sách giáo viên phụ trách (chủ tổ chức; luôn ≥ 1)
    //
    //Future<ClassDetail> setClassTeachers(String id, SetClassTeachersRequest setClassTeachersRequest) async
    test('test setClassTeachers', () async {
      // TODO
    });

    // Bật/tắt mã tham gia (bật lần đầu sinh mã), đặt hạn tùy chọn
    //
    //Future<JoinCode> setJoinCode(String id, SetJoinCodeRequest setJoinCodeRequest) async
    test('test setJoinCode', () async {
      // TODO
    });

    // Bỏ miễn đơn vị cho học viên
    //
    //Future unexemptLearnerUnit(String id, String userId, String unitId) async
    test('test unexemptLearnerUnit', () async {
      // TODO
    });

    // Sửa tên, mô tả, ngưỡng vắng mặt
    //
    //Future<ClassDetail> updateClass(String id, UpdateClassRequest updateClassRequest) async
    test('test updateClass', () async {
      // TODO
    });
  });
}
