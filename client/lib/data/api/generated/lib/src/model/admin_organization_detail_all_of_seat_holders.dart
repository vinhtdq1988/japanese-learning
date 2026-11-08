//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_detail_all_of_seat_holders.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationDetailAllOfSeatHolders {
  /// Returns a new [AdminOrganizationDetailAllOfSeatHolders] instance.
  AdminOrganizationDetailAllOfSeatHolders({
    required this.userId,

    required this.email,

    required this.roles,

    this.assignedAt,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'roles', required: true, includeIfNull: false)
  final List<AdminOrganizationDetailAllOfSeatHoldersRolesEnum> roles;

  @JsonKey(name: r'assignedAt', required: false, includeIfNull: false)
  final DateTime? assignedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationDetailAllOfSeatHolders &&
          other.userId == userId &&
          other.email == email &&
          other.roles == roles &&
          other.assignedAt == assignedAt;

  @override
  int get hashCode =>
      userId.hashCode +
      email.hashCode +
      roles.hashCode +
      (assignedAt == null ? 0 : assignedAt.hashCode);

  factory AdminOrganizationDetailAllOfSeatHolders.fromJson(
    Map<String, dynamic> json,
  ) => _$AdminOrganizationDetailAllOfSeatHoldersFromJson(json);

  Map<String, dynamic> toJson() =>
      _$AdminOrganizationDetailAllOfSeatHoldersToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminOrganizationDetailAllOfSeatHoldersRolesEnum {
  @JsonValue(r'teacher')
  teacher(r'teacher'),
  @JsonValue(r'learner')
  learner(r'learner');

  const AdminOrganizationDetailAllOfSeatHoldersRolesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
