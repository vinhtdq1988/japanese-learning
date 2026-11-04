//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/scope_notice.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'path_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PathSummary {
  /// Returns a new [PathSummary] instance.
  PathSummary({
    this.id,

    this.totalUnits,

    this.completedUnits,

    this.startLevel,

    this.reason,

    this.scopeNotice,

    this.message,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'totalUnits', required: false, includeIfNull: false)
  final int? totalUnits;

  @JsonKey(name: r'completedUnits', required: false, includeIfNull: false)
  final int? completedUnits;

  @JsonKey(name: r'startLevel', required: false, includeIfNull: false)
  final Level? startLevel;

  @JsonKey(name: r'reason', required: false, includeIfNull: false)
  final PathSummaryReasonEnum? reason;

  @JsonKey(name: r'scopeNotice', required: false, includeIfNull: false)
  final ScopeNotice? scopeNotice;

  /// Ví dụ: kỹ năng chưa hỗ trợ trong phiên bản này
  @JsonKey(name: r'message', required: false, includeIfNull: false)
  final String? message;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PathSummary &&
          other.id == id &&
          other.totalUnits == totalUnits &&
          other.completedUnits == completedUnits &&
          other.startLevel == startLevel &&
          other.reason == reason &&
          other.scopeNotice == scopeNotice &&
          other.message == message;

  @override
  int get hashCode =>
      id.hashCode +
      totalUnits.hashCode +
      completedUnits.hashCode +
      startLevel.hashCode +
      reason.hashCode +
      (scopeNotice == null ? 0 : scopeNotice.hashCode) +
      (message == null ? 0 : message.hashCode);

  factory PathSummary.fromJson(Map<String, dynamic> json) =>
      _$PathSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$PathSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PathSummaryReasonEnum {
  @JsonValue(r'onboarding')
  onboarding(r'onboarding'),
  @JsonValue(r'rebuild_request')
  rebuildRequest(r'rebuild_request'),
  @JsonValue(r'goal_change')
  goalChange(r'goal_change'),
  @JsonValue(r'level_change')
  levelChange(r'level_change'),
  @JsonValue(r'placement_retake')
  placementRetake(r'placement_retake');

  const PathSummaryReasonEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
