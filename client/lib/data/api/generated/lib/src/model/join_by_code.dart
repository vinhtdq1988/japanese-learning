//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'join_by_code.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JoinByCode {
  /// Returns a new [JoinByCode] instance.
  JoinByCode({required this.code, this.decision, this.confirmed});

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'decision', required: false, includeIfNull: false)
  final JoinByCodeDecisionEnum? decision;

  @JsonKey(name: r'confirmed', required: false, includeIfNull: false)
  final bool? confirmed;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JoinByCode &&
          other.code == code &&
          other.decision == decision &&
          other.confirmed == confirmed;

  @override
  int get hashCode => code.hashCode + decision.hashCode + confirmed.hashCode;

  factory JoinByCode.fromJson(Map<String, dynamic> json) =>
      _$JoinByCodeFromJson(json);

  Map<String, dynamic> toJson() => _$JoinByCodeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum JoinByCodeDecisionEnum {
  @JsonValue(r'join_class')
  joinClass(r'join_class'),
  @JsonValue(r'stay_personal')
  stayPersonal(r'stay_personal');

  const JoinByCodeDecisionEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
