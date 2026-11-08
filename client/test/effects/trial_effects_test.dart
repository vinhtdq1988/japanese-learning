import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';
import '../support/trial_scenario.dart';

// Hiệu ứng ở bài học mẫu của khách (spec 005, US1): phát ngay sau chấm cục bộ, không chúc mừng, không mạng.

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

Future<TestEnv> _guestLesson(WidgetTester tester) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv();
  TrialScenario(env.backend);
  LearningScenario(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/trial/lesson');
  await tester.pumpAndSettle();
  await _tap(tester, 'trial-start-exercises');
  return env;
}

void main() {
  testWidgets('bài mẫu: mỗi lần chấm cục bộ phát đúng một cue theo kết quả', (
    tester,
  ) async {
    final env = await _guestLesson(tester);

    await _tap(tester, 'choice-0'); // sai
    expect(_has('feedback-incorrect'), isTrue);
    expect(env.soundPlayer.played, <SoundCue>[SoundCue.incorrect]);
    expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
    await _tap(tester, 'continue');

    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
    await tester.pump();
    await _tap(tester, 'submit-answer'); // đúng
    expect(env.soundPlayer.played, <SoundCue>[
      SoundCue.incorrect,
      SoundCue.correct,
    ]);
    expect(env.soundPlayer.primeCount, greaterThanOrEqualTo(2));
  });

  testWidgets('bài mẫu: lớp hiệu ứng xuất hiện ngay khi có kết quả', (
    tester,
  ) async {
    await _guestLesson(tester);
    await tester.tap(find.byKey(const Key('choice-1')));
    await tester.pump();
    expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets(
    'bài mẫu: không có yêu cầu mạng nào cho hiệu ứng và không có chúc mừng',
    (tester) async {
      final env = await _guestLesson(tester);
      env.backend.requests.clear();

      await _tap(tester, 'choice-1');
      await _tap(tester, 'continue');

      // Chấm cục bộ nên không có yêu cầu nào (kể cả /me hay trường chúc mừng).
      expect(env.backend.requests, isEmpty);
      expect(
        env.localStore.snapshot.keys.where((k) => k.contains('effect')),
        isEmpty,
      );
      // Không có thẻ chúc mừng nào được dựng cho khách (FR-018).
      expect(find.byKey(const Key('celebration-card')), findsNothing);
    },
  );
}
