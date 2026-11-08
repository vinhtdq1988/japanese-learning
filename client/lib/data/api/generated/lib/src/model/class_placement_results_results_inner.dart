//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_placement_results_results_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPlacementResultsResultsInner {
  /// Returns a new [ClassPlacementResultsResultsInner] instance.
  ClassPlacementResultsResultsInner({
    required this.userId,

    required this.displayName,

    required this.status,

    this.estimatedLevel,

    this.score,

    this.total,

    this.takenAt,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final ClassPlacementResultsResultsInnerStatusEnum status;

  @JsonKey(name: r'estimatedLevel', required: false, includeIfNull: false)
  final Level? estimatedLevel;

  @JsonKey(name: r'score', required: false, includeIfNull: false)
  final int? score;

  @JsonKey(name: r'total', required: false, includeIfNull: false)
  final int? total;

  @JsonKey(name: r'takenAt', required: false, includeIfNull: false)
  final DateTime? takenAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPlacementResultsResultsInner &&
          other.userId == userId &&
          other.displayName == displayName &&
          other.status == status &&
          other.estimatedLevel == estimatedLevel &&
          other.score == score &&
          other.total == total &&
          other.takenAt == takenAt;

  @override
  int get hashCode =>
      userId.hashCode +
      displayName.hashCode +
      status.hashCode +
      estimatedLevel.hashCode +
      score.hashCode +
      total.hashCode +
      takenAt.hashCode;

  factory ClassPlacementResultsResultsInner.fromJson(
    Map<String, dynamic> json,
  ) => _$ClassPlacementResultsResultsInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$ClassPlacementResultsResultsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ClassPlacementResultsResultsInnerStatusEnum {
  @JsonValue(r'done')
  done(r'done'),
  @JsonValue(r'pending')
  pending(r'pending');

  const ClassPlacementResultsResultsInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
