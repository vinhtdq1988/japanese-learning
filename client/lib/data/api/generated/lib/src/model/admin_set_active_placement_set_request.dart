//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_set_active_placement_set_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminSetActivePlacementSetRequest {
  /// Returns a new [AdminSetActivePlacementSetRequest] instance.
  AdminSetActivePlacementSetRequest({required this.questionIds});

  /// Thứ tự mảng = position
  @JsonKey(name: r'questionIds', required: true, includeIfNull: false)
  final List<String> questionIds;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminSetActivePlacementSetRequest &&
          other.questionIds == questionIds;

  @override
  int get hashCode => questionIds.hashCode;

  factory AdminSetActivePlacementSetRequest.fromJson(
    Map<String, dynamic> json,
  ) => _$AdminSetActivePlacementSetRequestFromJson(json);

  Map<String, dynamic> toJson() =>
      _$AdminSetActivePlacementSetRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
