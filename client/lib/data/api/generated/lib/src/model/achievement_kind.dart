//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum AchievementKind {
  @JsonValue(r'first_lesson')
  firstLesson(r'first_lesson'),
  @JsonValue(r'streak')
  streak(r'streak'),
  @JsonValue(r'items_learned')
  itemsLearned(r'items_learned'),
  @JsonValue(r'goal_progress')
  goalProgress(r'goal_progress'),
  @JsonValue(r'perfect_lesson')
  perfectLesson(r'perfect_lesson');

  const AchievementKind(this.value);

  final String value;

  @override
  String toString() => value;
}
