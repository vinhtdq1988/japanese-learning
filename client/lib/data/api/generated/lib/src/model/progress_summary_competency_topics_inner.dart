//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/competency_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_competency_topics_inner.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryCompetencyTopicsInner {
  /// Returns a new [ProgressSummaryCompetencyTopicsInner] instance.
  ProgressSummaryCompetencyTopicsInner({

    required  this.topicId,

    required  this.skill,

    required  this.level,

    required  this.answered,

     this.accuracy,
  });

  @JsonKey(
    
    name: r'topicId',
    required: true,
    includeIfNull: false,
  )


  final String topicId;



  @JsonKey(
    
    name: r'skill',
    required: true,
    includeIfNull: false,
  )


  final Skill skill;



  @JsonKey(
    
    name: r'level',
    required: true,
    includeIfNull: false,
  )


  final CompetencyLevel level;



          // minimum: 0
  @JsonKey(
    
    name: r'answered',
    required: true,
    includeIfNull: false,
  )


  final int answered;



          // minimum: 0
          // maximum: 1
  @JsonKey(
    
    name: r'accuracy',
    required: false,
    includeIfNull: false,
  )


  final num? accuracy;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ProgressSummaryCompetencyTopicsInner &&
      other.topicId == topicId &&
      other.skill == skill &&
      other.level == level &&
      other.answered == answered &&
      other.accuracy == accuracy;

    @override
    int get hashCode =>
        topicId.hashCode +
        skill.hashCode +
        level.hashCode +
        answered.hashCode +
        (accuracy == null ? 0 : accuracy.hashCode);

  factory ProgressSummaryCompetencyTopicsInner.fromJson(Map<String, dynamic> json) => _$ProgressSummaryCompetencyTopicsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryCompetencyTopicsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

