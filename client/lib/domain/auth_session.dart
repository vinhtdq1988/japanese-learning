import 'dart:convert';

// Phiên đăng nhập ở phía client: chỉ đọc vai trò/trạng thái từ access token để điều khiển ĐIỀU HƯỚNG
// và ẨN/HIỆN giao diện. Bảo vệ thực sự luôn ở server (FR-004); client KHÔNG xác minh chữ ký token.

enum UserRole { learner, admin }

enum AccountStatus { active, disabled, pendingDeletion }

class AuthSession {
  const AuthSession({
    required this.userId,
    required this.role,
    required this.status,
    this.expiresAt,
  });

  final String userId;
  final UserRole role;
  final AccountStatus status;

  /// Thời điểm access token hết hạn (null nếu token không có `exp`).
  final DateTime? expiresAt;

  bool get isAdmin => role == UserRole.admin;
  bool get isPendingDeletion => status == AccountStatus.pendingDeletion;

  /// Đọc phiên từ payload của access token JWT; `null` nếu token sai định dạng.
  static AuthSession? fromAccessToken(String token) {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final payload = utf8.decode(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final claims = jsonDecode(payload);
      if (claims is! Map<String, dynamic>) return null;
      final sub = claims['sub'];
      if (sub is! String || sub.isEmpty) return null;
      final exp = claims['exp'];
      return AuthSession(
        userId: sub,
        role: claims['role'] == 'admin' ? UserRole.admin : UserRole.learner,
        status: _statusFrom(claims['status']),
        expiresAt: exp is int
            ? DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true)
            : null,
      );
    } on FormatException {
      return null;
    }
  }

  static AccountStatus _statusFrom(Object? value) => switch (value) {
    'disabled' => AccountStatus.disabled,
    'pending_deletion' => AccountStatus.pendingDeletion,
    _ => AccountStatus.active,
  };
}
