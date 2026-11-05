// Kiểm tra bản địa hóa: mọi chuỗi giao diện phải có đủ khóa ở cả `app_vi.arb` và `app_en.arb` (T117).
//
// Chạy từ thư mục `client/`:
//   dart run tool/check_l10n.dart
//
// Quy tắc:
//   1. Tập khóa thông điệp (bỏ `@@...` và `@khóa` là siêu dữ liệu) của hai file phải giống nhau.
//   2. Giá trị không được rỗng.
//   3. Mỗi khóa phải dùng cùng tập placeholder `{tên}` ở hai ngôn ngữ (tránh thiếu tham số khi đổi ngôn ngữ).
// Mã thoát: 0 nếu hợp lệ, 1 nếu có sai lệch, 2 nếu không đọc được file.
import 'dart:convert';
import 'dart:io';

const _viPath = 'lib/l10n/app_vi.arb';
const _enPath = 'lib/l10n/app_en.arb';

/// Tên placeholder ICU ở mọi cấp, ví dụ `{count}` trong `{count, plural, ...}` hoặc `{name}`.
final RegExp _placeholder = RegExp(r'\{\s*(\w+)\s*[,}]');

Map<String, String> _loadMessages(String path) {
  final file = File(path);
  if (!file.existsSync()) {
    stderr.writeln('Không thấy $path; hãy chạy từ thư mục client/.');
    exit(2);
  }
  final decoded = jsonDecode(file.readAsStringSync());
  if (decoded is! Map<String, dynamic>) {
    stderr.writeln('$path không phải đối tượng JSON.');
    exit(2);
  }
  return {
    for (final entry in decoded.entries)
      if (!entry.key.startsWith('@') && entry.value is String) entry.key: entry.value as String,
  };
}

Set<String> _placeholders(String value) =>
    _placeholder.allMatches(value).map((m) => m.group(1)!).toSet();

void main() {
  final vi = _loadMessages(_viPath);
  final en = _loadMessages(_enPath);
  final problems = <String>[];

  for (final key in vi.keys.where((k) => !en.containsKey(k))) {
    problems.add('Thiếu khóa "$key" trong $_enPath');
  }
  for (final key in en.keys.where((k) => !vi.containsKey(k))) {
    problems.add('Thiếu khóa "$key" trong $_viPath');
  }
  for (final key in vi.keys.where(en.containsKey)) {
    if (vi[key]!.trim().isEmpty) problems.add('Giá trị rỗng: "$key" trong $_viPath');
    if (en[key]!.trim().isEmpty) problems.add('Giá trị rỗng: "$key" trong $_enPath');
    final viParams = _placeholders(vi[key]!);
    final enParams = _placeholders(en[key]!);
    if (viParams.length != enParams.length || !viParams.containsAll(enParams)) {
      problems.add(
        'Placeholder của "$key" lệch nhau: vi=${(viParams.toList()..sort())} '
        'en=${(enParams.toList()..sort())}',
      );
    }
  }

  if (problems.isEmpty) {
    stdout.writeln('l10n hợp lệ: ${vi.length} khóa, vi và en khớp nhau.');
    return;
  }
  problems.sort();
  stderr.writeln('l10n không hợp lệ (${problems.length} vấn đề):');
  for (final p in problems) {
    stderr.writeln('  - $p');
  }
  exit(1);
}
