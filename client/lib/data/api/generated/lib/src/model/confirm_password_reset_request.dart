//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'confirm_password_reset_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConfirmPasswordResetRequest {
  /// Returns a new [ConfirmPasswordResetRequest] instance.
  ConfirmPasswordResetRequest({required this.token, required this.newPassword});

  @JsonKey(name: r'token', required: true, includeIfNull: false)
  final String token;

  @JsonKey(name: r'newPassword', required: true, includeIfNull: false)
  final String newPassword;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ConfirmPasswordResetRequest &&
          other.token == token &&
          other.newPassword == newPassword;

  @override
  int get hashCode => token.hashCode + newPassword.hashCode;

  factory ConfirmPasswordResetRequest.fromJson(Map<String, dynamic> json) =>
      _$ConfirmPasswordResetRequestFromJson(json);

  Map<String, dynamic> toJson() => _$ConfirmPasswordResetRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
