//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_class_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeClassSummary {
  /// Returns a new [MeClassSummary] instance.
  MeClassSummary({
    required this.classId,

    required this.className,

    required this.organizationName,

    required this.lockedFields,
  });

  @JsonKey(name: r'classId', required: true, includeIfNull: false)
  final String classId;

  @JsonKey(name: r'className', required: true, includeIfNull: false)
  final String className;

  @JsonKey(name: r'organizationName', required: true, includeIfNull: false)
  final String organizationName;

  /// Trường hồ sơ/điều khiển bị khóa - client hiển thị khóa kèm lý do (FR-018)
  @JsonKey(name: r'lockedFields', required: true, includeIfNull: false)
  final List<String> lockedFields;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeClassSummary &&
          other.classId == classId &&
          other.className == className &&
          other.organizationName == organizationName &&
          other.lockedFields == lockedFields;

  @override
  int get hashCode =>
      classId.hashCode +
      className.hashCode +
      organizationName.hashCode +
      lockedFields.hashCode;

  factory MeClassSummary.fromJson(Map<String, dynamic> json) =>
      _$MeClassSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$MeClassSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
