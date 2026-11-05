//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_weak_topics_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryWeakTopicsInner {
  /// Returns a new [ProgressSummaryWeakTopicsInner] instance.
  ProgressSummaryWeakTopicsInner({
    this.topicId,

    this.skill,

    this.name,

    this.accuracy,
  });

  @JsonKey(name: r'topicId', required: false, includeIfNull: false)
  final String? topicId;

  @JsonKey(name: r'skill', required: false, includeIfNull: false)
  final Skill? skill;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(name: r'accuracy', required: false, includeIfNull: false)
  final num? accuracy;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProgressSummaryWeakTopicsInner &&
          other.topicId == topicId &&
          other.skill == skill &&
          other.name == name &&
          other.accuracy == accuracy;

  @override
  int get hashCode =>
      topicId.hashCode + skill.hashCode + name.hashCode + accuracy.hashCode;

  factory ProgressSummaryWeakTopicsInner.fromJson(Map<String, dynamic> json) =>
      _$ProgressSummaryWeakTopicsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryWeakTopicsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
