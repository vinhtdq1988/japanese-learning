//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/invite_class_learners_request_invitees_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invite_class_learners_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InviteClassLearnersRequest {
  /// Returns a new [InviteClassLearnersRequest] instance.
  InviteClassLearnersRequest({required this.invitees});

  @JsonKey(name: r'invitees', required: true, includeIfNull: false)
  final List<InviteClassLearnersRequestInviteesInner> invitees;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InviteClassLearnersRequest && other.invitees == invitees;

  @override
  int get hashCode => invitees.hashCode;

  factory InviteClassLearnersRequest.fromJson(Map<String, dynamic> json) =>
      _$InviteClassLearnersRequestFromJson(json);

  Map<String, dynamic> toJson() => _$InviteClassLearnersRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
