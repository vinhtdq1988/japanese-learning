//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_placement_question.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminPlacementQuestion {
  /// Returns a new [AdminPlacementQuestion] instance.
  AdminPlacementQuestion({
    this.id,

    this.level,

    this.skill,

    this.topicId,

    this.prompt,

    this.choices,

    this.correctChoice,

    this.position,

    this.isActive,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'level', required: false, includeIfNull: false)
  final ContentLevel? level;

  @JsonKey(name: r'skill', required: false, includeIfNull: false)
  final Skill? skill;

  @JsonKey(name: r'topicId', required: false, includeIfNull: false)
  final String? topicId;

  @JsonKey(name: r'prompt', required: false, includeIfNull: false)
  final String? prompt;

  @JsonKey(name: r'choices', required: false, includeIfNull: false)
  final List<String>? choices;

  @JsonKey(name: r'correctChoice', required: false, includeIfNull: false)
  final int? correctChoice;

  @JsonKey(name: r'position', required: false, includeIfNull: false)
  final int? position;

  /// Chỉ đổi qua PUT /admin/placement-questions/active-set
  @JsonKey(name: r'isActive', required: false, includeIfNull: false)
  final bool? isActive;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminPlacementQuestion &&
          other.id == id &&
          other.level == level &&
          other.skill == skill &&
          other.topicId == topicId &&
          other.prompt == prompt &&
          other.choices == choices &&
          other.correctChoice == correctChoice &&
          other.position == position &&
          other.isActive == isActive;

  @override
  int get hashCode =>
      id.hashCode +
      level.hashCode +
      skill.hashCode +
      topicId.hashCode +
      prompt.hashCode +
      choices.hashCode +
      correctChoice.hashCode +
      position.hashCode +
      isActive.hashCode;

  factory AdminPlacementQuestion.fromJson(Map<String, dynamic> json) =>
      _$AdminPlacementQuestionFromJson(json);

  Map<String, dynamic> toJson() => _$AdminPlacementQuestionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
