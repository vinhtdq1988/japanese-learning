//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_brief_teachers_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassBriefTeachersInner {
  /// Returns a new [ClassBriefTeachersInner] instance.
  ClassBriefTeachersInner({required this.displayName});

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassBriefTeachersInner && other.displayName == displayName;

  @override
  int get hashCode => displayName.hashCode;

  factory ClassBriefTeachersInner.fromJson(Map<String, dynamic> json) =>
      _$ClassBriefTeachersInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ClassBriefTeachersInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
