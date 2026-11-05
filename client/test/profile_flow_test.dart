import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/platform/platform.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Hồ sơ, ngôn ngữ và tài khoản (T113, US7, FR-002, FR-003, FR-019a): sửa tên, đổi ngôn ngữ áp dụng ngay,
// đổi email/mật khẩu cần mật khẩu hiện tại, xóa tài khoản có xác nhận, lời mời khôi phục khi đăng nhập
// tài khoản đang chờ xóa.

/// Máy chủ giả có trạng thái cho các route tài khoản.
class _Account {
  _Account(this.backend, {this.status = 'active'}) {
    backend.on('GET /me', (_) => FakeResponse(200, _me()));
    backend.on('PATCH /me', (r) {
      final body = requestJson(r);
      patches.add(body);
      if (body.containsKey('email')) {
        if (body['currentPassword'] != password) {
          return const FakeResponse(401, <String, Object?>{
            'code': 'UNAUTHORIZED',
            'message': 'Mật khẩu hiện tại không đúng',
          });
        }
        if (body['email'] == 'taken@example.com') {
          return const FakeResponse(409, <String, Object?>{
            'code': 'EMAIL_TAKEN',
            'message': 'Email đã được sử dụng',
          });
        }
        email = body['email']! as String;
      }
      if (body.containsKey('displayName')) {
        profile['displayName'] = body['displayName'];
      }
      if (body.containsKey('language')) profile['language'] = body['language'];
      return FakeResponse(200, _me());
    });
    backend.on('PUT /me/password', (r) {
      final body = requestJson(r);
      passwordChanges.add(body);
      if (body['currentPassword'] != password) {
        return const FakeResponse(401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'Mật khẩu hiện tại không đúng',
        });
      }
      password = body['newPassword']! as String;
      return const FakeResponse(204);
    });
    backend.on('POST /account/delete', (r) {
      final body = requestJson(r);
      if (body['password'] != password) {
        return const FakeResponse(401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'Mật khẩu hiện tại không đúng',
        });
      }
      status = 'pending_deletion';
      return const FakeResponse(200, <String, Object?>{
        'permanentDeletionAt': '2026-02-04T08:00:00.000Z',
      });
    });
    backend.on('POST /account/restore', (_) {
      if (expired) {
        return const FakeResponse(410, <String, Object?>{
          'code': 'ACCOUNT_DELETED',
          'message': 'Đã quá 30 ngày',
        });
      }
      status = 'active';
      return FakeResponse(200, _me());
    });
    backend.on('POST /auth/refresh', (_) {
      return FakeResponse(200, <String, Object?>{
        'accessToken': fakeJwt(status: status),
        'refreshToken': 'refresh-2',
        'expiresIn': 900,
      });
    });
    backend.on('POST /auth/logout', (_) => const FakeResponse(204));
  }

  final FakeBackend backend;
  String status;
  String email = 'a@example.com';
  String password = 'Matkhau-Cu-123';
  bool expired = false;
  final List<Map<String, Object?>> patches = <Map<String, Object?>>[];
  final List<Map<String, Object?>> passwordChanges = <Map<String, Object?>>[];

  final Map<String, Object?> profile = <String, Object?>{
    'displayName': 'Học viên',
    'currentLevel': 'none',
    'goalType': 'daily_conversation',
    'dailyMinutes': 10,
    'skills': <String>['vocabulary', 'grammar'],
    'language': 'vi',
    'timezone': 'Asia/Ho_Chi_Minh',
    'paused': false,
    'onboardingState': 'completed',
  };

  Map<String, Object?> _me() => <String, Object?>{
    'id': 'user-1',
    'email': email,
    'role': 'learner',
    'status': status,
    'profile': Map<String, Object?>.from(profile),
  };
}

Future<({TestEnv env, _Account account})> _open(
  WidgetTester tester, {
  String route = '/profile',
  String status = 'active',
}) async {
  TestEnv.useDesktopSize(tester);
  tester.view.physicalSize = const Size(1280, 2400);
  addTearDown(tester.view.reset);
  final env = TestEnv(
    tokens: StoredTokens(
      accessToken: fakeJwt(status: status),
      refreshToken: 'refresh-1',
    ),
  );
  LearningScenario(env.backend).onboarded = true;
  final account = _Account(env.backend, status: status);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  if (status == 'active') {
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
    await tester.pumpAndSettle();
  }
  return (env: env, account: account);
}

Future<void> _type(WidgetTester tester, String key, String text) async {
  await tester.ensureVisible(find.byKey(Key(key)));
  await tester.enterText(find.byKey(Key(key)), text);
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  group('hồ sơ', () {
    testWidgets('hiển thị email, tên hiển thị và ngôn ngữ hiện tại', (
      tester,
    ) async {
      await _open(tester);
      expect(find.text('Email hiện tại: a@example.com'), findsOneWidget);
      final name = tester.widget<TextFormField>(
        find.byKey(const Key('profile-display-name')),
      );
      expect(name.controller!.text, 'Học viên');
    });

    testWidgets('lưu tên hiển thị gửi PATCH /me chỉ với displayName', (
      tester,
    ) async {
      final t = await _open(tester);
      await _type(tester, 'profile-display-name', '  Tên mới  ');
      await _tap(tester, 'profile-save-info');
      expect(t.account.patches, <Map<String, Object?>>[
        <String, Object?>{'displayName': 'Tên mới'},
      ]);
      expect(find.text('Đã lưu thay đổi.'), findsOneWidget);
    });

    testWidgets('tên trống: báo lỗi, không gọi API', (tester) async {
      final t = await _open(tester);
      await _type(tester, 'profile-display-name', '   ');
      await _tap(tester, 'profile-save-info');
      expect(find.text('Vui lòng nhập tên hiển thị.'), findsOneWidget);
      expect(t.account.patches, isEmpty);
    });
  });

  group('ngôn ngữ', () {
    testWidgets('chọn English đổi giao diện ngay và lưu language=en', (
      tester,
    ) async {
      final t = await _open(tester);
      expect(find.text('Thông tin cá nhân'), findsOneWidget);

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();

      expect(find.text('Personal information'), findsOneWidget);
      expect(find.text('Thông tin cá nhân'), findsNothing);
      expect(t.account.patches, <Map<String, Object?>>[
        <String, Object?>{'language': 'en'},
      ]);
      expect(find.text('Language changed.'), findsOneWidget);
    });

    testWidgets(
      'lưu thất bại: giao diện trở về ngôn ngữ cũ kèm thông báo lỗi',
      (tester) async {
        final t = await _open(tester);
        t.env.backend.on(
          'PATCH /me',
          (_) => const FakeResponse(500, <String, Object?>{
            'code': 'INTERNAL_ERROR',
            'message': 'Lỗi hệ thống',
          }),
        );
        await tester.tap(find.text('English'));
        await tester.pumpAndSettle();

        expect(find.text('Thông tin cá nhân'), findsOneWidget);
        expect(find.text('Đã đổi ngôn ngữ.'), findsNothing);
        expect(find.byIcon(Icons.error_outline), findsWidgets);
      },
    );

    testWidgets('đăng nhập lại: giao diện theo ngôn ngữ đã lưu trong hồ sơ', (
      tester,
    ) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      final env = TestEnv(tokens: signedInTokens());
      LearningScenario(env.backend).onboarded = true;
      final account = _Account(env.backend)..profile['language'] = 'en';
      await tester.pumpWidget(env.app());
      await tester.pumpAndSettle();
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/profile');
      await tester.pumpAndSettle();

      expect(account.profile['language'], 'en');
      expect(find.text('Personal information'), findsOneWidget);
    });
  });

  group('đổi email', () {
    testWidgets('mật khẩu hiện tại sai: lỗi ở ô mật khẩu, email không đổi', (
      tester,
    ) async {
      final t = await _open(tester);
      await _type(tester, 'profile-new-email', 'moi@example.com');
      await _type(tester, 'profile-email-password', 'Sai-Mat-Khau-1');
      await _tap(tester, 'profile-change-email');
      expect(find.text('Mật khẩu hiện tại không đúng.'), findsOneWidget);
      expect(t.account.email, 'a@example.com');
    });

    testWidgets('email đã được dùng: lỗi cụ thể ở ô email', (tester) async {
      await _open(tester);
      await _type(tester, 'profile-new-email', 'taken@example.com');
      await _type(tester, 'profile-email-password', 'Matkhau-Cu-123');
      await _tap(tester, 'profile-change-email');
      expect(find.text('Email này đã được sử dụng.'), findsOneWidget);
    });

    testWidgets(
      'thành công: cập nhật email hiển thị và gửi kèm currentPassword',
      (tester) async {
        final t = await _open(tester);
        await _type(tester, 'profile-new-email', 'moi@example.com');
        await _type(tester, 'profile-email-password', 'Matkhau-Cu-123');
        await _tap(tester, 'profile-change-email');

        expect(t.account.patches.single, <String, Object?>{
          'email': 'moi@example.com',
          'currentPassword': 'Matkhau-Cu-123',
        });
        expect(find.text('Đã đổi email.'), findsOneWidget);
        expect(find.text('Email hiện tại: moi@example.com'), findsOneWidget);
      },
    );

    testWidgets(
      'thiếu mật khẩu hiện tại hoặc email sai định dạng: không gọi API',
      (tester) async {
        final t = await _open(tester);
        await _type(tester, 'profile-new-email', 'khong-hop-le');
        await _tap(tester, 'profile-change-email');
        expect(find.text('Email không đúng định dạng.'), findsOneWidget);
        expect(find.text('Vui lòng nhập mật khẩu hiện tại.'), findsOneWidget);
        expect(t.account.patches, isEmpty);
      },
    );
  });

  group('đổi mật khẩu', () {
    testWidgets('nhập lại không khớp: báo lỗi, không gọi API', (tester) async {
      final t = await _open(tester);
      await _type(tester, 'profile-current-password', 'Matkhau-Cu-123');
      await _type(tester, 'profile-new-password', 'Matkhau-Moi-456');
      await _type(tester, 'profile-repeat-password', 'Khac-Hoan-Toan-1');
      await _tap(tester, 'profile-change-password');
      expect(find.text('Mật khẩu nhập lại không khớp.'), findsOneWidget);
      expect(t.account.passwordChanges, isEmpty);
    });

    testWidgets('mật khẩu hiện tại sai: lỗi ở ô mật khẩu hiện tại', (
      tester,
    ) async {
      await _open(tester);
      await _type(tester, 'profile-current-password', 'Sai-Mat-Khau-1');
      await _type(tester, 'profile-new-password', 'Matkhau-Moi-456');
      await _type(tester, 'profile-repeat-password', 'Matkhau-Moi-456');
      await _tap(tester, 'profile-change-password');
      expect(find.text('Mật khẩu hiện tại không đúng.'), findsOneWidget);
    });

    testWidgets('thành công: gửi PUT /me/password, xóa ô nhập, giữ đăng nhập', (
      tester,
    ) async {
      final t = await _open(tester);
      await _type(tester, 'profile-current-password', 'Matkhau-Cu-123');
      await _type(tester, 'profile-new-password', 'Matkhau-Moi-456');
      await _type(tester, 'profile-repeat-password', 'Matkhau-Moi-456');
      await _tap(tester, 'profile-change-password');

      expect(t.account.passwordChanges.single, <String, Object?>{
        'currentPassword': 'Matkhau-Cu-123',
        'newPassword': 'Matkhau-Moi-456',
      });
      expect(
        find.text('Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.'),
        findsOneWidget,
      );
      final field = tester.widget<TextFormField>(
        find.byKey(const Key('profile-new-password')),
      );
      expect(field.controller!.text, isEmpty);
      expect(find.byKey(const Key('profile-display-name')), findsOneWidget);
    });
  });

  group('xóa tài khoản', () {
    testWidgets('hủy ở hộp thoại xác nhận: không gọi API', (tester) async {
      final t = await _open(tester);
      await _type(tester, 'profile-delete-password', 'Matkhau-Cu-123');
      await _tap(tester, 'profile-delete');
      expect(find.text('Xóa tài khoản?'), findsOneWidget);
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(t.env.backend.sent('POST /account/delete'), isEmpty);
      expect(t.account.status, 'active');
    });

    testWidgets('mật khẩu sai: lỗi ở ô mật khẩu, vẫn đăng nhập', (
      tester,
    ) async {
      final t = await _open(tester);
      await _type(tester, 'profile-delete-password', 'Sai-Mat-Khau-1');
      await _tap(tester, 'profile-delete');
      await tester.tap(find.widgetWithText(FilledButton, 'Xóa tài khoản').last);
      await tester.pumpAndSettle();
      expect(find.text('Mật khẩu hiện tại không đúng.'), findsOneWidget);
      expect(t.account.status, 'active');
      expect(await t.env.tokenStore.read(), isNotNull);
    });

    testWidgets('xác nhận: xóa token cục bộ ngay và rời khu vực đăng nhập', (
      tester,
    ) async {
      final t = await _open(tester);
      await _type(tester, 'profile-delete-password', 'Matkhau-Cu-123');
      await _tap(tester, 'profile-delete');
      await tester.tap(find.widgetWithText(FilledButton, 'Xóa tài khoản').last);
      await tester.pumpAndSettle();

      expect(t.account.status, 'pending_deletion');
      expect(await t.env.tokenStore.read(), isNull);
      expect(find.byKey(const Key('profile-delete')), findsNothing);
      expect(
        find.text(
          'Đã yêu cầu xóa tài khoản. Đăng nhập lại trong 30 ngày để khôi phục.',
        ),
        findsOneWidget,
      );
    });
  });

  group('đăng xuất', () {
    testWidgets('nút đăng xuất thu hồi phiên và xóa token', (tester) async {
      final t = await _open(tester);
      await _tap(tester, 'profile-sign-out');
      expect(t.env.backend.sent('POST /auth/logout'), hasLength(1));
      expect(await t.env.tokenStore.read(), isNull);
    });
  });

  group('khôi phục tài khoản đang chờ xóa', () {
    testWidgets('phiên pending_deletion được đưa tới lời mời khôi phục', (
      tester,
    ) async {
      await _open(tester, status: 'pending_deletion');
      expect(find.text('Tài khoản đang chờ xóa'), findsWidgets);
      expect(find.byKey(const Key('restore-account')), findsOneWidget);
      expect(find.byKey(const Key('restore-sign-out')), findsOneWidget);
    });

    testWidgets('khôi phục: gọi restore, làm mới token rồi vào "Hôm nay"', (
      tester,
    ) async {
      final t = await _open(tester, status: 'pending_deletion');
      await _tap(tester, 'restore-account');

      expect(t.env.backend.sent('POST /account/restore'), hasLength(1));
      expect(t.env.backend.sent('POST /auth/refresh'), hasLength(1));
      final stored = await t.env.tokenStore.read();
      expect(stored!.refreshToken, 'refresh-2');
      expect(find.byKey(const Key('restore-account')), findsNothing);
      expect(find.text('Hôm nay'), findsWidgets);
    });

    testWidgets('quá 30 ngày (410): báo dữ liệu đã bị xóa, chỉ còn đăng xuất', (
      tester,
    ) async {
      final t = await _open(tester, status: 'pending_deletion');
      t.account.expired = true;
      await _tap(tester, 'restore-account');

      expect(find.textContaining('Đã quá 30 ngày'), findsWidgets);
      expect(find.byKey(const Key('restore-account')), findsNothing);
      expect(find.byKey(const Key('restore-sign-out')), findsOneWidget);
      expect(t.env.backend.sent('POST /auth/refresh'), isEmpty);
    });

    testWidgets('đăng xuất từ lời mời khôi phục về trang công khai', (
      tester,
    ) async {
      final t = await _open(tester, status: 'pending_deletion');
      await _tap(tester, 'restore-sign-out');
      expect(await t.env.tokenStore.read(), isNull);
      expect(find.byKey(const Key('restore-account')), findsNothing);
    });
  });
}
