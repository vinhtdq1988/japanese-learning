import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/presentation/auth/password_field.dart';

import '../support/fake_backend.dart';

// Xem mật khẩu trên các màn xác thực (T142, FR-001…FR-005): đăng nhập, đăng ký, đặt lại mật khẩu.

Future<void> _open(WidgetTester tester, TestEnv env, String route) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
}

final Finder _toggle = find.byKey(const Key('password-visibility-toggle'));

bool _obscured(WidgetTester tester) => tester
    .widget<EditableText>(
      find.descendant(
        of: find.byKey(const Key('password')),
        matching: find.byType(EditableText),
      ),
    )
    .obscureText;

void main() {
  for (final route in <String, String>{
    'đăng nhập': '/login',
    'đăng ký': '/register',
    'đặt lại mật khẩu': '/reset-password?token=abc123',
  }.entries) {
    testWidgets('${route.key}: dùng PasswordField, che mặc định, có nút xem', (
      tester,
    ) async {
      final env = TestEnv();
      await _open(tester, env, route.value);

      expect(find.byType(PasswordField), findsOneWidget);
      expect(_obscured(tester), isTrue);
      expect(_toggle, findsOneWidget);

      await tester.enterText(find.byKey(const Key('password')), 'Matkhau-123');
      await tester.tap(_toggle);
      await tester.pump();
      expect(_obscured(tester), isFalse);
      // Bật chế độ xem không ghi gì vào bộ nhớ cục bộ (FR-003).
      expect(env.localStore.snapshot, isEmpty);
    });
  }

  testWidgets('đăng nhập sai khi đang xem: thông báo lỗi không chứa mật khẩu', (
    tester,
  ) async {
    final env = TestEnv();
    env.backend.reply('POST /auth/login', 401, <String, Object?>{
      'code': 'UNAUTHORIZED',
      'message': 'Email hoặc mật khẩu không đúng',
    });
    await _open(tester, env, '/login');
    await tester.enterText(find.byKey(const Key('email')), 'an@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'Bi-mat-9999');
    await tester.tap(_toggle);
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit')));
    await tester.pumpAndSettle();

    expect(find.text('Email hoặc mật khẩu không đúng.'), findsOneWidget);
    // Chỉ xét các Text hiển thị (EditableText của chính ô nhập không tính).
    expect(
      find.byWidgetPredicate(
        (w) => w is Text && (w.data ?? '').contains('Bi-mat-9999'),
      ),
      findsNothing,
    );
  });

  testWidgets('Đăng nhập → Đăng ký → Đăng nhập: ô trống và che', (
    tester,
  ) async {
    final env = TestEnv();
    await _open(tester, env, '/login');
    await tester.enterText(find.byKey(const Key('password')), 'Matkhau-123');
    await tester.tap(_toggle);
    await tester.pump();

    await tester.tap(find.byKey(const Key('register-link')));
    await tester.pumpAndSettle();
    expect(_obscured(tester), isTrue);

    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/login');
    await tester.pumpAndSettle();
    expect(_obscured(tester), isTrue);
    final field = tester.widget<EditableText>(
      find.descendant(
        of: find.byKey(const Key('password')),
        matching: find.byType(EditableText),
      ),
    );
    expect(field.controller.text, isEmpty);
  });

  testWidgets('màn hẹp vẫn thấy và bấm được nút xem', (tester) async {
    final env = TestEnv();
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/login');
    await tester.pumpAndSettle();

    expect(_toggle, findsOneWidget);
    await tester.ensureVisible(_toggle);
    await tester.tap(_toggle);
    await tester.pump();
    expect(_obscured(tester), isFalse);
  });
}
