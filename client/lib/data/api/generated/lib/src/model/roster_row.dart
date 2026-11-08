//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'roster_row.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RosterRow {
  /// Returns a new [RosterRow] instance.
  RosterRow({
    this.userId,

    required this.displayName,

    this.email,

    required this.status,

    required this.at,

    this.invitationId,
  });

  @JsonKey(name: r'userId', required: false, includeIfNull: false)
  final String? userId;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final RosterRowStatusEnum status;

  @JsonKey(name: r'at', required: true, includeIfNull: false)
  final DateTime at;

  @JsonKey(name: r'invitationId', required: false, includeIfNull: false)
  final String? invitationId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RosterRow &&
          other.userId == userId &&
          other.displayName == displayName &&
          other.email == email &&
          other.status == status &&
          other.at == at &&
          other.invitationId == invitationId;

  @override
  int get hashCode =>
      (userId == null ? 0 : userId.hashCode) +
      displayName.hashCode +
      (email == null ? 0 : email.hashCode) +
      status.hashCode +
      at.hashCode +
      (invitationId == null ? 0 : invitationId.hashCode);

  factory RosterRow.fromJson(Map<String, dynamic> json) =>
      _$RosterRowFromJson(json);

  Map<String, dynamic> toJson() => _$RosterRowToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum RosterRowStatusEnum {
  @JsonValue(r'joined')
  joined(r'joined'),
  @JsonValue(r'invited')
  invited(r'invited'),
  @JsonValue(r'declined')
  declined(r'declined'),
  @JsonValue(r'switched_personal')
  switchedPersonal(r'switched_personal'),
  @JsonValue(r'removed')
  removed(r'removed'),
  @JsonValue(r'other_ended')
  otherEnded(r'other_ended');

  const RosterRowStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
