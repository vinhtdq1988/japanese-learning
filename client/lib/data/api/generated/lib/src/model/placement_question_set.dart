//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/placement_question_set_questions_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'placement_question_set.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlacementQuestionSet {
  /// Returns a new [PlacementQuestionSet] instance.
  PlacementQuestionSet({this.timeLimitSeconds, this.questions});

  @JsonKey(name: r'timeLimitSeconds', required: false, includeIfNull: false)
  final int? timeLimitSeconds;

  @JsonKey(name: r'questions', required: false, includeIfNull: false)
  final List<PlacementQuestionSetQuestionsInner>? questions;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlacementQuestionSet &&
          other.timeLimitSeconds == timeLimitSeconds &&
          other.questions == questions;

  @override
  int get hashCode => timeLimitSeconds.hashCode + questions.hashCode;

  factory PlacementQuestionSet.fromJson(Map<String, dynamic> json) =>
      _$PlacementQuestionSetFromJson(json);

  Map<String, dynamic> toJson() => _$PlacementQuestionSetToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
