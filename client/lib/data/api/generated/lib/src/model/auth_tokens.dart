//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'auth_tokens.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthTokens {
  /// Returns a new [AuthTokens] instance.
  AuthTokens({
    required this.accessToken,

    required this.refreshToken,

    required this.expiresIn,
  });

  @JsonKey(name: r'accessToken', required: true, includeIfNull: false)
  final String accessToken;

  @JsonKey(name: r'refreshToken', required: true, includeIfNull: false)
  final String refreshToken;

  /// Số giây hiệu lực của access token
  @JsonKey(name: r'expiresIn', required: true, includeIfNull: false)
  final int expiresIn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthTokens &&
          other.accessToken == accessToken &&
          other.refreshToken == refreshToken &&
          other.expiresIn == expiresIn;

  @override
  int get hashCode =>
      accessToken.hashCode + refreshToken.hashCode + expiresIn.hashCode;

  factory AuthTokens.fromJson(Map<String, dynamic> json) =>
      _$AuthTokensFromJson(json);

  Map<String, dynamic> toJson() => _$AuthTokensToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
