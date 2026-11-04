import 'platform.dart';

// Triển khai trong bộ nhớ của các giao diện nền tảng: dùng cho kiểm thử và làm giá trị dự phòng
// khi môi trường không có nơi lưu trữ bền vững.

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this._tokens]);

  StoredTokens? _tokens;

  @override
  Future<StoredTokens?> read() async => _tokens;

  @override
  Future<void> write(StoredTokens tokens) async => _tokens = tokens;

  @override
  Future<void> clear() async => _tokens = null;
}

class MemoryLocalStore implements LocalStore {
  final Map<String, String> _values = <String, String>{};

  @override
  Future<String?> getString(String key) async => _values[key];

  @override
  Future<void> setString(String key, String value) async =>
      _values[key] = value;

  @override
  Future<void> remove(String key) async => _values.remove(key);
}

class FixedTimezone implements Timezone {
  const FixedTimezone([this.name]);

  final String? name;

  @override
  Future<String?> currentIanaName() async => name;
}

/// Ghi lại các liên kết được yêu cầu mở thay vì mở thật.
class RecordingLinks implements Links {
  final List<Uri> opened = <Uri>[];

  @override
  Future<void> open(Uri uri) async => opened.add(uri);
}
