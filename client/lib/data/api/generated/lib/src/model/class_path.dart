//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_notice.dart';
import 'package:japanese_api/src/model/class_assignment.dart';
import 'package:japanese_api/src/model/path_warning.dart';
import 'package:japanese_api/src/model/scope_notice.dart';
import 'package:japanese_api/src/model/class_path_unit.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:japanese_api/src/model/target_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_path.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPath {
  /// Returns a new [ClassPath] instance.
  ClassPath({
    required this.startLevel,

    required this.targetLevel,

    required this.skills,

    required this.startsOn,

    required this.endsOn,

    required this.dailyMinutes,

    required this.mode,

    this.scopeNotice,

    required this.units,

    required this.assignments,

    required this.warnings,

    required this.contentNotices,

    required this.updatedAt,
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
  final ClassPathDailyMinutesEnum dailyMinutes;

  @JsonKey(name: r'mode', required: true, includeIfNull: false)
  final ClassPathModeEnum mode;

  @JsonKey(name: r'scopeNotice', required: false, includeIfNull: false)
  final ScopeNotice? scopeNotice;

  /// explicit - đúng danh sách và thứ tự giáo viên chọn; template - thứ tự tham khảo tính động
  @JsonKey(name: r'units', required: true, includeIfNull: false)
  final List<ClassPathUnit> units;

  @JsonKey(name: r'assignments', required: true, includeIfNull: false)
  final List<ClassAssignment> assignments;

  @JsonKey(name: r'warnings', required: true, includeIfNull: false)
  final List<PathWarning> warnings;

  @JsonKey(name: r'contentNotices', required: true, includeIfNull: false)
  final List<ContentNotice> contentNotices;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPath &&
          other.startLevel == startLevel &&
          other.targetLevel == targetLevel &&
          other.skills == skills &&
          other.startsOn == startsOn &&
          other.endsOn == endsOn &&
          other.dailyMinutes == dailyMinutes &&
          other.mode == mode &&
          other.scopeNotice == scopeNotice &&
          other.units == units &&
          other.assignments == assignments &&
          other.warnings == warnings &&
          other.contentNotices == contentNotices &&
          other.updatedAt == updatedAt;

  @override
  int get hashCode =>
      startLevel.hashCode +
      targetLevel.hashCode +
      skills.hashCode +
      startsOn.hashCode +
      endsOn.hashCode +
      dailyMinutes.hashCode +
      mode.hashCode +
      (scopeNotice == null ? 0 : scopeNotice.hashCode) +
      units.hashCode +
      assignments.hashCode +
      warnings.hashCode +
      contentNotices.hashCode +
      updatedAt.hashCode;

  factory ClassPath.fromJson(Map<String, dynamic> json) =>
      _$ClassPathFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPathToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassPathDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const ClassPathDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum ClassPathModeEnum {
  @JsonValue(r'template')
  template(r'template'),
  @JsonValue(r'explicit')
  explicit(r'explicit');

  const ClassPathModeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
