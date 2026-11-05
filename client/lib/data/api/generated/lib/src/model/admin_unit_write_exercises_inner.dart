//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/i18n_text.dart';
import 'package:japanese_api/src/model/review_facet.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_unit_write_exercises_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUnitWriteExercisesInner {
  /// Returns a new [AdminUnitWriteExercisesInner] instance.
  AdminUnitWriteExercisesInner({
    this.id,

    this.status = AdminUnitWriteExercisesInnerStatusEnum.active,

    this.itemIndex,

    this.facet = ReviewFacet.item,

    required this.type,

    required this.prompt,

    required this.payload,

    required this.feedbackCorrect,

    required this.feedbackIncorrect,
  });

  /// Có khi sửa bài tập đã tồn tại
  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(
    defaultValue: AdminUnitWriteExercisesInnerStatusEnum.active,
    name: r'status',
    required: false,
    includeIfNull: false,
  )
  final AdminUnitWriteExercisesInnerStatusEnum? status;

  /// Chỉ số (từ 0) của mục trong `items` cùng payload mà bài tập kiểm tra; null/vắng = không gắn mục (không vào lịch ôn tập). Khi đọc, tính theo thứ tự `items` trả về
  // minimum: 0
  @JsonKey(name: r'itemIndex', required: false, includeIfNull: false)
  final int? itemIndex;

  /// Bài tập gắn chữ Kanji (`itemIndex` khác null trong đơn vị Kanji) PHẢI có meaning | reading | word; bài tập khác PHẢI là item
  @JsonKey(
    defaultValue: ReviewFacet.item,
    name: r'facet',
    required: false,
    includeIfNull: false,
  )
  final ReviewFacet? facet;

  @JsonKey(name: r'type', required: true, includeIfNull: false)
  final AdminUnitWriteExercisesInnerTypeEnum type;

  @JsonKey(name: r'prompt', required: true, includeIfNull: false)
  final I18nText prompt;

  /// Gồm đáp án cố định (xem data-model.md §2.10)
  @JsonKey(name: r'payload', required: true, includeIfNull: false)
  final Object payload;

  @JsonKey(name: r'feedbackCorrect', required: true, includeIfNull: false)
  final I18nText feedbackCorrect;

  @JsonKey(name: r'feedbackIncorrect', required: true, includeIfNull: false)
  final I18nText feedbackIncorrect;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUnitWriteExercisesInner &&
          other.id == id &&
          other.status == status &&
          other.itemIndex == itemIndex &&
          other.facet == facet &&
          other.type == type &&
          other.prompt == prompt &&
          other.payload == payload &&
          other.feedbackCorrect == feedbackCorrect &&
          other.feedbackIncorrect == feedbackIncorrect;

  @override
  int get hashCode =>
      id.hashCode +
      status.hashCode +
      (itemIndex == null ? 0 : itemIndex.hashCode) +
      facet.hashCode +
      type.hashCode +
      prompt.hashCode +
      payload.hashCode +
      feedbackCorrect.hashCode +
      feedbackIncorrect.hashCode;

  factory AdminUnitWriteExercisesInner.fromJson(Map<String, dynamic> json) =>
      _$AdminUnitWriteExercisesInnerFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUnitWriteExercisesInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AdminUnitWriteExercisesInnerStatusEnum {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'inactive')
  inactive(r'inactive');

  const AdminUnitWriteExercisesInnerStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum AdminUnitWriteExercisesInnerTypeEnum {
  @JsonValue(r'multiple_choice')
  multipleChoice(r'multiple_choice'),
  @JsonValue(r'matching')
  matching(r'matching'),
  @JsonValue(r'fill_blank')
  fillBlank(r'fill_blank');

  const AdminUnitWriteExercisesInnerTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
