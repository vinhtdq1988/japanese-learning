//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/plan_item.dart';
import 'package:japanese_api/src/model/session_summary.dart';
import 'package:japanese_api/src/model/daily_plan_kanji_notice.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'daily_plan.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DailyPlan {
  /// Returns a new [DailyPlan] instance.
  DailyPlan({
    this.id,

    this.localDate,

    this.budgetMinutes,

    this.estimatedMinutes,

    this.status,

    this.items,

    this.notice,

    this.kanjiNotice,

    this.summary,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'localDate', required: false, includeIfNull: false)
  final DateTime? localDate;

  @JsonKey(name: r'budgetMinutes', required: false, includeIfNull: false)
  final int? budgetMinutes;

  /// Luôn ≤ budgetMinutes
  @JsonKey(name: r'estimatedMinutes', required: false, includeIfNull: false)
  final int? estimatedMinutes;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final DailyPlanStatusEnum? status;

  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<PlanItem>? items;

  /// Thông báo (đã học hết nội dung phù hợp, kế hoạch đã điều chỉnh sau khoảng nghỉ…)
  @JsonKey(name: r'notice', required: false, includeIfNull: false)
  final String? notice;

  @JsonKey(name: r'kanjiNotice', required: false, includeIfNull: false)
  final DailyPlanKanjiNotice? kanjiNotice;

  @JsonKey(name: r'summary', required: false, includeIfNull: false)
  final SessionSummary? summary;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DailyPlan &&
          other.id == id &&
          other.localDate == localDate &&
          other.budgetMinutes == budgetMinutes &&
          other.estimatedMinutes == estimatedMinutes &&
          other.status == status &&
          other.items == items &&
          other.notice == notice &&
          other.kanjiNotice == kanjiNotice &&
          other.summary == summary;

  @override
  int get hashCode =>
      id.hashCode +
      localDate.hashCode +
      budgetMinutes.hashCode +
      estimatedMinutes.hashCode +
      status.hashCode +
      items.hashCode +
      (notice == null ? 0 : notice.hashCode) +
      (kanjiNotice == null ? 0 : kanjiNotice.hashCode) +
      (summary == null ? 0 : summary.hashCode);

  factory DailyPlan.fromJson(Map<String, dynamic> json) =>
      _$DailyPlanFromJson(json);

  Map<String, dynamic> toJson() => _$DailyPlanToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum DailyPlanStatusEnum {
  @JsonValue(r'open')
  open(r'open'),
  @JsonValue(r'completed')
  completed(r'completed');

  const DailyPlanStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
