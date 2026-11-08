//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'put_learner_override_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PutLearnerOverrideRequest {
  /// Returns a new [PutLearnerOverrideRequest] instance.
  PutLearnerOverrideRequest({this.dailyMinutes, required this.shiftDays});

  @JsonKey(name: r'dailyMinutes', required: false, includeIfNull: false)
  final PutLearnerOverrideRequestDailyMinutesEnum? dailyMinutes;

  // minimum: -60
  // maximum: 60
  @JsonKey(name: r'shiftDays', required: true, includeIfNull: false)
  final int shiftDays;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PutLearnerOverrideRequest &&
          other.dailyMinutes == dailyMinutes &&
          other.shiftDays == shiftDays;

  @override
  int get hashCode =>
      (dailyMinutes == null ? 0 : dailyMinutes.hashCode) + shiftDays.hashCode;

  factory PutLearnerOverrideRequest.fromJson(Map<String, dynamic> json) =>
      _$PutLearnerOverrideRequestFromJson(json);

  Map<String, dynamic> toJson() => _$PutLearnerOverrideRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PutLearnerOverrideRequestDailyMinutesEnum {
  @JsonValue(5)
  number5('5'),
  @JsonValue(10)
  number10('10'),
  @JsonValue(15)
  number15('15'),
  @JsonValue(30)
  number30('30');

  const PutLearnerOverrideRequestDailyMinutesEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
