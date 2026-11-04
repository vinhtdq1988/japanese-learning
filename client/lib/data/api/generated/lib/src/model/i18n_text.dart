//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'i18n_text.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class I18nText {
  /// Returns a new [I18nText] instance.
  I18nText({required this.vi, required this.en});

  @JsonKey(name: r'vi', required: true, includeIfNull: false)
  final String vi;

  @JsonKey(name: r'en', required: true, includeIfNull: false)
  final String en;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is I18nText && other.vi == vi && other.en == en;

  @override
  int get hashCode => vi.hashCode + en.hashCode;

  factory I18nText.fromJson(Map<String, dynamic> json) =>
      _$I18nTextFromJson(json);

  Map<String, dynamic> toJson() => _$I18nTextToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
