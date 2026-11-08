//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/license_state.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_organization_license.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeOrganizationLicense {
  /// Returns a new [MeOrganizationLicense] instance.
  MeOrganizationLicense({
    required this.state,

    required this.endsOn,

    required this.graceEndsOn,
  });

  @JsonKey(name: r'state', required: true, includeIfNull: false)
  final LicenseState state;

  @JsonKey(name: r'endsOn', required: true, includeIfNull: false)
  final DateTime endsOn;

  @JsonKey(name: r'graceEndsOn', required: true, includeIfNull: false)
  final DateTime graceEndsOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeOrganizationLicense &&
          other.state == state &&
          other.endsOn == endsOn &&
          other.graceEndsOn == graceEndsOn;

  @override
  int get hashCode => state.hashCode + endsOn.hashCode + graceEndsOn.hashCode;

  factory MeOrganizationLicense.fromJson(Map<String, dynamic> json) =>
      _$MeOrganizationLicenseFromJson(json);

  Map<String, dynamic> toJson() => _$MeOrganizationLicenseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
