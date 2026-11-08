//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:japanese_api/src/model/shared_data_item.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'shared_data_disclosure.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SharedDataDisclosure {
  /// Returns a new [SharedDataDisclosure] instance.
  SharedDataDisclosure({
    required this.version,

    required this.visible,

    required this.notVisible,

    required this.lockedControls,

    required this.canLeaveAnytime,

    required this.mayBeMovedWithinOrganization,
  });

  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @JsonKey(name: r'visible', required: true, includeIfNull: false)
  final List<SharedDataItem> visible;

  /// mật khẩu/phiên, hoạt động trước ngày vào lớp, từng câu trả lời, dữ liệu hồ sơ ngoài danh sách
  @JsonKey(name: r'notVisible', required: true, includeIfNull: false)
  final List<String> notVisible;

  /// các quyền bị khóa khi thuộc lớp
  @JsonKey(name: r'lockedControls', required: true, includeIfNull: false)
  final List<String> lockedControls;

  @JsonKey(name: r'canLeaveAnytime', required: true, includeIfNull: false)
  final bool canLeaveAnytime;

  @JsonKey(
    name: r'mayBeMovedWithinOrganization',
    required: true,
    includeIfNull: false,
  )
  final bool mayBeMovedWithinOrganization;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SharedDataDisclosure &&
          other.version == version &&
          other.visible == visible &&
          other.notVisible == notVisible &&
          other.lockedControls == lockedControls &&
          other.canLeaveAnytime == canLeaveAnytime &&
          other.mayBeMovedWithinOrganization == mayBeMovedWithinOrganization;

  @override
  int get hashCode =>
      version.hashCode +
      visible.hashCode +
      notVisible.hashCode +
      lockedControls.hashCode +
      canLeaveAnytime.hashCode +
      mayBeMovedWithinOrganization.hashCode;

  factory SharedDataDisclosure.fromJson(Map<String, dynamic> json) =>
      _$SharedDataDisclosureFromJson(json);

  Map<String, dynamic> toJson() => _$SharedDataDisclosureToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
