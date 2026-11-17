//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'study_defaults_items_inner.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StudyDefaultsItemsInner {
  /// Returns a new [StudyDefaultsItemsInner] instance.
  StudyDefaultsItemsInner({

    required  this.dailyMinutes,

    required  this.skills,
  });

  @JsonKey(
    
    name: r'dailyMinutes',
    required: true,
    includeIfNull: false,
  )


  final StudyDefaultsItemsInnerDailyMinutesEnum dailyMinutes;



      /// Kỹ năng gợi ý bật; tập của mức nhỏ hơn là tập con của mức lớn hơn; `reading`, `writing` chỉ ở mức 30
  @JsonKey(
    
    name: r'skills',
    required: true,
    includeIfNull: false,
  )


  final List<Skill> skills;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StudyDefaultsItemsInner &&
      other.dailyMinutes == dailyMinutes &&
      other.skills == skills;

    @override
    int get hashCode =>
        dailyMinutes.hashCode +
        skills.hashCode;

  factory StudyDefaultsItemsInner.fromJson(Map<String, dynamic> json) => _$StudyDefaultsItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$StudyDefaultsItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum StudyDefaultsItemsInnerDailyMinutesEnum {
@JsonValue(5)
number5('5'),
@JsonValue(10)
number10('10'),
@JsonValue(15)
number15('15'),
@JsonValue(30)
number30('30');

const StudyDefaultsItemsInnerDailyMinutesEnum(this.value);

final String value;

@override
String toString() => value;
}


