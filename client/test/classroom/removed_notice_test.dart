import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/data/account_repository.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Thông báo khi học viên mất tư cách thành viên mà KHÔNG tự rời lớp (bị gỡ, hết seat, tổ chức hết hiệu lực) —
// spec 004, US6, T111, FR-037: nói rõ, học viên tiếp tục lộ trình cá nhân; "Lớp của tôi" giải thích và gợi ý
// cách vào lại; thông báo sau khi bị chuyển lớp (movedNotice) hiển thị ở "Lớp của tôi".

Map<String, Object?> _me({required bool inClass}) => <String, Object?>{
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
      'lockedFields': <String>['dailyMinutes'],
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
    'onboardingState': 'completed',
  },
};

Map<String, Object?> _myClass({Object? movedNotice}) => <String, Object?>{
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
    'dailyMinutes': 10,
  },
  'assignments': <Object?>[],
  'movedNotice': movedNotice,
  'placementRequest': null,
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

class _State {
  bool inClass = true;
  Object? movedNotice;
}

Future<(TestEnv, _State)> _open(WidgetTester tester, String route) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final state = _State();
  LearningScenario(env.backend).onboarded = true;
  env.backend.on(
    'GET /me',
    (_) => FakeResponse(200, _me(inClass: state.inClass)),
  );
  env.backend.on(
    'GET /me/class',
    (_) => state.inClass
        ? FakeResponse(200, _myClass(movedNotice: state.movedNotice))
        : const FakeResponse(404, <String, Object?>{
            'code': 'NOT_FOUND',
            'message': 'Không tìm thấy tài nguyên',
          }),
  );
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return (env, state);
}

void main() {
  testWidgets(
    'bị gỡ khỏi lớp giữa phiên: Hôm nay hiện thông báo nêu tên lớp, đóng được bằng "Đã hiểu"',
    (tester) async {
      final (_, state) = await _open(tester, '/today');
      expect(find.byKey(const Key('class-source-banner')), findsOneWidget);
      expect(find.byKey(const Key('class-ended-banner')), findsNothing);

      // Máy chủ đóng tư cách thành viên (gỡ/hết seat/tổ chức hết hiệu lực); lần đọc `Me` kế tiếp là cá nhân.
      state.inClass = false;
      ProviderScope.containerOf(
        tester.element(find.byType(Scaffold).first),
      ).invalidate(meProvider);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('class-source-banner')), findsNothing);
      expect(find.byKey(const Key('class-ended-banner')), findsOneWidget);
      expect(find.textContaining('N5 buổi tối'), findsWidgets);
      expect(
        find.textContaining('tiếp tục học theo lộ trình cá nhân'),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('class-ended-dismiss')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('class-ended-banner')), findsNothing);
    },
  );

  testWidgets(
    'người học chưa bao giờ thuộc lớp không thấy thông báo mất tư cách thành viên',
    (tester) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      final env = TestEnv(tokens: signedInTokens());
      LearningScenario(env.backend).onboarded = true;
      env.backend.reply('GET /me', 200, _me(inClass: false));
      await tester.pumpWidget(env.app());
      await tester.pumpAndSettle();
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('class-ended-banner')), findsNothing);
    },
  );

  testWidgets(
    'Lớp của tôi khi không còn thuộc lớp: giải thích các lý do và cách vào lại',
    (tester) async {
      final (_, state) = await _open(tester, '/my-class');
      expect(find.byKey(const Key('my-class-name')), findsOneWidget);

      state.inClass = false;
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
      await tester.pumpAndSettle();
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/my-class');
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('my-class-none')), findsOneWidget);
      expect(find.textContaining('bị gỡ khỏi lớp'), findsOneWidget);
      expect(find.textContaining('mời lại'), findsOneWidget);
    },
  );

  testWidgets('thông báo sau khi bị chuyển lớp hiện ở Lớp của tôi', (
    tester,
  ) async {
    final (_, state) = await _open(tester, '/today');
    state.movedNotice = <String, Object?>{
      'fromClassName': 'N5 buổi sáng',
      'at': '2026-01-20T08:00:00.000Z',
    };
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/my-class');
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('my-class-moved')), findsOneWidget);
    expect(find.textContaining('N5 buổi sáng'), findsOneWidget);
  });
}
