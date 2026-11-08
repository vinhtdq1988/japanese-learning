//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'path_warning.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PathWarning {
  /// Returns a new [PathWarning] instance.
  PathWarning({
    required this.code,

    required this.requiredMinutes,

    required this.capacityMinutes,

    this.assignmentId,
  });

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final PathWarningCodeEnum code;

  @JsonKey(name: r'requiredMinutes', required: true, includeIfNull: false)
  final int requiredMinutes;

  @JsonKey(name: r'capacityMinutes', required: true, includeIfNull: false)
  final int capacityMinutes;

  @JsonKey(name: r'assignmentId', required: false, includeIfNull: false)
  final String? assignmentId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PathWarning &&
          other.code == code &&
          other.requiredMinutes == requiredMinutes &&
          other.capacityMinutes == capacityMinutes &&
          other.assignmentId == assignmentId;

  @override
  int get hashCode =>
      code.hashCode +
      requiredMinutes.hashCode +
      capacityMinutes.hashCode +
      (assignmentId == null ? 0 : assignmentId.hashCode);

  factory PathWarning.fromJson(Map<String, dynamic> json) =>
      _$PathWarningFromJson(json);

  Map<String, dynamic> toJson() => _$PathWarningToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PathWarningCodeEnum {
  @JsonValue(r'over_capacity')
  overCapacity(r'over_capacity');

  const PathWarningCodeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
