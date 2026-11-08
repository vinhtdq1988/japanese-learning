//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'import_results_results_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportResultsResultsInner {
  /// Returns a new [ImportResultsResultsInner] instance.
  ImportResultsResultsInner({
    this.row,

    required this.email,

    required this.outcome,
  });

  // minimum: 1
  @JsonKey(name: r'row', required: false, includeIfNull: false)
  final int? row;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'outcome', required: true, includeIfNull: false)
  final ImportResultsResultsInnerOutcomeEnum outcome;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ImportResultsResultsInner &&
          other.row == row &&
          other.email == email &&
          other.outcome == outcome;

  @override
  int get hashCode => row.hashCode + email.hashCode + outcome.hashCode;

  factory ImportResultsResultsInner.fromJson(Map<String, dynamic> json) =>
      _$ImportResultsResultsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$ImportResultsResultsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum ImportResultsResultsInnerOutcomeEnum {
  @JsonValue(r'invited')
  invited(r'invited'),
  @JsonValue(r'invalid_email')
  invalidEmail(r'invalid_email'),
  @JsonValue(r'duplicate_in_file')
  duplicateInFile(r'duplicate_in_file'),
  @JsonValue(r'already_in_class')
  alreadyInClass(r'already_in_class'),
  @JsonValue(r'already_in_other_class')
  alreadyInOtherClass(r'already_in_other_class'),
  @JsonValue(r'already_invited')
  alreadyInvited(r'already_invited'),
  @JsonValue(r'no_seat')
  noSeat(r'no_seat'),
  @JsonValue(r'unavailable')
  unavailable(r'unavailable');

  const ImportResultsResultsInnerOutcomeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
