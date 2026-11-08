//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_class_assignments_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateClassAssignmentsRequest {
  /// Returns a new [CreateClassAssignmentsRequest] instance.
  CreateClassAssignmentsRequest({required this.unitIds, required this.dueOn});

  @JsonKey(name: r'unitIds', required: true, includeIfNull: false)
  final List<String> unitIds;

  @JsonKey(name: r'dueOn', required: true, includeIfNull: false)
  final DateTime dueOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateClassAssignmentsRequest &&
          other.unitIds == unitIds &&
          other.dueOn == dueOn;

  @override
  int get hashCode => unitIds.hashCode + dueOn.hashCode;

  factory CreateClassAssignmentsRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateClassAssignmentsRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CreateClassAssignmentsRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
