//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'leave_my_class_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LeaveMyClassRequest {
  /// Returns a new [LeaveMyClassRequest] instance.
  LeaveMyClassRequest({required this.confirm});

  @JsonKey(name: r'confirm', required: true, includeIfNull: false)
  final bool confirm;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LeaveMyClassRequest && other.confirm == confirm;

  @override
  int get hashCode => confirm.hashCode;

  factory LeaveMyClassRequest.fromJson(Map<String, dynamic> json) =>
      _$LeaveMyClassRequestFromJson(json);

  Map<String, dynamic> toJson() => _$LeaveMyClassRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
