//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner_all_of_answer_key.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'trial_content_units_inner_exercises_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TrialContentUnitsInnerExercisesInner {
  /// Returns a new [TrialContentUnitsInnerExercisesInner] instance.
  TrialContentUnitsInnerExercisesInner({
    required this.id,

    required this.type,

    required this.prompt,

    required this.payload,

    this.answerKey,

    this.feedbackCorrect,

    this.feedbackIncorrect,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'type', required: true, includeIfNull: false)
  final TrialContentUnitsInnerExercisesInnerTypeEnum type;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'prompt', required: true, includeIfNull: false)
  final String prompt;

  /// Dạng theo `type`: `multiple_choice` → `choices[]`; `matching` → `left[]` và `right[]` (vế phải đã xáo; trả lời là danh sách cặp [vế trái, vế phải]); `fill_blank` → `hint` (tùy chọn). KHÔNG chứa đáp án trong luồng người học.
  @JsonKey(name: r'payload', required: true, includeIfNull: false)
  final Object payload;

  @JsonKey(name: r'answerKey', required: false, includeIfNull: false)
  final TrialContentUnitsInnerExercisesInnerAllOfAnswerKey? answerKey;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'feedbackCorrect', required: false, includeIfNull: false)
  final String? feedbackCorrect;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'feedbackIncorrect', required: false, includeIfNull: false)
  final String? feedbackIncorrect;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TrialContentUnitsInnerExercisesInner &&
          other.id == id &&
          other.type == type &&
          other.prompt == prompt &&
          other.payload == payload &&
          other.answerKey == answerKey &&
          other.feedbackCorrect == feedbackCorrect &&
          other.feedbackIncorrect == feedbackIncorrect;

  @override
  int get hashCode =>
      id.hashCode +
      type.hashCode +
      prompt.hashCode +
      payload.hashCode +
      answerKey.hashCode +
      feedbackCorrect.hashCode +
      feedbackIncorrect.hashCode;

  factory TrialContentUnitsInnerExercisesInner.fromJson(
    Map<String, dynamic> json,
  ) => _$TrialContentUnitsInnerExercisesInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$TrialContentUnitsInnerExercisesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum TrialContentUnitsInnerExercisesInnerTypeEnum {
  @JsonValue(r'multiple_choice')
  multipleChoice(r'multiple_choice'),
  @JsonValue(r'matching')
  matching(r'matching'),
  @JsonValue(r'fill_blank')
  fillBlank(r'fill_blank');

  const TrialContentUnitsInnerExercisesInnerTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
