import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/account_repository.dart';
import '../../data/session_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import 'theme.dart';

/// Khung trang desktop: thanh tiêu đề (kèm điều hướng khi đã đăng nhập) và vùng nội dung căn giữa,
/// giới hạn chiều rộng để dễ đọc trên màn hình rộng.
class PageFrame extends ConsumerWidget {
  const PageFrame({
    super.key,
    required this.child,
    this.title,
    this.showNavigation = true,
    this.actions = const <Widget>[],
    this.padding = kPagePadding,
  });

  final Widget child;

  /// Tiêu đề trang; mặc định là tên ứng dụng.
  final String? title;

  /// Hiện các mục điều hướng (chỉ có tác dụng khi đã đăng nhập).
  final bool showNavigation;
  final List<Widget> actions;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionProvider).session;
    final location = GoRouterState.of(context).uri.path;
    // Mục "Tổ chức"/"Lớp học"/"Lớp của tôi" theo vai trò tra từ `GET /me` (bảo vệ thật ở server).
    final roles = session != null && showNavigation
        ? (ref.watch(navRolesProvider).value ?? const NavRoles())
        : const NavRoles();

    final destinations = <_NavDestination>[
      _NavDestination(AppRoutes.today, l10n.navToday),
      _NavDestination(AppRoutes.path, l10n.navPath),
      _NavDestination(AppRoutes.progress, l10n.navProgress),
      if (roles.inClass) _NavDestination(AppRoutes.myClass, l10n.navMyClass),
      _NavDestination(AppRoutes.profile, l10n.navProfile),
      if (roles.managesClasses)
        _NavDestination(AppRoutes.classes, l10n.navClasses),
      if (roles.isOwner) _NavDestination(AppRoutes.org, l10n.navOrg),
      if (session?.isAdmin ?? false)
        _NavDestination(AppRoutes.admin, l10n.navAdmin),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(title ?? l10n.appTitle),
        actions: <Widget>[
          if (showNavigation && session != null)
            for (final d in destinations)
              TextButton(
                onPressed: () => context.go(d.route),
                // Cả hai kiểu đều đặt `textStyle` (cùng `inherit`) để đổi tab giữa lúc hoạt ảnh không lỗi nội suy.
                style: location.startsWith(d.route)
                    ? TextButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.primary,
                        textStyle: const TextStyle(fontWeight: FontWeight.w700),
                      )
                    : TextButton.styleFrom(
                        textStyle: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                child: Text(d.label),
              ),
          ...actions,
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: kContentMaxWidth),
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}

class _NavDestination {
  const _NavDestination(this.route, this.label);

  final String route;
  final String label;
}
