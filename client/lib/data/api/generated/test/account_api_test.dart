import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for AccountApi
void main() {
  final instance = JapaneseApi().getAccountApi();

  group(AccountApi, () {
    // Đổi mật khẩu
    //
    // Yêu cầu `currentPassword` đúng. Đổi thành công thu hồi mọi `auth_sessions` khác của người dùng, chỉ giữ phiên hiện tại.
    //
    //Future changePassword(ChangePasswordRequest changePasswordRequest) async
    test('test changePassword', () async {
      // TODO
    });

    // Xóa tài khoản – vô hiệu hóa ngay, xóa vĩnh viễn sau 30 ngày (FR-003)
    //
    //Future<DeleteAccount200Response> deleteAccount(DeleteAccountRequest deleteAccountRequest) async
    test('test deleteAccount', () async {
      // TODO
    });

    // Thông tin tài khoản + hồ sơ học tập
    //
    //Future<Me> getMe() async
    test('test getMe', () async {
      // TODO
    });

    // Khôi phục tài khoản trong 30 ngày chờ xóa
    //
    //Future<Me> restoreAccount() async
    test('test restoreAccount', () async {
      // TODO
    });

    // Sửa hồ sơ (FR-002)
    //
    //Future<Me> updateMe(ProfileUpdate profileUpdate) async
    test('test updateMe', () async {
      // TODO
    });
  });
}
