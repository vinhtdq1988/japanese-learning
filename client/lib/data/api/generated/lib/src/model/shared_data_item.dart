//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'shared_data_item.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SharedDataItem {
  /// Returns a new [SharedDataItem] instance.
  SharedDataItem({required this.code, required this.label});

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final SharedDataItemCodeEnum code;

  /// đã bản địa hóa
  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SharedDataItem && other.code == code && other.label == label;

  @override
  int get hashCode => code.hashCode + label.hashCode;

  factory SharedDataItem.fromJson(Map<String, dynamic> json) =>
      _$SharedDataItemFromJson(json);

  Map<String, dynamic> toJson() => _$SharedDataItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SharedDataItemCodeEnum {
  @JsonValue(r'display_name')
  displayName(r'display_name'),
  @JsonValue(r'email')
  email(r'email'),
  @JsonValue(r'progress')
  progress(r'progress'),
  @JsonValue(r'study_time')
  studyTime(r'study_time'),
  @JsonValue(r'review_accuracy')
  reviewAccuracy(r'review_accuracy'),
  @JsonValue(r'weak_topics')
  weakTopics(r'weak_topics'),
  @JsonValue(r'streak')
  streak(r'streak'),
  @JsonValue(r'assignments')
  assignments(r'assignments'),
  @JsonValue(r'placement_result')
  placementResult(r'placement_result');

  const SharedDataItemCodeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
