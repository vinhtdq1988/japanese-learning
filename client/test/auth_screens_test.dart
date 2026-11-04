import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Màn hình xác thực (T052): kiểm tra phía client, lỗi cụ thể theo mã của hợp đồng, luồng đặt lại.

Future<void> _open(WidgetTester tester, TestEnv env, String route) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
}

Future<void> _type(WidgetTester tester, String key, String text) async {
  await tester.enterText(find.byKey(Key(key)), text);
}

Future<void> _submit(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('submit')));
  await tester.pumpAndSettle();
}

void main() {
  group('đăng ký', () {
    testWidgets('bỏ trống: báo lỗi từng trường và không gọi API', (
      tester,
    ) async {
      final env = TestEnv();
      await _open(tester, env, '/register');
      await _submit(tester);
      expect(find.text('Vui lòng nhập tên hiển thị.'), findsOneWidget);
      expect(find.text('Vui lòng nhập email.'), findsOneWidget);
      expect(find.text('Vui lòng nhập mật khẩu.'), findsOneWidget);
      expect(
        env.backend.requests.where((r) => r.path == '/auth/register'),
        isEmpty,
      );
    });

    testWidgets('email sai định dạng và mật khẩu ngắn bị chặn phía client', (
      tester,
    ) async {
      final env = TestEnv();
      await _open(tester, env, '/register');
      await _type(tester, 'displayName', 'An');
      await _type(tester, 'email', 'khong-phai-email');
      await _type(tester, 'password', '123');
      await _submit(tester);
      expect(find.text('Email không đúng định dạng.'), findsOneWidget);
      expect(find.text('Mật khẩu phải có ít nhất 8 ký tự.'), findsOneWidget);
      expect(env.backend.sent('POST /auth/register'), isEmpty);
    });

    testWidgets(
      'thành công: gửi ngôn ngữ + múi giờ, đăng nhập luôn rồi vào onboarding',
      (tester) async {
        final env = TestEnv();
        LearningScenario(env.backend);
        await _open(tester, env, '/register');
        await _type(tester, 'displayName', ' An ');
        await _type(tester, 'email', 'an@example.com');
        await _type(tester, 'password', 'Matkhau-123');
        await _submit(tester);

        final sent = requestJson(
          env.backend.sent('POST /auth/register').single,
        );
        expect(sent['email'], 'an@example.com');
        expect(sent['displayName'], 'An');
        expect(sent['language'], 'vi');
        expect(sent['timezone'], 'Asia/Ho_Chi_Minh');
        expect(sent['fromTrial'], false);
        expect(await env.tokenStore.read(), isNotNull);
        // Chưa onboarding → "Hôm nay" nhận 404 → vào luồng onboarding.
        expect(find.text('Thiết lập lộ trình'), findsWidgets);
      },
    );

    testWidgets('EMAIL_TAKEN: báo ngay ở ô email', (tester) async {
      final env = TestEnv();
      env.backend.reply('POST /auth/register', 409, <String, Object?>{
        'code': 'EMAIL_TAKEN',
        'message': 'Email đã được sử dụng',
      });
      await _open(tester, env, '/register');
      await _type(tester, 'displayName', 'An');
      await _type(tester, 'email', 'an@example.com');
      await _type(tester, 'password', 'Matkhau-123');
      await _submit(tester);
      expect(find.text('Email này đã được sử dụng.'), findsOneWidget);
      expect(find.byKey(const Key('pending-deletion-hint')), findsNothing);
    });

    testWidgets('EMAIL_PENDING_DELETION: gợi ý đăng nhập để khôi phục', (
      tester,
    ) async {
      final env = TestEnv();
      env.backend.reply('POST /auth/register', 409, <String, Object?>{
        'code': 'EMAIL_PENDING_DELETION',
        'message': 'Email thuộc tài khoản đang chờ xóa',
      });
      await _open(tester, env, '/register');
      await _type(tester, 'displayName', 'An');
      await _type(tester, 'email', 'an@example.com');
      await _type(tester, 'password', 'Matkhau-123');
      await _submit(tester);
      expect(
        find.text('Email này thuộc một tài khoản đang chờ xóa.'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('pending-deletion-hint')), findsOneWidget);
      await tester.tap(find.byKey(const Key('sign-in-to-restore')));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('forgot-password-link')),
        findsOneWidget,
      ); // đã ở màn hình đăng nhập
    });

    testWidgets(
      'lỗi theo trường từ server (mật khẩu yếu) được hiển thị ở ô mật khẩu',
      (tester) async {
        final env = TestEnv();
        env.backend.reply('POST /auth/register', 422, <String, Object?>{
          'code': 'VALIDATION_FAILED',
          'message': 'Dữ liệu không hợp lệ',
          'fields': <String, String>{'password': 'Mật khẩu quá yếu'},
        });
        await _open(tester, env, '/register');
        await _type(tester, 'displayName', 'An');
        await _type(tester, 'email', 'an@example.com');
        await _type(tester, 'password', 'Password1');
        await _submit(tester);
        expect(find.text('Mật khẩu quá yếu'), findsOneWidget);
      },
    );
  });

  group('đăng nhập', () {
    testWidgets(
      'sai thông tin: thông báo chung, không lộ email có tồn tại hay không',
      (tester) async {
        final env = TestEnv();
        env.backend.reply('POST /auth/login', 401, <String, Object?>{
          'code': 'UNAUTHORIZED',
          'message': 'Email hoặc mật khẩu không đúng',
        });
        await _open(tester, env, '/login');
        await _type(tester, 'email', 'an@example.com');
        await _type(tester, 'password', 'sai-mat-khau');
        await _submit(tester);
        expect(find.text('Email hoặc mật khẩu không đúng.'), findsOneWidget);
        expect(await env.tokenStore.read(), isNull);
      },
    );

    testWidgets('tài khoản bị vô hiệu hóa: thông báo riêng', (tester) async {
      final env = TestEnv();
      env.backend.reply('POST /auth/login', 403, <String, Object?>{
        'code': 'ACCOUNT_DISABLED',
        'message': 'Tài khoản đã bị vô hiệu hóa',
      });
      await _open(tester, env, '/login');
      await _type(tester, 'email', 'an@example.com');
      await _type(tester, 'password', 'Matkhau-123');
      await _submit(tester);
      expect(find.textContaining('vô hiệu hóa'), findsOneWidget);
    });

    testWidgets('thành công: lưu token và vào ứng dụng', (tester) async {
      final env = TestEnv();
      LearningScenario(env.backend).onboarded = true;
      await _open(tester, env, '/login');
      await _type(tester, 'email', 'an@example.com');
      await _type(tester, 'password', 'Matkhau-123');
      await _submit(tester);
      expect(await env.tokenStore.read(), isNotNull);
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    });
  });

  group('quên và đặt lại mật khẩu', () {
    testWidgets('quên mật khẩu: thông báo gửi giống nhau', (tester) async {
      final env = TestEnv();
      env.backend.reply('POST /auth/password-reset/request', 202);
      await _open(tester, env, '/forgot-password');
      await _type(tester, 'email', 'bat-ky@example.com');
      await _submit(tester);
      expect(find.byKey(const Key('reset-sent')), findsOneWidget);
      expect(
        env.backend.sent('POST /auth/password-reset/request'),
        hasLength(1),
      );
    });

    testWidgets('đặt lại thành công với token trong liên kết', (tester) async {
      final env = TestEnv();
      env.backend.reply('POST /auth/password-reset/confirm', 204);
      await _open(tester, env, '/reset-password?token=abc123');
      await _type(tester, 'password', 'Mat-Khau-Moi-789');
      await _submit(tester);
      final sent = requestJson(
        env.backend.sent('POST /auth/password-reset/confirm').single,
      );
      expect(sent['token'], 'abc123');
      expect(sent['newPassword'], 'Mat-Khau-Moi-789');
      expect(find.byKey(const Key('reset-done')), findsOneWidget);
    });

    testWidgets(
      'liên kết hết hạn/đã dùng: báo lỗi và gợi ý yêu cầu liên kết mới',
      (tester) async {
        final env = TestEnv();
        env.backend.reply(
          'POST /auth/password-reset/confirm',
          400,
          <String, Object?>{
            'code': 'RESET_TOKEN_INVALID',
            'message': 'Token hết hạn',
          },
        );
        await _open(tester, env, '/reset-password?token=cu');
        await _type(tester, 'password', 'Mat-Khau-Moi-789');
        await _submit(tester);
        expect(
          find.textContaining('đã hết hạn hoặc đã được sử dụng'),
          findsOneWidget,
        );
        expect(find.byKey(const Key('request-new-link')), findsOneWidget);
      },
    );

    testWidgets('thiếu token trong liên kết: gợi ý yêu cầu liên kết mới', (
      tester,
    ) async {
      final env = TestEnv();
      await _open(tester, env, '/reset-password');
      expect(find.byKey(const Key('request-new-link')), findsOneWidget);
      expect(find.byKey(const Key('submit')), findsNothing);
    });
  });
}
