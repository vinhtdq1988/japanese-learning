//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/admin_user_page_items_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_user_page.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminUserPage {
  /// Returns a new [AdminUserPage] instance.
  AdminUserPage({this.items, this.nextCursor});

  @JsonKey(name: r'items', required: false, includeIfNull: false)
  final List<AdminUserPageItemsInner>? items;

  @JsonKey(name: r'nextCursor', required: false, includeIfNull: false)
  final String? nextCursor;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminUserPage &&
          other.items == items &&
          other.nextCursor == nextCursor;

  @override
  int get hashCode =>
      items.hashCode + (nextCursor == null ? 0 : nextCursor.hashCode);

  factory AdminUserPage.fromJson(Map<String, dynamic> json) =>
      _$AdminUserPageFromJson(json);

  Map<String, dynamic> toJson() => _$AdminUserPageToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
