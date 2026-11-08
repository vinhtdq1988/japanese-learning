# Hợp đồng nội bộ phía client: lớp hiệu ứng

**Nhánh**: `005-reward-feedback-effects` | **Đặc tả**: [spec.md](../spec.md) | **Nghiên cứu**: [research.md](../research.md) E9–E18

Tính năng không có giao diện HTTP ngoài những gì ở [api-changes.md](api-changes.md). Tài liệu này ghi các **giao diện nội bộ** giữa các lớp của client Flutter để Nguyên tắc V (cô lập phần riêng của nền tảng) và Nguyên tắc VI (client không chứa quy tắc nghiệp vụ) kiểm chứng được. Không chứa mã cài đặt.

## 1. Lớp trừu tượng nền tảng: `SoundPlayer` (`lib/platform/sound_player.dart`)

```text
enum SoundCue { correct, incorrect, streak, achievement, dayComplete }

abstract interface class SoundPlayer {
  /// Gọi trong thao tác của người học (chạm trả lời) để mở khóa phát âm thanh trên nền tảng có
  /// chính sách tự phát. Không bao giờ ném lỗi.
  Future<void> prime();

  /// Phát cue. Dừng cue đang phát trước đó (FR-005). Mọi lỗi (bị chặn, tệp lỗi, tắt tiếng thiết bị)
  /// được nuốt êm (FR-024). Chỉ được gọi sau thao tác của người học (FR-025).
  Future<void> play(SoundCue cue);

  Future<void> stopAll();
}
```

| Cài đặt | Vị trí | Ghi chú |
|---|---|---|
| Web | `lib/platform/web/web_sound_player.dart` | Web Audio (`AudioContext`, `decodeAudioData`), tệp từ `assets/sounds/*.wav` qua `rootBundle` |
| Bộ nhớ (kiểm thử) | `lib/platform/memory_platform.dart` (`MemorySoundPlayer`) | Ghi lại danh sách cue đã phát và số lần `stopAll`; có chế độ "ném lỗi" để kiểm thử FR-024 |
| Android/iOS | *(chưa làm; Giai đoạn 3)* | Thêm cài đặt mới cho cùng giao diện; không đụng domain/presentation |

Đăng ký qua `platform_providers.dart` (`soundPlayerProvider`) giống `LocalStore`/`TokenStore`. Mã trong `presentation/` và `data/` KHÔNG import `package:web` hay `dart:html`.

### Tài sản âm thanh (`client/assets/sounds/`)

| Tệp | Cue | Thời lượng tối đa | Tính chất |
|---|---|---|---|
| `correct.wav` | `correct` | 0,6 s | Hai nốt đi lên, sáng, vui tai |
| `incorrect.wav` | `incorrect` | 0,4 s | Một nốt trầm mềm, tắt nhanh, trung tính (không trừng phạt) |
| `streak.wav` | `streak` | 0,7 s | Ba nốt đi lên nhanh |
| `achievement.wav` | `achievement` | 1,2 s | Hợp âm rải, nổi bật hơn cue trả lời |
| `day_complete.wav` | `dayComplete` | 1,2 s | Giai điệu ngắn khép lại, ấm |

Sinh bằng `client/tool/generate_sounds.dart` (xác định, không dùng mẫu bên thứ ba). Ràng buộc kiểm thử: WAV PCM 16-bit mono 22,05 kHz; thời lượng không vượt bảng trên; RMS cùng mức trong ±1,5 dB giữa các tệp; đỉnh ≤ −3 dBFS; có fade-in/out; tổng dung lượng ≤ 200 KB.

## 2. Cổng vào hiệu ứng: `EffectsController` (`lib/presentation/effects/effects_controller.dart`)

```text
class EffectsSettings { bool soundEnabled; bool visualEnabled; }   // mặc định cả hai true

// Điểm vào duy nhất cho mọi nơi có phản hồi tức thì (bài học, ôn tập, bài học mẫu):
void onAnswer({ required bool correct, int? streakMilestone });    // 3 | 5 | 10 khi vừa chạm ngưỡng
// Chỉ gọi sau khi nhận SessionSummary của lần hoàn thành mới:
void onCelebrations(Celebrations c);

// Cài đặt:
EffectsSettings get settings;                                       // người học: từ Me.profile; khách: bộ nhớ
Future<void> setSound(bool enabled);                                // người học: PATCH /me, lạc quan; khách: bộ nhớ
Future<void> setVisual(bool enabled);

Stream<AnswerEffectEvent> get answerEvents;                         // { id, correct, streakMilestone? }
```

Quy tắc hành vi (kiểm thử được):

1. `onAnswer`: nếu `soundEnabled` thì `SoundPlayer.play(correct|incorrect)` (hoặc `streak` khi `streakMilestone != null`); luôn phát `AnswerEffectEvent` mới (id tăng dần); widget hiệu ứng tự quyết định hiển thị theo `EffectMode`.
2. Gọi `onAnswer` liên tiếp nhanh: cue mới **thay** cue cũ (`stopAll` trước `play`), event mới thay event cũ — không xếp hàng, không chồng (FR-005).
3. `onCelebrations`: đưa `dayCompleted` (nếu có) rồi từng `achievements[i]` vào hàng đợi của `CelebrationHost`; phát một cue cho mỗi thẻ: `dayComplete` cho lời chúc mừng ngày, `achievement` cho thành tựu — chỉ khi `soundEnabled`.
4. Không có phương thức nào đọc/ghi `LocalStore` cho tùy chọn hoặc hàng đợi chúc mừng (E9, không chúc mừng bù).
5. Bài kiểm tra trình độ KHÔNG gọi controller này (FR-007); có kiểm thử khẳng định `placement_screen` không phụ thuộc `effectsControllerProvider`.

## 3. Hàm thuần: chế độ hiệu ứng (`lib/presentation/effects/effect_mode.dart`)

```text
enum EffectMode { full, reduced, off }
EffectMode resolveEffectMode({ required bool visualEnabled, required bool reduceMotion });
//  visualEnabled=false           -> off
//  visualEnabled=true, reduce    -> reduced   (tĩnh hoặc chuyển mờ nhẹ)
//  visualEnabled=true, !reduce   -> full
```

`reduceMotion` lấy từ `MediaQuery.disableAnimationsOf(context)`. Kiểm thử bảng 2×2.

## 4. Thông số hiệu ứng (`lib/presentation/effects/effect_specs.dart`)

Hằng số duy nhất cho thời lượng/số nhịp, để kiểm thử khẳng định ngân sách an toàn (FR-023) và để `full`/`reduced`/`off` dùng chung.

| Hiệu ứng | Thời lượng tối đa | Số nhịp biên độ | Ghi chú |
|---|---|---|---|
| Đúng | 600 ms | 1 | Vòng xung + tia lấp lánh nhỏ; `reduced`: chỉ mờ dần vòng sáng |
| Sai | 400 ms | 1 | Lớp phủ hổ phách mờ dần; KHÔNG rung/lắc; `reduced`: giống `full` (đã tĩnh) |
| Chuỗi đúng | 700 ms | 1 | Huy hiệu "N liên tiếp" nảy nhẹ; `reduced`: chỉ hiện/mờ |
| Thẻ chúc mừng | 3,5 s mỗi thẻ | — | Confetti ≤ 40 hạt thả chậm; `reduced`: không confetti, chỉ mờ vào/ra |

Bất biến kiểm thử: mỗi hiệu ứng có `peaks ≤ 1` trong cửa sổ 333 ms (⇒ ≤ 3 lần/giây ngay cả khi liên tiếp); không hiệu ứng nào đổi độ sáng toàn màn hình; hạt confetti ≤ 40.

## 5. Màn chúc mừng: `CelebrationHost` (`lib/presentation/effects/celebration_host.dart`)

- Bọc nội dung ở `MaterialApp.router(builder:)`: `Stack[ child, host ]`, **không** `ModalBarrier`.
- Mọi `PointerDown` trên cả ứng dụng (`HitTestBehavior.translucent`) hoặc đổi tuyến → đóng toàn bộ màn gộp; sự kiện vẫn tới nút bên dưới (nút "Tiếp tục" dùng được ngay — Làm rõ Q4).
- Mỗi thẻ tự chuyển/đóng sau 3,5 s; có nút ✕ có nhãn trợ năng.
- Nội dung thẻ: `Semantics(liveRegion: true)`; không lấy tiêu điểm bàn phím.
- Theo `EffectMode`: `full` (confetti), `reduced` (mờ vào/ra), `off` (một dòng thông báo tĩnh ngắn, ví dụ "Thành tựu mới: Chuỗi 7 ngày").
- Thứ tự: lời chúc mừng ngày (nếu `dayCompleted`) → từng thành tựu theo thứ tự phản hồi.

## 6. Nút điều khiển nhanh: `EffectsQuickControl` (`lib/presentation/effects/effects_quick_control.dart`)

- Gắn ở thanh tiêu đề của màn hình bài học (`LessonScreen`) và bài học mẫu (`TrialLessonScreen`): nút bật/tắt âm thanh bằng **một thao tác** (FR-020, SC-005), có `tooltip` và nhãn trợ năng, trạng thái bật/tắt thể hiện bằng biểu tượng (không chỉ màu).
- Khách (không có trang Hồ sơ): thêm nút bật/tắt hiệu ứng hình ảnh cạnh nút âm thanh.
- Người học đăng ký: hai công tắc "Âm thanh" và "Hiệu ứng hình ảnh" ở mục "Hiệu ứng" của `profile_screen.dart` (`EffectsSettingsSection`); mặc định bật.

## 7. Điểm gọi (chỗ nào phát hiệu ứng)

| Nơi | Gọi | Điều kiện |
|---|---|---|
| `LessonController` (bài học + ôn tập) khi server xác nhận kết quả mới | `onAnswer(correct, streakMilestone)` | `duplicate != true`; không phát lại khi khôi phục phiên dở hoặc xả hàng đợi ngoại tuyến sau đó |
| `LessonController.finish()` khi nhận `SessionSummary` | `onCelebrations(summary.celebrations)` | Chỉ khi trường có mặt |
| `trial_lesson_screen.dart` `_submit` | `onAnswer(correct)` | Sau chấm cục bộ; KHÔNG gọi `onCelebrations` (FR-018) |
| `placement_screen.dart` | *(không gọi)* | FR-007 |

`streakMilestone` do `LessonController` tính từ `LessonState.correctStreak` (chỉ lượt chính; xem research E15).
