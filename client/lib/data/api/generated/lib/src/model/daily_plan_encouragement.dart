//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'daily_plan_encouragement.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DailyPlanEncouragement {
  /// Returns a new [DailyPlanEncouragement] instance.
  DailyPlanEncouragement({

    required  this.state,

    required  this.message,
  });

  @JsonKey(
    
    name: r'state',
    required: true,
    includeIfNull: false,
  )


  final DailyPlanEncouragementStateEnum state;



      /// Câu hiển thị; đã thay `{n}` bằng số ngày của chuỗi nếu có
  @JsonKey(
    
    name: r'message',
    required: true,
    includeIfNull: false,
  )


  final String message;





    @override
    bool operator ==(Object other) => identical(this, other) || other is DailyPlanEncouragement &&
      other.state == state &&
      other.message == message;

    @override
    int get hashCode =>
        state.hashCode +
        message.hashCode;

  factory DailyPlanEncouragement.fromJson(Map<String, dynamic> json) => _$DailyPlanEncouragementFromJson(json);

  Map<String, dynamic> toJson() => _$DailyPlanEncouragementToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum DailyPlanEncouragementStateEnum {
@JsonValue(r'not_started')
notStarted(r'not_started'),
@JsonValue(r'in_progress')
inProgress(r'in_progress'),
@JsonValue(r'day_completed')
dayCompleted(r'day_completed'),
@JsonValue(r'streak')
streak(r'streak'),
@JsonValue(r'welcome_back')
welcomeBack(r'welcome_back'),
@JsonValue(r'behind_target')
behindTarget(r'behind_target');

const DailyPlanEncouragementStateEnum(this.value);

final String value;

@override
String toString() => value;
}


