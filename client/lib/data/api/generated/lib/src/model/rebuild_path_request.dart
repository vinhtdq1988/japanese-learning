//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'rebuild_path_request.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RebuildPathRequest {
  /// Returns a new [RebuildPathRequest] instance.
  RebuildPathRequest({this.usePlacementResultId});

  /// Dùng kết quả kiểm tra mới; bỏ trống = theo hồ sơ hiện tại
  @JsonKey(name: r'usePlacementResultId', required: false, includeIfNull: false)
  final String? usePlacementResultId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RebuildPathRequest &&
          other.usePlacementResultId == usePlacementResultId;

  @override
  int get hashCode => usePlacementResultId.hashCode;

  factory RebuildPathRequest.fromJson(Map<String, dynamic> json) =>
      _$RebuildPathRequestFromJson(json);

  Map<String, dynamic> toJson() => _$RebuildPathRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
