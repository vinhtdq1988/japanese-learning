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

  /// Tổ chức, giấy phép và seat (quản trị viên hệ thống, spec 004).
  static const String adminOrganizations = '/admin/organizations';

  // Tổ chức (spec 004): chủ tổ chức và người nhận lời mời. Bảo vệ thực sự ở server (vai trò tra CSDL).
  static const String org = '/org';

  /// Lớp học của giáo viên/chủ tổ chức (spec 004, US2): danh sách `/classes`, chi tiết `/classes/<id>`,
  /// lộ trình lớp `/classes/<id>/path` (US3), bảng điều khiển `/classes/<id>/dashboard` và chi tiết học viên
  /// `/classes/<id>/learners/<userId>` (US4). Quyền thật do server kiểm (404 chung cho lớp ngoài phạm vi).
  static const String classes = '/classes';

  /// "Lớp của tôi" của học viên thuộc lớp, và nhập mã tham gia lớp.
  static const String myClass = '/my-class';
  static const String join = '/join';

  /// Nhận lời mời: `/invite/<token>`. Phải vào được ngay sau đăng nhập/đăng ký, không đi qua onboarding cá nhân.
  static const String invite = '/invite';

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

  /// Đích quay lại sau đăng nhập/đăng ký (`?from=`): chỉ nhận đường dẫn nội bộ tuyệt đối, loại `//host`,
  /// đường dẫn có lược đồ và các route dành cho khách/khởi động để không tạo vòng chuyển hướng.
  static String? safeReturnPath(String? from) {
    if (from == null || from.isEmpty) return null;
    if (!from.startsWith('/') || from.startsWith('//') || from.contains(r'\')) {
      return null;
    }
    final path = Uri.tryParse(from)?.path;
    if (path == null || guestOnly.contains(path) || path == splash) return null;
    return from;
  }

  /// Giữ đích quay lại khi chuyển giữa đăng nhập và đăng ký: `/register?from=…`.
  static String withFrom(String route, String? from) =>
      safeReturnPath(from) == null
      ? route
      : '$route?from=${Uri.encodeComponent(from!)}';

  static bool isAdmin(String path) =>
      path == admin || path.startsWith('$admin/');
}
