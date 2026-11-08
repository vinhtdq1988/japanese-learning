import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Mục "Hiệu ứng" ở Hồ sơ (spec 005, US3): hai công tắc độc lập, mặc định bật, lưu lên PATCH /me đúng trường,
// thất bại thì hoàn lại và báo lỗi chung, và KHÔNG bị khóa với học viên thuộc lớp.

class _Account {
  _Account(this.backend, {bool inClass = false}) {
    backend.on('GET /me', (_) => FakeResponse(200, _me(inClass)));
    backend.on('PATCH /me', (r) {
      final body = requestJson(r);
      patches.add(body);
      if (failPatch) {
        return const FakeResponse(500, <String, Object?>{
          'code': 'INTERNAL',
          'message': 'Lỗi máy chủ',
        });
      }
      if (body.containsKey('soundEnabled')) {
        profile['soundEnabled'] = body['soundEnabled'];
      }
      if (body.containsKey('visualEffectsEnabled')) {
        profile['visualEffectsEnabled'] = body['visualEffectsEnabled'];
      }
      return FakeResponse(200, _me(inClass));
    });
  }

  final FakeBackend backend;
  bool failPatch = false;
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
    'soundEnabled': true,
    'visualEffectsEnabled': true,
  };

  Map<String, Object?> _me(bool inClass) => <String, Object?>{
    'id': 'user-1',
    'email': 'a@example.com',
    'role': 'learner',
    'status': 'active',
    'learningSource': inClass ? 'class' : 'personal',
    if (inClass)
      'classSummary': <String, Object?>{
        'classId': 'c-1',
        'className': 'N5 buổi tối',
        'organizationName': 'Trung tâm Sakura',
        'lockedFields': <Object?>['dailyMinutes', 'skills'],
      },
    'profile': Map<String, Object?>.from(profile),
  };
}

Future<({TestEnv env, _Account account})> _open(
  WidgetTester tester, {
  bool inClass = false,
}) async {
  TestEnv.useDesktopSize(tester);
  tester.view.physicalSize = const Size(1280, 2400);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  final account = _Account(env.backend, inClass: inClass);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/profile');
  await tester.pumpAndSettle();
  return (env: env, account: account);
}

bool _isOn(WidgetTester tester, String key) =>
    tester.widget<SwitchListTile>(find.byKey(Key(key))).value;

Future<void> _toggle(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('hiện hai công tắc, mặc định bật', (tester) async {
    await _open(tester);
    expect(find.text('Hiệu ứng'), findsOneWidget);
    expect(find.text('Âm thanh'), findsOneWidget);
    expect(find.text('Hiệu ứng hình ảnh'), findsOneWidget);
    expect(_isOn(tester, 'effects-sound-switch'), isTrue);
    expect(_isOn(tester, 'effects-visual-switch'), isTrue);
  });

  testWidgets('phản ánh giá trị đã lưu trong hồ sơ', (tester) async {
    TestEnv.useDesktopSize(tester);
    tester.view.physicalSize = const Size(1280, 2400);
    addTearDown(tester.view.reset);
    final env = TestEnv(tokens: signedInTokens());
    LearningScenario(env.backend).onboarded = true;
    final account = _Account(env.backend);
    account.profile['soundEnabled'] = false;
    await tester.pumpWidget(env.app());
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/profile');
    await tester.pumpAndSettle();

    expect(_isOn(tester, 'effects-sound-switch'), isFalse);
    expect(_isOn(tester, 'effects-visual-switch'), isTrue);
  });

  testWidgets('hai công tắc độc lập: mỗi lần đổi chỉ PATCH đúng trường đó', (
    tester,
  ) async {
    final t = await _open(tester);

    await _toggle(tester, 'effects-sound-switch');
    expect(t.account.patches, <Map<String, Object?>>[
      <String, Object?>{'soundEnabled': false},
    ]);
    expect(_isOn(tester, 'effects-sound-switch'), isFalse);
    expect(_isOn(tester, 'effects-visual-switch'), isTrue);

    await _toggle(tester, 'effects-visual-switch');
    expect(t.account.patches.last, <String, Object?>{
      'visualEffectsEnabled': false,
    });
    expect(_isOn(tester, 'effects-sound-switch'), isFalse);
    expect(_isOn(tester, 'effects-visual-switch'), isFalse);

    await _toggle(tester, 'effects-sound-switch');
    expect(t.account.patches.last, <String, Object?>{'soundEnabled': true});
    expect(_isOn(tester, 'effects-sound-switch'), isTrue);
    expect(_isOn(tester, 'effects-visual-switch'), isFalse);
    expect(find.byKey(const Key('effects-settings-error')), findsNothing);
  });

  testWidgets('lưu thất bại: hoàn lại giá trị và báo lỗi chung', (
    tester,
  ) async {
    final t = await _open(tester);
    t.account.failPatch = true;

    await _toggle(tester, 'effects-sound-switch');

    expect(t.account.patches, hasLength(1));
    expect(_isOn(tester, 'effects-sound-switch'), isTrue); // đã hoàn lại
    expect(find.byKey(const Key('effects-settings-error')), findsOneWidget);
    expect(
      find.text('Không lưu được tùy chọn hiệu ứng. Vui lòng thử lại.'),
      findsOneWidget,
    );

    // Lần đổi thành công sau đó xóa thông báo lỗi.
    t.account.failPatch = false;
    await _toggle(tester, 'effects-sound-switch');
    expect(_isOn(tester, 'effects-sound-switch'), isFalse);
    expect(find.byKey(const Key('effects-settings-error')), findsNothing);
  });

  testWidgets('học viên thuộc lớp: công tắc dùng được, không bị khóa', (
    tester,
  ) async {
    final t = await _open(tester, inClass: true);

    // Kế hoạch học bị khóa nhưng hai tùy chọn hiệu ứng thì không.
    expect(find.byKey(const Key('profile-plan-locked')), findsOneWidget);
    final sound = tester.widget<SwitchListTile>(
      find.byKey(const Key('effects-sound-switch')),
    );
    expect(sound.onChanged, isNotNull);
    // Chỉ mục kế hoạch có điều khiển khóa; mục hiệu ứng không có.
    expect(find.byKey(const Key('locked-value')), findsOneWidget);

    await _toggle(tester, 'effects-visual-switch');
    expect(t.account.patches, <Map<String, Object?>>[
      <String, Object?>{'visualEffectsEnabled': false},
    ]);
    expect(find.byKey(const Key('effects-settings-error')), findsNothing);
  });
}
