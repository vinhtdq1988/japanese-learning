//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_row_teachers_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassRowTeachersInner {
  /// Returns a new [ClassRowTeachersInner] instance.
  ClassRowTeachersInner({required this.userId, required this.displayName});

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassRowTeachersInner &&
          other.userId == userId &&
          other.displayName == displayName;

  @override
  int get hashCode => userId.hashCode + displayName.hashCode;

  factory ClassRowTeachersInner.fromJson(Map<String, dynamic> json) =>
      _$ClassRowTeachersInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ClassRowTeachersInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
