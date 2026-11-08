import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/sound_player.dart';

import '../support/fake_backend.dart';
import '../support/lesson_scenario.dart';

// Hiệu ứng ở bài học và ôn tập (spec 005, US1): mỗi kết quả MỚI từ server gọi đúng một lần onAnswer;
// kết quả trùng/khôi phục không phát lại; phản hồi vẫn rõ ràng khi không có màu/âm; không chặn "Tiếp tục".

class _Harness {
  _Harness(this.tester, this.env, this.scenario);

  final WidgetTester tester;
  final TestEnv env;
  final LessonScenario scenario;

  List<SoundCue> get played => env.soundPlayer.played;

  Future<void> tap(String key) async {
    final finder = find.byKey(Key(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  bool has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

  Future<void> leave() async {
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
    await tester.pumpAndSettle();
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump(const Duration(seconds: 1));
  }

  Future<void> answerFillBlank(String text) async {
    await tester.enterText(find.byKey(const Key('fill-blank-input')), text);
    await tester.pump();
    await tap('submit-answer');
  }

  Future<void> answerMatching({required bool correct}) async {
    await tap('match-left-0');
    await tap(correct ? 'match-right-1' : 'match-right-0');
    await tap('match-left-1');
    await tap(correct ? 'match-right-0' : 'match-right-1');
    await tap('submit-answer');
  }

  /// Mở màn bài học của [itemKey] ("start-item-1" → bỏ qua phần giải thích nếu có).
  Future<void> start(String itemKey) async {
    await tap(itemKey);
    if (has('start-exercises')) await tap('start-exercises');
  }
}

Future<_Harness> _open(
  WidgetTester tester, {
  void Function(LessonScenario)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LessonScenario(env.backend);
  setup?.call(scenario);
  await tester.pumpWidget(
    ProviderScope(overrides: env.overrides, child: const JapaneseLearningApp()),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
  return _Harness(tester, env, scenario);
}

void main() {
  testWidgets(
    'trắc nghiệm, điền chỗ trống, ghép cặp và hỏi lại: mỗi lần nộp đúng một cue',
    (tester) async {
      final h = await _open(tester);
      await h.start('start-item-1');

      await h.tap('choice-0'); // sai
      expect(h.played, <SoundCue>[SoundCue.incorrect]);
      await h.tap('continue');

      await h.answerFillBlank('は'); // đúng
      expect(h.played, <SoundCue>[SoundCue.incorrect, SoundCue.correct]);
      await h.tap('continue');

      // Ghép cặp: MỘT hiệu ứng cho mỗi lần "Kiểm tra" (research E16), không phải cho từng cặp.
      await h.answerMatching(correct: true);
      expect(h.played, hasLength(3));
      expect(h.played.last, SoundCue.correct);
      await h.tap('continue');

      // Lượt hỏi lại cũng có phản hồi đúng/sai thường.
      expect(h.has('retry-heading'), isTrue);
      await h.tap('choice-1');
      expect(h.played, hasLength(4));
      expect(h.played.last, SoundCue.correct);
      await h.leave();
    },
  );

  testWidgets('phiên ôn tập cũng phát cue theo kết quả', (tester) async {
    final h = await _open(tester, setup: (s) => s.addReviewBatch());
    await h.start('start-item-review');
    await h.tap('choice-1'); // đúng
    expect(h.played, <SoundCue>[SoundCue.correct]);
    await h.leave();
  });

  testWidgets('kết quả duplicate=true KHÔNG phát lại hiệu ứng', (tester) async {
    final h = await _open(tester);
    h.env.backend.on(
      'POST /sessions/session-item-1/answers',
      (_) => const FakeResponse(200, <String, Object?>{
        'isCorrect': true,
        'feedback': 'Đúng rồi!',
        'duplicate': true,
      }),
    );
    await h.start('start-item-1');
    await h.tap('choice-1');
    expect(h.has('feedback-correct'), isTrue); // kết quả vẫn hiện
    expect(h.played, isEmpty);
    await h.leave();
  });

  testWidgets('khôi phục phiên dở dang không phát hiệu ứng', (tester) async {
    final h = await _open(
      tester,
      setup: (s) {
        s.answered['session-item-1'] = <String, bool>{'ex-1': true};
        s.itemStatus['item-1'] = 'in_progress';
      },
    );
    await h.start('start-item-1');
    expect(find.text('Câu 2/3'), findsOneWidget);
    expect(h.played, isEmpty);
    await h.leave();
  });

  testWidgets('mất kết nối rồi gửi lại: hiệu ứng chỉ phát khi có kết quả', (
    tester,
  ) async {
    final h = await _open(tester);
    await h.start('start-item-1');
    h.scenario.offline = true;
    await h.tap('choice-1');
    expect(h.has('offline-banner'), isTrue);
    expect(h.played, isEmpty); // chưa có kết quả → chưa có hiệu ứng

    h.scenario.offline = false;
    await h.tap('retry-send');
    expect(h.has('feedback-correct'), isTrue);
    expect(h.played, <SoundCue>[SoundCue.correct]);
    await h.leave();
  });

  testWidgets(
    'thẻ phản hồi có biểu tượng + chữ và là vùng thông báo trực tiếp',
    (tester) async {
      final h = await _open(tester);
      await h.start('start-item-1');

      await h.tap('choice-0'); // sai
      final wrong = find.byKey(const Key('feedback'));
      expect(
        find.descendant(
          of: wrong,
          matching: find.byIcon(Icons.cancel_outlined),
        ),
        findsOneWidget,
      );
      expect(find.byKey(const Key('feedback-incorrect')), findsOneWidget);
      expect(find.text('Chưa đúng'), findsOneWidget);
      // Đáp án đúng + giải thích vẫn hiện (FR-003).
      expect(find.byKey(const Key('correct-answer')), findsOneWidget);
      expect(find.text('Chưa đúng.'), findsOneWidget);

      final live = find.ancestor(
        of: wrong,
        matching: find.byWidgetPredicate(
          (w) => w is Semantics && (w.properties.liveRegion ?? false),
        ),
      );
      expect(live, findsWidgets);

      await h.tap('continue');
      await h.answerFillBlank('は'); // đúng
      expect(
        find.descendant(
          of: find.byKey(const Key('feedback')),
          matching: find.byIcon(Icons.check_circle),
        ),
        findsOneWidget,
      );
      await h.leave();
    },
  );

  testWidgets('"Tiếp tục" bấm được ngay khi hiệu ứng đang chạy (FR-004)', (
    tester,
  ) async {
    final h = await _open(tester);
    await h.start('start-item-1');

    await tester.tap(find.byKey(const Key('choice-1')));
    await tester.pump(); // gửi
    await tester.pump(
      const Duration(milliseconds: 20),
    ); // kết quả về, hiệu ứng vừa bắt đầu
    expect(h.has('feedback-correct'), isTrue);
    expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);

    await tester.tap(find.byKey(const Key('continue')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(
      find.text('Câu 2/3'),
      findsOneWidget,
    ); // sang câu kế, không phải chờ hiệu ứng
    await tester.pumpAndSettle();
    await h.leave();
  });

  testWidgets(
    'SC-001: hiệu ứng bắt đầu cùng khung hình với kết quả (≤ 0,2 s), kể cả khi mạng chậm',
    (tester) async {
      final h = await _open(tester);
      await h.start('start-item-1');
      final inner =
          h.env.backend.routes['POST /sessions/session-item-1/answers']!;
      h.env.backend.on('POST /sessions/session-item-1/answers', (r) async {
        await Future<void>.delayed(const Duration(milliseconds: 300));
        return inner(r);
      });

      await tester.tap(find.byKey(const Key('choice-1')));
      var elapsed = Duration.zero;
      while (!h.has('feedback-correct')) {
        await tester.pump(const Duration(milliseconds: 10));
        elapsed += const Duration(milliseconds: 10);
        expect(elapsed, lessThan(const Duration(seconds: 2)));
      }
      // Ngay ở khung hình đầu tiên có kết quả, lớp hiệu ứng và cue đã có.
      expect(find.byKey(const Key('answer-effect-layer')), findsOneWidget);
      expect(h.played, <SoundCue>[SoundCue.correct]);
      await tester.pumpAndSettle();
      await h.leave();
    },
  );

  testWidgets('lỗi nền tảng âm thanh không hiện cho người học (FR-024)', (
    tester,
  ) async {
    final h = await _open(tester);
    h.env.soundPlayer.throwOnPlay = true;
    await h.start('start-item-1');
    await h.tap('choice-1');
    expect(h.has('feedback-correct'), isTrue);
    expect(h.has('lesson-error'), isFalse);
    expect(tester.takeException(), isNull);
    await h.leave();
  });

  testWidgets('prime() được gọi trong thao tác nộp đáp án (FR-025)', (
    tester,
  ) async {
    final h = await _open(tester);
    await h.start('start-item-1');
    expect(h.env.soundPlayer.primeCount, 0);
    await h.tap('choice-1');
    expect(h.env.soundPlayer.primeCount, greaterThanOrEqualTo(1));
    await h.leave();
  });
}
