import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_learning_client/domain/admin_unit_draft.dart';
import 'package:japanese_learning_client/platform/platform.dart';

import 'support/fake_backend.dart';
import 'support/learning_scenario.dart';

// Khu vực quản trị (T108, US6): danh sách/kích hoạt đơn vị, trình soạn (mục + bài tập trong một payload),
// bộ câu hỏi kiểm tra trình độ, người dùng và nhật ký. Máy chủ giả chỉ mô phỏng hợp đồng; quy tắc thật
// (kiểm tra nội dung, 403, nhật ký) được kiểm thử ở backend.

Future<TestEnv> _open(
  WidgetTester tester,
  String route, {
  void Function(FakeBackend backend)? setup,
}) async {
  TestEnv.useDesktopSize(tester);
  addTearDown(tester.view.reset);
  final env = TestEnv(
    tokens: StoredTokens(
      accessToken: fakeJwt(role: 'admin', sub: 'admin-1'),
      refreshToken: 'refresh-1',
    ),
  );
  LearningScenario(env.backend).onboarded = true;
  setup?.call(env.backend);
  await tester.pumpWidget(env.app());
  await tester.pumpAndSettle();
  GoRouter.of(tester.element(find.byType(Scaffold).first)).go(route);
  await tester.pumpAndSettle();
  return env;
}

Future<void> _tapKey(WidgetTester tester, String key) async {
  final finder = find.byKey(Key(key));
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  // Cuộn thêm để nút nằm gọn trong khung nhìn (không bị che ở mép).
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _type(
  WidgetTester tester,
  String label,
  String text, {
  int index = 0,
}) async {
  final finder = find.widgetWithText(TextFormField, label).at(index);
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.enterText(finder, text);
  await tester.pump();
}

Map<String, Object?> _unit(
  String id,
  String status, {
  bool isTrial = false,
  String kind = 'vocabulary',
}) => <String, Object?>{
  'id': id,
  'kind': kind,
  'level': 'N5',
  'tier': 'core',
  'estMinutes': 5,
  'difficulty': 1,
  'sequence': 0,
  'topicId': 'topic-1',
  'status': status,
  'isTrial': isTrial,
  'title': <String, Object?>{'vi': 'Bài $id', 'en': 'Unit $id'},
};

void main() {
  group('đơn vị học', () {
    testWidgets(
      '/admin chuyển về danh sách; lọc theo trạng thái gửi tham số lên server',
      (tester) async {
        final env = await _open(
          tester,
          '/admin',
          setup: (b) => b.on('GET /admin/units', (req) {
            final status = req.queryParameters['status'];
            final all = <Map<String, Object?>>[
              _unit('u1', 'draft'),
              _unit('u2', 'active', isTrial: true),
            ];
            return FakeResponse(
              200,
              all
                  .where((u) => status == null || u['status'] == status)
                  .toList(),
            );
          }),
        );
        expect(find.byKey(const Key('unit-u1')), findsOneWidget);
        expect(find.byKey(const Key('unit-u2')), findsOneWidget);
        expect(find.text('Bài u1'), findsOneWidget);
        // Đơn vị thuộc tập dùng thử có nhãn "Dùng thử" (trên thẻ).
        expect(
          find.descendant(
            of: find.byKey(const Key('unit-u2')),
            matching: find.text('Dùng thử'),
          ),
          findsOneWidget,
        );

        await tester.tap(find.byKey(const Key('filter-status')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Đang hoạt động').last);
        await tester.pumpAndSettle();

        expect(
          env.backend.sent('GET /admin/units').last.queryParameters,
          <String, dynamic>{'status': 'active'},
        );
        expect(find.byKey(const Key('unit-u1')), findsNothing);
        expect(find.byKey(const Key('unit-u2')), findsOneWidget);
      },
    );

    testWidgets(
      'kích hoạt bị từ chối hiện từng lỗi theo vị trí; thành công cập nhật trạng thái',
      (tester) async {
        var attempts = 0;
        var u1Status = 'draft';
        final env = await _open(
          tester,
          '/admin/units',
          setup: (b) {
            b.on(
              'GET /admin/units',
              (_) => FakeResponse(200, <Object?>[_unit('u1', u1Status)]),
            );
            b.on('PUT /admin/units/u1/status', (_) {
              attempts += 1;
              if (attempts == 1) {
                return const FakeResponse(422, <String, Object?>{
                  'code': 'VALIDATION_FAILED',
                  'message': 'Đơn vị chưa đạt kiểm tra nội dung',
                  'fields': <String, String>{
                    'title': 'tiêu đề vi + en phải đầy đủ',
                    'exercises': 'đơn vị phải có ít nhất 1 bài tập',
                  },
                });
              }
              u1Status = 'active';
              return FakeResponse(200, _unit('u1', 'active'));
            });
          },
        );

        await tester.tap(find.byKey(const Key('unit-toggle-u1')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('admin-error-dialog')), findsOneWidget);
        expect(
          find.textContaining('title: tiêu đề vi + en phải đầy đủ'),
          findsOneWidget,
        );
        expect(
          find.textContaining('exercises: đơn vị phải có ít nhất 1 bài tập'),
          findsOneWidget,
        );
        await tester.tap(find.text('Đóng'));
        await tester.pumpAndSettle();
        expect(
          find.descendant(
            of: find.byKey(const Key('unit-status-u1')),
            matching: find.text('Bản nháp'),
          ),
          findsOneWidget,
        );

        await tester.tap(find.byKey(const Key('unit-toggle-u1')));
        await tester.pumpAndSettle();
        expect(
          requestJson(env.backend.sent('PUT /admin/units/u1/status').last),
          <String, Object?>{'status': 'active'},
        );
        expect(
          find.descendant(
            of: find.byKey(const Key('unit-status-u1')),
            matching: find.text('Đang hoạt động'),
          ),
          findsOneWidget,
        );
        expect(find.text('Đã cập nhật trạng thái.'), findsOneWidget);
      },
    );

    testWidgets('đánh dấu dùng thử chỉ gửi isTrial', (tester) async {
      final env = await _open(
        tester,
        '/admin/units',
        setup: (b) {
          b.on(
            'GET /admin/units',
            (_) => FakeResponse(200, <Object?>[_unit('u1', 'active')]),
          );
          b.on(
            'PUT /admin/units/u1/status',
            (_) => FakeResponse(200, _unit('u1', 'active', isTrial: true)),
          );
        },
      );
      await tester.tap(find.byKey(const Key('unit-trial-u1')));
      await tester.pumpAndSettle();
      expect(
        requestJson(env.backend.sent('PUT /admin/units/u1/status').last),
        <String, Object?>{'isTrial': true},
      );
    });
  });

  group('trình soạn đơn vị', () {
    final topics = <Map<String, Object?>>[
      <String, Object?>{
        'id': 't-vocab',
        'skill': 'vocabulary',
        'level': 'N5',
        'name': <String, String>{'vi': 'Chào hỏi', 'en': 'Greetings'},
      },
      <String, Object?>{
        'id': 't-grammar',
        'skill': 'grammar',
        'level': 'N5',
        'name': <String, String>{'vi': 'Trợ từ', 'en': 'Particles'},
      },
    ];

    testWidgets(
      'tạo đơn vị mới: một payload gồm mục và bài tập, bài tập gắn mục bằng itemIndex',
      (tester) async {
        final env = await _open(
          tester,
          '/admin/units/new',
          setup: (b) {
            b.on('GET /admin/topics', (_) => FakeResponse(200, topics));
            b.on('POST /admin/units', (req) {
              final body = requestJson(req);
              return FakeResponse(201, <String, Object?>{
                ...body,
                'id': 'new-1',
                'status': 'draft',
                'isTrial': false,
                'items': <Object?>[],
                'exercises': <Object?>[],
              });
            });
            b.on(
              'GET /admin/units/new-1',
              (_) => FakeResponse(200, <String, Object?>{
                ..._unit('new-1', 'draft'),
                'items': <Object?>[],
                'exercises': <Object?>[],
              }),
            );
          },
        );

        // Thiếu mảng/tiêu đề thì chưa gửi gì lên server.
        await _tapKey(tester, 'unit-save');
        expect(
          find.text(
            'Chọn mảng nội dung, nhập tiêu đề và chữ Nhật của mọi mục trước khi lưu.',
          ),
          findsOneWidget,
        );
        expect(env.backend.sent('POST /admin/units'), isEmpty);

        await tester.tap(find.byType(DropdownButtonFormField<String?>));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Chào hỏi').last);
        await tester.pumpAndSettle();
        await _type(tester, 'Tiêu đề (tiếng Việt)', 'Chào hỏi mới');
        await _type(tester, 'Tiêu đề (English)', 'New greetings');

        await _tapKey(tester, 'item-add');
        await _type(tester, 'Tiếng Nhật', '水');
        await _type(tester, 'Cách đọc', 'みず');
        await _type(tester, 'Nghĩa (tiếng Việt)', 'nước');
        await _type(tester, 'Nghĩa (English)', 'water');

        await _tapKey(tester, 'exercise-add');
        await _type(tester, 'Câu hỏi (tiếng Việt)', '「水」là gì?');
        await _type(tester, 'Câu hỏi (English)', 'What is 「水」?');
        await _type(tester, 'Lựa chọn 1', 'lửa');
        await _type(tester, 'Lựa chọn 2', 'nước');
        await tester.tap(find.byTooltip('Đáp án đúng').at(1));
        await tester.pumpAndSettle();

        // Gắn bài tập vào mục "水" (nhãn "1. 水" trong danh sách chọn mục).
        final itemPicker = find.byType(DropdownButtonFormField<ItemDraft?>);
        await tester.scrollUntilVisible(
          itemPicker,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(itemPicker);
        await tester.pumpAndSettle();
        await tester.tap(find.text('1. 水').last);
        await tester.pumpAndSettle();

        await _tapKey(tester, 'unit-save');

        final body = requestJson(env.backend.sent('POST /admin/units').single);
        expect(body['kind'], 'vocabulary');
        expect(body['level'], 'N5');
        expect(body['topicId'], 't-vocab');
        expect(body['title'], <String, Object?>{
          'vi': 'Chào hỏi mới',
          'en': 'New greetings',
        });
        final items = body['items']! as List<Object?>;
        expect(items, hasLength(1));
        expect((items[0]! as Map)['japanese'], '水');
        expect((items[0]! as Map).containsKey('id'), isFalse);
        expect((items[0]! as Map)['meaning'], <String, Object?>{
          'vi': 'nước',
          'en': 'water',
        });
        final exercises = body['exercises']! as List<Object?>;
        final exercise = exercises.single! as Map<Object?, Object?>;
        expect(exercise['itemIndex'], 0);
        expect(exercise['type'], 'multiple_choice');
        expect(exercise['payload'], <String, Object?>{
          'choices': <String>['lửa', 'nước'],
          'correct_index': 1,
        });
        // Lưu xong chuyển sang trang sửa đơn vị vừa tạo (còn là bản nháp, kích hoạt riêng).
        expect(env.backend.sent('GET /admin/units/new-1'), isNotEmpty);
      },
    );

    testWidgets(
      'sửa đơn vị đã có: giữ id, mục bị ẩn vẫn được gửi với trạng thái inactive; lỗi 422 hiện theo vị trí',
      (tester) async {
        var puts = 0;
        final unit = <String, Object?>{
          ..._unit('unit-1', 'active'),
          'topicId': 't-vocab',
          'items': <Object?>[
            <String, Object?>{
              'id': 'item-1',
              'status': 'active',
              'japanese': 'おはよう',
              'reading': 'おはよう',
              'meaning': <String, String>{
                'vi': 'Chào buổi sáng',
                'en': 'Good morning',
              },
              'explanation': null,
              'examples': <Object?>[],
            },
            <String, Object?>{
              'id': 'item-2',
              'status': 'inactive',
              'japanese': 'こんばんは',
              'reading': 'こんばんは',
              'meaning': <String, String>{
                'vi': 'Chào buổi tối',
                'en': 'Good evening',
              },
              'explanation': null,
              'examples': <Object?>[],
            },
          ],
          'exercises': <Object?>[
            <String, Object?>{
              'id': 'ex-1',
              'status': 'active',
              'itemIndex': 0,
              'type': 'fill_blank',
              'prompt': <String, String>{'vi': 'Điền', 'en': 'Fill'},
              'payload': <String, Object?>{
                'accepted_answers': <String>['おはよう'],
              },
              'feedbackCorrect': <String, String>{
                'vi': 'Đúng',
                'en': 'Correct',
              },
              'feedbackIncorrect': <String, String>{'vi': 'Sai', 'en': 'Wrong'},
            },
          ],
        };
        final env = await _open(
          tester,
          '/admin/units/unit-1',
          setup: (b) {
            b.on('GET /admin/topics', (_) => FakeResponse(200, topics));
            b.on('GET /admin/units/unit-1', (_) => FakeResponse(200, unit));
            b.on('PUT /admin/units/unit-1', (req) {
              puts += 1;
              if (puts == 1) {
                return const FakeResponse(422, <String, Object?>{
                  'code': 'VALIDATION_FAILED',
                  'message': 'Đơn vị chưa đạt kiểm tra nội dung',
                  'fields': <String, String>{
                    'items[0].reading': 'từ vựng phải có cách đọc',
                  },
                });
              }
              return FakeResponse(200, unit);
            });
          },
        );

        // Mục đã bị ẩn hiển thị công tắc tắt; mục đang hoạt động có công tắc bật. Danh sách dựng lười nên
        // cuộn tới công tắc trước khi đọc (không phụ thuộc chiều cao khung điều hướng phía trên).
        await tester.scrollUntilVisible(
          find.byKey(const Key('item-active-0')),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          tester.widget<Switch>(find.byKey(const Key('item-active-0'))).value,
          isTrue,
        );
        await tester.scrollUntilVisible(
          find.byKey(const Key('item-active-1')),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          tester.widget<Switch>(find.byKey(const Key('item-active-1'))).value,
          isFalse,
        );

        await _tapKey(tester, 'unit-save');
        expect(find.byKey(const Key('admin-error-dialog')), findsOneWidget);
        expect(
          find.textContaining('items[0].reading: từ vựng phải có cách đọc'),
          findsOneWidget,
        );
        await tester.tap(find.text('Đóng'));
        await tester.pumpAndSettle();

        await _tapKey(tester, 'unit-save');
        final body = requestJson(
          env.backend.sent('PUT /admin/units/unit-1').last,
        );
        final items = body['items']! as List<Object?>;
        expect((items[0]! as Map)['id'], 'item-1');
        expect((items[1]! as Map)['id'], 'item-2');
        expect((items[1]! as Map)['status'], 'inactive');
        expect(
          ((body['exercises']! as List<Object?>)[0]! as Map)['id'],
          'ex-1',
        );
        expect(
          ((body['exercises']! as List<Object?>)[0]! as Map)['itemIndex'],
          0,
        );
        expect(find.text('Đã lưu.'), findsOneWidget);
      },
    );

    testWidgets('đổi trạng thái từ trình soạn dùng endpoint riêng', (
      tester,
    ) async {
      var status = 'draft';
      final env = await _open(
        tester,
        '/admin/units/unit-1',
        setup: (b) {
          b.on('GET /admin/topics', (_) => FakeResponse(200, topics));
          b.on(
            'GET /admin/units/unit-1',
            (_) => FakeResponse(200, <String, Object?>{
              ..._unit('unit-1', status),
              'items': <Object?>[],
              'exercises': <Object?>[],
            }),
          );
          b.on('PUT /admin/units/unit-1/status', (_) {
            status = 'active';
            return FakeResponse(200, _unit('unit-1', 'active'));
          });
        },
      );
      expect(find.text('Bản nháp'), findsOneWidget);
      await _tapKey(tester, 'editor-toggle');
      expect(
        requestJson(env.backend.sent('PUT /admin/units/unit-1/status').single),
        <String, Object?>{'status': 'active'},
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('editor-status')),
          matching: find.text('Đang hoạt động'),
        ),
        findsOneWidget,
      );
    });
  });

  group('bài Kanji', () {
    final topics = <Map<String, Object?>>[
      <String, Object?>{
        'id': 't-vocab',
        'skill': 'vocabulary',
        'level': 'N5',
        'name': <String, String>{'vi': 'Chào hỏi', 'en': 'Greetings'},
      },
      <String, Object?>{
        'id': 't-kanji-n5',
        'skill': 'kanji',
        'level': 'N5',
        'name': <String, String>{'vi': 'Số đếm', 'en': 'Numbers'},
      },
      <String, Object?>{
        'id': 't-kanji-n4',
        'skill': 'kanji',
        'level': 'N4',
        'name': <String, String>{'vi': 'Con người', 'en': 'People'},
      },
    ];

    const onLabel = 'Âm On (katakana, cách nhau bằng dấu phẩy)';
    const kunLabel =
        'Âm Kun (hiragana, dùng "." tách okurigana, cách nhau bằng dấu phẩy)';
    const strokesLabel = 'Số nét (1–30)';

    Map<String, Object?> kanjiUnit() => <String, Object?>{
      ..._unit('k1', 'draft', kind: 'kanji'),
      'topicId': 't-kanji-n5',
      'goalTags': <String>['jlpt'],
      'items': <Object?>[
        <String, Object?>{
          'id': 'ki-1',
          'status': 'active',
          'japanese': '一',
          'reading': null,
          'topicId': 't-kanji-n5',
          'meaning': <String, String>{'vi': 'một', 'en': 'one'},
          'kanjiDetails': <String, Object?>{
            'onReadings': <String>['イチ'],
            'kunReadings': <String>['ひと.つ'],
            'strokeCount': 1,
            'components': null,
          },
          'examples': <Object?>[
            <String, Object?>{
              'ja': '一月',
              'reading': 'いちがつ',
              'kanjiReading': 'イチ',
              'translation': <String, String>{
                'vi': 'tháng Một',
                'en': 'January',
              },
            },
          ],
        },
      ],
      'exercises': <Object?>[
        <String, Object?>{
          'id': 'ke-1',
          'status': 'active',
          'itemIndex': 0,
          'facet': 'reading',
          'type': 'fill_blank',
          'prompt': <String, String>{'vi': 'Đọc', 'en': 'Read'},
          'payload': <String, Object?>{
            'accepted_answers': <String>['いち'],
          },
          'feedbackCorrect': <String, String>{'vi': 'Đúng', 'en': 'Correct'},
          'feedbackIncorrect': <String, String>{'vi': 'Sai', 'en': 'Wrong'},
        },
      ],
    };

    Future<void> tapVisible(WidgetTester tester, Finder finder) async {
      await tester.scrollUntilVisible(
        finder,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    testWidgets(
      'chọn loại Kanji hiện nhóm trường Kanji; payload gửi đúng AdminUnitWrite',
      (tester) async {
        final env = await _open(
          tester,
          '/admin/units/new',
          setup: (b) {
            b.on('GET /admin/topics', (_) => FakeResponse(200, topics));
            b.on(
              'POST /admin/units',
              (req) => FakeResponse(201, <String, Object?>{
                ...requestJson(req),
                'id': 'new-k',
                'status': 'draft',
                'isTrial': false,
                'items': <Object?>[],
                'exercises': <Object?>[],
              }),
            );
            b.on(
              'GET /admin/units/new-k',
              (_) => FakeResponse(200, <String, Object?>{
                ..._unit('new-k', 'draft', kind: 'kanji'),
                'items': <Object?>[],
                'exercises': <Object?>[],
              }),
            );
          },
        );

        // Mặc định là từ vựng: chưa có gợi ý thẻ mục tiêu của Kanji.
        expect(find.byKey(const Key('kanji-goal-hint')), findsNothing);
        await tester.tap(find.byKey(const Key('field-kind')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Kanji').last);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('kanji-goal-hint')), findsOneWidget);
        // Bài Kanji không có tầng nền tảng.
        expect(find.byKey(const Key('field-tier')), findsNothing);

        // Chỉ chủ đề Kanji cùng trình độ N5 được chọn ở cấp đơn vị.
        await tester.tap(find.byType(DropdownButtonFormField<String?>).first);
        await tester.pumpAndSettle();
        expect(find.text('Con người'), findsNothing);
        await tester.tap(find.text('Số đếm').last);
        await tester.pumpAndSettle();
        await tapVisible(tester, find.byKey(const Key('goal-jlpt')));
        await _type(tester, 'Tiêu đề (tiếng Việt)', 'Kanji số đếm');
        await _type(tester, 'Tiêu đề (English)', 'Number kanji');

        await _tapKey(tester, 'item-add');
        expect(find.byKey(const Key('item-kanji-0')), findsOneWidget);
        // Chữ Kanji không có ô "Cách đọc" đơn lẻ (âm On/Kun nằm ở nhóm Kanji).
        expect(find.widgetWithText(TextFormField, 'Cách đọc'), findsNothing);
        await _type(tester, 'Tiếng Nhật', '一');
        await _type(tester, 'Nghĩa (tiếng Việt)', 'một');
        await _type(tester, 'Nghĩa (English)', 'one');
        await tapVisible(
          tester,
          find.descendant(
            of: find.byKey(const Key('item-kanji-0')),
            matching: find.byType(DropdownButtonFormField<String?>),
          ),
        );
        await tester.tap(find.text('Số đếm').last);
        await tester.pumpAndSettle();
        await _type(tester, onLabel, 'イチ, イツ');
        await _type(tester, kunLabel, 'ひと, ひと.つ');
        await _type(tester, strokesLabel, '1');
        await _type(tester, 'Thành phần (vi)', 'Một nét ngang');
        await _type(tester, 'Thành phần (en)', 'One horizontal stroke');

        await _tapKey(tester, 'example-add-0');
        await _type(tester, 'Câu ví dụ (tiếng Nhật)', '一月');
        await _type(tester, 'Cách đọc câu ví dụ', 'いちがつ');
        await _type(tester, 'Chữ đọc là gì trong từ này', 'イチ');
        await _type(tester, 'Dịch (tiếng Việt)', 'tháng Một');
        await _type(tester, 'Dịch (English)', 'January');

        await _tapKey(tester, 'exercise-add');
        // Chưa gắn chữ thì chưa có ô khía cạnh.
        expect(
          find.widgetWithText(
            DropdownButtonFormField<String>,
            'Khía cạnh ôn tập',
          ),
          findsNothing,
        );
        await _type(tester, 'Câu hỏi (tiếng Việt)', '「一」đọc là gì?');
        await _type(tester, 'Câu hỏi (English)', 'How is 「一」 read?');
        await _type(tester, 'Lựa chọn 1', 'いち');
        await _type(tester, 'Lựa chọn 2', 'に');

        await tapVisible(
          tester,
          find.byType(DropdownButtonFormField<ItemDraft?>),
        );
        await tester.tap(find.text('1. 一').last);
        await tester.pumpAndSettle();
        final facetPicker = find.widgetWithText(
          DropdownButtonFormField<String>,
          'Khía cạnh ôn tập',
        );
        expect(facetPicker, findsOneWidget);
        await tapVisible(tester, facetPicker);
        await tester.tap(find.text('Cách đọc').last);
        await tester.pumpAndSettle();

        await _tapKey(tester, 'unit-save');

        final body = requestJson(env.backend.sent('POST /admin/units').single);
        expect(body['kind'], 'kanji');
        expect(body['tier'], 'core');
        expect(body['topicId'], 't-kanji-n5');
        expect(body['goalTags'], <String>['jlpt']);
        final item = (body['items']! as List<Object?>).single! as Map;
        expect(item['japanese'], '一');
        expect(item.containsKey('reading'), isFalse);
        expect(item['topicId'], 't-kanji-n5');
        expect(item['kanjiDetails'], <String, Object?>{
          'onReadings': <String>['イチ', 'イツ'],
          'kunReadings': <String>['ひと', 'ひと.つ'],
          'strokeCount': 1,
          'components': <String, Object?>{
            'vi': 'Một nét ngang',
            'en': 'One horizontal stroke',
          },
        });
        expect(
          ((item['examples']! as List<Object?>).single! as Map)['kanjiReading'],
          'イチ',
        );
        final exercise = (body['exercises']! as List<Object?>).single! as Map;
        expect(exercise['itemIndex'], 0);
        expect(exercise['facet'], 'reading');
        expect(env.backend.sent('GET /admin/units/new-k'), isNotEmpty);
      },
    );

    testWidgets(
      'sửa bài Kanji: nạp lại chi tiết và facet, số nét sai chặn lưu, lỗi 422 hiện theo đường dẫn',
      (tester) async {
        var puts = 0;
        final unit = kanjiUnit();
        final env = await _open(
          tester,
          '/admin/units/k1',
          setup: (b) {
            b.on('GET /admin/topics', (_) => FakeResponse(200, topics));
            b.on('GET /admin/units/k1', (_) => FakeResponse(200, unit));
            b.on('PUT /admin/units/k1', (_) {
              puts += 1;
              if (puts == 1) {
                return const FakeResponse(422, <String, Object?>{
                  'code': 'VALIDATION_FAILED',
                  'message': 'Đơn vị chưa đủ điều kiện kích hoạt',
                  'fields': <String, String>{
                    'items[1].topicId': 'chữ Kanji phải có thẻ chủ đề Kanji',
                    'goalTags': 'bài Kanji phải có ít nhất một thẻ mục tiêu',
                  },
                });
              }
              return FakeResponse(200, unit);
            });
          },
        );

        // Giá trị từ server được nạp vào form.
        expect(
          find.descendant(
            of: find.byKey(const Key('kanji-on-0')),
            matching: find.text('イチ'),
          ),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: find.byKey(const Key('kanji-strokes-0')),
            matching: find.text('1'),
          ),
          findsOneWidget,
        );
        // Danh sách dựng lười: cuộn tới thẻ bài tập rồi mới kiểm tra ô khía cạnh.
        await tester.scrollUntilVisible(
          find.byKey(const Key('exercise-0')),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          find.descendant(
            of: find.widgetWithText(
              DropdownButtonFormField<String>,
              'Khía cạnh ôn tập',
            ),
            matching: find.text('Cách đọc'),
          ),
          findsOneWidget,
        );

        // Số nét ngoài 1–30 bị chặn ngay ở client.
        await _type(tester, strokesLabel, '99');
        await _tapKey(tester, 'unit-save');
        expect(find.textContaining('trước khi lưu'), findsOneWidget);
        expect(env.backend.sent('PUT /admin/units/k1'), isEmpty);
        await _type(tester, strokesLabel, '3');

        await _tapKey(tester, 'unit-save');
        expect(find.byKey(const Key('admin-error-dialog')), findsOneWidget);
        expect(
          find.textContaining(
            'items[1].topicId: chữ Kanji phải có thẻ chủ đề Kanji',
          ),
          findsOneWidget,
        );
        expect(
          find.textContaining('goalTags: bài Kanji phải có ít nhất một thẻ'),
          findsOneWidget,
        );
        await tester.tap(find.text('Đóng'));
        await tester.pumpAndSettle();

        await _tapKey(tester, 'unit-save');
        final body = requestJson(env.backend.sent('PUT /admin/units/k1').last);
        final item = (body['items']! as List<Object?>).single! as Map;
        expect(item['id'], 'ki-1');
        expect((item['kanjiDetails']! as Map)['strokeCount'], 3);
        final exercise = (body['exercises']! as List<Object?>).single! as Map;
        expect(exercise['id'], 'ke-1');
        expect(exercise['facet'], 'reading');
        // Hai lần gọi: lần đầu bị 422, lần sau thành công (thông báo "Đã lưu." xếp hàng sau snackbar lỗi cục bộ).
        expect(puts, 2);
      },
    );

    testWidgets('lọc danh sách theo loại Kanji gửi kind=kanji', (tester) async {
      final env = await _open(
        tester,
        '/admin/units',
        setup: (b) => b.on('GET /admin/units', (req) {
          final kind = req.queryParameters['kind'];
          final all = <Map<String, Object?>>[
            _unit('v1', 'active'),
            _unit('k1', 'draft', kind: 'kanji'),
          ];
          return FakeResponse(
            200,
            all.where((u) => kind == null || u['kind'] == kind).toList(),
          );
        }),
      );
      expect(find.byKey(const Key('unit-v1')), findsOneWidget);
      expect(find.byKey(const Key('unit-k1')), findsOneWidget);
      // Thẻ bài Kanji hiện đúng nhãn loại.
      expect(
        find.descendant(
          of: find.byKey(const Key('unit-k1')),
          matching: find.textContaining('Kanji'),
        ),
        findsWidgets,
      );

      await tester.tap(find.byKey(const Key('filter-kind')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kanji').last);
      await tester.pumpAndSettle();

      expect(
        env.backend.sent('GET /admin/units').last.queryParameters,
        <String, dynamic>{'kind': 'kanji'},
      );
      expect(find.byKey(const Key('unit-v1')), findsNothing);
      expect(find.byKey(const Key('unit-k1')), findsOneWidget);
    });
  });

  group('câu hỏi kiểm tra trình độ', () {
    List<Map<String, Object?>> questions() {
      var position = 0;
      Map<String, Object?> q(String id, String level, {bool active = true}) {
        position += 1;
        return <String, Object?>{
          'id': id,
          'level': level,
          'skill': 'vocabulary',
          'topicId': 't-vocab',
          'prompt': '問題 $id',
          'choices': <String>['あ', 'い', 'う', 'え'],
          'correctChoice': 1,
          'position': active ? position : 0,
          'isActive': active,
        };
      }

      return <Map<String, Object?>>[
        for (var i = 1; i <= 8; i++) q('n5-$i', 'N5'),
        for (var i = 1; i <= 6; i++) q('n4-$i', 'N4'),
        for (var i = 1; i <= 6; i++) q('n3-$i', 'N3'),
        q('extra', 'N5', active: false),
      ];
    }

    testWidgets(
      'chỉ kích hoạt được khi đủ 8/6/6; gửi đúng thứ tự: câu hiện hành giữ vị trí, câu mới nối sau',
      (tester) async {
        final env = await _open(
          tester,
          '/admin/placement',
          setup: (b) {
            b.on(
              'GET /admin/placement-questions',
              (_) => FakeResponse(200, questions()),
            );
            b.reply('PUT /admin/placement-questions/active-set', 204);
          },
        );
        FilledButton activate() =>
            tester.widget<FilledButton>(find.byKey(const Key('pq-activate')));

        expect(find.text('Đã chọn: N5 8/8 · N4 6/6 · N3 6/6'), findsOneWidget);
        expect(activate().onPressed, isNotNull);

        // Bỏ một câu N5 → 7/8: không kích hoạt được.
        await tester.tap(find.byKey(const Key('pq-check-n5-1')));
        await tester.pumpAndSettle();
        expect(find.text('Đã chọn: N5 7/8 · N4 6/6 · N3 6/6'), findsOneWidget);
        expect(activate().onPressed, isNull);

        // Chọn câu N5 chưa thuộc bộ → lại đủ 8/6/6.
        final extra = find.byKey(const Key('pq-check-extra'));
        await tester.scrollUntilVisible(
          extra,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        // Cuộn thêm để ô nằm gọn trong khung nhìn (không bị che ở mép dưới).
        await tester.ensureVisible(extra);
        await tester.pumpAndSettle();
        await tester.tap(extra);
        await tester.pumpAndSettle();
        expect(activate().onPressed, isNotNull);

        await tester.tap(find.byKey(const Key('pq-activate')));
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Kích hoạt bộ đã chọn'),
          ),
        );
        await tester.pumpAndSettle();

        final ids =
            requestJson(
                  env.backend
                      .sent('PUT /admin/placement-questions/active-set')
                      .single,
                )['questionIds']!
                as List<Object?>;
        expect(ids, <String>[
          for (var i = 2; i <= 8; i++) 'n5-$i',
          for (var i = 1; i <= 6; i++) 'n4-$i',
          for (var i = 1; i <= 6; i++) 'n3-$i',
          'extra',
        ]);
        expect(find.text('Đã kích hoạt bộ câu hỏi.'), findsOneWidget);
      },
    );

    testWidgets(
      'server từ chối bộ không hợp lệ thì báo lỗi và không đổi lựa chọn đang xem',
      (tester) async {
        await _open(
          tester,
          '/admin/placement',
          setup: (b) {
            b.on(
              'GET /admin/placement-questions',
              (_) => FakeResponse(200, questions()),
            );
            b.reply(
              'PUT /admin/placement-questions/active-set',
              422,
              <String, Object?>{
                'code': 'PLACEMENT_SET_INVALID',
                'message': 'Số câu theo trình độ không đúng',
                'fields': <String, String>{'N5': 'Cần đúng 8 câu N5, nhận 9'},
              },
            );
          },
        );
        await tester.tap(find.byKey(const Key('pq-activate')));
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Kích hoạt bộ đã chọn'),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('admin-error-dialog')), findsOneWidget);
        expect(
          find.textContaining('N5: Cần đúng 8 câu N5, nhận 9'),
          findsOneWidget,
        );
      },
    );

    testWidgets('chọn kỹ năng của câu hỏi không có Kanji (research K12)', (
      tester,
    ) async {
      await _open(
        tester,
        '/admin/placement',
        setup: (b) {
          b.on(
            'GET /admin/placement-questions',
            (_) => FakeResponse(200, questions()),
          );
          b.on(
            'GET /admin/topics',
            (_) => const FakeResponse(200, <Object?>[]),
          );
        },
      );
      await tester.tap(find.byKey(const Key('pq-create')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('pq-skill')));
      await tester.pumpAndSettle();
      expect(find.text('Ngữ pháp'), findsWidgets);
      expect(find.text('Kanji'), findsNothing);
    });

    testWidgets('thêm câu hỏi mới gửi đủ lựa chọn và đáp án đúng', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/admin/placement',
        setup: (b) {
          b.on(
            'GET /admin/placement-questions',
            (_) => FakeResponse(200, questions()),
          );
          b.on(
            'GET /admin/topics',
            (_) => const FakeResponse(200, <Object?>[
              <String, Object?>{
                'id': 't-vocab',
                'skill': 'vocabulary',
                'level': 'N5',
                'name': <String, String>{'vi': 'Chào hỏi', 'en': 'Greetings'},
              },
            ]),
          );
          b.on(
            'POST /admin/placement-questions',
            (req) => FakeResponse(201, <String, Object?>{
              ...requestJson(req),
              'id': 'new-q',
              'position': 0,
              'isActive': false,
            }),
          );
        },
      );
      await tester.tap(find.byKey(const Key('pq-create')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pq-dialog')), findsOneWidget);

      // Thiếu dữ liệu thì chưa gửi.
      await tester.tap(find.byKey(const Key('pq-save')));
      await tester.pumpAndSettle();
      expect(env.backend.sent('POST /admin/placement-questions'), isEmpty);

      await tester.tap(
        find.descendant(
          of: find.byKey(const Key('pq-dialog')),
          matching: find.byType(DropdownButtonFormField<String?>),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('N5 · Chào hỏi').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('pq-prompt')), '「水」の意味は？');
      for (var i = 0; i < 4; i++) {
        await tester.enterText(find.byKey(Key('pq-choice-$i')), 'lựa chọn $i');
      }
      await tester.tap(find.byKey(const Key('pq-correct-2')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('pq-save')));
      await tester.pumpAndSettle();

      final body = requestJson(
        env.backend.sent('POST /admin/placement-questions').single,
      );
      expect(body['topicId'], 't-vocab');
      expect(body['prompt'], '「水」の意味は？');
      expect(body['choices'], <String>[
        'lựa chọn 0',
        'lựa chọn 1',
        'lựa chọn 2',
        'lựa chọn 3',
      ]);
      expect(body['correctChoice'], 2);
      expect(find.byKey(const Key('pq-dialog')), findsNothing);
    });
  });

  group('người dùng', () {
    Map<String, Object?> user(
      String id,
      String email, {
      String role = 'learner',
      String status = 'active',
    }) => <String, Object?>{
      'id': id,
      'email': email,
      'displayName': 'Tên $id',
      'role': role,
      'status': status,
      'createdAt': '2026-01-05T08:00:00.000Z',
    };

    testWidgets(
      'chỉ người học đang hoạt động/bị vô hiệu hóa đổi được trạng thái; xác nhận trước khi gửi',
      (tester) async {
        final env = await _open(
          tester,
          '/admin/users',
          setup: (b) {
            b.on(
              'GET /admin/users',
              (_) => FakeResponse(200, <String, Object?>{
                'items': <Object?>[
                  user('admin-1', 'me@example.com', role: 'admin'),
                  user('u1', 'a@example.com'),
                  user('u2', 'b@example.com', status: 'disabled'),
                  user('u3', 'c@example.com', status: 'pending_deletion'),
                ],
                'nextCursor': null,
              }),
            );
            b.reply('PUT /admin/users/u1/status', 204);
          },
        );
        // Chính mình, tài khoản admin khác và tài khoản chờ xóa không có nút đổi trạng thái.
        expect(find.byKey(const Key('user-toggle-admin-1')), findsNothing);
        expect(find.byKey(const Key('user-toggle-u3')), findsNothing);
        expect(find.byKey(const Key('user-toggle-u1')), findsOneWidget);
        expect(
          find.descendant(
            of: find.byKey(const Key('user-toggle-u2')),
            matching: find.text('Kích hoạt lại'),
          ),
          findsOneWidget,
        );

        await tester.tap(find.byKey(const Key('user-toggle-u1')));
        await tester.pumpAndSettle();
        // Chưa xác nhận thì chưa gửi gì.
        expect(env.backend.sent('PUT /admin/users/u1/status'), isEmpty);
        await tester.tap(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.text('Vô hiệu hóa'),
          ),
        );
        await tester.pumpAndSettle();

        expect(
          requestJson(env.backend.sent('PUT /admin/users/u1/status').single),
          <String, Object?>{'status': 'disabled'},
        );
        expect(
          find.descendant(
            of: find.byKey(const Key('user-status-u1')),
            matching: find.text('Bị vô hiệu hóa'),
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets('tìm kiếm gửi q; "Tải thêm" dùng con trỏ của trang trước', (
      tester,
    ) async {
      final env = await _open(
        tester,
        '/admin/users',
        setup: (b) => b.on('GET /admin/users', (req) {
          if (req.queryParameters['cursor'] == 'u1') {
            return FakeResponse(200, <String, Object?>{
              'items': <Object?>[user('u2', 'b@example.com')],
              'nextCursor': null,
            });
          }
          return FakeResponse(200, <String, Object?>{
            'items': <Object?>[user('u1', 'a@example.com')],
            'nextCursor': 'u1',
          });
        }),
      );
      await tester.enterText(find.byKey(const Key('user-search')), ' a@ex ');
      await tester.tap(find.byKey(const Key('user-search-go')));
      await tester.pumpAndSettle();
      expect(
        env.backend.sent('GET /admin/users').last.queryParameters['q'],
        'a@ex',
      );

      await tester.tap(find.byKey(const Key('user-load-more')));
      await tester.pumpAndSettle();
      expect(
        env.backend.sent('GET /admin/users').last.queryParameters['cursor'],
        'u1',
      );
      expect(find.byKey(const Key('user-u1')), findsOneWidget);
      expect(find.byKey(const Key('user-u2')), findsOneWidget);
      expect(find.byKey(const Key('user-load-more')), findsNothing);
    });
  });

  group('nhật ký', () {
    testWidgets(
      'hiện hành động, người thực hiện và diff; tải thêm theo header X-Next-Cursor',
      (tester) async {
        final env = await _open(
          tester,
          '/admin/logs',
          setup: (b) => b.on('GET /admin/action-logs', (req) {
            if (req.queryParameters['cursor'] == 'log-1') {
              return const FakeResponse(200, <Object?>[
                <String, Object?>{
                  'id': 'log-2',
                  'actorId': null,
                  'action': 'user.grant_admin',
                  'targetType': 'user',
                  'targetId': 'u9',
                  'diff': null,
                  'occurredAt': '2026-01-04T08:00:00.000Z',
                },
              ]);
            }
            return const FakeResponse(
              200,
              <Object?>[
                <String, Object?>{
                  'id': 'log-1',
                  'actorId': 'admin-1',
                  'action': 'unit.update',
                  'targetType': 'unit',
                  'targetId': 'unit-1',
                  'diff': <String, Object?>{
                    'fields': <String, Object?>{
                      'estMinutes': <String, Object?>{'from': 5, 'to': 10},
                    },
                  },
                  'occurredAt': '2026-01-05T08:00:00.000Z',
                },
              ],
              <String, String>{'X-Next-Cursor': 'log-1'},
            );
          }),
        );
        expect(find.text('unit.update'), findsOneWidget);
        expect(find.textContaining('bởi admin-1'), findsOneWidget);

        await tester.tap(find.text('unit.update'));
        await tester.pumpAndSettle();
        expect(find.textContaining('"estMinutes"'), findsOneWidget);

        await tester.tap(find.byKey(const Key('log-load-more')));
        await tester.pumpAndSettle();
        expect(
          env.backend
              .sent('GET /admin/action-logs')
              .last
              .queryParameters['cursor'],
          'log-1',
        );
        expect(find.text('user.grant_admin'), findsOneWidget);
        // Thao tác hệ thống (không có người thực hiện) được ghi rõ.
        expect(find.textContaining('bởi Hệ thống'), findsOneWidget);
        expect(find.byKey(const Key('log-load-more')), findsNothing);
      },
    );
  });
}
