//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/study_defaults_items_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'study_defaults.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudyDefaults {
  /// Returns a new [StudyDefaults] instance.
  StudyDefaults({required this.practiceMinDailyMinutes, required this.items});

  /// Quỹ thời gian tối thiểu (phút/ngày) để dùng luyện đọc/viết
  @JsonKey(
    name: r'practiceMinDailyMinutes',
    required: true,
    includeIfNull: false,
  )
  final int practiceMinDailyMinutes;

  /// Một dòng cho mỗi mức 5, 10, 15, 30 theo thứ tự tăng dần
  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<StudyDefaultsItemsInner> items;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StudyDefaults &&
          other.practiceMinDailyMinutes == practiceMinDailyMinutes &&
          other.items == items;

  @override
  int get hashCode => practiceMinDailyMinutes.hashCode + items.hashCode;

  factory StudyDefaults.fromJson(Map<String, dynamic> json) =>
      _$StudyDefaultsFromJson(json);

  Map<String, dynamic> toJson() => _$StudyDefaultsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
