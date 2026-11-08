//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'end_class_pause_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EndClassPauseRequest {
  /// Returns a new [EndClassPauseRequest] instance.
  EndClassPauseRequest({this.endedOn});

  @JsonKey(name: r'endedOn', required: false, includeIfNull: false)
  final DateTime? endedOn;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is EndClassPauseRequest && other.endedOn == endedOn;

  @override
  int get hashCode => endedOn.hashCode;

  factory EndClassPauseRequest.fromJson(Map<String, dynamic> json) =>
      _$EndClassPauseRequestFromJson(json);

  Map<String, dynamic> toJson() => _$EndClassPauseRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
