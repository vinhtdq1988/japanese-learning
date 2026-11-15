import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Màu năng lực ở ba màn (spec 007, T111, FR-016…FR-020): Hôm nay, Lộ trình, Tiến độ cùng dùng chip + chú giải;
// thiếu trường `competency` (máy chủ cũ) ⇒ không chip, màn bình thường; người học mới ⇒ toàn chip trung tính.

Map<String, Object?> _planItem(
  String id,
  String kind,
  String title, {
  String? competency,
  String type = 'new_unit',
}) => <String, Object?>{
  'id': id,
  'type': type,
  'kind': type == 'review_batch' ? null : kind,
  'title': title,
  'estMinutes': 5,
  'status': 'pending',
  'itemCount': type == 'review_batch' ? 4 : null,
  if (competency != null || type == 'review_batch') 'competency': competency,
};

Map<String, Object?> _today(List<Map<String, Object?>> items) =>
    <String, Object?>{
      'id': 'plan-1',
      'localDate': '2026-01-05',
      'budgetMinutes': 30,
      'estimatedMinutes': 15,
      'status': 'open',
      'notice': null,
      'items': items,
    };

Map<String, Object?> _pathUnit(String id, String title, String? competency) =>
    <String, Object?>{
      'unitId': id,
      'title': title,
      'kind': 'vocabulary',
      'level': 'N5',
      'estMinutes': 5,
      'status': 'pending',
      if (competency != null) 'competency': competency,
    };

Map<String, Object?> _progress({Object? competency}) => <String, Object?>{
  'isEmpty': false,
  'totalMinutes': 16.5,
  'lessonsCompleted': 3,
  'reviewAccuracy': 0.75,
  'currentStreakDays': 4,
  'goal': <String, Object?>{
    'completionRatio': 0.5,
    'onTrack': true,
    'targetDate': null,
    'scopeNotice': null,
  },
  'kanji': null,
  'weakTopics': <Map<String, Object?>>[
    <String, Object?>{
      'topicId': 'tk',
      'name': 'Số đếm Kanji',
      'skill': 'kanji',
      'accuracy': 0.5,
    },
  ],
  if (competency != null) 'competency': competency,
};

Map<String, Object?> _competency(List<(String, String)> skills) =>
    <String, Object?>{
      'skills': <Map<String, Object?>>[
        for (final s in skills)
          <String, Object?>{
            'skill': s.$1,
            'level': s.$2,
            'answered': s.$2 == 'insufficient' ? 0 : 10,
            'accuracy': s.$2 == 'insufficient' ? null : 0.8,
          },
      ],
      'topics': <Map<String, Object?>>[
        <String, Object?>{
          'topicId': 'tk',
          'skill': 'kanji',
          'level': 'needs_improvement',
          'answered': 10,
          'accuracy': 0.5,
        },
      ],
    };

Future<TestEnv> _open(
  WidgetTester tester, {
  required String route,
  Map<String, Object?>? today,
  Map<String, Object?>? path,
  Map<String, Object?>? progress,
  Brightness? platformBrightness,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  if (platformBrightness != null) {
    tester.platformDispatcher.platformBrightnessTestValue = platformBrightness;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  }
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend)..onboarded = true;
  if (today != null) env.backend.reply('GET /today', 200, today);
  if (path != null) {
    env.backend.reply('GET /path', 200, <String, Object?>{
      ...scenario.pathDetail,
      ...path,
    });
  }
  if (progress != null) env.backend.reply('GET /progress', 200, progress);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

void main() {
  group('Hôm nay', () {
    testWidgets(
      'mục new_unit có chip theo kỹ năng, gói ôn không chip, có chú giải',
      (tester) async {
        await _open(
          tester,
          route: '/today',
          today: _today(<Map<String, Object?>>[
            _planItem('a', 'vocabulary', 'Chào hỏi', competency: 'good'),
            _planItem('b', 'kanji', 'Số đếm', competency: 'needs_improvement'),
            _planItem('c', 'reading', 'Đọc', competency: 'insufficient'),
            _planItem('r', 'x', 'Ôn tập', type: 'review_batch'),
          ]),
        );
        expect(_has('competency-a'), isTrue);
        expect(_has('competency-b'), isTrue);
        expect(_has('competency-c'), isTrue);
        expect(_has('competency-r'), isFalse);
        expect(find.byKey(const Key('competency-legend')), findsOneWidget);
        expect(find.text('Tốt'), findsWidgets);
        expect(find.text('Cần cải thiện'), findsWidgets);
      },
    );

    testWidgets(
      'máy chủ cũ (không có competency) ⇒ không chip, không chú giải',
      (tester) async {
        await _open(
          tester,
          route: '/today',
          today: _today(<Map<String, Object?>>[
            _planItem('a', 'vocabulary', 'Chào hỏi'),
          ]),
        );
        expect(find.text('Chào hỏi'), findsOneWidget);
        expect(_has('competency-a'), isFalse);
        expect(_has('competency-legend'), isFalse);
      },
    );

    testWidgets('người học mới: toàn chip trung tính, không thông báo "yếu"', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/today',
        today: _today(<Map<String, Object?>>[
          _planItem('a', 'vocabulary', 'Chào hỏi', competency: 'insufficient'),
          _planItem('b', 'grammar', 'Trợ từ', competency: 'insufficient'),
        ]),
      );
      expect(
        find.text('Chưa đủ dữ liệu'),
        findsNWidgets(3),
      ); // 2 chip + chú giải
      expect(find.text('Cần cải thiện'), findsOneWidget); // chỉ ở chú giải
      expect(find.byIcon(Icons.hourglass_empty), findsNWidgets(3));
    });

    testWidgets('giao diện tối vẫn hiển thị chip và chú giải', (tester) async {
      await _open(
        tester,
        route: '/today',
        platformBrightness: Brightness.dark,
        today: _today(<Map<String, Object?>>[
          _planItem('a', 'vocabulary', 'Chào hỏi', competency: 'good'),
        ]),
      );
      expect(_has('competency-a'), isTrue);
      expect(find.byKey(const Key('competency-legend')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('Lộ trình', () {
    testWidgets('mỗi đơn vị có chip theo chủ đề và có chú giải', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/path',
        path: <String, Object?>{
          'items': <Map<String, Object?>>[
            _pathUnit('u1', 'Chào hỏi', 'good'),
            _pathUnit('u2', 'Câu danh từ với です', 'insufficient'),
          ],
        },
      );
      expect(_has('competency-u1'), isTrue);
      expect(_has('competency-u2'), isTrue);
      expect(find.byKey(const Key('competency-legend')), findsOneWidget);
    });

    testWidgets('thiếu competency ⇒ không chip, không chú giải', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/path',
        path: <String, Object?>{
          'items': <Map<String, Object?>>[_pathUnit('u1', 'Chào hỏi', null)],
        },
      );
      expect(find.text('Chào hỏi'), findsOneWidget);
      expect(_has('competency-u1'), isFalse);
      expect(_has('competency-legend'), isFalse);
    });
  });

  group('Tiến độ', () {
    testWidgets(
      'dải năng lực theo kỹ năng, danh sách chủ đề (gồm mảng yếu) và chú giải',
      (tester) async {
        await _open(
          tester,
          route: '/progress',
          progress: _progress(
            competency: _competency(<(String, String)>[
              ('vocabulary', 'good'),
              ('grammar', 'insufficient'),
              ('kanji', 'needs_improvement'),
              ('reading', 'good'),
              ('writing', 'insufficient'),
            ]),
          ),
        );
        expect(find.text('Năng lực theo kỹ năng'), findsOneWidget);
        for (final skill in <String>[
          'vocabulary',
          'grammar',
          'kanji',
          'reading',
          'writing',
        ]) {
          expect(_has('competency-skill-$skill'), isTrue);
        }
        expect(find.text('Năng lực theo chủ đề'), findsOneWidget);
        expect(_has('competency-topic-tk'), isTrue);
        expect(find.text('Số đếm Kanji'), findsWidgets);
        expect(find.byKey(const Key('competency-legend')), findsOneWidget);
      },
    );

    testWidgets(
      'thiếu competency (máy chủ cũ) ⇒ bỏ qua khối, màn bình thường',
      (tester) async {
        await _open(tester, route: '/progress', progress: _progress());
        expect(_has('metric-time'), isTrue);
        expect(_has('progress-competency'), isFalse);
        expect(_has('competency-legend'), isFalse);
      },
    );

    testWidgets('người học mới: toàn chip trung tính và không có chủ đề', (
      tester,
    ) async {
      final empty = <String, Object?>{
        ..._progress(
          competency: <String, Object?>{
            'skills': <Map<String, Object?>>[
              <String, Object?>{
                'skill': 'vocabulary',
                'level': 'insufficient',
                'answered': 0,
                'accuracy': null,
              },
              <String, Object?>{
                'skill': 'grammar',
                'level': 'insufficient',
                'answered': 0,
                'accuracy': null,
              },
            ],
            'topics': <Object?>[],
          },
        ),
        'weakTopics': <Object?>[],
      };
      await _open(tester, route: '/progress', progress: empty);
      expect(_has('progress-competency'), isTrue);
      expect(find.text('Năng lực theo chủ đề'), findsNothing);
      expect(
        find.byIcon(Icons.hourglass_empty),
        findsNWidgets(3),
      ); // 2 chip + chú giải
    });
  });
}
