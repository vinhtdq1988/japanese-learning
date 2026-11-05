//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'progress_summary_kanji.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ProgressSummaryKanji {
  /// Returns a new [ProgressSummaryKanji] instance.
  ProgressSummaryKanji({
    required this.charactersLearned,

    required this.lessonsCompleted,

    required this.minutes,

    this.reviewAccuracy,
  });

  /// Số chữ có ít nhất một khía cạnh đã lên lịch ôn
  @JsonKey(name: r'charactersLearned', required: true, includeIfNull: false)
  final int charactersLearned;

  @JsonKey(name: r'lessonsCompleted', required: true, includeIfNull: false)
  final int lessonsCompleted;

  /// Thời gian học Kanji (phút); phiên ôn hỗn hợp được phân bổ theo tỷ lệ câu trả lời Kanji
  @JsonKey(name: r'minutes', required: true, includeIfNull: false)
  final num minutes;

  // minimum: 0
  // maximum: 1
  @JsonKey(name: r'reviewAccuracy', required: false, includeIfNull: false)
  final num? reviewAccuracy;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProgressSummaryKanji &&
          other.charactersLearned == charactersLearned &&
          other.lessonsCompleted == lessonsCompleted &&
          other.minutes == minutes &&
          other.reviewAccuracy == reviewAccuracy;

  @override
  int get hashCode =>
      charactersLearned.hashCode +
      lessonsCompleted.hashCode +
      minutes.hashCode +
      (reviewAccuracy == null ? 0 : reviewAccuracy.hashCode);

  factory ProgressSummaryKanji.fromJson(Map<String, dynamic> json) =>
      _$ProgressSummaryKanjiFromJson(json);

  Map<String, dynamic> toJson() => _$ProgressSummaryKanjiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
