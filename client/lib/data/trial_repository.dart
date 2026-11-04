import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:japanese_api/japanese_api.dart';

import '../domain/trial_grading.dart';
import 'api_providers.dart';

/// Một bài tập dùng thử: đề (cùng dạng với bài học thật nên dùng lại `ExerciseView`) kèm đáp án để client
/// chấm cục bộ và lời phản hồi.
class TrialExerciseData {
  const TrialExerciseData({
    required this.exercise,
    required this.key,
    required this.feedbackCorrect,
    required this.feedbackIncorrect,
  });

  final Exercise exercise;
  final TrialAnswerKey key;
  final String feedbackCorrect;
  final String feedbackIncorrect;

  /// Chấm [answer] và trả kết quả ở dạng `AnswerResult` để dùng lại phần phản hồi của bài học.
  AnswerResult grade(Object answer) {
    final grade = gradeTrialAnswer(key, answer);
    return AnswerResult(
      isCorrect: grade.isCorrect,
      feedback: grade.isCorrect ? feedbackCorrect : feedbackIncorrect,
      correctAnswer: grade.isCorrect ? null : grade.correctAnswer,
    );
  }
}

/// Một đơn vị bài mẫu: phần giải thích (mục) rồi các bài tập.
class TrialUnitData {
  const TrialUnitData({
    required this.id,
    required this.title,
    required this.estMinutes,
    required this.items,
    required this.exercises,
  });

  final String id;
  final String title;
  final int estMinutes;
  final List<ContentItem> items;
  final List<TrialExerciseData> exercises;
}

/// Truy cập luồng dùng thử không đăng ký (T100). Mọi endpoint công khai, không gắn danh tính; server chỉ
/// tăng bộ đếm ẩn danh (FR-038).
class TrialRepository {
  TrialRepository(this._api);

  final JapaneseApi _api;

  /// Các đơn vị bài mẫu (mặc định 1 từ vựng + 1 ngữ pháp, tổng ≤ 10 phút) theo ngôn ngữ giao diện.
  Future<List<TrialUnitData>> content(String languageCode) {
    return guardApi(() async {
      final response = await _api.getTrialApi().getTrialContent(
        lang: languageCode,
      );
      final units = response.data?.units ?? const <TrialContentUnitsInner>[];
      return <TrialUnitData>[
        for (final unit in units)
          if (unit.id != null) _toUnit(unit),
      ];
    });
  }

  /// Chấm kiểm tra trình độ cho khách. Server không lưu gì (`id` của kết quả là null).
  Future<PlacementResult> gradePlacement({
    required Map<String, int?> choices,
    required int durationSeconds,
  }) {
    return guardApi(() async {
      final response = await _api.getTrialApi().gradeTrialPlacement(
        placementAnswers: PlacementAnswers(
          durationSeconds: durationSeconds,
          answers: <PlacementAnswersAnswersInner>[
            for (final entry in choices.entries)
              PlacementAnswersAnswersInner(
                questionId: entry.key,
                choice: entry.value,
              ),
          ],
        ),
      );
      return response.data!;
    });
  }

  /// Báo một lần khi hoàn thành bài mẫu (chỉ tăng bộ đếm ẩn danh). Trả `false` khi không gửi được
  /// (mất mạng, bị giới hạn tần suất): đo lường không được làm hỏng trải nghiệm dùng thử.
  Future<bool> recordLessonCompleted() async {
    try {
      await guardApi(
        () => _api.getTrialApi().recordTrialEvent(
          recordTrialEventRequest: RecordTrialEventRequest(
            event: RecordTrialEventRequestEventEnum.lessonCompleted,
          ),
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static TrialUnitData _toUnit(TrialContentUnitsInner unit) {
    return TrialUnitData(
      id: unit.id!,
      title: unit.title ?? '',
      estMinutes: unit.estMinutes ?? 0,
      items: unit.items ?? const <ContentItem>[],
      exercises: <TrialExerciseData>[
        for (final e in unit.exercises ?? const []) ?_toExercise(e),
      ],
    );
  }

  /// Bài tập thiếu đáp án (hợp đồng cho phép vắng) không chấm được nên bị bỏ qua.
  static TrialExerciseData? _toExercise(
    TrialContentUnitsInnerExercisesInner e,
  ) {
    final type = ExerciseTypeEnum.values
        .where((t) => t.value == e.type.value)
        .firstOrNull;
    final key = _toKey(type, e.answerKey);
    if (type == null || key == null) return null;
    return TrialExerciseData(
      exercise: Exercise(
        id: e.id,
        type: type,
        prompt: e.prompt,
        payload: e.payload,
      ),
      key: key,
      feedbackCorrect: e.feedbackCorrect ?? '',
      feedbackIncorrect: e.feedbackIncorrect ?? '',
    );
  }

  static TrialAnswerKey? _toKey(
    ExerciseTypeEnum? type,
    TrialContentUnitsInnerExercisesInnerAllOfAnswerKey? key,
  ) {
    if (type == null || key == null) return null;
    switch (type) {
      case ExerciseTypeEnum.multipleChoice:
        final index = key.correctIndex;
        return index == null ? null : ChoiceAnswerKey(index);
      case ExerciseTypeEnum.matching:
        final pairs = key.pairs;
        return pairs == null || pairs.isEmpty ? null : MatchingAnswerKey(pairs);
      case ExerciseTypeEnum.fillBlank:
        final accepted = key.acceptedAnswers;
        return accepted == null || accepted.isEmpty
            ? null
            : FillBlankAnswerKey(accepted);
    }
  }
}

final trialRepositoryProvider = Provider<TrialRepository>((ref) {
  return TrialRepository(ref.watch(japaneseApiProvider));
});
