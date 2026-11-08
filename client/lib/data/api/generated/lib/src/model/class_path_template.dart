//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:japanese_api/src/model/target_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_path_template.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPathTemplate {
  /// Returns a new [ClassPathTemplate] instance.
  ClassPathTemplate({
    required this.startLevel,

    required this.targetLevel,

    required this.skills,

    required this.startsOn,

    required this.endsOn,

    required this.dailyMinutes,
  });

  @JsonKey(name: r'startLevel', required: true, includeIfNull: false)
  final Level startLevel;

  @JsonKey(name: r'targetLevel', required: true, includeIfNull: false)
  final TargetLevel targetLevel;

  @JsonKey(name: r'skills', required: true, includeIfNull: false)
  final Set<Skill> skills;

  @JsonKey(name: r'startsOn', required: true, includeIfNull: false)
  final DateTime startsOn;

  /// > startsOn
  @JsonKey(name: r'endsOn', required: true, includeIfNull: false)
  final DateTime endsOn;

  @JsonKey(name: r'dailyMinutes', required: true, includeIfNull: false)
  final ClassPathTemplateDailyMinutesEnum dailyMinutes;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPathTemplate &&
          other.startLevel == startLevel &&
          other.targetLevel == targetLevel &&
          other.skills == skills &&
          other.startsOn == startsOn &&
          other.endsOn == endsOn &&
          other.dailyMinutes == dailyMinutes;

  @override
  int get hashCode =>
      startLevel.hashCode +
      targetLevel.hashCode +
      skills.hashCode +
      startsOn.hashCode +
      endsOn.hashCode +
      dailyMinutes.hashCode;

  factory ClassPathTemplate.fromJson(Map<String, dynamic> json) =>
      _$ClassPathTemplateFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPathTemplateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassPathTemplateDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const ClassPathTemplateDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
