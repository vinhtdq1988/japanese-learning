import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../platform/platform.dart';
import '../../platform/platform_providers.dart';

/// Trạng thái dùng thử của khách (T099, FR-036 → FR-039). Server KHÔNG giữ phiên nào cho khách nên toàn
/// bộ trạng thái nằm ở trình duyệt, lưu qua [LocalStore].
///
/// - [completedUnitIds] (`trialProgress`): đơn vị bài mẫu đã học xong.
/// - [answers] (`trialAnswers`): kết quả đúng/sai từng bài tập đã làm (để tiếp tục dở dang).
/// - [placementAnswers]: câu trả lời kiểm tra trình độ. Khi đăng ký, CHÍNH các câu trả lời này (không phải
///   kết quả) được gửi sang onboarding để server chấm lại (FR-039).
/// - [startedAt]: lúc bắt đầu dùng thử.
class TrialState {
  const TrialState({
    this.startedAt,
    this.completedUnitIds = const <String>[],
    this.lessonEventSent = false,
    this.answers = const <String, bool>{},
    this.placementAnswers = const <String, int?>{},
    this.placementDurationSeconds,
    this.placementResult,
  });

  static const TrialState empty = TrialState();

  final DateTime? startedAt;
  final List<String> completedUnitIds;

  /// Đã gọi `POST /trial/events` cho lần hoàn thành bài mẫu; chỉ gọi một lần (T100).
  final bool lessonEventSent;
  final Map<String, bool> answers;
  final Map<String, int?> placementAnswers;
  final int? placementDurationSeconds;

  /// Kết quả server trả khi chấm kiểm tra trình độ dùng thử (chỉ để hiển thị lại).
  final PlacementResult? placementResult;

  /// Đã có hoạt động dùng thử nào trên trình duyệt này (căn cứ cờ `fromTrial` khi đăng ký, SC-011).
  bool get hasActivity => startedAt != null;
  bool get hasPlacement => placementAnswers.isNotEmpty;
  bool isUnitCompleted(String unitId) => completedUnitIds.contains(unitId);

  TrialState copyWith({
    DateTime? startedAt,
    List<String>? completedUnitIds,
    bool? lessonEventSent,
    Map<String, bool>? answers,
    Map<String, int?>? placementAnswers,
    int? placementDurationSeconds,
    PlacementResult? placementResult,
    bool clearPlacement = false,
  }) {
    return TrialState(
      startedAt: startedAt ?? this.startedAt,
      completedUnitIds: completedUnitIds ?? this.completedUnitIds,
      lessonEventSent: lessonEventSent ?? this.lessonEventSent,
      answers: answers ?? this.answers,
      placementAnswers: clearPlacement
          ? const <String, int?>{}
          : (placementAnswers ?? this.placementAnswers),
      placementDurationSeconds: clearPlacement
          ? null
          : (placementDurationSeconds ?? this.placementDurationSeconds),
      placementResult: clearPlacement
          ? null
          : (placementResult ?? this.placementResult),
    );
  }

  static const int _version = 1;

  Map<String, Object?> toJson() => <String, Object?>{
    'v': _version,
    if (startedAt != null) 'startedAt': startedAt!.toIso8601String(),
    'completedUnitIds': completedUnitIds,
    'lessonEventSent': lessonEventSent,
    'answers': answers,
    'placementAnswers': placementAnswers,
    if (placementDurationSeconds != null)
      'placementDurationSeconds': placementDurationSeconds,
    if (placementResult != null) 'placementResult': placementResult!.toJson(),
  };

  /// Đọc từ JSON đã lưu. Dữ liệu hỏng hoặc thuộc phiên bản lạ cho trạng thái trống thay vì ném lỗi, vì
  /// trình duyệt có thể mất/sửa dữ liệu bất cứ lúc nào (người dùng thử lại từ đầu được).
  static TrialState fromJson(Object? raw) {
    if (raw is! Map || raw['v'] != _version) return empty;
    try {
      final startedAt = raw['startedAt'];
      final duration = raw['placementDurationSeconds'];
      final result = raw['placementResult'];
      return TrialState(
        startedAt: startedAt is String ? DateTime.tryParse(startedAt) : null,
        completedUnitIds: <String>[
          if (raw['completedUnitIds'] case final List<dynamic> ids)
            ...ids.whereType<String>(),
        ],
        lessonEventSent: raw['lessonEventSent'] == true,
        answers: <String, bool>{
          if (raw['answers'] case final Map<dynamic, dynamic> map)
            for (final e in map.entries)
              if (e.key is String && e.value is bool)
                e.key as String: e.value as bool,
        },
        placementAnswers: <String, int?>{
          if (raw['placementAnswers'] case final Map<dynamic, dynamic> map)
            for (final e in map.entries)
              if (e.key is String && (e.value == null || e.value is int))
                e.key as String: e.value as int?,
        },
        placementDurationSeconds: duration is int ? duration : null,
        placementResult: result is Map
            ? PlacementResult.fromJson(Map<String, dynamic>.from(result))
            : null,
      );
    } catch (_) {
      return empty;
    }
  }
}

/// Điều khiển trạng thái dùng thử: đọc từ [LocalStore] khi khởi tạo và ghi lại sau mỗi thay đổi. Mọi lỗi
/// lưu/đọc bị nuốt (kho cục bộ có thể không dùng được ở chế độ riêng tư): khi đó trạng thái chỉ sống trong
/// bộ nhớ và người dùng vẫn dùng thử bình thường.
class TrialController extends AsyncNotifier<TrialState> {
  /// Khóa lưu trong [LocalStore]; hậu tố phiên bản để đổi định dạng sau này không đọc nhầm dữ liệu cũ.
  static const String storageKey = 'trial.state.v1';

  @override
  Future<TrialState> build() async {
    try {
      final raw = await ref.read(localStoreProvider).getString(storageKey);
      if (raw == null) return TrialState.empty;
      return TrialState.fromJson(jsonDecode(raw));
    } catch (_) {
      return TrialState.empty;
    }
  }

  Future<TrialState> _current() async => state.valueOrNull ?? await future;

  Future<void> _apply(TrialState Function(TrialState current) change) async {
    final next = change(await _current());
    state = AsyncData<TrialState>(next);
    try {
      await ref
          .read(localStoreProvider)
          .setString(storageKey, jsonEncode(next.toJson()));
    } catch (_) {
      // Không lưu được: giữ trạng thái trong bộ nhớ.
    }
  }

  TrialState _started(TrialState s) =>
      s.startedAt == null ? s.copyWith(startedAt: DateTime.now().toUtc()) : s;

  /// Đánh dấu đã bắt đầu dùng thử (khi vào bài mẫu/kiểm tra).
  Future<void> ensureStarted() => _apply(_started);

  Future<void> recordAnswer(String exerciseId, {required bool correct}) {
    return _apply(
      (s) => _started(
        s,
      ).copyWith(answers: <String, bool>{...s.answers, exerciseId: correct}),
    );
  }

  Future<void> completeUnit(String unitId) {
    return _apply(
      (s) => s.isUnitCompleted(unitId)
          ? s
          : _started(s).copyWith(
              completedUnitIds: <String>[...s.completedUnitIds, unitId],
            ),
    );
  }

  Future<void> markLessonEventSent() =>
      _apply((s) => s.copyWith(lessonEventSent: true));

  Future<void> savePlacement({
    required Map<String, int?> answers,
    required int durationSeconds,
    required PlacementResult result,
  }) {
    return _apply(
      (s) => _started(s).copyWith(
        placementAnswers: answers,
        placementDurationSeconds: durationSeconds,
        placementResult: result,
      ),
    );
  }

  /// Bỏ kết quả kiểm tra để làm lại (FR-039): không mang câu trả lời cũ sang onboarding nữa.
  Future<void> discardPlacement() =>
      _apply((s) => s.copyWith(clearPlacement: true));

  /// Cho dùng thử lại từ đầu: xóa mọi trạng thái dùng thử, kể cả cờ đã gửi sự kiện hoàn thành.
  Future<void> restart() => clear();

  /// Xóa sạch trạng thái dùng thử (dùng thử lại từ đầu, hoặc sau khi đã chuyển sang tài khoản thật).
  Future<void> clear() async {
    state = const AsyncData<TrialState>(TrialState.empty);
    try {
      await ref.read(localStoreProvider).remove(storageKey);
    } catch (_) {
      // Bỏ qua: không có gì để xóa hoặc kho không dùng được.
    }
  }
}

final trialStateProvider = AsyncNotifierProvider<TrialController, TrialState>(
  TrialController.new,
);
