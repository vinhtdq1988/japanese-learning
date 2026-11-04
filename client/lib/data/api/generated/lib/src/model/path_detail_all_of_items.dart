//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/skill.dart';
import 'package:japanese_api/src/model/content_level.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'path_detail_all_of_items.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PathDetailAllOfItems {
  /// Returns a new [PathDetailAllOfItems] instance.
  PathDetailAllOfItems({
    this.unitId,

    this.title,

    this.kind,

    this.level,

    this.estMinutes,

    this.status,
  });

  @JsonKey(name: r'unitId', required: false, includeIfNull: false)
  final String? unitId;

  /// Văn bản đã được bản địa hóa theo ngôn ngữ yêu cầu
  @JsonKey(name: r'title', required: false, includeIfNull: false)
  final String? title;

  @JsonKey(name: r'kind', required: false, includeIfNull: false)
  final Skill? kind;

  @JsonKey(name: r'level', required: false, includeIfNull: false)
  final ContentLevel? level;

  @JsonKey(name: r'estMinutes', required: false, includeIfNull: false)
  final int? estMinutes;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final PathDetailAllOfItemsStatusEnum? status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PathDetailAllOfItems &&
          other.unitId == unitId &&
          other.title == title &&
          other.kind == kind &&
          other.level == level &&
          other.estMinutes == estMinutes &&
          other.status == status;

  @override
  int get hashCode =>
      unitId.hashCode +
      title.hashCode +
      kind.hashCode +
      level.hashCode +
      estMinutes.hashCode +
      status.hashCode;

  factory PathDetailAllOfItems.fromJson(Map<String, dynamic> json) =>
      _$PathDetailAllOfItemsFromJson(json);

  Map<String, dynamic> toJson() => _$PathDetailAllOfItemsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum PathDetailAllOfItemsStatusEnum {
  @JsonValue(r'pending')
  pending(r'pending'),
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed'),
  @JsonValue(r'mastered')
  mastered(r'mastered');

  const PathDetailAllOfItemsStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
