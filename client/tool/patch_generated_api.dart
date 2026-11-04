// Vá lỗi của OpenAPI Generator (dart-dio) sau khi sinh API client.
//
// Generator sinh giá trị mặc định của thuộc tính enum sai kiểu ở hai nơi:
//   1. constructor: `this.tier = const XEnum._('core')` ("Enums can't be instantiated");
//   2. `@JsonKey(defaultValue: 'core')` là chuỗi, không phải enum.
// Script đổi cả hai thành `XEnum.core` (snake_case → camelCase, khớp tên thành viên enum).
//
// Chạy từ thư mục `client/` sau mỗi lần sinh lại:
//   dart run tool/patch_generated_api.dart
import 'dart:io';

final RegExp _badDefault = RegExp(r"this\.(\w+) = const (\w+Enum)\._\('(\w+)'\)");

String _camelCase(String snake) {
  final parts = snake.split('_');
  return parts.first +
      parts.skip(1).map((p) => p.isEmpty ? p : p[0].toUpperCase() + p.substring(1)).join();
}

void main() {
  final root = Directory('lib/data/api/generated/lib');
  if (!root.existsSync()) {
    stderr.writeln('Không thấy ${root.path}; hãy chạy từ thư mục client/.');
    exit(1);
  }
  var patched = 0;
  for (final file in root.listSync(recursive: true).whereType<File>()) {
    if (!file.path.endsWith('.dart') || file.path.endsWith('.g.dart')) continue;
    final source = file.readAsStringSync();
    var fixed = source;
    for (final m in _badDefault.allMatches(source)) {
      final field = m[1]!;
      final enumType = m[2]!;
      final value = m[3]!;
      final member = '$enumType.${_camelCase(value)}';
      fixed = fixed.replaceFirst(m[0]!, 'this.$field = $member');
      // JsonKey của đúng trường đó: `defaultValue` đứng ngay trước `name: r'field'`.
      fixed = fixed.replaceFirstMapped(
        RegExp("defaultValue: '$value',(\\s*name: r'$field',)"),
        (jk) => 'defaultValue: $member,${jk[1]}',
      );
    }
    if (fixed != source) {
      file.writeAsStringSync(fixed);
      patched++;
      stdout.writeln('Đã vá ${file.path}');
    }
  }
  stdout.writeln('Hoàn tất: vá $patched file.');
}
