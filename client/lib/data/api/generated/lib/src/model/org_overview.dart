//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/org_overview_teachers_inner.dart';
import 'package:japanese_api/src/model/invitation_row.dart';
import 'package:japanese_api/src/model/org_overview_license.dart';
import 'package:japanese_api/src/model/org_status.dart';
import 'package:japanese_api/src/model/seat_summary.dart';
import 'package:japanese_api/src/model/class_row.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'org_overview.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OrgOverview {
  /// Returns a new [OrgOverview] instance.
  OrgOverview({
    required this.id,

    required this.name,

    required this.status,

    required this.seats,

    this.license,

    required this.teachers,

    required this.classes,

    required this.pendingInvitations,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final OrgStatus status;

  @JsonKey(name: r'seats', required: true, includeIfNull: false)
  final SeatSummary seats;

  @JsonKey(name: r'license', required: false, includeIfNull: false)
  final OrgOverviewLicense? license;

  @JsonKey(name: r'teachers', required: true, includeIfNull: false)
  final List<OrgOverviewTeachersInner> teachers;

  @JsonKey(name: r'classes', required: true, includeIfNull: false)
  final List<ClassRow> classes;

  @JsonKey(name: r'pendingInvitations', required: true, includeIfNull: false)
  final List<InvitationRow> pendingInvitations;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrgOverview &&
          other.id == id &&
          other.name == name &&
          other.status == status &&
          other.seats == seats &&
          other.license == license &&
          other.teachers == teachers &&
          other.classes == classes &&
          other.pendingInvitations == pendingInvitations;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      status.hashCode +
      seats.hashCode +
      (license == null ? 0 : license.hashCode) +
      teachers.hashCode +
      classes.hashCode +
      pendingInvitations.hashCode;

  factory OrgOverview.fromJson(Map<String, dynamic> json) =>
      _$OrgOverviewFromJson(json);

  Map<String, dynamic> toJson() => _$OrgOverviewToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
