//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/celebrations.dart';
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

    this.celebrations,
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

  /// Có mặt khi và chỉ khi phản hồi này đến từ lần `complete` thực sự hoàn thành phiên VÀ có ít nhất một thứ để chúc mừng (`dayCompleted = true` hoặc `achievements` không rỗng). Vắng khi: không có gì để chúc mừng; gọi lại (idempotent) trên phiên đã hoàn thành. Nếu client không nhận được phản hồi (đóng tab, mất kết nối), thành tựu vẫn được ghi nhận nhưng KHÔNG được chúc mừng bù ở lần sau. `dayCompleted` ở mức `SessionSummary` giữ nguyên ngữ nghĩa cũ; chỉ `celebrations.dayCompleted` là tín hiệu \"chúc mừng một lần\" (spec 005).
  @JsonKey(name: r'celebrations', required: false, includeIfNull: false)
  final Celebrations? celebrations;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SessionSummary &&
          other.correct == correct &&
          other.total == total &&
          other.minutesSpent == minutesSpent &&
          other.dayCompleted == dayCompleted &&
          other.attentionItems == attentionItems &&
          other.celebrations == celebrations;

  @override
  int get hashCode =>
      correct.hashCode +
      total.hashCode +
      minutesSpent.hashCode +
      dayCompleted.hashCode +
      attentionItems.hashCode +
      celebrations.hashCode;

  factory SessionSummary.fromJson(Map<String, dynamic> json) =>
      _$SessionSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$SessionSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
