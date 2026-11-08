//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'set_join_code_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetJoinCodeRequest {
  /// Returns a new [SetJoinCodeRequest] instance.
  SetJoinCodeRequest({required this.enabled, this.expiresAt});

  @JsonKey(name: r'enabled', required: true, includeIfNull: false)
  final bool enabled;

  @JsonKey(name: r'expiresAt', required: false, includeIfNull: false)
  final DateTime? expiresAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SetJoinCodeRequest &&
          other.enabled == enabled &&
          other.expiresAt == expiresAt;

  @override
  int get hashCode =>
      enabled.hashCode + (expiresAt == null ? 0 : expiresAt.hashCode);

  factory SetJoinCodeRequest.fromJson(Map<String, dynamic> json) =>
      _$SetJoinCodeRequestFromJson(json);

  Map<String, dynamic> toJson() => _$SetJoinCodeRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
