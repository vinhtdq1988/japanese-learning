//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_learner_row.dart';
import 'package:japanese_api/src/model/class_learner_detail_weak_topics_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_units_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_assignment_states_inner.dart';
import 'package:japanese_api/src/model/class_learner_detail_placement.dart';
import 'package:japanese_api/src/model/class_learner_detail_daily_minutes30_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetail {
  /// Returns a new [ClassLearnerDetail] instance.
  ClassLearnerDetail({
    required this.userId,

    required this.displayName,

    required this.row,

    required this.units,

    required this.dailyMinutes30,

    this.reviewAccuracy,

    required this.weakTopics,

    this.placement,

    required this.assignmentStates,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'row', required: true, includeIfNull: false)
  final ClassLearnerRow row;

  @JsonKey(name: r'units', required: true, includeIfNull: false)
  final List<ClassLearnerDetailUnitsInner> units;

  @JsonKey(name: r'dailyMinutes30', required: true, includeIfNull: false)
  final List<ClassLearnerDetailDailyMinutes30Inner> dailyMinutes30;

  @JsonKey(name: r'reviewAccuracy', required: false, includeIfNull: false)
  final num? reviewAccuracy;

  @JsonKey(name: r'weakTopics', required: true, includeIfNull: false)
  final List<ClassLearnerDetailWeakTopicsInner> weakTopics;

  @JsonKey(name: r'placement', required: false, includeIfNull: false)
  final ClassLearnerDetailPlacement? placement;

  @JsonKey(name: r'assignmentStates', required: true, includeIfNull: false)
  final List<ClassLearnerDetailAssignmentStatesInner> assignmentStates;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerDetail &&
          other.userId == userId &&
          other.displayName == displayName &&
          other.row == row &&
          other.units == units &&
          other.dailyMinutes30 == dailyMinutes30 &&
          other.reviewAccuracy == reviewAccuracy &&
          other.weakTopics == weakTopics &&
          other.placement == placement &&
          other.assignmentStates == assignmentStates;

  @override
  int get hashCode =>
      userId.hashCode +
      displayName.hashCode +
      row.hashCode +
      units.hashCode +
      dailyMinutes30.hashCode +
      (reviewAccuracy == null ? 0 : reviewAccuracy.hashCode) +
      weakTopics.hashCode +
      (placement == null ? 0 : placement.hashCode) +
      assignmentStates.hashCode;

  factory ClassLearnerDetail.fromJson(Map<String, dynamic> json) =>
      _$ClassLearnerDetailFromJson(json);

  Map<String, dynamic> toJson() => _$ClassLearnerDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
