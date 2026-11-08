//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/shared_data_disclosure.dart';
import 'package:japanese_api/src/model/class_brief.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'invitation_preview.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class InvitationPreview {
  /// Returns a new [InvitationPreview] instance.
  InvitationPreview({
    required this.kind,

    required this.organizationName,

    this.class_,

    this.invitedBy,

    required this.expiresAt,

    this.disclosure,
  });

  @JsonKey(name: r'kind', required: true, includeIfNull: false)
  final InvitationPreviewKindEnum kind;

  @JsonKey(name: r'organizationName', required: true, includeIfNull: false)
  final String organizationName;

  @JsonKey(name: r'class', required: false, includeIfNull: false)
  final ClassBrief? class_;

  @JsonKey(name: r'invitedBy', required: false, includeIfNull: false)
  final String? invitedBy;

  @JsonKey(name: r'expiresAt', required: true, includeIfNull: false)
  final DateTime expiresAt;

  /// Có khi `kind=student`
  @JsonKey(name: r'disclosure', required: false, includeIfNull: false)
  final SharedDataDisclosure? disclosure;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InvitationPreview &&
          other.kind == kind &&
          other.organizationName == organizationName &&
          other.class_ == class_ &&
          other.invitedBy == invitedBy &&
          other.expiresAt == expiresAt &&
          other.disclosure == disclosure;

  @override
  int get hashCode =>
      kind.hashCode +
      organizationName.hashCode +
      (class_ == null ? 0 : class_.hashCode) +
      (invitedBy == null ? 0 : invitedBy.hashCode) +
      expiresAt.hashCode +
      (disclosure == null ? 0 : disclosure.hashCode);

  factory InvitationPreview.fromJson(Map<String, dynamic> json) =>
      _$InvitationPreviewFromJson(json);

  Map<String, dynamic> toJson() => _$InvitationPreviewToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum InvitationPreviewKindEnum {
  @JsonValue(r'owner')
  owner(r'owner'),
  @JsonValue(r'teacher')
  teacher(r'teacher'),
  @JsonValue(r'student')
  student(r'student');

  const InvitationPreviewKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
