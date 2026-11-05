//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session_summary_attention_items_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionSummaryAttentionItemsInner {
  /// Returns a new [SessionSummaryAttentionItemsInner] instance.
  SessionSummaryAttentionItemsInner({
    required this.itemId,

    required this.japanese,
  });

  @JsonKey(name: r'itemId', required: true, includeIfNull: false)
  final String itemId;

  @JsonKey(name: r'japanese', required: true, includeIfNull: false)
  final String japanese;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SessionSummaryAttentionItemsInner &&
          other.itemId == itemId &&
          other.japanese == japanese;

  @override
  int get hashCode => itemId.hashCode + japanese.hashCode;

  factory SessionSummaryAttentionItemsInner.fromJson(
    Map<String, dynamic> json,
  ) => _$SessionSummaryAttentionItemsInnerFromJson(json);

  Map<String, dynamic> toJson() =>
      _$SessionSummaryAttentionItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
