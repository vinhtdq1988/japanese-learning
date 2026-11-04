//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'placement_result.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlacementResult {
  /// Returns a new [PlacementResult] instance.
  PlacementResult({
    this.id,

    this.estimatedLevel,

    this.score,

    this.total,

    this.strongTopics,

    this.weakTopics,

    this.guessSuspected,
  });

  /// null cho khách (không lưu)
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'estimatedLevel', required: false, includeIfNull: false)
  final Level? estimatedLevel;

  @JsonKey(name: r'score', required: false, includeIfNull: false)
  final int? score;

  @JsonKey(name: r'total', required: false, includeIfNull: false)
  final int? total;

  @JsonKey(name: r'strongTopics', required: false, includeIfNull: false)
  final List<String>? strongTopics;

  @JsonKey(name: r'weakTopics', required: false, includeIfNull: false)
  final List<String>? weakTopics;

  @JsonKey(name: r'guessSuspected', required: false, includeIfNull: false)
  final bool? guessSuspected;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlacementResult &&
          other.id == id &&
          other.estimatedLevel == estimatedLevel &&
          other.score == score &&
          other.total == total &&
          other.strongTopics == strongTopics &&
          other.weakTopics == weakTopics &&
          other.guessSuspected == guessSuspected;

  @override
  int get hashCode =>
      (id == null ? 0 : id.hashCode) +
      estimatedLevel.hashCode +
      score.hashCode +
      total.hashCode +
      strongTopics.hashCode +
      weakTopics.hashCode +
      guessSuspected.hashCode;

  factory PlacementResult.fromJson(Map<String, dynamic> json) =>
      _$PlacementResultFromJson(json);

  Map<String, dynamic> toJson() => _$PlacementResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
