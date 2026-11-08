//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/license_state.dart';
import 'package:japanese_api/src/model/seat_summary.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'org_license.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OrgLicense {
  /// Returns a new [OrgLicense] instance.
  OrgLicense({
    required this.id,

    required this.startsOn,

    required this.endsOn,

    required this.graceEndsOn,

    required this.graceDays,

    required this.maxReassignments,

    this.revokedAt,

    required this.seats,

    required this.state,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'startsOn', required: true, includeIfNull: false)
  final DateTime startsOn;

  @JsonKey(name: r'endsOn', required: true, includeIfNull: false)
  final DateTime endsOn;

  @JsonKey(name: r'graceEndsOn', required: true, includeIfNull: false)
  final DateTime graceEndsOn;

  // minimum: 0
  // maximum: 60
  @JsonKey(name: r'graceDays', required: true, includeIfNull: false)
  final int graceDays;

  // minimum: 0
  @JsonKey(name: r'maxReassignments', required: true, includeIfNull: false)
  final int maxReassignments;

  @JsonKey(name: r'revokedAt', required: false, includeIfNull: false)
  final DateTime? revokedAt;

  @JsonKey(name: r'seats', required: true, includeIfNull: false)
  final SeatSummary seats;

  @JsonKey(name: r'state', required: true, includeIfNull: false)
  final LicenseState state;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrgLicense &&
          other.id == id &&
          other.startsOn == startsOn &&
          other.endsOn == endsOn &&
          other.graceEndsOn == graceEndsOn &&
          other.graceDays == graceDays &&
          other.maxReassignments == maxReassignments &&
          other.revokedAt == revokedAt &&
          other.seats == seats &&
          other.state == state;

  @override
  int get hashCode =>
      id.hashCode +
      startsOn.hashCode +
      endsOn.hashCode +
      graceEndsOn.hashCode +
      graceDays.hashCode +
      maxReassignments.hashCode +
      (revokedAt == null ? 0 : revokedAt.hashCode) +
      seats.hashCode +
      state.hashCode;

  factory OrgLicense.fromJson(Map<String, dynamic> json) =>
      _$OrgLicenseFromJson(json);

  Map<String, dynamic> toJson() => _$OrgLicenseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
