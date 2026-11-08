# Danh mục thành tựu (cố định)

**Nhánh**: `005-reward-feedback-effects` | **Đặc tả**: [spec.md](../spec.md) (FR-010, Giả định) | **Nghiên cứu**: [research.md](../research.md) E3

Danh mục này là **nguồn** của `backend/src/domain/achievements.ts` và của bài kiểm thử danh mục. Mã (`code`) là hợp đồng ổn định: KHÔNG đổi nghĩa hay tái sử dụng mã đã phát hành; thêm/đổi ngưỡng = thêm mã mới. Số lượng: 6 + 4 + 4 + 2 = **16 mốc**.

Quy ước văn bản: `name` ngắn (≤ 30 ký tự) để vừa thẻ chúc mừng; `description` một câu. Khi hiện thực, đưa chuỗi vào hằng số của backend (trả theo `profile.language`).

## 1. Chuỗi ngày học liên tiếp — `kind = streak`

Chỉ số: `currentStreakDays` (không đổi cách tính). Điều kiện chúc mừng: `streakBefore < T ≤ streakAfter` (data-model §3.2).

| Mã | Ngưỡng T | Tên (vi) | Mô tả (vi) | Name (en) | Description (en) |
|---|---|---|---|---|---|
| `streak_3` | 3 | Chuỗi 3 ngày | Bạn đã học 3 ngày liên tiếp. | 3-day streak | You have studied 3 days in a row. |
| `streak_7` | 7 | Chuỗi 7 ngày | Một tuần học đều đặn, rất tuyệt! | 7-day streak | A full week of steady study. Great job! |
| `streak_14` | 14 | Chuỗi 14 ngày | Hai tuần liền không bỏ ngày nào. | 14-day streak | Two weeks in a row without a gap. |
| `streak_30` | 30 | Chuỗi 30 ngày | Một tháng học liên tục – thói quen đã thành hình. | 30-day streak | A whole month of study – the habit is formed. |
| `streak_60` | 60 | Chuỗi 60 ngày | Hai tháng bền bỉ, thật đáng nể. | 60-day streak | Two months of persistence. Impressive. |
| `streak_100` | 100 | Chuỗi 100 ngày | 100 ngày học liên tiếp – một cột mốc lớn! | 100-day streak | 100 days in a row – a major milestone! |

## 2. Tổng số mục đã học — `kind = items_learned`

Chỉ số: `countItemsLearned` (research E4). Điều kiện: `itemsBefore < T ≤ itemsAfter`.

| Mã | Ngưỡng T | Tên (vi) | Mô tả (vi) | Name (en) | Description (en) |
|---|---|---|---|---|---|
| `items_50` | 50 | Đã học 50 mục | Bạn đã học 50 từ vựng, ngữ pháp và Kanji. | 50 items learned | You have learned 50 words, grammar points and kanji. |
| `items_100` | 100 | Đã học 100 mục | Đã 100 mục trong vốn tiếng Nhật của bạn. | 100 items learned | 100 items are now part of your Japanese. |
| `items_250` | 250 | Đã học 250 mục | 250 mục – vốn kiến thức đang đầy lên thấy rõ. | 250 items learned | 250 items – your knowledge is clearly growing. |
| `items_500` | 500 | Đã học 500 mục | 500 mục đã học. Nền tảng rất vững! | 500 items learned | 500 items learned. A solid foundation! |

## 3. Tiến độ hướng tới mục tiêu — `kind = goal_progress`

Chỉ số: tỷ lệ `done / total` của `GET /progress` (`goal.completionRatio`), so mốc bằng số nguyên `done·100 ≥ T·total`. Điều kiện: `beforeDone·100 < T·total ≤ done·100`.

| Mã | Ngưỡng T (%) | Tên (vi) | Mô tả (vi) | Name (en) | Description (en) |
|---|---|---|---|---|---|
| `goal_25` | 25 | Đi được 1/4 chặng đường | Bạn đã hoàn thành 25% mục tiêu. | A quarter of the way | You have completed 25% of your goal. |
| `goal_50` | 50 | Đã đi được nửa chặng | Bạn đã hoàn thành 50% mục tiêu. | Halfway there | You have completed 50% of your goal. |
| `goal_75` | 75 | Sắp về đích | Bạn đã hoàn thành 75% mục tiêu. | Almost there | You have completed 75% of your goal. |
| `goal_100` | 100 | Hoàn thành mục tiêu! | Bạn đã hoàn thành toàn bộ lộ trình mục tiêu. | Goal reached! | You have completed your entire goal path. |

## 4. Thành tựu một lần — `first_lesson`, `perfect_lesson`

Chỉ tính **bài học mới** (từ vựng, ngữ pháp, Kanji; phiên `new_unit`/`extra`); phiên ôn tập (`review`) không kích hoạt (Làm rõ Q3, FR-010).

| Mã | Ngưỡng | Điều kiện | Tên (vi) | Mô tả (vi) | Name (en) | Description (en) |
|---|---|---|---|---|---|---|
| `first_lesson` | — | Bài học mới hoàn thành đầu tiên của người học | Bài học đầu tiên | Bạn vừa hoàn thành bài học đầu tiên – khởi đầu tốt đẹp! | First lesson | You just finished your first lesson – a great start! |
| `perfect_lesson` | — | Bài học mới đầu tiên mà mọi câu lượt chính đều đúng (`total > 0`) | Bài học hoàn hảo | Mọi câu đều đúng ngay lần đầu. Xuất sắc! | Perfect lesson | Every answer right on the first try. Excellent! |

## 5. Thứ tự trình bày khi nhiều mốc cùng lúc (FR-014)

`first_lesson` → `perfect_lesson` → `streak_*` → `items_*` → `goal_*`; trong cùng loại theo ngưỡng tăng dần. Lời chúc mừng hoàn thành ngày (nếu có) luôn đứng **trước** toàn bộ danh sách này ở phía client.

## 6. Kiểm thử danh mục (đơn vị)

- Mã duy nhất; mọi mã khớp `^[a-z]+(_[a-z]+)*(_[0-9]+)?$` và ≤ 40 ký tự (khớp `CHECK` của bảng).
- Mỗi mốc có đủ `name`/`description` ở cả `vi` và `en`, không rỗng, `name` ≤ 30 ký tự.
- Ngưỡng tăng dần ngặt trong từng loại; `goal_progress` kết thúc ở 100.
- Tổng 16 mốc; hai thành tựu một lần không có `threshold`.
