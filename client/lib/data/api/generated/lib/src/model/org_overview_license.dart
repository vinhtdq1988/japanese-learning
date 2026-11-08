//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/license_state.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'org_overview_license.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OrgOverviewLicense {
  /// Returns a new [OrgOverviewLicense] instance.
  OrgOverviewLicense({
    this.startsOn,

    this.endsOn,

    this.graceEndsOn,

    this.state,
  });

  @JsonKey(name: r'startsOn', required: false, includeIfNull: false)
  final DateTime? startsOn;

  @JsonKey(name: r'endsOn', required: false, includeIfNull: false)
  final DateTime? endsOn;

  @JsonKey(name: r'graceEndsOn', required: false, includeIfNull: false)
  final DateTime? graceEndsOn;

  @JsonKey(name: r'state', required: false, includeIfNull: false)
  final LicenseState? state;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrgOverviewLicense &&
          other.startsOn == startsOn &&
          other.endsOn == endsOn &&
          other.graceEndsOn == graceEndsOn &&
          other.state == state;

  @override
  int get hashCode =>
      startsOn.hashCode +
      endsOn.hashCode +
      graceEndsOn.hashCode +
      state.hashCode;

  factory OrgOverviewLicense.fromJson(Map<String, dynamic> json) =>
      _$OrgOverviewLicenseFromJson(json);

  Map<String, dynamic> toJson() => _$OrgOverviewLicenseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
