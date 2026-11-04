//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'exercise.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Exercise {
  /// Returns a new [Exercise] instance.
  Exercise({
    required this.id,

    required this.type,

    required this.prompt,

    required this.payload,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'type', required: true, includeIfNull: false)
  final ExerciseTypeEnum type;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'prompt', required: true, includeIfNull: false)
  final String prompt;

  /// Dạng theo `type`: `multiple_choice` → `choices[]`; `matching` → `left[]` và `right[]` (vế phải đã xáo; trả lời là danh sách cặp [vế trái, vế phải]); `fill_blank` → `hint` (tùy chọn). KHÔNG chứa đáp án trong luồng người học.
  @JsonKey(name: r'payload', required: true, includeIfNull: false)
  final Object payload;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Exercise &&
          other.id == id &&
          other.type == type &&
          other.prompt == prompt &&
          other.payload == payload;

  @override
  int get hashCode =>
      id.hashCode + type.hashCode + prompt.hashCode + payload.hashCode;

  factory Exercise.fromJson(Map<String, dynamic> json) =>
      _$ExerciseFromJson(json);

  Map<String, dynamic> toJson() => _$ExerciseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ExerciseTypeEnum {
  @JsonValue(r'multiple_choice')
  multipleChoice(r'multiple_choice'),
  @JsonValue(r'matching')
  matching(r'matching'),
  @JsonValue(r'fill_blank')
  fillBlank(r'fill_blank');

  const ExerciseTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
