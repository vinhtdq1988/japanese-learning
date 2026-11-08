//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'license_write.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LicenseWrite {
  /// Returns a new [LicenseWrite] instance.
  LicenseWrite({
    required this.seats,

    required this.startsOn,

    required this.endsOn,

    this.graceDays,

    this.maxReassignments,
  });

  // minimum: 1
  @JsonKey(name: r'seats', required: true, includeIfNull: false)
  final int seats;

  @JsonKey(name: r'startsOn', required: true, includeIfNull: false)
  final DateTime startsOn;

  @JsonKey(name: r'endsOn', required: true, includeIfNull: false)
  final DateTime endsOn;

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
      other is LicenseWrite &&
          other.seats == seats &&
          other.startsOn == startsOn &&
          other.endsOn == endsOn &&
          other.graceDays == graceDays &&
          other.maxReassignments == maxReassignments;

  @override
  int get hashCode =>
      seats.hashCode +
      startsOn.hashCode +
      endsOn.hashCode +
      graceDays.hashCode +
      maxReassignments.hashCode;

  factory LicenseWrite.fromJson(Map<String, dynamic> json) =>
      _$LicenseWriteFromJson(json);

  Map<String, dynamic> toJson() => _$LicenseWriteToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
