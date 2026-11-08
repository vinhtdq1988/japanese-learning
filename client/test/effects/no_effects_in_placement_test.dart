import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';
import '../support/trial_scenario.dart';

// Bài kiểm tra trình độ KHÔNG có hiệu ứng (spec 005, FR-007): không phụ thuộc controller hiệu ứng,
// không phát cue, không dựng lớp hiệu ứng.

void main() {
  test('mã nguồn placement không phụ thuộc lớp hiệu ứng hay SoundPlayer', () {
    final files = Directory('lib/presentation/placement')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'));
    expect(files, isNotEmpty);
    for (final file in files) {
      final source = file.readAsStringSync();
      expect(
        source,
        isNot(contains('effectsControllerProvider')),
        reason: file.path,
      );
      expect(
        source,
        isNot(contains('presentation/effects')),
        reason: file.path,
      );
      expect(
        source,
        isNot(contains('effects/effects_controller')),
        reason: file.path,
      );
      expect(source, isNot(contains('soundPlayerProvider')), reason: file.path);
    }
  });

  testWidgets('làm kiểm tra trình độ: không cue, không lớp hiệu ứng', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv();
    TrialScenario(env.backend);
    LearningScenario(env.backend);
    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/trial');
    await tester.pumpAndSettle();

    Future<void> tap(String key) async {
      final finder = find.byKey(Key(key));
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    await tap('trial-placement-open');
    await tap('placement-start');
    await tap('choice-2');
    expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
    await tap('placement-next');
    await tap('choice-1');
    await tap('placement-next');
    await tap('placement-submit');

    expect(find.byKey(const Key('placement-result')), findsOneWidget);
    expect(env.soundPlayer.played, isEmpty);
    expect(env.soundPlayer.primeCount, 0);
    expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
  });
}
