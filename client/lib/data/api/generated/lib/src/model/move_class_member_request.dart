//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'move_class_member_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MoveClassMemberRequest {
  /// Returns a new [MoveClassMemberRequest] instance.
  MoveClassMemberRequest({required this.toClassId});

  @JsonKey(name: r'toClassId', required: true, includeIfNull: false)
  final String toClassId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MoveClassMemberRequest && other.toClassId == toClassId;

  @override
  int get hashCode => toClassId.hashCode;

  factory MoveClassMemberRequest.fromJson(Map<String, dynamic> json) =>
      _$MoveClassMemberRequestFromJson(json);

  Map<String, dynamic> toJson() => _$MoveClassMemberRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
