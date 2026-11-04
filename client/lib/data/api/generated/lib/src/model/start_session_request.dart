//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'start_session_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StartSessionRequest {
  /// Returns a new [StartSessionRequest] instance.
  StartSessionRequest({required this.planItemId});

  @JsonKey(name: r'planItemId', required: true, includeIfNull: false)
  final String planItemId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StartSessionRequest && other.planItemId == planItemId;

  @override
  int get hashCode => planItemId.hashCode;

  factory StartSessionRequest.fromJson(Map<String, dynamic> json) =>
      _$StartSessionRequestFromJson(json);

  Map<String, dynamic> toJson() => _$StartSessionRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
