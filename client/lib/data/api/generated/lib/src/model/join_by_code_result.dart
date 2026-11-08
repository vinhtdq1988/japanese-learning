//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/shared_data_disclosure.dart';
import 'package:japanese_api/src/model/class_brief.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'join_by_code_result.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JoinByCodeResult {
  /// Returns a new [JoinByCodeResult] instance.
  JoinByCodeResult({this.status, this.class_, this.disclosure, this.joinedAt});

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final JoinByCodeResultStatusEnum? status;

  @JsonKey(name: r'class', required: false, includeIfNull: false)
  final ClassBrief? class_;

  @JsonKey(name: r'disclosure', required: false, includeIfNull: false)
  final SharedDataDisclosure? disclosure;

  @JsonKey(name: r'joinedAt', required: false, includeIfNull: false)
  final DateTime? joinedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JoinByCodeResult &&
          other.status == status &&
          other.class_ == class_ &&
          other.disclosure == disclosure &&
          other.joinedAt == joinedAt;

  @override
  int get hashCode =>
      status.hashCode +
      class_.hashCode +
      disclosure.hashCode +
      joinedAt.hashCode;

  factory JoinByCodeResult.fromJson(Map<String, dynamic> json) =>
      _$JoinByCodeResultFromJson(json);

  Map<String, dynamic> toJson() => _$JoinByCodeResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum JoinByCodeResultStatusEnum {
  @JsonValue(r'preview')
  preview(r'preview'),
  @JsonValue(r'joined')
  joined(r'joined');

  const JoinByCodeResultStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
