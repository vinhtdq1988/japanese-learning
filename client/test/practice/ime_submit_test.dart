import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/exercises/fill_blank_exercise.dart';

// Ô nhập điền từ không nộp bài khi Enter chỉ để chốt chữ IME (spec 007, US2, T055, research §P6).

Widget _host(Widget child) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('vi'),
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

TextEditingController _controllerOf(WidgetTester tester) => tester
    .widget<TextField>(find.byKey(const Key('fill-blank-input')))
    .controller!;

void main() {
  testWidgets(
    'đang soạn IME (composing hợp lệ) + Enter ⇒ KHÔNG nộp; hết soạn + Enter ⇒ nộp',
    (tester) async {
      final submitted = <Object?>[];
      await tester.pumpWidget(
        _host(FillBlankExercise(enabled: true, onSubmit: submitted.add)),
      );
      await tester.showKeyboard(find.byKey(const Key('fill-blank-input')));

      // Mô phỏng IME tiếng Nhật đang soạn "にほん" (chưa chốt chuyển đổi sang Kanji).
      final controller = _controllerOf(tester);
      controller.value = const TextEditingValue(
        text: 'にほん',
        selection: TextSelection.collapsed(offset: 3),
        composing: TextRange(start: 0, end: 3),
      );
      await tester.pump();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(submitted, isEmpty, reason: 'Enter chỉ chốt chữ khi đang soạn');

      // Hết soạn: Enter nộp bài.
      controller.value = const TextEditingValue(
        text: '日本',
        selection: TextSelection.collapsed(offset: 2),
      );
      await tester.pump();
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();
      expect(submitted, <Object?>['日本']);
    },
  );

  testWidgets('nút "Kiểm tra" luôn dùng được, kể cả khi đang soạn IME', (
    tester,
  ) async {
    final submitted = <Object?>[];
    await tester.pumpWidget(
      _host(FillBlankExercise(enabled: true, onSubmit: submitted.add)),
    );
    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'みず');
    await tester.pump();
    final controller = _controllerOf(tester);
    controller.value = const TextEditingValue(
      text: 'みず',
      selection: TextSelection.collapsed(offset: 2),
      composing: TextRange(start: 0, end: 2),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit-answer')));
    await tester.pump();
    expect(submitted, <Object?>['みず']);
  });

  testWidgets('nhập thường (không soạn) + Enter nộp ngay', (tester) async {
    final submitted = <Object?>[];
    await tester.pumpWidget(
      _host(FillBlankExercise(enabled: true, onSubmit: submitted.add)),
    );
    await tester.showKeyboard(find.byKey(const Key('fill-blank-input')));
    await tester.enterText(find.byKey(const Key('fill-blank-input')), 'はい');
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(submitted, <Object?>['はい']);
  });
}
