//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_level.dart';
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_topic.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminTopic {
  /// Returns a new [AdminTopic] instance.
  AdminTopic({
    required this.id,

    required this.skill,

    required this.level,

    required this.name,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'skill', required: true, includeIfNull: false)
  final Skill skill;

  @JsonKey(name: r'level', required: true, includeIfNull: false)
  final ContentLevel level;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final I18nText name;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminTopic &&
          other.id == id &&
          other.skill == skill &&
          other.level == level &&
          other.name == name;

  @override
  int get hashCode =>
      id.hashCode + skill.hashCode + level.hashCode + name.hashCode;

  factory AdminTopic.fromJson(Map<String, dynamic> json) =>
      _$AdminTopicFromJson(json);

  Map<String, dynamic> toJson() => _$AdminTopicToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
