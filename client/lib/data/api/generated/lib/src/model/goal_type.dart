//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum GoalType {
  @JsonValue(r'jlpt')
  jlpt(r'jlpt'),
  @JsonValue(r'daily_conversation')
  dailyConversation(r'daily_conversation'),
  @JsonValue(r'work')
  work(r'work');

  const GoalType(this.value);

  final String value;

  @override
  String toString() => value;
}
