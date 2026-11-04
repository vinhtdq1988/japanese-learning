//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'answer_submission.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnswerSubmission {
  /// Returns a new [AnswerSubmission] instance.
  AnswerSubmission({
    required this.clientEventId,

    required this.exerciseId,

    required this.answer,

    this.answeredAt,

    this.isRetry = false,
  });

  @JsonKey(name: r'clientEventId', required: true, includeIfNull: false)
  final String clientEventId;

  @JsonKey(name: r'exerciseId', required: true, includeIfNull: false)
  final String exerciseId;

  /// Chỉ số lựa chọn, danh sách cặp, hoặc chuỗi điền từ
  @JsonKey(name: r'answer', required: true, includeIfNull: true)
  final Object? answer;

  @JsonKey(name: r'answeredAt', required: false, includeIfNull: false)
  final DateTime? answeredAt;

  /// Câu hỏi lại cuối phiên (R6): có phản hồi nhưng không cập nhật lịch ôn, thống kê mảng hay độ chính xác
  @JsonKey(
    defaultValue: false,
    name: r'isRetry',
    required: false,
    includeIfNull: false,
  )
  final bool? isRetry;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AnswerSubmission &&
          other.clientEventId == clientEventId &&
          other.exerciseId == exerciseId &&
          other.answer == answer &&
          other.answeredAt == answeredAt &&
          other.isRetry == isRetry;

  @override
  int get hashCode =>
      clientEventId.hashCode +
      exerciseId.hashCode +
      (answer == null ? 0 : answer.hashCode) +
      answeredAt.hashCode +
      isRetry.hashCode;

  factory AnswerSubmission.fromJson(Map<String, dynamic> json) =>
      _$AnswerSubmissionFromJson(json);

  Map<String, dynamic> toJson() => _$AnswerSubmissionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
