//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'learner_override.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LearnerOverride {
  /// Returns a new [LearnerOverride] instance.
  LearnerOverride({this.dailyMinutes, this.shiftDays, this.exemptUnitIds});

  @JsonKey(name: r'dailyMinutes', required: false, includeIfNull: false)
  final LearnerOverrideDailyMinutesEnum? dailyMinutes;

  // minimum: -60
  // maximum: 60
  @JsonKey(name: r'shiftDays', required: false, includeIfNull: false)
  final int? shiftDays;

  @JsonKey(name: r'exemptUnitIds', required: false, includeIfNull: false)
  final List<String>? exemptUnitIds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LearnerOverride &&
          other.dailyMinutes == dailyMinutes &&
          other.shiftDays == shiftDays &&
          other.exemptUnitIds == exemptUnitIds;

  @override
  int get hashCode =>
      (dailyMinutes == null ? 0 : dailyMinutes.hashCode) +
      shiftDays.hashCode +
      exemptUnitIds.hashCode;

  factory LearnerOverride.fromJson(Map<String, dynamic> json) =>
      _$LearnerOverrideFromJson(json);

  Map<String, dynamic> toJson() => _$LearnerOverrideToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LearnerOverrideDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const LearnerOverrideDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
