//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invitation_respond.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InvitationRespond {
  /// Returns a new [InvitationRespond] instance.
  InvitationRespond({required this.decision, this.confirmed});

  /// student - join_class/stay_personal; teacher/owner - accept/decline
  @JsonKey(name: r'decision', required: true, includeIfNull: false)
  final InvitationRespondDecisionEnum decision;

  /// Bắt buộc true với `join_class`
  @JsonKey(name: r'confirmed', required: false, includeIfNull: false)
  final bool? confirmed;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InvitationRespond &&
          other.decision == decision &&
          other.confirmed == confirmed;

  @override
  int get hashCode => decision.hashCode + confirmed.hashCode;

  factory InvitationRespond.fromJson(Map<String, dynamic> json) =>
      _$InvitationRespondFromJson(json);

  Map<String, dynamic> toJson() => _$InvitationRespondToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// student - join_class/stay_personal; teacher/owner - accept/decline
enum InvitationRespondDecisionEnum {
  @JsonValue(r'join_class')
  joinClass(r'join_class'),
  @JsonValue(r'stay_personal')
  stayPersonal(r'stay_personal'),
  @JsonValue(r'accept')
  accept(r'accept'),
  @JsonValue(r'decline')
  decline(r'decline');

  const InvitationRespondDecisionEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
