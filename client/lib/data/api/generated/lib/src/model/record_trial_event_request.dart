//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'record_trial_event_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RecordTrialEventRequest {
  /// Returns a new [RecordTrialEventRequest] instance.
  RecordTrialEventRequest({required this.event});

  @JsonKey(name: r'event', required: true, includeIfNull: false)
  final RecordTrialEventRequestEventEnum event;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RecordTrialEventRequest && other.event == event;

  @override
  int get hashCode => event.hashCode;

  factory RecordTrialEventRequest.fromJson(Map<String, dynamic> json) =>
      _$RecordTrialEventRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RecordTrialEventRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum RecordTrialEventRequestEventEnum {
  @JsonValue(r'lesson_completed')
  lessonCompleted(r'lesson_completed');

  const RecordTrialEventRequestEventEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
