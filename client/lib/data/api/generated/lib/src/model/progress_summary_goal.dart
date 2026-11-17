//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/scope_notice_code.dart';
import 'package:japanese_api/src/model/scope_notice.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_goal.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryGoal {
  /// Returns a new [ProgressSummaryGoal] instance.
  ProgressSummaryGoal({

     this.completionRatio,

     this.onTrack,

     this.targetDate,

     this.scopeNotice,

     this.notices,
  });

      /// Tỷ lệ PHÚT của các đơn vị đã xong (hoàn thành hoặc thành thạo) trên tổng phút của các đơn vị `active` trong phạm vi lộ trình, làm tròn 3 chữ số; cùng nguồn với thành tựu `goal_*` (spec 008)
          // minimum: 0
          // maximum: 1
  @JsonKey(
    
    name: r'completionRatio',
    required: false,
    includeIfNull: false,
  )


  final num? completionRatio;



  @JsonKey(
    
    name: r'onTrack',
    required: false,
    includeIfNull: false,
  )


  final bool? onTrack;



  @JsonKey(
    
    name: r'targetDate',
    required: false,
    includeIfNull: false,
  )


  final DateTime? targetDate;



  @JsonKey(
    
    name: r'scopeNotice',
    required: false,
    includeIfNull: false,
  )


  final ScopeNotice? scopeNotice;



      /// Cùng quy tắc với `PathSummary.notices` (tính khi đọc): `content_ceiling_n3` rồi `listening_not_available` khi mục tiêu là JLPT
  @JsonKey(
    
    name: r'notices',
    required: false,
    includeIfNull: false,
  )


  final List<ScopeNoticeCode>? notices;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ProgressSummaryGoal &&
      other.completionRatio == completionRatio &&
      other.onTrack == onTrack &&
      other.targetDate == targetDate &&
      other.scopeNotice == scopeNotice &&
      other.notices == notices;

    @override
    int get hashCode =>
        completionRatio.hashCode +
        (onTrack == null ? 0 : onTrack.hashCode) +
        (targetDate == null ? 0 : targetDate.hashCode) +
        (scopeNotice == null ? 0 : scopeNotice.hashCode) +
        notices.hashCode;

  factory ProgressSummaryGoal.fromJson(Map<String, dynamic> json) => _$ProgressSummaryGoalFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryGoalToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

