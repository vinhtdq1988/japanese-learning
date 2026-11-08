//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'update_class_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateClassRequest {
  /// Returns a new [UpdateClassRequest] instance.
  UpdateClassRequest({this.name, this.description, this.absenceThresholdDays});

  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(name: r'description', required: false, includeIfNull: false)
  final String? description;

  // minimum: 1
  // maximum: 14
  @JsonKey(name: r'absenceThresholdDays', required: false, includeIfNull: false)
  final int? absenceThresholdDays;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UpdateClassRequest &&
          other.name == name &&
          other.description == description &&
          other.absenceThresholdDays == absenceThresholdDays;

  @override
  int get hashCode =>
      name.hashCode +
      (description == null ? 0 : description.hashCode) +
      absenceThresholdDays.hashCode;

  factory UpdateClassRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateClassRequestFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateClassRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
