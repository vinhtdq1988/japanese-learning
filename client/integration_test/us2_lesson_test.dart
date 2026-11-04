import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_controller.dart';

import '../test/support/fake_backend.dart';
import '../test/support/lesson_scenario.dart';

// Luồng US2 đầu-cuối trên client (T072, quickstart K3): từ "Hôm nay" học từng đơn vị (giải thích → bài tập
// → hỏi lại câu sai → tóm tắt) đến khi ngày được đánh dấu hoàn thành, rồi "Học thêm".
//
// Chạy trên Chrome: `flutter drive --driver=test_driver/integration_test.dart
// --target=integration_test/us2_lesson_test.dart -d chrome` (cần chromedriver). Cùng kịch bản cũng chạy được
// bằng `flutter test integration_test/us2_lesson_test.dart`. Máy chủ là bản giả ở tầng HTTP; logic thật
// của server được kiểm thử ở `backend/tests` (kể cả hai cửa sổ đồng thời).

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Trả lời hết ba câu của phiên giả: trắc nghiệm (cố ý sai nếu [wrongFirst]), điền từ, ghép cặp.
Future<void> _answerAll(WidgetTester tester, {required bool wrongFirst}) async {
  await _tap(tester, wrongFirst ? 'choice-0' : 'choice-1');
  await _tap(tester, 'continue');

  await tester.enterText(find.byKey(const Key('fill-blank-input')), 'は');
  await tester.pump();
  await _tap(tester, 'submit-answer');
  await _tap(tester, 'continue');

  await _tap(tester, 'match-left-0');
  await _tap(tester, 'match-right-1');
  await _tap(tester, 'match-left-1');
  await _tap(tester, 'match-right-0');
  await _tap(tester, 'submit-answer');
  await _tap(tester, 'continue');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('học hết kế hoạch hôm nay → ngày hoàn thành → học thêm', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv(tokens: signedInTokens());
    final scenario = LessonScenario(env.backend);
    var now = DateTime.utc(2026, 1, 5, 8);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          ...env.overrides,
          lessonClockProvider.overrideWithValue(
            () => now = now.add(const Duration(seconds: 9)),
          ),
        ],
        child: const JapaneseLearningApp(),
      ),
    );
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
    await tester.pumpAndSettle();

    // Đơn vị 1: sai câu đầu → được hỏi lại một lần ở cuối phiên.
    await _tap(tester, 'start-item-1');
    await _tap(tester, 'start-exercises');
    await _answerAll(tester, wrongFirst: true);
    expect(find.byKey(const Key('retry-heading')), findsOneWidget);
    await _tap(tester, 'choice-1');
    await _tap(tester, 'continue');
    expect(find.byKey(const Key('summary-heading')), findsOneWidget);
    await _tap(tester, 'back-to-today');
    expect(find.byKey(const Key('day-completed')), findsNothing);

    // Đơn vị 2: trả lời đúng hết → mục cuối cùng nên ngày được đánh dấu hoàn thành.
    await _tap(tester, 'start-item-2');
    await _tap(tester, 'start-exercises');
    await _answerAll(tester, wrongFirst: false);
    expect(find.byKey(const Key('summary-day-done')), findsOneWidget);
    await _tap(tester, 'back-to-today');
    expect(find.byKey(const Key('day-completed')), findsOneWidget);
    expect(scenario.dayCompleted, isTrue);

    // Học thêm: mở đơn vị ngoài kế hoạch, kế hoạch mặc định không đổi.
    await _tap(tester, 'study-more');
    expect(find.byKey(const Key('start-exercises')), findsOneWidget);
    await _tap(tester, 'start-exercises');
    await _answerAll(tester, wrongFirst: false);
    await _tap(tester, 'back-to-today');
    expect(find.byKey(const Key('day-completed')), findsOneWidget);
    expect(scenario.itemStatus.keys, <String>['item-1', 'item-2']);
    expect(scenario.completedSessions, contains('session-extra'));

    // Rời màn hình: cho khoảng thời gian học cuối cùng được gửi trước khi cây widget bị hủy.
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
  });
}
