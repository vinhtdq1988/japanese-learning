import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Đảm bảo mọi chuỗi giao diện có đủ khóa ở cả tiếng Việt và tiếng Anh (T117) bằng cách chạy chính
// script `tool/check_l10n.dart`, để CI (`flutter test`) chặn được việc thêm chuỗi mà quên một ngôn ngữ.
void main() {
  test('app_vi.arb và app_en.arb có cùng tập khóa và placeholder', () async {
    final result = await Process.run('dart', ['run', 'tool/check_l10n.dart']);
    expect(result.exitCode, 0, reason: '${result.stderr}');
  });
}
