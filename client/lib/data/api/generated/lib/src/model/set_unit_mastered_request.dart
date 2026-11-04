//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'set_unit_mastered_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetUnitMasteredRequest {
  /// Returns a new [SetUnitMasteredRequest] instance.
  SetUnitMasteredRequest({required this.mastered});

  @JsonKey(name: r'mastered', required: true, includeIfNull: false)
  final bool mastered;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SetUnitMasteredRequest && other.mastered == mastered;

  @override
  int get hashCode => mastered.hashCode;

  factory SetUnitMasteredRequest.fromJson(Map<String, dynamic> json) =>
      _$SetUnitMasteredRequestFromJson(json);

  Map<String, dynamic> toJson() => _$SetUnitMasteredRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
