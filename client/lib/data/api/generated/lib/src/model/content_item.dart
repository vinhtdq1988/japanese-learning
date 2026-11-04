//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_item_examples_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'content_item.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ContentItem {
  /// Returns a new [ContentItem] instance.
  ContentItem({
    this.id,

    this.kind,

    this.japanese,

    this.reading,

    this.meaning,

    this.explanation,

    this.examples,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'kind', required: false, includeIfNull: false)
  final Skill? kind;

  @JsonKey(name: r'japanese', required: false, includeIfNull: false)
  final String? japanese;

  @JsonKey(name: r'reading', required: false, includeIfNull: false)
  final String? reading;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'meaning', required: false, includeIfNull: false)
  final String? meaning;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'explanation', required: false, includeIfNull: false)
  final String? explanation;

  @JsonKey(name: r'examples', required: false, includeIfNull: false)
  final List<ContentItemExamplesInner>? examples;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ContentItem &&
          other.id == id &&
          other.kind == kind &&
          other.japanese == japanese &&
          other.reading == reading &&
          other.meaning == meaning &&
          other.explanation == explanation &&
          other.examples == examples;

  @override
  int get hashCode =>
      id.hashCode +
      kind.hashCode +
      japanese.hashCode +
      (reading == null ? 0 : reading.hashCode) +
      meaning.hashCode +
      (explanation == null ? 0 : explanation.hashCode) +
      examples.hashCode;

  factory ContentItem.fromJson(Map<String, dynamic> json) =>
      _$ContentItemFromJson(json);

  Map<String, dynamic> toJson() => _$ContentItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
