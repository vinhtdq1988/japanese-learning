//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'master_result.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MasterResult {
  /// Returns a new [MasterResult] instance.
  MasterResult({required this.remainingUnits, this.suggestion});

  /// Số đơn vị còn có thể học (chưa học hoặc đang học dở, chưa thành thạo) trong khoảng trình độ của lộ trình hiện tại
  @JsonKey(name: r'remainingUnits', required: true, includeIfNull: false)
  final int remainingUnits;

  /// Chỉ có khi remainingUnits = 0. raise_level: còn nội dung ở trình độ cao hơn (≤ N3) – client mời nâng trình độ (PATCH /me currentLevel → level_change) hoặc làm lại placement; content_exhausted: đã ở trần N3 – dùng chung mã với thông báo hết nội dung
  @JsonKey(name: r'suggestion', required: false, includeIfNull: false)
  final MasterResultSuggestionEnum? suggestion;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MasterResult &&
          other.remainingUnits == remainingUnits &&
          other.suggestion == suggestion;

  @override
  int get hashCode =>
      remainingUnits.hashCode + (suggestion == null ? 0 : suggestion.hashCode);

  factory MasterResult.fromJson(Map<String, dynamic> json) =>
      _$MasterResultFromJson(json);

  Map<String, dynamic> toJson() => _$MasterResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// Chỉ có khi remainingUnits = 0. raise_level: còn nội dung ở trình độ cao hơn (≤ N3) – client mời nâng trình độ (PATCH /me currentLevel → level_change) hoặc làm lại placement; content_exhausted: đã ở trần N3 – dùng chung mã với thông báo hết nội dung
enum MasterResultSuggestionEnum {
  @JsonValue(r'raise_level')
  raiseLevel(r'raise_level'),
  @JsonValue(r'content_exhausted')
  contentExhausted(r'content_exhausted');

  const MasterResultSuggestionEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
