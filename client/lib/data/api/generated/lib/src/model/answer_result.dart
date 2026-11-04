//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'answer_result.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnswerResult {
  /// Returns a new [AnswerResult] instance.
  AnswerResult({
    this.isCorrect,

    this.feedback,

    this.correctAnswer,

    this.nextReviewDate,

    this.duplicate,
  });

  @JsonKey(name: r'isCorrect', required: false, includeIfNull: false)
  final bool? isCorrect;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'feedback', required: false, includeIfNull: false)
  final String? feedback;

  /// Đáp án đúng khi trả lời sai
  @JsonKey(name: r'correctAnswer', required: false, includeIfNull: false)
  final Object? correctAnswer;

  @JsonKey(name: r'nextReviewDate', required: false, includeIfNull: false)
  final DateTime? nextReviewDate;

  /// true nếu clientEventId đã được ghi, hoặc bài tập này đã có câu trả lời lượt chính trong phiên (FR-041); khi đó trả lại kết quả đã có
  @JsonKey(name: r'duplicate', required: false, includeIfNull: false)
  final bool? duplicate;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AnswerResult &&
          other.isCorrect == isCorrect &&
          other.feedback == feedback &&
          other.correctAnswer == correctAnswer &&
          other.nextReviewDate == nextReviewDate &&
          other.duplicate == duplicate;

  @override
  int get hashCode =>
      isCorrect.hashCode +
      feedback.hashCode +
      (correctAnswer == null ? 0 : correctAnswer.hashCode) +
      (nextReviewDate == null ? 0 : nextReviewDate.hashCode) +
      duplicate.hashCode;

  factory AnswerResult.fromJson(Map<String, dynamic> json) =>
      _$AnswerResultFromJson(json);

  Map<String, dynamic> toJson() => _$AnswerResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
