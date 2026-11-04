import 'package:test/test.dart';
import 'package:japanese_api/japanese_api.dart';

/// tests for AuthApi
void main() {
  final instance = JapaneseApi().getAuthApi();

  group(AuthApi, () {
    // Đặt mật khẩu mới bằng token một lần
    //
    //Future confirmPasswordReset(ConfirmPasswordResetRequest confirmPasswordResetRequest) async
    test('test confirmPasswordReset', () async {
      // TODO
    });

    // Đăng nhập
    //
    //Future<Login200Response> login(LoginRequest loginRequest) async
    test('test login', () async {
      // TODO
    });

    // Đăng xuất (thu hồi phiên hiện tại)
    //
    //Future logout() async
    test('test logout', () async {
      // TODO
    });

    // Làm mới access token (xoay vòng refresh token)
    //
    //Future<AuthTokens> refreshToken(RefreshTokenRequest refreshTokenRequest) async
    test('test refreshToken', () async {
      // TODO
    });

    // Đăng ký (FR-001) – không yêu cầu xác minh email
    //
    //Future<AuthTokens> register(RegisterRequest registerRequest) async
    test('test register', () async {
      // TODO
    });

    // Yêu cầu liên kết đặt lại mật khẩu (FR-001)
    //
    // Luôn trả 202 dù email có tồn tại hay không (chống dò tài khoản).
    //
    //Future requestPasswordReset(RequestPasswordResetRequest requestPasswordResetRequest) async
    test('test requestPasswordReset', () async {
      // TODO
    });
  });
}
