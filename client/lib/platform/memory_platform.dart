import 'file_transfer.dart';
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

  /// Bản chụp mọi khóa đang lưu, để kiểm thử khẳng định một tính năng KHÔNG ghi gì vào bộ nhớ cục bộ.
  Map<String, String> get snapshot => Map<String, String>.unmodifiable(_values);

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

/// `FileTransfer` trong bộ nhớ cho kiểm thử: trả nội dung CSV định sẵn khi chọn tệp và ghi lại tệp được lưu.
class MemoryFileTransfer implements FileTransfer {
  MemoryFileTransfer({String? pickResult}) : _pickResult = pickResult;

  String? _pickResult;

  /// Các tệp đã lưu theo thứ tự: tên và byte nguyên vẹn.
  final List<({String filename, List<int> bytes})> saved =
      <({String filename, List<int> bytes})>[];

  /// Số lần mở hộp thoại chọn tệp.
  int pickCalls = 0;

  /// Đặt nội dung trả về cho lần chọn tiếp theo; `null` mô phỏng người dùng hủy.
  void setPickResult(String? content) => _pickResult = content;

  @override
  Future<String?> pickCsv() async {
    pickCalls++;
    return _pickResult;
  }

  @override
  Future<void> saveCsv(String filename, List<int> bytes) async =>
      saved.add((filename: filename, bytes: List<int>.unmodifiable(bytes)));
}

/// `SoundPlayer` trong bộ nhớ cho kiểm thử: ghi lại cue đã phát thay vì phát thật.
class MemorySoundPlayer implements SoundPlayer {
  MemorySoundPlayer({this.throwOnPlay = false});

  /// Các cue đã phát theo thứ tự.
  final List<SoundCue> played = <SoundCue>[];

  /// Số lần gọi `stopAll` (kể cả do `play` thay cue trước, chỉ được controller gọi tường minh).
  int stopAllCount = 0;

  /// Số lần gọi `prime` (mở khóa âm thanh trong thao tác người học).
  int primeCount = 0;

  /// Bật để mô phỏng lỗi nền tảng: `play` ném lỗi, controller PHẢI nuốt êm (FR-024).
  bool throwOnPlay;

  @override
  Future<void> prime() async => primeCount++;

  @override
  Future<void> play(SoundCue cue) async {
    if (throwOnPlay) throw StateError('MemorySoundPlayer: lỗi phát giả lập');
    played.add(cue);
  }

  @override
  Future<void> stopAll() async => stopAllCount++;
}
