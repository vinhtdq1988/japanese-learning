//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/license_state.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_row_license.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationRowLicense {
  /// Returns a new [AdminOrganizationRowLicense] instance.
  AdminOrganizationRowLicense({this.endsOn, this.graceEndsOn, this.state});

  @JsonKey(name: r'endsOn', required: false, includeIfNull: false)
  final DateTime? endsOn;

  @JsonKey(name: r'graceEndsOn', required: false, includeIfNull: false)
  final DateTime? graceEndsOn;

  @JsonKey(name: r'state', required: false, includeIfNull: false)
  final LicenseState? state;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationRowLicense &&
          other.endsOn == endsOn &&
          other.graceEndsOn == graceEndsOn &&
          other.state == state;

  @override
  int get hashCode => endsOn.hashCode + graceEndsOn.hashCode + state.hashCode;

  factory AdminOrganizationRowLicense.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationRowLicenseFromJson(json);

  Map<String, dynamic> toJson() => _$AdminOrganizationRowLicenseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
