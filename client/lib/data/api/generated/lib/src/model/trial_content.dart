//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/trial_content_units_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'trial_content.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TrialContent {
  /// Returns a new [TrialContent] instance.
  TrialContent({this.units});

  @JsonKey(name: r'units', required: false, includeIfNull: false)
  final List<TrialContentUnitsInner>? units;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is TrialContent && other.units == units;

  @override
  int get hashCode => units.hashCode;

  factory TrialContent.fromJson(Map<String, dynamic> json) =>
      _$TrialContentFromJson(json);

  Map<String, dynamic> toJson() => _$TrialContentToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
