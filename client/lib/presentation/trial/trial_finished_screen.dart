import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import 'trial_state.dart';

/// Màn hình hết nội dung dùng thử (T100, FR-037): tổng kết bài mẫu và mời đăng ký để nhận lộ trình riêng.
class TrialFinishedScreen extends ConsumerWidget {
  const TrialFinishedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final trial = ref.watch(trialStateProvider).valueOrNull ?? TrialState.empty;
    final correct = trial.answers.values.where((v) => v).length;

    return PageFrame(
      title: l10n.trialTitle,
      showNavigation: false,
      child: Center(
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Icon(
                  Icons.emoji_events_outlined,
                  size: 56,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.trialFinishedHeading,
                  key: const Key('trial-finished-heading'),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                if (trial.answers.isNotEmpty)
                  Text(
                    l10n.trialFinishedScore(correct, trial.answers.length),
                    key: const Key('trial-finished-score'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium,
                  ),
                const SizedBox(height: 8),
                Text(l10n.trialFinishedBody, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('trial-register'),
                  onPressed: () => context.go(AppRoutes.register),
                  child: Text(l10n.trialRegisterCta),
                ),
                const SizedBox(height: 8),
                if (!trial.hasPlacement)
                  OutlinedButton(
                    key: const Key('trial-placement-open'),
                    onPressed: () => context.go(AppRoutes.trialPlacement),
                    child: Text(l10n.trialPlacementTake),
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
      ),
    );
  }
}
