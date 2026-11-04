//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/goal_type.dart';
import 'package:japanese_api/src/model/lang.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:japanese_api/src/model/target_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'profile.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Profile {
  /// Returns a new [Profile] instance.
  Profile({
    this.displayName,

    this.currentLevel,

    this.goalType,

    this.targetLevel,

    this.dailyMinutes,

    this.targetDate,

    this.skills,

    this.prioritizedSkill,

    this.language,

    this.timezone,

    this.paused,

    this.onboardingState,
  });

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'currentLevel', required: false, includeIfNull: false)
  final Level? currentLevel;

  @JsonKey(name: r'goalType', required: false, includeIfNull: false)
  final GoalType? goalType;

  @JsonKey(name: r'targetLevel', required: false, includeIfNull: false)
  final TargetLevel? targetLevel;

  @JsonKey(name: r'dailyMinutes', required: false, includeIfNull: false)
  final ProfileDailyMinutesEnum? dailyMinutes;

  @JsonKey(name: r'targetDate', required: false, includeIfNull: false)
  final DateTime? targetDate;

  @JsonKey(name: r'skills', required: false, includeIfNull: false)
  final List<Skill>? skills;

  @JsonKey(name: r'prioritizedSkill', required: false, includeIfNull: false)
  final Skill? prioritizedSkill;

  @JsonKey(name: r'language', required: false, includeIfNull: false)
  final Lang? language;

  @JsonKey(name: r'timezone', required: false, includeIfNull: false)
  final String? timezone;

  @JsonKey(name: r'paused', required: false, includeIfNull: false)
  final bool? paused;

  @JsonKey(name: r'onboardingState', required: false, includeIfNull: false)
  final ProfileOnboardingStateEnum? onboardingState;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Profile &&
          other.displayName == displayName &&
          other.currentLevel == currentLevel &&
          other.goalType == goalType &&
          other.targetLevel == targetLevel &&
          other.dailyMinutes == dailyMinutes &&
          other.targetDate == targetDate &&
          other.skills == skills &&
          other.prioritizedSkill == prioritizedSkill &&
          other.language == language &&
          other.timezone == timezone &&
          other.paused == paused &&
          other.onboardingState == onboardingState;

  @override
  int get hashCode =>
      displayName.hashCode +
      currentLevel.hashCode +
      goalType.hashCode +
      targetLevel.hashCode +
      dailyMinutes.hashCode +
      (targetDate == null ? 0 : targetDate.hashCode) +
      skills.hashCode +
      (prioritizedSkill == null ? 0 : prioritizedSkill.hashCode) +
      language.hashCode +
      timezone.hashCode +
      paused.hashCode +
      onboardingState.hashCode;

  factory Profile.fromJson(Map<String, dynamic> json) =>
      _$ProfileFromJson(json);

  Map<String, dynamic> toJson() => _$ProfileToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ProfileDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const ProfileDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum ProfileOnboardingStateEnum {
  @JsonValue(r'not_started')
  notStarted(r'not_started'),
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed');

  const ProfileOnboardingStateEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
