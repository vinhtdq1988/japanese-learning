//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_class_pause_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateClassPauseRequest {
  /// Returns a new [CreateClassPauseRequest] instance.
  CreateClassPauseRequest({this.userId, required this.startedOn, this.endedOn});

  @JsonKey(name: r'userId', required: false, includeIfNull: false)
  final String? userId;

  @JsonKey(name: r'startedOn', required: true, includeIfNull: false)
  final DateTime startedOn;

  @JsonKey(name: r'endedOn', required: false, includeIfNull: false)
  final DateTime? endedOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CreateClassPauseRequest &&
          other.userId == userId &&
          other.startedOn == startedOn &&
          other.endedOn == endedOn;

  @override
  int get hashCode =>
      userId.hashCode +
      startedOn.hashCode +
      (endedOn == null ? 0 : endedOn.hashCode);

  factory CreateClassPauseRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateClassPauseRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CreateClassPauseRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
