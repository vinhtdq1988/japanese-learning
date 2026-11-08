//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_class_assignments_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyClassAssignmentsInner {
  /// Returns a new [MyClassAssignmentsInner] instance.
  MyClassAssignmentsInner({
    required this.id,

    required this.batchId,

    required this.unitId,

    required this.title,

    required this.dueOn,

    required this.state,
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

  @JsonKey(name: r'state', required: true, includeIfNull: false)
  final MyClassAssignmentsInnerStateEnum state;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyClassAssignmentsInner &&
          other.id == id &&
          other.batchId == batchId &&
          other.unitId == unitId &&
          other.title == title &&
          other.dueOn == dueOn &&
          other.state == state;

  @override
  int get hashCode =>
      id.hashCode +
      batchId.hashCode +
      unitId.hashCode +
      title.hashCode +
      dueOn.hashCode +
      state.hashCode;

  factory MyClassAssignmentsInner.fromJson(Map<String, dynamic> json) =>
      _$MyClassAssignmentsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$MyClassAssignmentsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum MyClassAssignmentsInnerStateEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'on_time')
  onTime(r'on_time'),
  @JsonValue(r'late')
  late_(r'late'),
  @JsonValue(r'overdue')
  overdue(r'overdue');

  const MyClassAssignmentsInnerStateEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
