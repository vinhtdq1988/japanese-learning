import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/platform/platform.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Luồng tổ chức (spec 004, US1, T043): đăng ký mới → nhận lời mời mà KHÔNG qua onboarding cá nhân, tổng quan
// chủ tổ chức (seat, cảnh báo hết hạn, mời/gỡ giáo viên) và màn hình quản trị tổ chức/giấy phép. Máy chủ giả
// chỉ mô phỏng hợp đồng; quy tắc thật (seat, cô lập, vòng đời) được kiểm thử ở backend.

Map<String, Object?> _seats({int total = 10, int used = 3, int reserved = 2}) =>
    <String, Object?>{
      'total': total,
      'used': used,
      'reserved': reserved,
      'available': total - used - reserved,
    };

Map<String, Object?> _overview({
  String licenseState = 'ok',
  List<Map<String, Object?>> teachers = const <Map<String, Object?>>[],
  List<Map<String, Object?>> invitations = const <Map<String, Object?>>[],
}) => <String, Object?>{
  'id': 'org-1',
  'name': 'Trung tâm Sakura',
  'status': 'active',
  'seats': _seats(),
  'license': <String, Object?>{
    'startsOn': '2026-01-01',
    'endsOn': '2026-12-31',
    'graceEndsOn': '2027-01-07',
    'state': licenseState,
  },
  'teachers': teachers,
  'classes': <Object?>[
    <String, Object?>{
      'id': 'class-1',
      'name': 'N5 buổi tối',
      'status': 'active',
      'memberCount': 12,
      'hasPath': true,
      'teachers': <Object?>[],
      'teacherless': true,
    },
  ],
  'pendingInvitations': invitations,
};

Map<String, Object?> _preview({String kind = 'owner'}) => <String, Object?>{
  'kind': kind,
  'organizationName': 'Trung tâm Sakura',
  'invitedBy': 'Quản trị Sakura',
  'expiresAt': '2026-02-01T00:00:00.000Z',
};

Future<TestEnv> _open(
  WidgetTester tester,
  String route, {
  StoredTokensKind kind = StoredTokensKind.learner,
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(
    tokens: switch (kind) {
      StoredTokensKind.none => null,
      StoredTokensKind.learner => signedInTokens(),
      StoredTokensKind.admin => StoredTokens(
        accessToken: fakeJwt(role: 'admin', sub: 'admin-1'),
        refreshToken: 'refresh-1',
      ),
    },
  );
  LearningScenario(env.backend).onboarded = kind != StoredTokensKind.none
      ? true
      : false;
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

enum StoredTokensKind { none, learner, admin }

/// Cuộn nút vào khung nhìn rồi bấm (chi tiết tổ chức nằm trong danh sách cuộn của khung phải).
Future<void> _tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

String _location(WidgetTester tester) => GoRouter.of(
  tester.element(find.byType(Scaffold).first),
).routeInformationProvider.value.uri.toString();

void main() {
  group('nhận lời mời sau đăng ký (T043)', () {
    testWidgets(
      'khách mở liên kết lời mời → đăng ký → vào thẳng lời mời, không qua onboarding',
      (tester) async {
        final env = await _open(
          tester,
          '/invite/tok-1',
          kind: StoredTokensKind.none,
          setup: (b) {
            b.reply('GET /invitations/tok-1', 200, _preview());
            b.reply('POST /invitations/tok-1/respond', 200, <String, Object?>{
              'status': 'accepted',
            });
            b.reply('GET /org', 200, _overview());
          },
        );
        // Chưa đăng nhập: bị đưa tới đăng nhập kèm đích quay lại.
        expect(_location(tester), '/login?from=%2Finvite%2Ftok-1');

        // Chuyển sang đăng ký vẫn giữ đích quay lại.
        await tester.tap(find.byKey(const Key('register-link')));
        await tester.pumpAndSettle();
        expect(_location(tester), '/register?from=%2Finvite%2Ftok-1');

        await tester.enterText(find.byKey(const Key('displayName')), 'Cô Hana');
        await tester.enterText(
          find.byKey(const Key('email')),
          'hana@example.com',
        );
        await tester.enterText(
          find.byKey(const Key('password')),
          'Matkhau-123',
        );
        await tester.tap(find.byKey(const Key('submit')));
        await tester.pumpAndSettle();

        // Đăng ký xong vào đúng màn hình lời mời; KHÔNG bị đưa qua "Hôm nay"/onboarding cá nhân.
        expect(_location(tester), '/invite/tok-1');
        expect(find.byKey(const Key('invite-org')), findsOneWidget);
        expect(find.text('Thiết lập lộ trình'), findsNothing);
        expect(env.backend.sent('GET /today'), isEmpty);

        await tester.tap(find.byKey(const Key('invite-accept')));
        await tester.pumpAndSettle();
        expect(
          requestJson(
            env.backend.sent('POST /invitations/tok-1/respond').single,
          ),
          <String, Object?>{'decision': 'accept'},
        );
        // Chủ tổ chức nhận lời mời xong vào thẳng trang tổ chức.
        expect(_location(tester), '/org');
        expect(find.byKey(const Key('org-seats')), findsOneWidget);
      },
    );

    testWidgets(
      'lời mời không dùng được (404 chung) hiện thông báo, không lộ lý do',
      (tester) async {
        await _open(
          tester,
          '/invite/het-han',
          setup: (b) =>
              b.reply('GET /invitations/het-han', 404, <String, Object?>{
                'code': 'NOT_FOUND',
                'message': 'Không tìm thấy tài nguyên',
              }),
        );
        expect(find.byKey(const Key('invite-invalid')), findsOneWidget);
        expect(find.byKey(const Key('invite-accept')), findsNothing);
      },
    );

    testWidgets('từ chối lời mời giáo viên gửi decline và về Hôm nay', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/invite/tok-2',
        setup: (b) {
          b.reply('GET /invitations/tok-2', 200, _preview(kind: 'teacher'));
          b.reply('POST /invitations/tok-2/respond', 200, <String, Object?>{
            'status': 'declined',
          });
        },
      );
      expect(find.byKey(const Key('invite-body')), findsOneWidget);
      await tester.tap(find.byKey(const Key('invite-decline')));
      await tester.pumpAndSettle();
      expect(
        requestJson(env.backend.sent('POST /invitations/tok-2/respond').single),
        <String, Object?>{'decision': 'decline'},
      );
      expect(_location(tester), '/today');
    });

    testWidgets(
      'mất seat lúc chấp nhận: báo lỗi SEAT_UNAVAILABLE và ở lại màn hình lời mời',
      (tester) async {
        await _open(
          tester,
          '/invite/tok-3',
          setup: (b) {
            b.reply('GET /invitations/tok-3', 200, _preview(kind: 'teacher'));
            b.reply('POST /invitations/tok-3/respond', 409, <String, Object?>{
              'code': 'SEAT_UNAVAILABLE',
              'message': 'Không còn seat trống',
            });
          },
        );
        await tester.tap(find.byKey(const Key('invite-accept')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('invite-error-dialog')), findsOneWidget);
        expect(find.text('Không còn seat trống.'), findsOneWidget);
        expect(_location(tester), '/invite/tok-3');
      },
    );
  });

  group('tổng quan chủ tổ chức', () {
    testWidgets(
      'hiện seat, cảnh báo sắp hết hạn, giáo viên và lớp không có giáo viên',
      (tester) async {
        await _open(
          tester,
          '/org',
          setup: (b) => b.reply(
            'GET /org',
            200,
            _overview(
              licenseState: 'expiring',
              teachers: <Map<String, Object?>>[
                <String, Object?>{
                  'userId': 't1',
                  'email': 'gv1@example.com',
                  'displayName': 'Cô Hana',
                  'hasSeat': true,
                  'classIds': <Object?>[],
                },
                <String, Object?>{
                  'userId': 't2',
                  'email': 'gv2@example.com',
                  'hasSeat': false,
                },
              ],
            ),
          ),
        );
        expect(
          find.text('Seat: 3/10 đang dùng · 2 giữ chỗ · 5 còn trống'),
          findsOneWidget,
        );
        expect(find.byKey(const Key('org-license-expiring')), findsOneWidget);
        expect(find.byKey(const Key('teacher-revoke-t1')), findsOneWidget);
        // Giáo viên mất seat: có nút cấp lại, không có nút thu hồi.
        expect(find.byKey(const Key('teacher-grant-t2')), findsOneWidget);
        expect(find.byKey(const Key('teacher-revoke-t2')), findsNothing);
        expect(find.text('Chưa có giáo viên phụ trách'), findsOneWidget);
      },
    );

    testWidgets(
      'người không phải chủ tổ chức (403) thấy thông báo không có quyền',
      (tester) async {
        await _open(
          tester,
          '/org',
          setup: (b) => b.reply('GET /org', 403, <String, Object?>{
            'code': 'FORBIDDEN',
            'message': 'Không có quyền truy cập',
          }),
        );
        expect(find.byKey(const Key('org-no-access')), findsOneWidget);
      },
    );

    testWidgets('mời giáo viên, cấp seat và gỡ giáo viên gọi đúng API', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/org',
        setup: (b) {
          b.reply(
            'GET /org',
            200,
            _overview(
              teachers: <Map<String, Object?>>[
                <String, Object?>{
                  'userId': 't2',
                  'email': 'gv2@example.com',
                  'hasSeat': false,
                },
              ],
            ),
          );
          b.reply('POST /org/teachers/invitations', 201, <String, Object?>{
            'id': 'inv-1',
            'kind': 'teacher',
            'email': 'moi@example.com',
            'status': 'pending',
            'expiresAt': '2026-02-01T00:00:00.000Z',
          });
          b.reply('POST /org/seats/t2/grant', 204);
          b.reply('DELETE /org/teachers/t2', 204);
        },
      );

      await tester.tap(find.byKey(const Key('org-invite-teacher')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('form-email')),
        ' moi@example.com ',
      );
      await tester.tap(find.byKey(const Key('form-submit')));
      await tester.pumpAndSettle();
      expect(
        requestJson(env.backend.sent('POST /org/teachers/invitations').single),
        <String, Object?>{'email': 'moi@example.com'},
      );

      await tester.tap(find.byKey(const Key('teacher-grant-t2')));
      await tester.pumpAndSettle();
      expect(env.backend.sent('POST /org/seats/t2/grant'), hasLength(1));

      await tester.tap(find.byKey(const Key('teacher-remove-t2')));
      await tester.pumpAndSettle();
      // Hộp thoại xác nhận trước khi gỡ.
      await tester.tap(find.widgetWithText(FilledButton, 'Gỡ giáo viên'));
      await tester.pumpAndSettle();
      expect(env.backend.sent('DELETE /org/teachers/t2'), hasLength(1));
    });

    testWidgets('thu hồi lời mời đang chờ gọi DELETE /invitations/{id}', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/org',
        setup: (b) {
          b.reply(
            'GET /org',
            200,
            _overview(
              invitations: <Map<String, Object?>>[
                <String, Object?>{
                  'id': 'inv-9',
                  'kind': 'teacher',
                  'email': 'cho@example.com',
                  'status': 'pending',
                  'expiresAt': '2026-02-01T00:00:00.000Z',
                },
              ],
            ),
          );
          b.reply('DELETE /invitations/inv-9', 204);
        },
      );
      await tester.tap(find.byKey(const Key('invitation-revoke-inv-9')));
      await tester.pumpAndSettle();
      expect(env.backend.sent('DELETE /invitations/inv-9'), hasLength(1));
    });
  });

  group('quản trị tổ chức', () {
    Map<String, Object?> row() => <String, Object?>{
      'id': 'org-1',
      'name': 'Trung tâm Sakura',
      'status': 'active',
      'owners': <Object?>[
        <String, Object?>{'email': 'chu@example.com', 'status': 'pending'},
      ],
      'seats': _seats(),
      'license': <String, Object?>{
        'endsOn': '2026-12-31',
        'graceEndsOn': '2027-01-07',
        'state': 'expiring',
      },
      'warnings': <Object?>['expiring'],
    };

    Map<String, Object?> detail() => <String, Object?>{
      ...row(),
      'licenses': <Object?>[
        <String, Object?>{
          'id': 'lic-1',
          'startsOn': '2026-01-01',
          'endsOn': '2026-12-31',
          'graceEndsOn': '2027-01-07',
          'graceDays': 7,
          'maxReassignments': 2,
          'revokedAt': null,
          'seats': _seats(),
          'state': 'expiring',
        },
      ],
      'seatHolders': <Object?>[
        <String, Object?>{
          'userId': 'u1',
          'email': 'gv1@example.com',
          'roles': <Object?>['teacher'],
          'assignedAt': '2026-01-05T08:00:00.000Z',
        },
      ],
      'classCount': 2,
      'pendingInvitations': <Object?>[],
    };

    void install(FakeBackend b) {
      b.reply('GET /admin/organizations', 200, <String, Object?>{
        'items': <Object?>[row()],
        'total': 1,
        'page': 1,
      });
      b.reply('GET /admin/organizations/org-1', 200, detail());
    }

    testWidgets(
      'danh sách kèm cảnh báo; chọn tổ chức hiện giấy phép và người giữ seat',
      (tester) async {
        await _open(
          tester,
          '/admin/organizations',
          kind: StoredTokensKind.admin,
          setup: install,
        );
        expect(find.text('Trung tâm Sakura'), findsOneWidget);
        expect(
          find.byKey(const Key('org-warning-org-1-expiring')),
          findsOneWidget,
        );
        await tester.tap(find.byKey(const Key('org-org-1')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('org-detail-org-1')), findsOneWidget);
        expect(find.byKey(const Key('license-lic-1')), findsOneWidget);
        expect(find.byKey(const Key('holder-u1')), findsOneWidget);
        expect(find.text('chu@example.com'), findsOneWidget);
      },
    );

    testWidgets('tạo tổ chức gửi ngày giấy phép dạng yyyy-MM-dd', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/admin/organizations',
        kind: StoredTokensKind.admin,
        setup: (b) {
          install(b);
          b.reply('POST /admin/organizations', 201, detail());
        },
      );
      await tester.tap(find.byKey(const Key('org-create')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('form-name')),
        'Trung tâm Tanaka',
      );
      await tester.enterText(
        find.byKey(const Key('form-ownerEmail')),
        'chu@example.com',
      );
      await tester.enterText(find.byKey(const Key('form-seats')), '20');
      await tester.enterText(
        find.byKey(const Key('form-startsOn')),
        '2026-01-01',
      );
      await tester.enterText(
        find.byKey(const Key('form-endsOn')),
        '2026-12-31',
      );
      await tester.tap(find.byKey(const Key('form-submit')));
      await tester.pumpAndSettle();
      expect(
        requestJson(env.backend.sent('POST /admin/organizations').single),
        <String, Object?>{
          'name': 'Trung tâm Tanaka',
          'ownerEmail': 'chu@example.com',
          'license': <String, Object?>{
            'seats': 20,
            'startsOn': '2026-01-01',
            'endsOn': '2026-12-31',
          },
        },
      );
    });

    testWidgets('nâng giới hạn đổi người giữ seat và thu hồi seat', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/admin/organizations',
        kind: StoredTokensKind.admin,
        setup: (b) {
          install(b);
          b.reply(
            'PATCH /admin/organizations/org-1/licenses/lic-1',
            200,
            <String, Object?>{
              ...(detail()['licenses']! as List<Object?>).first!
                  as Map<String, Object?>,
              'maxReassignments': 5,
            },
          );
          b.reply('DELETE /admin/organizations/org-1/seats/u1', 204);
        },
      );
      await tester.tap(find.byKey(const Key('org-org-1')));
      await tester.pumpAndSettle();

      await _tapKey(tester, 'license-edit-lic-1');
      await tester.enterText(
        find.byKey(const Key('form-maxReassignments')),
        '5',
      );
      await tester.tap(find.byKey(const Key('form-submit')));
      await tester.pumpAndSettle();
      final patch = requestJson(
        env.backend
            .sent('PATCH /admin/organizations/org-1/licenses/lic-1')
            .single,
      );
      expect(patch['maxReassignments'], 5);
      expect(patch['endsOn'], '2026-12-31');

      await _tapKey(tester, 'holder-revoke-u1');
      await tester.tap(find.widgetWithText(FilledButton, 'Thu hồi seat'));
      await tester.pumpAndSettle();
      expect(
        env.backend.sent('DELETE /admin/organizations/org-1/seats/u1'),
        hasLength(1),
      );
    });

    testWidgets('vô hiệu hóa tổ chức cần xác nhận rồi gửi PATCH status', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/admin/organizations',
        kind: StoredTokensKind.admin,
        setup: (b) {
          install(b);
          b.reply('PATCH /admin/organizations/org-1', 200, <String, Object?>{
            ...detail(),
            'status': 'disabled',
          });
        },
      );
      await tester.tap(find.byKey(const Key('org-org-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('org-toggle-status')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Vô hiệu hóa'));
      await tester.pumpAndSettle();
      expect(
        requestJson(
          env.backend.sent('PATCH /admin/organizations/org-1').single,
        ),
        <String, Object?>{'status': 'disabled'},
      );
    });

    testWidgets('người học thường không vào được /admin/organizations', (
      tester,
    ) async {
      await _open(tester, '/admin/organizations');
      expect(_location(tester), '/today');
    });
  });
}
