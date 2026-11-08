//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/achievement_kind.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'achievement_earned.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AchievementEarned {
  /// Returns a new [AchievementEarned] instance.
  AchievementEarned({
    required this.code,

    required this.kind,

    this.threshold,

    required this.name,

    required this.description,
  });

  /// Mã ổn định trong danh mục cố định (xem specs/005-reward-feedback-effects/contracts/achievement-catalog.md), ví dụ `streak_7`, `items_100`, `goal_50`, `first_lesson`, `perfect_lesson`.
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'kind', required: true, includeIfNull: false)
  final AchievementKind kind;

  /// Ngưỡng của mốc (ngày, số mục hoặc phần trăm). Vắng với `first_lesson` và `perfect_lesson`.
  // minimum: 1
  @JsonKey(name: r'threshold', required: false, includeIfNull: false)
  final int? threshold;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'description', required: true, includeIfNull: false)
  final String description;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AchievementEarned &&
          other.code == code &&
          other.kind == kind &&
          other.threshold == threshold &&
          other.name == name &&
          other.description == description;

  @override
  int get hashCode =>
      code.hashCode +
      kind.hashCode +
      threshold.hashCode +
      name.hashCode +
      description.hashCode;

  factory AchievementEarned.fromJson(Map<String, dynamic> json) =>
      _$AchievementEarnedFromJson(json);

  Map<String, dynamic> toJson() => _$AchievementEarnedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
