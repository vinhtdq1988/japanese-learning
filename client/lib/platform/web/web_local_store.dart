import 'package:web/web.dart' as web;

import '../platform.dart';

/// `LocalStore` trên `localStorage`. Mọi lỗi (chặn lưu trữ, hết dung lượng) được nuốt để luồng học
/// vẫn chạy được khi không lưu nháp/hàng đợi.
class WebLocalStore implements LocalStore {
  /// Tiền tố khóa để không đụng dữ liệu của ứng dụng khác trên cùng origin.
  static const String _prefix = 'jl.';

  @override
  Future<String?> getString(String key) async {
    try {
      return web.window.localStorage.getItem('$_prefix$key');
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> setString(String key, String value) async {
    try {
      web.window.localStorage.setItem('$_prefix$key', value);
    } catch (_) {}
  }

  @override
  Future<void> remove(String key) async {
    try {
      web.window.localStorage.removeItem('$_prefix$key');
    } catch (_) {}
  }
}
