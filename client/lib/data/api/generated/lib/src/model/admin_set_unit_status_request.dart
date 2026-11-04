//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_set_unit_status_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminSetUnitStatusRequest {
  /// Returns a new [AdminSetUnitStatusRequest] instance.
  AdminSetUnitStatusRequest({this.status, this.isTrial});

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final AdminSetUnitStatusRequestStatusEnum? status;

  @JsonKey(name: r'isTrial', required: false, includeIfNull: false)
  final bool? isTrial;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminSetUnitStatusRequest &&
          other.status == status &&
          other.isTrial == isTrial;

  @override
  int get hashCode => status.hashCode + isTrial.hashCode;

  factory AdminSetUnitStatusRequest.fromJson(Map<String, dynamic> json) =>
      _$AdminSetUnitStatusRequestFromJson(json);

  Map<String, dynamic> toJson() => _$AdminSetUnitStatusRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminSetUnitStatusRequestStatusEnum {
  @JsonValue(r'draft')
  draft(r'draft'),
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'inactive')
  inactive(r'inactive');

  const AdminSetUnitStatusRequestStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
