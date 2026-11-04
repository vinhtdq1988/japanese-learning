//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/onboarding_draft.dart';
import 'package:japanese_api/src/model/placement_result.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'onboarding_state.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OnboardingState {
  /// Returns a new [OnboardingState] instance.
  OnboardingState({this.state, this.draft, this.carriedPlacement});

  @JsonKey(name: r'state', required: false, includeIfNull: false)
  final OnboardingStateStateEnum? state;

  @JsonKey(name: r'draft', required: false, includeIfNull: false)
  final OnboardingDraft? draft;

  @JsonKey(name: r'carriedPlacement', required: false, includeIfNull: false)
  final PlacementResult? carriedPlacement;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OnboardingState &&
          other.state == state &&
          other.draft == draft &&
          other.carriedPlacement == carriedPlacement;

  @override
  int get hashCode =>
      state.hashCode +
      draft.hashCode +
      (carriedPlacement == null ? 0 : carriedPlacement.hashCode);

  factory OnboardingState.fromJson(Map<String, dynamic> json) =>
      _$OnboardingStateFromJson(json);

  Map<String, dynamic> toJson() => _$OnboardingStateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum OnboardingStateStateEnum {
  @JsonValue(r'not_started')
  notStarted(r'not_started'),
  @JsonValue(r'in_progress')
  inProgress(r'in_progress'),
  @JsonValue(r'completed')
  completed(r'completed');

  const OnboardingStateStateEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
