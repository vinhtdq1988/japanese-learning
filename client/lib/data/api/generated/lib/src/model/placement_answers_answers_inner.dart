//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'placement_answers_answers_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlacementAnswersAnswersInner {
  /// Returns a new [PlacementAnswersAnswersInner] instance.
  PlacementAnswersAnswersInner({
    required this.questionId,

    required this.choice,
  });

  @JsonKey(name: r'questionId', required: true, includeIfNull: false)
  final String questionId;

  /// null = bỏ trống
  @JsonKey(name: r'choice', required: true, includeIfNull: true)
  final int? choice;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlacementAnswersAnswersInner &&
          other.questionId == questionId &&
          other.choice == choice;

  @override
  int get hashCode =>
      questionId.hashCode + (choice == null ? 0 : choice.hashCode);

  factory PlacementAnswersAnswersInner.fromJson(Map<String, dynamic> json) =>
      _$PlacementAnswersAnswersInnerFromJson(json);

  Map<String, dynamic> toJson() => _$PlacementAnswersAnswersInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
