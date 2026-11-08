import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform_providers.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Màn hình lớp của giáo viên (spec 004, US2, T058–T059): danh sách học viên theo trạng thái, nhắc đặt lộ trình
// trước khi mời, mời bằng email, nhập CSV qua `pickCsv()` hiện kết quả từng dòng, mã tham gia, gỡ học viên và
// lưu trữ lớp có xác nhận nêu hậu quả. Máy chủ giả chỉ mô phỏng hợp đồng.

Map<String, Object?> _detail({bool hasPath = true, String status = 'active'}) =>
    <String, Object?>{
      'id': 'class-1',
      'name': 'N5 buổi tối',
      'status': status,
      'memberCount': 1,
      'hasPath': hasPath,
      'teachers': <Object?>[
        <String, Object?>{'userId': 't1', 'displayName': 'Cô Hana'},
      ],
      'teacherless': false,
      'absenceThresholdDays': 3,
      'createdAt': '2026-01-05T08:00:00.000Z',
    };

List<Object?> _roster() => <Object?>[
  <String, Object?>{
    'userId': 'u1',
    'displayName': 'An',
    'email': 'an@example.com',
    'status': 'joined',
    'at': '2026-01-06T08:00:00.000Z',
  },
  <String, Object?>{
    'displayName': 'cho@example.com',
    'email': 'cho@example.com',
    'status': 'invited',
    'at': '2026-01-06T09:00:00.000Z',
    'invitationId': 'inv-1',
  },
  <String, Object?>{
    'displayName': 'Bình',
    'email': 'binh@example.com',
    'status': 'declined',
    'at': '2026-01-06T10:00:00.000Z',
    'invitationId': 'inv-2',
  },
  <String, Object?>{
    'displayName': 'Chi',
    'status': 'switched_personal',
    'at': '2026-01-07T10:00:00.000Z',
  },
];

Future<({TestEnv env, MemoryFileTransfer files})> _open(
  WidgetTester tester, {
  void Function(FakeBackend backend)? setup,
  String? pickResult,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend.reply('GET /classes/class-1', 200, _detail());
  env.backend.reply('GET /classes/class-1/roster', 200, _roster());
  env.backend.reply('GET /classes/class-1/join-code', 200, <String, Object?>{
    'enabled': false,
  });
  setup?.call(env.backend);
  final files = MemoryFileTransfer(pickResult: pickResult);
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...env.overrides,
        fileTransferProvider.overrideWithValue(files),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(
    tester.element(find.byType(Scaffold).first),
  ).go('/classes/class-1');
  await tester.pumpAndSettle();
  return (env: env, files: files);
}

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
  testWidgets(
    'hiện học viên theo trạng thái, chỉ học viên đã vào mới có nút gỡ',
    (tester) async {
      await _open(tester);
      expect(find.text('An'), findsOneWidget);
      expect(find.textContaining('Đã vào lớp'), findsOneWidget);
      expect(find.textContaining('Đã mời, chờ trả lời'), findsOneWidget);
      expect(
        find.textContaining('Từ chối, ở lại lộ trình cá nhân'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Đã chuyển sang lộ trình cá nhân'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('remove-u1')), findsOneWidget);
      expect(find.byKey(const Key('revoke-inv-1')), findsOneWidget);
      expect(find.byKey(const Key('revoke-inv-2')), findsNothing);
      expect(find.byKey(const Key('class-no-path')), findsNothing);
    },
  );

  testWidgets(
    'lớp chưa có lộ trình: nhắc đặt lộ trình, không cho mời và bật mã',
    (tester) async {
      await _open(
        tester,
        setup: (b) =>
            b.reply('GET /classes/class-1', 200, _detail(hasPath: false)),
      );
      expect(find.byKey(const Key('class-no-path')), findsOneWidget);
      expect(find.text('Lớp chưa có lộ trình'), findsWidgets);
      expect(
        tester
            .widget<OutlinedButton>(find.byKey(const Key('class-invite')))
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<OutlinedButton>(find.byKey(const Key('class-import')))
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('class-code-toggle')))
            .onPressed,
        isNull,
      );
      await tester.tap(find.byKey(const Key('class-set-path')));
      await tester.pumpAndSettle();
      expect(_location(tester), '/classes/class-1/path');
    },
  );

  testWidgets('mời bằng email: tách email, hiện kết quả từng email', (
    tester,
  ) async {
    final env = (await _open(
      tester,
      setup: (b) => b.reply(
        'POST /classes/class-1/invitations',
        200,
        <String, Object?>{
          'summary': <String, Object?>{'total': 2, 'invited': 1, 'no_seat': 1},
          'results': <Object?>[
            <String, Object?>{
              'row': 1,
              'email': 'a@example.com',
              'outcome': 'invited',
            },
            <String, Object?>{
              'row': 2,
              'email': 'b@example.com',
              'outcome': 'no_seat',
            },
          ],
        },
      ),
    )).env;
    await _tapKey(tester, 'class-invite');
    await tester.enterText(
      find.byKey(const Key('form-emails')),
      'a@example.com, b@example.com',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Mời bằng email'));
    await tester.pumpAndSettle();
    expect(
      requestJson(env.backend.sent('POST /classes/class-1/invitations').single),
      <String, Object?>{
        'invitees': <Object?>[
          <String, Object?>{'email': 'a@example.com'},
          <String, Object?>{'email': 'b@example.com'},
        ],
      },
    );
    expect(find.byKey(const Key('class-results')), findsOneWidget);
    expect(find.textContaining('Đã gửi lời mời'), findsWidgets);
    expect(find.textContaining('Hết seat'), findsOneWidget);
  });

  testWidgets(
    'nhập CSV: gửi nguyên văn tệp text/csv và hiện kết quả từng dòng',
    (tester) async {
      const csv =
          'email,display_name\r\nan@example.com,An\r\nkhong-hop-le,Sai\r\n';
      final opened = await _open(
        tester,
        pickResult: csv,
        setup: (b) => b.reply(
          'POST /classes/class-1/invitations/import',
          200,
          <String, Object?>{
            'summary': <String, Object?>{
              'total': 2,
              'invited': 1,
              'invalid_email': 1,
            },
            'results': <Object?>[
              <String, Object?>{
                'row': 1,
                'email': 'an@example.com',
                'outcome': 'invited',
              },
              <String, Object?>{
                'row': 2,
                'email': 'khong-hop-le',
                'outcome': 'invalid_email',
              },
            ],
          },
        ),
      );
      await _tapKey(tester, 'class-import');
      expect(opened.files.pickCalls, 1);
      final sent = opened.env.backend
          .sent('POST /classes/class-1/invitations/import')
          .single;
      expect(sent.data, csv);
      expect(sent.contentType, contains('text/csv'));
      expect(find.byKey(const Key('result-1')), findsOneWidget);
      expect(find.byKey(const Key('result-2')), findsOneWidget);
      expect(find.textContaining('Email không hợp lệ'), findsOneWidget);
      expect(find.text('Đã xử lý 2 dòng, gửi 1 lời mời.'), findsOneWidget);
    },
  );

  testWidgets('mã tham gia: bật gửi enabled=true và hiện mã', (tester) async {
    final env = (await _open(
      tester,
      setup: (b) => b.reply(
        'PUT /classes/class-1/join-code',
        200,
        <String, Object?>{'code': 'ABCD2345', 'enabled': true},
      ),
    )).env;
    expect(find.byKey(const Key('class-code-off')), findsOneWidget);
    // Sau khi bật, lần tải lại trả về mã đang bật.
    env.backend.reply('GET /classes/class-1/join-code', 200, <String, Object?>{
      'code': 'ABCD2345',
      'enabled': true,
    });
    await _tapKey(tester, 'class-code-toggle');
    expect(
      requestJson(env.backend.sent('PUT /classes/class-1/join-code').single),
      <String, Object?>{'enabled': true},
    );
    expect(find.text('ABCD2345'), findsOneWidget);
    expect(find.byKey(const Key('class-code-rotate')), findsOneWidget);
  });

  testWidgets('gỡ học viên cần xác nhận rồi gọi DELETE', (tester) async {
    final env = (await _open(
      tester,
      setup: (b) => b.reply('DELETE /classes/class-1/members/u1', 204),
    )).env;
    await _tapKey(tester, 'remove-u1');
    expect(find.textContaining('Gỡ An khỏi lớp?'), findsOneWidget);
    expect(env.backend.sent('DELETE /classes/class-1/members/u1'), isEmpty);
    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(FilledButton),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      env.backend.sent('DELETE /classes/class-1/members/u1'),
      hasLength(1),
    );
  });

  testWidgets('lưu trữ lớp: xác nhận nêu hậu quả rồi gửi confirm=true', (
    tester,
  ) async {
    final env = (await _open(
      tester,
      setup: (b) => b.reply(
        'POST /classes/class-1/archive',
        200,
        <String, Object?>{'learnersMoved': 1},
      ),
    )).env;
    await _tapKey(tester, 'class-archive');
    expect(find.textContaining('một chiều'), findsOneWidget);
    expect(find.textContaining('1 học viên đang học'), findsOneWidget);
    await tester.tap(
      find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(FilledButton),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      requestJson(env.backend.sent('POST /classes/class-1/archive').single),
      <String, Object?>{'confirm': true},
    );
  });

  testWidgets('lớp đã lưu trữ: chỉ xem, ẩn mọi thao tác ghi', (tester) async {
    await _open(
      tester,
      setup: (b) =>
          b.reply('GET /classes/class-1', 200, _detail(status: 'archived')),
    );
    expect(find.byKey(const Key('class-archived-banner')), findsOneWidget);
    expect(find.byKey(const Key('class-invite')), findsNothing);
    expect(find.byKey(const Key('class-archive')), findsNothing);
    expect(find.byKey(const Key('remove-u1')), findsNothing);
  });
}
