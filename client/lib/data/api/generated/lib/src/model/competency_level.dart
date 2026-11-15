//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Xanh lục / vàng nhạt / chưa đủ dữ liệu (trung tính). Quy tắc: specs/007-fix-comments/contracts/competency-rules.md
enum CompetencyLevel {
  @JsonValue(r'good')
  good(r'good'),
  @JsonValue(r'needs_improvement')
  needsImprovement(r'needs_improvement'),
  @JsonValue(r'insufficient')
  insufficient(r'insufficient');

  const CompetencyLevel(this.value);

  final String value;

  @override
  String toString() => value;
}
