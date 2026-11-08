import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/language_sync.dart';
import 'data/locale_provider.dart';
import 'l10n/app_localizations.dart';
import 'presentation/effects/celebration_host.dart';
import 'presentation/shared/theme.dart';
import 'router.dart';

/// Widget gốc của ứng dụng. Tách khỏi `main.dart` (nơi nối triển khai nền tảng web) để kiểm thử
/// dựng được toàn bộ ứng dụng với triển khai nền tảng giả mà không phải biên dịch mã chỉ chạy trên web.
class JapaneseLearningApp extends ConsumerWidget {
  const JapaneseLearningApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Giữ ngôn ngữ giao diện khớp ngôn ngữ đã lưu trong hồ sơ khi đăng nhập/mở lại ứng dụng.
    ref.watch(languageSyncProvider);
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      onGenerateTitle: (BuildContext context) =>
          AppLocalizations.of(context).appTitle,
      theme: buildAppTheme(),
      darkTheme: buildAppTheme(brightness: Brightness.dark),
      routerConfig: router,
      // Màn chúc mừng (spec 005) nằm trên Navigator để sống qua điều hướng "Tiếp tục" và không chặn thao tác.
      builder: (context, child) => CelebrationHost(
        routeChanges: router.routerDelegate,
        currentLocation: () =>
            router.routerDelegate.currentConfiguration.uri.toString(),
        child: child ?? const SizedBox.shrink(),
      ),
      locale: ref.watch(localeProvider),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
