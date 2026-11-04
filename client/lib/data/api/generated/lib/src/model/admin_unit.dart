//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/admin_unit_write_exercises_inner.dart';
import 'package:japanese_api/src/model/content_level.dart';
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:japanese_api/src/model/goal_type.dart';
import 'package:japanese_api/src/model/admin_unit_write_items_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_unit.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUnit {
  /// Returns a new [AdminUnit] instance.
  AdminUnit({
    required this.kind,

    required this.title,

    required this.level,

    this.goalTags,

    required this.topicId,

    required this.difficulty,

    this.tier = AdminUnitTierEnum.core,

    required this.estMinutes,

    this.sequence,

    this.items,

    this.exercises,

    this.id,

    this.status,

    this.isTrial,

    this.updatedAt,
  });

  @JsonKey(name: r'kind', required: true, includeIfNull: false)
  final Skill kind;

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final I18nText title;

  @JsonKey(name: r'level', required: true, includeIfNull: false)
  final ContentLevel level;

  @JsonKey(name: r'goalTags', required: false, includeIfNull: false)
  final List<GoalType>? goalTags;

  @JsonKey(name: r'topicId', required: true, includeIfNull: false)
  final String topicId;

  // minimum: 1
  // maximum: 5
  @JsonKey(name: r'difficulty', required: true, includeIfNull: false)
  final int difficulty;

  /// `foundation` = nền tảng người mới, chỉ hợp lệ với level N5
  @JsonKey(
    defaultValue: AdminUnitTierEnum.core,
    name: r'tier',
    required: false,
    includeIfNull: false,
  )
  final AdminUnitTierEnum? tier;

  @JsonKey(name: r'estMinutes', required: true, includeIfNull: false)
  final AdminUnitEstMinutesEnum estMinutes;

  @JsonKey(name: r'sequence', required: false, includeIfNull: false)
  final int? sequence;

  /// Khi sửa: phần tử có `id` được cập nhật, phần tử không có `id` được tạo mới; mục hiện có vắng mặt trong payload bị chuyển `inactive`, KHÔNG xóa cứng (giữ `study_records`/`review_schedules` – data-model §2.9).
  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<AdminUnitWriteItemsInner>? items;

  /// Cùng quy tắc với `items` – bài tập vắng mặt trong payload sửa bị chuyển `inactive`, không xóa cứng.
  @JsonKey(name: r'exercises', required: false, includeIfNull: false)
  final List<AdminUnitWriteExercisesInner>? exercises;

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final AdminUnitStatusEnum? status;

  @JsonKey(name: r'isTrial', required: false, includeIfNull: false)
  final bool? isTrial;

  @JsonKey(name: r'updatedAt', required: false, includeIfNull: false)
  final DateTime? updatedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUnit &&
          other.kind == kind &&
          other.title == title &&
          other.level == level &&
          other.goalTags == goalTags &&
          other.topicId == topicId &&
          other.difficulty == difficulty &&
          other.tier == tier &&
          other.estMinutes == estMinutes &&
          other.sequence == sequence &&
          other.items == items &&
          other.exercises == exercises &&
          other.id == id &&
          other.status == status &&
          other.isTrial == isTrial &&
          other.updatedAt == updatedAt;

  @override
  int get hashCode =>
      kind.hashCode +
      title.hashCode +
      level.hashCode +
      goalTags.hashCode +
      topicId.hashCode +
      difficulty.hashCode +
      tier.hashCode +
      estMinutes.hashCode +
      sequence.hashCode +
      items.hashCode +
      exercises.hashCode +
      id.hashCode +
      status.hashCode +
      isTrial.hashCode +
      updatedAt.hashCode;

  factory AdminUnit.fromJson(Map<String, dynamic> json) =>
      _$AdminUnitFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUnitToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// `foundation` = nền tảng người mới, chỉ hợp lệ với level N5
enum AdminUnitTierEnum {
  @JsonValue(r'foundation')
  foundation(r'foundation'),
  @JsonValue(r'core')
  core(r'core');

  const AdminUnitTierEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum AdminUnitEstMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15');

  const AdminUnitEstMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum AdminUnitStatusEnum {
  @JsonValue(r'draft')
  draft(r'draft'),
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'inactive')
  inactive(r'inactive');

  const AdminUnitStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
