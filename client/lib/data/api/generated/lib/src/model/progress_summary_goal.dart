//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/scope_notice.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_goal.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryGoal {
  /// Returns a new [ProgressSummaryGoal] instance.
  ProgressSummaryGoal({
    this.completionRatio,

    this.onTrack,

    this.targetDate,

    this.scopeNotice,
  });

  // minimum: 0
  // maximum: 1
  @JsonKey(name: r'completionRatio', required: false, includeIfNull: false)
  final num? completionRatio;

  @JsonKey(name: r'onTrack', required: false, includeIfNull: false)
  final bool? onTrack;

  @JsonKey(name: r'targetDate', required: false, includeIfNull: false)
  final DateTime? targetDate;

  @JsonKey(name: r'scopeNotice', required: false, includeIfNull: false)
  final ScopeNotice? scopeNotice;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProgressSummaryGoal &&
          other.completionRatio == completionRatio &&
          other.onTrack == onTrack &&
          other.targetDate == targetDate &&
          other.scopeNotice == scopeNotice;

  @override
  int get hashCode =>
      completionRatio.hashCode +
      (onTrack == null ? 0 : onTrack.hashCode) +
      (targetDate == null ? 0 : targetDate.hashCode) +
      (scopeNotice == null ? 0 : scopeNotice.hashCode);

  factory ProgressSummaryGoal.fromJson(Map<String, dynamic> json) =>
      _$ProgressSummaryGoalFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryGoalToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
