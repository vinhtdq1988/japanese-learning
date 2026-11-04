//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/lesson_session_answered_inner.dart';
import 'package:japanese_api/src/model/content_item.dart';
import 'package:japanese_api/src/model/exercise.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'lesson_session.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LessonSession {
  /// Returns a new [LessonSession] instance.
  LessonSession({
    this.id,

    this.status,

    this.kind,

    this.title,

    this.items,

    this.exercises,

    this.answered,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final LessonSessionStatusEnum? status;

  @JsonKey(name: r'kind', required: false, includeIfNull: false)
  final LessonSessionKindEnum? kind;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'title', required: false, includeIfNull: false)
  final String? title;

  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<ContentItem>? items;

  @JsonKey(name: r'exercises', required: false, includeIfNull: false)
  final List<Exercise>? exercises;

  @JsonKey(name: r'answered', required: false, includeIfNull: false)
  final List<LessonSessionAnsweredInner>? answered;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LessonSession &&
          other.id == id &&
          other.status == status &&
          other.kind == kind &&
          other.title == title &&
          other.items == items &&
          other.exercises == exercises &&
          other.answered == answered;

  @override
  int get hashCode =>
      id.hashCode +
      status.hashCode +
      kind.hashCode +
      title.hashCode +
      items.hashCode +
      exercises.hashCode +
      answered.hashCode;

  factory LessonSession.fromJson(Map<String, dynamic> json) =>
      _$LessonSessionFromJson(json);

  Map<String, dynamic> toJson() => _$LessonSessionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LessonSessionStatusEnum {
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed');

  const LessonSessionStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum LessonSessionKindEnum {
  @JsonValue(r'new_unit')
  newUnit(r'new_unit'),
  @JsonValue(r'review')
  review(r'review'),
  @JsonValue(r'extra')
  extra(r'extra');

  const LessonSessionKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
