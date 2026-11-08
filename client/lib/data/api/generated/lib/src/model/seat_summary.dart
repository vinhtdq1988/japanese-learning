//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'seat_summary.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SeatSummary {
  /// Returns a new [SeatSummary] instance.
  SeatSummary({
    required this.total,

    required this.used,

    required this.reserved,

    this.available,
  });

  // minimum: 0
  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final int total;

  // minimum: 0
  @JsonKey(name: r'used', required: true, includeIfNull: false)
  final int used;

  /// Số lời mời giáo viên/học viên đang chờ (giữ chỗ theo đếm)
  // minimum: 0
  @JsonKey(name: r'reserved', required: true, includeIfNull: false)
  final int reserved;

  /// Số chỗ còn có thể mời; không âm
  // minimum: 0
  @JsonKey(name: r'available', required: false, includeIfNull: false)
  final int? available;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SeatSummary &&
          other.total == total &&
          other.used == used &&
          other.reserved == reserved &&
          other.available == available;

  @override
  int get hashCode =>
      total.hashCode + used.hashCode + reserved.hashCode + available.hashCode;

  factory SeatSummary.fromJson(Map<String, dynamic> json) =>
      _$SeatSummaryFromJson(json);

  Map<String, dynamic> toJson() => _$SeatSummaryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
