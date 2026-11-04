//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

enum AccountStatus {
  @JsonValue(r'active')
  active(r'active'),
  @JsonValue(r'disabled')
  disabled(r'disabled'),
  @JsonValue(r'pending_deletion')
  pendingDeletion(r'pending_deletion');

  const AccountStatus(this.value);

  final String value;

  @override
  String toString() => value;
}
