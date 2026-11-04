//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'request_password_reset_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RequestPasswordResetRequest {
  /// Returns a new [RequestPasswordResetRequest] instance.
  RequestPasswordResetRequest({required this.email});

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RequestPasswordResetRequest && other.email == email;

  @override
  int get hashCode => email.hashCode;

  factory RequestPasswordResetRequest.fromJson(Map<String, dynamic> json) =>
      _$RequestPasswordResetRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RequestPasswordResetRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
