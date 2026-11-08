//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_class_placement_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyClassPlacementRequest {
  /// Returns a new [MyClassPlacementRequest] instance.
  MyClassPlacementRequest({this.id, this.requestedAt});

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'requestedAt', required: false, includeIfNull: false)
  final DateTime? requestedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyClassPlacementRequest &&
          other.id == id &&
          other.requestedAt == requestedAt;

  @override
  int get hashCode => id.hashCode + requestedAt.hashCode;

  factory MyClassPlacementRequest.fromJson(Map<String, dynamic> json) =>
      _$MyClassPlacementRequestFromJson(json);

  Map<String, dynamic> toJson() => _$MyClassPlacementRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
