//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_path.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'get_class_path200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class GetClassPath200Response {
  /// Returns a new [GetClassPath200Response] instance.
  GetClassPath200Response({required this.path});

  @JsonKey(name: r'path', required: true, includeIfNull: true)
  final ClassPath? path;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GetClassPath200Response && other.path == path;

  @override
  int get hashCode => (path == null ? 0 : path.hashCode);

  factory GetClassPath200Response.fromJson(Map<String, dynamic> json) =>
      _$GetClassPath200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$GetClassPath200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
