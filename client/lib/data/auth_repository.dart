import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../platform/platform.dart';
import '../platform/platform_providers.dart';
import 'locale_provider.dart';
import 'api_providers.dart';
import 'session_controller.dart';

/// Truy cập xác thực (T052): đăng ký, đăng nhập, đăng xuất, đặt lại mật khẩu. Mọi lỗi API được ném
/// dưới dạng `ApiError` (xem `guardApi`) để màn hình xử lý theo mã lỗi của hợp đồng.
class AuthRepository {
  AuthRepository({
    required JapaneseApi api,
    required SessionController session,
    required Timezone timezone,
    required String Function() languageCode,
  }) : _api = api,
       _session = session,
       _timezone = timezone,
       _languageCode = languageCode;

  final JapaneseApi _api;
  final SessionController _session;
  final Timezone _timezone;
  final String Function() _languageCode;

  /// Đăng ký rồi đăng nhập luôn (không cần xác minh email). Ngôn ngữ và múi giờ lấy từ giao diện/
  /// trình duyệt. [fromTrial] đánh dấu đăng ký ngay sau khi dùng thử (đo chuyển đổi, SC-011).
  Future<void> register({
    required String email,
    required String password,
    required String displayName,
    bool fromTrial = false,
  }) {
    return guardApi(() async {
      final tz = await _timezone.currentIanaName();
      final response = await _api.getAuthApi().register(
        registerRequest: RegisterRequest(
          email: email,
          password: password,
          displayName: displayName,
          language: _languageCode() == 'en' ? Lang.en : Lang.vi,
          timezone: tz,
          fromTrial: fromTrial,
        ),
      );
      final tokens = response.data!;
      await _session.signIn(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
    });
  }

  /// Đăng nhập. Tài khoản đang chờ xóa vẫn nhận token; router đưa họ tới màn hình khôi phục.
  Future<void> login({required String email, required String password}) {
    return guardApi(() async {
      final response = await _api.getAuthApi().login(
        loginRequest: LoginRequest(email: email, password: password),
      );
      final tokens = response.data!;
      await _session.signIn(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
    });
  }

  /// Gửi liên kết đặt lại mật khẩu; server luôn trả 202 dù email có tồn tại hay không.
  Future<void> requestPasswordReset(String email) {
    return guardApi(() async {
      await _api.getAuthApi().requestPasswordReset(
        requestPasswordResetRequest: RequestPasswordResetRequest(email: email),
      );
    });
  }

  /// Đặt mật khẩu mới bằng token trong liên kết (dùng một lần, hết hạn sau 1 giờ).
  Future<void> confirmPasswordReset({
    required String token,
    required String newPassword,
  }) {
    return guardApi(() async {
      await _api.getAuthApi().confirmPasswordReset(
        confirmPasswordResetRequest: ConfirmPasswordResetRequest(
          token: token,
          newPassword: newPassword,
        ),
      );
    });
  }

  /// Đăng xuất: thu hồi phiên ở server (best-effort) rồi xóa token cục bộ dù server có phản hồi hay không.
  Future<void> signOut() async {
    try {
      await _api.getAuthApi().logout();
    } catch (_) {
      // Mất mạng hoặc token đã hết hạn: vẫn đăng xuất cục bộ.
    }
    await _session.signOut();
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    api: ref.watch(japaneseApiProvider),
    session: ref.read(sessionProvider.notifier),
    timezone: ref.watch(timezoneProvider),
    languageCode: () => ref.read(localeProvider).languageCode,
  );
});
