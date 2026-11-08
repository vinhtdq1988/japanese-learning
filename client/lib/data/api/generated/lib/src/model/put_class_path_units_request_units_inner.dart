//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'put_class_path_units_request_units_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PutClassPathUnitsRequestUnitsInner {
  /// Returns a new [PutClassPathUnitsRequestUnitsInner] instance.
  PutClassPathUnitsRequestUnitsInner({required this.unitId, this.opensOn});

  @JsonKey(name: r'unitId', required: true, includeIfNull: false)
  final String unitId;

  @JsonKey(name: r'opensOn', required: false, includeIfNull: false)
  final DateTime? opensOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PutClassPathUnitsRequestUnitsInner &&
          other.unitId == unitId &&
          other.opensOn == opensOn;

  @override
  int get hashCode =>
      unitId.hashCode + (opensOn == null ? 0 : opensOn.hashCode);

  factory PutClassPathUnitsRequestUnitsInner.fromJson(
    Map<String, dynamic> json,
  ) => _$PutClassPathUnitsRequestUnitsInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$PutClassPathUnitsRequestUnitsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
