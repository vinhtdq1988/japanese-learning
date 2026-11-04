import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../platform/platform_providers.dart';
import 'api/api_error.dart';
import 'api_providers.dart';
import 'event_queue.dart';

/// Truy cập phiên học (US2): bắt đầu/tiếp tục, ghi câu trả lời và khoảng thời gian học, hoàn thành.
///
/// Mọi sự kiện do client tạo mang `clientEventId` sinh một lần. Khi mất kết nối, sự kiện được lưu vào
/// [EventQueue] (qua `LocalStore`) và gửi lại với CÙNG `clientEventId` (R12); server loại trùng nên
/// gửi lại là an toàn. Một phiên chỉ được hoàn thành sau khi mọi sự kiện của nó đã được server xác nhận.
class LessonRepository {
  LessonRepository(this._api, this._queue);

  final JapaneseApi _api;
  final EventQueue _queue;

  DailyApi get _daily => _api.getDailyApi();

  /// Bắt đầu hoặc tiếp tục phiên cho mục kế hoạch (hoặc đơn vị "học thêm").
  Future<LessonSession> startSession(String planItemId) {
    return guardApi(() async {
      final response = await _daily.startSession(
        startSessionRequest: StartSessionRequest(planItemId: planItemId),
      );
      return response.data!;
    });
  }

  /// Đơn vị kế tiếp ngoài kế hoạch hôm nay (`POST /today/extra`).
  Future<PlanItem> extraUnit() {
    return guardApi(() async => (await _daily.getExtraUnit()).data!);
  }

  /// Ghi câu trả lời và nhận kết quả chấm của server. Mất kết nối → sự kiện được lưu vào hàng đợi bền
  /// vững rồi ném [ApiError] (`isNetwork`); gọi lại với cùng [clientEventId] để gửi lại, kết quả đã ghi
  /// được server trả lại (`duplicate=true`).
  Future<AnswerResult> submitAnswer({
    required String sessionId,
    required String exerciseId,
    required Object answer,
    required String clientEventId,
    required DateTime answeredAt,
    bool isRetry = false,
  }) async {
    final event = QueuedEvent(
      type: QueuedEventType.answer,
      sessionId: sessionId,
      clientEventId: clientEventId,
      payload: <String, Object?>{
        'exerciseId': exerciseId,
        'answer': answer,
        'answeredAt': answeredAt.toUtc().toIso8601String(),
        'isRetry': isRetry,
      },
    );
    return _sendAnswer(event);
  }

  /// Ghi khoảng thời gian học `[startedAt, startedAt + duration)`. Mất kết nối thì lưu hàng đợi và
  /// KHÔNG ném lỗi (thời gian học không chặn người học); gửi lại ở [flushPending].
  Future<void> recordInterval({
    required String sessionId,
    required DateTime startedAt,
    required int durationSeconds,
  }) async {
    final event = QueuedEvent(
      type: QueuedEventType.interval,
      sessionId: sessionId,
      clientEventId: EventQueue.newEventId(),
      payload: <String, Object?>{
        'startedAt': startedAt.toUtc().toIso8601String(),
        'durationSeconds': durationSeconds,
      },
    );
    try {
      await _sendInterval(event);
    } on ApiError {
      // Thời gian học không chặn người học: sự kiện đã được xử lý (xếp hàng chờ gửi lại hoặc bỏ hẳn).
    }
  }

  /// Gửi lại các sự kiện còn tồn của [sessionId]. Dừng và ném [ApiError] (`isNetwork`) nếu vẫn chưa có
  /// mạng; sự kiện bị server từ chối vĩnh viễn (4xx) thì bỏ khỏi hàng đợi để không kẹt mãi.
  Future<void> flushPending(String sessionId) async {
    for (final event in await _queue.pending(sessionId: sessionId)) {
      try {
        switch (event.type) {
          case QueuedEventType.answer:
            await _sendAnswer(event);
          case QueuedEventType.interval:
            await _sendInterval(event);
        }
      } on ApiError catch (e) {
        // Từ chối vĩnh viễn đã bị bỏ khỏi hàng đợi: bỏ qua. Lỗi tạm thời (mạng, 5xx) thì dừng và báo.
        if (!_isPermanent(e)) rethrow;
      }
    }
  }

  /// Số sự kiện chưa được server xác nhận của phiên.
  Future<int> pendingCount(String sessionId) async =>
      (await _queue.pending(sessionId: sessionId)).length;

  /// Hoàn thành phiên. PHẢI gửi hết hàng đợi trước: chưa lưu xong thì ném lỗi mạng và không báo hoàn thành.
  Future<SessionSummary> complete(String sessionId) async {
    await flushPending(sessionId);
    return guardApi(() async {
      final response = await _daily.completeSession(sessionId: sessionId);
      return response.data!;
    });
  }

  Future<AnswerResult> _sendAnswer(QueuedEvent event) async {
    final p = event.payload;
    try {
      final result = await guardApi(() async {
        final response = await _daily.submitAnswer(
          sessionId: event.sessionId,
          answerSubmission: AnswerSubmission(
            clientEventId: event.clientEventId,
            exerciseId: p['exerciseId']! as String,
            answer: p['answer'],
            answeredAt: DateTime.parse(p['answeredAt']! as String),
            isRetry: p['isRetry'] as bool? ?? false,
          ),
        );
        return response.data!;
      });
      await _queue.remove(event.clientEventId);
      return result;
    } on ApiError catch (e) {
      if (_isPermanent(e)) {
        await _queue.remove(event.clientEventId);
      } else {
        await _queue.add(event);
      }
      rethrow;
    }
  }

  Future<void> _sendInterval(QueuedEvent event) async {
    final p = event.payload;
    try {
      await guardApi(() async {
        await _daily.recordStudyInterval(
          sessionId: event.sessionId,
          recordStudyIntervalRequest: RecordStudyIntervalRequest(
            clientEventId: event.clientEventId,
            startedAt: DateTime.parse(p['startedAt']! as String),
            durationSeconds: p['durationSeconds']! as int,
          ),
        );
      });
      await _queue.remove(event.clientEventId);
    } on ApiError catch (e) {
      if (_isPermanent(e)) {
        await _queue.remove(event.clientEventId);
      } else {
        await _queue.add(event);
      }
      rethrow;
    }
  }

  /// Lỗi server từ chối hẳn (dữ liệu sai, phiên không còn, đã hoàn thành): gửi lại cũng vô ích.
  /// Mạng, 5xx và 401 là lỗi tạm thời nên sự kiện được giữ trong hàng đợi.
  static bool _isPermanent(ApiError e) {
    final status = e.statusCode;
    return status != null && status >= 400 && status < 500 && status != 401;
  }
}

final eventQueueProvider = Provider<EventQueue>(
  (ref) => EventQueue(ref.watch(localStoreProvider)),
);

final lessonRepositoryProvider = Provider<LessonRepository>((ref) {
  return LessonRepository(
    ref.watch(japaneseApiProvider),
    ref.watch(eventQueueProvider),
  );
});
