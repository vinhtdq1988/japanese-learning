//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/me_organization_license.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me_organization.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MeOrganization {
  /// Returns a new [MeOrganization] instance.
  MeOrganization({
    required this.id,

    required this.name,

    required this.roles,

    required this.dataAccess,

    this.license,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'roles', required: true, includeIfNull: false)
  final List<MeOrganizationRolesEnum> roles;

  /// false nếu mất seat/hết hạn: chỉ xem cấu trúc
  @JsonKey(name: r'dataAccess', required: true, includeIfNull: false)
  final bool dataAccess;

  @JsonKey(name: r'license', required: false, includeIfNull: false)
  final MeOrganizationLicense? license;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MeOrganization &&
          other.id == id &&
          other.name == name &&
          other.roles == roles &&
          other.dataAccess == dataAccess &&
          other.license == license;

  @override
  int get hashCode =>
      id.hashCode +
      name.hashCode +
      roles.hashCode +
      dataAccess.hashCode +
      (license == null ? 0 : license.hashCode);

  factory MeOrganization.fromJson(Map<String, dynamic> json) =>
      _$MeOrganizationFromJson(json);

  Map<String, dynamic> toJson() => _$MeOrganizationToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum MeOrganizationRolesEnum {
  @JsonValue(r'owner')
  owner(r'owner'),
  @JsonValue(r'teacher')
  teacher(r'teacher');

  const MeOrganizationRolesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
