//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'record_study_interval_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RecordStudyIntervalRequest {
  /// Returns a new [RecordStudyIntervalRequest] instance.
  RecordStudyIntervalRequest({
    required this.clientEventId,

    required this.startedAt,

    required this.durationSeconds,
  });

  @JsonKey(name: r'clientEventId', required: true, includeIfNull: false)
  final String clientEventId;

  @JsonKey(name: r'startedAt', required: true, includeIfNull: false)
  final DateTime startedAt;

  // minimum: 1
  // maximum: 1800
  @JsonKey(name: r'durationSeconds', required: true, includeIfNull: false)
  final int durationSeconds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RecordStudyIntervalRequest &&
          other.clientEventId == clientEventId &&
          other.startedAt == startedAt &&
          other.durationSeconds == durationSeconds;

  @override
  int get hashCode =>
      clientEventId.hashCode + startedAt.hashCode + durationSeconds.hashCode;

  factory RecordStudyIntervalRequest.fromJson(Map<String, dynamic> json) =>
      _$RecordStudyIntervalRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RecordStudyIntervalRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
