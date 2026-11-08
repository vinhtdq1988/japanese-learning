//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail_assignment_states_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetailAssignmentStatesInner {
  /// Returns a new [ClassLearnerDetailAssignmentStatesInner] instance.
  ClassLearnerDetailAssignmentStatesInner({
    required this.assignmentId,

    required this.state,
  });

  @JsonKey(name: r'assignmentId', required: true, includeIfNull: false)
  final String assignmentId;

  @JsonKey(name: r'state', required: true, includeIfNull: false)
  final ClassLearnerDetailAssignmentStatesInnerStateEnum state;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerDetailAssignmentStatesInner &&
          other.assignmentId == assignmentId &&
          other.state == state;

  @override
  int get hashCode => assignmentId.hashCode + state.hashCode;

  factory ClassLearnerDetailAssignmentStatesInner.fromJson(
    Map<String, dynamic> json,
  ) => _$ClassLearnerDetailAssignmentStatesInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$ClassLearnerDetailAssignmentStatesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassLearnerDetailAssignmentStatesInnerStateEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'on_time')
  onTime(r'on_time'),
  @JsonValue(r'late')
  late_(r'late'),
  @JsonValue(r'overdue')
  overdue(r'overdue');

  const ClassLearnerDetailAssignmentStatesInnerStateEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
