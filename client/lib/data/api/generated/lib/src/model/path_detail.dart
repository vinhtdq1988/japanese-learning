//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/path_detail_all_of_items.dart';
import 'package:japanese_api/src/model/scope_notice.dart';
import 'package:japanese_api/src/model/level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'path_detail.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PathDetail {
  /// Returns a new [PathDetail] instance.
  PathDetail({
    this.id,

    this.totalUnits,

    this.completedUnits,

    this.startLevel,

    this.reason,

    this.scopeNotice,

    this.message,

    this.source_,

    this.items,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'totalUnits', required: false, includeIfNull: false)
  final int? totalUnits;

  @JsonKey(name: r'completedUnits', required: false, includeIfNull: false)
  final int? completedUnits;

  @JsonKey(name: r'startLevel', required: false, includeIfNull: false)
  final Level? startLevel;

  @JsonKey(name: r'reason', required: false, includeIfNull: false)
  final PathDetailReasonEnum? reason;

  @JsonKey(name: r'scopeNotice', required: false, includeIfNull: false)
  final ScopeNotice? scopeNotice;

  /// Ví dụ: kỹ năng chưa hỗ trợ trong phiên bản này
  @JsonKey(name: r'message', required: false, includeIfNull: false)
  final String? message;

  /// Spec 004: nguồn của lộ trình; `class` khi học viên thuộc lớp
  @JsonKey(name: r'source', required: false, includeIfNull: false)
  final PathDetailSource_Enum? source_;

  /// Thứ tự đơn vị được tính động tại thời điểm gọi từ tham số lộ trình, nội dung `active` hiện hành và trạng thái học (không lưu sẵn; đơn vị mới kích hoạt xuất hiện ở lần gọi kế tiếp, SC-008)
  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<PathDetailAllOfItems>? items;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PathDetail &&
          other.id == id &&
          other.totalUnits == totalUnits &&
          other.completedUnits == completedUnits &&
          other.startLevel == startLevel &&
          other.reason == reason &&
          other.scopeNotice == scopeNotice &&
          other.message == message &&
          other.source_ == source_ &&
          other.items == items;

  @override
  int get hashCode =>
      id.hashCode +
      totalUnits.hashCode +
      completedUnits.hashCode +
      startLevel.hashCode +
      reason.hashCode +
      (scopeNotice == null ? 0 : scopeNotice.hashCode) +
      (message == null ? 0 : message.hashCode) +
      source_.hashCode +
      items.hashCode;

  factory PathDetail.fromJson(Map<String, dynamic> json) =>
      _$PathDetailFromJson(json);

  Map<String, dynamic> toJson() => _$PathDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PathDetailReasonEnum {
  @JsonValue(r'onboarding')
  onboarding(r'onboarding'),
  @JsonValue(r'rebuild_request')
  rebuildRequest(r'rebuild_request'),
  @JsonValue(r'goal_change')
  goalChange(r'goal_change'),
  @JsonValue(r'level_change')
  levelChange(r'level_change'),
  @JsonValue(r'placement_retake')
  placementRetake(r'placement_retake');

  const PathDetailReasonEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

/// Spec 004: nguồn của lộ trình; `class` khi học viên thuộc lớp
enum PathDetailSource_Enum {
  @JsonValue(r'personal')
  personal(r'personal'),
  @JsonValue(r'class')
  class_(r'class');

  const PathDetailSource_Enum(this.value);

  final String value;

  @override
  String toString() => value;
}
