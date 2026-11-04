//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/placement_answers_answers_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'placement_answers.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlacementAnswers {
  /// Returns a new [PlacementAnswers] instance.
  PlacementAnswers({this.durationSeconds, required this.answers});

  @JsonKey(name: r'durationSeconds', required: false, includeIfNull: false)
  final int? durationSeconds;

  @JsonKey(name: r'answers', required: true, includeIfNull: false)
  final List<PlacementAnswersAnswersInner> answers;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlacementAnswers &&
          other.durationSeconds == durationSeconds &&
          other.answers == answers;

  @override
  int get hashCode => durationSeconds.hashCode + answers.hashCode;

  factory PlacementAnswers.fromJson(Map<String, dynamic> json) =>
      _$PlacementAnswersFromJson(json);

  Map<String, dynamic> toJson() => _$PlacementAnswersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
