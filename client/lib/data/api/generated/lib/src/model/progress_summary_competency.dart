//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/progress_summary_competency_topics_inner.dart';
import 'package:japanese_api/src/model/progress_summary_competency_skills_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_competency.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryCompetency {
  /// Returns a new [ProgressSummaryCompetency] instance.
  ProgressSummaryCompetency({

    required  this.skills,

    required  this.topics,
  });

      /// Mỗi kỹ năng hiệu lực của người học (và kỹ năng đã có dữ liệu), theo thứ tự vocabulary, grammar, kanji, reading, writing
  @JsonKey(
    
    name: r'skills',
    required: true,
    includeIfNull: false,
  )


  final List<ProgressSummaryCompetencySkillsInner> skills;



      /// Mọi chủ đề có dữ liệu; luôn gồm các chủ đề trong `weakTopics`
  @JsonKey(
    
    name: r'topics',
    required: true,
    includeIfNull: false,
  )


  final List<ProgressSummaryCompetencyTopicsInner> topics;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ProgressSummaryCompetency &&
      other.skills == skills &&
      other.topics == topics;

    @override
    int get hashCode =>
        skills.hashCode +
        topics.hashCode;

  factory ProgressSummaryCompetency.fromJson(Map<String, dynamic> json) => _$ProgressSummaryCompetencyFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryCompetencyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

