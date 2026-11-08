//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/put_class_path_units_request_units_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'put_class_path_units_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PutClassPathUnitsRequest {
  /// Returns a new [PutClassPathUnitsRequest] instance.
  PutClassPathUnitsRequest({required this.units});

  @JsonKey(name: r'units', required: true, includeIfNull: false)
  final List<PutClassPathUnitsRequestUnitsInner> units;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PutClassPathUnitsRequest && other.units == units;

  @override
  int get hashCode => units.hashCode;

  factory PutClassPathUnitsRequest.fromJson(Map<String, dynamic> json) =>
      _$PutClassPathUnitsRequestFromJson(json);

  Map<String, dynamic> toJson() => _$PutClassPathUnitsRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
