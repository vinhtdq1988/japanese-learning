// Thông số hiệu ứng: hằng số DUY NHẤT cho thời lượng/số nhịp (spec 005, contracts/client-effects.md §4).
// `full`/`reduced`/`off` dùng chung bảng này, và kiểm thử khẳng định ngân sách an toàn FR-023
// (không chớp quá 3 lần/giây, không đổi độ sáng toàn màn hình).

/// Một hiệu ứng ngắn: thời lượng tối đa và số nhịp biên độ (đỉnh sáng) trong thời lượng đó.
class EffectSpec {
  const EffectSpec({
    required this.duration,
    required this.peaks,
    this.changesFullScreenBrightness = false,
  });

  final Duration duration;

  /// Số lần biên độ/độ sáng đạt đỉnh trong `duration` (1 = một nhịp rồi tắt dần).
  final int peaks;

  /// `true` nếu hiệu ứng làm đổi độ sáng của cả màn hình (bị cấm, FR-023).
  final bool changesFullScreenBrightness;
}

/// Cửa sổ kiểm tra chớp: ≤ 1 đỉnh mỗi 333 ms ⇒ ≤ 3 lần/giây, kể cả khi hiệu ứng nối tiếp nhau (FR-023).
const Duration flashWindow = Duration(milliseconds: 333);

/// Trả lời đúng: vòng xung + cụm tia lấp lánh nhỏ, một nhịp.
const EffectSpec correctEffect = EffectSpec(
  duration: Duration(milliseconds: 600),
  peaks: 1,
);

/// Trả lời sai: lớp phủ hổ phách mờ dần, KHÔNG rung/lắc, một nhịp.
const EffectSpec incorrectEffect = EffectSpec(
  duration: Duration(milliseconds: 400),
  peaks: 1,
);

/// Chuỗi đúng liên tiếp: huy hiệu "N liên tiếp" nảy nhẹ một nhịp.
const EffectSpec streakEffect = EffectSpec(
  duration: Duration(milliseconds: 700),
  peaks: 1,
);

/// Mọi hiệu ứng ngắn, để kiểm thử duyệt qua.
const List<EffectSpec> answerEffectSpecs = <EffectSpec>[
  correctEffect,
  incorrectEffect,
  streakEffect,
];

/// Thời gian hiện mỗi thẻ chúc mừng trước khi tự chuyển/đóng.
const Duration celebrationCardDuration = Duration(milliseconds: 3500);

/// Số hạt confetti tối đa của thẻ chúc mừng (giữ ≥ 60 fps trên máy văn phòng).
const int maxConfettiParticles = 40;

/// Thời gian thả confetti (≤ 3 s, chậm, không chớp).
const Duration confettiDuration = Duration(seconds: 3);

/// Số hạt tối đa của hiệu ứng trả lời (cụm tia lấp lánh nhỏ).
const int maxAnswerParticles = 12;

/// Thời gian tự đóng của thông báo tĩnh khi `EffectMode.off`.
const Duration staticNoticeDuration = Duration(milliseconds: 3500);
