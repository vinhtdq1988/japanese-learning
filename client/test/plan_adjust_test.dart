import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Điều chỉnh kế hoạch (T094, US5, FR-016): đổi mục tiêu/thời gian, ưu tiên kỹ năng, tạm dừng/tiếp tục,
// xây dựng lại có xác nhận, và đánh dấu đã thành thạo (kèm xử lý đơn vị cuối cùng) trên màn hình Lộ trình.

/// Hồ sơ giả có trạng thái; `PATCH /me` hợp nhất các trường gửi lên (`null` = xóa).
class _Adjust {
  _Adjust(this.backend, {bool paused = false}) {
    profile['paused'] = paused;
    backend.on('GET /me', (_) => FakeResponse(200, _me()));
    backend.on('PATCH /me', (r) {
      final body = requestJson(r);
      patches.add(body);
      if (rejectPatch) {
        return const FakeResponse(422, <String, Object?>{
          'code': 'VALIDATION_FAILED',
          'message': 'Dữ liệu không hợp lệ',
          'fields': <String, Object?>{
            'targetDate': 'Mốc thời gian phải từ hôm nay trở đi',
          },
        });
      }
      body.forEach((key, value) {
        if (value == null) {
          profile.remove(key);
        } else {
          profile[key] = value;
        }
      });
      return FakeResponse(200, _me());
    });
    backend.on('POST /path/pause', (_) {
      profile['paused'] = true;
      return const FakeResponse(204);
    });
    backend.on('POST /path/resume', (_) {
      profile['paused'] = false;
      return const FakeResponse(204);
    });
  }

  final FakeBackend backend;
  final List<Map<String, Object?>> patches = <Map<String, Object?>>[];
  bool rejectPatch = false;

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

  Map<String, Object?> _me() => <String, Object?>{
    'id': 'user-1',
    'email': 'a@example.com',
    'role': 'learner',
    'status': 'active',
    'profile': Map<String, Object?>.from(profile),
  };
}

Future<({TestEnv env, LearningScenario scenario, _Adjust adjust})> _open(
  WidgetTester tester, {
  String route = '/path/adjust',
  bool paused = false,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend)..onboarded = true;
  final adjust = _Adjust(env.backend, paused: paused);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return (env: env, scenario: scenario, adjust: adjust);
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

bool _selected(WidgetTester tester, String key) =>
    tester.widget<ChoiceChip>(find.byKey(Key(key))).selected;

/// Chọn một mục trong danh sách thả xuống (chạm ô rồi chạm mục có chữ tương ứng).
Future<void> _choose(
  WidgetTester tester,
  String dropdownKey,
  String text,
) async {
  await tester.ensureVisible(find.byKey(Key(dropdownKey)));
  await tester.tap(find.byKey(Key(dropdownKey)));
  await tester.pumpAndSettle();
  await tester.tap(find.text(text).last);
  await tester.pumpAndSettle();
}

void main() {
  group('màn hình điều chỉnh kế hoạch', () {
    testWidgets(
      'hiển thị lựa chọn hiện tại; nghe, đọc bị khóa kèm ghi chú, Kanji bật/tắt được',
      (tester) async {
        await _open(tester);
        expect(_selected(tester, 'minutes-10'), isTrue);
        expect(_selected(tester, 'minutes-15'), isFalse);
        expect(_selected(tester, 'priority-none'), isTrue);
        expect(_has('pause-path'), isTrue);
        expect(_has('resume-path'), isFalse);

        expect(_has('skill-locked-kanji'), isFalse);
        expect(_has('skill-toggle-kanji'), isTrue);
        for (final skill in <String>['listening', 'reading']) {
          expect(_has('skill-locked-$skill'), isTrue);
          final chip = tester.widget<FilterChip>(
            find.byKey(Key('skill-locked-$skill')),
          );
          expect(chip.onSelected, isNull, reason: 'phải bị khóa');
        }
        expect(find.text('Chưa có trong phiên bản này'), findsWidgets);
      },
    );

    testWidgets(
      'đổi thời gian mỗi ngày gửi PATCH /me và báo áp dụng từ kế hoạch kế tiếp',
      (tester) async {
        final t = await _open(tester);
        await _tap(tester, 'minutes-15');
        expect(t.adjust.patches, <Map<String, Object?>>[
          <String, Object?>{'dailyMinutes': 15},
        ]);
        expect(_selected(tester, 'minutes-15'), isTrue);
        expect(_selected(tester, 'minutes-10'), isFalse);
        expect(find.byKey(const Key('adjust-message')), findsOneWidget);
        expect(find.textContaining('kế hoạch kế tiếp'), findsWidgets);
      },
    );

    testWidgets('ưu tiên kỹ năng rồi bỏ ưu tiên (gửi null tường minh)', (
      tester,
    ) async {
      final t = await _open(tester);
      await _tap(tester, 'priority-grammar');
      expect(t.adjust.patches.last, <String, Object?>{
        'prioritizedSkill': 'grammar',
      });
      expect(_selected(tester, 'priority-grammar'), isTrue);

      await _tap(tester, 'priority-none');
      expect(t.adjust.patches.last, <String, Object?>{
        'prioritizedSkill': null,
      });
      expect(t.adjust.patches.last.containsKey('prioritizedSkill'), isTrue);
      expect(_selected(tester, 'priority-none'), isTrue);
    });

    testWidgets(
      'bật Kanji gửi skills mới; ưu tiên Kanji gửi prioritizedSkill',
      (tester) async {
        final t = await _open(tester);
        expect(_has('priority-kanji'), isFalse, reason: 'chưa chọn Kanji');
        await _tap(tester, 'skill-toggle-kanji');
        expect(t.adjust.patches.last, <String, Object?>{
          'skills': <String>['vocabulary', 'grammar', 'kanji'],
        });
        expect(find.textContaining('kế hoạch kế tiếp'), findsWidgets);
        expect(_has('priority-kanji'), isTrue);

        await _tap(tester, 'priority-kanji');
        expect(t.adjust.patches.last, <String, Object?>{
          'prioritizedSkill': 'kanji',
        });
        expect(_selected(tester, 'priority-kanji'), isTrue);
      },
    );

    testWidgets(
      'bỏ Kanji khi đang ưu tiên Kanji thì xóa lựa chọn ưu tiên trên UI',
      (tester) async {
        final t = await _open(tester);
        await _tap(tester, 'skill-toggle-kanji');
        await _tap(tester, 'priority-kanji');
        expect(_selected(tester, 'priority-kanji'), isTrue);

        await _tap(tester, 'skill-toggle-kanji');
        expect(t.adjust.patches.last, <String, Object?>{
          'skills': <String>['vocabulary', 'grammar'],
        });
        expect(_has('priority-kanji'), isFalse);
        expect(_selected(tester, 'priority-none'), isTrue);
      },
    );

    testWidgets('không bỏ được kỹ năng cuối cùng còn chọn', (tester) async {
      final t = await _open(tester);
      await _tap(tester, 'skill-toggle-grammar');
      expect(t.adjust.patches.last, <String, Object?>{
        'skills': <String>['vocabulary'],
      });
      final chip = tester.widget<FilterChip>(
        find.byKey(const Key('skill-toggle-vocabulary')),
      );
      expect(chip.onSelected, isNull);
    });

    testWidgets(
      'đổi mục tiêu sang JLPT bắt buộc chọn cấp độ trước khi áp dụng',
      (tester) async {
        final t = await _open(tester);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('apply-goal')))
              .onPressed,
          isNull,
          reason: 'chưa đổi gì',
        );

        await _choose(tester, 'goal-select', 'Thi JLPT');
        expect(_has('target-level-select'), isTrue);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('apply-goal')))
              .onPressed,
          isNull,
          reason: 'JLPT thiếu cấp độ',
        );

        await _choose(tester, 'target-level-select', 'N3 – Trung cấp');
        await _tap(tester, 'apply-goal');
        expect(t.adjust.patches, hasLength(1));
        expect(t.adjust.patches.single, <String, Object?>{
          'goalType': 'jlpt',
          'targetLevel': 'N3',
        });
        expect(find.textContaining('Lộ trình mới'), findsWidgets);
        // Sau khi lưu không còn thay đổi chưa áp dụng.
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('apply-goal')))
              .onPressed,
          isNull,
        );
      },
    );

    testWidgets('đổi mục tiêu sang loại khác không gửi cấp độ JLPT', (
      tester,
    ) async {
      final t = await _open(tester);
      await _choose(tester, 'goal-select', 'Sử dụng trong công việc');
      await _tap(tester, 'apply-goal');
      expect(t.adjust.patches.single, <String, Object?>{'goalType': 'work'});
    });

    testWidgets(
      'lỗi từ server hiển thị thông báo cụ thể, không báo thành công',
      (tester) async {
        final t = await _open(tester);
        t.adjust.rejectPatch = true;
        await _tap(tester, 'minutes-30');
        expect(find.byKey(const Key('adjust-message')), findsOneWidget);
        expect(find.textContaining('kế hoạch kế tiếp'), findsNothing);
        // Lựa chọn hiển thị vẫn là giá trị đã lưu.
        expect(_selected(tester, 'minutes-10'), isTrue);
      },
    );

    testWidgets('tạm dừng rồi tiếp tục lộ trình', (tester) async {
      final t = await _open(tester);
      await _tap(tester, 'pause-path');
      expect(t.env.backend.sent('POST /path/pause'), hasLength(1));
      expect(_has('paused-status'), isTrue);
      expect(_has('resume-path'), isTrue);
      expect(_has('pause-path'), isFalse);

      await _tap(tester, 'resume-path');
      expect(t.env.backend.sent('POST /path/resume'), hasLength(1));
      expect(_has('paused-status'), isFalse);
      expect(_has('pause-path'), isTrue);
    });

    testWidgets('xây dựng lại cần xác nhận; hủy thì không gọi server', (
      tester,
    ) async {
      final t = await _open(tester);
      t.env.backend.on(
        'POST /path/rebuild',
        (_) => FakeResponse(200, t.scenario.pathSummary),
      );
      await _tap(tester, 'rebuild-path');
      expect(find.text('Xây dựng lại lộ trình?'), findsOneWidget);
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(t.env.backend.sent('POST /path/rebuild'), isEmpty);

      await _tap(tester, 'rebuild-path');
      await tester.tap(
        find.widgetWithText(FilledButton, 'Xây dựng lại lộ trình'),
      );
      await tester.pumpAndSettle();
      expect(t.env.backend.sent('POST /path/rebuild'), hasLength(1));
      expect(find.text('Đã xây dựng lại lộ trình.'), findsOneWidget);
    });

    testWidgets('vào được từ màn hình Lộ trình', (tester) async {
      await _open(tester, route: '/path');
      await _tap(tester, 'adjust-plan');
      expect(_has('pause-path'), isTrue);
      expect(_has('goal-select'), isTrue);
    });
  });

  group('đánh dấu đã thành thạo trên màn hình Lộ trình', () {
    Map<String, Object?> unit(String id, String status) => <String, Object?>{
      'unitId': id,
      'title': 'Đơn vị $id',
      'kind': 'vocabulary',
      'level': 'N5',
      'estMinutes': 5,
      'status': status,
    };

    void pathWith(
      LearningScenario s,
      TestEnv env,
      List<Map<String, Object?>> items,
    ) {
      env.backend.on(
        'GET /path',
        (_) => FakeResponse(200, <String, Object?>{
          ...s.pathSummary,
          'items': items,
        }),
      );
    }

    testWidgets(
      'đánh dấu một đơn vị gọi PUT và báo kết quả, không cần xác nhận',
      (tester) async {
        final t = await _open(tester, route: '/path');
        t.env.backend.on('PUT /path/units/u1/master', (r) {
          expect(requestJson(r), <String, Object?>{'mastered': true});
          return const FakeResponse(200, <String, Object?>{
            'remainingUnits': 1,
          });
        });
        await _tap(tester, 'master-u1');
        expect(t.env.backend.sent('PUT /path/units/u1/master'), hasLength(1));
        expect(find.textContaining('đã thành thạo'), findsWidgets);
        expect(find.byKey(const Key('path-message')), findsOneWidget);
      },
    );

    testWidgets('đơn vị đã thành thạo có nút bỏ đánh dấu', (tester) async {
      final t = await _open(tester, route: '/profile');
      pathWith(t.scenario, t.env, <Map<String, Object?>>[
        unit('u1', 'mastered'),
        unit('u2', 'pending'),
      ]);
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
      await tester.pumpAndSettle();

      t.env.backend.on('PUT /path/units/u1/master', (r) {
        expect(requestJson(r), <String, Object?>{'mastered': false});
        return const FakeResponse(200, <String, Object?>{'remainingUnits': 2});
      });
      expect(
        find.descendant(
          of: find.byKey(const Key('master-u1')),
          matching: find.text('Bỏ đánh dấu'),
        ),
        findsOneWidget,
      );
      await _tap(tester, 'master-u1');
      expect(t.env.backend.sent('PUT /path/units/u1/master'), hasLength(1));
    });

    testWidgets(
      'đơn vị cuối cùng còn lại: hỏi xác nhận; hủy thì không gọi server',
      (tester) async {
        final t = await _open(tester, route: '/profile');
        pathWith(t.scenario, t.env, <Map<String, Object?>>[
          unit('u1', 'pending'),
          unit('u2', 'mastered'),
        ]);
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
        await tester.pumpAndSettle();

        await _tap(tester, 'master-u1');
        expect(find.text('Đánh dấu đơn vị cuối cùng?'), findsOneWidget);
        await tester.tap(find.text('Hủy'));
        await tester.pumpAndSettle();
        expect(t.env.backend.sent('PUT /path/units/u1/master'), isEmpty);
      },
    );

    testWidgets('đơn vị cuối cùng + raise_level: nâng trình độ lên N4', (
      tester,
    ) async {
      final t = await _open(tester, route: '/profile');
      pathWith(t.scenario, t.env, <Map<String, Object?>>[
        unit('u1', 'pending'),
        unit('u2', 'mastered'),
      ]);
      t.env.backend.on(
        'PUT /path/units/u1/master',
        (_) => const FakeResponse(200, <String, Object?>{
          'remainingUnits': 0,
          'suggestion': 'raise_level',
        }),
      );
      GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
      await tester.pumpAndSettle();

      await _tap(tester, 'master-u1');
      expect(find.text('Đánh dấu đơn vị cuối cùng?'), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('Đã thành thạo'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('suggestion-raise-level')), findsOneWidget);
      expect(find.byKey(const Key('suggestion-retake')), findsOneWidget);
      await tester.tap(find.byKey(const Key('suggestion-raise')));
      await tester.pumpAndSettle();
      expect(t.adjust.patches.single, <String, Object?>{'currentLevel': 'N4'});
    });

    testWidgets(
      'đơn vị cuối cùng + content_exhausted: thông báo hết nội dung',
      (tester) async {
        final t = await _open(tester, route: '/profile');
        pathWith(t.scenario, t.env, <Map<String, Object?>>[
          unit('u1', 'pending'),
          unit('u2', 'mastered'),
        ]);
        t.env.backend.on(
          'PUT /path/units/u1/master',
          (_) => const FakeResponse(200, <String, Object?>{
            'remainingUnits': 0,
            'suggestion': 'content_exhausted',
          }),
        );
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/path');
        await tester.pumpAndSettle();

        await _tap(tester, 'master-u1');
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Đã thành thạo'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('suggestion-exhausted')), findsOneWidget);
        expect(find.byKey(const Key('suggestion-raise')), findsNothing);
        expect(t.adjust.patches, isEmpty);
      },
    );
  });

  group('màn hình Hôm nay khi đang tạm dừng', () {
    testWidgets(
      'có nút tiếp tục lộ trình; bấm thì gọi server và tải lại kế hoạch',
      (tester) async {
        TestEnv.useDesktopSize(tester);
        addTearDown(tester.view.reset);
        final env = TestEnv(tokens: signedInTokens());
        final scenario = LearningScenario(env.backend)..onboarded = true;
        var paused = true;
        env.backend.on('GET /today', (_) {
          if (paused) {
            return const FakeResponse(409, <String, Object?>{
              'code': 'PATH_PAUSED',
              'message': 'Lộ trình đang tạm dừng',
            });
          }
          return FakeResponse(200, scenario.todayPlan);
        });
        env.backend.on('POST /path/resume', (_) {
          paused = false;
          return const FakeResponse(204);
        });
        await tester.pumpWidget(env.app());
        await tester.pumpAndSettle();
        GoRouter.of(tester.element(find.byType(Scaffold).first)).go('/today');
        await tester.pumpAndSettle();

        expect(_has('today-paused'), isTrue);
        await _tap(tester, 'resume-path');
        expect(env.backend.sent('POST /path/resume'), hasLength(1));
        expect(_has('today-paused'), isFalse);
        expect(_has('today-time-summary'), isTrue);
      },
    );
  });
}
