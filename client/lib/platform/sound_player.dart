// Giao diện phát âm thanh phản hồi (Nguyên tắc V, spec 005): mọi truy cập Web Audio/thiết bị đi qua đây.
// Web có cài đặt riêng (`web/web_sound_player.dart`); kiểm thử dùng `MemorySoundPlayer`; Android/iOS thêm sau
// bằng một cài đặt mới mà không đụng vào presentation.

/// Cue âm thanh ngắn, ứng với một sự kiện thưởng/phản hồi.
enum SoundCue {
  /// Trả lời đúng.
  correct,

  /// Trả lời chưa đúng (nhẹ nhàng, không trừng phạt).
  incorrect,

  /// Đạt ngưỡng chuỗi đúng liên tiếp trong phiên.
  streak,

  /// Đạt thành tựu.
  achievement,

  /// Hoàn thành kế hoạch hôm nay.
  dayComplete,
}

abstract interface class SoundPlayer {
  /// Gọi TRONG thao tác của người học (chạm trả lời) để mở khóa phát âm thanh trên nền tảng có chính sách
  /// tự phát (FR-025). Không bao giờ ném lỗi.
  Future<void> prime();

  /// Phát cue. Dừng cue đang phát trước đó (FR-005). Mọi lỗi (bị chặn, tệp lỗi, thiết bị tắt tiếng) được
  /// nuốt êm, không hiện cho người học (FR-024). Chỉ được gọi sau thao tác của người học (FR-025).
  Future<void> play(SoundCue cue);

  /// Dừng mọi cue đang phát.
  Future<void> stopAll();
}
