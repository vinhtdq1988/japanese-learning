//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/lang.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'register_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RegisterRequest {
  /// Returns a new [RegisterRequest] instance.
  RegisterRequest({
    required this.email,

    required this.password,

    required this.displayName,

    this.language,

    this.timezone,

    this.fromTrial = false,
  });

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'password', required: true, includeIfNull: false)
  final String password;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'language', required: false, includeIfNull: false)
  final Lang? language;

  @JsonKey(name: r'timezone', required: false, includeIfNull: false)
  final String? timezone;

  /// Đăng ký ngay sau khi dùng thử trên cùng trình duyệt (đo SC-011)
  @JsonKey(
    defaultValue: false,
    name: r'fromTrial',
    required: false,
    includeIfNull: false,
  )
  final bool? fromTrial;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RegisterRequest &&
          other.email == email &&
          other.password == password &&
          other.displayName == displayName &&
          other.language == language &&
          other.timezone == timezone &&
          other.fromTrial == fromTrial;

  @override
  int get hashCode =>
      email.hashCode +
      password.hashCode +
      displayName.hashCode +
      language.hashCode +
      timezone.hashCode +
      fromTrial.hashCode;

  factory RegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$RegisterRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RegisterRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
