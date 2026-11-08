//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail_units_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetailUnitsInner {
  /// Returns a new [ClassLearnerDetailUnitsInner] instance.
  ClassLearnerDetailUnitsInner({
    required this.unitId,

    required this.title,

    required this.status,

    this.dueOn,
  });

  @JsonKey(name: r'unitId', required: true, includeIfNull: false)
  final String unitId;

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final ClassLearnerDetailUnitsInnerStatusEnum status;

  @JsonKey(name: r'dueOn', required: false, includeIfNull: false)
  final DateTime? dueOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerDetailUnitsInner &&
          other.unitId == unitId &&
          other.title == title &&
          other.status == status &&
          other.dueOn == dueOn;

  @override
  int get hashCode =>
      unitId.hashCode +
      title.hashCode +
      status.hashCode +
      (dueOn == null ? 0 : dueOn.hashCode);

  factory ClassLearnerDetailUnitsInner.fromJson(Map<String, dynamic> json) =>
      _$ClassLearnerDetailUnitsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ClassLearnerDetailUnitsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassLearnerDetailUnitsInnerStatusEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed'),
  @JsonValue(r'mastered')
  mastered(r'mastered'),
  @JsonValue(r'exempt')
  exempt(r'exempt');

  const ClassLearnerDetailUnitsInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
