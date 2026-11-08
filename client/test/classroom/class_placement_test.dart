import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Kiểm tra trình độ cho cả lớp và mời chuyển lớp (spec 004, US8, T128, FR-034, FR-014, Hiến pháp III): giáo viên
// tạo/xem/đóng yêu cầu và MỜI học viên sang lớp khác (không chuyển ngay); học viên thấy yêu cầu trong "Lớp của
// tôi", nộp kèm `classRequestId`, và khi nhận lời mời chuyển lớp thì phải đồng ý lại. Máy chủ giả chỉ mô phỏng
// hợp đồng; quy tắc thật được kiểm thử ở backend.

Map<String, Object?> _row(String id, String name, {bool done = false}) =>
    <String, Object?>{
      'userId': id,
      'displayName': name,
      'status': done ? 'done' : 'pending',
      if (done) ...<String, Object?>{
        'estimatedLevel': 'N5',
        'score': 12,
        'total': 20,
        'takenAt': '2026-01-20T05:00:00.000Z',
      },
    };

Map<String, Object?> _results() => <String, Object?>{
  'request': <String, Object?>{
    'id': 'req-1',
    'requestedAt': '2026-01-20T05:00:00.000Z',
  },
  'results': <Object?>[_row('u1', 'An', done: true), _row('u2', 'Bình')],
  'distribution': <String, Object?>{'none': 0, 'N5': 1, 'N4': 0, 'N3': 0},
};

const Map<String, Object?> _notFound = <String, Object?>{
  'code': 'NOT_FOUND',
  'message': 'Không tìm thấy tài nguyên',
};

Map<String, Object?> _classRow(String id, String name) => <String, Object?>{
  'id': id,
  'name': name,
  'status': 'active',
  'memberCount': 3,
  'hasPath': true,
  'teachers': <Object?>[],
  'teacherless': false,
};

Future<TestEnv> _open(
  WidgetTester tester,
  String route, {
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

String _location(WidgetTester tester) => GoRouter.of(
  tester.element(find.byType(Scaffold).first),
).routeInformationProvider.value.uri.toString();

Map<String, Object?> _body(RequestOptions options) =>
    Map<String, Object?>.from(options.data! as Map<dynamic, dynamic>);

void main() {
  group('giáo viên: kiểm tra trình độ cả lớp', () {
    testWidgets('chưa có yêu cầu: tạo yêu cầu gửi POST rồi hiện kết quả', (
      tester,
    ) async {
      var created = false;
      final env = await _open(
        tester,
        '/classes/class-1/placement',
        setup: (b) {
          b.on(
            'GET /classes/class-1/placement-requests/current',
            (_) => created
                ? FakeResponse(200, _results())
                : const FakeResponse(404, _notFound),
          );
          b.on('POST /classes/class-1/placement-requests', (_) {
            created = true;
            return const FakeResponse(201, <String, Object?>{
              'id': 'req-1',
              'requestedAt': '2026-01-20T05:00:00.000Z',
            });
          });
        },
      );
      expect(find.byKey(const Key('placement-no-request')), findsOneWidget);
      await _tap(tester, 'placement-create');
      expect(
        env.backend.sent('POST /classes/class-1/placement-requests'),
        hasLength(1),
      );
      expect(find.byKey(const Key('placement-no-request')), findsNothing);
      expect(find.byKey(const Key('placement-distribution')), findsOneWidget);
    });

    testWidgets(
      'hiện phân bố và từng học viên (đã làm/chưa làm); kết quả không đổi lộ trình lớp',
      (tester) async {
        await _open(
          tester,
          '/classes/class-1/placement',
          setup: (b) => b.reply(
            'GET /classes/class-1/placement-requests/current',
            200,
            _results(),
          ),
        );
        expect(find.text('N5: 1'), findsOneWidget);
        expect(find.text('Chưa đạt N5: 0'), findsOneWidget);
        expect(
          find.descendant(
            of: find.byKey(const Key('placement-row-u1')),
            matching: find.textContaining('Đã làm · N5 · 12/20 điểm'),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: find.byKey(const Key('placement-row-u2')),
            matching: find.text('Chưa làm'),
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets('đóng yêu cầu cần xác nhận rồi gửi POST close', (tester) async {
      final env = await _open(
        tester,
        '/classes/class-1/placement',
        setup: (b) {
          b.reply(
            'GET /classes/class-1/placement-requests/current',
            200,
            _results(),
          );
          b.reply(
            'POST /classes/class-1/placement-requests/current/close',
            204,
          );
        },
      );
      await _tap(tester, 'placement-close');
      expect(
        env.backend.sent(
          'POST /classes/class-1/placement-requests/current/close',
        ),
        isEmpty,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Đóng yêu cầu'));
      await tester.pumpAndSettle();
      expect(
        env.backend.sent(
          'POST /classes/class-1/placement-requests/current/close',
        ),
        hasLength(1),
      );
    });

    testWidgets(
      'mời sang lớp khác: chọn lớp đích gửi POST move; học viên KHÔNG bị chuyển ngay',
      (tester) async {
        final env = await _open(
          tester,
          '/classes/class-1/placement',
          setup: (b) {
            b.reply(
              'GET /classes/class-1/placement-requests/current',
              200,
              _results(),
            );
            b.reply('GET /classes', 200, <Object?>[
              _classRow('class-1', 'Lớp A'),
              _classRow('class-2', 'Lớp B'),
            ]);
            b.reply('POST /classes/class-1/members/u2/move', 202);
          },
        );
        await _tap(tester, 'placement-move-u2');
        expect(find.byKey(const Key('move-dialog')), findsOneWidget);
        expect(find.byKey(const Key('move-target-class-1')), findsNothing);
        await tester.tap(find.byKey(const Key('move-target-class-2')));
        await tester.pumpAndSettle();
        final sent = env.backend.sent('POST /classes/class-1/members/u2/move');
        expect(sent, hasLength(1));
        expect(_body(sent.single), <String, Object?>{'toClassId': 'class-2'});
        expect(
          find.text(
            'Đã gửi lời mời chuyển lớp; học viên đồng ý thì mới chuyển.',
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets('không có lớp khác: báo thay vì mở hộp thoại', (tester) async {
      await _open(
        tester,
        '/classes/class-1/placement',
        setup: (b) {
          b.reply(
            'GET /classes/class-1/placement-requests/current',
            200,
            _results(),
          );
          b.reply('GET /classes', 200, <Object?>[
            _classRow('class-1', 'Lớp A'),
          ]);
        },
      );
      await _tap(tester, 'placement-move-u2');
      expect(find.byKey(const Key('move-dialog')), findsNothing);
      expect(
        find.text(
          'Không có lớp nào khác trong phạm vi của bạn để chuyển sang.',
        ),
        findsOneWidget,
      );
    });
  });

  group('học viên: bài kiểm tra do lớp yêu cầu', () {
    Map<String, Object?> myClass({Object? placementRequest}) =>
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
            'dailyMinutes': 10,
          },
          'assignments': <Object?>[],
          'movedNotice': null,
          'placementRequest': placementRequest,
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

    testWidgets('không có yêu cầu: không hiện thẻ kiểm tra', (tester) async {
      await _open(
        tester,
        '/my-class',
        setup: (b) => b.reply('GET /me/class', 200, myClass()),
      );
      expect(find.byKey(const Key('my-class-placement')), findsNothing);
    });

    testWidgets(
      'có yêu cầu: thẻ dẫn tới bài kiểm tra, nộp gửi classRequestId, KHÔNG đổi lộ trình, về Lớp của tôi',
      (tester) async {
        final env = await _open(
          tester,
          '/my-class',
          setup: (b) => b.reply(
            'GET /me/class',
            200,
            myClass(
              placementRequest: <String, Object?>{
                'id': 'req-1',
                'requestedAt': '2026-01-20T05:00:00.000Z',
              },
            ),
          ),
        );
        expect(find.byKey(const Key('my-class-placement')), findsOneWidget);
        await _tap(tester, 'my-class-placement-start');
        expect(_location(tester), contains('context=class'));
        expect(_location(tester), contains('request=req-1'));

        await _tap(tester, 'placement-start');
        await _tap(tester, 'choice-1');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'choice-0');
        await _tap(tester, 'placement-submit');

        final sent = env.backend.sent('POST /placement/submit').single;
        expect(requestJson(sent)['classRequestId'], 'req-1');
        expect(find.byKey(const Key('placement-class-note')), findsOneWidget);
        // Không có lựa chọn xây dựng lại lộ trình cá nhân.
        expect(find.byKey(const Key('placement-rebuild')), findsNothing);
        expect(env.backend.sent('POST /path/rebuild'), isEmpty);

        await _tap(tester, 'placement-class-back');
        expect(_location(tester), '/my-class');
      },
    );
  });

  group('học viên: lời mời chuyển lớp phải đồng ý lại', () {
    Map<String, Object?> brief(String id, String name) => <String, Object?>{
      'id': id,
      'name': name,
      'organizationName': 'Trung tâm Sakura',
      'teachers': <Object?>[],
    };
    Map<String, Object?> disclosure() => <String, Object?>{
      'version': 1,
      'visible': <Object?>[],
      'notVisible': <Object?>[],
      'lockedControls': <Object?>[],
      'canLeaveAnytime': true,
      'mayBeMovedWithinOrganization': false,
    };
    void setupTransfer(FakeBackend b) {
      b.reply('GET /invitations/tok-1', 200, <String, Object?>{
        'kind': 'student',
        'organizationName': 'Trung tâm Sakura',
        'class': brief('class-2', 'Lớp B'),
        'invitedBy': 'Cô Hana',
        'expiresAt': '2026-02-01T00:00:00.000Z',
        'disclosure': disclosure(),
      });
      b.reply('GET /me/class', 200, <String, Object?>{
        'class': brief('class-1', 'Lớp A'),
        'joinedAt': '2026-01-05T08:00:00.000Z',
        'path': <String, Object?>{
          'startLevel': 'N5',
          'targetLevel': 'N4',
          'skills': <Object?>['vocabulary'],
          'startsOn': '2026-01-05',
          'endsOn': '2026-06-30',
          'dailyMinutes': 10,
        },
        'assignments': <Object?>[],
        'disclosure': disclosure(),
        'progress': <String, Object?>{
          'hasStarted': false,
          'minutesTotal': 0,
          'minutesLast7Days': 0,
          'streakDays': 0,
        },
      });
    }

    testWidgets(
      'đang ở lớp khác: nêu rõ chuyển lớp, nhãn "Chuyển sang lớp này"/"Ở lại lớp hiện tại", cần xác nhận',
      (tester) async {
        final env = await _open(tester, '/invite/tok-1', setup: setupTransfer);
        expect(find.byKey(const Key('choice-transfer-note')), findsOneWidget);
        expect(find.textContaining('Lớp A'), findsWidgets);
        expect(find.text('Chuyển sang lớp này'), findsOneWidget);
        expect(find.text('Ở lại lớp hiện tại'), findsOneWidget);
        expect(find.byKey(const Key('choice-move-note')), findsOneWidget);
        expect(env.backend.sent('POST /invitations/tok-1/respond'), isEmpty);
      },
    );

    testWidgets('đồng ý: xác nhận rồi gửi join_class + confirmed', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/invite/tok-1',
        setup: (b) {
          setupTransfer(b);
          b.reply('POST /invitations/tok-1/respond', 200, <String, Object?>{
            'status': 'joined',
            'class': brief('class-2', 'Lớp B'),
            'joinedAt': '2026-01-20T05:00:00.000Z',
          });
        },
      );
      await _tap(tester, 'choice-join');
      expect(find.text('Xác nhận chuyển lớp'), findsOneWidget);
      expect(env.backend.sent('POST /invitations/tok-1/respond'), isEmpty);
      await tester.tap(
        find.widgetWithText(FilledButton, 'Chuyển sang lớp này'),
      );
      await tester.pumpAndSettle();
      final sent = env.backend.sent('POST /invitations/tok-1/respond').single;
      expect(_body(sent), <String, Object?>{
        'decision': 'join_class',
        'confirmed': true,
      });
    });

    testWidgets(
      'từ chối: gửi stay_personal và ở lại lớp hiện tại (về Lớp của tôi)',
      (tester) async {
        final env = await _open(
          tester,
          '/invite/tok-1',
          setup: (b) {
            setupTransfer(b);
            b.reply('POST /invitations/tok-1/respond', 200, <String, Object?>{
              'status': 'stayed_personal',
            });
          },
        );
        await _tap(tester, 'choice-stay');
        final sent = env.backend.sent('POST /invitations/tok-1/respond').single;
        expect(_body(sent), <String, Object?>{'decision': 'stay_personal'});
        expect(_location(tester), '/my-class');
      },
    );

    testWidgets(
      'chưa thuộc lớp nào: lời mời vào lớp thông thường, không có ghi chú chuyển lớp',
      (tester) async {
        await _open(
          tester,
          '/invite/tok-1',
          setup: (b) {
            setupTransfer(b);
            b.reply('GET /me/class', 404, _notFound);
          },
        );
        expect(find.byKey(const Key('choice-transfer-note')), findsNothing);
        expect(find.text('Vào lớp và theo lộ trình lớp'), findsOneWidget);
      },
    );
  });
}
