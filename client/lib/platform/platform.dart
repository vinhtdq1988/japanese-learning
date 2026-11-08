// Giao diện nền tảng (Nguyên tắc V): mọi truy cập đặc thù trình duyệt/thiết bị đi qua các giao diện
// dưới đây. Giai đoạn 1 chỉ có triển khai web (`web/`); Android/iOS thêm sau bằng cách viết triển khai
// mới cho cùng giao diện (ví dụ lưu token vào secure storage) mà không đụng vào domain/data/presentation.

export 'sound_player.dart';

/// Cặp token đăng nhập được lưu giữa các lần mở ứng dụng.
class StoredTokens {
  const StoredTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  @override
  bool operator ==(Object other) =>
      other is StoredTokens &&
      other.accessToken == accessToken &&
      other.refreshToken == refreshToken;

  @override
  int get hashCode => Object.hash(accessToken, refreshToken);
}

/// Nơi lưu token đăng nhập. Web: bộ nhớ trình duyệt (CSP chặt chẽ để giảm rủi ro XSS, R4);
/// mobile sau này: secure storage.
abstract interface class TokenStore {
  Future<StoredTokens?> read();
  Future<void> write(StoredTokens tokens);
  Future<void> clear();
}

/// Bộ nhớ cục bộ dạng khóa–giá trị cho dữ liệu không nhạy cảm: nháp, trạng thái phiên dùng thử,
/// hàng đợi sự kiện chưa gửi. Mọi thao tác PHẢI chịu được việc dữ liệu bị mất hoặc không ghi được
/// (chế độ riêng tư, xóa dữ liệu trình duyệt): đọc trả `null`, ghi thất bại thì bỏ qua êm.
abstract interface class LocalStore {
  Future<String?> getString(String key);
  Future<void> setString(String key, String value);
  Future<void> remove(String key);
}

/// Múi giờ của thiết bị.
abstract interface class Timezone {
  /// Tên múi giờ IANA (ví dụ `Asia/Ho_Chi_Minh`); `null` nếu không xác định được
  /// (khi đó giữ mặc định của hồ sơ, người học sửa được ở Hồ sơ).
  Future<String?> currentIanaName();
}

/// Mở liên kết ngoài.
abstract interface class Links {
  Future<void> open(Uri uri);
}
