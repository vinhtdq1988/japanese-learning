import 'dart:convert';
import 'dart:math';

import '../platform/platform.dart';

/// Loại sự kiện học tập do client tạo và gửi lên server (idempotent theo `clientEventId`, FR-041).
enum QueuedEventType { answer, interval }

/// Một sự kiện chưa được server xác nhận. `clientEventId` được sinh MỘT lần khi tạo sự kiện và giữ
/// nguyên qua mọi lần thử lại, nên server nhận trùng thì chỉ ghi một bản (R10, R12).
class QueuedEvent {
  const QueuedEvent({
    required this.type,
    required this.sessionId,
    required this.clientEventId,
    required this.payload,
  });

  final QueuedEventType type;
  final String sessionId;
  final String clientEventId;

  /// Dữ liệu cần để gửi lại (câu trả lời hoặc khoảng thời gian), chỉ gồm kiểu JSON.
  final Map<String, Object?> payload;

  Map<String, Object?> toJson() => <String, Object?>{
    'type': type.name,
    'sessionId': sessionId,
    'clientEventId': clientEventId,
    'payload': payload,
  };

  /// Trả `null` nếu dữ liệu đọc ra bị hỏng (không làm hỏng cả hàng đợi).
  static QueuedEvent? tryFromJson(Object? json) {
    if (json is! Map) return null;
    final type = QueuedEventType.values.asNameMap()[json['type']];
    final sessionId = json['sessionId'];
    final clientEventId = json['clientEventId'];
    final payload = json['payload'];
    if (type == null ||
        sessionId is! String ||
        clientEventId is! String ||
        payload is! Map) {
      return null;
    }
    return QueuedEvent(
      type: type,
      sessionId: sessionId,
      clientEventId: clientEventId,
      payload: Map<String, Object?>.from(payload),
    );
  }
}

/// Hàng đợi sự kiện chưa gửi, lưu qua [LocalStore] (R12): mất kết nối hoặc đóng tab giữa chừng thì lần
/// mở sau vẫn gửi lại được với cùng `clientEventId`. Dữ liệu bị mất/hỏng chỉ làm hàng đợi rỗng.
class EventQueue {
  EventQueue(this._store);

  static const String storageKey = 'jl.eventQueue.v1';

  final LocalStore _store;

  Future<List<QueuedEvent>> pending({String? sessionId}) async {
    final all = await _read();
    return sessionId == null
        ? all
        : all.where((e) => e.sessionId == sessionId).toList();
  }

  /// Thêm sự kiện; cùng `clientEventId` đã có thì giữ bản cũ (không nhân đôi).
  Future<void> add(QueuedEvent event) async {
    final all = await _read();
    if (all.any((e) => e.clientEventId == event.clientEventId)) return;
    await _write(<QueuedEvent>[...all, event]);
  }

  Future<void> remove(String clientEventId) async {
    final all = await _read();
    final kept = all.where((e) => e.clientEventId != clientEventId).toList();
    if (kept.length != all.length) await _write(kept);
  }

  Future<List<QueuedEvent>> _read() async {
    final raw = await _store.getString(storageKey);
    if (raw == null || raw.isEmpty) return <QueuedEvent>[];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return <QueuedEvent>[];
      return decoded
          .map(QueuedEvent.tryFromJson)
          .whereType<QueuedEvent>()
          .toList();
    } on FormatException {
      return <QueuedEvent>[];
    }
  }

  Future<void> _write(List<QueuedEvent> events) async {
    if (events.isEmpty) {
      await _store.remove(storageKey);
    } else {
      await _store.setString(
        storageKey,
        jsonEncode(events.map((e) => e.toJson()).toList()),
      );
    }
  }

  static final Random _random = Random.secure();

  /// UUID v4 do client sinh (FR-041): định danh sự kiện để server loại trùng.
  static String newEventId([Random? random]) {
    final r = random ?? _random;
    final bytes = List<int>.generate(16, (_) => r.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // phiên bản 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // biến thể RFC 4122
    String hex(int from, int to) => bytes
        .sublist(from, to)
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
  }
}
