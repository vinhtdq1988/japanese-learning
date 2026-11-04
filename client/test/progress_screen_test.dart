import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Màn hình tiến độ (T087, US4, SC-007): số liệu do server tính, trạng thái trống thân thiện, đúng/chậm
// tiến độ, điểm yếu, và vào được từ "Hôm nay" trong ≤ 2 lần nhấp.

Map<String, Object?> _summary({
  bool isEmpty = false,
  Object? onTrack = true,
  String? targetDate = '2026-01-25',
  Object? scopeNotice,
  List<Map<String, Object?>> weakTopics = const <Map<String, Object?>>[],
  Object? reviewAccuracy = 0.75,
}) => <String, Object?>{
  'isEmpty': isEmpty,
  'totalMinutes': isEmpty ? 0 : 16.5,
  'lessonsCompleted': isEmpty ? 0 : 3,
  'reviewAccuracy': isEmpty ? null : reviewAccuracy,
  'currentStreakDays': isEmpty ? 0 : 4,
  'goal': <String, Object?>{
    'completionRatio': isEmpty ? 0 : 0.5,
    'onTrack': isEmpty ? null : onTrack,
    'targetDate': isEmpty ? null : targetDate,
    'scopeNotice': scopeNotice,
  },
  'weakTopics': weakTopics,
};

Future<TestEnv> _open(
  WidgetTester tester, {
  required Map<String, Object?> summary,
  String route = '/progress',
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /progress', 200, summary);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

void main() {
  testWidgets('hiển thị thời gian, số bài, độ chính xác ôn và chuỗi ngày', (
    tester,
  ) async {
    await _open(tester, summary: _summary());
    expect(find.byKey(const Key('metric-time')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('metric-time')),
        matching: find.text('16,5 phút'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('metric-lessons')),
        matching: find.text('3'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('metric-review')),
        matching: find.text('75%'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('metric-streak')),
        matching: find.text('4 ngày'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('tiến độ mục tiêu: tỷ lệ hoàn thành, mốc và đúng tiến độ', (
    tester,
  ) async {
    await _open(tester, summary: _summary());
    expect(find.textContaining('50%'), findsWidgets);
    expect(_has('goal-completion'), isTrue);
    expect(_has('goal-target-date'), isTrue);
    expect(_has('goal-on-track'), isTrue);
    expect(_has('goal-behind'), isFalse);
  });

  testWidgets('chậm tiến độ được nói rõ kèm gợi ý', (tester) async {
    await _open(tester, summary: _summary(onTrack: false));
    expect(_has('goal-behind'), isTrue);
    expect(_has('goal-on-track'), isFalse);
    expect(find.textContaining('chậm tiến độ'), findsOneWidget);
  });

  testWidgets('chưa có mốc thời gian: gợi ý đặt mốc thay vì đúng/chậm', (
    tester,
  ) async {
    await _open(tester, summary: _summary(onTrack: null, targetDate: null));
    expect(_has('goal-no-deadline'), isTrue);
    expect(_has('goal-on-track'), isFalse);
    expect(_has('goal-behind'), isFalse);
    expect(_has('goal-target-date'), isFalse);
  });

  testWidgets('nội dung chỉ đến N3: hiện thông báo phạm vi trong mục tiêu', (
    tester,
  ) async {
    await _open(tester, summary: _summary(scopeNotice: 'content_ceiling_n3'));
    expect(_has('scope-notice'), isTrue);
  });

  testWidgets('chưa ôn lần nào: độ chính xác ôn hiển thị là chưa có', (
    tester,
  ) async {
    await _open(tester, summary: _summary(reviewAccuracy: null));
    expect(
      find.descendant(
        of: find.byKey(const Key('metric-review')),
        matching: find.text('Chưa ôn lần nào'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('điểm yếu được liệt kê kèm tên mảng và độ chính xác', (
    tester,
  ) async {
    await _open(
      tester,
      summary: _summary(
        weakTopics: <Map<String, Object?>>[
          <String, Object?>{'topicId': 't1', 'name': 'Trợ từ', 'accuracy': 0.4},
          <String, Object?>{
            'topicId': 't2',
            'name': 'Số đếm',
            'accuracy': 0.55,
          },
        ],
      ),
    );
    expect(_has('weak-topic-t1'), isTrue);
    expect(_has('weak-topic-t2'), isTrue);
    expect(find.text('Trợ từ'), findsOneWidget);
    expect(find.text('Đúng 40% gần đây'), findsOneWidget);
    expect(_has('weak-none'), isFalse);
  });

  testWidgets('không có điểm yếu: lời nhắn khích lệ', (tester) async {
    await _open(tester, summary: _summary());
    expect(_has('weak-none'), isTrue);
  });

  testWidgets('người học mới: trạng thái trống thân thiện, không phải lỗi', (
    tester,
  ) async {
    await _open(tester, summary: _summary(isEmpty: true));
    expect(_has('progress-empty'), isTrue);
    expect(find.text('Bạn chưa có tiến độ nào'), findsOneWidget);
    expect(_has('metric-time'), isFalse);

    await tester.tap(find.byKey(const Key('progress-go-today')));
    await tester.pumpAndSettle();
    expect(_has('today-time-summary'), isTrue);
  });

  testWidgets('lỗi tải hiển thị thông báo và nút thử lại', (tester) async {
    TestEnv.useDesktopSize(tester);
    addTearDown(tester.view.reset);
    final env = TestEnv(tokens: signedInTokens());
    LearningScenario(env.backend).onboarded = true;
    var fail = true;
    env.backend.on('GET /progress', (_) {
      if (fail) {
        return const FakeResponse(500, <String, Object?>{
          'code': 'INTERNAL_ERROR',
          'message': 'Lỗi hệ thống',
        });
      }
      return FakeResponse(200, _summary());
    });
    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/progress');
    await tester.pumpAndSettle();
    expect(find.text('Thử lại'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(_has('metric-time'), isTrue);
  });

  testWidgets('từ "Hôm nay" vào tiến độ trong ≤ 2 lần nhấp (SC-007)', (
    tester,
  ) async {
    final env = await _open(tester, summary: _summary(), route: '/today');
    // Một lần nhấp: nút "Xem tiến độ" ngay trên màn hình, hoặc mục "Tiến độ" trên thanh điều hướng.
    await tester.tap(find.byKey(const Key('open-progress')));
    await tester.pumpAndSettle();
    expect(_has('metric-time'), isTrue);
    expect(env.backend.sent('GET /progress'), isNotEmpty);

    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Tiến độ').first);
    await tester.pumpAndSettle();
    expect(_has('metric-time'), isTrue);
  });
}
