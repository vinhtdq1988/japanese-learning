//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/session_summary_attention_items_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionSummary {
  /// Returns a new [SessionSummary] instance.
  SessionSummary({
    this.correct,

    this.total,

    this.minutesSpent,

    this.dayCompleted,

    this.attentionItems,
  });

  @JsonKey(name: r'correct', required: false, includeIfNull: false)
  final int? correct;

  @JsonKey(name: r'total', required: false, includeIfNull: false)
  final int? total;

  @JsonKey(name: r'minutesSpent', required: false, includeIfNull: false)
  final num? minutesSpent;

  @JsonKey(name: r'dayCompleted', required: false, includeIfNull: false)
  final bool? dayCompleted;

  /// Chữ Kanji có ít nhất một câu lượt chính sai trong phiên (US1.4); vắng mặt với phiên không có Kanji
  @JsonKey(name: r'attentionItems', required: false, includeIfNull: false)
  final List<SessionSummaryAttentionItemsInner>? attentionItems;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SessionSummary &&
          other.correct == correct &&
          other.total == total &&
          other.minutesSpent == minutesSpent &&
          other.dayCompleted == dayCompleted &&
          other.attentionItems == attentionItems;

  @override
  int get hashCode =>
      correct.hashCode +
      total.hashCode +
      minutesSpent.hashCode +
      dayCompleted.hashCode +
      attentionItems.hashCode;

  factory SessionSummary.fromJson(Map<String, dynamic> json) =>
      _$SessionSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$SessionSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
