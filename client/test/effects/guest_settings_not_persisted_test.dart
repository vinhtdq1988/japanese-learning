import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';
import '../support/trial_scenario.dart';

// Tùy chọn hiệu ứng của khách (spec 005, US3, E9): chỉ áp dụng trong phiên — không mạng, không LocalStore,
// không TokenStore; tải lại trang (dựng lại ProviderScope) thì về mặc định cả hai bật.

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

IconData _iconOf(WidgetTester tester, String key) => tester
    .widget<Icon>(
      find.descendant(of: find.byKey(Key(key)), matching: find.byType(Icon)),
    )
    .icon!;

Future<void> _openTrial(
  WidgetTester tester,
  TestEnv env, {
  Key? scopeKey,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      key: scopeKey,
      overrides: env.overrides,
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/trial/lesson');
  await tester.pumpAndSettle();
  await _tap(tester, 'trial-start-exercises');
}

void main() {
  testWidgets('khách đổi tùy chọn: chỉ trong phiên, không mạng, không lưu trữ', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv();
    TrialScenario(env.backend);
    LearningScenario(env.backend);
    await _openTrial(tester, env);

    final storeBefore = Map<String, Object?>.from(env.localStore.snapshot);
    final tokenBefore = await env.tokenStore.read();
    env.backend.requests.clear();

    await _tap(tester, 'effects-sound-toggle');
    await _tap(tester, 'effects-visual-toggle');

    // Áp dụng ngay trong phiên.
    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_off);
    expect(
      _iconOf(tester, 'effects-visual-toggle'),
      Icons.auto_awesome_outlined,
    );

    // Không có yêu cầu mạng nào (kể cả PATCH /me).
    expect(env.backend.requests, isEmpty);
    // Không ghi LocalStore/TokenStore (và sessionStorage mô phỏng chính là LocalStore trong bộ nhớ).
    expect(env.localStore.snapshot, storeBefore);
    expect(
      env.localStore.snapshot.keys.where(
        (k) =>
            k.toLowerCase().contains('sound') ||
            k.toLowerCase().contains('visual') ||
            k.toLowerCase().contains('effect'),
      ),
      isEmpty,
    );
    expect(await env.tokenStore.read(), tokenBefore);
  });

  testWidgets('dựng lại ProviderScope (tải lại trang) → về mặc định cả hai bật', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv();
    TrialScenario(env.backend);
    LearningScenario(env.backend);
    await _openTrial(tester, env, scopeKey: const ValueKey<int>(1));
    await _tap(tester, 'effects-sound-toggle');
    await _tap(tester, 'effects-visual-toggle');
    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_off);

    // Mô phỏng tải lại trang: ProviderScope mới (trạng thái Riverpod mất), kho cục bộ còn nguyên.
    await _openTrial(tester, env, scopeKey: const ValueKey<int>(2));

    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_up);
    expect(_iconOf(tester, 'effects-visual-toggle'), Icons.auto_awesome);
    // Và cue được phát lại bình thường.
    env.soundPlayer.played.clear();
    await tester.tap(find.byKey(const Key('choice-1')));
    await tester.pump();
    await tester.pumpAndSettle();
    expect(env.soundPlayer.played, isNotEmpty);
    expect(
      env.soundPlayer.played.every((c) => c != SoundCue.achievement),
      isTrue,
    );
  });
}
