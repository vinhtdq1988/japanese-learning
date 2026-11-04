import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';

/// Trang đầu cho khách: giới thiệu ngắn, lối vào dùng thử không cần đăng ký (T100) và đăng nhập/đăng ký.
/// Từ đây tới bài mẫu chỉ mất 2 lần nhấp: "Dùng thử" → "Bắt đầu bài mẫu".
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return PageFrame(
      title: l10n.appTitle,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                l10n.landingHeadline,
                style: theme.textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(l10n.landingSubtitle, textAlign: TextAlign.center),
              const SizedBox(height: 32),
              FilledButton(
                key: const Key('landing-trial'),
                onPressed: () => context.go(AppRoutes.trial),
                child: Text(l10n.landingTrial),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                key: const Key('landing-register'),
                onPressed: () => context.go(AppRoutes.register),
                child: Text(l10n.actionRegister),
              ),
              const SizedBox(height: 12),
              TextButton(
                key: const Key('landing-login'),
                onPressed: () => context.go(AppRoutes.login),
                child: Text(l10n.actionSignIn),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
