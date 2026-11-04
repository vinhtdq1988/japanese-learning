//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'lesson_session_answered_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LessonSessionAnsweredInner {
  /// Returns a new [LessonSessionAnsweredInner] instance.
  LessonSessionAnsweredInner({this.exerciseId, this.isCorrect});

  @JsonKey(name: r'exerciseId', required: false, includeIfNull: false)
  final String? exerciseId;

  @JsonKey(name: r'isCorrect', required: false, includeIfNull: false)
  final bool? isCorrect;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LessonSessionAnsweredInner &&
          other.exerciseId == exerciseId &&
          other.isCorrect == isCorrect;

  @override
  int get hashCode => exerciseId.hashCode + isCorrect.hashCode;

  factory LessonSessionAnsweredInner.fromJson(Map<String, dynamic> json) =>
      _$LessonSessionAnsweredInnerFromJson(json);

  Map<String, dynamic> toJson() => _$LessonSessionAnsweredInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
