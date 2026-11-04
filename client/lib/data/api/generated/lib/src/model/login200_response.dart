//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/account_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'login200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Login200Response {
  /// Returns a new [Login200Response] instance.
  Login200Response({
    required this.accessToken,

    required this.refreshToken,

    required this.expiresIn,

    this.accountStatus,
  });

  @JsonKey(name: r'accessToken', required: true, includeIfNull: false)
  final String accessToken;

  @JsonKey(name: r'refreshToken', required: true, includeIfNull: false)
  final String refreshToken;

  /// Số giây hiệu lực của access token
  @JsonKey(name: r'expiresIn', required: true, includeIfNull: false)
  final int expiresIn;

  @JsonKey(name: r'accountStatus', required: false, includeIfNull: false)
  final AccountStatus? accountStatus;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Login200Response &&
          other.accessToken == accessToken &&
          other.refreshToken == refreshToken &&
          other.expiresIn == expiresIn &&
          other.accountStatus == accountStatus;

  @override
  int get hashCode =>
      accessToken.hashCode +
      refreshToken.hashCode +
      expiresIn.hashCode +
      accountStatus.hashCode;

  factory Login200Response.fromJson(Map<String, dynamic> json) =>
      _$Login200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$Login200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
