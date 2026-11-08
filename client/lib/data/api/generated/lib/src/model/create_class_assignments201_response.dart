//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_assignment.dart';
import 'package:japanese_api/src/model/path_warning.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_class_assignments201_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateClassAssignments201Response {
  /// Returns a new [CreateClassAssignments201Response] instance.
  CreateClassAssignments201Response({
    required this.batchId,

    required this.assignments,

    this.warnings,
  });

  @JsonKey(name: r'batchId', required: true, includeIfNull: false)
  final String batchId;

  @JsonKey(name: r'assignments', required: true, includeIfNull: false)
  final List<ClassAssignment> assignments;

  @JsonKey(name: r'warnings', required: false, includeIfNull: false)
  final List<PathWarning>? warnings;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateClassAssignments201Response &&
          other.batchId == batchId &&
          other.assignments == assignments &&
          other.warnings == warnings;

  @override
  int get hashCode =>
      batchId.hashCode + assignments.hashCode + warnings.hashCode;

  factory CreateClassAssignments201Response.fromJson(
    Map<String, dynamic> json,
  ) => _$CreateClassAssignments201ResponseFromJson(json);

  Map<String, dynamic> toJson() =>
      _$CreateClassAssignments201ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
