//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/trial_content_units_inner_exercises_inner.dart';
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_item.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'trial_content_units_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TrialContentUnitsInner {
  /// Returns a new [TrialContentUnitsInner] instance.
  TrialContentUnitsInner({
    this.id,

    this.kind,

    this.title,

    this.estMinutes,

    this.items,

    this.exercises,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'kind', required: false, includeIfNull: false)
  final Skill? kind;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'title', required: false, includeIfNull: false)
  final String? title;

  @JsonKey(name: r'estMinutes', required: false, includeIfNull: false)
  final int? estMinutes;

  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<ContentItem>? items;

  @JsonKey(name: r'exercises', required: false, includeIfNull: false)
  final List<TrialContentUnitsInnerExercisesInner>? exercises;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TrialContentUnitsInner &&
          other.id == id &&
          other.kind == kind &&
          other.title == title &&
          other.estMinutes == estMinutes &&
          other.items == items &&
          other.exercises == exercises;

  @override
  int get hashCode =>
      id.hashCode +
      kind.hashCode +
      title.hashCode +
      estMinutes.hashCode +
      items.hashCode +
      exercises.hashCode;

  factory TrialContentUnitsInner.fromJson(Map<String, dynamic> json) =>
      _$TrialContentUnitsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$TrialContentUnitsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
