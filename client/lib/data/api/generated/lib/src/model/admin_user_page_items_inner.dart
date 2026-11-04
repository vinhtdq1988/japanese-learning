//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/account_status.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_user_page_items_inner.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUserPageItemsInner {
  /// Returns a new [AdminUserPageItemsInner] instance.
  AdminUserPageItemsInner({
    this.id,

    this.email,

    this.displayName,

    this.status,

    this.createdAt,
  });

  @JsonKey(name: r'id', required: false, includeIfNull: false)
  final String? id;

  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'status', required: false, includeIfNull: false)
  final AccountStatus? status;

  @JsonKey(name: r'createdAt', required: false, includeIfNull: false)
  final DateTime? createdAt;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUserPageItemsInner &&
          other.id == id &&
          other.email == email &&
          other.displayName == displayName &&
          other.status == status &&
          other.createdAt == createdAt;

  @override
  int get hashCode =>
      id.hashCode +
      email.hashCode +
      displayName.hashCode +
      status.hashCode +
      createdAt.hashCode;

  factory AdminUserPageItemsInner.fromJson(Map<String, dynamic> json) =>
      _$AdminUserPageItemsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUserPageItemsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
