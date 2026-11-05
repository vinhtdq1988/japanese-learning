import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'data/session_controller.dart';
import 'presentation/admin/admin_logs_screen.dart';
import 'presentation/admin/admin_placement_screen.dart';
import 'presentation/admin/admin_unit_editor_screen.dart';
import 'presentation/admin/admin_units_screen.dart';
import 'presentation/admin/admin_users_screen.dart';
import 'presentation/auth/forgot_password_screen.dart';
import 'presentation/auth/login_screen.dart';
import 'presentation/auth/register_screen.dart';
import 'presentation/auth/reset_password_screen.dart';
import 'presentation/landing/landing_screen.dart';
import 'presentation/lesson/lesson_screen.dart';
import 'presentation/onboarding/onboarding_screen.dart';
import 'presentation/path/path_screen.dart';
import 'presentation/path/plan_adjust_screen.dart';
import 'presentation/placement/placement_screen.dart';
import 'presentation/profile/profile_screen.dart';
import 'presentation/profile/restore_account_screen.dart';
import 'presentation/progress/progress_screen.dart';
import 'presentation/shared/state_views.dart';
import 'presentation/today/today_screen.dart';
import 'presentation/trial/trial_account_required_screen.dart';
import 'presentation/trial/trial_finished_screen.dart';
import 'presentation/trial/trial_home_screen.dart';
import 'presentation/trial/trial_lesson_screen.dart';
import 'router_paths.dart';

export 'router_paths.dart';

/// Quy tắc chuyển hướng (guard) theo trạng thái đăng nhập và vai trò. Hàm thuần để kiểm thử được.
///
/// - Đang đọc token đã lưu → màn hình khởi động.
/// - Chưa đăng nhập → chỉ vào được route công khai, còn lại về đăng nhập (nhớ nơi định đến).
/// - Tài khoản chờ xóa → chỉ vào được màn hình khôi phục.
/// - Đã đăng nhập mà vào trang dành cho khách → về "Hôm nay".
/// - Người học thường vào `/admin/*` → về "Hôm nay" (ẩn UI; bảo vệ thực sự ở server, FR-004).
///
/// Trả `null` nếu không cần chuyển hướng.
String? resolveRedirect({
  required SessionState session,
  required String location,
}) {
  final path = Uri.parse(location).path;

  if (session.isLoading) {
    return path == AppRoutes.splash ? null : AppRoutes.splash;
  }

  final current = session.session;
  if (path == AppRoutes.splash) {
    if (current == null) return AppRoutes.landing;
    return current.isPendingDeletion
        ? AppRoutes.restoreAccount
        : AppRoutes.today;
  }

  if (current == null) {
    if (AppRoutes.isPublic(path)) return null;
    final from = location == AppRoutes.landing
        ? ''
        : '?from=${Uri.encodeComponent(location)}';
    return '${AppRoutes.login}$from';
  }

  if (current.isPendingDeletion) {
    return path == AppRoutes.restoreAccount ? null : AppRoutes.restoreAccount;
  }
  if (path == AppRoutes.restoreAccount || AppRoutes.guestOnly.contains(path)) {
    return AppRoutes.today;
  }
  if (AppRoutes.isAdmin(path) && !current.isAdmin) return AppRoutes.today;
  return null;
}

/// Cầu nối trạng thái phiên → `GoRouter.refreshListenable` để guard chạy lại khi đăng nhập/đăng xuất.
class _SessionRefresh extends ChangeNotifier {
  void notify() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _SessionRefresh();
  ref.onDispose(refresh.dispose);
  ref.listen<SessionState>(sessionProvider, (_, __) => refresh.notify());

  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: refresh,
    redirect: (BuildContext context, GoRouterState state) => resolveRedirect(
      session: ref.read(sessionProvider),
      location: state.uri.toString(),
    ),
    routes: <RouteBase>[
      GoRoute(
        path: AppRoutes.splash,
        builder: (_, __) => const Scaffold(body: LoadingView()),
      ),
      GoRoute(
        path: AppRoutes.landing,
        builder: (_, __) => const LandingScreen(),
      ),
      GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: AppRoutes.register,
        builder: (_, __) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (_, GoRouterState state) =>
            ResetPasswordScreen(token: state.uri.queryParameters['token']),
      ),
      // Dùng thử không đăng ký (T100): công khai, trạng thái ở trình duyệt.
      GoRoute(
        path: AppRoutes.trial,
        builder: (_, __) => const TrialHomeScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: 'lesson',
            builder: (_, __) => const TrialLessonScreen(),
          ),
          GoRoute(
            path: 'finished',
            builder: (_, __) => const TrialFinishedScreen(),
          ),
          GoRoute(
            path: 'placement',
            builder: (_, __) =>
                const PlacementScreen(origin: PlacementOrigin.trial),
          ),
          GoRoute(
            path: 'account-required',
            builder: (_, GoRouterState state) => TrialAccountRequiredScreen(
              feature: state.uri.queryParameters['feature'],
            ),
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.restoreAccount,
        builder: (_, __) => const RestoreAccountScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (_, __) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.placement,
        builder: (_, GoRouterState state) => PlacementScreen(
          origin: PlacementOrigin.fromQuery(
            state.uri.queryParameters['context'],
          ),
        ),
      ),
      GoRoute(path: AppRoutes.today, builder: (_, __) => const TodayScreen()),
      GoRoute(
        path: AppRoutes.lesson,
        // Thiếu mục cần học (mở thẳng đường dẫn) → về "Hôm nay".
        redirect: (_, GoRouterState state) =>
            (state.uri.queryParameters['item'] ?? '').isEmpty
            ? AppRoutes.today
            : null,
        builder: (_, GoRouterState state) =>
            LessonScreen(planItemId: state.uri.queryParameters['item']!),
      ),
      GoRoute(
        path: AppRoutes.path,
        builder: (_, __) => const PathScreen(),
        routes: <RouteBase>[
          GoRoute(path: 'adjust', builder: (_, __) => const PlanAdjustScreen()),
        ],
      ),
      GoRoute(
        path: AppRoutes.progress,
        builder: (_, __) => const ProgressScreen(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (_, __) => const ProfileScreen(),
      ),
      // Quản trị (T108): chỉ admin (guard ở `resolveRedirect`; bảo vệ thực sự ở server).
      GoRoute(
        path: AppRoutes.admin,
        redirect: (_, GoRouterState state) =>
            state.uri.path == AppRoutes.admin ? AppRoutes.adminUnits : null,
        builder: (_, __) => const AdminUnitsScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: 'units',
            builder: (_, __) => const AdminUnitsScreen(),
            routes: <RouteBase>[
              // `new` đặt trước `:unitId` để không bị coi là một id.
              GoRoute(
                path: 'new',
                builder: (_, __) => const AdminUnitEditorScreen(),
              ),
              GoRoute(
                path: ':unitId',
                builder: (_, GoRouterState state) => AdminUnitEditorScreen(
                  unitId: state.pathParameters['unitId'],
                ),
              ),
            ],
          ),
          GoRoute(
            path: 'placement',
            builder: (_, __) => const AdminPlacementScreen(),
          ),
          GoRoute(path: 'users', builder: (_, __) => const AdminUsersScreen()),
          GoRoute(path: 'logs', builder: (_, __) => const AdminLogsScreen()),
        ],
      ),
    ],
  );
});
