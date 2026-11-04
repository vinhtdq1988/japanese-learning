import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/event_queue.dart';
import '../../data/lesson_repository.dart';

/// Giai đoạn của một phiên học: giải thích → bài tập → hỏi lại câu sai một lần (R6) → tóm tắt.
enum LessonPhase { intro, exercises, retry, summary }

/// Câu trả lời đã chốt nhưng server chưa xác nhận (mất kết nối). Gửi lại với CÙNG `clientEventId`.
class PendingAnswer {
  const PendingAnswer({
    required this.exercise,
    required this.answer,
    required this.clientEventId,
    required this.answeredAt,
    required this.isRetry,
  });

  final Exercise exercise;
  final Object answer;
  final String clientEventId;
  final DateTime answeredAt;
  final bool isRetry;
}

/// Đồng hồ tiêm vào để kiểm thử đo được thời gian học.
final lessonClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// Mỗi khoảng thời gian học tối đa bấy nhiêu giây: người học bỏ máy giữa chừng không bị tính giờ vô hạn.
const int kMaxIntervalSeconds = 300;

class LessonState {
  const LessonState({
    required this.session,
    required this.phase,
    required this.queue,
    required this.index,
    required this.answeredIds,
    required this.wrongIds,
    this.current,
    this.pending,
    this.submitting = false,
    this.completing = false,
    this.completeOffline = false,
    this.errorCode,
    this.summary,
  });

  final LessonSession session;
  final LessonPhase phase;

  /// Các bài tập của giai đoạn hiện tại (toàn bộ ở `exercises`, các câu sai ở `retry`).
  final List<Exercise> queue;
  final int index;

  /// Bài tập đã có câu trả lời lượt chính được server xác nhận.
  final Set<String> answeredIds;
  final Set<String> wrongIds;

  /// Kết quả của câu đang hiển thị (phản hồi tức thì); `null` khi chưa trả lời.
  final AnswerResult? current;
  final PendingAnswer? pending;
  final bool submitting;
  final bool completing;

  /// Chưa lưu được kết quả khi hoàn thành do mất kết nối: không báo hoàn thành (R12).
  final bool completeOffline;
  final String? errorCode;
  final SessionSummary? summary;

  Exercise? get exercise => index < queue.length ? queue[index] : null;
  bool get isLastQuestion => index >= queue.length - 1;

  LessonState copyWith({
    LessonPhase? phase,
    List<Exercise>? queue,
    int? index,
    Set<String>? answeredIds,
    Set<String>? wrongIds,
    AnswerResult? current,
    bool clearCurrent = false,
    PendingAnswer? pending,
    bool clearPending = false,
    bool? submitting,
    bool? completing,
    bool? completeOffline,
    String? errorCode,
    bool clearError = false,
    SessionSummary? summary,
  }) {
    return LessonState(
      session: session,
      phase: phase ?? this.phase,
      queue: queue ?? this.queue,
      index: index ?? this.index,
      answeredIds: answeredIds ?? this.answeredIds,
      wrongIds: wrongIds ?? this.wrongIds,
      current: clearCurrent ? null : (current ?? this.current),
      pending: clearPending ? null : (pending ?? this.pending),
      submitting: submitting ?? this.submitting,
      completing: completing ?? this.completing,
      completeOffline: completeOffline ?? this.completeOffline,
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
      summary: summary ?? this.summary,
    );
  }
}

/// Điều khiển một phiên học. `arg` là id mục kế hoạch (hoặc id đơn vị "học thêm"); mở lại cùng id thì
/// server trả lại đúng phiên dở dang nên tiếp tục từ câu chưa trả lời (FR-020).
class LessonController
    extends AutoDisposeFamilyAsyncNotifier<LessonState, String> {
  late LessonRepository _repo;
  late DateTime Function() _now;
  late DateTime _lapStart;
  String? _sessionId;

  @override
  Future<LessonState> build(String arg) async {
    _repo = ref.watch(lessonRepositoryProvider);
    _now = ref.watch(lessonClockProvider);
    _lapStart = _now();
    // Rời màn hình giữa chừng vẫn ghi lại khoảng thời gian đã học (không chặn việc đóng màn hình).
    ref.onDispose(() {
      final id = _sessionId;
      if (id != null) _recordInterval(id);
    });

    var session = await _repo.startSession(arg);
    final sessionId = session.id!;
    _sessionId = sessionId;
    if ((await _repo.pendingCount(sessionId)) > 0) {
      try {
        await _repo.flushPending(sessionId);
        session = await _repo.startSession(arg);
      } on ApiError {
        // Vẫn chưa có mạng: giữ nguyên hàng đợi, câu trả lời không mất; sẽ gửi lại ở lần sau.
      }
    }
    final initial = _initialState(session);
    if (initial.phase != LessonPhase.summary) return initial;
    // Mọi câu đã có kết quả (hoặc phiên đã xong): lấy tóm tắt từ server (hoàn thành là idempotent).
    try {
      return initial.copyWith(summary: await _repo.complete(session.id!));
    } on ApiError catch (e) {
      if (!e.isNetwork) rethrow;
      return initial.copyWith(completeOffline: true);
    }
  }

  LessonState _initialState(LessonSession session) {
    final exercises = session.exercises ?? const <Exercise>[];
    final answered = <String>{
      for (final a in session.answered ?? const <LessonSessionAnsweredInner>[])
        if (a.exerciseId != null) a.exerciseId!,
    };
    final wrong = <String>{
      for (final a in session.answered ?? const <LessonSessionAnsweredInner>[])
        if (a.exerciseId != null && a.isCorrect == false) a.exerciseId!,
    };
    final base = LessonState(
      session: session,
      phase: LessonPhase.intro,
      queue: exercises,
      index: 0,
      answeredIds: answered,
      wrongIds: wrong,
    );
    if (session.status == LessonSessionStatusEnum.completed ||
        (exercises.isNotEmpty && answered.length >= exercises.length)) {
      // Đã trả lời hết: chỉ còn hỏi lại câu sai (nếu có) rồi hoàn thành.
      return _afterExercises(base);
    }
    // Phiên ôn tập (US3) không có phần giải thích: vào thẳng câu hỏi đầu tiên.
    if (answered.isEmpty) {
      return session.kind == LessonSessionKindEnum.review &&
              exercises.isNotEmpty
          ? base.copyWith(phase: LessonPhase.exercises)
          : base;
    }
    final firstOpen = exercises.indexWhere((e) => !answered.contains(e.id));
    return base.copyWith(phase: LessonPhase.exercises, index: firstOpen);
  }

  LessonState _afterExercises(LessonState s) {
    final retry = s.queue.where((e) => s.wrongIds.contains(e.id)).toList();
    if (retry.isNotEmpty &&
        s.session.status != LessonSessionStatusEnum.completed) {
      return s.copyWith(
        phase: LessonPhase.retry,
        queue: retry,
        index: 0,
        clearCurrent: true,
      );
    }
    return s.copyWith(phase: LessonPhase.summary);
  }

  LessonState get _s => state.requireValue;

  /// Từ phần giải thích sang bài tập.
  void startExercises() {
    final s = _s;
    if (s.phase != LessonPhase.intro) return;
    if (s.queue.isEmpty) {
      finish();
      return;
    }
    _lapStart = _now();
    state = AsyncData(s.copyWith(phase: LessonPhase.exercises, index: 0));
  }

  /// Chốt đáp án của câu hiện tại; server chấm và trả phản hồi tức thì (FR-018).
  Future<void> submit(Object answer) async {
    final s = _s;
    final exercise = s.exercise;
    if (exercise == null || s.submitting || s.current != null) return;
    final pending = PendingAnswer(
      exercise: exercise,
      answer: answer,
      clientEventId: EventQueue.newEventId(),
      answeredAt: _now(),
      isRetry: s.phase == LessonPhase.retry,
    );
    await _send(pending);
  }

  /// Gửi lại câu trả lời đang chờ (cùng `clientEventId`).
  Future<void> retryPending() async {
    final pending = _s.pending;
    if (pending != null && !_s.submitting) await _send(pending);
  }

  Future<void> _send(PendingAnswer p) async {
    state = AsyncData(_s.copyWith(submitting: true, clearError: true));
    try {
      final result = await _repo.submitAnswer(
        sessionId: _s.session.id!,
        exerciseId: p.exercise.id,
        answer: p.answer,
        clientEventId: p.clientEventId,
        answeredAt: p.answeredAt,
        isRetry: p.isRetry,
      );
      final s = _s;
      final wrong = Set<String>.of(s.wrongIds);
      final answered = Set<String>.of(s.answeredIds);
      if (!p.isRetry) {
        answered.add(p.exercise.id);
        if (result.isCorrect == false) wrong.add(p.exercise.id);
      }
      state = AsyncData(
        s.copyWith(
          current: result,
          clearPending: true,
          submitting: false,
          answeredIds: answered,
          wrongIds: wrong,
        ),
      );
      await _recordInterval(s.session.id!);
    } on ApiError catch (e) {
      state = AsyncData(
        e.isNetwork
            ? _s.copyWith(pending: p, submitting: false)
            : _s.copyWith(
                clearPending: true,
                submitting: false,
                errorCode: e.code,
              ),
      );
    }
  }

  /// Sang câu kế tiếp sau khi xem phản hồi; hết câu thì sang hỏi lại hoặc hoàn thành.
  Future<void> next() async {
    final s = _s;
    if (s.current == null) return;
    if (!s.isLastQuestion) {
      state = AsyncData(s.copyWith(index: s.index + 1, clearCurrent: true));
      return;
    }
    if (s.phase == LessonPhase.exercises) {
      final after = _afterExercises(s.copyWith(clearCurrent: true));
      if (after.phase == LessonPhase.retry) {
        state = AsyncData(after);
        return;
      }
    }
    await finish();
  }

  /// Hoàn thành phiên. Chưa lưu hết (mất kết nối) thì KHÔNG báo hoàn thành, cho phép thử lại.
  Future<void> finish() async {
    final s = _s;
    if (s.completing) return;
    state = AsyncData(
      s.copyWith(completing: true, completeOffline: false, clearError: true),
    );
    try {
      await _recordInterval(s.session.id!);
      final summary = await _repo.complete(s.session.id!);
      state = AsyncData(
        _s.copyWith(
          phase: LessonPhase.summary,
          summary: summary,
          completing: false,
          clearCurrent: true,
        ),
      );
    } on ApiError catch (e) {
      state = AsyncData(
        e.isNetwork
            ? _s.copyWith(completing: false, completeOffline: true)
            : _s.copyWith(completing: false, errorCode: e.code),
      );
    }
  }

  /// Ghi khoảng thời gian học từ lần ghi trước đến giờ (tối đa [kMaxIntervalSeconds]).
  Future<void> _recordInterval(String sessionId) async {
    final now = _now();
    final seconds = now.difference(_lapStart).inSeconds;
    final start = _lapStart;
    _lapStart = now;
    if (seconds < 1) return;
    await _repo.recordInterval(
      sessionId: sessionId,
      startedAt: start,
      durationSeconds: seconds > kMaxIntervalSeconds
          ? kMaxIntervalSeconds
          : seconds,
    );
  }
}

final lessonControllerProvider = AsyncNotifierProvider.autoDispose
    .family<LessonController, LessonState, String>(LessonController.new);
