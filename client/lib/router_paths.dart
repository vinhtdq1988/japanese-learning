/// Đường dẫn các route của ứng dụng (tách khỏi `router.dart` để widget dùng chung import được mà
/// không tạo vòng phụ thuộc với router).
abstract final class AppRoutes {
  // Công khai
  static const String landing = '/';
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String trial = '/trial';
  static const String trialLesson = '/trial/lesson';
  static const String trialFinished = '/trial/finished';
  static const String trialPlacement = '/trial/placement';

  /// Giải thích tính năng cần tài khoản: `/trial/account-required?feature=path|today|review|progress`.
  static const String trialAccountRequired = '/trial/account-required';

  // Khởi động (đang đọc token đã lưu)
  static const String splash = '/splash';

  // Tài khoản chờ xóa
  static const String restoreAccount = '/restore-account';

  // Người học
  static const String onboarding = '/onboarding';
  static const String placement = '/placement';
  static const String today = '/today';

  /// Bài học: `/lesson?item=<id mục kế hoạch hoặc id đơn vị học thêm>`.
  static const String lesson = '/lesson';
  static const String path = '/path';

  /// Điều chỉnh kế hoạch (T094): đổi mục tiêu/thời gian, ưu tiên kỹ năng, tạm dừng, xây dựng lại.
  static const String pathAdjust = '/path/adjust';
  static const String progress = '/progress';
  static const String profile = '/profile';

  // Quản trị (chỉ admin; bảo vệ thực sự ở server)
  static const String admin = '/admin';
  static const String adminUnits = '/admin/units';

  /// Soạn đơn vị mới: `/admin/units/new`; sửa: `/admin/units/<id>`.
  static const String adminUnitNew = '/admin/units/new';
  static const String adminPlacement = '/admin/placement';
  static const String adminUsers = '/admin/users';
  static const String adminLogs = '/admin/logs';

  /// Route công khai chính xác; mọi đường dẫn dưới [trial] cũng công khai.
  static const Set<String> publicExact = <String>{
    landing,
    login,
    register,
    forgotPassword,
    resetPassword,
  };

  /// Route chỉ dành cho khách: người đã đăng nhập bị chuyển về [today].
  static const Set<String> guestOnly = <String>{
    login,
    register,
    forgotPassword,
  };

  static bool isPublic(String path) =>
      publicExact.contains(path) || path == trial || path.startsWith('$trial/');

  static bool isAdmin(String path) =>
      path == admin || path.startsWith('$admin/');
}
