# Danh mục lời khích lệ ở màn hình "Hôm nay"

**Nhánh**: `007-fix-comments` | **Đặc tả**: FR-026…FR-031, SC-007, SC-008 | **Nghiên cứu**: [research.md §P12–P13](../research.md)

Danh mục là hằng số trong mã (`backend/src/domain/encouragement.ts`), không phải bảng CSDL; chọn trạng thái ở `engine/encouragement.ts` (hàm thuần). Văn bản dưới đây là **bản gốc chờ chủ dự án duyệt giọng điệu** (SC-007); sửa chữ không đổi hợp đồng. `{n}` được thay bằng số ngày của chuỗi.

## 1. Chọn trạng thái (đúng một trạng thái, ưu tiên từ trên xuống)

| # | `state` | Điều kiện | Tín hiệu |
|---|---|---|---|
| 1 | `day_completed` | Kế hoạch hôm nay `status = completed` | `daily_plans.status` |
| 2 | `welcome_back` | Vắng ≥ 2 ngày (không tính ngày tạm dừng) VÀ hôm nay chưa xong mục nào | `absentDays ≥ GAP_THRESHOLD_DAYS` hoặc `notice = replanned_after_gap` |
| 3 | `in_progress` | Đã xong ≥ 1 mục nhưng chưa xong hết | số mục `completed` |
| 4 | `streak` | Chuỗi ngày học `≥ 3` (hôm nay chưa bắt đầu) | `currentStreakDays` |
| 5 | `behind_target` | Có mốc mục tiêu và `goal.onTrack = false` | `isOnTrack` |
| 6 | `not_started` | Còn lại | – |

Mặc định ngưỡng chuỗi `STREAK_MIN_DAYS = 3`. Khi nhiều trạng thái cùng đúng, chỉ trạng thái đầu bảng được hiển thị (research C7). Tất cả đều lấy từ dữ liệu đã ghi (FR-031); không đọc tốc độ trả lời, không so sánh với người học khác.

## 2. Chọn biến thể (ổn định trong ngày, đổi giữa các ngày)

```text
variants = CATALOG[state][language]        (|variants| >= 3, cam kết 4)
idx = ( hash32(userId + ":" + state) + dayOrdinal(localDate) ) mod |variants|
```

- `dayOrdinal(localDate)` = số ngày kể từ mốc cố định (đã có `diffDays`/`clock.ts`).
- Tải lại trong cùng ngày + cùng trạng thái → cùng câu (không nhấp nháy). Hai ngày liền kề cùng trạng thái → hai câu khác nhau; trong 5 ngày liên tiếp cùng trạng thái luôn thấy ≥ 2 câu (SC-008, research C4).
- Ngôn ngữ = `profile.language` (FR-028); nếu thiếu bản dịch thì dùng `vi`.

## 3. Văn bản

### `not_started`

| # | vi | en |
|---|---|---|
| 1 | Một buổi học ngắn hôm nay là đủ để tiến thêm một bước. Bắt đầu thôi nào! | A short session today is enough to take one more step. Let's begin! |
| 2 | Chào bạn! Vài phút học hôm nay sẽ giúp tiếng Nhật của bạn chắc hơn từng chút. | Hello! A few minutes today will make your Japanese a little stronger. |
| 3 | Mỗi bài học nhỏ là một viên gạch cho mục tiêu của bạn. Chọn bài đầu tiên nhé! | Every small lesson is a brick toward your goal. Pick the first one! |
| 4 | Sẵn sàng chưa? Bài đầu tiên của hôm nay đang chờ bạn. | Ready? Today's first lesson is waiting for you. |

### `in_progress`

| # | vi | en |
|---|---|---|
| 1 | Bạn đã bắt đầu rồi, tuyệt lắm! Còn vài bài nữa là xong ngày hôm nay. | You've already started, great job! Just a few more lessons to finish today. |
| 2 | Làm tốt lắm, bạn đang đi đúng nhịp. Tiếp tục bài kế tiếp nhé! | Nice work, you're right on rhythm. On to the next lesson! |
| 3 | Mỗi bài hoàn thành là một bước tiến. Chỉ còn một chút nữa thôi! | Every finished lesson is progress. Just a little more to go! |
| 4 | Bạn đã làm được một phần rồi, phần còn lại sẽ nhẹ nhàng hơn bạn nghĩ. | You've done part of it already, and the rest will feel lighter than you think. |

### `day_completed`

| # | vi | en |
|---|---|---|
| 1 | Chúc mừng! Bạn đã hoàn thành kế hoạch hôm nay. Nghỉ ngơi xứng đáng nhé! | Congratulations! You've finished today's plan. Enjoy a well-earned rest! |
| 2 | Xuất sắc! Nỗ lực hôm nay của bạn thật đáng ghi nhận. | Excellent! Today's effort is truly worth recognizing. |
| 3 | Hôm nay bạn đã làm xong tất cả. Hẹn gặp lại bạn vào ngày mai! | You've done everything for today. See you tomorrow! |
| 4 | Tuyệt vời, một ngày học trọn vẹn! Kiến thức hôm nay sẽ ở lại với bạn lâu. | Wonderful, a complete day of learning! Today's knowledge will stay with you. |

### `streak` (dùng `{n}`)

| # | vi | en |
|---|---|---|
| 1 | Bạn đã học liên tiếp {n} ngày, một thói quen tuyệt vời đang hình thành! | You've studied {n} days in a row, a great habit is forming! |
| 2 | {n} ngày liền! Sự đều đặn của bạn thật đáng ngưỡng mộ. | {n} days straight! Your consistency is admirable. |
| 3 | Chuỗi {n} ngày học cho thấy sự kiên trì của bạn. Hôm nay tiếp tục nhé! | Your {n}-day streak shows real perseverance. Let's keep going today! |
| 4 | Mỗi ngày một chút, bạn đã đi được {n} ngày liên tiếp. Làm tốt lắm! | A little each day, and you've reached {n} days in a row. Well done! |

### `welcome_back`

| # | vi | en |
|---|---|---|
| 1 | Chào mừng bạn quay lại! Hôm nay mình bắt đầu thật nhẹ nhàng nhé. | Welcome back! Let's start gently today. |
| 2 | Rất vui được gặp lại bạn. Kế hoạch hôm nay đã được chuẩn bị vừa sức cho bạn. | So good to see you again. Today's plan has been prepared to suit you. |
| 3 | Bạn đã trở lại, đó là bước quan trọng nhất. Cùng học một bài nhỏ nào! | You're back, and that's the most important step. Let's do one small lesson! |
| 4 | Chào bạn trở lại! Kiến thức cũ vẫn còn đó, mình ôn lại từng chút một. | Welcome back! What you learned is still there, so we'll revisit it bit by bit. |

### `behind_target`

| # | vi | en |
|---|---|---|
| 1 | Bước tiếp theo rất đơn giản: hoàn thành một bài ngắn hôm nay. | The next step is simple: finish one short lesson today. |
| 2 | Mỗi bài học hôm nay đưa bạn đến gần mục tiêu hơn. Bắt đầu với bài đầu tiên nhé! | Every lesson today brings you closer to your goal. Start with the first one! |
| 3 | Chỉ cần tập trung vào hôm nay: một bài nhỏ, một bước tiến chắc chắn. | Just focus on today: one small lesson, one solid step. |
| 4 | Mục tiêu của bạn vẫn trong tầm tay. Một bài hôm nay sẽ giúp ích rất nhiều. | Your goal is still within reach. One lesson today will help a lot. |

## 4. Quy tắc giọng điệu và bộ từ cấm (FR-027, SC-007)

Mọi câu PHẢI tích cực, tập trung vào bước tiếp theo, KHÔNG đổ lỗi, KHÔNG đe dọa mất chuỗi, KHÔNG so sánh với người khác, KHÔNG nhấn mạnh thất bại hay việc bị bỏ lỡ.

Kiểm thử đơn vị `encouragement-catalog` quét **toàn bộ** câu (cả vi và en) và thất bại nếu gặp (không phân biệt hoa thường; tiếng Anh khớp theo ranh giới từ):

| Ngôn ngữ | Từ/cụm cấm |
|---|---|
| vi | bỏ lỡ, bỏ qua ngày, chậm, trễ, muộn, mất chuỗi, đứt chuỗi, gián đoạn, thua, kém, lười, tệ, thất bại, đáng tiếc, tiếc, nợ, người khác, bạn khác, các bạn khác |
| en | missed, miss out, behind, late, slow, lose, lost, broke, break your streak, fail, failure, lazy, worse, pity, debt, overdue, others, other learners |

Ngoài ra kiểm thử khẳng định: (a) mỗi trạng thái có ≥ 3 câu vi và ≥ 3 câu en, hai ngôn ngữ cùng số câu và `{n}` xuất hiện trong cả hai bản của cùng một câu; (b) chỉ `streak` có `{n}`; (c) mỗi câu dài ≤ 140 ký tự (vừa dải chữ ở màn hình hẹp); (d) không câu nào lặp lại trong cùng trạng thái và ngôn ngữ.

## 5. Trình bày (client)

- **Một dải chữ tĩnh** (`EncouragementBanner`) ngay dưới tiêu đề "Hôm nay", trên danh sách bài; dùng biểu tượng nhẹ (`favorite_border`/`emoji_events_outlined` theo trạng thái) + chữ; có `Semantics(liveRegion: false)` (không đọc to lặp lại mỗi lần cập nhật).
- Không lớp phủ, không âm thanh, không hoạt ảnh bắt buộc → không trùng với hiệu ứng chúc mừng của spec 005 (FR-030). Không thay hay che tổng thời lượng và danh sách bài.
- Hiện cả khi người học tắt hiệu ứng/âm thanh (đó là chữ, không phải hiệu ứng).
- Màn hình hẹp: dải xuống nhiều dòng, không cắt chữ.
- `encouragement = null` (ví dụ máy chủ cũ): không hiện dải, màn hình vẫn bình thường.

## 6. Kiểm thử bằng hồ sơ mẫu (FR-031)

Hồ sơ đại diện (tái dùng và bổ sung ở `tests/fixtures/learner-profiles/`): `newcomer-10min` → `not_started`; hồ sơ đã xong 1/3 mục → `in_progress`; `reward-veteran` hoặc `reward-near-streak` → `streak`; `returning-after-gap` → `welcome_back`; hồ sơ có `targetDate` gần và còn nhiều nội dung → `behind_target`; kế hoạch `completed` → `day_completed`. Cùng đầu vào + cùng ngày ⇒ cùng câu; ngày kế ⇒ khác câu.
