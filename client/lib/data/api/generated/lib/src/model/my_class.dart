//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/my_class_placement_request.dart';
import 'package:japanese_api/src/model/learner_override.dart';
import 'package:japanese_api/src/model/my_class_progress.dart';
import 'package:japanese_api/src/model/shared_data_disclosure.dart';
import 'package:japanese_api/src/model/my_class_assignments_inner.dart';
import 'package:japanese_api/src/model/class_brief.dart';
import 'package:japanese_api/src/model/class_path_template.dart';
import 'package:japanese_api/src/model/my_class_moved_notice.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_class.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyClass {
  /// Returns a new [MyClass] instance.
  MyClass({
    required this.class_,

    required this.joinedAt,

    required this.path,

    required this.assignments,

    this.teacherAdjustments,

    this.pausedToday,

    this.movedNotice,

    required this.disclosure,

    required this.progress,

    this.placementRequest,
  });

  @JsonKey(name: r'class', required: true, includeIfNull: false)
  final ClassBrief class_;

  @JsonKey(name: r'joinedAt', required: true, includeIfNull: false)
  final DateTime joinedAt;

  @JsonKey(name: r'path', required: true, includeIfNull: false)
  final ClassPathTemplate path;

  @JsonKey(name: r'assignments', required: true, includeIfNull: false)
  final List<MyClassAssignmentsInner> assignments;

  @JsonKey(name: r'teacherAdjustments', required: false, includeIfNull: false)
  final LearnerOverride? teacherAdjustments;

  @JsonKey(name: r'pausedToday', required: false, includeIfNull: false)
  final bool? pausedToday;

  @JsonKey(name: r'movedNotice', required: false, includeIfNull: false)
  final MyClassMovedNotice? movedNotice;

  @JsonKey(name: r'disclosure', required: true, includeIfNull: false)
  final SharedDataDisclosure disclosure;

  @JsonKey(name: r'progress', required: true, includeIfNull: false)
  final MyClassProgress progress;

  @JsonKey(name: r'placementRequest', required: false, includeIfNull: false)
  final MyClassPlacementRequest? placementRequest;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyClass &&
          other.class_ == class_ &&
          other.joinedAt == joinedAt &&
          other.path == path &&
          other.assignments == assignments &&
          other.teacherAdjustments == teacherAdjustments &&
          other.pausedToday == pausedToday &&
          other.movedNotice == movedNotice &&
          other.disclosure == disclosure &&
          other.progress == progress &&
          other.placementRequest == placementRequest;

  @override
  int get hashCode =>
      class_.hashCode +
      joinedAt.hashCode +
      path.hashCode +
      assignments.hashCode +
      teacherAdjustments.hashCode +
      pausedToday.hashCode +
      (movedNotice == null ? 0 : movedNotice.hashCode) +
      disclosure.hashCode +
      progress.hashCode +
      (placementRequest == null ? 0 : placementRequest.hashCode);

  factory MyClass.fromJson(Map<String, dynamic> json) =>
      _$MyClassFromJson(json);

  Map<String, dynamic> toJson() => _$MyClassToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
