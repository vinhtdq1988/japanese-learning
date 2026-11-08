import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Cảnh báo giấy phép cho giáo viên (spec 004, US6, T111, FR-006, FR-038): đọc từ `Me.organization.license` nên
// giáo viên — không gọi được `GET /org` — cũng thấy sắp hết hạn / ân hạn / hết hạn ở danh sách lớp và chi tiết
// lớp; khi mất quyền xem dữ liệu học chỉ còn cấu trúc lớp và nói rõ điều đó.

Map<String, Object?> _teacherMe({
  required String? licenseState,
  bool dataAccess = true,
}) => <String, Object?>{
  'id': 'user-1',
  'email': 't@example.com',
  'role': 'learner',
  'status': 'active',
  'learningSource': 'personal',
  'organization': <String, Object?>{
    'id': 'org-1',
    'name': 'Trung tâm Sakura',
    'roles': <String>['teacher'],
    'dataAccess': dataAccess,
    if (licenseState != null)
      'license': <String, Object?>{
        'state': licenseState,
        'endsOn': '2026-03-31',
        'graceEndsOn': '2026-04-07',
      },
  },
  'profile': <String, Object?>{
    'displayName': 'Cô Hana',
    'currentLevel': 'none',
    'goalType': 'daily_conversation',
    'dailyMinutes': 10,
    'skills': <String>['vocabulary'],
    'language': 'vi',
    'timezone': 'Asia/Ho_Chi_Minh',
    'paused': false,
    'onboardingState': 'completed',
  },
};

Map<String, Object?> _classDetail() => <String, Object?>{
  'id': 'class-1',
  'name': 'N5 buổi tối',
  'status': 'active',
  'memberCount': 0,
  'hasPath': true,
  'teachers': <Object?>[
    <String, Object?>{'userId': 'user-1', 'displayName': 'Cô Hana'},
  ],
  'teacherless': false,
  'absenceThresholdDays': 3,
  'createdAt': '2026-01-05T08:00:00.000Z',
};

Future<void> _open(
  WidgetTester tester,
  String route, {
  required String? licenseState,
  bool dataAccess = true,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply(
    'GET /me',
    200,
    _teacherMe(licenseState: licenseState, dataAccess: dataAccess),
  );
  env.backend.reply('GET /classes', 200, <Object?>[
    <String, Object?>{
      'id': 'class-1',
      'name': 'N5 buổi tối',
      'status': 'active',
      'memberCount': 0,
      'hasPath': true,
      'teachers': <Object?>[],
      'teacherless': false,
    },
  ]);
  env.backend.reply('GET /classes/class-1', 200, _classDetail());
  env.backend.reply('GET /classes/class-1/roster', 200, <Object?>[]);
  env.backend.reply('GET /classes/class-1/join-code', 200, <String, Object?>{
    'enabled': false,
  });
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
}

void main() {
  group('danh sách lớp của giáo viên', () {
    testWidgets('sắp hết hạn: nêu ngày hết hạn', (tester) async {
      await _open(tester, '/classes', licenseState: 'expiring');
      expect(find.byKey(const Key('staff-license-expiring')), findsOneWidget);
      expect(find.textContaining('2026-03-31'), findsOneWidget);
      expect(find.byKey(const Key('staff-data-access-off')), findsNothing);
    });

    testWidgets('trong ân hạn: nêu ngày hết ân hạn', (tester) async {
      await _open(tester, '/classes', licenseState: 'in_grace');
      expect(find.byKey(const Key('staff-license-in-grace')), findsOneWidget);
      expect(find.textContaining('2026-04-07'), findsOneWidget);
    });

    testWidgets(
      'hết hạn và mất quyền dữ liệu: cảnh báo hết hạn kèm giải thích chỉ xem được cấu trúc',
      (tester) async {
        await _open(
          tester,
          '/classes',
          licenseState: 'lapsed',
          dataAccess: false,
        );
        expect(find.byKey(const Key('staff-license-lapsed')), findsOneWidget);
        expect(find.byKey(const Key('staff-data-access-off')), findsOneWidget);
        expect(
          find.textContaining('chỉ xem được cấu trúc lớp'),
          findsOneWidget,
        );
        // Danh sách lớp vẫn hiện (cấu trúc còn xem được).
        expect(find.byKey(const Key('class-class-1')), findsOneWidget);
      },
    );

    testWidgets('giấy phép còn tốt: không có dải cảnh báo', (tester) async {
      await _open(tester, '/classes', licenseState: 'ok');
      expect(find.byKey(const Key('staff-license-banner')), findsNothing);
    });
  });

  testWidgets('chi tiết lớp cũng hiện cảnh báo giấy phép', (tester) async {
    await _open(tester, '/classes/class-1', licenseState: 'in_grace');
    expect(find.byKey(const Key('staff-license-in-grace')), findsOneWidget);
  });
}
