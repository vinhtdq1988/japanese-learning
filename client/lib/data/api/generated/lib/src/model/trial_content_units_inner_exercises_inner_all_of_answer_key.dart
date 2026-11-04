//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'trial_content_units_inner_exercises_inner_all_of_answer_key.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TrialContentUnitsInnerExercisesInnerAllOfAnswerKey {
  /// Returns a new [TrialContentUnitsInnerExercisesInnerAllOfAnswerKey] instance.
  TrialContentUnitsInnerExercisesInnerAllOfAnswerKey({
    this.correctIndex,

    this.pairs,

    this.acceptedAnswers,
  });

  @JsonKey(name: r'correctIndex', required: false, includeIfNull: false)
  final int? correctIndex;

  @JsonKey(name: r'pairs', required: false, includeIfNull: false)
  final List<List<String>>? pairs;

  @JsonKey(name: r'acceptedAnswers', required: false, includeIfNull: false)
  final List<String>? acceptedAnswers;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TrialContentUnitsInnerExercisesInnerAllOfAnswerKey &&
          other.correctIndex == correctIndex &&
          other.pairs == pairs &&
          other.acceptedAnswers == acceptedAnswers;

  @override
  int get hashCode =>
      correctIndex.hashCode + pairs.hashCode + acceptedAnswers.hashCode;

  factory TrialContentUnitsInnerExercisesInnerAllOfAnswerKey.fromJson(
    Map<String, dynamic> json,
  ) => _$TrialContentUnitsInnerExercisesInnerAllOfAnswerKeyFromJson(json);

  Map<String, dynamic> toJson() =>
      _$TrialContentUnitsInnerExercisesInnerAllOfAnswerKeyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
