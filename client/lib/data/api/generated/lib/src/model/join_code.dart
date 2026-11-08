//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'join_code.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JoinCode {
  /// Returns a new [JoinCode] instance.
  JoinCode({this.code, required this.enabled, this.expiresAt});

  @JsonKey(name: r'code', required: false, includeIfNull: false)
  final String? code;

  @JsonKey(name: r'enabled', required: true, includeIfNull: false)
  final bool enabled;

  @JsonKey(name: r'expiresAt', required: false, includeIfNull: false)
  final DateTime? expiresAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JoinCode &&
          other.code == code &&
          other.enabled == enabled &&
          other.expiresAt == expiresAt;

  @override
  int get hashCode =>
      (code == null ? 0 : code.hashCode) +
      enabled.hashCode +
      (expiresAt == null ? 0 : expiresAt.hashCode);

  factory JoinCode.fromJson(Map<String, dynamic> json) =>
      _$JoinCodeFromJson(json);

  Map<String, dynamic> toJson() => _$JoinCodeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
