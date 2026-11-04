//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'error.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Error {
  /// Returns a new [Error] instance.
  Error({required this.code, required this.message, this.fields});

  /// Mã máy đọc được, ví dụ EMAIL_TAKEN, EMAIL_PENDING_DELETION, VALIDATION_FAILED, ACCOUNT_DISABLED, ACCOUNT_PENDING_DELETION, PLACEMENT_SET_INVALID, PATH_PAUSED, SESSION_INCOMPLETE, SESSION_COMPLETED, CONTENT_EXHAUSTED
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'message', required: true, includeIfNull: false)
  final String message;

  @JsonKey(name: r'fields', required: false, includeIfNull: false)
  final Map<String, String>? fields;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Error &&
          other.code == code &&
          other.message == message &&
          other.fields == fields;

  @override
  int get hashCode => code.hashCode + message.hashCode + fields.hashCode;

  factory Error.fromJson(Map<String, dynamic> json) => _$ErrorFromJson(json);

  Map<String, dynamic> toJson() => _$ErrorToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
