import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';
import 'package:japanese_learning_client/presentation/effects/answer_effect.dart';
import 'package:japanese_learning_client/presentation/effects/celebration_host.dart';
import 'package:japanese_learning_client/presentation/effects/effect_specs.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';

import '../support/fake_backend.dart';
import '../support/lesson_scenario.dart';

// "Giảm chuyển động" và tắt hiệu ứng hình ảnh (spec 005, US3): giảm chuyển động → dạng tĩnh/mờ, tắt → không
// hoạt ảnh nhưng kết quả đúng/sai và thành tựu vẫn truyền đạt được; âm thanh độc lập với chế độ hình ảnh.

class _FixedEffects extends EffectsController {
  _FixedEffects(this.fixed);

  final EffectsSettings fixed;

  @override
  EffectsSettings build() => fixed;
}

AchievementEarned _achievement() => AchievementEarned(
  code: 'streak_7',
  kind: AchievementKind.streak,
  threshold: 7,
  name: 'Chuỗi 7 ngày',
  description: 'Học bảy ngày liên tiếp',
);

class _Rig {
  _Rig(this.tester, this.env, this.container);

  final WidgetTester tester;
  final TestEnv env;
  final ProviderContainer container;

  EffectsController get effects =>
      container.read(effectsControllerProvider.notifier);

  Future<void> advance(Duration d) async {
    await tester.pump(d);
    await tester.pump(const Duration(milliseconds: 1));
  }
}

/// Dựng `AnswerEffect` + `CelebrationHost` cạnh nhau với tùy chọn cố định.
Future<_Rig> _pump(
  WidgetTester tester, {
  required EffectsSettings settings,
  bool reduceMotion = false,
}) async {
  tester.view.physicalSize = const Size(1280, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final env = TestEnv();
  final container = ProviderContainer(
    overrides: <Override>[
      ...env.overrides,
      effectsControllerProvider.overrideWith(() => _FixedEffects(settings)),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: const Locale('vi'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: reduceMotion),
          child: CelebrationHost(child: child!),
        ),
        home: const Scaffold(
          body: AnswerEffect(child: Center(child: Text('Nội dung bài tập'))),
        ),
      ),
    ),
  );
  await tester.pump();
  return _Rig(tester, env, container);
}

Celebrations get _batch => Celebrations(
  dayCompleted: false,
  achievements: <AchievementEarned>[_achievement()],
);

/// Lớp vẽ hoạt ảnh trả lời ở bất kỳ chế độ nào (không có khi `off`).
Finder get _answerPaint => find.byWidgetPredicate(
  (w) =>
      w.key == const Key('answer-effect-full') ||
      w.key == const Key('answer-effect-reduced'),
);

void main() {
  group('giảm chuyển động (visualEnabled = true, reduceMotion = true)', () {
    testWidgets('AnswerEffect dùng chế độ reduced: chỉ vầng sáng mờ dần', (
      tester,
    ) async {
      final rig = await _pump(
        tester,
        settings: const EffectsSettings(),
        reduceMotion: true,
      );
      rig.effects.onAnswer(correct: true);
      await tester.pump();

      expect(find.byKey(const Key('answer-effect-reduced')), findsOneWidget);
      expect(find.byKey(const Key('answer-effect-full')), findsNothing);
      // Nội dung không dịch chuyển trong suốt hiệu ứng.
      final before = tester.getTopLeft(find.text('Nội dung bài tập'));
      for (var ms = 0; ms < 600; ms += 100) {
        await tester.pump(const Duration(milliseconds: 100));
        expect(tester.getTopLeft(find.text('Nội dung bài tập')), before);
      }
    });

    testWidgets('CelebrationCard: không confetti, không tịnh tiến, chỉ mờ', (
      tester,
    ) async {
      final rig = await _pump(
        tester,
        settings: const EffectsSettings(),
        reduceMotion: true,
      );
      rig.effects.onCelebrations(_batch);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));

      expect(find.byKey(const Key('celebration-card-reduced')), findsOneWidget);
      expect(find.byKey(const Key('celebration-confetti')), findsNothing);
      final card = find.byKey(const Key('celebration-card-reduced'));
      final start = tester.getTopLeft(card);
      for (var i = 0; i < 5; i++) {
        await rig.advance(const Duration(milliseconds: 500));
        expect(tester.getTopLeft(card), start); // không chuyển động tịnh tiến
      }
      await rig.advance(celebrationCardDuration);
    });
  });

  group('tắt hiệu ứng hình ảnh (visualEnabled = false)', () {
    testWidgets(
      'AnswerEffect không dựng hoạt ảnh dù có giảm chuyển động hay không',
      (tester) async {
        for (final reduce in <bool>[false, true]) {
          final rig = await _pump(
            tester,
            settings: const EffectsSettings(visualEnabled: false),
            reduceMotion: reduce,
          );
          rig.effects.onAnswer(correct: true);
          rig.effects.onAnswer(correct: false);
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));

          expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
          expect(_answerPaint, findsNothing);
        }
      },
    );

    testWidgets(
      'thành tựu hiện bằng MỘT dòng thông báo tĩnh, đọc được, tự biến và đóng được bằng một chạm',
      (tester) async {
        final rig = await _pump(
          tester,
          settings: const EffectsSettings(visualEnabled: false),
        );
        final handle = tester.ensureSemantics();

        rig.effects.onCelebrations(_batch);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 1));

        expect(find.byKey(const Key('celebration-card-off')), findsOneWidget);
        expect(find.byKey(const Key('celebration-confetti')), findsNothing);
        expect(find.text('Thành tựu mới: Chuỗi 7 ngày'), findsOneWidget);
        expect(
          tester.getSemantics(find.byKey(const Key('celebration-card-off'))),
          isNotNull,
        );
        expect(
          find.bySemanticsLabel('Thành tựu mới: Chuỗi 7 ngày'),
          findsOneWidget,
        );

        // Đóng bằng một thao tác.
        await tester.tap(find.byKey(const Key('celebration-close')));
        await tester.pump();
        expect(find.byKey(const Key('celebration-overlay')), findsNothing);

        // Hoặc tự biến sau vài giây.
        rig.effects.onCelebrations(_batch);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 1));
        expect(find.byKey(const Key('celebration-overlay')), findsOneWidget);
        await rig.advance(staticNoticeDuration);
        expect(find.byKey(const Key('celebration-overlay')), findsNothing);
        handle.dispose();
      },
    );

    testWidgets('âm thanh độc lập: vẫn phát cue khi tắt hình ảnh', (
      tester,
    ) async {
      final rig = await _pump(
        tester,
        settings: const EffectsSettings(visualEnabled: false),
      );
      rig.effects.onAnswer(correct: true);
      rig.effects.onCelebrations(_batch);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));

      expect(rig.env.soundPlayer.played, <SoundCue>[
        SoundCue.correct,
        SoundCue.achievement,
      ]);
      await rig.advance(staticNoticeDuration);
    });
  });

  group('trong bài học: kết quả luôn rõ khi hình ảnh bị giảm/tắt', () {
    Future<TestEnv> openLesson(
      WidgetTester tester, {
      bool visual = true,
      bool reduceMotion = false,
    }) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      if (reduceMotion) {
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            const FakeAccessibilityFeatures(disableAnimations: true);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );
      }
      final env = TestEnv(tokens: signedInTokens());
      LessonScenario(env.backend);
      env.backend.reply('GET /me', 200, <String, Object?>{
        'id': 'user-1',
        'email': 'a@example.com',
        'role': 'learner',
        'status': 'active',
        'learningSource': 'personal',
        'profile': <String, Object?>{
          'displayName': 'Học viên',
          'language': 'vi',
          'timezone': 'Asia/Ho_Chi_Minh',
          'paused': false,
          'onboardingState': 'completed',
          'soundEnabled': true,
          'visualEffectsEnabled': visual,
        },
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: env.overrides,
          child: const JapaneseLearningApp(),
        ),
      );
      await tester.pumpAndSettle();
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      for (final key in <String>['start-item-1', 'start-exercises']) {
        final finder = find.byKey(Key(key));
        if (finder.evaluate().isEmpty) continue;
        await tester.ensureVisible(finder);
        await tester.tap(finder);
        await tester.pumpAndSettle();
      }
      return env;
    }

    testWidgets(
      'tắt hình ảnh: sai vẫn hiện biểu tượng + chữ, không lớp hoạt ảnh, còn âm',
      (tester) async {
        final env = await openLesson(tester, visual: false);

        await tester.tap(find.byKey(const Key('choice-0'))); // sai
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(find.byKey(const Key('feedback-incorrect')), findsOneWidget);
        expect(find.text('Chưa đúng'), findsWidgets);
        expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
        expect(env.soundPlayer.played, <SoundCue>[SoundCue.incorrect]);
        await tester.pumpAndSettle();
      },
    );

    testWidgets(
      'giảm chuyển động: đúng chạy ở chế độ reduced, kết quả vẫn rõ',
      (tester) async {
        await openLesson(tester, reduceMotion: true);

        await tester.tap(find.byKey(const Key('choice-1'))); // đúng
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(find.byKey(const Key('answer-effect-reduced')), findsOneWidget);
        expect(find.byKey(const Key('answer-effect-full')), findsNothing);
        expect(find.byKey(const Key('feedback-correct')), findsOneWidget);
        await tester.pumpAndSettle();
      },
    );
  });
}
