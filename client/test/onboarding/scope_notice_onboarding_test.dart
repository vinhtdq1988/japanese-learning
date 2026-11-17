import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Thông báo "chưa có phần nghe hiểu" sau khi hoàn tất onboarding (spec 008, T227, FR-022): chỉ hiện khi máy chủ trả
// `PathSummary.notices` (mục tiêu JLPT); người học không chọn JLPT vào thẳng "Hôm nay" như cũ.

Future<TestEnv> _open(
  WidgetTester tester, {
  required List<String> notices,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend);
  env.backend.on('POST /onboarding/complete', (r) {
    scenario.onboarded = true;
    return FakeResponse(200, <String, Object?>{
      'path': <String, Object?>{...scenario.pathSummary, 'notices': notices},
      'today': scenario.todayPlan,
    });
  });
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/onboarding');
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Đi hết các bước với mục tiêu [goal] (JLPT cần thêm cấp độ mục tiêu).
Future<void> _fillAllSteps(WidgetTester tester, {required String goal}) async {
  await _tap(tester, 'level-N4');
  await _tap(tester, 'next');
  await _tap(tester, 'goal-$goal');
  if (goal == 'jlpt') await _tap(tester, 'target-N3');
  await _tap(tester, 'next');
  await _tap(tester, 'minutes-10');
  await _tap(tester, 'next');
  await _tap(tester, 'next'); // mốc thời gian là tùy chọn
  await _tap(tester, 'skill-vocabulary');
  await _tap(tester, 'skill-grammar');
  await _tap(tester, 'next');
  await _tap(tester, 'finish');
}

void main() {
  testWidgets(
    'mục tiêu JLPT: hộp thoại nêu chưa có phần nghe hiểu rồi mới vào "Hôm nay"',
    (tester) async {
      final env = await _open(
        tester,
        notices: <String>['listening_not_available'],
      );
      await _fillAllSteps(tester, goal: 'jlpt');

      expect(env.backend.sent('POST /onboarding/complete'), hasLength(1));
      expect(find.byKey(const Key('onboarding-scope-notices')), findsOneWidget);
      expect(find.textContaining('chưa có phần nghe hiểu'), findsOneWidget);
      // Chưa vào "Hôm nay" khi chưa đóng hộp thoại.
      expect(find.text('Kế hoạch hôm nay'), findsNothing);

      await _tap(tester, 'onboarding-scope-notices-ok');
      expect(find.byKey(const Key('onboarding-scope-notices')), findsNothing);
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    },
  );

  testWidgets(
    'hộp thoại hiện cả trần N3 lẫn nghe hiểu theo đúng thứ tự máy chủ trả',
    (tester) async {
      await _open(
        tester,
        notices: <String>['content_ceiling_n3', 'listening_not_available'],
      );
      await _fillAllSteps(tester, goal: 'jlpt');

      final ceiling = find.byKey(const Key('scope-notice-contentCeilingN3'));
      final listening = find.byKey(
        const Key('scope-notice-listeningNotAvailable'),
      );
      expect(ceiling, findsOneWidget);
      expect(listening, findsOneWidget);
      expect(
        tester.getTopLeft(ceiling).dy,
        lessThan(tester.getTopLeft(listening).dy),
      );
    },
  );

  testWidgets(
    'không phải JLPT (notices rỗng): không có hộp thoại, vào thẳng "Hôm nay"',
    (tester) async {
      await _open(tester, notices: <String>[]);
      await _fillAllSteps(tester, goal: 'daily_conversation');

      expect(find.byKey(const Key('onboarding-scope-notices')), findsNothing);
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    },
  );
}
