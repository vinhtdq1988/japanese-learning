import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import '../test/support/fake_backend.dart';
import '../test/support/learning_scenario.dart';

// Luồng US1 đầu-cuối trên client (T057, quickstart K1): đăng ký → onboarding (bỏ qua kiểm tra trình độ)
// → thấy "Hôm nay" với tổng ước tính trong quỹ thời gian.
//
// Chạy trên Chrome: `flutter drive --driver=test_driver/integration_test.dart
// --target=integration_test/us1_onboarding_test.dart -d chrome` (cần chromedriver; `flutter test -d chrome`
// chưa hỗ trợ integration_test). Cùng kịch bản cũng chạy được như widget test thường bằng cách chép
// file này vào `test/` và đổi đường dẫn import `../test/support/` thành `support/`.
// Máy chủ là bản giả ở tầng HTTP nên bài kiểm thử không cần backend; logic thật của server được kiểm
// thử ở `backend/tests`.

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('đăng ký → onboarding bỏ qua kiểm tra → thấy "Hôm nay"', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv();
    LearningScenario(env.backend);

    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();

    // Trang đầu cho khách → Đăng ký.
    await _tap(tester, 'landing-register');
    await tester.enterText(find.byKey(const Key('displayName')), 'An');
    await tester.enterText(find.byKey(const Key('email')), 'an@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'Matkhau-123');
    await _tap(tester, 'submit');

    // Đã đăng nhập, chưa có lộ trình → onboarding.
    expect(find.text('Thiết lập lộ trình'), findsWidgets);

    // Chưa biết gì · giao tiếp hằng ngày · 10 phút · không mốc · từ vựng + ngữ pháp.
    await _tap(tester, 'level-none');
    await _tap(tester, 'next');
    await _tap(tester, 'goal-daily_conversation');
    await _tap(tester, 'next');
    await _tap(tester, 'minutes-10');
    await _tap(tester, 'next');
    await _tap(tester, 'next');
    await _tap(tester, 'skill-vocabulary');
    await _tap(tester, 'skill-grammar');
    await _tap(tester, 'next');

    // Bỏ qua kiểm tra trình độ và bắt đầu học.
    await _tap(tester, 'finish');

    expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    expect(find.text('Ước tính 10/10 phút'), findsOneWidget);
    expect(find.text('Chào hỏi'), findsOneWidget);

    // Lộ trình cá nhân bắt đầu từ nền tảng người mới.
    await _tap(tester, 'open-path');
    expect(find.text('Lộ trình của bạn'), findsOneWidget);
    expect(find.byKey(const Key('unit-u1')), findsOneWidget);
  });

  testWidgets('đăng nhập lại sau khi đã onboarding → vào thẳng "Hôm nay"', (
    tester,
  ) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv();
    LearningScenario(env.backend).onboarded = true;

    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();
    await _tap(tester, 'landing-login');
    await tester.enterText(find.byKey(const Key('email')), 'an@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'Matkhau-123');
    await _tap(tester, 'submit');

    expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
  });
}
