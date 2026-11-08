//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_assignment.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassAssignment {
  /// Returns a new [ClassAssignment] instance.
  ClassAssignment({
    required this.id,

    required this.batchId,

    required this.unitId,

    required this.title,

    required this.dueOn,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'batchId', required: true, includeIfNull: false)
  final String batchId;

  @JsonKey(name: r'unitId', required: true, includeIfNull: false)
  final String unitId;

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  @JsonKey(name: r'dueOn', required: true, includeIfNull: false)
  final DateTime dueOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassAssignment &&
          other.id == id &&
          other.batchId == batchId &&
          other.unitId == unitId &&
          other.title == title &&
          other.dueOn == dueOn;

  @override
  int get hashCode =>
      id.hashCode +
      batchId.hashCode +
      unitId.hashCode +
      title.hashCode +
      dueOn.hashCode;

  factory ClassAssignment.fromJson(Map<String, dynamic> json) =>
      _$ClassAssignmentFromJson(json);

  Map<String, dynamic> toJson() => _$ClassAssignmentToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
