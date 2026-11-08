import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Màn hình lộ trình lớp của giáo viên (spec 004, US3, T078, FR-017 → FR-025): biểu mẫu mẫu, lưu bằng PUT với
// ngày dạng yyyy-MM-dd, cảnh báo vượt sức chứa (không chặn lưu) nêu rõ khối lượng/sức chứa, thông báo trần N3 và
// thông báo "có hiệu lực từ kế hoạch kế tiếp".

Map<String, Object?> _path({
  String endsOn = '2026-06-30',
  int minutes = 10,
  List<Object?> warnings = const <Object?>[],
  String? scopeNotice,
}) => <String, Object?>{
  'startLevel': 'N5',
  'targetLevel': 'N4',
  'skills': <Object?>['vocabulary', 'grammar'],
  'startsOn': '2026-01-05',
  'endsOn': endsOn,
  'dailyMinutes': minutes,
  'mode': 'template',
  'scopeNotice': scopeNotice,
  'units': <Object?>[
    <String, Object?>{
      'unitId': 'u1',
      'title': 'Chào hỏi',
      'kind': 'vocabulary',
      'level': 'N5',
      'estMinutes': 5,
      'position': 1,
      'isOpen': true,
    },
  ],
  'assignments': <Object?>[],
  'warnings': warnings,
  'contentNotices': <Object?>[],
  'updatedAt': '2026-01-05T08:00:00.000Z',
};

Future<TestEnv> _open(
  WidgetTester tester, {
  Object? existing,
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /classes/class-1/path', 200, <String, Object?>{
    'path': existing,
  });
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(
    tester.element(find.byType(Scaffold).first),
  ).go('/classes/class-1/path');
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'lớp chưa có lộ trình: hiện biểu mẫu mặc định, lưu gửi đúng PUT và báo hiệu lực kế tiếp',
    (tester) async {
      final env = await _open(
        tester,
        setup: (b) => b.on(
          'PUT /classes/class-1/path',
          (_) => FakeResponse(200, _path()),
        ),
      );
      expect(find.byKey(const Key('class-path-start-level')), findsOneWidget);
      expect(find.byKey(const Key('class-path-skill-kanji')), findsOneWidget);
      await _tap(tester, 'class-path-skill-kanji');
      await tester.tap(find.byKey(const Key('class-path-save')));
      await tester.pumpAndSettle();

      final body = requestJson(
        env.backend.sent('PUT /classes/class-1/path').single,
      );
      expect(body['startLevel'], 'N5');
      expect(body['targetLevel'], 'N4');
      expect(body['skills'], <String>['vocabulary', 'grammar', 'kanji']);
      expect(body['dailyMinutes'], 10);
      // Ngày gửi dạng yyyy-MM-dd (format: date), không phải date-time.
      expect(body['startsOn'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
      expect(body['endsOn'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
      expect(find.byKey(const Key('class-path-saved')), findsOneWidget);
      expect(find.textContaining('kế hoạch được sinh kế tiếp'), findsOneWidget);
      expect(find.textContaining('1. Chào hỏi'), findsOneWidget);
    },
  );

  testWidgets('lộ trình đã có: nạp giá trị hiện tại vào biểu mẫu', (
    tester,
  ) async {
    await _open(tester, existing: _path(minutes: 15));
    final minutes = tester.widget<SegmentedButton<int>>(
      find.byKey(const Key('class-path-minutes')),
    );
    expect(minutes.selected, <int>{15});
    expect(find.textContaining('2026-01-05'), findsOneWidget);
  });

  testWidgets(
    'cảnh báo vượt sức chứa nêu khối lượng/sức chứa và KHÔNG chặn lưu',
    (tester) async {
      await _open(
        tester,
        setup: (b) => b.reply(
          'PUT /classes/class-1/path',
          200,
          _path(
            warnings: <Object?>[
              <String, Object?>{
                'code': 'over_capacity',
                'requiredMinutes': 130,
                'capacityMinutes': 100,
              },
            ],
          ),
        ),
      );
      await _tap(tester, 'class-path-save');
      expect(find.byKey(const Key('class-path-warning')), findsOneWidget);
      expect(find.textContaining('130 phút'), findsOneWidget);
      expect(find.textContaining('100 phút'), findsOneWidget);
      // Đã lưu thành công dù có cảnh báo.
      expect(find.byKey(const Key('class-path-saved')), findsOneWidget);
    },
  );

  testWidgets('đích N2/N1: hiện thông báo trần nội dung N3 sau khi lưu', (
    tester,
  ) async {
    await _open(
      tester,
      setup: (b) => b.reply(
        'PUT /classes/class-1/path',
        200,
        _path(scopeNotice: 'content_ceiling_n3'),
      ),
    );
    await _tap(tester, 'class-path-save');
    expect(find.byKey(const Key('scope-notice')), findsOneWidget);
  });

  testWidgets('chưa chọn kỹ năng: báo lỗi phía client, không gửi yêu cầu', (
    tester,
  ) async {
    final env = await _open(tester);
    await _tap(tester, 'class-path-skill-vocabulary');
    await _tap(tester, 'class-path-skill-grammar');
    await _tap(tester, 'class-path-save');
    expect(find.text('Hãy chọn ít nhất một kỹ năng.'), findsOneWidget);
    expect(env.backend.sent('PUT /classes/class-1/path'), isEmpty);
  });

  testWidgets(
    'máy chủ từ chối (CLASS_ARCHIVED): hiện lỗi, giữ nguyên biểu mẫu',
    (tester) async {
      await _open(
        tester,
        setup: (b) =>
            b.reply('PUT /classes/class-1/path', 409, <String, Object?>{
              'code': 'CLASS_ARCHIVED',
              'message': 'Lớp đã được lưu trữ',
            }),
      );
      await _tap(tester, 'class-path-save');
      expect(find.byKey(const Key('class-path-error')), findsOneWidget);
      expect(
        find.text('Lớp đã được lưu trữ, không thể thay đổi.'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('class-path-saved')), findsNothing);
    },
  );
}
