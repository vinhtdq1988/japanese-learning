import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';

import '../support/fake_backend.dart';
import '../support/lesson_scenario.dart';

// Hiệu ứng không làm chậm việc học (spec 005, SC-002, FR-004): người học làm cùng một chuỗi thao tác với hiệu ứng
// bật và tắt, đồng hồ giả của kiểm thử đo thời gian ảo; không có thời gian chờ bắt bước sau khi trả lời và
// kế hoạch (thời gian ước tính, quỹ thời gian) không đổi.

/// Thời gian "đọc và nghĩ" cố định của người học trước mỗi lần trả lời.
const Duration _think = Duration(seconds: 4);

/// Thời gian tối đa cho phép từ lúc nộp đáp án đến lúc "Tiếp tục" bấm được — ngắn hơn mọi hiệu ứng (≥ 400 ms),
/// nên nếu hiệu ứng chặn thao tác thì kiểm thử sẽ đỏ.
const Duration _maxWaitAfterAnswer = Duration(milliseconds: 100);

Map<String, Object?> _me({required bool effects}) => <String, Object?>{
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
    'soundEnabled': effects,
    'visualEffectsEnabled': effects,
  },
};

class _Run {
  _Run({required this.elapsed, required this.waited, required this.todayTexts});

  /// Tổng thời gian ảo từ lúc bắt đầu bài đến lúc trả lời xong câu cuối.
  final Duration elapsed;

  /// Tổng thời gian ảo người học phải chờ giữa lúc nộp đáp án và lúc "Tiếp tục" bấm được.
  final Duration waited;

  /// Mọi chữ hiện trên màn Hôm nay (kế hoạch, thời gian ước tính) trước khi học.
  final List<String> todayTexts;
}

Future<_Run> _runPlan(WidgetTester tester, {required bool effects}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LessonScenario(env.backend);
  env.backend.reply('GET /me', 200, _me(effects: effects));
  await tester.pumpWidget(
    ProviderScope(overrides: env.overrides, child: const JapaneseLearningApp()),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();

  final todayTexts = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data ?? t.textSpan?.toPlainText() ?? '')
      .where((s) => s.isNotEmpty)
      .toList();

  Future<void> tapKey(String key) async {
    final finder = find.byKey(Key(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pump(); // một khung hình, không tiến đồng hồ ảo
  }

  bool has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

  await tapKey('start-item-1');
  await tester.pumpAndSettle();
  if (has('start-exercises')) {
    await tapKey('start-exercises');
    await tester.pumpAndSettle();
  }

  final clock = tester.binding.clock;
  final start = clock.now();
  var waited = Duration.zero;

  /// Nộp đáp án rồi bấm "Tiếp tục" ngay khi nó xuất hiện; không bao giờ đợi hiệu ứng chạy xong.
  Future<void> answerAndContinue(Future<void> Function() answer) async {
    await tester.pump(_think);
    await answer();
    // Thời gian chờ = từ lúc nộp đến lúc "Tiếp tục" xuất hiện (chỉ gồm độ trễ của backend giả, không gồm hiệu ứng).
    final submitted = clock.now();
    for (var i = 0; i < 30 && !has('continue'); i++) {
      await tester.pump(const Duration(milliseconds: 16));
    }
    expect(has('continue'), isTrue, reason: '"Tiếp tục" phải bấm được ngay sau khi có kết quả');
    waited += clock.now().difference(submitted);
    await tapKey('continue');
    await tester.pump(const Duration(milliseconds: 50));
  }

  await answerAndContinue(() => tapKey('choice-0'));
  await answerAndContinue(() async {
    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
    await tester.pump();
    await tapKey('submit-answer');
  });
  await answerAndContinue(() async {
    await tapKey('match-left-0');
    await tapKey('match-right-1');
    await tapKey('match-left-1');
    await tapKey('match-right-0');
    await tapKey('submit-answer');
  });
  // Lượt hỏi lại.
  await tester.pump(_think);
  await tapKey('choice-1');
  await tester.pump(const Duration(milliseconds: 50));
  final elapsed = clock.now().difference(start);

  // Dọn: để các hoạt ảnh còn dở kết thúc và rời màn bài học.
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
  await tester.pumpAndSettle();
  await tester.pump(const Duration(seconds: 1));
  return _Run(elapsed: elapsed, waited: waited, todayTexts: todayTexts);
}

void main() {
  testWidgets('không có thời gian chờ nào sau khi trả lời, dù hiệu ứng đang chạy', (
    tester,
  ) async {
    final run = await _runPlan(tester, effects: true);
    expect(run.waited, lessThanOrEqualTo(_maxWaitAfterAnswer * 3));
  });

  testWidgets('thời gian hoàn thành kế hoạch với hiệu ứng không tăng quá 3% so với tắt hiệu ứng', (
    tester,
  ) async {
    final off = await _runPlan(tester, effects: false);
    final on = await _runPlan(tester, effects: true);

    expect(off.elapsed, greaterThan(Duration.zero));
    expect(
      on.elapsed.inMilliseconds,
      lessThanOrEqualTo((off.elapsed.inMilliseconds * 1.03).ceil()),
      reason: 'bật ${on.elapsed}, tắt ${off.elapsed}',
    );
  });

  testWidgets('bật hay tắt hiệu ứng, kế hoạch hiển thị (kể cả thời gian ước tính) không đổi', (
    tester,
  ) async {
    final off = await _runPlan(tester, effects: false);
    final on = await _runPlan(tester, effects: true);

    expect(off.todayTexts, isNotEmpty);
    expect(on.todayTexts, off.todayTexts);
  });
}
