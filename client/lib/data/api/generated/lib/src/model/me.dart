//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/account_status.dart';
import 'package:japanese_api/src/model/profile.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Me {
  /// Returns a new [Me] instance.
  Me({this.id, this.email, this.role, this.status, this.profile});

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  @JsonKey(name: r'role', required: false, includeIfNull: false)
  final MeRoleEnum? role;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final AccountStatus? status;

  @JsonKey(name: r'profile', required: false, includeIfNull: false)
  final Profile? profile;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Me &&
          other.id == id &&
          other.email == email &&
          other.role == role &&
          other.status == status &&
          other.profile == profile;

  @override
  int get hashCode =>
      id.hashCode +
      email.hashCode +
      role.hashCode +
      status.hashCode +
      profile.hashCode;

  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  Map<String, dynamic> toJson() => _$MeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum MeRoleEnum {
  @JsonValue(r'learner')
  learner(r'learner'),
  @JsonValue(r'admin')
  admin(r'admin');

  const MeRoleEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
