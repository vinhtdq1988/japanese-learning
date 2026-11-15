# Quy tắc phân loại năng lực và màu sắc

**Nhánh**: `007-fix-comments` | **Đặc tả**: FR-014…FR-020 | **Nghiên cứu**: [research.md §P7–P9](../research.md)

Một nguồn duy nhất cho mọi màn hình: hàm `classifyCompetency` ở backend (`engine/competency.ts`); client chỉ **hiển thị** mức nhận được từ API và không tự phân loại.

## 1. Quy tắc phân loại

Đầu vào: `answered` (số câu lượt chính trong cửa sổ trượt gần nhất, tối đa 20 mỗi chủ đề; **không** tính câu hỏi lại cuối phiên) và `correct`.

| Điều kiện (đánh giá từ trên xuống, dừng ở điều kiện đầu tiên đúng) | Mức | Màu |
|---|---|---|
| `answered < 8` | `insufficient` | Trung tính + chú thích "chưa đủ dữ liệu" |
| `correct / answered ≥ 0.70` | `good` | **Xanh lục** |
| còn lại (`< 0.70`) | `needs_improvement` | **Vàng nhạt** |

Hằng số: `COMPETENCY_MIN_ANSWERS = WEAK_MIN_ANSWERS = 8`, `COMPETENCY_GOOD_AT = RECOVER_AT = 0.70` ([difficulty.ts](../../../backend/src/engine/difficulty.ts)). Ngưỡng đúng bằng 0.70 thuộc `good` → một mức duy nhất cho mỗi đầu mục (không bao giờ hai màu).

**Mức của chủ đề**: từ `topic_stats.recent_results` của chủ đề.
**Mức của kỹ năng**: cộng `answered` và `correct` của mọi chủ đề có `topics.skill` = kỹ năng, rồi áp cùng quy tắc.

### Nhất quán với "mảng làm kém"

`is_weak` đặt khi `accuracy < 0.60` với ≥ 8 câu và chỉ bỏ khi `accuracy ≥ 0.70`. Do đó: mọi chủ đề `is_weak` ⇒ `accuracy < 0.70` ⇒ `needs_improvement`; chủ đề `good` ⇒ `accuracy ≥ 0.70` ⇒ không `is_weak`. Danh sách `weakTopics` là **tập con** của tập chủ đề vàng; khoảng [0.60, 0.70) là vàng nhưng chưa bị liệt kê là "yếu" (research C3).

### Bảng ví dụ (kiểm thử biên)

| answered | correct | accuracy | Mức |
|---|---|---|---|
| 0 | 0 | – | insufficient |
| 7 | 7 | 1.00 | insufficient (chưa đủ 8 câu) |
| 8 | 5 | 0.625 | needs_improvement |
| 10 | 7 | 0.70 | **good** (đúng ngưỡng) |
| 20 | 13 | 0.65 | needs_improvement (không `is_weak` nếu chưa từng < 0.60, nhưng vẫn vàng) |
| 20 | 11 | 0.55 | needs_improvement (và `is_weak`) |
| 16 | 15 | 0.9375 | good |

## 2. Nơi hiển thị

| Màn hình | Đầu mục | Mức lấy từ |
|---|---|---|
| Hôm nay | Từng mục `new_unit` (chip kỹ năng) | `PlanItem.competency` (mức kỹ năng); `review_batch` → trung tính không nhãn năng lực |
| Lộ trình | Từng đơn vị | `PathDetail.items[].competency` (mức chủ đề) |
| Tiến độ | Dải "Năng lực theo kỹ năng" (5 chip) + danh sách chủ đề (kể cả mảng yếu) | `ProgressSummary.competency` |

Cùng thời điểm, cùng đầu mục ⇒ cùng mức ở mọi màn (cùng truy vấn `topic_stats`, cùng hàm).

## 3. Trình bày (client)

Ba mức bắt buộc đi kèm **biểu tượng + nhãn chữ** (FR-019). Giá trị màu cụ thể là token trong `CompetencyPalette` (ThemeExtension, có bản sáng và tối); bảng dưới là gợi ý khởi điểm, kiểm chốt bằng bài kiểm thử tương phản.

| Mức | Biểu tượng | Nhãn vi / en | Nền (sáng) | Chữ/viền (sáng) |
|---|---|---|---|---|
| `good` | `check_circle` | "Tốt" / "Strong" | xanh lục nhạt `#E3F4E4` | xanh lục đậm `#1B5E20` |
| `needs_improvement` | `trending_up` hoặc `flag` | "Cần cải thiện" / "Needs practice" | vàng nhạt `#FFF6CC` | nâu vàng đậm `#5C4A00` |
| `insufficient` | `hourglass_empty` hoặc `radio_button_unchecked` | "Chưa đủ dữ liệu" / "Not enough data" | `surfaceContainer` | `onSurfaceVariant` |

Quy tắc:

- Tỷ lệ tương phản WCAG chữ/nền **≥ 4.5:1** cho cả ba mức ở cả giao diện sáng và tối (kiểm thử đơn vị tính tỷ lệ từ token).
- `Semantics(label)` của chip nêu mức bằng lời ("Từ vựng: Tốt").
- **Chú giải** `CompetencyLegend`: một dòng ngắn nêu ý nghĩa ba mức, hiện ở Hôm nay, Lộ trình, Tiến độ (FR-020); gồm biểu tượng + nhãn như chip.
- Màn hình hẹp: chip và chú giải xuống dòng (`Wrap`), không che nội dung khác.
- Người học chưa có đủ dữ liệu ở mọi mảng: toàn bộ chip trung tính, chú giải vẫn hiện; không thông báo "yếu" nào.

## 4. Kiểm thử bằng hồ sơ mẫu (SC-005)

Hồ sơ đại diện bao phủ ba mức (bổ sung vào `tests/fixtures/learner-profiles/`): `competency-mixed` (mạnh từ vựng – yếu Kanji, người học 30 phút có luyện đọc tốt/luyện viết chưa đủ dữ liệu), `competency-new` (chưa có dữ liệu), `competency-recovering` (từng yếu nay ≥ 70%). Mỗi hồ sơ có bảng đáp án mong đợi theo kỹ năng và chủ đề; kiểm thử hợp đồng so cả ba endpoint với cùng bảng.
