import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/presentation/effects/effect_mode.dart';
import 'package:japanese_learning_client/presentation/effects/effect_specs.dart';
import 'package:japanese_learning_client/presentation/effects/effects_controller.dart';
import 'package:japanese_learning_client/presentation/effects/answer_effect.dart';

import '../support/fake_backend.dart';

// AnswerEffect (spec 005, US1): hiệu ứng đúng/sai theo EffectMode, không chặn thao tác, không đổi bố cục.

class _Host extends StatelessWidget {
  const _Host({required this.env, this.reduceMotion = false, this.onTap});

  final TestEnv env;
  final bool reduceMotion;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: env.overrides,
      child: MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: reduceMotion),
          child: Scaffold(
            body: AnswerEffect(
              child: Center(
                child: ElevatedButton(
                  key: const Key('under-effect'),
                  onPressed: onTap,
                  child: const Text('Tiếp tục'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

EffectsController _controller(WidgetTester tester) => ProviderScope.containerOf(
  tester.element(find.byType(AnswerEffect)),
).read(effectsControllerProvider.notifier);

Finder _paint(EffectMode mode) => find.byKey(Key('answer-effect-${mode.name}'));

void main() {
  testWidgets('full: hiệu ứng đúng chạy ≤ 600 ms rồi biến mất', (tester) async {
    await tester.pumpWidget(_Host(env: TestEnv()));
    expect(_paint(EffectMode.full), findsNothing);

    _controller(tester).onAnswer(correct: true);
    await tester.pump();
    expect(_paint(EffectMode.full), findsOneWidget);
    expect(find.byKey(const Key('answer-effect-correct')), findsOneWidget);

    await tester.pump(
      correctEffect.duration + const Duration(milliseconds: 16),
    );
    await tester.pump();
    expect(_paint(EffectMode.full), findsNothing);
  });

  testWidgets('full: hiệu ứng sai ≤ 400 ms, màu hổ phách, không rung lắc', (
    tester,
  ) async {
    await tester.pumpWidget(_Host(env: TestEnv()));
    final before = tester.getTopLeft(find.byKey(const Key('under-effect')));

    _controller(tester).onAnswer(correct: false);
    await tester.pump();
    expect(find.byKey(const Key('answer-effect-incorrect')), findsOneWidget);

    // Nội dung bên dưới KHÔNG dịch chuyển ở bất kỳ khung hình nào (không rung/lắc, FR-026).
    for (var ms = 0; ms <= 400; ms += 50) {
      await tester.pump(const Duration(milliseconds: 50));
      expect(tester.getTopLeft(find.byKey(const Key('under-effect'))), before);
    }
    await tester.pump(const Duration(milliseconds: 50));
    expect(_paint(EffectMode.full), findsNothing);

    // Màu của lớp phủ sai thuộc dải hổ phách, không phải đỏ gắt.
    expect(
      incorrectEffect.duration,
      lessThanOrEqualTo(const Duration(milliseconds: 400)),
    );
    expect(answerEffectAmber.r, greaterThan(answerEffectAmber.b));
    expect(answerEffectAmber.g, greaterThan(answerEffectAmber.b));
  });

  testWidgets('reduced: chỉ mờ dần, cùng thời lượng tối đa', (tester) async {
    await tester.pumpWidget(_Host(env: TestEnv(), reduceMotion: true));
    _controller(tester).onAnswer(correct: true);
    await tester.pump();
    expect(_paint(EffectMode.reduced), findsOneWidget);
    expect(_paint(EffectMode.full), findsNothing);

    await tester.pump(
      correctEffect.duration + const Duration(milliseconds: 16),
    );
    await tester.pump();
    expect(_paint(EffectMode.reduced), findsNothing);
  });

  testWidgets('off (tắt hiệu ứng hình ảnh): không dựng hoạt ảnh nào', (
    tester,
  ) async {
    final env = TestEnv(tokens: signedInTokens());
    env.backend.reply('GET /me', 200, <String, Object?>{
      'id': 'user-1',
      'email': 'a@example.com',
      'role': 'learner',
      'status': 'active',
      'learningSource': 'personal',
      'profile': <String, Object?>{
        'displayName': 'Học viên',
        'visualEffectsEnabled': false,
      },
    });
    await tester.pumpWidget(_Host(env: env));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump();

    _controller(tester).onAnswer(correct: true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byKey(const Key('answer-effect-correct')), findsNothing);
    expect(_paint(EffectMode.off), findsNothing);
    expect(_paint(EffectMode.full), findsNothing);
    expect(_paint(EffectMode.reduced), findsNothing);
  });

  testWidgets(
    'lớp hiệu ứng: IgnorePointer + RepaintBoundary + ExcludeSemantics',
    (tester) async {
      var taps = 0;
      await tester.pumpWidget(_Host(env: TestEnv(), onTap: () => taps++));
      _controller(tester).onAnswer(correct: true);
      await tester.pump(const Duration(milliseconds: 100));

      final layer = find.byKey(const Key('answer-effect-layer'));
      expect(layer, findsOneWidget);
      expect(
        find.descendant(of: layer, matching: find.byType(IgnorePointer)),
        findsWidgets,
      );
      expect(
        find.descendant(of: layer, matching: find.byType(RepaintBoundary)),
        findsWidgets,
      );
      expect(
        find.descendant(of: layer, matching: find.byType(ExcludeSemantics)),
        findsWidgets,
      );

      // Hiệu ứng đang chạy mà nút bên dưới vẫn bấm được ngay (FR-004).
      await tester.tap(find.byKey(const Key('under-effect')));
      expect(taps, 1);
      await tester.pumpAndSettle();
    },
  );

  testWidgets('không đổi kích thước bố cục khi hiệu ứng chạy (FR-026)', (
    tester,
  ) async {
    await tester.pumpWidget(_Host(env: TestEnv()));
    final before = tester.getSize(find.byType(AnswerEffect));
    _controller(tester).onAnswer(correct: false);
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.getSize(find.byType(AnswerEffect)), before);
    await tester.pumpAndSettle();
  });

  testWidgets('sự kiện mới thay hiệu ứng đang chạy, không chồng chất', (
    tester,
  ) async {
    await tester.pumpWidget(_Host(env: TestEnv()));
    final controller = _controller(tester);

    controller.onAnswer(correct: true);
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const Key('answer-effect-correct')), findsOneWidget);

    controller.onAnswer(correct: false);
    await tester.pump();
    // Chỉ còn một lớp, và là hiệu ứng của sự kiện mới.
    expect(find.byKey(const Key('answer-effect-correct')), findsNothing);
    expect(find.byKey(const Key('answer-effect-incorrect')), findsOneWidget);
    expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);
    await tester.pumpAndSettle();
  });
}
