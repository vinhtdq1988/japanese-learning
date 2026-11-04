//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'content_item_examples_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ContentItemExamplesInner {
  /// Returns a new [ContentItemExamplesInner] instance.
  ContentItemExamplesInner({this.ja, this.reading, this.translation});

  @JsonKey(name: r'ja', required: false, includeIfNull: false)
  final String? ja;

  @JsonKey(name: r'reading', required: false, includeIfNull: false)
  final String? reading;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'translation', required: false, includeIfNull: false)
  final String? translation;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ContentItemExamplesInner &&
          other.ja == ja &&
          other.reading == reading &&
          other.translation == translation;

  @override
  int get hashCode =>
      ja.hashCode +
      (reading == null ? 0 : reading.hashCode) +
      translation.hashCode;

  factory ContentItemExamplesInner.fromJson(Map<String, dynamic> json) =>
      _$ContentItemExamplesInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ContentItemExamplesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
