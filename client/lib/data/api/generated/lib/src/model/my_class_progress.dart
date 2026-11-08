//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_class_progress.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyClassProgress {
  /// Returns a new [MyClassProgress] instance.
  MyClassProgress({
    required this.hasStarted,

    this.completionRatio,

    required this.minutesTotal,

    required this.minutesLast7Days,

    this.reviewAccuracy,

    required this.streakDays,

    this.lastActiveOn,
  });

  @JsonKey(name: r'hasStarted', required: true, includeIfNull: false)
  final bool hasStarted;

  @JsonKey(name: r'completionRatio', required: false, includeIfNull: false)
  final num? completionRatio;

  @JsonKey(name: r'minutesTotal', required: true, includeIfNull: false)
  final num minutesTotal;

  @JsonKey(name: r'minutesLast7Days', required: true, includeIfNull: false)
  final num minutesLast7Days;

  @JsonKey(name: r'reviewAccuracy', required: false, includeIfNull: false)
  final num? reviewAccuracy;

  @JsonKey(name: r'streakDays', required: true, includeIfNull: false)
  final int streakDays;

  @JsonKey(name: r'lastActiveOn', required: false, includeIfNull: false)
  final DateTime? lastActiveOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyClassProgress &&
          other.hasStarted == hasStarted &&
          other.completionRatio == completionRatio &&
          other.minutesTotal == minutesTotal &&
          other.minutesLast7Days == minutesLast7Days &&
          other.reviewAccuracy == reviewAccuracy &&
          other.streakDays == streakDays &&
          other.lastActiveOn == lastActiveOn;

  @override
  int get hashCode =>
      hasStarted.hashCode +
      (completionRatio == null ? 0 : completionRatio.hashCode) +
      minutesTotal.hashCode +
      minutesLast7Days.hashCode +
      (reviewAccuracy == null ? 0 : reviewAccuracy.hashCode) +
      streakDays.hashCode +
      (lastActiveOn == null ? 0 : lastActiveOn.hashCode);

  factory MyClassProgress.fromJson(Map<String, dynamic> json) =>
      _$MyClassProgressFromJson(json);

  Map<String, dynamic> toJson() => _$MyClassProgressToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
