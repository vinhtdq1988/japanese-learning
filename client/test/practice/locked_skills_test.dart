import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Luyện đọc/luyện viết bị khóa khi quỹ thời gian < 30 phút (spec 007, US2, T053, FR-005, FR-006, FR-007):
// ở onboarding và ở màn "Điều chỉnh kế hoạch" của Hồ sơ, mục hiển thị KHÓA kèm lý do và hướng dẫn; ở 30 phút
// bật được; hạ phút bỏ hai kỹ năng khỏi lựa chọn; kỹ năng ĐÃ LƯU không bị xóa khi hạ phút.

const String _reason = 'Dành cho người học từ 30 phút mỗi ngày';
const String _hint =
    'Tăng thời gian học mỗi ngày trong Hồ sơ để dùng luyện đọc/viết';

const Map<String, Object?> _studyDefaults = <String, Object?>{
  'practiceMinDailyMinutes': 30,
  'items': <Object?>[
    <String, Object?>{
      'dailyMinutes': 5,
      'skills': <String>['vocabulary'],
    },
    <String, Object?>{
      'dailyMinutes': 10,
      'skills': <String>['vocabulary', 'grammar'],
    },
    <String, Object?>{
      'dailyMinutes': 15,
      'skills': <String>['vocabulary', 'grammar', 'kanji'],
    },
    <String, Object?>{
      'dailyMinutes': 30,
      'skills': <String>[
        'vocabulary',
        'grammar',
        'kanji',
        'reading',
        'writing',
      ],
    },
  ],
};

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

// --- Onboarding ---

Future<void> _openOnboarding(WidgetTester tester) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend);
  env.backend.reply('GET /study-defaults', 200, _studyDefaults);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/onboarding');
  await tester.pumpAndSettle();
  await _tap(tester, 'level-none');
  await _tap(tester, 'next');
  await _tap(tester, 'goal-daily_conversation');
  await _tap(tester, 'next');
}

CheckboxListTile _tile(WidgetTester tester, String skill) =>
    tester.widget<CheckboxListTile>(find.byKey(Key('skill-$skill')));

Future<void> _toSkillsStep(WidgetTester tester, int minutes) async {
  await _tap(tester, 'minutes-$minutes');
  await _tap(tester, 'next'); // → mốc thời gian
  await _tap(tester, 'next'); // → kỹ năng
}

void main() {
  group('onboarding', () {
    for (final minutes in <int>[5, 10, 15]) {
      testWidgets(
        '$minutes phút: Luyện đọc/Luyện viết hiển thị KHÓA kèm lý do và hướng dẫn',
        (tester) async {
          await _openOnboarding(tester);
          await _toSkillsStep(tester, minutes);

          for (final skill in <String>['reading', 'writing']) {
            expect(_has('skill-$skill'), isTrue);
            expect(_tile(tester, skill).onChanged, isNull);
            expect(_tile(tester, skill).value, isFalse);
          }
          expect(find.text('Luyện đọc'), findsOneWidget);
          expect(find.text('Luyện viết'), findsOneWidget);
          expect(find.text(_reason), findsWidgets);
          expect(find.text(_hint), findsOneWidget);
        },
      );
    }

    testWidgets('30 phút: bật được, không còn lý do khóa', (tester) async {
      await _openOnboarding(tester);
      await _toSkillsStep(tester, 30);

      expect(_tile(tester, 'reading').onChanged, isNotNull);
      expect(_tile(tester, 'writing').onChanged, isNotNull);
      expect(find.text(_reason), findsNothing);
      expect(find.text(_hint), findsNothing);

      // Gợi ý của 30 phút điền sẵn cả hai kỹ năng; người học tắt rồi bật lại được.
      expect(_tile(tester, 'reading').value, isTrue);
      await _tap(tester, 'skill-reading');
      expect(_tile(tester, 'reading').value, isFalse);
      await _tap(tester, 'skill-reading');
      expect(_tile(tester, 'reading').value, isTrue);
    });

    testWidgets(
      'đang chọn luyện đọc/viết ở 30 phút rồi hạ xuống 15 ⇒ hai kỹ năng bị bỏ khỏi lựa chọn và khóa',
      (tester) async {
        await _openOnboarding(tester);
        await _toSkillsStep(tester, 30);
        // Gợi ý của 30 phút đã điền sẵn luyện đọc/viết.
        expect(_tile(tester, 'reading').value, isTrue);
        expect(_tile(tester, 'writing').value, isTrue);

        await _tap(tester, 'back'); // → mốc thời gian
        await _tap(tester, 'back'); // → thời gian
        await _tap(tester, 'minutes-15');
        await _tap(tester, 'next');
        await _tap(tester, 'next');

        expect(_tile(tester, 'reading').value, isFalse);
        expect(_tile(tester, 'writing').value, isFalse);
        expect(_tile(tester, 'reading').onChanged, isNull);
        expect(find.text(_reason), findsWidgets);
      },
    );
  });

  group('Hồ sơ (Điều chỉnh kế hoạch)', () {
    final patches = <Map<String, Object?>>[];
    late Map<String, Object?> profile;

    Map<String, Object?> me() => <String, Object?>{
      'id': 'user-1',
      'email': 'a@example.com',
      'role': 'learner',
      'status': 'active',
      'learningSource': 'personal',
      'profile': Map<String, Object?>.from(profile),
    };

    Future<void> openPlanAdjust(
      WidgetTester tester, {
      required int minutes,
      required List<String> skills,
    }) async {
      TestEnv.useDesktopSize(tester);
      addTearDown(tester.view.reset);
      patches.clear();
      profile = <String, Object?>{
        'displayName': 'Học viên',
        'currentLevel': 'none',
        'goalType': 'daily_conversation',
        'dailyMinutes': minutes,
        'skills': skills,
        'language': 'vi',
        'timezone': 'Asia/Ho_Chi_Minh',
        'paused': false,
        'onboardingState': 'completed',
      };
      final env = TestEnv(tokens: signedInTokens());
      LearningScenario(env.backend).onboarded = true;
      env.backend.on('GET /me', (_) => FakeResponse(200, me()));
      env.backend.on('PATCH /me', (r) {
        final body = requestJson(r);
        patches.add(body);
        body.forEach((key, value) => profile[key] = value);
        return FakeResponse(200, me());
      });
      env.backend.reply('GET /study-defaults', 200, _studyDefaults);
      await tester.pumpWidget(env.app());
      await tester.pumpAndSettle();
      GoRouter.of(
        tester.element(find.byType(Scaffold).first),
      ).go('/path/adjust');
      await tester.pumpAndSettle();
    }

    FilterChip chip(WidgetTester tester, String skill) =>
        tester.widget<FilterChip>(find.byKey(Key('skill-toggle-$skill')));

    testWidgets(
      '15 phút: hai chip bị khóa kèm lý do; kỹ năng đã lưu hiện trạng thái khóa nhưng KHÔNG bị xóa',
      (tester) async {
        await openPlanAdjust(
          tester,
          minutes: 15,
          skills: <String>['vocabulary', 'reading', 'writing'],
        );
        expect(chip(tester, 'reading').onSelected, isNull);
        expect(chip(tester, 'writing').onSelected, isNull);
        expect(find.text(_reason), findsWidgets);
        expect(find.text(_hint), findsOneWidget);
        // Không có yêu cầu ghi nào: lựa chọn đã lưu được giữ nguyên.
        expect(patches, isEmpty);
        expect(profile['skills'], <String>['vocabulary', 'reading', 'writing']);
      },
    );

    testWidgets('30 phút: bật được Luyện đọc và gửi PATCH skills', (
      tester,
    ) async {
      await openPlanAdjust(
        tester,
        minutes: 30,
        skills: <String>['vocabulary', 'grammar'],
      );
      expect(chip(tester, 'reading').onSelected, isNotNull);
      expect(find.text(_reason), findsNothing);

      await _tap(tester, 'skill-toggle-reading');
      expect(patches.last['skills'], contains('reading'));
    });

    testWidgets(
      'hạ phút xuống 15 giữa chừng ⇒ chip khóa, kỹ năng đã lưu còn nguyên',
      (tester) async {
        await openPlanAdjust(
          tester,
          minutes: 30,
          skills: <String>['vocabulary', 'reading', 'writing'],
        );
        expect(chip(tester, 'reading').onSelected, isNotNull);

        await _tap(tester, 'minutes-15');
        expect(patches.where((p) => p.containsKey('skills')), isEmpty);
        expect(profile['skills'], <String>['vocabulary', 'reading', 'writing']);
        expect(chip(tester, 'reading').onSelected, isNull);
        expect(find.text(_reason), findsWidgets);
      },
    );
  });
}
