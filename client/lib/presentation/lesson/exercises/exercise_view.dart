import 'package:flutter/material.dart';
import 'package:japanese_api/japanese_api.dart';

import 'fill_blank_exercise.dart';
import 'matching_exercise.dart';
import 'multiple_choice_exercise.dart';

/// Gọi khi người học chốt đáp án. Định dạng khớp `AnswerSubmission.answer`:
/// `int` (multiple_choice), `List<List<String>>` cặp [trái, phải] (matching), `String` (fill_blank).
typedef AnswerCallback = void Function(Object answer);

/// Một bài tập khách quan (FR-025) với phản hồi tức thì (FR-018): hiển thị đề và chọn widget theo
/// loại. Khi đã có [result] thì khóa nhập và tô màu đúng/sai; việc hiện lời phản hồi do màn hình bài học đảm nhiệm.
class ExerciseView extends StatelessWidget {
  const ExerciseView({
    super.key,
    required this.exercise,
    required this.onSubmit,
    this.enabled = true,
    this.result,
  });

  final Exercise exercise;
  final AnswerCallback onSubmit;

  /// `false` khi đang gửi câu trả lời lên server hoặc đã có kết quả.
  final bool enabled;

  /// Kết quả chấm của server; `null` khi chưa trả lời.
  final AnswerResult? result;

  @override
  Widget build(BuildContext context) {
    final payload = exercise.payload is Map
        ? Map<String, Object?>.from(exercise.payload as Map)
        : <String, Object?>{};
    final body = switch (exercise.type) {
      ExerciseTypeEnum.multipleChoice => MultipleChoiceExercise(
        key: ValueKey<String>(exercise.id),
        choices: stringList(payload['choices']),
        enabled: enabled,
        result: result,
        onSubmit: onSubmit,
      ),
      ExerciseTypeEnum.matching => MatchingExercise(
        key: ValueKey<String>(exercise.id),
        left: stringList(payload['left']),
        right: stringList(payload['right']),
        enabled: enabled,
        result: result,
        onSubmit: onSubmit,
      ),
      ExerciseTypeEnum.fillBlank => FillBlankExercise(
        key: ValueKey<String>(exercise.id),
        hint: payload['hint'] as String?,
        enabled: enabled,
        result: result,
        onSubmit: onSubmit,
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          exercise.prompt,
          key: const Key('exercise-prompt'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 16),
        body,
      ],
    );
  }
}

/// Đọc danh sách chuỗi từ giá trị JSON (bỏ qua phần tử không phải chuỗi).
List<String> stringList(Object? value) =>
    value is List ? value.whereType<String>().toList() : const <String>[];

/// Màu viền/nền thể hiện trạng thái đúng/sai theo chủ đề.
Color? resultColor(BuildContext context, {required bool? correct}) {
  final scheme = Theme.of(context).colorScheme;
  return switch (correct) {
    true => scheme.primaryContainer,
    false => scheme.errorContainer,
    null => null,
  };
}
