//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invitation_row.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InvitationRow {
  /// Returns a new [InvitationRow] instance.
  InvitationRow({
    required this.id,

    required this.kind,

    required this.email,

    this.displayNameHint,

    this.classId,

    required this.status,

    required this.expiresAt,

    this.createdAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'kind', required: true, includeIfNull: false)
  final InvitationRowKindEnum kind;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'displayNameHint', required: false, includeIfNull: false)
  final String? displayNameHint;

  @JsonKey(name: r'classId', required: false, includeIfNull: false)
  final String? classId;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final InvitationRowStatusEnum status;

  @JsonKey(name: r'expiresAt', required: true, includeIfNull: false)
  final DateTime expiresAt;

  @JsonKey(name: r'createdAt', required: false, includeIfNull: false)
  final DateTime? createdAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InvitationRow &&
          other.id == id &&
          other.kind == kind &&
          other.email == email &&
          other.displayNameHint == displayNameHint &&
          other.classId == classId &&
          other.status == status &&
          other.expiresAt == expiresAt &&
          other.createdAt == createdAt;

  @override
  int get hashCode =>
      id.hashCode +
      kind.hashCode +
      email.hashCode +
      (displayNameHint == null ? 0 : displayNameHint.hashCode) +
      (classId == null ? 0 : classId.hashCode) +
      status.hashCode +
      expiresAt.hashCode +
      createdAt.hashCode;

  factory InvitationRow.fromJson(Map<String, dynamic> json) =>
      _$InvitationRowFromJson(json);

  Map<String, dynamic> toJson() => _$InvitationRowToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum InvitationRowKindEnum {
  @JsonValue(r'owner')
  owner(r'owner'),
  @JsonValue(r'teacher')
  teacher(r'teacher'),
  @JsonValue(r'student')
  student(r'student');

  const InvitationRowKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum InvitationRowStatusEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'accepted')
  accepted(r'accepted'),
  @JsonValue(r'declined')
  declined(r'declined'),
  @JsonValue(r'revoked')
  revoked(r'revoked'),
  @JsonValue(r'expired')
  expired(r'expired');

  const InvitationRowStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
