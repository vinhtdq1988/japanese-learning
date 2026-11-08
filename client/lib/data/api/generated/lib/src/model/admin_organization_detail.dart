//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/org_license.dart';
import 'package:japanese_api/src/model/admin_organization_row_license.dart';
import 'package:japanese_api/src/model/admin_organization_row_owners_inner.dart';
import 'package:japanese_api/src/model/admin_organization_detail_all_of_seat_holders.dart';
import 'package:japanese_api/src/model/invitation_row.dart';
import 'package:japanese_api/src/model/org_status.dart';
import 'package:japanese_api/src/model/seat_summary.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_detail.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationDetail {
  /// Returns a new [AdminOrganizationDetail] instance.
  AdminOrganizationDetail({
    required this.id,

    required this.name,

    required this.status,

    this.owners,

    required this.seats,

    this.license,

    this.warnings,

    this.licenses,

    this.seatHolders,

    this.classCount,

    this.pendingInvitations,
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
  final List<AdminOrganizationDetailWarningsEnum>? warnings;

  @JsonKey(name: r'licenses', required: false, includeIfNull: false)
  final List<OrgLicense>? licenses;

  @JsonKey(name: r'seatHolders', required: false, includeIfNull: false)
  final List<AdminOrganizationDetailAllOfSeatHolders>? seatHolders;

  @JsonKey(name: r'classCount', required: false, includeIfNull: false)
  final int? classCount;

  @JsonKey(name: r'pendingInvitations', required: false, includeIfNull: false)
  final List<InvitationRow>? pendingInvitations;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationDetail &&
          other.id == id &&
          other.name == name &&
          other.status == status &&
          other.owners == owners &&
          other.seats == seats &&
          other.license == license &&
          other.warnings == warnings &&
          other.licenses == licenses &&
          other.seatHolders == seatHolders &&
          other.classCount == classCount &&
          other.pendingInvitations == pendingInvitations;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      status.hashCode +
      owners.hashCode +
      seats.hashCode +
      (license == null ? 0 : license.hashCode) +
      warnings.hashCode +
      licenses.hashCode +
      seatHolders.hashCode +
      classCount.hashCode +
      pendingInvitations.hashCode;

  factory AdminOrganizationDetail.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationDetailFromJson(json);

  Map<String, dynamic> toJson() => _$AdminOrganizationDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminOrganizationDetailWarningsEnum {
  @JsonValue(r'noOwner')
  noOwner(r'noOwner'),
  @JsonValue(r'expiring')
  expiring(r'expiring'),
  @JsonValue(r'inGrace')
  inGrace(r'inGrace'),
  @JsonValue(r'lapsed')
  lapsed(r'lapsed');

  const AdminOrganizationDetailWarningsEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
