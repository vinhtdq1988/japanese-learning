//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'kanji_details_write.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class KanjiDetailsWrite {
  /// Returns a new [KanjiDetailsWrite] instance.
  KanjiDetailsWrite({
    required this.onReadings,

    required this.kunReadings,

    required this.strokeCount,

    this.components,
  });

  @JsonKey(name: r'onReadings', required: true, includeIfNull: false)
  final List<String> onReadings;

  @JsonKey(name: r'kunReadings', required: true, includeIfNull: false)
  final List<String> kunReadings;

  // minimum: 1
  // maximum: 30
  @JsonKey(name: r'strokeCount', required: true, includeIfNull: false)
  final int strokeCount;

  @JsonKey(name: r'components', required: false, includeIfNull: false)
  final I18nText? components;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is KanjiDetailsWrite &&
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

  factory KanjiDetailsWrite.fromJson(Map<String, dynamic> json) =>
      _$KanjiDetailsWriteFromJson(json);

  Map<String, dynamic> toJson() => _$KanjiDetailsWriteToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
