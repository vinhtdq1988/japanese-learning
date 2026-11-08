//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail_placement.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetailPlacement {
  /// Returns a new [ClassLearnerDetailPlacement] instance.
  ClassLearnerDetailPlacement({
    this.estimatedLevel,

    this.score,

    this.total,

    this.takenAt,
  });

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
      other is ClassLearnerDetailPlacement &&
          other.estimatedLevel == estimatedLevel &&
          other.score == score &&
          other.total == total &&
          other.takenAt == takenAt;

  @override
  int get hashCode =>
      estimatedLevel.hashCode +
      score.hashCode +
      total.hashCode +
      takenAt.hashCode;

  factory ClassLearnerDetailPlacement.fromJson(Map<String, dynamic> json) =>
      _$ClassLearnerDetailPlacementFromJson(json);

  Map<String, dynamic> toJson() => _$ClassLearnerDetailPlacementToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
