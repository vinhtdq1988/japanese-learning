//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// `item` cho từ vựng/ngữ pháp và bài tập không gắn chữ; Kanji dùng meaning | reading | word (lịch ôn theo cặp chữ–khía cạnh)
enum ReviewFacet {
  @JsonValue(r'item')
  item(r'item'),
  @JsonValue(r'meaning')
  meaning(r'meaning'),
  @JsonValue(r'reading')
  reading(r'reading'),
  @JsonValue(r'word')
  word(r'word');

  const ReviewFacet(this.value);

  final String value;

  @override
  String toString() => value;
}
