//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/i18n_text.dart';
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
          other.examples == examples;

  @override
  int get hashCode =>
      id.hashCode +
      status.hashCode +
      japanese.hashCode +
      (reading == null ? 0 : reading.hashCode) +
      meaning.hashCode +
      (explanation == null ? 0 : explanation.hashCode) +
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
