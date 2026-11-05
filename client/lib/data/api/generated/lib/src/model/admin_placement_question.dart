//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/content_level.dart';
import 'package:japanese_api/src/model/i18n_text.dart';
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

    required this.level,

    required this.skill,

    required this.topicId,

    required this.prompt,

    this.hint,

    required this.choices,

    required this.correctChoice,

    this.position,

    this.isActive,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'level', required: true, includeIfNull: false)
  final ContentLevel level;

  /// Placement không có Kanji (422 nếu gửi kanji)
  @JsonKey(name: r'skill', required: true, includeIfNull: false)
  final AdminPlacementQuestionSkillEnum skill;

  @JsonKey(name: r'topicId', required: true, includeIfNull: false)
  final String topicId;

  /// Câu hỏi bằng tiếng Nhật
  @JsonKey(name: r'prompt', required: true, includeIfNull: false)
  final String prompt;

  /// Gợi ý song ngữ nối sau câu hỏi (tùy chọn)
  @JsonKey(name: r'hint', required: false, includeIfNull: false)
  final I18nText? hint;

  @JsonKey(name: r'choices', required: true, includeIfNull: false)
  final List<String> choices;

  /// Chỉ số đáp án đúng trong `choices`
  // minimum: 0
  @JsonKey(name: r'correctChoice', required: true, includeIfNull: false)
  final int correctChoice;

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
          other.hint == hint &&
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
      (hint == null ? 0 : hint.hashCode) +
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

/// Placement không có Kanji (422 nếu gửi kanji)
enum AdminPlacementQuestionSkillEnum {
  @JsonValue(r'vocabulary')
  vocabulary(r'vocabulary'),
  @JsonValue(r'grammar')
  grammar(r'grammar');

  const AdminPlacementQuestionSkillEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
