//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_row_owners_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationRowOwnersInner {
  /// Returns a new [AdminOrganizationRowOwnersInner] instance.
  AdminOrganizationRowOwnersInner({required this.email, required this.status});

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final AdminOrganizationRowOwnersInnerStatusEnum status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationRowOwnersInner &&
          other.email == email &&
          other.status == status;

  @override
  int get hashCode => email.hashCode + status.hashCode;

  factory AdminOrganizationRowOwnersInner.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationRowOwnersInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$AdminOrganizationRowOwnersInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminOrganizationRowOwnersInnerStatusEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'active')
  active(r'active');

  const AdminOrganizationRowOwnersInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
