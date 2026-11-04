//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_set_user_status_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminSetUserStatusRequest {
  /// Returns a new [AdminSetUserStatusRequest] instance.
  AdminSetUserStatusRequest({required this.status});

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final AdminSetUserStatusRequestStatusEnum status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminSetUserStatusRequest && other.status == status;

  @override
  int get hashCode => status.hashCode;

  factory AdminSetUserStatusRequest.fromJson(Map<String, dynamic> json) =>
      _$AdminSetUserStatusRequestFromJson(json);

  Map<String, dynamic> toJson() => _$AdminSetUserStatusRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminSetUserStatusRequestStatusEnum {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'disabled')
  disabled(r'disabled');

  const AdminSetUserStatusRequestStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
