//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'archive_class200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ArchiveClass200Response {
  /// Returns a new [ArchiveClass200Response] instance.
  ArchiveClass200Response({required this.learnersMoved});

  @JsonKey(name: r'learnersMoved', required: true, includeIfNull: false)
  final int learnersMoved;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ArchiveClass200Response && other.learnersMoved == learnersMoved;

  @override
  int get hashCode => learnersMoved.hashCode;

  factory ArchiveClass200Response.fromJson(Map<String, dynamic> json) =>
      _$ArchiveClass200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ArchiveClass200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
