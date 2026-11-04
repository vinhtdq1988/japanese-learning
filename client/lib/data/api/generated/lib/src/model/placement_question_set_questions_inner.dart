//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'placement_question_set_questions_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlacementQuestionSetQuestionsInner {
  /// Returns a new [PlacementQuestionSetQuestionsInner] instance.
  PlacementQuestionSetQuestionsInner({
    this.id,

    this.skill,

    this.prompt,

    this.choices,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'skill', required: false, includeIfNull: false)
  final Skill? skill;

  @JsonKey(name: r'prompt', required: false, includeIfNull: false)
  final String? prompt;

  @JsonKey(name: r'choices', required: false, includeIfNull: false)
  final List<String>? choices;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlacementQuestionSetQuestionsInner &&
          other.id == id &&
          other.skill == skill &&
          other.prompt == prompt &&
          other.choices == choices;

  @override
  int get hashCode =>
      id.hashCode + skill.hashCode + prompt.hashCode + choices.hashCode;

  factory PlacementQuestionSetQuestionsInner.fromJson(
    Map<String, dynamic> json,
  ) => _$PlacementQuestionSetQuestionsInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$PlacementQuestionSetQuestionsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
