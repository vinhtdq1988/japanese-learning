//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'org_overview_teachers_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OrgOverviewTeachersInner {
  /// Returns a new [OrgOverviewTeachersInner] instance.
  OrgOverviewTeachersInner({
    required this.userId,

    required this.email,

    this.displayName,

    required this.hasSeat,

    this.classIds,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'hasSeat', required: true, includeIfNull: false)
  final bool hasSeat;

  @JsonKey(name: r'classIds', required: false, includeIfNull: false)
  final List<String>? classIds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrgOverviewTeachersInner &&
          other.userId == userId &&
          other.email == email &&
          other.displayName == displayName &&
          other.hasSeat == hasSeat &&
          other.classIds == classIds;

  @override
  int get hashCode =>
      userId.hashCode +
      email.hashCode +
      displayName.hashCode +
      hasSeat.hashCode +
      classIds.hashCode;

  factory OrgOverviewTeachersInner.fromJson(Map<String, dynamic> json) =>
      _$OrgOverviewTeachersInnerFromJson(json);

  Map<String, dynamic> toJson() => _$OrgOverviewTeachersInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
