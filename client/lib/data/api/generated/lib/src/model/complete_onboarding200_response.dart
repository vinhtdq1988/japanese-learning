//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/daily_plan.dart';
import 'package:japanese_api/src/model/path_summary.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'complete_onboarding200_response.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CompleteOnboarding200Response {
  /// Returns a new [CompleteOnboarding200Response] instance.
  CompleteOnboarding200Response({this.path, this.today});

  @JsonKey(name: r'path', required: false, includeIfNull: false)
  final PathSummary? path;

  @JsonKey(name: r'today', required: false, includeIfNull: false)
  final DailyPlan? today;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CompleteOnboarding200Response &&
          other.path == path &&
          other.today == today;

  @override
  int get hashCode => path.hashCode + today.hashCode;

  factory CompleteOnboarding200Response.fromJson(Map<String, dynamic> json) =>
      _$CompleteOnboarding200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$CompleteOnboarding200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
