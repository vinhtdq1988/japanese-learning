import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/auth/password_field.dart';

// Widget PasswordField dùng chung (T141, FR-002/003/004): che mặc định, bật/tắt giữ nguyên nội dung,
// trạng thái hiện chỉ nằm trong State, nút thao tác được bằng bàn phím và có nhãn trợ năng.
// Việc "không ghi vào LocalStore" được kiểm ở password_visibility_screens_test.dart (trên màn thật).

Widget _host({
  required TextEditingController controller,
  Key? fieldKey,
  Key? hostKey,
}) {
  return MaterialApp(
    localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('vi'),
    home: Scaffold(
      key: hostKey,
      body: PasswordField(
        key: fieldKey,
        controller: controller,
        decoration: const InputDecoration(labelText: 'Mật khẩu'),
      ),
    ),
  );
}

EditableText _editable(WidgetTester tester) =>
    tester.widget<EditableText>(find.byType(EditableText));

final Finder _toggle = find.byKey(const Key('password-visibility-toggle'));

void main() {
  testWidgets('mặc định che mật khẩu và có nút "Hiện mật khẩu"', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(controller: controller));

    expect(_editable(tester).obscureText, isTrue);
    expect(_toggle, findsOneWidget);
    expect(find.byTooltip('Hiện mật khẩu'), findsOneWidget);
    expect(find.byIcon(Icons.visibility), findsOneWidget);
  });

  testWidgets(
    'bấm nút mắt hiện rõ, đổi nhãn; bấm lại che và không mất nội dung',
    (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(_host(controller: controller));
      await tester.enterText(find.byType(EditableText), 'Matkhau-123');

      await tester.tap(_toggle);
      await tester.pump();
      expect(_editable(tester).obscureText, isFalse);
      expect(find.byTooltip('Ẩn mật khẩu'), findsOneWidget);
      expect(find.byTooltip('Hiện mật khẩu'), findsNothing);
      expect(controller.text, 'Matkhau-123');

      await tester.tap(_toggle);
      await tester.pump();
      expect(_editable(tester).obscureText, isTrue);
      expect(find.byTooltip('Hiện mật khẩu'), findsOneWidget);
      expect(controller.text, 'Matkhau-123');
    },
  );

  testWidgets('khi hiện: tắt gợi ý và tự sửa; khi che thì không đổi hành vi', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(controller: controller));

    await tester.tap(_toggle);
    await tester.pump();
    expect(_editable(tester).enableSuggestions, isFalse);
    expect(_editable(tester).autocorrect, isFalse);
  });

  testWidgets('dựng lại widget (rời rồi vào màn) ⇒ trở về che', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(controller: controller, fieldKey: UniqueKey()),
    );
    await tester.tap(_toggle);
    await tester.pump();
    expect(_editable(tester).obscureText, isFalse);

    // Khóa mới ⇒ State mới, như khi người dùng rời màn rồi quay lại.
    await tester.pumpWidget(
      _host(controller: controller, fieldKey: UniqueKey()),
    );
    expect(_editable(tester).obscureText, isTrue);
  });

  testWidgets('nút có nhãn trợ năng (Semantics) đổi theo trạng thái', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(controller: controller));

    expect(find.bySemanticsLabel('Hiện mật khẩu'), findsWidgets);
    await tester.tap(_toggle);
    await tester.pump();
    expect(find.bySemanticsLabel('Ẩn mật khẩu'), findsWidgets);
    handle.dispose();
  });

  testWidgets('nút focus được bằng bàn phím và Enter/Space kích hoạt', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(controller: controller));

    // Tab đầu tiên rời ô nhập, đến nút mắt.
    await tester.tap(find.byType(EditableText));
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    final focused = FocusManager.instance.primaryFocus!.context!;
    expect(
      find.descendant(
        of: _toggle,
        matching: find.byElementPredicate((e) => e == focused),
      ),
      findsOneWidget,
    );

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(_editable(tester).obscureText, isFalse);

    await tester.sendKeyEvent(LogicalKeyboardKey.space);
    await tester.pump();
    expect(_editable(tester).obscureText, isTrue);
  });
}
