//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/import_results_results_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'import_results.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportResults {
  /// Returns a new [ImportResults] instance.
  ImportResults({required this.summary, required this.results});

  /// Đếm theo `outcome`, kèm `total`
  @JsonKey(name: r'summary', required: true, includeIfNull: false)
  final Map<String, int> summary;

  @JsonKey(name: r'results', required: true, includeIfNull: false)
  final List<ImportResultsResultsInner> results;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ImportResults &&
          other.summary == summary &&
          other.results == results;

  @override
  int get hashCode => summary.hashCode + results.hashCode;

  factory ImportResults.fromJson(Map<String, dynamic> json) =>
      _$ImportResultsFromJson(json);

  Map<String, dynamic> toJson() => _$ImportResultsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
