//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_class_moved_notice.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyClassMovedNotice {
  /// Returns a new [MyClassMovedNotice] instance.
  MyClassMovedNotice({this.fromClassName, this.at});

  @JsonKey(name: r'fromClassName', required: false, includeIfNull: false)
  final String? fromClassName;

  @JsonKey(name: r'at', required: false, includeIfNull: false)
  final DateTime? at;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MyClassMovedNotice &&
          other.fromClassName == fromClassName &&
          other.at == at;

  @override
  int get hashCode => fromClassName.hashCode + at.hashCode;

  factory MyClassMovedNotice.fromJson(Map<String, dynamic> json) =>
      _$MyClassMovedNoticeFromJson(json);

  Map<String, dynamic> toJson() => _$MyClassMovedNoticeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
