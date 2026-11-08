//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/class_row_teachers_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_weak_topic.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassWeakTopic {
  /// Returns a new [ClassWeakTopic] instance.
  ClassWeakTopic({
    required this.topicId,

    required this.name,

    required this.skill,

    required this.accuracy,

    required this.answers,

    required this.flaggedLearners,
  });

  @JsonKey(name: r'topicId', required: true, includeIfNull: false)
  final String topicId;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'skill', required: true, includeIfNull: false)
  final Skill skill;

  @JsonKey(name: r'accuracy', required: true, includeIfNull: false)
  final num accuracy;

  @JsonKey(name: r'answers', required: true, includeIfNull: false)
  final int answers;

  @JsonKey(name: r'flaggedLearners', required: true, includeIfNull: false)
  final List<ClassRowTeachersInner> flaggedLearners;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassWeakTopic &&
          other.topicId == topicId &&
          other.name == name &&
          other.skill == skill &&
          other.accuracy == accuracy &&
          other.answers == answers &&
          other.flaggedLearners == flaggedLearners;

  @override
  int get hashCode =>
      topicId.hashCode +
      name.hashCode +
      skill.hashCode +
      accuracy.hashCode +
      answers.hashCode +
      flaggedLearners.hashCode;

  factory ClassWeakTopic.fromJson(Map<String, dynamic> json) =>
      _$ClassWeakTopicFromJson(json);

  Map<String, dynamic> toJson() => _$ClassWeakTopicToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
