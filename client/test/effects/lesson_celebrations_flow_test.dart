import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';

import '../support/fake_backend.dart';
import '../support/lesson_scenario.dart';

// Chúc mừng sau khi hoàn thành bài (spec 005, US2): LessonController.finish() chuyển `SessionSummary.celebrations`
// cho EffectsController đúng một lần; không có trường thì không hiện gì; "Tiếp tục" không bị chặn.

const Map<String, Object?> _celebrations = <String, Object?>{
  'dayCompleted': true,
  'achievements': <Map<String, Object?>>[
    <String, Object?>{
      'code': 'first_lesson',
      'kind': 'first_lesson',
      'name': 'Bài học đầu tiên',
      'description': 'Bạn vừa hoàn thành bài học đầu tiên!',
    },
  ],
};

class _Harness {
  _Harness(this.tester, this.env, this.scenario, this.batches);

  final WidgetTester tester;
  final TestEnv env;
  final LessonScenario scenario;

  /// Mọi lô thẻ chúc mừng mà EffectsController đã phát.
  final List<List<CelebrationEntry>> batches;

  Future<void> tap(String key) async {
    final finder = find.byKey(Key(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  /// Chạm mà KHÔNG `pumpAndSettle`: settle sẽ chạy hết 3,5 s của thẻ chúc mừng và nó tự đóng trước khi kiểm tra.
  Future<void> tapAndPump(String key) async {
    final finder = find.byKey(Key(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  bool has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

  /// Trả lời đúng cả ba câu rồi bấm "Tiếp tục" ở câu cuối → hoàn thành phiên.
  Future<void> finishLesson() async {
    await tap('start-item-1');
    if (has('start-exercises')) await tap('start-exercises');
    await tap('choice-1');
    await tap('continue');
    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
    await tester.pump();
    await tap('submit-answer');
    await tap('continue');
    await tap('match-left-0');
    await tap('match-right-1');
    await tap('match-left-1');
    await tap('match-right-0');
    await tap('submit-answer');
    await tapAndPump('continue');
  }
}

Future<_Harness> _open(
  WidgetTester tester, {
  Map<String, Object?>? celebrations = _celebrations,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LessonScenario(env.backend)..celebrations = celebrations;
  await tester.pumpWidget(
    ProviderScope(overrides: env.overrides, child: const JapaneseLearningApp()),
  );
  await tester.pumpAndSettle();
  final container = ProviderScope.containerOf(
    tester.element(find.byType(Scaffold).first),
  );
  final batches = <List<CelebrationEntry>>[];
  container
      .read(effectsControllerProvider.notifier)
      .celebrationBatches
      .listen(batches.add);
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
  return _Harness(tester, env, scenario, batches);
}

/// Rời màn bài học để dừng mọi bộ đếm giờ của ứng dụng trước khi kết thúc test.
Future<void> _leave(_Harness h) async {
  GoRouter.of(h.tester.element(find.byType(Scaffold).first)).go('/progress');
  await h.tester.pumpAndSettle();
  await h.tester.pump(const Duration(seconds: 5));
}

void main() {
  testWidgets(
    'finish() nhận celebrations → onCelebrations đúng một lần: ngày rồi thành tựu, có âm thanh',
    (tester) async {
      final h = await _open(tester);
      await h.finishLesson();

      expect(h.has('summary-heading'), isTrue);
      expect(h.batches, hasLength(1));
      expect(h.batches.single.map((e) => e.isDay), <bool>[true, false]);
      expect(h.batches.single.last.achievement?.code, 'first_lesson');

      // Thẻ đầu (hoàn thành ngày) đang hiện trong cùng một màn gộp.
      expect(h.has('celebration-overlay'), isTrue);
      expect(find.text('Hoàn thành ngày học!'), findsOneWidget);
      expect(h.env.soundPlayer.played.last, SoundCue.dayComplete);

      await _leave(h);
    },
  );

  testWidgets('không có trường celebrations → không hiện gì', (tester) async {
    final h = await _open(tester, celebrations: null);
    await h.finishLesson();

    expect(h.has('summary-heading'), isTrue);
    expect(h.batches, isEmpty);
    expect(h.has('celebration-overlay'), isFalse);
    expect(h.env.soundPlayer.played, isNot(contains(SoundCue.dayComplete)));
    expect(h.env.soundPlayer.played, isNot(contains(SoundCue.achievement)));

    await _leave(h);
  });

  testWidgets(
    'bấm "Tiếp tục" lúc màn chúc mừng hiện → điều hướng xảy ra ngay và màn đóng',
    (tester) async {
      final h = await _open(tester);
      await h.finishLesson();
      expect(h.has('celebration-overlay'), isTrue);

      await h.tap('back-to-today');

      expect(h.has('celebration-overlay'), isFalse);
      expect(h.has('summary-heading'), isFalse, reason: 'đã rời màn tóm tắt');
      expect(
        h.has('start-item-2'),
        isTrue,
        reason: 'về "Hôm nay" ngay lập tức',
      );
      expect(h.batches, hasLength(1), reason: 'không chúc mừng lại');

      await _leave(h);
    },
  );

  test('bài học mẫu của khách không bao giờ gọi onCelebrations', () {
    // Bỏ dòng chú thích: file có ghi chú "KHÔNG gọi onCelebrations".
    final source = File('lib/presentation/trial/trial_lesson_screen.dart')
        .readAsLinesSync()
        .where((line) => !line.trimLeft().startsWith('//'))
        .join(' ');
    expect(source, isNot(contains('onCelebrations')));
    expect(source, isNot(contains('celebrationBatches')));
  });
}
