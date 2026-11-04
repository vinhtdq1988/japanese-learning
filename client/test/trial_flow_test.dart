import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/domain/trial_grading.dart';
import 'package:japanese_learning_client/presentation/trial/trial_state.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';
import 'support/trial_scenario.dart';

// Dùng thử không đăng ký (US8, T099–T101): chấm cục bộ, trạng thái ở trình duyệt, bài mẫu, kiểm tra
// trình độ dùng thử, tính năng cần tài khoản và mang kết quả sang onboarding.

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

/// Khách chưa đăng nhập, mở thẳng [route] (mặc định trang đầu).
Future<TestEnv> _guest(
  WidgetTester tester, {
  String? route,
  void Function(TestEnv)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv();
  TrialScenario(env.backend);
  LearningScenario(env.backend);
  setup?.call(env);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  if (route != null) {
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
    await tester.pumpAndSettle();
  }
  return env;
}

Future<Map<String, Object?>?> _storedState(TestEnv env) async {
  final raw = await env.localStore.getString(TrialController.storageKey);
  return raw == null ? null : jsonDecode(raw) as Map<String, Object?>;
}

Future<void> _answerFillBlank(WidgetTester tester, String text) async {
  await tester.enterText(find.byKey(const Key('fill-blank-input')), text);
  await tester.pump();
  await _tap(tester, 'submit-answer');
}

void main() {
  group('chấm cục bộ (gradeTrialAnswer)', () {
    test('trắc nghiệm chỉ đúng khi trùng chỉ số', () {
      const key = ChoiceAnswerKey(1);
      expect(gradeTrialAnswer(key, 1).isCorrect, isTrue);
      expect(gradeTrialAnswer(key, 0).isCorrect, isFalse);
      expect(gradeTrialAnswer(key, '1').isCorrect, isFalse);
      expect(gradeTrialAnswer(key, 0).correctAnswer, 1);
    });

    test('điền từ chuẩn hóa khoảng trắng, hoa thường và ký tự toàn chiều', () {
      const key = FillBlankAnswerKey(<String>['desu', 'です']);
      expect(gradeTrialAnswer(key, '  DESU ').isCorrect, isTrue);
      expect(gradeTrialAnswer(key, 'ＤＥＳＵ').isCorrect, isTrue);
      expect(gradeTrialAnswer(key, 'です').isCorrect, isTrue);
      expect(gradeTrialAnswer(key, 'da').isCorrect, isFalse);
      expect(gradeTrialAnswer(key, 5).isCorrect, isFalse);
      expect(gradeTrialAnswer(key, 'x').correctAnswer, 'desu');
      expect(normalizeTrialAnswer('a　  b'), 'a b');
    });

    test('ghép cặp cần đủ cặp, thứ tự tùy ý, không trùng', () {
      const key = MatchingAnswerKey(<List<String>>[
        <String>['水', 'nước'],
        <String>['お茶', 'trà'],
      ]);
      expect(
        gradeTrialAnswer(key, <List<String>>[
          <String>['お茶', 'trà'],
          <String>['水', 'nước'],
        ]).isCorrect,
        isTrue,
      );
      expect(
        gradeTrialAnswer(key, <List<String>>[
          <String>['水', 'trà'],
          <String>['お茶', 'nước'],
        ]).isCorrect,
        isFalse,
      );
      expect(
        gradeTrialAnswer(key, <List<String>>[
          <String>['水', 'nước'],
          <String>['水', 'nước'],
        ]).isCorrect,
        isFalse,
      );
      expect(gradeTrialAnswer(key, <List<String>>[]).isCorrect, isFalse);
      expect(gradeTrialAnswer(key, 'sai kiểu').isCorrect, isFalse);
    });
  });

  group('TrialState', () {
    test('đi về JSON giữ nguyên các trường', () {
      final state = TrialState(
        startedAt: DateTime.utc(2026, 1, 5, 8),
        completedUnitIds: const <String>['u1'],
        lessonEventSent: true,
        answers: const <String, bool>{'e1': true, 'e2': false},
        placementAnswers: const <String, int?>{'q1': 2, 'q2': null},
        placementDurationSeconds: 120,
      );
      final back = TrialState.fromJson(jsonDecode(jsonEncode(state.toJson())));
      expect(back.startedAt, state.startedAt);
      expect(back.completedUnitIds, <String>['u1']);
      expect(back.lessonEventSent, isTrue);
      expect(back.answers, state.answers);
      expect(back.placementAnswers, state.placementAnswers);
      expect(back.placementDurationSeconds, 120);
      expect(back.hasActivity, isTrue);
      expect(back.hasPlacement, isTrue);
    });

    test('dữ liệu hỏng hoặc phiên bản lạ cho trạng thái trống', () {
      expect(TrialState.fromJson(null).hasActivity, isFalse);
      expect(TrialState.fromJson('rác').hasActivity, isFalse);
      expect(
        TrialState.fromJson(<String, Object?>{'v': 99}).hasActivity,
        isFalse,
      );
      expect(
        TrialState.fromJson(<String, Object?>{
          'v': 1,
          'answers': 'không phải map',
          'completedUnitIds': 5,
        }).answers,
        isEmpty,
      );
    });
  });

  group('luồng dùng thử', () {
    testWidgets(
      'từ trang đầu tới bài tập đầu tiên trong ≤ 3 lần nhấp; học xong thì báo sự kiện đúng một lần',
      (tester) async {
        final env = await _guest(tester);

        // Nhấp 1: "Dùng thử"; nhấp 2: "Bắt đầu bài mẫu"; nhấp 3: "Bắt đầu làm bài tập".
        await _tap(tester, 'landing-trial');
        expect(
          find.text('Dùng thử miễn phí, không cần đăng ký'),
          findsOneWidget,
        );
        await _tap(tester, 'trial-start-lesson');
        expect(find.text('こんにちは'), findsWidgets);
        await _tap(tester, 'trial-start-exercises');
        expect(find.byKey(const Key('exercise-prompt')), findsOneWidget);

        // Đơn vị 1: trắc nghiệm sai (phản hồi tức thì kèm đáp án đúng), rồi điền từ đúng.
        await _tap(tester, 'choice-0');
        expect(_has('feedback-incorrect'), isTrue);
        expect(find.text('Đáp án đúng: Xin chào'), findsOneWidget);
        await _tap(tester, 'continue');
        await _answerFillBlank(tester, 'は');
        expect(_has('feedback-correct'), isTrue);
        await _tap(tester, 'continue');

        expect(_has('trial-unit-done'), isTrue);
        expect(find.text('Đúng 1/2 câu'), findsOneWidget);
        await _tap(tester, 'trial-next-unit');

        // Đơn vị 2: ghép cặp đúng (vế phải hiển thị [trà, nước]).
        await _tap(tester, 'trial-start-exercises');
        await _tap(tester, 'match-left-0');
        await _tap(tester, 'match-right-1');
        await _tap(tester, 'match-left-1');
        await _tap(tester, 'match-right-0');
        await _tap(tester, 'submit-answer');
        expect(_has('feedback-correct'), isTrue);
        await _tap(tester, 'continue');
        expect(_has('trial-unit-done'), isTrue);
        await _tap(tester, 'trial-next-unit');

        // Hết nội dung dùng thử: màn hình mời đăng ký; sự kiện chỉ được gửi một lần.
        expect(_has('trial-finished-heading'), isTrue);
        expect(find.text('Tổng kết: đúng 2/3 câu'), findsOneWidget);
        expect(env.backend.sent('POST /trial/events'), hasLength(1));
        expect(
          requestJson(env.backend.sent('POST /trial/events').single),
          <String, Object?>{'event': 'lesson_completed'},
        );

        // Trạng thái nằm ở trình duyệt; không có yêu cầu nào tới tính năng cần tài khoản.
        final stored = (await _storedState(env))!;
        expect(stored['completedUnitIds'], <String>[
          'unit-vocab',
          'unit-grammar',
        ]);
        expect(stored['lessonEventSent'], isTrue);
        expect(
          env.backend.requests.every(
            (r) =>
                r.path.startsWith('/trial/') ||
                r.path == '/placement/questions',
          ),
          isTrue,
          reason: 'khách chỉ được gọi endpoint công khai',
        );
      },
    );

    testWidgets('mở lại thì tiếp tục từ câu chưa làm', (tester) async {
      final env = await _guest(
        tester,
        setup: (env) => env.localStore.setString(
          TrialController.storageKey,
          jsonEncode(
            TrialState(
              startedAt: DateTime.utc(2026, 1, 5),
              answers: const <String, bool>{'ex-1': true},
            ).toJson(),
          ),
        ),
        route: '/trial/lesson',
      );
      // Đã trả lời câu 1 nên vào thẳng bài tập, câu 2/2 (điền từ), bỏ qua phần giải thích.
      expect(find.text('Câu 2/2'), findsOneWidget);
      expect(_has('fill-blank-input'), isTrue);
      expect(env.backend.sent('POST /trial/events'), isEmpty);
    });

    testWidgets('trình duyệt mất hoặc làm hỏng dữ liệu: bắt đầu lại từ đầu', (
      tester,
    ) async {
      await _guest(
        tester,
        setup: (env) => env.localStore.setString(
          TrialController.storageKey,
          '{không phải json',
        ),
        route: '/trial',
      );
      expect(find.text('Bắt đầu bài mẫu'), findsOneWidget);
      expect(_has('trial-restart'), isFalse);
    });

    testWidgets('dùng thử lại từ đầu xóa trạng thái đã lưu', (tester) async {
      final env = await _guest(
        tester,
        setup: (env) => env.localStore.setString(
          TrialController.storageKey,
          jsonEncode(
            TrialState(
              startedAt: DateTime.utc(2026, 1, 5),
              answers: const <String, bool>{'ex-1': true},
            ).toJson(),
          ),
        ),
        route: '/trial',
      );
      expect(find.text('Tiếp tục bài mẫu'), findsOneWidget);
      await _tap(tester, 'trial-restart');
      await tester.tap(find.text('Xác nhận'));
      await tester.pumpAndSettle();
      expect(find.text('Bắt đầu bài mẫu'), findsOneWidget);
      expect(await _storedState(env), isNull);
    });

    testWidgets('tính năng cần tài khoản: giải thích kèm lời mời đăng ký', (
      tester,
    ) async {
      await _guest(tester, route: '/trial');
      await _tap(tester, 'trial-locked-progress');
      expect(_has('trial-account-required-body'), isTrue);
      expect(
        find.textContaining('Theo dõi tiến độ cần tài khoản'),
        findsOneWidget,
      );
      await _tap(tester, 'trial-register');
      expect(find.text('Tên hiển thị'), findsOneWidget);
    });
  });

  group('kiểm tra trình độ dùng thử', () {
    testWidgets(
      'chấm không lưu, giữ câu trả lời ở trình duyệt, bỏ để làm lại',
      (tester) async {
        final env = await _guest(tester, route: '/trial');
        await _tap(tester, 'trial-placement-open');
        await _tap(tester, 'placement-start');
        await _tap(tester, 'choice-2');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'choice-1');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'placement-submit');

        expect(_has('placement-result'), isTrue);
        expect(env.backend.sent('POST /trial/placement/grade'), hasLength(1));
        expect(env.backend.sent('POST /placement/submit'), isEmpty);
        final body = requestJson(
          env.backend.sent('POST /trial/placement/grade').single,
        );
        expect(body['answers'], <Map<String, Object?>>[
          <String, Object?>{'questionId': 'q1', 'choice': 2},
          <String, Object?>{'questionId': 'q2', 'choice': 1},
          <String, Object?>{'questionId': 'q3', 'choice': null},
        ]);

        final stored = (await _storedState(env))!;
        expect(stored['placementAnswers'], <String, Object?>{
          'q1': 2,
          'q2': 1,
          'q3': null,
        });

        // Mở lại: thấy kết quả đã lưu ngay, không phải làm lại.
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/trial');
        await tester.pumpAndSettle();
        await _tap(tester, 'trial-placement-open');
        expect(_has('placement-result'), isTrue);

        // Bỏ kết quả để làm lại: câu trả lời cũ bị xóa khỏi trình duyệt.
        await _tap(tester, 'trial-placement-discard');
        expect(_has('placement-start'), isTrue);
        expect((await _storedState(env))!['placementAnswers'], isEmpty);
      },
    );
  });

  group('đăng ký sau dùng thử', () {
    testWidgets('gửi fromTrial=true khi trình duyệt có hoạt động dùng thử', (
      tester,
    ) async {
      final env = await _guest(
        tester,
        setup: (env) => env.localStore.setString(
          TrialController.storageKey,
          jsonEncode(TrialState(startedAt: DateTime.utc(2026, 1, 5)).toJson()),
        ),
        route: '/register',
      );
      await tester.enterText(find.byKey(const Key('displayName')), 'Vinh');
      await tester.enterText(
        find.byKey(const Key('email')),
        'vinh@example.com',
      );
      await tester.enterText(
        find.byKey(const Key('password')),
        'Matkhau-Tot-123',
      );
      await _tap(tester, 'submit');
      expect(
        requestJson(
          env.backend.sent('POST /auth/register').single,
        )['fromTrial'],
        isTrue,
      );
    });

    testWidgets('đăng ký bình thường (không dùng thử) gửi fromTrial=false', (
      tester,
    ) async {
      final env = await _guest(tester, route: '/register');
      await tester.enterText(find.byKey(const Key('displayName')), 'Vinh');
      await tester.enterText(
        find.byKey(const Key('email')),
        'vinh@example.com',
      );
      await tester.enterText(
        find.byKey(const Key('password')),
        'Matkhau-Tot-123',
      );
      await _tap(tester, 'submit');
      expect(
        requestJson(
          env.backend.sent('POST /auth/register').single,
        )['fromTrial'],
        isFalse,
      );
    });

    testWidgets(
      'onboarding gửi câu trả lời dùng thử (không phải kết quả) để server chấm lại, rồi xóa khỏi trình duyệt',
      (tester) async {
        TestEnv.useDesktopSize(tester);
        addTearDown(tester.view.reset);
        final env = TestEnv(tokens: signedInTokens());
        final scenario = LearningScenario(env.backend)
          ..draft = <String, Object?>{
            'currentLevel': 'N4',
            'goalType': 'work',
            'dailyMinutes': 10,
            'skills': <String>['vocabulary'],
          };
        await env.localStore.setString(
          TrialController.storageKey,
          jsonEncode(
            TrialState(
              startedAt: DateTime.utc(2026, 1, 5),
              placementAnswers: const <String, int?>{'q1': 2, 'q2': null},
              placementDurationSeconds: 90,
            ).toJson(),
          ),
        );
        await tester.pumpWidget(env.app());
        await tester.pumpAndSettle();
        GoRouter.of(
          tester.element(find.byType(Scaffold).first),
        ).go('/onboarding');
        await tester.pumpAndSettle();

        final submits = env.backend.sent('POST /placement/submit');
        expect(submits, hasLength(1));
        final body = requestJson(submits.single);
        expect(body['durationSeconds'], 90);
        expect(body['answers'], <Map<String, Object?>>[
          <String, Object?>{'questionId': 'q1', 'choice': 2},
          <String, Object?>{'questionId': 'q2', 'choice': null},
        ]);
        expect(_has('placement-result'), isTrue);
        expect(await _storedState(env), isNull);

        // Dùng kết quả đã được server chấm lại cho lộ trình.
        await _tap(tester, 'finish');
        expect(
          requestJson(
            env.backend.sent('POST /onboarding/complete').single,
          )['placementResultId'],
          'placement-1',
        );
        expect(scenario.onboarded, isTrue);
      },
    );

    testWidgets(
      'trình duyệt khác (không có dữ liệu dùng thử): không mang gì sang',
      (tester) async {
        TestEnv.useDesktopSize(tester);
        addTearDown(tester.view.reset);
        final env = TestEnv(tokens: signedInTokens());
        LearningScenario(env.backend).draft = <String, Object?>{
          'currentLevel': 'N4',
          'goalType': 'work',
          'dailyMinutes': 10,
          'skills': <String>['vocabulary'],
        };
        await tester.pumpWidget(env.app());
        await tester.pumpAndSettle();
        GoRouter.of(
          tester.element(find.byType(Scaffold).first),
        ).go('/onboarding');
        await tester.pumpAndSettle();
        expect(env.backend.sent('POST /placement/submit'), isEmpty);
        expect(_has('placement-result'), isFalse);
      },
    );
  });
}
