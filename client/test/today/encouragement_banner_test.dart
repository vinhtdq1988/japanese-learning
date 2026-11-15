import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';
import 'package:japanese_learning_client/presentation/shared/theme.dart';
import 'package:japanese_learning_client/presentation/today/encouragement_banner.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Dải lời khích lệ ở "Hôm nay" (spec 007, T134, FR-026…FR-030): hiện câu nhận từ API với biểu tượng nhẹ theo
// trạng thái; `null` ⇒ không hiện; không lớp phủ/âm thanh/hoạt ảnh, không che tổng thời lượng và danh sách;
// màn hẹp xuống nhiều dòng; `Semantics(liveRegion: false)`.

class _FixedEffects extends EffectsController {
  _FixedEffects(this.fixed);

  final EffectsSettings fixed;

  @override
  EffectsSettings build() => fixed;
}

Widget _host(DailyPlanEncouragement? encouragement, {double width = 800}) =>
    MaterialApp(
      theme: buildAppTheme(),
      home: Scaffold(
        body: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: width,
            child: EncouragementBanner(encouragement: encouragement),
          ),
        ),
      ),
    );

DailyPlanEncouragement _enc(
  DailyPlanEncouragementStateEnum state,
  String message,
) => DailyPlanEncouragement(state: state, message: message);

Map<String, Object?> _today({Map<String, Object?>? encouragement}) =>
    <String, Object?>{
      'id': 'plan-1',
      'localDate': '2026-01-05',
      'budgetMinutes': 30,
      'estimatedMinutes': 10,
      'status': 'open',
      'notice': null,
      'items': <Map<String, Object?>>[
        <String, Object?>{
          'id': 'a',
          'type': 'new_unit',
          'kind': 'vocabulary',
          'title': 'Chào hỏi',
          'estMinutes': 5,
          'status': 'pending',
          'itemCount': null,
        },
      ],
      if (encouragement != null) 'encouragement': encouragement,
    };

Future<void> _openToday(
  WidgetTester tester, {
  required Map<String, Object?> today,
  EffectsSettings? effects,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend)..onboarded = true;
  expect(scenario.onboarded, isTrue);
  env.backend.reply('GET /today', 200, today);
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...env.overrides,
        if (effects != null)
          effectsControllerProvider.overrideWith(() => _FixedEffects(effects)),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
}

void main() {
  group('EncouragementBanner (widget)', () {
    testWidgets('hiện đúng câu nhận từ API', (tester) async {
      await tester.pumpWidget(
        _host(_enc(DailyPlanEncouragementStateEnum.inProgress, 'Làm tốt lắm!')),
      );
      expect(find.byKey(const Key('encouragement-banner')), findsOneWidget);
      expect(find.text('Làm tốt lắm!'), findsOneWidget);
    });

    testWidgets('biểu tượng nhẹ theo trạng thái', (tester) async {
      final expected = <DailyPlanEncouragementStateEnum, IconData>{
        DailyPlanEncouragementStateEnum.notStarted: Icons.favorite_border,
        DailyPlanEncouragementStateEnum.inProgress: Icons.favorite_border,
        DailyPlanEncouragementStateEnum.welcomeBack: Icons.favorite_border,
        DailyPlanEncouragementStateEnum.behindTarget: Icons.favorite_border,
        DailyPlanEncouragementStateEnum.dayCompleted:
            Icons.emoji_events_outlined,
        DailyPlanEncouragementStateEnum.streak: Icons.emoji_events_outlined,
      };
      for (final entry in expected.entries) {
        await tester.pumpWidget(_host(_enc(entry.key, 'Câu ${entry.key}')));
        expect(
          find.byIcon(entry.value),
          findsOneWidget,
          reason: '${entry.key}',
        );
      }
    });

    testWidgets('encouragement = null ⇒ không hiện gì', (tester) async {
      await tester.pumpWidget(_host(null));
      expect(find.byKey(const Key('encouragement-banner')), findsNothing);
      expect(find.byType(SizedBox), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('không hoạt ảnh, lớp phủ hay âm thanh: chỉ là hộp chữ tĩnh', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(_enc(DailyPlanEncouragementStateEnum.dayCompleted, 'Chúc mừng!')),
      );
      expect(find.byType(AnimatedWidget), findsNothing);
      expect(find.byType(AnimatedContainer), findsNothing);
      expect(find.byType(Overlay), findsOneWidget); // chỉ Overlay của Navigator
      // Không có khung chờ nào: pumpAndSettle xong ngay.
      await tester.pumpAndSettle();
    });

    testWidgets('màn hẹp: câu dài xuống nhiều dòng, không cắt chữ, không tràn', (
      tester,
    ) async {
      const long =
          'Bạn đã học liên tiếp 12 ngày, một thói quen tuyệt vời đang hình thành, hôm nay tiếp tục nhé!';
      await tester.pumpWidget(
        _host(_enc(DailyPlanEncouragementStateEnum.streak, long), width: 200),
      );
      expect(tester.takeException(), isNull);
      final text = tester.widget<Text>(
        find.byKey(const Key('encouragement-message')),
      );
      expect(text.data, long);
      expect(text.overflow, isNull);
      expect(text.maxLines, isNull);
      final height = tester
          .getSize(find.byKey(const Key('encouragement-message')))
          .height;
      expect(height, greaterThan(40)); // nhiều dòng
    });

    testWidgets('Semantics: liveRegion = false', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _host(
          _enc(DailyPlanEncouragementStateEnum.notStarted, 'Bắt đầu thôi!'),
        ),
      );
      final node = tester.getSemantics(find.text('Bắt đầu thôi!'));
      expect(node.flagsCollection.isLiveRegion, isFalse);
      var ancestor = node;
      // Không nút cha nào trong cây ngữ nghĩa của dải là vùng "live".
      var cursor = ancestor.parent;
      while (cursor != null) {
        expect(cursor.flagsCollection.isLiveRegion, isFalse);
        cursor = cursor.parent;
      }
      expect(ancestor.label, contains('Bắt đầu thôi!'));
      handle.dispose();
    });
  });

  group('Màn hình Hôm nay', () {
    testWidgets(
      'dải hiện dưới tiêu đề, không che tổng thời lượng và danh sách',
      (tester) async {
        await _openToday(
          tester,
          today: _today(
            encouragement: <String, Object?>{
              'state': 'not_started',
              'message':
                  'Sẵn sàng chưa? Bài đầu tiên của hôm nay đang chờ bạn.',
            },
          ),
        );
        expect(
          find.text('Sẵn sàng chưa? Bài đầu tiên của hôm nay đang chờ bạn.'),
          findsOneWidget,
        );
        expect(find.byKey(const Key('today-time-summary')), findsOneWidget);
        expect(find.text('Chào hỏi'), findsOneWidget);
        // Dải nằm TRÊN tổng thời lượng và danh sách bài.
        final banner = tester.getTopLeft(
          find.byKey(const Key('encouragement-banner')),
        );
        final summary = tester.getTopLeft(
          find.byKey(const Key('today-time-summary')),
        );
        final firstItem = tester.getTopLeft(find.text('Chào hỏi'));
        expect(banner.dy, lessThan(summary.dy));
        expect(banner.dy, lessThan(firstItem.dy));
      },
    );

    testWidgets(
      'thiếu encouragement (máy chủ cũ) ⇒ màn bình thường, không dải',
      (tester) async {
        await _openToday(tester, today: _today());
        expect(find.byKey(const Key('encouragement-banner')), findsNothing);
        expect(find.byKey(const Key('today-time-summary')), findsOneWidget);
        expect(find.text('Chào hỏi'), findsOneWidget);
      },
    );

    testWidgets('vẫn hiện khi người học tắt hiệu ứng hình ảnh và âm thanh', (
      tester,
    ) async {
      await _openToday(
        tester,
        effects: const EffectsSettings(
          soundEnabled: false,
          visualEnabled: false,
        ),
        today: _today(
          encouragement: <String, Object?>{
            'state': 'in_progress',
            'message': 'Bạn đang đi đúng nhịp.',
          },
        ),
      );
      expect(find.text('Bạn đang đi đúng nhịp.'), findsOneWidget);
    });
  });
}
