import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../placement/placement_result_card.dart';
import '../shared/confirm_dialog.dart';
import '../shared/page_frame.dart';
import 'trial_state.dart';

/// Thời lượng mặc định của bài mẫu (tổng ≤ 10 phút, R9).
const int kTrialSampleMinutes = 10;

/// Tính năng cần tài khoản, hiển thị khóa ở trang dùng thử và dùng làm tham số `feature` của
/// [AppRoutes.trialAccountRequired].
enum TrialLockedFeature {
  path('path'),
  today('today'),
  review('review'),
  progress('progress');

  const TrialLockedFeature(this.code);

  final String code;

  static TrialLockedFeature fromCode(String? code) => values.firstWhere(
    (f) => f.code == code,
    orElse: () => TrialLockedFeature.path,
  );

  String label(AppLocalizations l10n) => switch (this) {
    TrialLockedFeature.path => l10n.trialLockedPath,
    TrialLockedFeature.today => l10n.trialLockedToday,
    TrialLockedFeature.review => l10n.trialLockedReview,
    TrialLockedFeature.progress => l10n.trialLockedProgress,
  };

  IconData get icon => switch (this) {
    TrialLockedFeature.path => Icons.route_outlined,
    TrialLockedFeature.today => Icons.today_outlined,
    TrialLockedFeature.review => Icons.replay_outlined,
    TrialLockedFeature.progress => Icons.insights_outlined,
  };
}

/// Trang dùng thử (T100, FR-036/037): bài mẫu ngắn, kiểm tra trình độ và danh sách tính năng cần tài
/// khoản. Từ trang đầu tới bài mẫu chỉ mất 2 lần nhấp ("Dùng thử" → "Bắt đầu bài mẫu"). Không có gì được
/// lưu trên server; trạng thái ở trình duyệt (xem [TrialController]).
class TrialHomeScreen extends ConsumerWidget {
  const TrialHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final trial = ref.watch(trialStateProvider).valueOrNull ?? TrialState.empty;

    final lessonStarted = trial.answers.isNotEmpty;
    final lessonLabel = trial.lessonEventSent
        ? l10n.trialLessonDoneAction
        : (lessonStarted ? l10n.trialContinueLesson : l10n.trialStartLesson);

    return PageFrame(
      title: l10n.trialTitle,
      showNavigation: false,
      actions: <Widget>[
        TextButton(
          key: const Key('trial-login'),
          onPressed: () => context.go(AppRoutes.login),
          child: Text(l10n.actionSignIn),
        ),
      ],
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(l10n.trialHomeHeadline, style: theme.textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(l10n.trialHomeIntro(kTrialSampleMinutes)),
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                key: const Key('trial-start-lesson'),
                icon: const Icon(Icons.play_arrow),
                onPressed: () => context.go(
                  trial.lessonEventSent
                      ? AppRoutes.trialFinished
                      : AppRoutes.trialLesson,
                ),
                label: Text(lessonLabel),
              ),
            ),
            const SizedBox(height: 24),
            _PlacementCard(trial: trial),
            const SizedBox(height: 24),
            Text(l10n.trialLockedHeading, style: theme.textTheme.titleMedium),
            const SizedBox(height: 4),
            for (final feature in TrialLockedFeature.values)
              ListTile(
                key: Key('trial-locked-${feature.code}'),
                leading: Icon(feature.icon),
                title: Text(feature.label(l10n)),
                trailing: const Icon(Icons.lock_outline),
                onTap: () => context.go(
                  '${AppRoutes.trialAccountRequired}?feature=${feature.code}',
                ),
              ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: <Widget>[
                FilledButton(
                  key: const Key('trial-register'),
                  onPressed: () => context.go(AppRoutes.register),
                  child: Text(l10n.trialRegisterCta),
                ),
                if (trial.hasActivity)
                  TextButton(
                    key: const Key('trial-restart'),
                    onPressed: () => _restart(context, ref),
                    child: Text(l10n.trialRestart),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _restart(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showConfirmDialog(
      context,
      title: l10n.trialRestartConfirmTitle,
      message: l10n.trialRestartConfirmMessage,
      destructive: true,
    );
    if (confirmed) await ref.read(trialStateProvider.notifier).restart();
  }
}

class _PlacementCard extends StatelessWidget {
  const _PlacementCard({required this.trial});

  final TrialState trial;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final result = trial.placementResult;
    return Card(
      key: const Key('trial-placement-card'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.trialPlacementCardTitle,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(l10n.trialPlacementCardBody),
            if (result != null) ...<Widget>[
              const SizedBox(height: 12),
              PlacementResultCard(result: result),
            ],
            const SizedBox(height: 12),
            OutlinedButton(
              key: const Key('trial-placement-open'),
              onPressed: () => context.go(AppRoutes.trialPlacement),
              child: Text(
                result == null
                    ? l10n.trialPlacementTake
                    : l10n.trialPlacementViewResult,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
