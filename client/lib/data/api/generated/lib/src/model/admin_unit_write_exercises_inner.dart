//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_unit_write_exercises_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUnitWriteExercisesInner {
  /// Returns a new [AdminUnitWriteExercisesInner] instance.
  AdminUnitWriteExercisesInner({
    this.id,

    this.status = AdminUnitWriteExercisesInnerStatusEnum.active,

    required this.type,

    required this.prompt,

    required this.payload,

    required this.feedbackCorrect,

    required this.feedbackIncorrect,
  });

  /// Có khi sửa bài tập đã tồn tại
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(
    defaultValue: AdminUnitWriteExercisesInnerStatusEnum.active,
    name: r'status',
    required: false,
    includeIfNull: false,
  )
  final AdminUnitWriteExercisesInnerStatusEnum? status;

  @JsonKey(name: r'type', required: true, includeIfNull: false)
  final AdminUnitWriteExercisesInnerTypeEnum type;

  @JsonKey(name: r'prompt', required: true, includeIfNull: false)
  final I18nText prompt;

  /// Gồm đáp án cố định (xem data-model.md §2.10)
  @JsonKey(name: r'payload', required: true, includeIfNull: false)
  final Object payload;

  @JsonKey(name: r'feedbackCorrect', required: true, includeIfNull: false)
  final I18nText feedbackCorrect;

  @JsonKey(name: r'feedbackIncorrect', required: true, includeIfNull: false)
  final I18nText feedbackIncorrect;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUnitWriteExercisesInner &&
          other.id == id &&
          other.status == status &&
          other.type == type &&
          other.prompt == prompt &&
          other.payload == payload &&
          other.feedbackCorrect == feedbackCorrect &&
          other.feedbackIncorrect == feedbackIncorrect;

  @override
  int get hashCode =>
      id.hashCode +
      status.hashCode +
      type.hashCode +
      prompt.hashCode +
      payload.hashCode +
      feedbackCorrect.hashCode +
      feedbackIncorrect.hashCode;

  factory AdminUnitWriteExercisesInner.fromJson(Map<String, dynamic> json) =>
      _$AdminUnitWriteExercisesInnerFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUnitWriteExercisesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminUnitWriteExercisesInnerStatusEnum {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'inactive')
  inactive(r'inactive');

  const AdminUnitWriteExercisesInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum AdminUnitWriteExercisesInnerTypeEnum {
  @JsonValue(r'multiple_choice')
  multipleChoice(r'multiple_choice'),
  @JsonValue(r'matching')
  matching(r'matching'),
  @JsonValue(r'fill_blank')
  fillBlank(r'fill_blank');

  const AdminUnitWriteExercisesInnerTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
