import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';
import '../support/lesson_scenario.dart';
import '../support/trial_scenario.dart';

// Nút điều khiển nhanh (spec 005, US3): tắt/bật âm thanh bằng MỘT thao tác ngay trong bài, có tooltip và nhãn
// trợ năng, trạng thái thể hiện bằng biểu tượng; khách có thêm nút hiệu ứng hình ảnh; tắt âm thanh thì không
// có cue nhưng hình ảnh vẫn hiện.

Map<String, Object?> _me({bool sound = true, bool visual = true}) =>
    <String, Object?>{
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
        'soundEnabled': sound,
        'visualEffectsEnabled': visual,
      },
    };

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

IconData _iconOf(WidgetTester tester, String key) => tester
    .widget<Icon>(
      find.descendant(of: find.byKey(Key(key)), matching: find.byType(Icon)),
    )
    .icon!;

String? _tooltipOf(WidgetTester tester, String key) =>
    tester.widget<IconButton>(find.byKey(Key(key))).tooltip;

Future<({TestEnv env, List<Map<String, Object?>> patches})> _openLesson(
  WidgetTester tester,
) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LessonScenario(env.backend);
  final patches = <Map<String, Object?>>[];
  env.backend.reply('GET /me', 200, _me());
  env.backend.on('PATCH /me', (r) {
    patches.add(requestJson(r));
    return FakeResponse(200, _me());
  });
  await tester.pumpWidget(
    ProviderScope(overrides: env.overrides, child: const JapaneseLearningApp()),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
  await _tap(tester, 'start-item-1');
  if (_has('start-exercises')) await _tap(tester, 'start-exercises');
  return (env: env, patches: patches);
}

Future<TestEnv> _openTrial(WidgetTester tester) async {
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
  testWidgets('bài học: một chạm tắt âm thanh, có tooltip, biểu tượng đổi', (
    tester,
  ) async {
    final lesson = await _openLesson(tester);

    expect(_has('effects-sound-toggle'), isTrue);
    expect(_has('effects-visual-toggle'), isFalse); // người học chỉnh ở Hồ sơ
    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_up);
    expect(_tooltipOf(tester, 'effects-sound-toggle'), 'Tắt âm thanh');
    expect(find.bySemanticsLabel('Tắt âm thanh'), findsWidgets);

    await _tap(tester, 'effects-sound-toggle');

    expect(lesson.patches, <Map<String, Object?>>[
      <String, Object?>{'soundEnabled': false},
    ]);
    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_off);
    expect(_tooltipOf(tester, 'effects-sound-toggle'), 'Bật âm thanh');

    await _tap(tester, 'effects-sound-toggle');
    expect(lesson.patches.last, <String, Object?>{'soundEnabled': true});
    expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_up);
  });

  testWidgets(
    'bài học: âm thanh tắt thì không có cue nhưng hình ảnh vẫn hiện (US3.3)',
    (tester) async {
      final lesson = await _openLesson(tester);
      await _tap(tester, 'effects-sound-toggle');
      lesson.env.soundPlayer.played.clear();

      await tester.tap(find.byKey(const Key('choice-1')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);
      await tester.pumpAndSettle();
      expect(lesson.env.soundPlayer.played, isEmpty);
    },
  );

  testWidgets(
    'bài học mẫu của khách: có cả nút âm thanh và hiệu ứng hình ảnh',
    (tester) async {
      final env = await _openTrial(tester);

      expect(_has('effects-sound-toggle'), isTrue);
      expect(_has('effects-visual-toggle'), isTrue);
      expect(
        _tooltipOf(tester, 'effects-visual-toggle'),
        'Tắt hiệu ứng hình ảnh',
      );
      expect(_iconOf(tester, 'effects-visual-toggle'), Icons.auto_awesome);

      env.backend.requests.clear();
      await _tap(tester, 'effects-visual-toggle');
      expect(
        _iconOf(tester, 'effects-visual-toggle'),
        Icons.auto_awesome_outlined,
      );
      expect(
        _tooltipOf(tester, 'effects-visual-toggle'),
        'Bật hiệu ứng hình ảnh',
      );

      // Tắt hình ảnh: trả lời không dựng lớp hoạt ảnh.
      await tester.tap(find.byKey(const Key('choice-1')));
      await tester.pump();
      expect(find.byKey(const Key('answer-effect-layer')), findsNothing);
      await tester.pumpAndSettle();
      expect(env.backend.requests, isEmpty); // khách: không mạng
    },
  );

  testWidgets(
    'bài học mẫu của khách: tắt âm thanh một chạm, hình ảnh vẫn hiện',
    (tester) async {
      final env = await _openTrial(tester);
      await _tap(tester, 'effects-sound-toggle');
      expect(_iconOf(tester, 'effects-sound-toggle'), Icons.volume_off);
      env.soundPlayer.played.clear();

      await tester.tap(find.byKey(const Key('choice-1')));
      await tester.pump();

      expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);
      await tester.pumpAndSettle();
      expect(env.soundPlayer.played, isEmpty);
    },
  );
}
