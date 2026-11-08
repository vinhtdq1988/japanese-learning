//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_dashboard_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassDashboardSummary {
  /// Returns a new [ClassDashboardSummary] instance.
  ClassDashboardSummary({
    required this.learnerCount,

    required this.onTrack,

    required this.behind,

    required this.ahead,

    required this.paused,

    required this.needAttention,

    this.avgCompletionRatio,

    this.avgReviewAccuracy,
  });

  @JsonKey(name: r'learnerCount', required: true, includeIfNull: false)
  final int learnerCount;

  @JsonKey(name: r'onTrack', required: true, includeIfNull: false)
  final int onTrack;

  @JsonKey(name: r'behind', required: true, includeIfNull: false)
  final int behind;

  @JsonKey(name: r'ahead', required: true, includeIfNull: false)
  final int ahead;

  @JsonKey(name: r'paused', required: true, includeIfNull: false)
  final int paused;

  @JsonKey(name: r'needAttention', required: true, includeIfNull: false)
  final int needAttention;

  @JsonKey(name: r'avgCompletionRatio', required: false, includeIfNull: false)
  final num? avgCompletionRatio;

  @JsonKey(name: r'avgReviewAccuracy', required: false, includeIfNull: false)
  final num? avgReviewAccuracy;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassDashboardSummary &&
          other.learnerCount == learnerCount &&
          other.onTrack == onTrack &&
          other.behind == behind &&
          other.ahead == ahead &&
          other.paused == paused &&
          other.needAttention == needAttention &&
          other.avgCompletionRatio == avgCompletionRatio &&
          other.avgReviewAccuracy == avgReviewAccuracy;

  @override
  int get hashCode =>
      learnerCount.hashCode +
      onTrack.hashCode +
      behind.hashCode +
      ahead.hashCode +
      paused.hashCode +
      needAttention.hashCode +
      (avgCompletionRatio == null ? 0 : avgCompletionRatio.hashCode) +
      (avgReviewAccuracy == null ? 0 : avgReviewAccuracy.hashCode);

  factory ClassDashboardSummary.fromJson(Map<String, dynamic> json) =>
      _$ClassDashboardSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$ClassDashboardSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
