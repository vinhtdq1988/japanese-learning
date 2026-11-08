import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/presentation/shared/state_views.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Bảng điều khiển lớp và chi tiết học viên (spec 004, US4, T088, FR-027 → FR-030): hiển thị số liệu theo hợp
// đồng, sắp xếp/lọc ngay trên bảng, "chưa bắt đầu" thay cho số 0 và chi tiết từng học viên. Máy chủ giả chỉ mô
// phỏng hợp đồng; quyền và số liệu thật do server kiểm.

Map<String, Object?> _row(
  String id,
  String name, {
  bool hasStarted = true,
  String status = 'on_track',
  double? completion = 0.5,
  int streak = 2,
  num minutes7 = 30,
  double? accuracy = 0.8,
  String? lastActive = '2026-01-19',
  bool pathCompleted = false,
}) => <String, Object?>{
  'userId': id,
  'displayName': name,
  'email': '$id@example.com',
  'joinedAt': '2026-01-06T03:00:00.000Z',
  'hasStarted': hasStarted,
  'pathCompleted': pathCompleted,
  'completionRatio': ?completion,
  'expectedRatio': 0.5,
  'streakDays': streak,
  'minutesLast7Days': minutes7,
  'minutesTotal': minutes7,
  'reviewAccuracy': ?accuracy,
  'lastActiveOn': ?lastActive,
  'progressStatus': status,
  'alerts': <Object?>[],
};

Map<String, Object?> _dashboard({bool teacherless = false}) =>
    <String, Object?>{
      'classId': 'class-1',
      'learners': <Object?>[
        _row('u1', 'Cường', completion: 0.5, minutes7: 90),
        _row('u2', 'An', completion: 0.9, status: 'ahead', minutes7: 30),
        _row(
          'u3',
          'Bình',
          hasStarted: false,
          completion: null,
          accuracy: null,
          lastActive: null,
          streak: 0,
          minutes7: 0,
          status: 'behind',
        ),
        _row('u4', 'Dũng', status: 'paused', minutes7: 10),
      ],
      'summary': <String, Object?>{
        'learnerCount': 4,
        'onTrack': 1,
        'behind': 1,
        'ahead': 1,
        'paused': 1,
        'needAttention': 0,
        'avgCompletionRatio': 0.63,
        'avgReviewAccuracy': 0.8,
      },
      'contentNotices': <Object?>[
        <String, Object?>{'unitId': 'x1', 'title': 'Số đếm', 'source': 'path'},
      ],
      'teacherlessWarning': teacherless,
    };

Map<String, Object?> _detail() => <String, Object?>{
  'userId': 'u1',
  'displayName': 'Cường',
  'row': _row('u1', 'Cường'),
  'units': <Object?>[
    <String, Object?>{
      'unitId': 'a',
      'title': 'Chào hỏi',
      'status': 'completed',
    },
    <String, Object?>{
      'unitId': 'b',
      'title': 'Số đếm',
      'status': 'in_progress',
      'dueOn': '2026-01-25',
    },
    <String, Object?>{'unitId': 'c', 'title': 'Trợ từ', 'status': 'exempt'},
  ],
  'dailyMinutes30': <Object?>[
    <String, Object?>{'date': '2026-01-18', 'minutes': 20},
    <String, Object?>{'date': '2026-01-19', 'minutes': 10},
  ],
  'reviewAccuracy': 0.75,
  'weakTopics': <Object?>[
    <String, Object?>{
      'topicId': 't1',
      'name': 'Trợ từ は/が',
      'accuracy': 0.4,
      'answers': 35,
    },
  ],
  'placement': <String, Object?>{
    'estimatedLevel': 'N5',
    'score': 14,
    'total': 20,
    'takenAt': '2026-01-06T04:00:00.000Z',
  },
  'assignmentStates': <Object?>[
    <String, Object?>{'assignmentId': 'as1', 'state': 'overdue'},
  ],
};

Future<TestEnv> _open(
  WidgetTester tester,
  String location, {
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /classes/class-1/dashboard', 200, _dashboard());
  env.backend.reply('GET /classes/class-1/members/u1/detail', 200, _detail());
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(location);
  await tester.pumpAndSettle();
  return env;
}

/// Tên học viên theo thứ tự các dòng hiện trên bảng.
List<String> _names(WidgetTester tester) {
  if (find.byType(DataTable).evaluate().isEmpty) return <String>[];
  final rows = tester.widget<DataTable>(find.byType(DataTable)).rows;
  return rows
      .map(
        (r) => (r.key! as ValueKey<String>).value.substring('learner-'.length),
      )
      .toList();
}

void main() {
  testWidgets(
    'hiển thị dòng tổng hợp, mọi học viên và cột số liệu theo hợp đồng',
    (tester) async {
      await _open(tester, '/classes/class-1/dashboard');
      expect(find.byKey(const Key('dashboard-summary')), findsOneWidget);
      expect(
        find.textContaining(
          '4 học viên · 1 đúng tiến độ · 1 chậm · 1 vượt · 1 tạm dừng',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('63%'), findsWidgets);
      expect(_names(tester), <String>[
        'u2',
        'u3',
        'u1',
        'u4',
      ]); // mặc định theo tên: An, Bình, Cường, Dũng
      expect(find.byKey(const Key('status-u2')), findsOneWidget);
      expect(find.text('Vượt tiến độ'), findsWidgets);
      // Thông báo đơn vị bị vô hiệu hóa (FR-020).
      expect(find.byKey(const Key('dashboard-notice-x1')), findsOneWidget);
      expect(find.byKey(const Key('dashboard-teacherless')), findsNothing);
    },
  );

  testWidgets(
    'học viên chưa bắt đầu hiện "Chưa bắt đầu" và "—" thay cho số 0',
    (tester) async {
      await _open(tester, '/classes/class-1/dashboard');
      expect(find.byKey(const Key('not-started-u3')), findsOneWidget);
      expect(find.byKey(const Key('not-started-u1')), findsNothing);
      // Các ô số liệu của u3 không có số 0 gây hiểu nhầm mà hiện "—".
      final row = tester
          .widget<DataTable>(find.byType(DataTable))
          .rows
          .firstWhere(
            (r) => (r.key! as ValueKey<String>).value == 'learner-u3',
          );
      final texts = row.cells
          .map((c) => c.child)
          .whereType<Text>()
          .map((t) => t.data)
          .toList();
      expect(texts, isNot(contains('0')));
      expect(texts, contains('—'));
    },
  );

  testWidgets(
    'bộ lọc chậm tiến độ / tạm dừng / chưa bắt đầu chỉ giữ đúng nhóm',
    (tester) async {
      await _open(tester, '/classes/class-1/dashboard');
      await tester.tap(find.byKey(const Key('filter-paused')));
      await tester.pumpAndSettle();
      expect(_names(tester), <String>['u4']);
      await tester.tap(find.byKey(const Key('filter-behind')));
      await tester.pumpAndSettle();
      expect(_names(tester), <String>['u3']);
      await tester.tap(find.byKey(const Key('filter-not-started')));
      await tester.pumpAndSettle();
      expect(_names(tester), <String>['u3']);
      await tester.tap(find.byKey(const Key('filter-all')));
      await tester.pumpAndSettle();
      expect(_names(tester), hasLength(4));
    },
  );

  testWidgets('cảnh báo lớp chưa có giáo viên phụ trách', (tester) async {
    await _open(
      tester,
      '/classes/class-1/dashboard',
      setup: (b) => b.reply(
        'GET /classes/class-1/dashboard',
        200,
        _dashboard(teacherless: true),
      ),
    );
    expect(find.byKey(const Key('dashboard-teacherless')), findsOneWidget);
  });

  testWidgets('lỗi 404 chung hiện trạng thái lỗi với nút thử lại', (
    tester,
  ) async {
    await _open(
      tester,
      '/classes/class-1/dashboard',
      setup: (b) =>
          b.reply('GET /classes/class-1/dashboard', 404, <String, Object?>{
            'code': 'NOT_FOUND',
            'message': 'Không tìm thấy tài nguyên',
          }),
    );
    expect(find.byKey(const Key('dashboard-summary')), findsNothing);
    expect(find.byType(ErrorView), findsOneWidget);
  });

  testWidgets(
    'bấm một học viên mở chi tiết với đơn vị, biểu đồ, mảng yếu, bài giao và kiểm tra',
    (tester) async {
      await _open(tester, '/classes/class-1/dashboard');
      await tester.tap(find.text('Cường'));
      await tester.pumpAndSettle();

      expect(find.text('Chi tiết học viên'), findsWidgets);
      expect(find.byKey(const Key('unit-a')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('unit-a')),
          matching: find.text('Hoàn thành'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('unit-b')),
          matching: find.text('Đang học'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('unit-c')),
          matching: find.text('Được miễn'),
        ),
        findsOneWidget,
      );
      expect(find.text('2026-01-25'), findsOneWidget);
      expect(find.byKey(const Key('detail-minutes-chart')), findsOneWidget);
      expect(find.byKey(const Key('minutes-2026-01-18')), findsOneWidget);
      expect(find.byKey(const Key('detail-accuracy')), findsOneWidget);
      expect(find.text('75%'), findsWidgets);
      expect(find.textContaining('Trợ từ は/が · 40% (35 câu)'), findsOneWidget);
      expect(find.text('Quá hạn'), findsOneWidget);
      expect(
        find.textContaining('Trình độ ước lượng N5 · 14/20'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'chi tiết học viên đã rời lớp (404) báo lỗi, không hiện dữ liệu',
    (tester) async {
      await _open(
        tester,
        '/classes/class-1/learners/u1',
        setup: (b) => b.reply(
          'GET /classes/class-1/members/u1/detail',
          404,
          <String, Object?>{
            'code': 'NOT_FOUND',
            'message': 'Không tìm thấy tài nguyên',
          },
        ),
      );
      expect(find.byKey(const Key('detail-accuracy')), findsNothing);
      expect(find.byType(ErrorView), findsOneWidget);
    },
  );
}
