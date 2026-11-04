//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/progress_summary_goal.dart';
import 'package:japanese_api/src/model/progress_summary_weak_topics_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummary {
  /// Returns a new [ProgressSummary] instance.
  ProgressSummary({
    this.isEmpty,

    this.totalMinutes,

    this.lessonsCompleted,

    this.reviewAccuracy,

    this.currentStreakDays,

    this.goal,

    this.weakTopics,
  });

  /// true khi chưa có lịch sử (trạng thái trống thân thiện)
  @JsonKey(name: r'isEmpty', required: false, includeIfNull: false)
  final bool? isEmpty;

  @JsonKey(name: r'totalMinutes', required: false, includeIfNull: false)
  final num? totalMinutes;

  @JsonKey(name: r'lessonsCompleted', required: false, includeIfNull: false)
  final int? lessonsCompleted;

  // minimum: 0
  // maximum: 1
  @JsonKey(name: r'reviewAccuracy', required: false, includeIfNull: false)
  final num? reviewAccuracy;

  @JsonKey(name: r'currentStreakDays', required: false, includeIfNull: false)
  final int? currentStreakDays;

  @JsonKey(name: r'goal', required: false, includeIfNull: false)
  final ProgressSummaryGoal? goal;

  @JsonKey(name: r'weakTopics', required: false, includeIfNull: false)
  final List<ProgressSummaryWeakTopicsInner>? weakTopics;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProgressSummary &&
          other.isEmpty == isEmpty &&
          other.totalMinutes == totalMinutes &&
          other.lessonsCompleted == lessonsCompleted &&
          other.reviewAccuracy == reviewAccuracy &&
          other.currentStreakDays == currentStreakDays &&
          other.goal == goal &&
          other.weakTopics == weakTopics;

  @override
  int get hashCode =>
      isEmpty.hashCode +
      totalMinutes.hashCode +
      lessonsCompleted.hashCode +
      (reviewAccuracy == null ? 0 : reviewAccuracy.hashCode) +
      currentStreakDays.hashCode +
      goal.hashCode +
      weakTopics.hashCode;

  factory ProgressSummary.fromJson(Map<String, dynamic> json) =>
      _$ProgressSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
