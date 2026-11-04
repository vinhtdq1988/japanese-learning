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

part 'profile_update.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProfileUpdate {
  /// Returns a new [ProfileUpdate] instance.
  ProfileUpdate({
    this.displayName,

    this.email,

    this.currentPassword,

    this.currentLevel,

    this.dailyMinutes,

    this.goalType,

    this.targetLevel,

    this.targetDate,

    this.prioritizedSkill,

    this.language,

    this.timezone,
  });

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  /// Bắt buộc khi có `email`
  @JsonKey(name: r'currentPassword', required: false, includeIfNull: false)
  final String? currentPassword;

  @JsonKey(name: r'currentLevel', required: false, includeIfNull: false)
  final Level? currentLevel;

  @JsonKey(name: r'dailyMinutes', required: false, includeIfNull: false)
  final ProfileUpdateDailyMinutesEnum? dailyMinutes;

  @JsonKey(name: r'goalType', required: false, includeIfNull: false)
  final GoalType? goalType;

  @JsonKey(name: r'targetLevel', required: false, includeIfNull: false)
  final TargetLevel? targetLevel;

  @JsonKey(name: r'targetDate', required: false, includeIfNull: false)
  final DateTime? targetDate;

  @JsonKey(name: r'prioritizedSkill', required: false, includeIfNull: false)
  final Skill? prioritizedSkill;

  @JsonKey(name: r'language', required: false, includeIfNull: false)
  final Lang? language;

  @JsonKey(name: r'timezone', required: false, includeIfNull: false)
  final String? timezone;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProfileUpdate &&
          other.displayName == displayName &&
          other.email == email &&
          other.currentPassword == currentPassword &&
          other.currentLevel == currentLevel &&
          other.dailyMinutes == dailyMinutes &&
          other.goalType == goalType &&
          other.targetLevel == targetLevel &&
          other.targetDate == targetDate &&
          other.prioritizedSkill == prioritizedSkill &&
          other.language == language &&
          other.timezone == timezone;

  @override
  int get hashCode =>
      displayName.hashCode +
      email.hashCode +
      currentPassword.hashCode +
      currentLevel.hashCode +
      dailyMinutes.hashCode +
      goalType.hashCode +
      targetLevel.hashCode +
      (targetDate == null ? 0 : targetDate.hashCode) +
      (prioritizedSkill == null ? 0 : prioritizedSkill.hashCode) +
      language.hashCode +
      timezone.hashCode;

  factory ProfileUpdate.fromJson(Map<String, dynamic> json) =>
      _$ProfileUpdateFromJson(json);

  Map<String, dynamic> toJson() => _$ProfileUpdateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ProfileUpdateDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const ProfileUpdateDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
