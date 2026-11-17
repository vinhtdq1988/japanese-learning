import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Thông báo phạm vi suy ra lúc đọc ở Tiến độ, Lộ trình và Hồ sơ (spec 008, T227, FR-022, OpenAPI 1.15.0):
// `listening_not_available` chỉ hiện khi máy chủ trả (mục tiêu JLPT); `content_ceiling_n3` đứng trước; máy chủ cũ
// không có `notices` thì lùi về `scopeNotice`.

const String _ceilingText = 'Nội dung hiện có chỉ đến trình độ N3';
const String _listeningText = 'chưa có phần nghe hiểu';

Map<String, Object?> _summary({List<String>? notices, Object? scopeNotice}) =>
    <String, Object?>{
      'isEmpty': false,
      'totalMinutes': 16.5,
      'lessonsCompleted': 3,
      'reviewAccuracy': 0.75,
      'currentStreakDays': 4,
      'goal': <String, Object?>{
        'completionRatio': 0.5,
        'onTrack': true,
        'targetDate': '2026-01-25',
        'scopeNotice': scopeNotice,
        if (notices != null) 'notices': notices,
      },
      'kanji': null,
      'weakTopics': <Map<String, Object?>>[],
    };

Future<TestEnv> _open(
  WidgetTester tester, {
  required String route,
  Map<String, Object?>? summary,
  List<String>? pathNotices,
  Object? pathScopeNotice,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  final scenario = LearningScenario(env.backend)..onboarded = true;
  if (summary != null) env.backend.reply('GET /progress', 200, summary);
  env.backend.reply('GET /path', 200, <String, Object?>{
    ...scenario.pathDetail,
    'scopeNotice': pathScopeNotice,
    if (pathNotices != null) 'notices': pathNotices,
  });
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

bool _has(String key) => find.byKey(Key(key)).evaluate().isNotEmpty;

void main() {
  group('Tiến độ (goal.notices)', () {
    testWidgets('mục tiêu JLPT: hiện thông báo chưa có phần nghe hiểu', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/progress',
        summary: _summary(notices: <String>['listening_not_available']),
      );
      expect(_has('scope-notice'), isTrue);
      expect(_has('scope-notice-listeningNotAvailable'), isTrue);
      expect(_has('scope-notice-contentCeilingN3'), isFalse);
      expect(find.textContaining(_listeningText), findsOneWidget);
    });

    testWidgets('N2/N1 + JLPT: cả hai thông báo, trần N3 đứng trước', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/progress',
        summary: _summary(
          notices: <String>['content_ceiling_n3', 'listening_not_available'],
          scopeNotice: 'content_ceiling_n3',
        ),
      );
      expect(find.textContaining(_ceilingText), findsOneWidget);
      expect(find.textContaining(_listeningText), findsOneWidget);
      final ceilingTop = tester
          .getTopLeft(find.byKey(const Key('scope-notice-contentCeilingN3')))
          .dy;
      final listeningTop = tester
          .getTopLeft(
            find.byKey(const Key('scope-notice-listeningNotAvailable')),
          )
          .dy;
      expect(ceilingTop, lessThan(listeningTop));
    });

    testWidgets('không phải JLPT (notices rỗng): không có banner nghe hiểu', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/progress',
        summary: _summary(notices: <String>[]),
      );
      expect(_has('scope-notice'), isFalse);
      expect(find.textContaining(_listeningText), findsNothing);
    });

    testWidgets('máy chủ cũ không có notices: lùi về scopeNotice', (
      tester,
    ) async {
      await _open(
        tester,
        route: '/progress',
        summary: _summary(scopeNotice: 'content_ceiling_n3'),
      );
      expect(_has('scope-notice-contentCeilingN3'), isTrue);
      expect(find.textContaining(_listeningText), findsNothing);
    });
  });

  group('Lộ trình (PathSummary.notices)', () {
    testWidgets(
      'hiện theo notices của lộ trình; người học không JLPT không thấy',
      (tester) async {
        await _open(
          tester,
          route: '/path',
          pathNotices: <String>['listening_not_available'],
        );
        expect(_has('scope-notice-listeningNotAvailable'), isTrue);
      },
    );

    testWidgets('notices rỗng: không có banner', (tester) async {
      await _open(tester, route: '/path', pathNotices: <String>[]);
      expect(_has('scope-notice'), isFalse);
    });
  });
}
