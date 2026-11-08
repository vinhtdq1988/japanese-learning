//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail_weak_topics_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetailWeakTopicsInner {
  /// Returns a new [ClassLearnerDetailWeakTopicsInner] instance.
  ClassLearnerDetailWeakTopicsInner({
    required this.topicId,

    required this.name,

    this.accuracy,

    this.answers,
  });

  @JsonKey(name: r'topicId', required: true, includeIfNull: false)
  final String topicId;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'accuracy', required: false, includeIfNull: false)
  final num? accuracy;

  @JsonKey(name: r'answers', required: false, includeIfNull: false)
  final int? answers;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerDetailWeakTopicsInner &&
          other.topicId == topicId &&
          other.name == name &&
          other.accuracy == accuracy &&
          other.answers == answers;

  @override
  int get hashCode =>
      topicId.hashCode + name.hashCode + accuracy.hashCode + answers.hashCode;

  factory ClassLearnerDetailWeakTopicsInner.fromJson(
    Map<String, dynamic> json,
  ) => _$ClassLearnerDetailWeakTopicsInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$ClassLearnerDetailWeakTopicsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
