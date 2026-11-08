import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_backend.dart';
import '../support/learning_scenario.dart';

// Tinh chỉnh lộ trình lớp của giáo viên (spec 004, US5, T100, FR-022 → FR-026): chọn bài/thứ tự/ngày mở, bài
// giao kèm cảnh báo khả thi (không chặn), thông báo đơn vị bị ngừng, điều chỉnh riêng một học viên và tạm
// dừng. Máy chủ giả chỉ mô phỏng hợp đồng; quyền và tính toán thật do server kiểm.

Map<String, Object?> _unit(String id, String title, int position) =>
    <String, Object?>{
      'unitId': id,
      'title': title,
      'kind': 'vocabulary',
      'level': 'N5',
      'estMinutes': 5,
      'position': position,
      'isOpen': true,
    };

Map<String, Object?> _path({
  String mode = 'template',
  List<Object?>? units,
  List<Object?> assignments = const <Object?>[],
  List<Object?> contentNotices = const <Object?>[],
}) => <String, Object?>{
  'startLevel': 'N5',
  'targetLevel': 'N4',
  'skills': <Object?>['vocabulary', 'grammar'],
  'startsOn': '2026-01-05',
  'endsOn': '2026-06-30',
  'dailyMinutes': 10,
  'mode': mode,
  'units':
      units ??
      <Object?>[
        _unit('u1', 'Chào hỏi', 1),
        _unit('u2', 'Số đếm', 2),
        _unit('u3', 'Trợ từ', 3),
      ],
  'assignments': assignments,
  'warnings': <Object?>[],
  'contentNotices': contentNotices,
  'updatedAt': '2026-01-05T08:00:00.000Z',
};

Future<TestEnv> _open(
  WidgetTester tester,
  String location, {
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(tokens: signedInTokens());
  LearningScenario(env.backend).onboarded = true;
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(location);
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tap(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Mở danh sách "Thêm bài…" và chọn dòng có tiêu đề [title].
Future<void> _addUnit(WidgetTester tester, String title) async {
  await _tap(tester, 'class-units-add');
  await tester.tap(find.textContaining(title).last);
  await tester.pumpAndSettle();
}

void main() {
  group('chọn bài, thứ tự, ngày mở', () {
    testWidgets(
      'thêm, sắp xếp và lưu gửi đúng PUT /path/units theo thứ tự; trở lại chế độ mẫu gửi danh sách rỗng',
      (tester) async {
        final env = await _open(
          tester,
          '/classes/class-1/path',
          setup: (b) {
            b.reply('GET /classes/class-1/path', 200, <String, Object?>{
              'path': _path(),
            });
            b.reply(
              'PUT /classes/class-1/path/units',
              200,
              _path(
                mode: 'explicit',
                units: <Object?>[
                  _unit('u2', 'Số đếm', 1),
                  _unit('u1', 'Chào hỏi', 2),
                ],
              ),
            );
          },
        );
        expect(find.byKey(const Key('class-units-empty')), findsOneWidget);
        expect(find.text('Đang dùng chế độ mẫu.'), findsOneWidget);

        await _addUnit(tester, 'Chào hỏi');
        await _addUnit(tester, 'Số đếm');
        // Đưa "Số đếm" lên đầu.
        await _tap(tester, 'class-unit-up-u2');
        await _tap(tester, 'class-units-save');

        final body = requestJson(
          env.backend.sent('PUT /classes/class-1/path/units').single,
        );
        expect(
          (body['units']! as List<Object?>).map(
            (u) => (u! as Map<String, Object?>)['unitId'],
          ),
          <String>['u2', 'u1'],
        );
        expect(find.byKey(const Key('class-adjust-message')), findsOneWidget);
        expect(find.text('Đang dùng danh sách chọn (2 bài).'), findsOneWidget);

        env.backend.reply('PUT /classes/class-1/path/units', 200, _path());
        await _tap(tester, 'class-units-reset');
        final reset = requestJson(
          env.backend.sent('PUT /classes/class-1/path/units').last,
        );
        expect(reset['units'], isEmpty);
        expect(find.text('Đang dùng chế độ mẫu.'), findsOneWidget);
      },
    );

    testWidgets('không lưu được khi chưa chọn bài nào; gỡ bài khỏi danh sách', (
      tester,
    ) async {
      await _open(
        tester,
        '/classes/class-1/path',
        setup: (b) => b.reply(
          'GET /classes/class-1/path',
          200,
          <String, Object?>{'path': _path()},
        ),
      );
      final save = tester.widget<FilledButton>(
        find.byKey(const Key('class-units-save')),
      );
      expect(save.onPressed, isNull);
      await _addUnit(tester, 'Trợ từ');
      expect(find.byKey(const Key('class-unit-u3')), findsOneWidget);
      await _tap(tester, 'class-unit-remove-u3');
      expect(find.byKey(const Key('class-unit-u3')), findsNothing);
    });
  });

  group('bài giao', () {
    testWidgets(
      'giao bài gửi unitIds + hạn dạng yyyy-MM-dd, hiện cảnh báo vượt quỹ nhưng vẫn giao, hủy bằng DELETE',
      (tester) async {
        final env = await _open(
          tester,
          '/classes/class-1/path',
          setup: (b) {
            b.reply('GET /classes/class-1/path', 200, <String, Object?>{
              'path': _path(),
            });
            b.reply('POST /classes/class-1/assignments', 201, <String, Object?>{
              'batchId': 'batch-1',
              'assignments': <Object?>[
                <String, Object?>{
                  'id': 'as1',
                  'batchId': 'batch-1',
                  'unitId': 'u1',
                  'title': 'Chào hỏi',
                  'dueOn': '2026-02-01',
                },
              ],
              'warnings': <Object?>[
                <String, Object?>{
                  'code': 'over_capacity',
                  'requiredMinutes': 40,
                  'capacityMinutes': 20,
                  'assignmentId': 'as1',
                },
              ],
            });
            b.reply('DELETE /classes/class-1/assignments/as1', 204);
          },
        );
        expect(find.byKey(const Key('assign-none')), findsOneWidget);

        // Thiếu lựa chọn: báo lỗi phía client, không gửi yêu cầu.
        await _tap(tester, 'assign-submit');
        expect(find.byKey(const Key('class-adjust-error')), findsOneWidget);
        expect(env.backend.sent('POST /classes/class-1/assignments'), isEmpty);

        // Sau khi giao, lộ trình nạp lại có bài giao.
        env.backend.reply('GET /classes/class-1/path', 200, <String, Object?>{
          'path': _path(
            assignments: <Object?>[
              <String, Object?>{
                'id': 'as1',
                'batchId': 'batch-1',
                'unitId': 'u1',
                'title': 'Chào hỏi',
                'dueOn': '2026-02-01',
              },
            ],
          ),
        });
        await _tap(tester, 'assign-unit-u1');
        await _tap(tester, 'assign-submit');

        final body = requestJson(
          env.backend.sent('POST /classes/class-1/assignments').single,
        );
        expect(body['unitIds'], <String>['u1']);
        expect(body['dueOn'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
        expect(find.byKey(const Key('assign-warning')), findsOneWidget);
        expect(
          find.textContaining('(40 phút) vượt quỹ thời gian (20 phút)'),
          findsOneWidget,
        );
        expect(find.text('Chào hỏi · hạn 2026-02-01'), findsOneWidget);

        env.backend.reply('GET /classes/class-1/path', 200, <String, Object?>{
          'path': _path(),
        });
        await _tap(tester, 'assign-cancel-as1');
        expect(
          env.backend.sent('DELETE /classes/class-1/assignments/as1'),
          hasLength(1),
        );
        expect(find.byKey(const Key('assign-none')), findsOneWidget);
      },
    );

    testWidgets(
      'đơn vị bị ngừng còn trong lộ trình/bài giao: hiện thông báo cho giáo viên',
      (tester) async {
        await _open(
          tester,
          '/classes/class-1/path',
          setup: (b) =>
              b.reply('GET /classes/class-1/path', 200, <String, Object?>{
                'path': _path(
                  contentNotices: <Object?>[
                    <String, Object?>{
                      'unitId': 'x1',
                      'title': 'Cũ',
                      'source': 'path',
                    },
                    <String, Object?>{
                      'unitId': 'x2',
                      'title': 'Giao cũ',
                      'source': 'assignment',
                    },
                  ],
                ),
              }),
        );
        expect(
          find.byKey(const Key('class-content-notice-x1')),
          findsOneWidget,
        );
        expect(find.textContaining('Hãy gỡ bài khỏi lộ trình'), findsOneWidget);
        expect(find.textContaining('Hãy hủy bài giao'), findsOneWidget);
      },
    );
  });

  group('điều chỉnh riêng một học viên', () {
    Map<String, Object?> detail() => <String, Object?>{
      'userId': 'u1',
      'displayName': 'Cường',
      'row': <String, Object?>{
        'userId': 'u1',
        'displayName': 'Cường',
        'email': 'u1@example.com',
        'hasStarted': true,
        'pathCompleted': false,
        'progressStatus': 'on_track',
        'alerts': <Object?>[],
      },
      'units': <Object?>[
        <String, Object?>{
          'unitId': 'a',
          'title': 'Chào hỏi',
          'status': 'completed',
        },
        <String, Object?>{
          'unitId': 'b',
          'title': 'Số đếm',
          'status': 'pending',
        },
        <String, Object?>{'unitId': 'c', 'title': 'Trợ từ', 'status': 'exempt'},
      ],
      'dailyMinutes30': <Object?>[],
      'weakTopics': <Object?>[],
      'assignmentStates': <Object?>[],
    };

    testWidgets(
      'lưu gửi PUT override + miễn/bỏ miễn đúng đơn vị đã đổi, rồi nạp lại chi tiết',
      (tester) async {
        final env = await _open(
          tester,
          '/classes/class-1/learners/u1',
          setup: (b) {
            b.reply('GET /classes/class-1/members/u1/detail', 200, detail());
            b.reply(
              'PUT /classes/class-1/members/u1/override',
              200,
              <String, Object?>{
                'dailyMinutes': 5,
                'shiftDays': 2,
                'exemptUnitIds': <Object?>[],
              },
            );
            b.reply('PUT /classes/class-1/members/u1/exemptions/b', 204);
            b.reply('DELETE /classes/class-1/members/u1/exemptions/c', 204);
          },
        );
        await _tap(tester, 'learner-adjust-open');
        expect(find.byKey(const Key('learner-adjust-sheet')), findsOneWidget);
        // Đơn vị đã miễn sẵn được đánh dấu.
        expect(
          tester
              .widget<CheckboxListTile>(
                find.byKey(const Key('adjust-exempt-c')),
              )
              .value,
          isTrue,
        );

        await _tap(tester, 'adjust-minutes');
        await tester.tap(find.text('5 phút').last);
        await tester.pumpAndSettle();
        await _tap(tester, 'adjust-shift-more');
        await _tap(tester, 'adjust-shift-more');
        expect(find.text('Dời mốc: 2 ngày'), findsOneWidget);
        await _tap(tester, 'adjust-exempt-b');
        await _tap(tester, 'adjust-exempt-c');
        await _tap(tester, 'adjust-save');

        final override = requestJson(
          env.backend.sent('PUT /classes/class-1/members/u1/override').single,
        );
        expect(override, <String, Object?>{'dailyMinutes': 5, 'shiftDays': 2});
        expect(
          env.backend.sent('PUT /classes/class-1/members/u1/exemptions/b'),
          hasLength(1),
        );
        expect(
          env.backend.sent('DELETE /classes/class-1/members/u1/exemptions/c'),
          hasLength(1),
        );
        // Đóng bảng và nạp lại chi tiết.
        expect(find.byKey(const Key('learner-adjust-sheet')), findsNothing);
        expect(
          env.backend.sent('GET /classes/class-1/members/u1/detail').length,
          greaterThanOrEqualTo(2),
        );
      },
    );
  });

  group('tạm dừng', () {
    Map<String, Object?> dashboard() => <String, Object?>{
      'classId': 'class-1',
      'learners': <Object?>[
        <String, Object?>{
          'userId': 'u1',
          'displayName': 'Cường',
          'email': 'u1@example.com',
          'hasStarted': true,
          'pathCompleted': false,
          'progressStatus': 'on_track',
          'alerts': <Object?>[],
        },
      ],
      'summary': <String, Object?>{
        'learnerCount': 1,
        'onTrack': 1,
        'behind': 0,
        'ahead': 0,
        'paused': 0,
        'needAttention': 0,
      },
      'contentNotices': <Object?>[],
    };

    testWidgets(
      'tạo tạm dừng cả lớp (khoảng mở) và kết thúc bằng POST /end; danh sách nạp lại',
      (tester) async {
        final env = await _open(
          tester,
          '/classes/class-1/pauses',
          setup: (b) {
            b.reply('GET /classes/class-1/dashboard', 200, dashboard());
            b.reply('GET /classes/class-1/pauses', 200, <Object?>[]);
            b.reply('POST /classes/class-1/pauses', 201, <String, Object?>{
              'id': 'p1',
              'userId': null,
              'startedOn': '2026-01-20',
            });
            b.reply(
              'POST /classes/class-1/pauses/p1/end',
              200,
              <String, Object?>{
                'id': 'p1',
                'userId': null,
                'startedOn': '2026-01-20',
                'endedOn': '2026-01-21',
              },
            );
          },
        );
        expect(find.byKey(const Key('pauses-none')), findsOneWidget);

        env.backend.reply('GET /classes/class-1/pauses', 200, <Object?>[
          <String, Object?>{
            'id': 'p1',
            'userId': null,
            'startedOn': '2026-01-20',
          },
        ]);
        await _tap(tester, 'pause-create');
        final body = requestJson(
          env.backend.sent('POST /classes/class-1/pauses').single,
        );
        expect(body.containsKey('userId'), isFalse);
        expect(body['startedOn'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
        expect(body.containsKey('endedOn'), isFalse);
        expect(find.byKey(const Key('pause-p1')), findsOneWidget);
        expect(
          find.textContaining('Cả lớp: 2026-01-20 → chưa kết thúc'),
          findsOneWidget,
        );

        env.backend.reply('GET /classes/class-1/pauses', 200, <Object?>[
          <String, Object?>{
            'id': 'p1',
            'userId': null,
            'startedOn': '2026-01-20',
            'endedOn': '2026-01-21',
          },
        ]);
        await _tap(tester, 'pause-close-p1');
        expect(
          env.backend.sent('POST /classes/class-1/pauses/p1/end'),
          hasLength(1),
        );
        expect(find.byKey(const Key('pause-close-p1')), findsNothing);
      },
    );

    testWidgets(
      'máy chủ từ chối (409 đã có khoảng mở): hiện lỗi, giữ nguyên danh sách',
      (tester) async {
        await _open(
          tester,
          '/classes/class-1/pauses',
          setup: (b) {
            b.reply('GET /classes/class-1/dashboard', 200, dashboard());
            b.reply('GET /classes/class-1/pauses', 200, <Object?>[]);
            b.reply('POST /classes/class-1/pauses', 409, <String, Object?>{
              'code': 'VALIDATION_FAILED',
              'message': 'Đã có khoảng tạm dừng đang mở cùng phạm vi',
            });
          },
        );
        await _tap(tester, 'pause-create');
        expect(find.byKey(const Key('pause-error')), findsOneWidget);
        expect(find.byKey(const Key('pauses-none')), findsOneWidget);
      },
    );
  });
}
