//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:japanese_api/src/model/kanji_details_write.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_unit_write_items_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUnitWriteItemsInner {
  /// Returns a new [AdminUnitWriteItemsInner] instance.
  AdminUnitWriteItemsInner({
    this.id,

    this.status = AdminUnitWriteItemsInnerStatusEnum.active,

    required this.japanese,

    this.reading,

    required this.meaning,

    this.explanation,

    this.topicId,

    this.kanjiDetails,

    this.examples,
  });

  /// Có khi sửa mục đã tồn tại
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(
    defaultValue: AdminUnitWriteItemsInnerStatusEnum.active,
    name: r'status',
    required: false,
    includeIfNull: false,
  )
  final AdminUnitWriteItemsInnerStatusEnum? status;

  @JsonKey(name: r'japanese', required: true, includeIfNull: false)
  final String japanese;

  @JsonKey(name: r'reading', required: false, includeIfNull: false)
  final String? reading;

  @JsonKey(name: r'meaning', required: true, includeIfNull: false)
  final I18nText meaning;

  @JsonKey(name: r'explanation', required: false, includeIfNull: false)
  final I18nText? explanation;

  /// Bắt buộc khi kind=kanji lúc kích hoạt (chủ đề skill=kanji); bỏ qua với kind khác. Lưu nháp không bắt buộc
  @JsonKey(name: r'topicId', required: false, includeIfNull: false)
  final String? topicId;

  /// Bắt buộc đầy đủ khi kích hoạt kind=kanji (lưu nháp chấp nhận null); `reading` khi đó để null
  @JsonKey(name: r'kanjiDetails', required: false, includeIfNull: false)
  final KanjiDetailsWrite? kanjiDetails;

  /// `[{ja, reading, translation: I18nText, kanjiReading?}]`
  @JsonKey(name: r'examples', required: false, includeIfNull: false)
  final List<Object>? examples;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUnitWriteItemsInner &&
          other.id == id &&
          other.status == status &&
          other.japanese == japanese &&
          other.reading == reading &&
          other.meaning == meaning &&
          other.explanation == explanation &&
          other.topicId == topicId &&
          other.kanjiDetails == kanjiDetails &&
          other.examples == examples;

  @override
  int get hashCode =>
      id.hashCode +
      status.hashCode +
      japanese.hashCode +
      (reading == null ? 0 : reading.hashCode) +
      meaning.hashCode +
      (explanation == null ? 0 : explanation.hashCode) +
      (topicId == null ? 0 : topicId.hashCode) +
      (kanjiDetails == null ? 0 : kanjiDetails.hashCode) +
      examples.hashCode;

  factory AdminUnitWriteItemsInner.fromJson(Map<String, dynamic> json) =>
      _$AdminUnitWriteItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUnitWriteItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminUnitWriteItemsInnerStatusEnum {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'inactive')
  inactive(r'inactive');

  const AdminUnitWriteItemsInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
