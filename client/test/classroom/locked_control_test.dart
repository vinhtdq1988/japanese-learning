import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Khóa điều khiển khi thuộc lớp (spec 004, US3, T077, FR-018, FR-021): điều chỉnh kế hoạch, hồ sơ, lộ trình,
// "Hôm nay" hiện điều khiển ở dạng khóa kèm lý do và hướng dẫn rời lớp; onboarding rút gọn; người học KHÔNG
// thuộc lớp không thấy khóa nào. Máy chủ giả chỉ mô phỏng hợp đồng.

Map<String, Object?> _me({bool inClass = true}) => <String, Object?>{
  'id': 'user-1',
  'email': 'a@example.com',
  'role': 'learner',
  'status': 'active',
  'learningSource': inClass ? 'class' : 'personal',
  if (inClass)
    'classSummary': <String, Object?>{
      'classId': 'class-1',
      'className': 'N5 buổi tối',
      'organizationName': 'Trung tâm Sakura',
      'lockedFields': <String>['dailyMinutes', 'skills', 'goalType'],
    },
  'profile': <String, Object?>{
    'displayName': 'Học viên',
    'currentLevel': 'none',
    'goalType': 'daily_conversation',
    'dailyMinutes': 10,
    'skills': <String>['vocabulary', 'grammar'],
    'language': 'vi',
    'timezone': 'Asia/Ho_Chi_Minh',
    'paused': false,
    'onboardingState': inClass ? 'not_started' : 'completed',
  },
};

Map<String, Object?> _myClass() => <String, Object?>{
  'class': <String, Object?>{
    'id': 'class-1',
    'name': 'N5 buổi tối',
    'organizationName': 'Trung tâm Sakura',
    'teachers': <Object?>[],
  },
  'joinedAt': '2026-01-05T08:00:00.000Z',
  'path': <String, Object?>{
    'startLevel': 'N5',
    'targetLevel': 'N4',
    'skills': <Object?>['vocabulary', 'grammar'],
    'startsOn': '2026-01-05',
    'endsOn': '2026-06-30',
    'dailyMinutes': 15,
  },
  'assignments': <Object?>[],
  'disclosure': <String, Object?>{
    'version': 1,
    'visible': <Object?>[],
    'notVisible': <Object?>[],
    'lockedControls': <Object?>[],
    'canLeaveAnytime': true,
    'mayBeMovedWithinOrganization': false,
  },
  'progress': <String, Object?>{
    'hasStarted': false,
    'minutesTotal': 0,
    'minutesLast7Days': 0,
    'streakDays': 0,
  },
};

Future<TestEnv> _open(
  WidgetTester tester,
  String route, {
  bool inClass = true,
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /me', 200, _me(inClass: inClass));
  env.backend.reply('GET /me/class', 200, _myClass());
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

String _location(WidgetTester tester) => GoRouter.of(
  tester.element(find.byType(Scaffold).first),
).routeInformationProvider.value.uri.toString();

void main() {
  group('điều chỉnh kế hoạch khi thuộc lớp', () {
    testWidgets(
      'mọi điều khiển lộ trình ở dạng khóa kèm lý do, hướng dẫn rời lớp và giá trị do lớp đặt',
      (tester) async {
        await _open(tester, '/path/adjust');
        expect(
          find.byKey(const Key('plan-adjust-class-managed')),
          findsOneWidget,
        );
        // 7 điều khiển bị khóa: mục tiêu, thời gian, kỹ năng, ưu tiên, tạm dừng, thành thạo, dựng lại.
        expect(find.byKey(const Key('locked-reason')), findsNWidgets(7));
        expect(find.byKey(const Key('locked-hint')), findsNWidgets(7));
        expect(find.text('Do lớp quyết định'), findsNWidgets(7));
        expect(
          find.textContaining('chuyển sang lộ trình cá nhân (rời lớp)'),
          findsNWidgets(7),
        );
        // Giá trị hiện tại do lớp đặt.
        expect(find.text('15 phút'), findsOneWidget);
        expect(find.text('vocabulary, grammar'), findsOneWidget);
        // Không có điều khiển chỉnh sửa nào của lộ trình cá nhân.
        expect(find.byKey(const Key('rebuild-path')), findsNothing);
        expect(find.byKey(const Key('pause-path')), findsNothing);
      },
    );

    testWidgets('người học KHÔNG thuộc lớp không thấy khóa nào', (
      tester,
    ) async {
      await _open(tester, '/path/adjust', inClass: false);
      expect(find.byKey(const Key('plan-adjust-class-managed')), findsNothing);
      expect(find.byKey(const Key('locked-reason')), findsNothing);
    });
  });

  group('hồ sơ, lộ trình và Hôm nay', () {
    testWidgets(
      'hồ sơ: khối kế hoạch bị khóa, không còn lối tắt điều chỉnh/nhập mã',
      (tester) async {
        await _open(tester, '/profile');
        expect(find.byKey(const Key('profile-plan-locked')), findsOneWidget);
        expect(find.byKey(const Key('profile-open-plan')), findsNothing);
        expect(find.byKey(const Key('profile-open-join')), findsNothing);
      },
    );

    testWidgets('hồ sơ người học cá nhân: có lối tắt điều chỉnh và nhập mã', (
      tester,
    ) async {
      await _open(tester, '/profile', inClass: false);
      expect(find.byKey(const Key('profile-open-plan')), findsOneWidget);
      expect(find.byKey(const Key('profile-open-join')), findsOneWidget);
      expect(find.byKey(const Key('profile-plan-locked')), findsNothing);
    });

    testWidgets('Hôm nay và Lộ trình hiện nhãn nguồn lớp; thành thạo bị khóa', (
      tester,
    ) async {
      await _open(
        tester,
        '/path',
        setup: (b) => b.reply('GET /path', 200, <String, Object?>{
          'id': 'class-1',
          'totalUnits': 1,
          'completedUnits': 0,
          'startLevel': 'N5',
          'reason': 'onboarding',
          'source': 'class',
          'items': <Object?>[
            <String, Object?>{
              'unitId': 'unit-1',
              'title': 'Chào hỏi',
              'kind': 'vocabulary',
              'level': 'N5',
              'estMinutes': 5,
              'status': 'pending',
            },
          ],
        }),
      );
      expect(find.byKey(const Key('class-source-banner')), findsOneWidget);
      expect(find.textContaining('N5 buổi tối'), findsWidgets);
      expect(find.byKey(const Key('master-unit-1')), findsNothing);
      expect(find.byKey(const Key('master-locked-unit-1')), findsOneWidget);

      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('class-source-banner')), findsOneWidget);
    });

    testWidgets('người học cá nhân không có nhãn nguồn lớp', (tester) async {
      await _open(tester, '/today', inClass: false);
      expect(find.byKey(const Key('class-source-banner')), findsNothing);
    });

    testWidgets('lớp tạm dừng: Hôm nay nêu lý do, không có nút tiếp tục', (
      tester,
    ) async {
      await _open(
        tester,
        '/today',
        setup: (b) => b.reply('GET /today', 409, <String, Object?>{
          'code': 'PATH_PAUSED',
          'message': 'Lộ trình đang tạm dừng',
        }),
      );
      expect(find.byKey(const Key('today-paused')), findsOneWidget);
      expect(find.byKey(const Key('resume-path')), findsNothing);
      expect(find.textContaining('Do lớp quyết định'), findsOneWidget);
    });
  });

  group('onboarding rút gọn trong lớp (FR-021)', () {
    testWidgets(
      'chỉ hỏi tên, ngôn ngữ, múi giờ; lưu bằng PATCH /me rồi về Lớp của tôi',
      (tester) async {
        final env = await _open(
          tester,
          '/onboarding',
          setup: (b) => b.on('PATCH /me', (_) => FakeResponse(200, _me())),
        );
        expect(find.byKey(const Key('class-onboarding')), findsOneWidget);
        // KHÔNG hỏi mục tiêu/trình độ/thời gian/kỹ năng.
        expect(find.byKey(const Key('level-none')), findsNothing);
        expect(find.byKey(const Key('goal-daily_conversation')), findsNothing);
        expect(find.byKey(const Key('minutes-10')), findsNothing);

        await tester.enterText(
          find.byKey(const Key('class-onboarding-name')),
          'Tên mới',
        );
        await tester.enterText(
          find.byKey(const Key('class-onboarding-timezone')),
          'Asia/Tokyo',
        );
        await tester.tap(find.byKey(const Key('class-onboarding-save')));
        await tester.pumpAndSettle();
        expect(
          requestJson(env.backend.sent('PATCH /me').single),
          <String, Object?>{
            'displayName': 'Tên mới',
            'language': 'vi',
            'timezone': 'Asia/Tokyo',
          },
        );
        expect(_location(tester), '/my-class');
      },
    );

    testWidgets('Lớp của tôi có lối vào thiết lập tên/ngôn ngữ/múi giờ', (
      tester,
    ) async {
      await _open(tester, '/my-class');
      await tester.ensureVisible(find.byKey(const Key('my-class-setup')));
      await tester.tap(find.byKey(const Key('my-class-setup')));
      await tester.pumpAndSettle();
      expect(_location(tester), '/onboarding');
      expect(find.byKey(const Key('class-onboarding')), findsOneWidget);
    });
  });

  testWidgets(
    'CLASS_MANAGED từ máy chủ hiện thông điệp rõ ràng (client cũ trong bộ đệm)',
    (tester) async {
      await _open(
        tester,
        '/path/adjust',
        inClass: false,
        setup: (b) => b.reply('POST /path/pause', 409, <String, Object?>{
          'code': 'CLASS_MANAGED',
          'message': 'Do lớp quyết định',
          'fields': <String, Object?>{'paused': 'do lớp quyết định'},
        }),
      );
      // Người học cá nhân mở màn hình rồi bị khóa bởi lớp ở phía máy chủ (ví dụ vừa được thêm vào lớp).
      await tester.ensureVisible(find.byKey(const Key('pause-path')));
      await tester.tap(find.byKey(const Key('pause-path')));
      await tester.pumpAndSettle();
      expect(find.textContaining('do lớp quyết định'), findsWidgets);
    },
  );
}
