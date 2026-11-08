//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/license_write.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_create.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationCreate {
  /// Returns a new [AdminOrganizationCreate] instance.
  AdminOrganizationCreate({
    required this.name,

    required this.ownerEmail,

    this.license,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'ownerEmail', required: true, includeIfNull: false)
  final String ownerEmail;

  @JsonKey(name: r'license', required: false, includeIfNull: false)
  final LicenseWrite? license;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationCreate &&
          other.name == name &&
          other.ownerEmail == ownerEmail &&
          other.license == license;

  @override
  int get hashCode => name.hashCode + ownerEmail.hashCode + license.hashCode;

  factory AdminOrganizationCreate.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationCreateFromJson(json);

  Map<String, dynamic> toJson() => _$AdminOrganizationCreateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
