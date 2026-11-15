import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Lời mời gợi ý kỹ năng sau khi đổi quỹ thời gian ở màn "Điều chỉnh kế hoạch" của Hồ sơ (spec 007, US1,
// T030, FR-024, FR-025): máy chủ chỉ lưu phút; `skills` chỉ đổi khi người học bấm "Áp dụng".

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

/// Hồ sơ giả có trạng thái; `PATCH /me` hợp nhất các trường gửi lên.
class _Profile {
  _Profile(this.backend, {List<String>? skills, bool inClass = false}) {
    if (skills != null) profile['skills'] = skills;
    backend.on('GET /me', (_) => FakeResponse(200, _me(inClass)));
    backend.on('PATCH /me', (r) {
      final body = requestJson(r);
      patches.add(body);
      body.forEach((key, value) => profile[key] = value);
      return FakeResponse(200, _me(inClass));
    });
  }

  final FakeBackend backend;
  final List<Map<String, Object?>> patches = <Map<String, Object?>>[];

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

  Map<String, Object?> _me(bool inClass) => <String, Object?>{
    'id': 'user-1',
    'email': 'a@example.com',
    'role': 'learner',
    'status': 'active',
    'learningSource': inClass ? 'class' : 'personal',
    if (inClass)
      'classSummary': <String, Object?>{
        'classId': 'class-1',
        'className': 'N5 buổi tối',
        'organizationName': 'Trung tâm Sakura',
        'lockedFields': <String>['dailyMinutes', 'skills', 'goalType'],
      },
    'profile': Map<String, Object?>.from(profile),
  };
}

Future<({TestEnv env, _Profile profile})> _open(
  WidgetTester tester, {
  List<String>? skills,
  bool inClass = false,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  final profile = _Profile(env.backend, skills: skills, inClass: inClass);
  env.backend.reply('GET /study-defaults', 200, _studyDefaults);
  if (inClass) {
    env.backend.reply('GET /me/class', 404, <String, Object?>{
      'code': 'NOT_FOUND',
      'message': 'Không có',
    });
  }
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path/adjust');
  await tester.pumpAndSettle();
  return (env: env, profile: profile);
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

bool _hasSkillsPatch(_Profile p) =>
    p.patches.any((m) => m.containsKey('skills'));

void main() {
  testWidgets(
    'đổi quỹ thời gian ⇒ hiện lời mời; TRƯỚC khi bấm Áp dụng không có PATCH nào chứa skills',
    (tester) async {
      final t = await _open(tester);
      expect(_has('suggestion-invite'), isFalse);

      await _tap(tester, 'minutes-15');
      expect(t.profile.patches, <Map<String, Object?>>[
        <String, Object?>{'dailyMinutes': 15},
      ]);
      expect(_hasSkillsPatch(t.profile), isFalse);
      expect(_has('suggestion-invite'), isTrue);
      expect(find.text('Gợi ý mới cho 15 phút'), findsOneWidget);
      expect(
        find.text('Bộ kỹ năng gợi ý: Từ vựng, Ngữ pháp, Kanji'),
        findsOneWidget,
      );
      // Kỹ năng đã lưu chưa đổi.
      expect(t.profile.profile['skills'], <String>['vocabulary', 'grammar']);
    },
  );

  testWidgets('"Áp dụng" gửi PATCH {skills} theo gợi ý rồi ẩn lời mời', (
    tester,
  ) async {
    final t = await _open(tester);
    await _tap(tester, 'minutes-15');
    await _tap(tester, 'suggestion-apply');

    expect(t.profile.patches.last, <String, Object?>{
      'skills': <String>['vocabulary', 'grammar', 'kanji'],
    });
    expect(_has('suggestion-invite'), isFalse);
    final kanji = tester.widget<FilterChip>(
      find.byKey(const Key('skill-toggle-kanji')),
    );
    expect(kanji.selected, isTrue);
  });

  testWidgets('"Giữ nguyên" ẩn lời mời và không gửi gì thêm', (tester) async {
    final t = await _open(tester);
    await _tap(tester, 'minutes-15');
    final before = t.profile.patches.length;

    await _tap(tester, 'suggestion-keep');
    expect(_has('suggestion-invite'), isFalse);
    expect(t.profile.patches.length, before);
    expect(_hasSkillsPatch(t.profile), isFalse);
  });

  testWidgets('kỹ năng đã tự chỉnh vẫn được mời (không bị ghi đè ngầm)', (
    tester,
  ) async {
    final t = await _open(tester, skills: <String>['kanji']);
    await _tap(tester, 'minutes-5');

    expect(_hasSkillsPatch(t.profile), isFalse);
    expect(t.profile.profile['skills'], <String>['kanji']);
    expect(find.text('Gợi ý mới cho 5 phút'), findsOneWidget);
    expect(find.text('Bộ kỹ năng gợi ý: Từ vựng'), findsOneWidget);
  });

  testWidgets('kỹ năng đã lưu bằng đúng gợi ý mới ⇒ không có lời mời', (
    tester,
  ) async {
    await _open(tester, skills: <String>['vocabulary', 'grammar', 'kanji']);
    await _tap(tester, 'minutes-15');
    expect(_has('suggestion-invite'), isFalse);
  });

  testWidgets('học viên thuộc lớp: điều khiển bị khóa, không có nút Áp dụng', (
    tester,
  ) async {
    final t = await _open(tester, inClass: true);
    expect(find.byKey(const Key('plan-adjust-class-managed')), findsOneWidget);
    expect(_has('suggestion-invite'), isFalse);
    expect(_has('suggestion-apply'), isFalse);
    expect(t.profile.patches, isEmpty);
  });
}
