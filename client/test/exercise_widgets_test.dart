import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_api/japanese_api.dart';
import 'package:japanese_learning_client/l10n/app_localizations.dart';
import 'package:japanese_learning_client/presentation/lesson/exercises/exercise_view.dart';
import 'package:japanese_learning_client/presentation/lesson/lesson_screen.dart';

// Widget bài tập (T068): trắc nghiệm, ghép cặp, điền từ với phản hồi đúng/sai tức thì.

Widget _host(Widget child) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('vi'),
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

Exercise _exercise(ExerciseTypeEnum type, Map<String, Object?> payload) =>
    Exercise(id: 'ex', type: type, prompt: 'Đề bài', payload: payload);

void main() {
  testWidgets('trắc nghiệm: chạm một lựa chọn chốt đáp án là chỉ số lựa chọn', (
    tester,
  ) async {
    Object? submitted;
    await tester.pumpWidget(
      _host(
        ExerciseView(
          exercise: _exercise(
            ExerciseTypeEnum.multipleChoice,
            <String, Object?>{
              'choices': <String>['Trà', 'Nước', 'Cơm'],
            },
          ),
          onSubmit: (a) => submitted = a,
        ),
      ),
    );
    expect(find.text('Đề bài'), findsOneWidget);
    await tester.tap(find.byKey(const Key('choice-1')));
    expect(submitted, 1);
  });

  testWidgets('trắc nghiệm: có kết quả thì khóa nhập, không chốt lại', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      _host(
        ExerciseView(
          exercise: _exercise(
            ExerciseTypeEnum.multipleChoice,
            <String, Object?>{
              'choices': <String>['Trà', 'Nước'],
            },
          ),
          onSubmit: (_) => calls++,
          result: AnswerResult(isCorrect: false, correctAnswer: 1),
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('choice-0')), warnIfMissed: false);
    expect(calls, 0);
    final button = tester.widget<OutlinedButton>(
      find.byKey(const Key('choice-0')),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets('trắc nghiệm: đang gửi (enabled=false) thì không chốt', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      _host(
        ExerciseView(
          exercise: _exercise(
            ExerciseTypeEnum.multipleChoice,
            <String, Object?>{
              'choices': <String>['Trà', 'Nước'],
            },
          ),
          enabled: false,
          onSubmit: (_) => calls++,
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('choice-0')), warnIfMissed: false);
    expect(calls, 0);
  });

  testWidgets(
    'điền từ: nút Kiểm tra chỉ mở khi có nội dung; gửi chuỗi đã cắt khoảng trắng',
    (tester) async {
      Object? submitted;
      await tester.pumpWidget(
        _host(
          ExerciseView(
            exercise: _exercise(ExerciseTypeEnum.fillBlank, <String, Object?>{
              'hint': 'trợ từ',
            }),
            onSubmit: (a) => submitted = a,
          ),
        ),
      );
      expect(find.text('trợ từ'), findsOneWidget);
      FilledButton button() =>
          tester.widget<FilledButton>(find.byKey(const Key('submit-answer')));
      expect(button().onPressed, isNull);

      await tester.enterText(find.byKey(const Key('fill-blank-input')), '  は ');
      await tester.pump();
      expect(button().onPressed, isNotNull);
      await tester.tap(find.byKey(const Key('submit-answer')));
      expect(submitted, 'は');
    },
  );

  testWidgets(
    'ghép cặp: đủ cặp mới gửi; đáp án là danh sách [trái, phải]; chạm lại để bỏ cặp',
    (tester) async {
      Object? submitted;
      await tester.pumpWidget(
        _host(
          ExerciseView(
            exercise: _exercise(ExerciseTypeEnum.matching, <String, Object?>{
              'left': <String>['水', 'お茶'],
              'right': <String>['trà', 'nước'],
            }),
            onSubmit: (a) => submitted = a,
          ),
        ),
      );
      FilledButton submit() =>
          tester.widget<FilledButton>(find.byKey(const Key('submit-answer')));
      expect(submit().onPressed, isNull);

      // Chọn vế phải khi chưa chọn vế trái: không ghép.
      await tester.tap(find.byKey(const Key('match-right-0')));
      await tester.pump();
      expect(submit().onPressed, isNull);

      await tester.tap(find.byKey(const Key('match-left-0')));
      await tester.tap(find.byKey(const Key('match-right-1')));
      await tester.pump();
      expect(submit().onPressed, isNull); // mới 1/2 cặp

      // Chạm lại vế phải đã ghép → bỏ cặp; ghép lại đủ hai cặp.
      await tester.tap(find.byKey(const Key('match-right-1')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('match-left-0')));
      await tester.tap(find.byKey(const Key('match-right-1')));
      await tester.tap(find.byKey(const Key('match-left-1')));
      await tester.tap(find.byKey(const Key('match-right-0')));
      await tester.pump();
      expect(submit().onPressed, isNotNull);

      await tester.tap(find.byKey(const Key('submit-answer')));
      expect(submitted, <List<String>>[
        <String>['水', 'nước'],
        <String>['お茶', 'trà'],
      ]);

      // Nút "Chọn lại" xóa mọi cặp.
      await tester.tap(find.byKey(const Key('match-reset')));
      await tester.pump();
      expect(submit().onPressed, isNull);
    },
  );

  group('formatCorrectAnswer', () {
    test('trắc nghiệm: đổi chỉ số thành nội dung lựa chọn', () {
      final e = _exercise(ExerciseTypeEnum.multipleChoice, <String, Object?>{
        'choices': <String>['Trà', 'Nước'],
      });
      expect(formatCorrectAnswer(e, AnswerResult(correctAnswer: 1)), 'Nước');
      expect(formatCorrectAnswer(e, AnswerResult(correctAnswer: 9)), isNull);
      expect(formatCorrectAnswer(e, AnswerResult()), isNull);
    });

    test('ghép cặp và điền từ', () {
      final matching = _exercise(
        ExerciseTypeEnum.matching,
        <String, Object?>{},
      );
      expect(
        formatCorrectAnswer(
          matching,
          AnswerResult(
            correctAnswer: <List<String>>[
              <String>['水', 'nước'],
              <String>['お茶', 'trà'],
            ],
          ),
        ),
        '水 → nước · お茶 → trà',
      );
      final fill = _exercise(ExerciseTypeEnum.fillBlank, <String, Object?>{});
      expect(formatCorrectAnswer(fill, AnswerResult(correctAnswer: 'は')), 'は');
    });
  });
}
