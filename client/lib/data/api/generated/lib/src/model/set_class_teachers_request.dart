//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'set_class_teachers_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetClassTeachersRequest {
  /// Returns a new [SetClassTeachersRequest] instance.
  SetClassTeachersRequest({required this.userIds});

  @JsonKey(name: r'userIds', required: true, includeIfNull: false)
  final List<String> userIds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SetClassTeachersRequest && other.userIds == userIds;

  @override
  int get hashCode => userIds.hashCode;

  factory SetClassTeachersRequest.fromJson(Map<String, dynamic> json) =>
      _$SetClassTeachersRequestFromJson(json);

  Map<String, dynamic> toJson() => _$SetClassTeachersRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
