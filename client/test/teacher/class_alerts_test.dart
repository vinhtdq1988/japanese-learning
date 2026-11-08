import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/app.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';
import 'package:japanese_learning_client/platform/platform_providers.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Cảnh báo, chủ đề yếu và xuất CSV của lớp (spec 004, US7, T121, FR-031 → FR-033, quickstart OG7): cột cảnh báo
// và bộ lọc "cần chú ý" chỉ một lần nhấp (SC-007), màn chủ đề yếu, xuất CSV lưu byte nguyên vẹn (kể cả BOM)
// qua `saveCsv()`, đổi ngưỡng vắng 1–14. Máy chủ giả chỉ mô phỏng hợp đồng.

Map<String, Object?> _row(
  String id,
  String name, {
  List<String> alerts = const <String>[],
  int absentDays = 0,
  String status = 'on_track',
}) => <String, Object?>{
  'userId': id,
  'displayName': name,
  'email': '$id@example.com',
  'joinedAt': '2026-01-06T03:00:00.000Z',
  'hasStarted': true,
  'pathCompleted': false,
  'completionRatio': 0.5,
  'expectedRatio': 0.5,
  'streakDays': 1,
  'minutesLast7Days': 20,
  'minutesTotal': 60,
  'reviewAccuracy': 0.8,
  'lastActiveOn': '2026-01-19',
  'progressStatus': status,
  'alerts': alerts,
  'absentDays': absentDays,
};

Map<String, Object?> _dashboard() => <String, Object?>{
  'classId': 'class-1',
  'learners': <Object?>[
    _row('u1', 'An'),
    _row('u2', 'Bình', alerts: <String>['absent'], absentDays: 4),
    _row(
      'u3',
      'Chi',
      alerts: <String>['behind', 'overdue_assignment'],
      status: 'behind',
    ),
  ],
  'summary': <String, Object?>{
    'learnerCount': 3,
    'onTrack': 2,
    'behind': 1,
    'ahead': 0,
    'paused': 0,
    'needAttention': 2,
    'avgCompletionRatio': 0.5,
    'avgReviewAccuracy': 0.8,
  },
  'contentNotices': <Object?>[],
  'teacherlessWarning': false,
};

Map<String, Object?> _classDetail() => <String, Object?>{
  'id': 'class-1',
  'name': 'N5 buổi tối',
  'status': 'active',
  'memberCount': 3,
  'hasPath': true,
  'teachers': <Object?>[],
  'teacherless': false,
  'absenceThresholdDays': 3,
  'createdAt': '2026-01-05T08:00:00.000Z',
};

const String _csv = '﻿display_name,email\r\nAn,u1@example.com\r\n';
final List<int> _csvBytes = utf8.encode(_csv);

Future<({TestEnv env, MemoryFileTransfer files})> _open(
  WidgetTester tester,
  String location, {
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  env.backend
    ..reply('GET /classes/class-1/dashboard', 200, _dashboard())
    ..reply('GET /classes/class-1', 200, _classDetail())
    ..reply('GET /classes/class-1/roster', 200, <Object?>[])
    ..reply('GET /classes/class-1/join-code', 200, <String, Object?>{
      'enabled': false,
    })
    ..reply('GET /classes/class-1/weak-topics', 200, <Object?>[
      <String, Object?>{
        'topicId': 't1',
        'name': 'Trợ từ は/が',
        'skill': 'grammar',
        'accuracy': 0.4,
        'answers': 36,
        'flaggedLearners': <Object?>[
          <String, Object?>{'userId': 'u2', 'displayName': 'Bình'},
        ],
      },
    ])
    ..on(
      'GET /classes/class-1/export.csv',
      (_) => const FakeResponse(200, _csv, <String, String>{
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition':
            "attachment; filename*=UTF-8''class-n5-2026-01-20.csv",
      }),
    );
  setup?.call(env.backend);
  final files = MemoryFileTransfer();
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...env.overrides,
        fileTransferProvider.overrideWithValue(files),
      ],
      child: const JapaneseLearningApp(),
    ),
  );
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(location);
  await tester.pumpAndSettle();
  return (env: env, files: files);
}

List<String> _names(WidgetTester tester) {
  if (find.byType(DataTable).evaluate().isEmpty) return <String>[];
  return tester
      .widget<DataTable>(find.byType(DataTable))
      .rows
      .map(
        (r) => (r.key! as ValueKey<String>).value.substring('learner-'.length),
      )
      .toList();
}

void main() {
  testWidgets('cột cảnh báo hiện nhãn từng cảnh báo, vắng kèm số ngày', (
    tester,
  ) async {
    await _open(tester, '/classes/class-1/dashboard');
    expect(find.byKey(const Key('alert-u2-absent')), findsOneWidget);
    expect(find.text('Vắng 4 ngày'), findsOneWidget);
    expect(find.byKey(const Key('alert-u3-behind')), findsOneWidget);
    expect(
      find.byKey(const Key('alert-u3-overdue_assignment')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('alert-u1-behind')), findsNothing);
    expect(find.byKey(const Key('dashboard-need-attention')), findsOneWidget);
    expect(find.text('2 học viên cần chú ý'), findsOneWidget);
  });

  testWidgets(
    'một lần nhấp "Cần chú ý" chỉ giữ học viên có cảnh báo (SC-007)',
    (tester) async {
      await _open(tester, '/classes/class-1/dashboard');
      expect(_names(tester), hasLength(3));
      await tester.tap(find.byKey(const Key('filter-needs-attention')));
      await tester.pumpAndSettle();
      expect(_names(tester), <String>['u2', 'u3']);
      await tester.tap(find.byKey(const Key('filter-absent')));
      await tester.pumpAndSettle();
      expect(_names(tester), <String>['u2']);
    },
  );

  testWidgets(
    'xuất CSV lớp lưu byte nguyên vẹn (có BOM) với tên tệp từ máy chủ',
    (tester) async {
      final opened = await _open(tester, '/classes/class-1/dashboard');
      await tester.tap(find.byKey(const Key('dashboard-export')));
      await tester.pumpAndSettle();
      expect(opened.files.saved, hasLength(1));
      expect(opened.files.saved.single.filename, 'class-n5-2026-01-20.csv');
      expect(opened.files.saved.single.bytes, _csvBytes);
      expect(opened.files.saved.single.bytes.take(3), <int>[0xef, 0xbb, 0xbf]);
      expect(find.textContaining('class-n5-2026-01-20.csv'), findsOneWidget);
    },
  );

  testWidgets(
    'chủ đề yếu: hiện độ chính xác, số học viên gắn cờ và tên khi mở',
    (tester) async {
      await _open(tester, '/classes/class-1/weak-topics');
      expect(find.byKey(const Key('weak-topic-t1')), findsOneWidget);
      expect(
        find.textContaining('Độ chính xác 40% trên 36 câu'),
        findsOneWidget,
      );
      expect(find.textContaining('1 học viên bị gắn cờ yếu'), findsOneWidget);
      await tester.tap(find.byKey(const Key('weak-topic-t1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('weak-topic-t1-u2')), findsOneWidget);
      expect(find.text('Bình'), findsOneWidget);
    },
  );

  testWidgets('chủ đề yếu rỗng hiện trạng thái rỗng', (tester) async {
    await _open(
      tester,
      '/classes/class-1/weak-topics',
      setup: (b) =>
          b.reply('GET /classes/class-1/weak-topics', 200, <Object?>[]),
    );
    expect(find.byKey(const Key('weak-topics-empty')), findsOneWidget);
  });

  testWidgets(
    'chi tiết lớp: đổi ngưỡng vắng gửi PATCH, ngoài 1–14 bị chặn ở client',
    (tester) async {
      final opened = await _open(
        tester,
        '/classes/class-1',
        setup: (b) => b.reply('PATCH /classes/class-1', 200, <String, Object?>{
          ..._classDetail(),
          'absenceThresholdDays': 5,
        }),
      );
      expect(find.text('Ngưỡng vắng mặt: 3 ngày'), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('class-edit-threshold')));
      await tester.tap(find.byKey(const Key('class-edit-threshold')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('form-days')), '20');
      await tester.tap(find.byKey(const Key('form-submit')));
      await tester.pumpAndSettle();
      expect(opened.env.backend.sent('PATCH /classes/class-1'), isEmpty);
      expect(find.text('Nhập số nguyên từ 1 đến 14'), findsOneWidget);

      await tester.tap(find.byKey(const Key('class-edit-threshold')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('form-days')), '5');
      await tester.tap(find.byKey(const Key('form-submit')));
      await tester.pumpAndSettle();
      final sent = opened.env.backend.sent('PATCH /classes/class-1');
      expect(sent, hasLength(1));
      expect(sent.single.data, <String, Object?>{'absenceThresholdDays': 5});
    },
  );
}
