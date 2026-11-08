//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/org_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_update_organization_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUpdateOrganizationRequest {
  /// Returns a new [AdminUpdateOrganizationRequest] instance.
  AdminUpdateOrganizationRequest({this.name, this.status});

  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final OrgStatus? status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUpdateOrganizationRequest &&
          other.name == name &&
          other.status == status;

  @override
  int get hashCode => name.hashCode + status.hashCode;

  factory AdminUpdateOrganizationRequest.fromJson(Map<String, dynamic> json) =>
      _$AdminUpdateOrganizationRequestFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUpdateOrganizationRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
