//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/learner_override.dart';
import 'package:japanese_api/src/model/class_alert.dart';
import 'package:japanese_api/src/model/class_progress_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_row.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerRow {
  /// Returns a new [ClassLearnerRow] instance.
  ClassLearnerRow({
    required this.userId,

    required this.displayName,

    required this.email,

    this.joinedAt,

    required this.hasStarted,

    required this.pathCompleted,

    this.completionRatio,

    this.expectedRatio,

    this.streakDays,

    this.minutesLast7Days,

    this.minutesTotal,

    this.reviewAccuracy,

    this.lastActiveOn,

    required this.progressStatus,

    required this.alerts,

    this.absentDays,

    this.overrides,
  });

  @JsonKey(name: r'userId', required: true, includeIfNull: false)
  final String userId;

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'joinedAt', required: false, includeIfNull: false)
  final DateTime? joinedAt;

  /// false - giao diện hiện \"chưa bắt đầu\" thay vì số 0
  @JsonKey(name: r'hasStarted', required: true, includeIfNull: false)
  final bool hasStarted;

  @JsonKey(name: r'pathCompleted', required: true, includeIfNull: false)
  final bool pathCompleted;

  // minimum: 0
  // maximum: 1
  @JsonKey(name: r'completionRatio', required: false, includeIfNull: false)
  final num? completionRatio;

  // minimum: 0
  // maximum: 1
  @JsonKey(name: r'expectedRatio', required: false, includeIfNull: false)
  final num? expectedRatio;

  @JsonKey(name: r'streakDays', required: false, includeIfNull: false)
  final int? streakDays;

  @JsonKey(name: r'minutesLast7Days', required: false, includeIfNull: false)
  final num? minutesLast7Days;

  /// từ khi vào lớp
  @JsonKey(name: r'minutesTotal', required: false, includeIfNull: false)
  final num? minutesTotal;

  @JsonKey(name: r'reviewAccuracy', required: false, includeIfNull: false)
  final num? reviewAccuracy;

  @JsonKey(name: r'lastActiveOn', required: false, includeIfNull: false)
  final DateTime? lastActiveOn;

  @JsonKey(name: r'progressStatus', required: true, includeIfNull: false)
  final ClassProgressStatus progressStatus;

  @JsonKey(name: r'alerts', required: true, includeIfNull: false)
  final List<ClassAlert> alerts;

  @JsonKey(name: r'absentDays', required: false, includeIfNull: false)
  final int? absentDays;

  @JsonKey(name: r'overrides', required: false, includeIfNull: false)
  final LearnerOverride? overrides;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerRow &&
          other.userId == userId &&
          other.displayName == displayName &&
          other.email == email &&
          other.joinedAt == joinedAt &&
          other.hasStarted == hasStarted &&
          other.pathCompleted == pathCompleted &&
          other.completionRatio == completionRatio &&
          other.expectedRatio == expectedRatio &&
          other.streakDays == streakDays &&
          other.minutesLast7Days == minutesLast7Days &&
          other.minutesTotal == minutesTotal &&
          other.reviewAccuracy == reviewAccuracy &&
          other.lastActiveOn == lastActiveOn &&
          other.progressStatus == progressStatus &&
          other.alerts == alerts &&
          other.absentDays == absentDays &&
          other.overrides == overrides;

  @override
  int get hashCode =>
      userId.hashCode +
      displayName.hashCode +
      email.hashCode +
      joinedAt.hashCode +
      hasStarted.hashCode +
      pathCompleted.hashCode +
      (completionRatio == null ? 0 : completionRatio.hashCode) +
      expectedRatio.hashCode +
      streakDays.hashCode +
      minutesLast7Days.hashCode +
      minutesTotal.hashCode +
      (reviewAccuracy == null ? 0 : reviewAccuracy.hashCode) +
      (lastActiveOn == null ? 0 : lastActiveOn.hashCode) +
      progressStatus.hashCode +
      alerts.hashCode +
      absentDays.hashCode +
      overrides.hashCode;

  factory ClassLearnerRow.fromJson(Map<String, dynamic> json) =>
      _$ClassLearnerRowFromJson(json);

  Map<String, dynamic> toJson() => _$ClassLearnerRowToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
