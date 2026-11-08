//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_class_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateClassRequest {
  /// Returns a new [CreateClassRequest] instance.
  CreateClassRequest({required this.name, this.description, this.teacherIds});

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'description', required: false, includeIfNull: false)
  final String? description;

  @JsonKey(name: r'teacherIds', required: false, includeIfNull: false)
  final List<String>? teacherIds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateClassRequest &&
          other.name == name &&
          other.description == description &&
          other.teacherIds == teacherIds;

  @override
  int get hashCode =>
      name.hashCode +
      (description == null ? 0 : description.hashCode) +
      teacherIds.hashCode;

  factory CreateClassRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateClassRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CreateClassRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
