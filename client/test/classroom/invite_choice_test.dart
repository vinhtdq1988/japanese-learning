import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Hai lựa chọn khi được mời vào lớp / nhập mã và "Lớp của tôi" (spec 004, US2, T059, FR-016, FR-037): đủ HAI
// lựa chọn ngang nhau cùng thông báo dữ liệu chia sẻ TRƯỚC khi xác nhận; chọn cá nhân KHÔNG gọi tạo thành viên.
// Máy chủ giả chỉ mô phỏng hợp đồng; quy tắc thật (seat, thành viên) được kiểm thử ở backend.

Map<String, Object?> _classBrief() => <String, Object?>{
  'id': 'class-1',
  'name': 'N5 buổi tối',
  'organizationName': 'Trung tâm Sakura',
  'teachers': <Object?>[
    <String, Object?>{'displayName': 'Cô Hana'},
  ],
};

Map<String, Object?> _disclosure() => <String, Object?>{
  'version': 1,
  'visible': <Object?>[
    <String, Object?>{'code': 'display_name', 'label': 'Tên hiển thị'},
    <String, Object?>{
      'code': 'progress',
      'label': 'Tiến độ trong lộ trình lớp',
    },
  ],
  'notVisible': <Object?>[
    'Mật khẩu và phiên đăng nhập',
    'Từng câu trả lời của bạn',
  ],
  'lockedControls': <Object?>['Thời gian học mỗi ngày', 'Kỹ năng muốn học'],
  'canLeaveAnytime': true,
  'mayBeMovedWithinOrganization': false,
};

Map<String, Object?> _preview() => <String, Object?>{
  'kind': 'student',
  'organizationName': 'Trung tâm Sakura',
  'class': _classBrief(),
  'invitedBy': 'Cô Hana',
  'expiresAt': '2026-02-01T00:00:00.000Z',
  'disclosure': _disclosure(),
};

Map<String, Object?> _myClass() => <String, Object?>{
  'class': _classBrief(),
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
  'disclosure': _disclosure(),
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

String _location(WidgetTester tester) => GoRouter.of(
  tester.element(find.byType(Scaffold).first),
).routeInformationProvider.value.uri.toString();

void main() {
  group('lời mời vào lớp', () {
    testWidgets(
      'hiện đủ hai lựa chọn ngang nhau và thông báo dữ liệu chia sẻ trước khi quyết định',
      (tester) async {
        final env = await _open(
          tester,
          '/invite/tok-1',
          setup: (b) => b.reply('GET /invitations/tok-1', 200, _preview()),
        );
        expect(find.byKey(const Key('choice-class')), findsOneWidget);
        expect(find.text('Vào lớp và theo lộ trình lớp'), findsOneWidget);
        expect(find.text('Tiếp tục theo lộ trình cá nhân'), findsOneWidget);
        // Thông báo: dữ liệu xem được, không xem được, điều khiển bị khóa, rời lớp, chuyển lớp.
        expect(find.text('• Tiến độ trong lộ trình lớp'), findsOneWidget);
        expect(find.text('• Từng câu trả lời của bạn'), findsOneWidget);
        expect(find.text('• Kỹ năng muốn học'), findsOneWidget);
        expect(find.byKey(const Key('choice-leave-note')), findsOneWidget);
        expect(find.byKey(const Key('choice-move-note')), findsOneWidget);
        // Hai lựa chọn cùng kiểu nút: không lựa chọn nào được nhấn mạnh hơn.
        expect(
          tester.widget(find.byKey(const Key('choice-join'))).runtimeType,
          tester.widget(find.byKey(const Key('choice-stay'))).runtimeType,
        );
        // Chưa gọi gì ngoài xem trước.
        expect(env.backend.sent('POST /invitations/tok-1/respond'), isEmpty);
      },
    );

    testWidgets(
      'chọn cá nhân: chỉ gửi stay_personal, KHÔNG tạo thành viên, về Hôm nay',
      (tester) async {
        final env = await _open(
          tester,
          '/invite/tok-1',
          setup: (b) {
            b.reply('GET /invitations/tok-1', 200, _preview());
            b.reply('POST /invitations/tok-1/respond', 200, <String, Object?>{
              'status': 'stayed_personal',
            });
          },
        );
        await tester.tap(find.byKey(const Key('choice-stay')));
        await tester.pumpAndSettle();
        final sent = env.backend.sent('POST /invitations/tok-1/respond');
        expect(sent, hasLength(1));
        expect(requestJson(sent.single), <String, Object?>{
          'decision': 'stay_personal',
        });
        expect(_location(tester), '/today');
      },
    );

    testWidgets(
      'chọn vào lớp phải qua bước xác nhận; hủy xác nhận không gửi gì',
      (tester) async {
        final env = await _open(
          tester,
          '/invite/tok-1',
          setup: (b) {
            b.reply('GET /invitations/tok-1', 200, _preview());
            b.reply('POST /invitations/tok-1/respond', 200, <String, Object?>{
              'status': 'joined',
              'class': _classBrief(),
              'joinedAt': '2026-01-05T08:00:00.000Z',
            });
            b.reply('GET /me/class', 200, _myClass());
          },
        );
        await tester.tap(find.byKey(const Key('choice-join')));
        await tester.pumpAndSettle();
        expect(find.text('Xác nhận vào lớp'), findsOneWidget);
        await tester.tap(find.text('Hủy'));
        await tester.pumpAndSettle();
        expect(env.backend.sent('POST /invitations/tok-1/respond'), isEmpty);

        await tester.tap(find.byKey(const Key('choice-join')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Đồng ý và vào lớp'));
        await tester.pumpAndSettle();
        expect(
          requestJson(
            env.backend.sent('POST /invitations/tok-1/respond').single,
          ),
          <String, Object?>{'decision': 'join_class', 'confirmed': true},
        );
        expect(_location(tester), '/my-class');
        expect(find.byKey(const Key('my-class-name')), findsOneWidget);
      },
    );

    testWidgets(
      'mất seat lúc vào lớp: báo lỗi, nói rõ lời mời còn hiệu lực, ở lại màn hình lời mời',
      (tester) async {
        await _open(
          tester,
          '/invite/tok-1',
          setup: (b) {
            b.reply('GET /invitations/tok-1', 200, _preview());
            b.reply('POST /invitations/tok-1/respond', 409, <String, Object?>{
              'code': 'SEAT_UNAVAILABLE',
              'message': 'Không còn seat trống',
            });
          },
        );
        await tester.tap(find.byKey(const Key('choice-join')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Đồng ý và vào lớp'));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('invite-error-dialog')), findsOneWidget);
        expect(find.textContaining('Không còn seat trống.'), findsOneWidget);
        expect(find.textContaining('Lời mời vẫn còn hiệu lực'), findsOneWidget);
        expect(_location(tester), '/invite/tok-1');
      },
    );
  });

  group('nhập mã tham gia', () {
    testWidgets(
      'xem trước rồi chọn cá nhân: hai lần gọi, không có join_class',
      (tester) async {
        final env = await _open(
          tester,
          '/join',
          setup: (b) => b.on('POST /me/class/join', (request) {
            final body = requestJson(request);
            if (body['decision'] == 'stay_personal') {
              return const FakeResponse(204);
            }
            return FakeResponse(200, <String, Object?>{
              'status': 'preview',
              'class': _classBrief(),
              'disclosure': _disclosure(),
            });
          }),
        );
        await tester.enterText(find.byKey(const Key('code-field')), 'ABCD2345');
        await tester.tap(find.byKey(const Key('code-continue')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('choice-join')), findsOneWidget);
        expect(find.byKey(const Key('choice-stay')), findsOneWidget);
        // Nhập mã không có người mời: lời giới thiệu nêu thẳng lớp.
        expect(find.byKey(const Key('choice-intro')), findsOneWidget);

        await tester.tap(find.byKey(const Key('choice-stay')));
        await tester.pumpAndSettle();
        final bodies = env.backend
            .sent('POST /me/class/join')
            .map(requestJson)
            .toList();
        expect(bodies, <Map<String, Object?>>[
          <String, Object?>{'code': 'ABCD2345'},
          <String, Object?>{'code': 'ABCD2345', 'decision': 'stay_personal'},
        ]);
        expect(_location(tester), '/today');
      },
    );

    testWidgets('mã sai (404 chung): chỉ báo mã không hợp lệ', (tester) async {
      await _open(
        tester,
        '/join',
        setup: (b) => b.reply('POST /me/class/join', 404, <String, Object?>{
          'code': 'NOT_FOUND',
          'message': 'Không tìm thấy tài nguyên',
        }),
      );
      await tester.enterText(find.byKey(const Key('code-field')), 'SAIMA123');
      await tester.tap(find.byKey(const Key('code-continue')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('code-error')), findsOneWidget);
      expect(
        find.text('Mã không hợp lệ hoặc đã hết hiệu lực.'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('choice-join')), findsNothing);
    });

    testWidgets('sai quá nhiều lần (429): báo thử lại sau', (tester) async {
      await _open(
        tester,
        '/join',
        setup: (b) => b.on(
          'POST /me/class/join',
          (_) => const FakeResponse(
            429,
            <String, Object?>{
              'code': 'TOO_MANY_REQUESTS',
              'message': 'Quá nhiều lần',
            },
            <String, String>{'retry-after': '120'},
          ),
        ),
      );
      await tester.enterText(find.byKey(const Key('code-field')), 'SAIMA123');
      await tester.tap(find.byKey(const Key('code-continue')));
      await tester.pumpAndSettle();
      expect(find.textContaining('120'), findsOneWidget);
    });
  });

  group('Lớp của tôi', () {
    testWidgets(
      'hiện lớp, lộ trình và dữ liệu chia sẻ; rời lớp cần xác nhận rồi về Hôm nay',
      (tester) async {
        final env = await _open(
          tester,
          '/my-class',
          setup: (b) {
            b.reply('GET /me/class', 200, _myClass());
            b.reply('POST /me/class/leave', 204);
          },
        );
        expect(find.byKey(const Key('my-class-name')), findsOneWidget);
        expect(find.byKey(const Key('my-class-org')), findsOneWidget);
        expect(find.byKey(const Key('my-class-disclosure')), findsOneWidget);
        expect(find.text('• Tiến độ trong lộ trình lớp'), findsOneWidget);

        await tester.tap(find.byKey(const Key('my-class-leave')));
        await tester.pumpAndSettle();
        expect(find.text('Rời lớp?'), findsOneWidget);
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Chuyển sang lộ trình cá nhân (rời lớp)'),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          requestJson(env.backend.sent('POST /me/class/leave').single),
          <String, Object?>{'confirm': true},
        );
        expect(_location(tester), '/today');
      },
    );

    testWidgets('chưa thuộc lớp (404): gợi ý nhập mã', (tester) async {
      await _open(
        tester,
        '/my-class',
        setup: (b) => b.reply('GET /me/class', 404, <String, Object?>{
          'code': 'NOT_FOUND',
          'message': 'Không tìm thấy tài nguyên',
        }),
      );
      expect(find.byKey(const Key('my-class-none')), findsOneWidget);
    });
  });
}
