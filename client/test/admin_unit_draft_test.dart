import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/domain/admin_unit_draft.dart';

// Mô hình soạn thảo đơn vị của quản trị viên (T108): chuyển đổi đối xứng với `AdminUnit`/`AdminUnitWrite`,
// liên kết bài tập → mục bằng `itemIndex`, không làm mất dữ liệu payload nâng cao.

Map<String, Object?> _unitJson() => <String, Object?>{
  'id': 'unit-1',
  'kind': 'vocabulary',
  'level': 'N5',
  'tier': 'foundation',
  'estMinutes': 5,
  'difficulty': 2,
  'sequence': 7,
  'topicId': 'topic-1',
  'status': 'active',
  'isTrial': true,
  'goalTags': <String>['work', 'daily_conversation'],
  'title': <String, Object?>{'vi': 'Chào hỏi', 'en': 'Greetings'},
  'items': <Map<String, Object?>>[
    <String, Object?>{
      'id': 'item-1',
      'status': 'active',
      'japanese': 'おはよう',
      'reading': 'おはよう',
      'meaning': <String, Object?>{
        'vi': 'Chào buổi sáng',
        'en': 'Good morning',
      },
      'explanation': null,
      'examples': <Map<String, Object?>>[
        <String, Object?>{
          'ja': 'おはようございます。',
          'translation': <String, Object?>{
            'vi': 'Chào buổi sáng.',
            'en': 'Good morning.',
          },
        },
      ],
    },
    <String, Object?>{
      'id': 'item-2',
      'status': 'inactive',
      'japanese': 'こんばんは',
      'reading': 'こんばんは',
      'meaning': <String, Object?>{'vi': 'Chào buổi tối', 'en': 'Good evening'},
      'explanation': null,
      'examples': <Object?>[],
    },
  ],
  'exercises': <Map<String, Object?>>[
    <String, Object?>{
      'id': 'ex-1',
      'status': 'active',
      'itemIndex': 1,
      'type': 'multiple_choice',
      'prompt': <String, Object?>{'vi': 'Chọn đúng', 'en': 'Pick one'},
      'payload': <String, Object?>{
        'choices': <String>['a', 'b', 'c'],
        'correct_index': 2,
      },
      'feedbackCorrect': <String, Object?>{'vi': 'Đúng', 'en': 'Correct'},
      'feedbackIncorrect': <String, Object?>{'vi': 'Sai', 'en': 'Wrong'},
    },
    <String, Object?>{
      'id': 'ex-2',
      'status': 'active',
      'itemIndex': null,
      'type': 'fill_blank',
      'prompt': <String, Object?>{'vi': 'Điền', 'en': 'Fill'},
      'payload': <String, Object?>{
        'accepted_answers': <String>['おはよう', 'ohayou'],
      },
      'feedbackCorrect': <String, Object?>{'vi': 'Đúng', 'en': 'Correct'},
      'feedbackIncorrect': <String, Object?>{'vi': 'Sai', 'en': 'Wrong'},
    },
    <String, Object?>{
      'id': 'ex-3',
      'status': 'inactive',
      'itemIndex': 0,
      'type': 'matching',
      'prompt': <String, Object?>{'vi': 'Ghép', 'en': 'Match'},
      'payload': <String, Object?>{
        'pairs': <List<String>>[
          <String>['おはよう', 'Chào buổi sáng'],
          <String>['こんばんは', 'Chào buổi tối'],
        ],
      },
      'feedbackCorrect': <String, Object?>{'vi': 'Đúng', 'en': 'Correct'},
      'feedbackIncorrect': <String, Object?>{'vi': 'Sai', 'en': 'Wrong'},
    },
  ],
};

void main() {
  group('UnitDraft.fromJson/toJson', () {
    test(
      'giữ nguyên id, trạng thái ẩn và liên kết bài tập → mục khi lưu lại',
      () {
        final draft = UnitDraft.fromJson(_unitJson());
        expect(draft.isNew, isFalse);
        expect(draft.items.map((i) => i.active), <bool>[true, false]);
        expect(draft.exercises[0].item, same(draft.items[1]));
        expect(draft.exercises[1].item, isNull);
        expect(draft.exercises[2].active, isFalse);

        final json = draft.toJson();
        final items = json['items']! as List<Object?>;
        final exercises = json['exercises']! as List<Object?>;
        expect((items[0]! as Map)['id'], 'item-1');
        expect((items[1]! as Map)['status'], 'inactive');
        expect((exercises[0]! as Map)['itemIndex'], 1);
        expect((exercises[1]! as Map).containsKey('itemIndex'), isFalse);
        expect((exercises[2]! as Map)['status'], 'inactive');
        expect((exercises[0]! as Map)['payload'], <String, Object?>{
          'choices': <String>['a', 'b', 'c'],
          'correct_index': 2,
        });
        expect(json['tier'], 'foundation');
        expect(json['goalTags'], <String>['daily_conversation', 'work']);
        // Không gửi trạng thái hay cờ dùng thử qua payload ghi đơn vị: đổi bằng endpoint riêng.
        expect(json.containsKey('status'), isFalse);
        expect(json.containsKey('isTrial'), isFalse);
      },
    );

    test(
      'bỏ một mục thì bài tập liên quan hết gắn mục, chỉ số các mục sau được tính lại',
      () {
        final draft = UnitDraft.fromJson(_unitJson());
        final removed = draft.items.removeAt(0);
        for (final ex in draft.exercises) {
          if (ex.item == removed) ex.item = null;
        }
        final exercises = draft.toJson()['exercises']! as List<Object?>;
        // Mục 'こんばんは' nay đứng đầu danh sách → itemIndex 0; bài tập từng gắn mục đã bỏ không còn itemIndex.
        expect((exercises[0]! as Map)['itemIndex'], 0);
        expect((exercises[2]! as Map).containsKey('itemIndex'), isFalse);
      },
    );

    test('thêm mục mới lên đầu không làm lệch liên kết của bài tập đã có', () {
      final draft = UnitDraft.fromJson(_unitJson());
      draft.items.insert(0, ItemDraft(japanese: '新しい'));
      final exercises = draft.toJson()['exercises']! as List<Object?>;
      expect((exercises[0]! as Map)['itemIndex'], 2);
      expect((exercises[2]! as Map)['itemIndex'], 1);
      final items = draft.toJson()['items']! as List<Object?>;
      expect((items[0]! as Map).containsKey('id'), isFalse);
    });

    test('mức N5 mới gửi tier; trình độ khác luôn là core', () {
      final draft = UnitDraft.fromJson(_unitJson())..level = 'N4';
      expect(draft.toJson()['tier'], 'core');
    });
  });

  group('ExerciseDraft', () {
    test(
      'payload nâng cao (lựa chọn song ngữ) rơi về JSON thô và không bị mất khi lưu',
      () {
        final json = _unitJson();
        (json['exercises']! as List<Object?>)[0] = <String, Object?>{
          'id': 'ex-1',
          'status': 'active',
          'type': 'multiple_choice',
          'prompt': <String, Object?>{'vi': 'q', 'en': 'q'},
          'payload': <String, Object?>{
            'choices': <Map<String, String>>[
              <String, String>{'vi': 'một', 'en': 'one'},
              <String, String>{'vi': 'hai', 'en': 'two'},
            ],
            'correct_index': 0,
          },
          'feedbackCorrect': <String, Object?>{'vi': 'a', 'en': 'a'},
          'feedbackIncorrect': <String, Object?>{'vi': 'b', 'en': 'b'},
        };
        final draft = UnitDraft.fromJson(json);
        expect(draft.exercises[0].rawPayload, isNotNull);
        final payload =
            (draft.toJson()['exercises']! as List<Object?>)[0]!
                as Map<String, Object?>;
        final out = payload['payload']! as Map<String, Object?>;
        expect((out['choices']! as List<Object?>).length, 2);
        expect(((out['choices']! as List<Object?>)[0]! as Map)['en'], 'one');
        expect(out['correct_index'], 0);
      },
    );

    test('JSON thô sai cú pháp bị phát hiện trước khi gửi', () {
      final draft = UnitDraft.fromJson(_unitJson())
        ..exercises[0].rawPayload = '{ không phải json';
      expect(draft.localErrors().keys, contains('exercises[0].payload'));
      expect(() => draft.toJson(), throwsFormatException);
    });

    test('đổi loại bài tập đặt lại đáp án về form trống của loại mới', () {
      final ex = UnitDraft.fromJson(_unitJson()).exercises[0];
      ex.changeType('fill_blank');
      expect(ex.buildPayload(), <String, Object?>{
        'accepted_answers': <String>[''],
      });
      ex.changeType('matching');
      expect((ex.buildPayload()['pairs']! as List<Object?>).length, 2);
    });
  });

  group('UnitDraft.localErrors', () {
    test(
      'bản nháp thiếu một ngôn ngữ vẫn lưu được; thiếu mảng/tiêu đề/chữ Nhật thì không',
      () {
        final draft = UnitDraft();
        expect(
          draft.localErrors().keys,
          containsAll(<String>['topicId', 'title']),
        );

        draft
          ..topicId = 't'
          ..title.vi = 'Chỉ có tiếng Việt'
          ..items.add(ItemDraft());
        expect(draft.localErrors().keys, <String>['items[0].japanese']);

        draft.items[0].japanese = '水';
        expect(draft.localErrors(), isEmpty);
      },
    );
  });
}
