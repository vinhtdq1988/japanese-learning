//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// ok - còn hiệu lực; expiring - còn ≤ SEAT_EXPIRY_WARNING_DAYS đến hạn; in_grace - quá hạn nhưng trong ân hạn; lapsed - hết ân hạn/bị thu hồi
enum LicenseState {
  @JsonValue(r'ok')
  ok(r'ok'),
  @JsonValue(r'expiring')
  expiring(r'expiring'),
  @JsonValue(r'in_grace')
  inGrace(r'in_grace'),
  @JsonValue(r'lapsed')
  lapsed(r'lapsed');

  const LicenseState(this.value);

  final String value;

  @override
  String toString() => value;
}
