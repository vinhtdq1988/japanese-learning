import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../platform/platform.dart';
import '../platform/platform_providers.dart';
import 'api_providers.dart';
import 'session_controller.dart';

/// Truy cập tài khoản và hồ sơ của chính người học (T113, FR-002, FR-003): sửa tên/ngôn ngữ, đổi email
/// (cần mật khẩu hiện tại), đổi mật khẩu, xóa và khôi phục tài khoản. Lỗi API ném dưới dạng `ApiError`.
class AccountRepository {
  AccountRepository({
    required JapaneseApi api,
    required Dio dio,
    required SessionController session,
    required TokenStore tokenStore,
  }) : _api = api,
       _dio = dio,
       _session = session,
       _tokenStore = tokenStore;

  final JapaneseApi _api;
  final Dio _dio;
  final SessionController _session;
  final TokenStore _tokenStore;

  Future<Me> me() {
    return guardApi(() async => (await _api.getAccountApi().getMe()).data!);
  }

  /// Sửa phần hồ sơ không ảnh hưởng lộ trình. Gửi JSON thủ công để chỉ gửi đúng các trường được đặt
  /// (mô hình sinh ra từ OpenAPI mã hóa enum `language` theo kiểu riêng, xem `ProfileChange`).
  Future<Me> updateProfile({
    String? displayName,
    String? language,
    String? timezone,
  }) {
    return _patch(<String, Object?>{
      'displayName': ?displayName,
      'language': ?language,
      'timezone': ?timezone,
    });
  }

  /// Đổi email: bắt buộc kèm mật khẩu hiện tại. 401 nếu mật khẩu sai; 409 `EMAIL_TAKEN` /
  /// `EMAIL_PENDING_DELETION` nếu email đã thuộc tài khoản khác.
  Future<Me> changeEmail({
    required String email,
    required String currentPassword,
  }) {
    return _patch(<String, Object?>{
      'email': email,
      'currentPassword': currentPassword,
    });
  }

  Future<Me> _patch(Map<String, Object?> body) {
    return guardApi(() async {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/me',
        data: body,
      );
      return Me.fromJson(response.data!);
    });
  }

  /// Đổi mật khẩu; server thu hồi mọi phiên khác và giữ phiên hiện tại.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) {
    return guardApi(() async {
      await _api.getAccountApi().changePassword(
        changePasswordRequest: ChangePasswordRequest(
          currentPassword: currentPassword,
          newPassword: newPassword,
        ),
      );
    });
  }

  /// Xóa tài khoản (chờ 30 ngày). Server thu hồi mọi phiên kể cả phiên hiện tại, nên token cục bộ bị
  /// xóa ngay và router đưa người dùng ra khỏi khu vực đăng nhập. Trả thời điểm xóa vĩnh viễn.
  Future<DateTime?> deleteAccount(String password) {
    return guardApi(() async {
      final response = await _api.getAccountApi().deleteAccount(
        deleteAccountRequest: DeleteAccountRequest(password: password),
      );
      await _session.signOut();
      return response.data?.permanentDeletionAt;
    });
  }

  /// Khôi phục tài khoản đang chờ xóa (410 `ACCOUNT_DELETED` nếu quá 30 ngày). Access token hiện tại
  /// vẫn mang trạng thái `pending_deletion` nên phải làm mới token rồi mới vào lại ứng dụng.
  Future<void> restoreAccount() {
    return guardApi(() async {
      await _api.getAccountApi().restoreAccount();
      final current = await _tokenStore.read();
      if (current == null) return;
      final refreshed = (await _api.getAuthApi().refreshToken(
        refreshTokenRequest: RefreshTokenRequest(
          refreshToken: current.refreshToken,
        ),
      )).data!;
      await _session.signIn(
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      );
    });
  }
}

final accountRepositoryProvider = Provider<AccountRepository>((ref) {
  return AccountRepository(
    api: ref.watch(japaneseApiProvider),
    dio: ref.watch(dioProvider),
    session: ref.read(sessionProvider.notifier),
    tokenStore: ref.watch(tokenStoreProvider),
  );
});

/// Tài khoản + hồ sơ hiện tại; tự hủy khi rời màn hình.
final meProvider = FutureProvider.autoDispose<Me>((ref) {
  return ref.watch(accountRepositoryProvider).me();
});

/// Vai trò quyết định các mục điều hướng tổ chức/lớp (spec 004): chủ tổ chức thấy "Tổ chức" và "Lớp học",
/// giáo viên thấy "Lớp học", học viên thuộc lớp thấy "Lớp của tôi".
class NavRoles {
  const NavRoles({
    this.isOwner = false,
    this.isTeacher = false,
    this.inClass = false,
  });

  final bool isOwner;
  final bool isTeacher;
  final bool inClass;

  bool get managesClasses => isOwner || isTeacher;
}

/// Vai trò điều hướng của tài khoản, từ MỘT lần gọi `GET /me`. Lỗi bất kỳ (mất mạng, 401…) coi là không có
/// vai trò: bảo vệ thực sự ở server nên ẩn nhầm chỉ làm mất lối tắt.
final navRolesProvider = FutureProvider.autoDispose<NavRoles>((ref) async {
  try {
    final me = await ref.watch(accountRepositoryProvider).me();
    final roles = me.organization?.roles ?? const <MeOrganizationRolesEnum>[];
    return NavRoles(
      isOwner: roles.contains(MeOrganizationRolesEnum.owner),
      isTeacher: roles.contains(MeOrganizationRolesEnum.teacher),
      inClass: me.learningSource == MeLearningSourceEnum.class_,
    );
  } on Object {
    return const NavRoles();
  }
});
