//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Mục tiêu JLPT; N2/N1 được chấp nhận nhưng nội dung Giai đoạn 1 chỉ đến N3 (`scopeNotice`)
enum TargetLevel {
  @JsonValue(r'N5')
  N5(r'N5'),
  @JsonValue(r'N4')
  N4(r'N4'),
  @JsonValue(r'N3')
  N3(r'N3'),
  @JsonValue(r'N2')
  N2(r'N2'),
  @JsonValue(r'N1')
  N1(r'N1');

  const TargetLevel(this.value);

  final String value;

  @override
  String toString() => value;
}
