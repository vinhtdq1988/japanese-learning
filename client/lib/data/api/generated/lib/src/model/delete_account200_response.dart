//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'delete_account200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DeleteAccount200Response {
  /// Returns a new [DeleteAccount200Response] instance.
  DeleteAccount200Response({this.permanentDeletionAt});

  @JsonKey(name: r'permanentDeletionAt', required: false, includeIfNull: false)
  final DateTime? permanentDeletionAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DeleteAccount200Response &&
          other.permanentDeletionAt == permanentDeletionAt;

  @override
  int get hashCode => permanentDeletionAt.hashCode;

  factory DeleteAccount200Response.fromJson(Map<String, dynamic> json) =>
      _$DeleteAccount200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$DeleteAccount200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
