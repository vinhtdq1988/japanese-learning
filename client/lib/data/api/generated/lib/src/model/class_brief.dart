//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_brief_teachers_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_brief.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassBrief {
  /// Returns a new [ClassBrief] instance.
  ClassBrief({
    required this.id,

    required this.name,

    required this.organizationName,

    required this.teachers,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'organizationName', required: true, includeIfNull: false)
  final String organizationName;

  @JsonKey(name: r'teachers', required: true, includeIfNull: false)
  final List<ClassBriefTeachersInner> teachers;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassBrief &&
          other.id == id &&
          other.name == name &&
          other.organizationName == organizationName &&
          other.teachers == teachers;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      organizationName.hashCode +
      teachers.hashCode;

  factory ClassBrief.fromJson(Map<String, dynamic> json) =>
      _$ClassBriefFromJson(json);

  Map<String, dynamic> toJson() => _$ClassBriefToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
