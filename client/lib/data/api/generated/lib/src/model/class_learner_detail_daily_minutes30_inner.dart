//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_learner_detail_daily_minutes30_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassLearnerDetailDailyMinutes30Inner {
  /// Returns a new [ClassLearnerDetailDailyMinutes30Inner] instance.
  ClassLearnerDetailDailyMinutes30Inner({
    required this.date,

    required this.minutes,
  });

  @JsonKey(name: r'date', required: true, includeIfNull: false)
  final DateTime date;

  @JsonKey(name: r'minutes', required: true, includeIfNull: false)
  final num minutes;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassLearnerDetailDailyMinutes30Inner &&
          other.date == date &&
          other.minutes == minutes;

  @override
  int get hashCode => date.hashCode + minutes.hashCode;

  factory ClassLearnerDetailDailyMinutes30Inner.fromJson(
    Map<String, dynamic> json,
  ) => _$ClassLearnerDetailDailyMinutes30InnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$ClassLearnerDetailDailyMinutes30InnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
