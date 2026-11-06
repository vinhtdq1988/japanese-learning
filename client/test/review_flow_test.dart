import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_controller.dart';

import 'support/fake_backend.dart';
import 'support/lesson_scenario.dart';

// Ôn tập (T080, US3): gói ôn xuất hiện trong "Hôm nay", phiên ôn vào thẳng câu hỏi (không có phần giải
// thích), phản hồi tức thì kèm ngày ôn kế tiếp, hỏi lại câu sai một lần, tóm tắt riêng.

Future<LessonScenario> _open(WidgetTester tester) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LessonScenario(env.backend)..addReviewBatch();

  var now = DateTime.utc(2026, 1, 5, 8);
  DateTime clock() => now = now.add(const Duration(seconds: 7));

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...env.overrides,
        lessonClockProvider.overrideWithValue(clock),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
  await tester.pumpAndSettle();
  return scenario;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

/// Rời màn hình để khoảng thời gian học còn lại được ghi trước khi cây widget bị hủy.
Future<void> _leave(WidgetTester tester) async {
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
  await tester.pumpAndSettle();
  await tester.pump(const Duration(milliseconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _answerMatchingCorrect(WidgetTester tester) async {
  await _tap(tester, 'match-left-0');
  await _tap(tester, 'match-right-1');
  await _tap(tester, 'match-left-1');
  await _tap(tester, 'match-right-0');
  await _tap(tester, 'submit-answer');
}

void main() {
  testWidgets('"Hôm nay" hiển thị gói ôn kèm số mục và thời lượng', (
    tester,
  ) async {
    await _open(tester);
    expect(_has('plan-item-item-review'), isTrue);
    expect(find.text('Ôn tập'), findsWidgets);
    expect(find.textContaining('3 mục ôn'), findsOneWidget);
    expect(_has('start-item-review'), isTrue);
    await _leave(tester);
  });

  testWidgets(
    'phiên ôn: vào thẳng câu hỏi, phản hồi kèm ngày ôn kế tiếp, hỏi lại câu sai, tóm tắt riêng',
    (tester) async {
      final scenario = await _open(tester);
      await _tap(tester, 'start-item-review');

      // Không có phần giải thích: vào thẳng câu hỏi đầu tiên.
      expect(_has('start-exercises'), isFalse);
      expect(find.text('Câu 1/3'), findsOneWidget);

      // Câu 1 sai → phản hồi kèm đáp án đúng và ngày ôn kế tiếp.
      await _tap(tester, 'choice-0');
      expect(_has('feedback-incorrect'), isTrue);
      expect(_has('next-review-date'), isTrue);
      expect(find.textContaining('Ôn lại vào'), findsOneWidget);
      await _tap(tester, 'continue');

      // Câu 2 đúng.
      await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
      await tester.pump();
      await _tap(tester, 'submit-answer');
      expect(_has('feedback-correct'), isTrue);
      await _tap(tester, 'continue');

      // Câu 3 (ghép cặp) đúng.
      await _answerMatchingCorrect(tester);
      await _tap(tester, 'continue');

      // Hỏi lại câu sai một lần với isRetry=true (không đổi lịch ôn).
      expect(_has('retry-heading'), isTrue);
      await _tap(tester, 'choice-1');
      await _tap(tester, 'continue');
      expect(scenario.retries.single['isRetry'], isTrue);

      // Tóm tắt riêng của phiên ôn, mục kế hoạch được đóng.
      expect(_has('review-summary-heading'), isTrue);
      expect(_has('summary-heading'), isFalse);
      expect(find.text('Bạn nhớ đúng 2/3 mục'), findsOneWidget);
      expect(scenario.completedSessions, contains('session-item-review'));

      await _tap(tester, 'back-to-today');
      expect(_has('start-item-review'), isFalse);
      expect(_has('start-item-1'), isTrue);
      await _leave(tester);
    },
  );

  Future<void> finishReview(WidgetTester tester) async {
    await _tap(tester, 'choice-1');
    await _tap(tester, 'continue');
    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
    await tester.pump();
    await _tap(tester, 'submit-answer');
    await _tap(tester, 'continue');
    await _answerMatchingCorrect(tester);
    await _tap(tester, 'continue');
  }

  testWidgets('câu ôn Kanji hiển thị chữ bằng phông Noto Sans JP theo khía cạnh', (
    tester,
  ) async {
    final scenario = await _open(tester);
    scenario.kanjiReview = true;
    await _tap(tester, 'start-item-review');

    // Câu 1 mang facet `meaning`: chữ Hán PHẢI có phông Nhật đóng gói làm phông dự phòng.
    final kanjiPrompt = tester.widget<Text>(
      find.byKey(const Key('exercise-prompt')),
    );
    expect(kanjiPrompt.data, contains('日'));
    expect(kanjiPrompt.style?.fontFamilyFallback, contains('Noto Sans JP'));

    // Theme đã đặt phông Nhật đóng gói làm phông dự phòng cho mọi chữ (FR-006): câu ôn Kanji không cần phông riêng.
    expect(kanjiPrompt.style?.fontFamilyFallback?.first, 'Noto Sans JP');
    await _leave(tester);
  });

  testWidgets(
    'tóm tắt phiên ôn Kanji: nút đánh dấu thành thạo gọi setItemMastered và cập nhật trạng thái',
    (tester) async {
      final scenario = await _open(tester);
      scenario.kanjiReview = true;
      await _tap(tester, 'start-item-review');
      await finishReview(tester);

      expect(_has('review-summary-heading'), isTrue);
      expect(_has('review-kanji'), isTrue);
      expect(find.text('日'), findsOneWidget);
      expect(find.text('Đánh dấu đã thành thạo'), findsOneWidget);
      expect(_has('master-note-it-k1'), isFalse);

      await _tap(tester, 'master-toggle-it-k1');
      expect(scenario.mastered['it-k1'], isTrue);
      expect(find.text('Bỏ đánh dấu'), findsOneWidget);
      expect(_has('master-note-it-k1'), isTrue);

      await _tap(tester, 'master-toggle-it-k1');
      expect(scenario.mastered['it-k1'], isFalse);
      expect(find.text('Đánh dấu đã thành thạo'), findsOneWidget);
      expect(_has('master-note-it-k1'), isFalse);
      await _leave(tester);
    },
  );

  testWidgets(
    'lỗi khi đánh dấu thành thạo: báo lỗi, trạng thái nút giữ nguyên',
    (tester) async {
      final scenario = await _open(tester);
      scenario
        ..kanjiReview = true
        ..masterFails = true;
      await _tap(tester, 'start-item-review');
      await finishReview(tester);

      await _tap(tester, 'master-toggle-it-k1');
      expect(_has('master-error-it-k1'), isTrue);
      expect(find.text('Đánh dấu đã thành thạo'), findsOneWidget);
      expect(scenario.mastered, isEmpty);
      await _leave(tester);
    },
  );

  testWidgets('phiên ôn không có Kanji không hiện danh sách chữ để đánh dấu', (
    tester,
  ) async {
    await _open(tester);
    await _tap(tester, 'start-item-review');
    await finishReview(tester);
    expect(_has('review-summary-heading'), isTrue);
    expect(_has('review-kanji'), isFalse);
    await _leave(tester);
  });

  testWidgets('mất kết nối lúc hoàn thành phiên ôn: không báo hoàn thành', (
    tester,
  ) async {
    final scenario = await _open(tester);
    scenario.answered['session-item-review'] = <String, bool>{
      'ex-1': true,
      'ex-2': true,
    };
    scenario.itemStatus['item-review'] = 'in_progress';
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
    await tester.pumpAndSettle();
    await _tap(tester, 'start-item-review');

    await _answerMatchingCorrect(tester);

    scenario.offline = true;
    await _tap(tester, 'continue');
    expect(_has('complete-offline'), isTrue);
    expect(_has('review-summary-heading'), isFalse);

    scenario.offline = false;
    await _tap(tester, 'retry-complete');
    expect(_has('review-summary-heading'), isTrue);
    await _leave(tester);
  });
}
