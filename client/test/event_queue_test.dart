import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:japanese_learning_client/data/event_queue.dart';
import 'package:japanese_learning_client/platform/memory_platform.dart';

// Hàng đợi sự kiện chưa gửi (T067, R12): lưu bền vững, giữ nguyên clientEventId qua các lần thử lại.

QueuedEvent _event(String id, {String session = 's1'}) => QueuedEvent(
  type: QueuedEventType.answer,
  sessionId: session,
  clientEventId: id,
  payload: <String, Object?>{
    'exerciseId': 'ex-1',
    'answer': <List<String>>[
      <String>['水', 'nước'],
    ],
    'isRetry': false,
  },
);

void main() {
  group('EventQueue', () {
    test(
      'sự kiện được lưu và đọc lại nguyên vẹn (kể cả sau khi tạo hàng đợi mới)',
      () async {
        final store = MemoryLocalStore();
        await EventQueue(store).add(_event('e1'));

        final reopened = await EventQueue(store).pending();
        expect(reopened, hasLength(1));
        expect(reopened.single.clientEventId, 'e1');
        expect(reopened.single.type, QueuedEventType.answer);
        expect(reopened.single.payload['exerciseId'], 'ex-1');
        expect(reopened.single.payload['answer'], <Object?>[
          <Object?>['水', 'nước'],
        ]);
      },
    );

    test(
      'thêm trùng clientEventId không nhân đôi (giữ nguyên id qua các lần thử lại)',
      () async {
        final queue = EventQueue(MemoryLocalStore());
        await queue.add(_event('e1'));
        await queue.add(_event('e1'));
        expect(await queue.pending(), hasLength(1));
      },
    );

    test(
      'lọc theo phiên và xóa từng sự kiện; hết sự kiện thì dọn khóa lưu',
      () async {
        final store = MemoryLocalStore();
        final queue = EventQueue(store);
        await queue.add(_event('e1'));
        await queue.add(_event('e2', session: 's2'));

        expect(
          (await queue.pending(sessionId: 's2')).map((e) => e.clientEventId),
          <String>['e2'],
        );
        await queue.remove('e1');
        await queue.remove('e2');
        expect(await queue.pending(), isEmpty);
        expect(await store.getString(EventQueue.storageKey), isNull);
      },
    );

    test(
      'dữ liệu hỏng hoặc bị mất chỉ làm hàng đợi rỗng, không ném lỗi',
      () async {
        final store = MemoryLocalStore();
        await store.setString(EventQueue.storageKey, 'không phải json');
        expect(await EventQueue(store).pending(), isEmpty);

        await store.setString(EventQueue.storageKey, '{"a":1}');
        expect(await EventQueue(store).pending(), isEmpty);

        // Phần tử hỏng bị bỏ qua, phần tử tốt còn lại vẫn đọc được.
        await EventQueue(store).add(_event('ok'));
        final raw = await store.getString(EventQueue.storageKey);
        await store.setString(
          EventQueue.storageKey,
          raw!.replaceFirst('[', '[{"type":"?"},'),
        );
        expect(
          (await EventQueue(store).pending()).map((e) => e.clientEventId),
          <String>['ok'],
        );
      },
    );
  });

  group('EventQueue.newEventId', () {
    final uuidV4 = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    );

    test('là UUID v4 hợp lệ và không trùng nhau', () {
      final ids = <String>{
        for (var i = 0; i < 200; i++) EventQueue.newEventId(),
      };
      expect(ids, hasLength(200));
      expect(ids.every(uuidV4.hasMatch), isTrue);
    });

    test('tất định khi truyền nguồn ngẫu nhiên cố định', () {
      expect(
        EventQueue.newEventId(Random(7)),
        EventQueue.newEventId(Random(7)),
      );
    });
  });
}
