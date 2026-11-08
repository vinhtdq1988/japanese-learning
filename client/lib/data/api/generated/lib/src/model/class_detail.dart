//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_row_teachers_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_detail.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassDetail {
  /// Returns a new [ClassDetail] instance.
  ClassDetail({
    required this.id,

    required this.name,

    required this.status,

    required this.memberCount,

    required this.hasPath,

    required this.teachers,

    this.needAttentionCount,

    required this.teacherless,

    this.description,

    this.absenceThresholdDays,

    this.archivedAt,

    this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final ClassDetailStatusEnum status;

  @JsonKey(name: r'memberCount', required: true, includeIfNull: false)
  final int memberCount;

  @JsonKey(name: r'hasPath', required: true, includeIfNull: false)
  final bool hasPath;

  @JsonKey(name: r'teachers', required: true, includeIfNull: false)
  final List<ClassRowTeachersInner> teachers;

  /// Chỉ có khi người gọi có quyền xem dữ liệu học viên
  @JsonKey(name: r'needAttentionCount', required: false, includeIfNull: false)
  final int? needAttentionCount;

  @JsonKey(name: r'teacherless', required: true, includeIfNull: false)
  final bool teacherless;

  @JsonKey(name: r'description', required: false, includeIfNull: false)
  final String? description;

  // minimum: 1
  // maximum: 14
  @JsonKey(name: r'absenceThresholdDays', required: false, includeIfNull: false)
  final int? absenceThresholdDays;

  @JsonKey(name: r'archivedAt', required: false, includeIfNull: false)
  final DateTime? archivedAt;

  @JsonKey(name: r'createdAt', required: false, includeIfNull: false)
  final DateTime? createdAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassDetail &&
          other.id == id &&
          other.name == name &&
          other.status == status &&
          other.memberCount == memberCount &&
          other.hasPath == hasPath &&
          other.teachers == teachers &&
          other.needAttentionCount == needAttentionCount &&
          other.teacherless == teacherless &&
          other.description == description &&
          other.absenceThresholdDays == absenceThresholdDays &&
          other.archivedAt == archivedAt &&
          other.createdAt == createdAt;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      status.hashCode +
      memberCount.hashCode +
      hasPath.hashCode +
      teachers.hashCode +
      needAttentionCount.hashCode +
      teacherless.hashCode +
      (description == null ? 0 : description.hashCode) +
      absenceThresholdDays.hashCode +
      (archivedAt == null ? 0 : archivedAt.hashCode) +
      createdAt.hashCode;

  factory ClassDetail.fromJson(Map<String, dynamic> json) =>
      _$ClassDetailFromJson(json);

  Map<String, dynamic> toJson() => _$ClassDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassDetailStatusEnum {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'archived')
  archived(r'archived');

  const ClassDetailStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
