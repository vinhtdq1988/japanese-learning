//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// `content_ceiling_n3`: trình độ hoặc mục tiêu N2/N1 bị cắt ở N3 (như `scopeNotice`). `listening_not_available`: mục tiêu JLPT — ứng dụng chưa có phần nghe hiểu của kỳ thi (Giai đoạn 2). 
enum ScopeNoticeCode {
  @JsonValue(r'content_ceiling_n3')
  contentCeilingN3(r'content_ceiling_n3'),
  @JsonValue(r'listening_not_available')
  listeningNotAvailable(r'listening_not_available');

  const ScopeNoticeCode(this.value);

  final String value;

  @override
  String toString() => value;
}
