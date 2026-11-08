//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/admin_organization_row_license.dart';
import 'package:japanese_api/src/model/admin_organization_row_owners_inner.dart';
import 'package:japanese_api/src/model/org_status.dart';
import 'package:japanese_api/src/model/seat_summary.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_row.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationRow {
  /// Returns a new [AdminOrganizationRow] instance.
  AdminOrganizationRow({
    required this.id,

    required this.name,

    required this.status,

    this.owners,

    required this.seats,

    this.license,

    this.warnings,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final OrgStatus status;

  @JsonKey(name: r'owners', required: false, includeIfNull: false)
  final List<AdminOrganizationRowOwnersInner>? owners;

  @JsonKey(name: r'seats', required: true, includeIfNull: false)
  final SeatSummary seats;

  @JsonKey(name: r'license', required: false, includeIfNull: false)
  final AdminOrganizationRowLicense? license;

  @JsonKey(name: r'warnings', required: false, includeIfNull: false)
  final List<AdminOrganizationRowWarningsEnum>? warnings;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationRow &&
          other.id == id &&
          other.name == name &&
          other.status == status &&
          other.owners == owners &&
          other.seats == seats &&
          other.license == license &&
          other.warnings == warnings;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      status.hashCode +
      owners.hashCode +
      seats.hashCode +
      (license == null ? 0 : license.hashCode) +
      warnings.hashCode;

  factory AdminOrganizationRow.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationRowFromJson(json);

  Map<String, dynamic> toJson() => _$AdminOrganizationRowToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminOrganizationRowWarningsEnum {
  @JsonValue(r'noOwner')
  noOwner(r'noOwner'),
  @JsonValue(r'expiring')
  expiring(r'expiring'),
  @JsonValue(r'inGrace')
  inGrace(r'inGrace'),
  @JsonValue(r'lapsed')
  lapsed(r'lapsed');

  const AdminOrganizationRowWarningsEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
