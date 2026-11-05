//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'daily_plan_kanji_notice.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DailyPlanKanjiNotice {
  /// Returns a new [DailyPlanKanjiNotice] instance.
  DailyPlanKanjiNotice({required this.code, required this.suggestion});

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final DailyPlanKanjiNoticeCodeEnum code;

  @JsonKey(name: r'suggestion', required: true, includeIfNull: false)
  final DailyPlanKanjiNoticeSuggestionEnum suggestion;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DailyPlanKanjiNotice &&
          other.code == code &&
          other.suggestion == suggestion;

  @override
  int get hashCode => code.hashCode + suggestion.hashCode;

  factory DailyPlanKanjiNotice.fromJson(Map<String, dynamic> json) =>
      _$DailyPlanKanjiNoticeFromJson(json);

  Map<String, dynamic> toJson() => _$DailyPlanKanjiNoticeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum DailyPlanKanjiNoticeCodeEnum {
  @JsonValue(r'kanji_exhausted')
  kanjiExhausted(r'kanji_exhausted');

  const DailyPlanKanjiNoticeCodeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum DailyPlanKanjiNoticeSuggestionEnum {
  @JsonValue(r'raise_level')
  raiseLevel(r'raise_level'),
  @JsonValue(r'content_exhausted')
  contentExhausted(r'content_exhausted');

  const DailyPlanKanjiNoticeSuggestionEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
