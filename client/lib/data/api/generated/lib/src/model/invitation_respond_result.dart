//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_brief.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invitation_respond_result.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InvitationRespondResult {
  /// Returns a new [InvitationRespondResult] instance.
  InvitationRespondResult({required this.status, this.class_, this.joinedAt});

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final InvitationRespondResultStatusEnum status;

  @JsonKey(name: r'class', required: false, includeIfNull: false)
  final ClassBrief? class_;

  @JsonKey(name: r'joinedAt', required: false, includeIfNull: false)
  final DateTime? joinedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InvitationRespondResult &&
          other.status == status &&
          other.class_ == class_ &&
          other.joinedAt == joinedAt;

  @override
  int get hashCode =>
      status.hashCode +
      (class_ == null ? 0 : class_.hashCode) +
      (joinedAt == null ? 0 : joinedAt.hashCode);

  factory InvitationRespondResult.fromJson(Map<String, dynamic> json) =>
      _$InvitationRespondResultFromJson(json);

  Map<String, dynamic> toJson() => _$InvitationRespondResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum InvitationRespondResultStatusEnum {
  @JsonValue(r'joined')
  joined(r'joined'),
  @JsonValue(r'stayed_personal')
  stayedPersonal(r'stayed_personal'),
  @JsonValue(r'accepted')
  accepted(r'accepted'),
  @JsonValue(r'declined')
  declined(r'declined');

  const InvitationRespondResultStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
