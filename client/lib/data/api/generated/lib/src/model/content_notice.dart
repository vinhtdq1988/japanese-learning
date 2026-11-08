//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'content_notice.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ContentNotice {
  /// Returns a new [ContentNotice] instance.
  ContentNotice({
    required this.unitId,

    required this.title,

    required this.source_,
  });

  @JsonKey(name: r'unitId', required: true, includeIfNull: false)
  final String unitId;

  @JsonKey(name: r'title', required: true, includeIfNull: false)
  final String title;

  @JsonKey(name: r'source', required: true, includeIfNull: false)
  final ContentNoticeSource_Enum source_;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ContentNotice &&
          other.unitId == unitId &&
          other.title == title &&
          other.source_ == source_;

  @override
  int get hashCode => unitId.hashCode + title.hashCode + source_.hashCode;

  factory ContentNotice.fromJson(Map<String, dynamic> json) =>
      _$ContentNoticeFromJson(json);

  Map<String, dynamic> toJson() => _$ContentNoticeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ContentNoticeSource_Enum {
  @JsonValue(r'path')
  path(r'path'),
  @JsonValue(r'assignment')
  assignment(r'assignment');

  const ContentNoticeSource_Enum(this.value);

  final String value;

  @override
  String toString() => value;
}
