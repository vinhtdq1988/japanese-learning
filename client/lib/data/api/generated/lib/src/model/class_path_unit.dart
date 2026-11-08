//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_path_unit.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPathUnit {
  /// Returns a new [ClassPathUnit] instance.
  ClassPathUnit({
    required this.unitId,

    required this.title,

    required this.kind,

    required this.level,

    required this.estMinutes,

    required this.position,

    this.opensOn,

    this.isOpen,
  });

  @JsonKey(name: r'unitId', required: true, includeIfNull: false)
  final String unitId;

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  @JsonKey(name: r'kind', required: true, includeIfNull: false)
  final Skill kind;

  @JsonKey(name: r'level', required: true, includeIfNull: false)
  final String level;

  @JsonKey(name: r'estMinutes', required: true, includeIfNull: false)
  final int estMinutes;

  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final int position;

  @JsonKey(name: r'opensOn', required: false, includeIfNull: false)
  final DateTime? opensOn;

  @JsonKey(name: r'isOpen', required: false, includeIfNull: false)
  final bool? isOpen;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPathUnit &&
          other.unitId == unitId &&
          other.title == title &&
          other.kind == kind &&
          other.level == level &&
          other.estMinutes == estMinutes &&
          other.position == position &&
          other.opensOn == opensOn &&
          other.isOpen == isOpen;

  @override
  int get hashCode =>
      unitId.hashCode +
      title.hashCode +
      kind.hashCode +
      level.hashCode +
      estMinutes.hashCode +
      position.hashCode +
      (opensOn == null ? 0 : opensOn.hashCode) +
      isOpen.hashCode;

  factory ClassPathUnit.fromJson(Map<String, dynamic> json) =>
      _$ClassPathUnitFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPathUnitToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
