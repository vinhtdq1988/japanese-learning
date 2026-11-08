//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/admin_organization_row.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'admin_organization_page.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AdminOrganizationPage {
  /// Returns a new [AdminOrganizationPage] instance.
  AdminOrganizationPage({required this.items, required this.total, this.page});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<AdminOrganizationRow> items;

  @JsonKey(name: r'total', required: true, includeIfNull: false)
  final int total;

  @JsonKey(name: r'page', required: false, includeIfNull: false)
  final int? page;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AdminOrganizationPage &&
          other.items == items &&
          other.total == total &&
          other.page == page;

  @override
  int get hashCode => items.hashCode + total.hashCode + page.hashCode;

  factory AdminOrganizationPage.fromJson(Map<String, dynamic> json) =>
      _$AdminOrganizationPageFromJson(json);

  Map<String, dynamic> toJson() => _$AdminOrganizationPageToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
