//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_action_log.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminActionLog {
  /// Returns a new [AdminActionLog] instance.
  AdminActionLog({
    this.id,

    this.actorId,

    this.action,

    this.targetType,

    this.targetId,

    this.occurredAt,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'actorId', required: false, includeIfNull: false)
  final String? actorId;

  @JsonKey(name: r'action', required: false, includeIfNull: false)
  final String? action;

  @JsonKey(name: r'targetType', required: false, includeIfNull: false)
  final String? targetType;

  @JsonKey(name: r'targetId', required: false, includeIfNull: false)
  final String? targetId;

  @JsonKey(name: r'occurredAt', required: false, includeIfNull: false)
  final DateTime? occurredAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminActionLog &&
          other.id == id &&
          other.actorId == actorId &&
          other.action == action &&
          other.targetType == targetType &&
          other.targetId == targetId &&
          other.occurredAt == occurredAt;

  @override
  int get hashCode =>
      id.hashCode +
      (actorId == null ? 0 : actorId.hashCode) +
      action.hashCode +
      targetType.hashCode +
      targetId.hashCode +
      occurredAt.hashCode;

  factory AdminActionLog.fromJson(Map<String, dynamic> json) =>
      _$AdminActionLogFromJson(json);

  Map<String, dynamic> toJson() => _$AdminActionLogToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
