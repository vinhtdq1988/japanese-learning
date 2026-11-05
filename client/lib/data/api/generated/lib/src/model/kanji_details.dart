//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'kanji_details.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class KanjiDetails {
  /// Returns a new [KanjiDetails] instance.
  KanjiDetails({
    required this.onReadings,

    required this.kunReadings,

    required this.strokeCount,

    this.components,
  });

  /// Âm On (katakana); có thể rỗng
  @JsonKey(name: r'onReadings', required: true, includeIfNull: false)
  final List<String> onReadings;

  /// Âm Kun (hiragana, `.` phân cách okurigana); có thể rỗng. onReadings ∪ kunReadings không rỗng
  @JsonKey(name: r'kunReadings', required: true, includeIfNull: false)
  final List<String> kunReadings;

  // minimum: 1
  // maximum: 30
  @JsonKey(name: r'strokeCount', required: true, includeIfNull: false)
  final int strokeCount;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'components', required: false, includeIfNull: false)
  final String? components;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is KanjiDetails &&
          other.onReadings == onReadings &&
          other.kunReadings == kunReadings &&
          other.strokeCount == strokeCount &&
          other.components == components;

  @override
  int get hashCode =>
      onReadings.hashCode +
      kunReadings.hashCode +
      strokeCount.hashCode +
      (components == null ? 0 : components.hashCode);

  factory KanjiDetails.fromJson(Map<String, dynamic> json) =>
      _$KanjiDetailsFromJson(json);

  Map<String, dynamic> toJson() => _$KanjiDetailsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
