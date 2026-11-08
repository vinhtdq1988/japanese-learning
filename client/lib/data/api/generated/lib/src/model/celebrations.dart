//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/achievement_earned.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'celebrations.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Celebrations {
  /// Returns a new [Celebrations] instance.
  Celebrations({required this.dayCompleted, required this.achievements});

  /// true khi lần hoàn thành này vừa hoàn thành mục cuối của kế hoạch hôm nay VÀ chưa từng chúc mừng ngày đó (tối đa một lần mỗi ngày, kể cả học thêm).
  @JsonKey(name: r'dayCompleted', required: true, includeIfNull: false)
  final bool dayCompleted;

  /// Sắp theo thứ tự trình bày: `first_lesson`, `perfect_lesson`, `streak`, `items_learned`, `goal_progress`; trong cùng loại theo ngưỡng tăng dần.
  @JsonKey(name: r'achievements', required: true, includeIfNull: false)
  final List<AchievementEarned> achievements;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Celebrations &&
          other.dayCompleted == dayCompleted &&
          other.achievements == achievements;

  @override
  int get hashCode => dayCompleted.hashCode + achievements.hashCode;

  factory Celebrations.fromJson(Map<String, dynamic> json) =>
      _$CelebrationsFromJson(json);

  Map<String, dynamic> toJson() => _$CelebrationsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
