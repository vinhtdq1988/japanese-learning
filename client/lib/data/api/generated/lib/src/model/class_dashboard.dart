//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_learner_row.dart';
import 'package:japanese_api/src/model/content_notice.dart';
import 'package:japanese_api/src/model/class_dashboard_summary.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_dashboard.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassDashboard {
  /// Returns a new [ClassDashboard] instance.
  ClassDashboard({
    required this.classId,

    required this.learners,

    required this.summary,

    required this.contentNotices,

    this.teacherlessWarning,
  });

  @JsonKey(name: r'classId', required: true, includeIfNull: false)
  final String classId;

  @JsonKey(name: r'learners', required: true, includeIfNull: false)
  final List<ClassLearnerRow> learners;

  @JsonKey(name: r'summary', required: true, includeIfNull: false)
  final ClassDashboardSummary summary;

  @JsonKey(name: r'contentNotices', required: true, includeIfNull: false)
  final List<ContentNotice> contentNotices;

  @JsonKey(name: r'teacherlessWarning', required: false, includeIfNull: false)
  final bool? teacherlessWarning;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassDashboard &&
          other.classId == classId &&
          other.learners == learners &&
          other.summary == summary &&
          other.contentNotices == contentNotices &&
          other.teacherlessWarning == teacherlessWarning;

  @override
  int get hashCode =>
      classId.hashCode +
      learners.hashCode +
      summary.hashCode +
      contentNotices.hashCode +
      teacherlessWarning.hashCode;

  factory ClassDashboard.fromJson(Map<String, dynamic> json) =>
      _$ClassDashboardFromJson(json);

  Map<String, dynamic> toJson() => _$ClassDashboardToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
