//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_placement_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPlacementRequest {
  /// Returns a new [ClassPlacementRequest] instance.
  ClassPlacementRequest({
    required this.id,

    required this.requestedAt,

    this.closedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'requestedAt', required: true, includeIfNull: false)
  final DateTime requestedAt;

  @JsonKey(name: r'closedAt', required: false, includeIfNull: false)
  final DateTime? closedAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPlacementRequest &&
          other.id == id &&
          other.requestedAt == requestedAt &&
          other.closedAt == closedAt;

  @override
  int get hashCode =>
      id.hashCode +
      requestedAt.hashCode +
      (closedAt == null ? 0 : closedAt.hashCode);

  factory ClassPlacementRequest.fromJson(Map<String, dynamic> json) =>
      _$ClassPlacementRequestFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPlacementRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
