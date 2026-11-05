//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'set_item_mastered200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetItemMastered200Response {
  /// Returns a new [SetItemMastered200Response] instance.
  SetItemMastered200Response({required this.itemId, required this.mastered});

  @JsonKey(name: r'itemId', required: true, includeIfNull: false)
  final String itemId;

  @JsonKey(name: r'mastered', required: true, includeIfNull: false)
  final bool mastered;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SetItemMastered200Response &&
          other.itemId == itemId &&
          other.mastered == mastered;

  @override
  int get hashCode => itemId.hashCode + mastered.hashCode;

  factory SetItemMastered200Response.fromJson(Map<String, dynamic> json) =>
      _$SetItemMastered200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$SetItemMastered200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
