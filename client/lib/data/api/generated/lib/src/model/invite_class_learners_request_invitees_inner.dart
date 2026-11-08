//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invite_class_learners_request_invitees_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InviteClassLearnersRequestInviteesInner {
  /// Returns a new [InviteClassLearnersRequestInviteesInner] instance.
  InviteClassLearnersRequestInviteesInner({
    required this.email,

    this.displayName,
  });

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InviteClassLearnersRequestInviteesInner &&
          other.email == email &&
          other.displayName == displayName;

  @override
  int get hashCode => email.hashCode + displayName.hashCode;

  factory InviteClassLearnersRequestInviteesInner.fromJson(
    Map<String, dynamic> json,
  ) => _$InviteClassLearnersRequestInviteesInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$InviteClassLearnersRequestInviteesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
