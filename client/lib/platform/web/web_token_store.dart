import 'package:web/web.dart' as web;

import '../platform.dart';

/// Lưu token trong `localStorage` của trình duyệt (R4: không dùng cookie để API bearer-token dùng
/// được nguyên vẹn cho client mobile sau này). An toàn phụ thuộc CSP chặt chẽ (T116).
class WebTokenStore implements TokenStore {
  static const String _accessKey = 'jl.access_token';
  static const String _refreshKey = 'jl.refresh_token';

  @override
  Future<StoredTokens?> read() async {
    try {
      final access = web.window.localStorage.getItem(_accessKey);
      final refresh = web.window.localStorage.getItem(_refreshKey);
      if (access == null || refresh == null) return null;
      return StoredTokens(accessToken: access, refreshToken: refresh);
    } catch (_) {
      // Bộ nhớ bị chặn/không truy cập được: coi như chưa đăng nhập.
      return null;
    }
  }

  @override
  Future<void> write(StoredTokens tokens) async {
    try {
      web.window.localStorage.setItem(_accessKey, tokens.accessToken);
      web.window.localStorage.setItem(_refreshKey, tokens.refreshToken);
    } catch (_) {
      // Không ghi được (chế độ riêng tư…): phiên chỉ sống trong lần mở này.
    }
  }

  @override
  Future<void> clear() async {
    try {
      web.window.localStorage.removeItem(_accessKey);
      web.window.localStorage.removeItem(_refreshKey);
    } catch (_) {}
  }
}
