import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/domain/onboarding_form.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Onboarding (T053), kiểm tra trình độ (T054), lộ trình và "Hôm nay" (T055).

Future<TestEnv> _signedIn(
  WidgetTester tester, {
  required String route,
  void Function(LearningScenario)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend);
  setup?.call(scenario);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _fillAllSteps(WidgetTester tester) async {
  await _tap(tester, 'level-none');
  await _tap(tester, 'next');
  await _tap(tester, 'goal-daily_conversation');
  await _tap(tester, 'next');
  await _tap(tester, 'minutes-10');
  await _tap(tester, 'next');
  await _tap(tester, 'next'); // mốc thời gian là tùy chọn
  await _tap(tester, 'skill-vocabulary');
  await _tap(tester, 'skill-grammar');
  await _tap(tester, 'next');
}

void main() {
  group('OnboardingForm', () {
    test('bước bắt buộc và tùy chọn', () {
      const empty = OnboardingForm.empty;
      expect(empty.isStepComplete(OnboardingStep.level), isFalse);
      expect(empty.isStepComplete(OnboardingStep.deadline), isTrue);
      expect(empty.isStepComplete(OnboardingStep.placement), isTrue);
      expect(empty.isComplete, isFalse);

      final jlpt = empty.copyWith(goalType: 'jlpt');
      expect(
        jlpt.isStepComplete(OnboardingStep.goal),
        isFalse,
      ); // thiếu cấp độ mục tiêu
      expect(
        jlpt.copyWith(targetLevel: 'N3').isStepComplete(OnboardingStep.goal),
        isTrue,
      );
    });

    test('N2/N1 (trình độ hoặc mục tiêu JLPT) vượt phạm vi nội dung', () {
      expect(
        const OnboardingForm(currentLevel: 'N2').exceedsContentScope,
        isTrue,
      );
      expect(
        const OnboardingForm(currentLevel: 'N4').exceedsContentScope,
        isFalse,
      );
      expect(
        const OnboardingForm(
          currentLevel: 'N4',
          goalType: 'jlpt',
          targetLevel: 'N1',
        ).exceedsContentScope,
        isTrue,
      );
      // Mục tiêu N1 bị bỏ qua khi mục tiêu không phải JLPT.
      expect(
        const OnboardingForm(
          currentLevel: 'N4',
          goalType: 'work',
          targetLevel: 'N1',
        ).exceedsContentScope,
        isFalse,
      );
    });

    test(
      'toJson chỉ chứa trường đã nhập; targetLevel chỉ khi mục tiêu JLPT',
      () {
        const form = OnboardingForm(
          currentLevel: 'none',
          goalType: 'work',
          targetLevel: 'N1',
          dailyMinutes: 10,
          skills: <String>['vocabulary'],
        );
        expect(form.toJson(timezone: 'Asia/Tokyo'), <String, Object?>{
          'currentLevel': 'none',
          'goalType': 'work',
          'dailyMinutes': 10,
          'skills': <String>['vocabulary'],
          'timezone': 'Asia/Tokyo',
        });
      },
    );

    test('fromJson chỉ giữ kỹ năng được hỗ trợ và cắt ngày về YYYY-MM-DD', () {
      final form = OnboardingForm.fromJson(<String, Object?>{
        'skills': <String>['vocabulary', 'listening'],
        'targetDate': '2026-12-31T00:00:00.000',
        'dailyMinutes': 15,
      });
      expect(form.skills, <String>['vocabulary']);
      expect(form.targetDate, '2026-12-31');
      expect(form.dailyMinutes, 15);
    });
  });

  group('onboarding', () {
    testWidgets(
      'đi hết các bước, lưu nháp mỗi bước, hoàn tất rồi thấy "Hôm nay"',
      (tester) async {
        final env = await _signedIn(tester, route: '/onboarding');
        expect(find.byKey(const Key('onboarding-progress')), findsOneWidget);
        expect(find.text('Bước 1/6'), findsOneWidget);

        await _fillAllSteps(tester);
        // Đã nháp sau mỗi lần "Tiếp tục".
        expect(env.backend.sent('PUT /onboarding'), hasLength(5));
        expect(
          requestJson(env.backend.sent('PUT /onboarding').last)['dailyMinutes'],
          10,
        );

        // Bước cuối: bỏ qua kiểm tra và hoàn tất.
        expect(find.text('Bước 6/6'), findsOneWidget);
        await _tap(tester, 'finish');

        final sent = requestJson(
          env.backend.sent('POST /onboarding/complete').single,
        );
        expect(sent['currentLevel'], 'none');
        expect(sent['goalType'], 'daily_conversation');
        expect(sent['dailyMinutes'], 10);
        expect(sent['skills'], <String>['vocabulary', 'grammar']);
        expect(sent['timezone'], 'Asia/Ho_Chi_Minh');
        expect(
          sent.containsKey('placementResultId'),
          isFalse,
        ); // bỏ qua kiểm tra (FR-008)
        expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
        expect(find.text('Ước tính 10/10 phút'), findsOneWidget);
      },
    );

    testWidgets('kỹ năng nghe, đọc bị khóa kèm ghi chú; Kanji chọn được', (
      tester,
    ) async {
      await _signedIn(tester, route: '/onboarding');
      await _tap(tester, 'level-none');
      await _tap(tester, 'next');
      await _tap(tester, 'goal-daily_conversation');
      await _tap(tester, 'next');
      await _tap(tester, 'minutes-5');
      await _tap(tester, 'next');
      await _tap(tester, 'next');

      for (final skill in <String>['listening', 'reading']) {
        final tile = tester.widget<CheckboxListTile>(
          find.byKey(Key('skill-$skill')),
        );
        expect(tile.onChanged, isNull, reason: '$skill phải bị khóa');
      }
      expect(find.text('Chưa có trong phiên bản này'), findsNWidgets(2));
      // Kanji không còn khóa (spec 003): chọn được như từ vựng và ngữ pháp.
      final kanjiTile = tester.widget<CheckboxListTile>(
        find.byKey(const Key('skill-kanji')),
      );
      expect(kanjiTile.onChanged, isNotNull);
      // Chưa chọn kỹ năng nào → không đi tiếp được; chọn một kỹ năng thì đi tiếp được.
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('next'))).onPressed,
        isNull,
      );
      await _tap(tester, 'skill-vocabulary');
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('next'))).onPressed,
        isNotNull,
      );
      // Chọn Kanji rồi bỏ từ vựng: vẫn đi tiếp được vì còn một kỹ năng.
      await _tap(tester, 'skill-kanji');
      await _tap(tester, 'skill-vocabulary');
      expect(
        tester
            .widget<CheckboxListTile>(find.byKey(const Key('skill-kanji')))
            .value,
        isTrue,
      );
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('next'))).onPressed,
        isNotNull,
      );
    });

    testWidgets('mục tiêu JLPT bắt buộc chọn cấp độ trước khi tiếp tục', (
      tester,
    ) async {
      await _signedIn(tester, route: '/onboarding');
      await _tap(tester, 'level-N4');
      await _tap(tester, 'next');
      await _tap(tester, 'goal-jlpt');
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('next'))).onPressed,
        isNull,
      );
      await _tap(tester, 'target-N1');
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('next'))).onPressed,
        isNotNull,
      );
      // Chọn N1 → báo trước giới hạn nội dung N3.
      expect(find.byKey(const Key('scope-notice')), findsOneWidget);
    });

    testWidgets('tiếp tục từ nháp đã lưu: nhảy tới bước chưa nhập', (
      tester,
    ) async {
      await _signedIn(
        tester,
        route: '/onboarding',
        setup: (s) => s.draft = <String, Object?>{
          'currentLevel': 'N5',
          'goalType': 'work',
        },
      );
      expect(
        find.text('Bước 3/6'),
        findsOneWidget,
      ); // đã có trình độ + mục tiêu
    });

    testWidgets('đã hoàn tất onboarding thì chuyển thẳng tới "Hôm nay"', (
      tester,
    ) async {
      await _signedIn(
        tester,
        route: '/onboarding',
        setup: (s) => s.onboarded = true,
      );
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    });

    testWidgets(
      'kết quả kiểm tra có sẵn được dùng mặc định; bỏ kết quả thì không gửi id',
      (tester) async {
        final env = await _signedIn(
          tester,
          route: '/onboarding',
          setup: (s) {
            s.currentPlacement = s.placementResult();
            s.draft = <String, Object?>{
              'currentLevel': 'N4',
              'goalType': 'work',
              'dailyMinutes': 10,
              'skills': <String>['vocabulary'],
            };
          },
        );
        expect(find.text('Bước 6/6'), findsOneWidget);
        expect(find.byKey(const Key('placement-result')), findsOneWidget);
        await _tap(tester, 'placement-discard');
        expect(find.byKey(const Key('placement-discarded')), findsOneWidget);
        await _tap(tester, 'finish');
        expect(
          requestJson(
            env.backend.sent('POST /onboarding/complete').single,
          ).containsKey('placementResultId'),
          isFalse,
        );
      },
    );

    testWidgets('dùng kết quả kiểm tra có sẵn: gửi placementResultId', (
      tester,
    ) async {
      final env = await _signedIn(
        tester,
        route: '/onboarding',
        setup: (s) {
          s.currentPlacement = s.placementResult();
          s.draft = <String, Object?>{
            'currentLevel': 'N4',
            'goalType': 'work',
            'dailyMinutes': 10,
            'skills': <String>['vocabulary'],
          };
        },
      );
      await _tap(tester, 'finish');
      expect(
        requestJson(
          env.backend.sent('POST /onboarding/complete').single,
        )['placementResultId'],
        'placement-1',
      );
    });

    testWidgets('Làm lại từ đầu xóa nháp', (tester) async {
      final env = await _signedIn(
        tester,
        route: '/onboarding',
        setup: (s) => s.draft = <String, Object?>{
          'currentLevel': 'N5',
          'goalType': 'work',
        },
      );
      await _tap(tester, 'restart');
      expect(find.text('Bước 1/6'), findsOneWidget);
      expect(
        requestJson(env.backend.sent('PUT /onboarding').last),
        isNot(contains('currentLevel')),
      );
    });
  });

  group('kiểm tra trình độ', () {
    testWidgets(
      'làm bài: chọn đáp án, nộp, hiển thị kết quả rồi quay lại onboarding',
      (tester) async {
        final env = await _signedIn(
          tester,
          route: '/placement?context=onboarding',
        );
        await _tap(tester, 'placement-start');
        expect(find.text('Câu 1/3'), findsOneWidget);
        expect(find.byKey(const Key('placement-timer')), findsOneWidget);

        await _tap(tester, 'choice-2');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'placement-next'); // bỏ trống câu 2
        await _tap(tester, 'choice-0');
        await _tap(tester, 'placement-submit');

        final sent = requestJson(
          env.backend.sent('POST /placement/submit').single,
        );
        final answers = (sent['answers'] as List<dynamic>)
            .cast<Map<dynamic, dynamic>>();
        expect(answers.map((a) => a['choice']).toList(), <Object?>[2, null, 0]);
        expect(find.byKey(const Key('placement-result')), findsOneWidget);
        expect(find.text('Trình độ ước tính: N4'), findsOneWidget);
        expect(find.text('Trợ từ'), findsOneWidget);

        await _tap(tester, 'placement-continue');
        expect(find.text('Thiết lập lộ trình'), findsWidgets);
      },
    );

    testWidgets('bỏ qua bất cứ lúc nào: không nộp gì', (tester) async {
      final env = await _signedIn(
        tester,
        route: '/placement?context=onboarding',
      );
      await _tap(tester, 'placement-start');
      await _tap(tester, 'choice-1');
      await _tap(tester, 'placement-skip');
      expect(env.backend.sent('POST /placement/submit'), isEmpty);
      expect(find.text('Thiết lập lộ trình'), findsWidgets);
    });

    testWidgets('đồng hồ 10 phút đếm ngược và tự nộp khi hết giờ', (
      tester,
    ) async {
      final env = await _signedIn(
        tester,
        route: '/placement?context=onboarding',
      );
      await _tap(tester, 'placement-start');
      expect(find.text('10:00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      expect(find.text('9:55'), findsOneWidget);

      await tester.pump(const Duration(seconds: 700));
      await tester.pumpAndSettle();
      expect(env.backend.sent('POST /placement/submit'), hasLength(1));
      expect(find.byKey(const Key('placement-result')), findsOneWidget);
    });

    testWidgets(
      'làm lại: chọn xây dựng lại gửi usePlacementResultId, lịch sử không bị xóa',
      (tester) async {
        final env = await _signedIn(
          tester,
          route: '/placement',
          setup: (s) => s.onboarded = true,
        );
        await _tap(tester, 'placement-start');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'placement-next');
        await _tap(tester, 'placement-submit');
        expect(find.byKey(const Key('placement-rebuild')), findsOneWidget);
        expect(find.byKey(const Key('placement-keep')), findsOneWidget);

        await _tap(tester, 'placement-rebuild');
        await tester.tap(find.text('Xác nhận'));
        await tester.pumpAndSettle();
        expect(
          requestJson(
            env.backend.sent('POST /path/rebuild').single,
          )['usePlacementResultId'],
          'placement-1',
        );
        expect(find.text('Lộ trình của bạn'), findsOneWidget);
      },
    );

    testWidgets('làm lại: chọn giữ lộ trình không gọi xây dựng lại', (
      tester,
    ) async {
      final env = await _signedIn(
        tester,
        route: '/placement',
        setup: (s) => s.onboarded = true,
      );
      await _tap(tester, 'placement-start');
      await _tap(tester, 'placement-next');
      await _tap(tester, 'placement-next');
      await _tap(tester, 'placement-submit');
      await _tap(tester, 'placement-keep');
      expect(env.backend.sent('POST /path/rebuild'), isEmpty);
      expect(find.text('Lộ trình của bạn'), findsOneWidget);
    });
  });

  group('Hôm nay và lộ trình', () {
    testWidgets('Hôm nay: bài mới, tổng thời lượng so với quỹ thời gian', (
      tester,
    ) async {
      await _signedIn(
        tester,
        route: '/today',
        setup: (s) => s.onboarded = true,
      );
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
      expect(find.text('Ước tính 10/10 phút'), findsOneWidget);
      expect(find.text('Chào hỏi'), findsOneWidget);
      expect(find.text('Câu danh từ với です'), findsOneWidget);
    });

    testWidgets('chưa onboarding: Hôm nay đưa người học vào onboarding', (
      tester,
    ) async {
      await _signedIn(tester, route: '/today');
      expect(find.text('Thiết lập lộ trình'), findsWidgets);
    });

    testWidgets(
      'lộ trình tạm dừng: hiển thị thông báo, không có "ngày bỏ lỡ"',
      (tester) async {
        await _signedIn(
          tester,
          route: '/today',
          setup: (s) {
            s.onboarded = true;
            s.backend.reply('GET /today', 409, <String, Object?>{
              'code': 'PATH_PAUSED',
              'message': 'Lộ trình đang tạm dừng',
            });
          },
        );
        expect(find.text('Lộ trình đang tạm dừng'), findsOneWidget);
      },
    );

    testWidgets('kế hoạch rỗng khi hết nội dung: thông báo rõ ràng', (
      tester,
    ) async {
      await _signedIn(
        tester,
        route: '/today',
        setup: (s) {
          s.onboarded = true;
          s.backend.reply('GET /today', 200, <String, Object?>{
            'id': 'p',
            'localDate': '2026-01-05',
            'budgetMinutes': 10,
            'estimatedMinutes': 0,
            'status': 'open',
            'notice': 'content_exhausted',
            'items': <Object?>[],
          });
        },
      );
      expect(find.byKey(const Key('today-empty')), findsOneWidget);
      expect(find.textContaining('học hết nội dung phù hợp'), findsOneWidget);
    });

    testWidgets(
      'scopeNotice từ lộ trình được hiển thị trên Hôm nay và Lộ trình',
      (tester) async {
        await _signedIn(
          tester,
          route: '/today',
          setup: (s) {
            s.onboarded = true;
            s.backend.on(
              'GET /path',
              (_) => FakeResponse(200, <String, Object?>{
                ...s.pathDetail,
                'scopeNotice': 'content_ceiling_n3',
              }),
            );
          },
        );
        expect(find.byKey(const Key('scope-notice')), findsOneWidget);
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('scope-notice')), findsOneWidget);
        expect(find.text('Lộ trình của bạn'), findsOneWidget);
        expect(find.text('Đã xong 0/6 đơn vị'), findsOneWidget);
      },
    );

    testWidgets(
      'Lộ trình: thứ tự đơn vị, tiến độ và lối vào làm lại kiểm tra',
      (tester) async {
        await _signedIn(
          tester,
          route: '/path',
          setup: (s) => s.onboarded = true,
        );
        expect(find.text('Điểm xuất phát: N5'), findsOneWidget);
        expect(find.byKey(const Key('unit-u1')), findsOneWidget);
        expect(find.byKey(const Key('unit-u2')), findsOneWidget);
        await _tap(tester, 'retake-placement');
        expect(find.text('Sẵn sàng kiểm tra?'), findsOneWidget);
      },
    );
  });
}
