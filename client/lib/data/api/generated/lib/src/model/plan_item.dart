//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'plan_item.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlanItem {
  /// Returns a new [PlanItem] instance.
  PlanItem({
    this.id,

    this.type,

    this.title,

    this.estMinutes,

    this.status,

    this.itemCount,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'type', required: false, includeIfNull: false)
  final PlanItemTypeEnum? type;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'title', required: false, includeIfNull: false)
  final String? title;

  /// Ước lượng; review_batch = ceil(itemCount × REVIEW_SECONDS_PER_ITEM / 60)
  // minimum: 1
  // maximum: 15
  @JsonKey(name: r'estMinutes', required: false, includeIfNull: false)
  final int? estMinutes;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final PlanItemStatusEnum? status;

  @JsonKey(name: r'itemCount', required: false, includeIfNull: false)
  final int? itemCount;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlanItem &&
          other.id == id &&
          other.type == type &&
          other.title == title &&
          other.estMinutes == estMinutes &&
          other.status == status &&
          other.itemCount == itemCount;

  @override
  int get hashCode =>
      id.hashCode +
      type.hashCode +
      title.hashCode +
      estMinutes.hashCode +
      status.hashCode +
      (itemCount == null ? 0 : itemCount.hashCode);

  factory PlanItem.fromJson(Map<String, dynamic> json) =>
      _$PlanItemFromJson(json);

  Map<String, dynamic> toJson() => _$PlanItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PlanItemTypeEnum {
  @JsonValue(r'new_unit')
  newUnit(r'new_unit'),
  @JsonValue(r'review_batch')
  reviewBatch(r'review_batch');

  const PlanItemTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum PlanItemStatusEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed');

  const PlanItemStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
