import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for OrgApi
void main() {
  final instance = JapaneseApi().getOrgApi();

  group(OrgApi, () {
    // Tổng quan tổ chức - seat, giấy phép, giáo viên, lớp, lời mời chờ
    //
    //Future<OrgOverview> getOrg() async
    test('test getOrg', () async {
      // TODO
    });

    // Cấp lại seat cho giáo viên đang mất seat
    //
    //Future grantSeat(String userId) async
    test('test grantSeat', () async {
      // TODO
    });

    // Mời giáo viên (giữ chỗ một seat)
    //
    //Future<InvitationRow> inviteTeacher(RequestPasswordResetRequest requestPasswordResetRequest) async
    test('test inviteTeacher', () async {
      // TODO
    });

    // Gỡ vai trò giáo viên - mất quyền ngay, giải phóng seat
    //
    //Future removeTeacher(String userId) async
    test('test removeTeacher', () async {
      // TODO
    });

    // Thu hồi lời mời (OWN - mọi lời mời của tổ chức; TCH - lời mời học viên của lớp mình)
    //
    //Future revokeInvitation(String token) async
    test('test revokeInvitation', () async {
      // TODO
    });

    // Thu hồi seat của giáo viên/học viên trong tổ chức mình
    //
    //Future revokeOrgSeat(String userId) async
    test('test revokeOrgSeat', () async {
      // TODO
    });
  });
}
