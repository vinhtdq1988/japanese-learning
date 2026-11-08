//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum ClassProgressStatus {
  @JsonValue(r'on_track')
  onTrack(r'on_track'),
  @JsonValue(r'behind')
  behind(r'behind'),
  @JsonValue(r'ahead')
  ahead(r'ahead'),
  @JsonValue(r'paused')
  paused(r'paused');

  const ClassProgressStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
