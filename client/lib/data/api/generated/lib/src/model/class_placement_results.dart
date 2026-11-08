//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/class_placement_request.dart';
import 'package:japanese_api/src/model/class_placement_results_results_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'class_placement_results.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClassPlacementResults {
  /// Returns a new [ClassPlacementResults] instance.
  ClassPlacementResults({
    required this.request,

    required this.results,

    required this.distribution,
  });

  @JsonKey(name: r'request', required: true, includeIfNull: false)
  final ClassPlacementRequest request;

  @JsonKey(name: r'results', required: true, includeIfNull: false)
  final List<ClassPlacementResultsResultsInner> results;

  /// Số học viên theo `estimatedLevel` (none, N5, N4, N3)
  @JsonKey(name: r'distribution', required: true, includeIfNull: false)
  final Map<String, int> distribution;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassPlacementResults &&
          other.request == request &&
          other.results == results &&
          other.distribution == distribution;

  @override
  int get hashCode =>
      request.hashCode + results.hashCode + distribution.hashCode;

  factory ClassPlacementResults.fromJson(Map<String, dynamic> json) =>
      _$ClassPlacementResultsFromJson(json);

  Map<String, dynamic> toJson() => _$ClassPlacementResultsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
