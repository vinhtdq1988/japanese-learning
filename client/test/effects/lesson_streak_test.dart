import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';
import 'package:japanese_learning_client/presentation/effects/correct_streak.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_controller.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';
import '../support/lesson_scenario.dart';
import '../support/trial_scenario.dart';

// Đúng liên tiếp trong một phiên (spec 005, US4): đếm chỉ lượt chính, tăng mức phản hồi ở ngưỡng 3/5/10, về 0 khi
// sai hoặc phiên mới; không lưu, không mạng, không phải thành tựu.

void main() {
  group('CorrectStreak (hàm thuần)', () {
    test('+1 mỗi câu đúng, về 0 khi sai', () {
      var s = const CorrectStreak();
      s = s.record(correct: true).next;
      s = s.record(correct: true).next;
      expect(s.count, 2);
      s = s.record(correct: false).next;
      expect(s.count, 0);
    });

    test('mốc 3, 5, 10 chỉ khi vừa chạm ngưỡng', () {
      var s = const CorrectStreak();
      final milestones = <int?>[];
      for (var i = 0; i < 12; i++) {
        final r = s.record(correct: true);
        s = r.next;
        milestones.add(r.milestone);
      }
      expect(milestones, <int?>[
        null,
        null,
        3,
        null,
        5,
        null,
        null,
        null,
        null,
        10,
        null,
        null,
      ]);
    });

    test('sau câu sai không có mốc; chuỗi mới đếm lại từ đầu', () {
      var s = const CorrectStreak();
      for (var i = 0; i < 3; i++) {
        s = s.record(correct: true).next;
      }
      final wrong = s.record(correct: false);
      expect(wrong.milestone, isNull);
      s = wrong.next;
      expect(s.count, 0);
      // Chuỗi mới: câu đúng thứ 1 và 2 chưa có mốc, thứ 3 mới chạm ngưỡng.
      final first = s.record(correct: true);
      final second = first.next.record(correct: true);
      final third = second.next.record(correct: true);
      expect(
        <int?>[first.milestone, second.milestone, third.milestone],
        <int?>[null, null, 3],
      );
    });
  });

  group('bài học và ôn tập', () {
    Future<
      ({
        TestEnv env,
        LessonScenario scenario,
        List<AnswerEffectEvent> events,
        ProviderContainer container,
      })
    >
    open(WidgetTester tester, {void Function(LessonScenario)? setup}) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      final env = TestEnv(tokens: signedInTokens());
      final scenario = LessonScenario(env.backend);
      setup?.call(scenario);
      await tester.pumpWidget(
        ProviderScope(
          overrides: env.overrides,
          child: const JapaneseLearningApp(),
        ),
      );
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(Scaffold).first),
      );
      final events = <AnswerEffectEvent>[];
      container
          .read(effectsControllerProvider.notifier)
          .answerEvents
          .listen(events.add);
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      return (
        env: env,
        scenario: scenario,
        events: events,
        container: container,
      );
    }

    Future<void> tap(WidgetTester tester, String key) async {
      final finder = find.byKey(Key(key));
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> start(WidgetTester tester, String itemKey) async {
      await tap(tester, itemKey);
      if (find.byKey(const Key('start-exercises')).evaluate().isNotEmpty) {
        await tap(tester, 'start-exercises');
      }
    }

    Future<void> fillBlank(WidgetTester tester, String text) async {
      await tester.enterText(find.byKey(const Key('fill-blank-input')), text);
      await tester.pump();
      await tap(tester, 'submit-answer');
    }

    Future<void> matching(WidgetTester tester, {required bool correct}) async {
      await tap(tester, 'match-left-0');
      await tap(tester, correct ? 'match-right-1' : 'match-right-0');
      await tap(tester, 'match-left-1');
      await tap(tester, correct ? 'match-right-0' : 'match-right-1');
      await tap(tester, 'submit-answer');
    }

    int streakOf(ProviderContainer c, String arg) =>
        c.read(lessonControllerProvider(arg)).requireValue.correctStreak;

    testWidgets(
      'đúng liên tiếp: đếm +1, chạm ngưỡng 3 thì phát cue streak và hiện huy hiệu "3 liên tiếp"',
      (tester) async {
        final t = await open(tester);
        await start(tester, 'start-item-1');

        await tap(tester, 'choice-1'); // đúng → 1
        expect(streakOf(t.container, 'item-1'), 1);
        await tap(tester, 'continue');
        await fillBlank(tester, 'は'); // đúng → 2
        expect(streakOf(t.container, 'item-1'), 2);
        expect(t.events.map((e) => e.streakMilestone), <int?>[null, null]);
        await tap(tester, 'continue');

        // Câu thứ 3 chạm ngưỡng.
        await tap(tester, 'match-left-0');
        await tap(tester, 'match-right-1');
        await tap(tester, 'match-left-1');
        await tap(tester, 'match-right-0');
        await tester.tap(find.byKey(const Key('submit-answer')));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(streakOf(t.container, 'item-1'), 3);
        expect(t.events.last.streakMilestone, 3);
        expect(t.env.soundPlayer.played, <SoundCue>[
          SoundCue.correct,
          SoundCue.correct,
          SoundCue.streak,
        ]);
        expect(find.byKey(const Key('streak-badge')), findsOneWidget);
        expect(find.text('3 liên tiếp'), findsOneWidget);
        await tester.pumpAndSettle();
        // Huy hiệu chỉ là hiệu ứng thoáng qua; không lưu ở đâu cả.
        expect(find.byKey(const Key('streak-badge')), findsNothing);
      },
    );

    testWidgets('sai về 0; lượt hỏi lại không đổi bộ đếm và không có mốc', (
      tester,
    ) async {
      final t = await open(tester);
      await start(tester, 'start-item-1');

      await tap(tester, 'choice-0'); // sai → 0
      expect(streakOf(t.container, 'item-1'), 0);
      await tap(tester, 'continue');
      await fillBlank(tester, 'は'); // đúng → 1
      await tap(tester, 'continue');
      await matching(tester, correct: true); // đúng → 2
      expect(streakOf(t.container, 'item-1'), 2);
      await tap(tester, 'continue');

      // Hỏi lại câu sai: phản hồi đúng thường, bộ đếm giữ nguyên.
      expect(find.byKey(const Key('retry-heading')), findsOneWidget);
      await tap(tester, 'choice-1');
      expect(streakOf(t.container, 'item-1'), 2);
      expect(t.events, hasLength(4));
      expect(t.events.last.correct, isTrue);
      expect(t.events.every((e) => e.streakMilestone == null), isTrue);
      expect(t.env.soundPlayer.played.last, SoundCue.correct);
    });

    testWidgets('sau câu sai chỉ có phản hồi sai nhẹ thông thường', (
      tester,
    ) async {
      final t = await open(tester);
      await start(tester, 'start-item-1');
      await tap(tester, 'choice-1');
      await tap(tester, 'continue');
      await fillBlank(tester, 'は');
      await tap(tester, 'continue');
      await matching(tester, correct: false); // sai khi đang có chuỗi 2

      expect(t.events.last.correct, isFalse);
      expect(t.events.last.streakMilestone, isNull);
      expect(t.env.soundPlayer.played.last, SoundCue.incorrect);
      expect(find.byKey(const Key('streak-badge')), findsNothing);
    });

    testWidgets('phiên mới bắt đầu lại từ 0 (không mang sang phiên khác)', (
      tester,
    ) async {
      final t = await open(tester);
      await start(tester, 'start-item-1');
      await tap(tester, 'choice-1');
      await tap(tester, 'continue');
      await fillBlank(tester, 'は');
      expect(streakOf(t.container, 'item-1'), 2);

      // Rời bài giữa chừng (controller bị hủy) rồi mở phiên khác.
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      await start(tester, 'start-item-2');
      await tap(tester, 'choice-1'); // đúng → 1 (không phải 3)
      expect(streakOf(t.container, 'item-2'), 1);
      expect(
        t.events.where((e) => e.streakMilestone != null),
        isEmpty,
        reason: 'chuỗi 2 của phiên trước không được cộng sang phiên mới',
      );
    });

    testWidgets('bài ôn dùng cùng quy tắc', (tester) async {
      final t = await open(tester, setup: (s) => s.addReviewBatch());
      await start(tester, 'start-item-review');
      await tap(tester, 'choice-1');
      await tap(tester, 'continue');
      await fillBlank(tester, 'は');
      await tap(tester, 'continue');
      await matching(tester, correct: true);

      expect(t.events.last.streakMilestone, 3);
      expect(t.env.soundPlayer.played.last, SoundCue.streak);
    });

    testWidgets('không có yêu cầu mạng hay khóa LocalStore nào cho bộ đếm', (
      tester,
    ) async {
      final t = await open(tester);
      await start(tester, 'start-item-1');
      final storeBefore = Map<String, Object?>.from(t.env.localStore.snapshot);
      t.env.backend.requests.clear();

      await tap(tester, 'choice-1');

      final paths = t.env.backend.requests.map((r) => '${r.method} ${r.path}');
      expect(
        paths.where(
          (p) => !p.contains('/answers') && !p.contains('/intervals'),
        ),
        isEmpty,
      );
      expect(t.env.localStore.snapshot, storeBefore);
      expect(
        t.env.localStore.snapshot.keys.where(
          (k) => k.toLowerCase().contains('streak'),
        ),
        isEmpty,
      );
    });
  });

  group('bài học mẫu của khách', () {
    testWidgets('cùng quy tắc: câu đúng thứ 3 liên tiếp chạm ngưỡng', (
      tester,
    ) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      final env = TestEnv();
      TrialScenario(env.backend);
      LearningScenario(env.backend);
      await tester.pumpWidget(env.app());
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(Scaffold).first),
      );
      final events = <AnswerEffectEvent>[];
      container
          .read(effectsControllerProvider.notifier)
          .answerEvents
          .listen(events.add);
      GoRouter.of(
        tester.element(find.byType(Scaffold).first),
      ).go('/trial/lesson');
      await tester.pumpAndSettle();

      Future<void> tap(String key) async {
        final finder = find.byKey(Key(key));
        await tester.ensureVisible(finder);
        await tester.tap(finder);
        await tester.pumpAndSettle();
      }

      await tap('trial-start-exercises');
      await tap('choice-1'); // đúng → 1
      await tap('continue');
      await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
      await tester.pump();
      await tap('submit-answer'); // đúng → 2
      expect(events.map((e) => e.streakMilestone), <int?>[null, null]);
      await tap('continue');
      env.backend.requests.clear();

      // Đơn vị kế (cùng màn hình bài mẫu): bộ đếm giữ qua đơn vị.
      await tap('trial-next-unit');
      await tap('trial-start-exercises');
      await tap('match-left-0');
      await tap('match-right-1');
      await tap('match-left-1');
      await tap('match-right-0');
      await tap('submit-answer');

      expect(events.last.streakMilestone, 3);
      expect(env.soundPlayer.played.last, SoundCue.streak);
      expect(
        env.localStore.snapshot.keys.where(
          (k) => k.toLowerCase().contains('streak'),
        ),
        isEmpty,
      );
    });
  });
}
