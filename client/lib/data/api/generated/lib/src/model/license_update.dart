//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'license_update.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LicenseUpdate {
  /// Returns a new [LicenseUpdate] instance.
  LicenseUpdate({
    this.seats,

    this.endsOn,

    this.graceDays,

    this.maxReassignments,
  });

  // minimum: 0
  @JsonKey(name: r'seats', required: false, includeIfNull: false)
  final int? seats;

  @JsonKey(name: r'endsOn', required: false, includeIfNull: false)
  final DateTime? endsOn;

  // minimum: 0
  // maximum: 60
  @JsonKey(name: r'graceDays', required: false, includeIfNull: false)
  final int? graceDays;

  // minimum: 0
  @JsonKey(name: r'maxReassignments', required: false, includeIfNull: false)
  final int? maxReassignments;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LicenseUpdate &&
          other.seats == seats &&
          other.endsOn == endsOn &&
          other.graceDays == graceDays &&
          other.maxReassignments == maxReassignments;

  @override
  int get hashCode =>
      seats.hashCode +
      endsOn.hashCode +
      graceDays.hashCode +
      maxReassignments.hashCode;

  factory LicenseUpdate.fromJson(Map<String, dynamic> json) =>
      _$LicenseUpdateFromJson(json);

  Map<String, dynamic> toJson() => _$LicenseUpdateToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
