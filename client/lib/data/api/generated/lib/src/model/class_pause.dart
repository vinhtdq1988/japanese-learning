//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_pause.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPause {
  /// Returns a new [ClassPause] instance.
  ClassPause({
    required this.id,

    this.userId,

    this.displayName,

    required this.startedOn,

    this.endedOn,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// null - cả lớp
  @JsonKey(name: r'userId', required: false, includeIfNull: false)
  final String? userId;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'startedOn', required: true, includeIfNull: false)
  final DateTime startedOn;

  @JsonKey(name: r'endedOn', required: false, includeIfNull: false)
  final DateTime? endedOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPause &&
          other.id == id &&
          other.userId == userId &&
          other.displayName == displayName &&
          other.startedOn == startedOn &&
          other.endedOn == endedOn;

  @override
  int get hashCode =>
      id.hashCode +
      (userId == null ? 0 : userId.hashCode) +
      (displayName == null ? 0 : displayName.hashCode) +
      startedOn.hashCode +
      (endedOn == null ? 0 : endedOn.hashCode);

  factory ClassPause.fromJson(Map<String, dynamic> json) =>
      _$ClassPauseFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPauseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
