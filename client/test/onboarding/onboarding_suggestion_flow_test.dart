import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Gợi ý kỹ năng theo thời gian ở onboarding (spec 007, US1, T029, FR-021…024): điền sẵn kèm nhãn,
// không ghi đè lựa chọn đã chỉnh mà chỉ mời "Áp dụng / Giữ nguyên".

const Map<String, Object?> _studyDefaults = <String, Object?>{
  'practiceMinDailyMinutes': 30,
  'items': <Object?>[
    <String, Object?>{
      'dailyMinutes': 5,
      'skills': <String>['vocabulary'],
    },
    <String, Object?>{
      'dailyMinutes': 10,
      'skills': <String>['vocabulary', 'grammar'],
    },
    <String, Object?>{
      'dailyMinutes': 15,
      'skills': <String>['vocabulary', 'grammar', 'kanji'],
    },
    <String, Object?>{
      'dailyMinutes': 30,
      'skills': <String>[
        'vocabulary',
        'grammar',
        'kanji',
        'reading',
        'writing',
      ],
    },
  ],
};

Future<TestEnv> _open(
  WidgetTester tester, {
  FakeResponse studyDefaults = const FakeResponse(200, _studyDefaults),
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend);
  env.backend.on('GET /study-defaults', (_) => studyDefaults);
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

/// Đi tới bước thời gian (đã chọn trình độ và mục tiêu).
Future<void> _toTimeStep(WidgetTester tester) async {
  await _tap(tester, 'level-none');
  await _tap(tester, 'next');
  await _tap(tester, 'goal-daily_conversation');
  await _tap(tester, 'next');
}

bool _checked(WidgetTester tester, String skill) =>
    tester.widget<CheckboxListTile>(find.byKey(Key('skill-$skill'))).value ??
    false;

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

void main() {
  testWidgets(
    'chọn 10 phút ⇒ bước kỹ năng điền sẵn Từ vựng + Ngữ pháp kèm nhãn gợi ý',
    (tester) async {
      await _open(tester);
      await _toTimeStep(tester);
      await _tap(tester, 'minutes-10');
      await _tap(tester, 'next'); // → mốc thời gian
      await _tap(tester, 'next'); // → kỹ năng

      expect(_checked(tester, 'vocabulary'), isTrue);
      expect(_checked(tester, 'grammar'), isTrue);
      expect(_checked(tester, 'kanji'), isFalse);
      expect(find.text('Gợi ý theo thời gian bạn có'), findsOneWidget);
      expect(_has('suggestion-invite'), isFalse);
    },
  );

  testWidgets(
    'đổi sang 15 khi chưa chỉnh ⇒ điền thêm Kanji, không có lời mời',
    (tester) async {
      await _open(tester);
      await _toTimeStep(tester);
      await _tap(tester, 'minutes-10');
      await _tap(tester, 'minutes-15');
      await _tap(tester, 'next');
      await _tap(tester, 'next');

      expect(_checked(tester, 'vocabulary'), isTrue);
      expect(_checked(tester, 'grammar'), isTrue);
      expect(_checked(tester, 'kanji'), isTrue);
      expect(find.text('Gợi ý theo thời gian bạn có'), findsOneWidget);
      expect(_has('suggestion-invite'), isFalse);
    },
  );

  testWidgets(
    'đã chỉnh tay rồi đổi sang 30 ⇒ giữ nguyên lựa chọn và hiện lời mời; Áp dụng thì điền gợi ý',
    (tester) async {
      await _open(tester);
      await _toTimeStep(tester);
      await _tap(tester, 'minutes-15');
      await _tap(tester, 'next');
      await _tap(tester, 'next');
      // Bỏ Ngữ pháp: lựa chọn riêng của người học.
      await _tap(tester, 'skill-grammar');
      expect(_checked(tester, 'grammar'), isFalse);
      // Nhãn "gợi ý" biến mất khi người học đã chỉnh.
      expect(find.text('Gợi ý theo thời gian bạn có'), findsNothing);

      await _tap(tester, 'back'); // → mốc thời gian
      await _tap(tester, 'back'); // → thời gian
      await _tap(tester, 'minutes-30');
      await _tap(tester, 'next');
      await _tap(tester, 'next');

      // Không bị ghi đè ngầm.
      expect(_checked(tester, 'vocabulary'), isTrue);
      expect(_checked(tester, 'grammar'), isFalse);
      expect(_checked(tester, 'kanji'), isTrue);
      expect(_has('suggestion-invite'), isTrue);
      expect(find.text('Gợi ý mới cho 30 phút'), findsOneWidget);
      expect(find.text('Áp dụng'), findsOneWidget);
      expect(find.text('Giữ nguyên'), findsOneWidget);

      await _tap(tester, 'suggestion-apply');
      expect(_checked(tester, 'grammar'), isTrue);
      expect(_has('suggestion-invite'), isFalse);
    },
  );

  testWidgets('"Giữ nguyên" ẩn lời mời và giữ lựa chọn của người học', (
    tester,
  ) async {
    await _open(tester);
    await _toTimeStep(tester);
    await _tap(tester, 'minutes-10');
    await _tap(tester, 'next');
    await _tap(tester, 'next');
    await _tap(
      tester,
      'skill-kanji',
    ); // đã chỉnh: thêm Kanji ngoài gợi ý 10 phút
    await _tap(tester, 'back');
    await _tap(tester, 'back');
    await _tap(tester, 'minutes-5');
    await _tap(tester, 'next');
    await _tap(tester, 'next');

    expect(_has('suggestion-invite'), isTrue);
    await _tap(tester, 'suggestion-keep');
    expect(_has('suggestion-invite'), isFalse);
    expect(_checked(tester, 'vocabulary'), isTrue);
    expect(_checked(tester, 'grammar'), isTrue);
    expect(_checked(tester, 'kanji'), isTrue);
  });

  testWidgets('hoàn tất mà chỉ đổi thời gian ⇒ gửi đúng bộ gợi ý', (
    tester,
  ) async {
    final env = await _open(tester);
    await _toTimeStep(tester);
    await _tap(tester, 'minutes-15');
    await _tap(tester, 'next');
    await _tap(tester, 'next');
    await _tap(tester, 'next'); // → kiểm tra trình độ
    await _tap(tester, 'finish');

    final sent = requestJson(
      env.backend.sent('POST /onboarding/complete').single,
    );
    expect(sent['dailyMinutes'], 15);
    expect(sent['skills'], <String>['vocabulary', 'grammar', 'kanji']);
  });

  testWidgets('lỗi tải bảng gợi ý ⇒ không điền, màn vẫn dùng được', (
    tester,
  ) async {
    await _open(
      tester,
      studyDefaults: const FakeResponse(500, <String, Object?>{
        'code': 'INTERNAL',
        'message': 'Lỗi máy chủ',
      }),
    );
    await _toTimeStep(tester);
    await _tap(tester, 'minutes-10');
    await _tap(tester, 'next');
    await _tap(tester, 'next');

    expect(_checked(tester, 'vocabulary'), isFalse);
    expect(find.text('Gợi ý theo thời gian bạn có'), findsNothing);
    await _tap(tester, 'skill-vocabulary');
    expect(_checked(tester, 'vocabulary'), isTrue);
  });
}
