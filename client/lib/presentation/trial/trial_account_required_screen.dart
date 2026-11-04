import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import 'trial_home_screen.dart';

/// Giải thích vì sao tính năng cần tài khoản kèm lời mời đăng ký (T100, FR-036). Khách chạm vào tính năng
/// bị khóa ở trang dùng thử sẽ tới đây thay vì bị chuyển thẳng sang đăng nhập.
class TrialAccountRequiredScreen extends StatelessWidget {
  const TrialAccountRequiredScreen({super.key, this.feature});

  /// Mã tính năng (xem [TrialLockedFeature.code]); mã lạ rơi về "Lộ trình".
  final String? feature;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locked = TrialLockedFeature.fromCode(feature);
    return PageFrame(
      title: l10n.trialTitle,
      showNavigation: false,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Icon(locked.icon, size: 48, color: theme.colorScheme.primary),
              const SizedBox(height: 12),
              Text(
                l10n.trialAccountRequiredTitle,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                l10n.trialAccountRequiredBody(locked.label(l10n)),
                key: const Key('trial-account-required-body'),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton(
                key: const Key('trial-register'),
                onPressed: () => context.go(AppRoutes.register),
                child: Text(l10n.trialRegisterCta),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                key: const Key('trial-login'),
                onPressed: () => context.go(AppRoutes.login),
                child: Text(l10n.actionSignIn),
              ),
              TextButton(
                key: const Key('trial-back'),
                onPressed: () => context.go(AppRoutes.trial),
                child: Text(l10n.trialBackToTrial),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
