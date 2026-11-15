//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// `reading`/`writing` (luyện đọc/viết, spec 007) chỉ có hiệu lực với học viên có quỹ thời gian đang áp dụng từ 30 phút mỗi ngày; không xuất hiện trong placement và dùng thử
enum Skill {
  @JsonValue(r'vocabulary')
  vocabulary(r'vocabulary'),
  @JsonValue(r'grammar')
  grammar(r'grammar'),
  @JsonValue(r'kanji')
  kanji(r'kanji'),
  @JsonValue(r'reading')
  reading(r'reading'),
  @JsonValue(r'writing')
  writing(r'writing');

  const Skill(this.value);

  final String value;

  @override
  String toString() => value;
}
