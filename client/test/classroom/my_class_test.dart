import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// "Lớp của tôi" của học viên (spec 004, US4 T089, FR-030): khối "tiến độ trong lớp" lấy từ `MyClass.progress`
// (cùng nguồn với bảng điều khiển của giáo viên); chưa hoạt động thì hiện "chưa bắt đầu" thay cho số 0. Bài giao
// và điều chỉnh của giáo viên (US5, T101) bổ sung vào cùng file.

Map<String, Object?> _myClass({required Map<String, Object?> progress}) =>
    <String, Object?>{
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
      'progress': progress,
    };

Future<void> _open(WidgetTester tester, Map<String, Object?> progress) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /me/class', 200, _myClass(progress: progress));
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/my-class');
  await tester.pumpAndSettle();
}

void main() {
  group('khối tiến độ trong lớp', () {
    testWidgets('chưa có hoạt động: hiện "chưa bắt đầu", không hiện số 0', (
      tester,
    ) async {
      await _open(tester, <String, Object?>{
        'hasStarted': false,
        'completionRatio': 0,
        'minutesTotal': 0,
        'minutesLast7Days': 0,
        'streakDays': 0,
      });
      expect(find.byKey(const Key('my-class-progress')), findsOneWidget);
      expect(find.byKey(const Key('my-class-progress-empty')), findsOneWidget);
      expect(find.textContaining('Đã hoàn thành'), findsNothing);
    });

    testWidgets(
      'có hoạt động: hiện hoàn thành, phút, chuỗi ngày, độ chính xác',
      (tester) async {
        await _open(tester, <String, Object?>{
          'hasStarted': true,
          'completionRatio': 0.75,
          'minutesTotal': 42.5,
          'minutesLast7Days': 30,
          'reviewAccuracy': 0.8,
          'streakDays': 3,
          'lastActiveOn': '2026-01-19',
        });
        expect(find.byKey(const Key('my-class-progress-empty')), findsNothing);
        expect(find.text('Đã hoàn thành 75% lộ trình lớp'), findsOneWidget);
        expect(
          find.text('Tổng 42.5 phút · 30 phút trong 7 ngày qua'),
          findsOneWidget,
        );
        expect(find.text('Chuỗi 3 ngày'), findsOneWidget);
        expect(find.text('Độ chính xác ôn tập: 80%'), findsOneWidget);
        expect(find.text('Học gần nhất: 2026-01-19'), findsOneWidget);
      },
    );
  });

  usAssignments();
}

// --- US5 (T101): bài giao, điều chỉnh của giáo viên, tạm dừng hôm nay, nhãn bài giao ở "Hôm nay" ---

Map<String, Object?> _meInClass() => <String, Object?>{
  'id': 'user-1',
  'email': 'a@example.com',
  'role': 'learner',
  'status': 'active',
  'learningSource': 'class',
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
    'onboardingState': 'not_started',
  },
};

Map<String, Object?> _assignment(String id, String title, String state) =>
    <String, Object?>{
      'id': id,
      'batchId': 'batch-1',
      'unitId': 'unit-$id',
      'title': title,
      'dueOn': '2026-01-25',
      'state': state,
    };

Map<String, Object?> _withExtras(Map<String, Object?> extras) =>
    <String, Object?>{
      ..._myClass(
        progress: <String, Object?>{
          'hasStarted': true,
          'completionRatio': 0.5,
          'minutesTotal': 20,
          'minutesLast7Days': 20,
          'streakDays': 1,
        },
      ),
      ...extras,
    };

Future<TestEnv> _openAt(
  WidgetTester tester,
  String route,
  Map<String, Object?> myClass,
) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /me', 200, _meInClass());
  env.backend.reply('GET /me/class', 200, myClass);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

void usAssignments() {
  group('bài giao và điều chỉnh của giáo viên', () {
    testWidgets('hiện bài giao kèm hạn và trạng thái từng bài', (tester) async {
      await _openAt(
        tester,
        '/my-class',
        _withExtras(<String, Object?>{
          'assignments': <Object?>[
            _assignment('a1', 'Chào hỏi', 'pending'),
            _assignment('a2', 'Số đếm', 'overdue'),
            _assignment('a3', 'Trợ từ', 'on_time'),
            _assignment('a4', 'Động từ', 'late'),
          ],
        }),
      );
      expect(find.text('Chào hỏi · hạn 2026-01-25'), findsOneWidget);
      for (final entry in <String, String>{
        'a1': 'Chưa tới hạn',
        'a2': 'Quá hạn',
        'a3': 'Đúng hạn',
        'a4': 'Trễ hạn',
      }.entries) {
        final chip = tester.widget<Chip>(
          find.byKey(Key('my-assignment-state-${entry.key}')),
        );
        expect((chip.label as Text).data, entry.value);
      }
      expect(find.byKey(const Key('my-class-assignments-none')), findsNothing);
    });

    testWidgets('chưa có bài giao: nói rõ, không để trống', (tester) async {
      await _openAt(tester, '/my-class', _withExtras(<String, Object?>{}));
      expect(
        find.byKey(const Key('my-class-assignments-none')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('my-class-adjustments')), findsNothing);
      expect(find.byKey(const Key('my-class-paused')), findsNothing);
    });

    testWidgets(
      '"giáo viên đã điều chỉnh cho bạn": phút riêng, dời mốc, số bài miễn',
      (tester) async {
        await _openAt(
          tester,
          '/my-class',
          _withExtras(<String, Object?>{
            'teacherAdjustments': <String, Object?>{
              'dailyMinutes': 5,
              'shiftDays': 3,
              'exemptUnitIds': <Object?>['x', 'y'],
            },
          }),
        );
        expect(find.byKey(const Key('my-class-adjustments')), findsOneWidget);
        expect(find.text('Giáo viên đã điều chỉnh cho bạn'), findsOneWidget);
        expect(find.text('Thời gian học: 5 phút mỗi ngày'), findsOneWidget);
        expect(find.text('Mốc của bạn được dời 3 ngày'), findsOneWidget);
        expect(find.text('Bạn được miễn 2 bài'), findsOneWidget);
      },
    );

    testWidgets('hôm nay lớp tạm dừng: báo không bị tính là bỏ lỡ', (
      tester,
    ) async {
      await _openAt(
        tester,
        '/my-class',
        _withExtras(<String, Object?>{'pausedToday': true}),
      );
      expect(find.byKey(const Key('my-class-paused')), findsOneWidget);
      expect(find.textContaining('không bị tính là bỏ lỡ'), findsOneWidget);
    });
  });

  group('nhãn bài giao ở "Hôm nay"', () {
    testWidgets('mục bài mới trùng bài giao chưa xong được gắn nhãn kèm hạn', (
      tester,
    ) async {
      await _openAt(
        tester,
        '/today',
        _withExtras(<String, Object?>{
          'assignments': <Object?>[
            _assignment('a1', 'Chào hỏi', 'pending'),
            _assignment('a2', 'Câu danh từ với です', 'on_time'),
          ],
        }),
      );
      expect(find.byKey(const Key('assigned-item-1')), findsOneWidget);
      expect(find.text('Bài giao · hạn 2026-01-25'), findsOneWidget);
      // Bài giao đã xong đúng hạn không còn nhãn.
      expect(find.byKey(const Key('assigned-item-2')), findsNothing);
    });

    testWidgets(
      'người học không thuộc lớp không gọi GET /me/class và không có nhãn',
      (tester) async {
        TestEnv.useDesktopSize(tester);
        addTearDown(tester.view.reset);
        final env = TestEnv(tokens: signedInTokens());
        LearningScenario(env.backend).onboarded = true;
        await tester.pumpWidget(env.app());
        await tester.pumpAndSettle();
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
        await tester.pumpAndSettle();
        expect(env.backend.sent('GET /me/class'), isEmpty);
        expect(find.textContaining('Bài giao ·'), findsNothing);
      },
    );
  });
}
