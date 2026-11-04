//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/goal_type.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:japanese_api/src/model/target_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'onboarding_draft.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OnboardingDraft {
  /// Returns a new [OnboardingDraft] instance.
  OnboardingDraft({
    this.currentLevel,

    this.goalType,

    this.targetLevel,

    this.dailyMinutes,

    this.targetDate,

    this.skills,

    this.placementResultId,

    this.timezone,
  });

  @JsonKey(name: r'currentLevel', required: false, includeIfNull: false)
  final Level? currentLevel;

  @JsonKey(name: r'goalType', required: false, includeIfNull: false)
  final GoalType? goalType;

  @JsonKey(name: r'targetLevel', required: false, includeIfNull: false)
  final TargetLevel? targetLevel;

  @JsonKey(name: r'dailyMinutes', required: false, includeIfNull: false)
  final OnboardingDraftDailyMinutesEnum? dailyMinutes;

  @JsonKey(name: r'targetDate', required: false, includeIfNull: false)
  final DateTime? targetDate;

  @JsonKey(name: r'skills', required: false, includeIfNull: false)
  final List<Skill>? skills;

  @JsonKey(name: r'placementResultId', required: false, includeIfNull: false)
  final String? placementResultId;

  @JsonKey(name: r'timezone', required: false, includeIfNull: false)
  final String? timezone;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OnboardingDraft &&
          other.currentLevel == currentLevel &&
          other.goalType == goalType &&
          other.targetLevel == targetLevel &&
          other.dailyMinutes == dailyMinutes &&
          other.targetDate == targetDate &&
          other.skills == skills &&
          other.placementResultId == placementResultId &&
          other.timezone == timezone;

  @override
  int get hashCode =>
      currentLevel.hashCode +
      goalType.hashCode +
      targetLevel.hashCode +
      dailyMinutes.hashCode +
      (targetDate == null ? 0 : targetDate.hashCode) +
      skills.hashCode +
      (placementResultId == null ? 0 : placementResultId.hashCode) +
      timezone.hashCode;

  factory OnboardingDraft.fromJson(Map<String, dynamic> json) =>
      _$OnboardingDraftFromJson(json);

  Map<String, dynamic> toJson() => _$OnboardingDraftToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum OnboardingDraftDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const OnboardingDraftDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
