// Chế độ hiệu ứng hình ảnh (spec 005, contracts/client-effects.md §3).

/// Mức hiển thị hiệu ứng hình ảnh.
enum EffectMode {
  /// Hoạt ảnh đầy đủ.
  full,

  /// Giảm chuyển động: chỉ tĩnh hoặc mờ dần/hiện dần, không chuyển động tịnh tiến/xoay/confetti.
  reduced,

  /// Tắt hiệu ứng hình ảnh: kết quả vẫn thể hiện bằng dạng tĩnh (biểu tượng + chữ).
  off,
}

/// Tính chế độ từ tùy chọn người học và cài đặt "giảm chuyển động" của hệ thống
/// (`MediaQuery.disableAnimationsOf(context)`). Tùy chọn tắt luôn thắng.
EffectMode resolveEffectMode({
  required bool visualEnabled,
  required bool reduceMotion,
}) {
  if (!visualEnabled) return EffectMode.off;
  return reduceMotion ? EffectMode.reduced : EffectMode.full;
}
