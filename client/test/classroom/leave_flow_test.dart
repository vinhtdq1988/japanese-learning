import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/data/account_repository.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Rời lớp / chuyển sang lộ trình cá nhân (spec 004, US6, T111, FR-037, SC-013): tối đa 3 thao tác không tính
// bước xác nhận, điều khiển cá nhân mở lại ngay (Me làm mới), không hiện thông báo "bị gỡ" khi tự rời lớp, và
// cảnh báo xóa tài khoản của người đang thuộc lớp nêu việc phải được mời lại.

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
      'lockedFields': <String>['dailyMinutes', 'skills'],
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
    'dailyMinutes': 10,
  },
  'assignments': <Object?>[],
  'movedNotice': null,
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

String _location(WidgetTester tester) => GoRouter.of(
  tester.element(find.byType(Scaffold).first),
).routeInformationProvider.value.uri.toString();

class _Opened {
  _Opened(this.env);
  final TestEnv env;
  bool inClass = true;
}

Future<_Opened> _open(WidgetTester tester, String route) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final opened = _Opened(TestEnv(tokens: signedInTokens()));
  final backend = opened.env.backend;
  LearningScenario(backend).onboarded = true;
  backend.on('GET /me', (_) => FakeResponse(200, _me(inClass: opened.inClass)));
  backend.on(
    'GET /me/class',
    (_) => opened.inClass
        ? FakeResponse(200, _myClass())
        : const FakeResponse(404, <String, Object?>{
            'code': 'NOT_FOUND',
            'message': 'Không tìm thấy tài nguyên',
          }),
  );
  backend.on('POST /me/class/leave', (_) {
    opened.inClass = false;
    return const FakeResponse(204);
  });
  await tester.pumpWidget(opened.env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return opened;
}

void main() {
  group('rời lớp', () {
    testWidgets(
      'từ Hôm nay: mở Lớp của tôi (1) → Rời lớp (2) → xác nhận ⇒ về lộ trình cá nhân; nguồn học làm mới ngay',
      (tester) async {
        final opened = await _open(tester, '/today');
        expect(find.byKey(const Key('class-source-banner')), findsOneWidget);

        // Thao tác 1: "Mở lớp của tôi" từ nhãn nguồn lớp.
        await tester.tap(find.byKey(const Key('class-source-open')));
        await tester.pumpAndSettle();
        expect(_location(tester), '/my-class');
        // Thao tác 2: nút rời lớp; hộp thoại giải thích hậu quả (bước xác nhận không tính vào 3 thao tác).
        await tester.tap(find.byKey(const Key('my-class-leave')));
        await tester.pumpAndSettle();
        expect(find.text('Rời lớp?'), findsOneWidget);
        expect(
          find.textContaining('lịch sử học của bạn được giữ nguyên'),
          findsOneWidget,
        );
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Chuyển sang lộ trình cá nhân (rời lớp)'),
          ),
        );
        await tester.pumpAndSettle();

        // Đúng MỘT yêu cầu rời lớp, rồi quay về Hôm nay.
        expect(opened.env.backend.sent('POST /me/class/leave'), hasLength(1));
        expect(opened.inClass, isFalse);
        expect(_location(tester), '/today');
        // Các điều khiển cá nhân được mở lại ngay: không còn nhãn lớp, không có thông báo "bị gỡ".
        expect(find.byKey(const Key('class-source-banner')), findsNothing);
        expect(find.byKey(const Key('class-ended-banner')), findsNothing);
      },
    );

    testWidgets(
      'huỷ ở hộp thoại xác nhận: không gọi máy chủ và vẫn ở trong lớp',
      (tester) async {
        final opened = await _open(tester, '/my-class');
        await tester.tap(find.byKey(const Key('my-class-leave')));
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.byType(TextButton),
          ),
        );
        await tester.pumpAndSettle();
        expect(opened.env.backend.sent('POST /me/class/leave'), isEmpty);
        expect(opened.inClass, isTrue);
        expect(find.byKey(const Key('my-class-name')), findsOneWidget);
      },
    );
  });

  group('xóa tài khoản của người đang thuộc lớp (FR-039)', () {
    testWidgets('hồ sơ nêu rõ phải được mời lại nếu khôi phục tài khoản', (
      tester,
    ) async {
      await _open(tester, '/profile');
      await tester.scrollUntilVisible(
        find.byKey(const Key('profile-delete-class-notice')),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('mời lại'), findsWidgets);
    });

    testWidgets('người học không thuộc lớp không thấy cảnh báo lớp', (
      tester,
    ) async {
      final opened = await _open(tester, '/today');
      opened.inClass = false;
      ProviderScope.containerOf(
        tester.element(find.byType(Scaffold).first),
      ).invalidate(meProvider);
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/profile');
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('profile-delete-class-notice')),
        findsNothing,
      );
    });
  });
}
