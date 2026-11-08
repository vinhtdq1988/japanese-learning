# Mô hình dữ liệu: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Nhánh**: `005-reward-feedback-effects` | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md) | **Hợp đồng**: [contracts/api-changes.md](contracts/api-changes.md)

Tính năng thêm **2 bảng mới** và **2 cột** vào `learning_profiles`; không đổi bảng nào khác. Mọi thay đổi là bổ sung (Nguyên tắc: không âm thầm làm hỏng dữ liệu đã lưu). Mã `E*` tham chiếu [research.md](research.md).

## 1. Thực thể

### 1.1. Mốc thành tựu (Achievement Definition) — không phải bảng

Danh mục cố định trong mã (E3), tại `backend/src/domain/achievements.ts`:

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `code` | chuỗi | Mã ổn định, khóa tham chiếu của bản ghi đã đạt, ví dụ `streak_7`, `items_100`, `goal_50`, `first_lesson`, `perfect_lesson`. KHÔNG đổi sau khi phát hành. |
| `kind` | `first_lesson` \| `streak` \| `items_learned` \| `goal_progress` \| `perfect_lesson` | Loại. |
| `threshold` | số nguyên \| vắng | Ngày (streak), số mục (items_learned), phần trăm (goal_progress); vắng với hai thành tựu một lần. |
| `name`, `description` | `{ vi, en }` | Văn bản bản địa hóa. |

Nội dung đầy đủ 16 mốc: [contracts/achievement-catalog.md](contracts/achievement-catalog.md). Điều chỉnh mốc về sau = sửa danh mục + kiểm thử; mã đã phát hành giữ nguyên nghĩa.

### 1.2. Thành tựu đã đạt (`earned_achievements`)

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `user_id` | `uuid` | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` | Xóa tài khoản kéo theo xóa bản ghi. |
| `achievement_code` | `text` | `NOT NULL`, `CHECK (char_length(achievement_code) BETWEEN 1 AND 40)` | Mã trong danh mục; hợp lệ được kiểm ở ứng dụng (mã lạ không bao giờ được chèn). |
| `earned_at` | `timestamptz` | `NOT NULL` | Thời điểm đạt (đồng hồ server). |
| `source` | `achievement_source` | `NOT NULL` | `earned` = đạt khi học và đã chúc mừng; `silent` = ghi âm thầm (đã vượt mốc trước khi ra mắt, hoặc vượt do đổi mục tiêu/dựng lại lộ trình/đổi lộ trình lớp). |
|  |  | **`PRIMARY KEY (user_id, achievement_code)`** | Mỗi cặp (người học, mốc) tối đa một bản ghi (FR-012), kể cả hai cửa sổ cùng đạt. |

- Không có cột "đã chúc mừng": chúc mừng chỉ xảy ra tại thời điểm chèn (Làm rõ Q1). `source = 'earned'` ⇔ lần chèn đó trả mốc về client.
- Bảng **chỉ thêm, không xóa/sửa** trong luồng ứng dụng ⇒ mốc không bao giờ bị thu hồi (FR-017a). Không có chỉ mục phụ: mọi truy vấn là theo `user_id` (tiền tố của khóa chính).
- Phạm vi người học: dùng `user_id` — học viên thuộc lớp (spec 004) giữ nguyên thành tựu khi vào/rời lớp. Khách dùng thử không có dòng nào (FR-018).

### 1.3. Đánh dấu chúc mừng hoàn thành ngày (`daily_completion_celebrations`)

| Cột | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `user_id` | `uuid` | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |  |
| `local_date` | `date` | `NOT NULL` | Ngày địa phương của kế hoạch được hoàn thành (múi giờ hồ sơ khi lập kế hoạch, như `daily_plans`). |
| `celebrated_at` | `timestamptz` | `NOT NULL` |  |
|  |  | **`PRIMARY KEY (user_id, local_date)`** | Tối đa một lời chúc mừng mỗi ngày (FR-015), kể cả khi dựng lại kế hoạch cùng ngày (E6). |

Đây là hiệu ứng lặp hằng ngày chứ không phải thành tựu một lần (spec FR-015) nên tách bảng riêng.

### 1.4. Tùy chọn hiệu ứng (Effects Preference) — hai cột trên `learning_profiles`

| Cột | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `sound_enabled` | `boolean NOT NULL` | `true` | Bật/tắt âm thanh. |
| `visual_effects_enabled` | `boolean NOT NULL` | `true` | Bật/tắt hiệu ứng hình ảnh (hoạt ảnh, màn chúc mừng động). |

- Độc lập với nhau (US3.1). Không có trong `CLASS_LOCKED_PROFILE_FIELDS` nên học viên thuộc lớp vẫn sửa được (Giả định spec).
- Khách dùng thử: không có dòng hồ sơ; tùy chọn chỉ trong bộ nhớ client (E9).
- Cột thêm bằng `ADD COLUMN … NOT NULL DEFAULT true` ⇒ mọi người học hiện có tự nhận mặc định bật, không cần cập nhật dữ liệu.

### 1.5. Chuỗi đúng liên tiếp trong phiên — không lưu

Bộ đếm trong bộ nhớ client (`LessonState.correctStreak`), xem §4. Không có bảng/cột (FR-027, US4.3).

## 2. Migration `0005_reward_effects.sql`

Một file, chạy trong một giao dịch bởi `pnpm db:migrate` (như 0004). Chỉ **thêm**; không `ALTER TYPE … ADD VALUE` nên không cần tách file.

```sql
-- Migration 0005: hiệu ứng thưởng khi trả lời đúng và đạt thành tựu (spec 005, data-model.md).
-- Chỉ THÊM kiểu/bảng/cột; dữ liệu 001–004 hợp lệ ngay sau migration và không bị sửa.

CREATE TYPE achievement_source AS ENUM ('earned', 'silent');

CREATE TABLE earned_achievements (
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code text NOT NULL CHECK (char_length(achievement_code) BETWEEN 1 AND 40),
  earned_at        timestamptz NOT NULL,
  source           achievement_source NOT NULL,
  PRIMARY KEY (user_id, achievement_code)
);

CREATE TABLE daily_completion_celebrations (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date    date NOT NULL,
  celebrated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, local_date)
);

ALTER TABLE learning_profiles
  ADD COLUMN sound_enabled           boolean NOT NULL DEFAULT true,
  ADD COLUMN visual_effects_enabled  boolean NOT NULL DEFAULT true;
```

`backend/src/db/schema.ts` thêm `earnedAchievements`, `dailyCompletionCelebrations`, enum `achievementSource` và hai cột của `learningProfiles`. Kiểm thử migration (`tests/integration/migration.test.ts`, mở rộng): hai bảng có mặt; mọi hồ sơ cũ có cả hai cột `true`; số dòng các bảng cũ không đổi.

## 3. Thuật toán đánh giá khi hoàn thành phiên (E1, E2, E5)

Chạy **bên trong** giao dịch `completeSession`, sau khi phiên đã được đánh dấu hoàn thành và `unit_progress`/kế hoạch đã cập nhật, chỉ ở lần hoàn thành đầu tiên (nhánh trả sớm cho phiên đã xong KHÔNG chạy và KHÔNG trả `celebrations`).

### 3.1. Đầu vào thu thập

| Đầu vào | Cách lấy |
|---|---|
| `earned` | `SELECT achievement_code FROM earned_achievements WHERE user_id = $1` (≤ 16 dòng). |
| `kind` của phiên | `lesson_sessions.kind` ∈ `new_unit` \| `extra` \| `review`. `isNewLesson = kind ≠ review`. |
| `streakBefore`, `streakAfter` | `currentStreakDays(activeDays \ {today}, today, pauses)` và `currentStreakDays(activeDays, today, pauses)`; trong lớp dùng khoảng tạm dừng của lớp (như `getProgress`). Chỉ khi còn mốc `streak_*` chưa đạt. |
| `itemsBefore`, `itemsAfter` | `countItemsLearned` gọi **trước** khi đánh dấu phiên hoàn thành và **sau**. Chỉ khi `isNewLesson`, phiên có `unit_id`, và còn mốc `items_*` chưa đạt. |
| `goalDone`, `goalTotal`, `delta` | `rankForContext(..., {includeMastered: true})` sau khi cập nhật; `done` = số đơn vị `completed`/`mastered`; `delta = 1` nếu phiên này vừa đưa một đơn vị nằm trong phạm vi từ chưa-xong thành xong (đọc `unit_progress.status` **trước** `markUnitCompleted`), ngược lại 0. Chỉ khi còn mốc `goal_*` chưa đạt. |
| `hasEarlierLesson` | Có phiên không-ôn (`kind ≠ review`) nào khác của người học đã `completed` trước phiên này? Hàm repository **mới** `hasEarlierCompletedLesson(userId, excludeSessionId)` (hàm `hasCompletedUnitSession` hiện có chỉ xét theo một đơn vị nên không dùng được). Chỉ khi chưa có `first_lesson`. |
| `isPerfect` | `isNewLesson` và `total > 0` và `correct = total` theo `countPrimaryResults` (câu lượt chính). |
| `hadEarlierPerfect` | Có phiên không-ôn khác đã `completed` mà mọi câu lượt chính đều đúng? Chỉ khi chưa có `perfect_lesson` và phiên này không hoàn hảo. |
| `dayJustCompleted` | Nhánh `markPlanCompleted` của `completeSession` vừa chạy trong giao dịch này (mọi mục của kế hoạch đã `completed`; phiên "học thêm" không có `planItemId` nên không bao giờ kích hoạt). Hàm hiện trả `void`, nên `completeSession` tự ghi nhận cờ khi vào nhánh đó. Bảng đánh dấu theo ngày (§1.3) chặn lần chúc mừng thứ hai. |

### 3.2. Quy tắc (hàm thuần `engine/achievements.ts`)

```text
evaluate(input) -> { celebrate: code[], silent: code[] }

với mỗi mốc M thuộc danh mục mà M.code ∉ earned:
  theo loại:
    streak(T):        silent nếu T ≤ streakBefore;  celebrate nếu streakBefore < T ≤ streakAfter
    items_learned(T): silent nếu T ≤ itemsBefore;   celebrate nếu itemsBefore < T ≤ itemsAfter
    goal_progress(T): beforeDone = goalDone − delta
                      silent nếu beforeDone·100 ≥ T·goalTotal;
                      celebrate nếu beforeDone·100 < T·goalTotal ≤ goalDone·100
                      (goalTotal = 0 -> bỏ qua)
    first_lesson:     celebrate nếu isNewLesson ∧ ¬hasEarlierLesson
                      silent    nếu hasEarlierLesson            (đã học bài mới từ trước)
    perfect_lesson:   celebrate nếu isPerfect ∧ ¬hadEarlierPerfect
                      silent    nếu hadEarlierPerfect
```

- Một mốc không bao giờ vừa `silent` vừa `celebrate`. Mốc bị **vượt nhiều cấp** cùng lúc: các mốc ≤ `before` ghi âm thầm; các mốc trong `(before, after]` đều được chúc mừng (trường hợp thực tế: một phiên chỉ tăng vài mục/một đơn vị nên hiếm khi vượt hơn một mốc cùng loại).
- Lúc `hasEarlierLesson`/`hadEarlierPerfect` tính cho người học cũ trước ra mắt ⇒ ghi âm thầm đúng FR-017 mà không cần job backfill.

### 3.3. Ghi nhận (idempotent, an toàn đồng thời)

```text
rows = silent(source='silent') ∪ celebrate(source='earned'), earned_at = now
INSERT INTO earned_achievements … ON CONFLICT (user_id, achievement_code) DO NOTHING RETURNING achievement_code
celebrated = RETURNING ∩ celebrate          -- chỉ mốc thật sự được chèn mới được chúc mừng
```

- Hai cửa sổ cùng đạt một mốc: một giao dịch chèn được, giao dịch kia `DO NOTHING` ⇒ chỉ một bên nhận lời chúc mừng (SC-003).
- Chúc mừng ngày: nếu `dayJustCompleted` thì `INSERT INTO daily_completion_celebrations … ON CONFLICT DO NOTHING RETURNING 1`; có dòng trả về ⇔ `celebrations.dayCompleted = true`.
- Kết quả: `celebrations = { dayCompleted, achievements: celebrated (đã bản địa hóa) }`; trường chỉ có mặt trong phản hồi khi `dayCompleted ∨ achievements ≠ ∅`.
- Khóa/thứ tự: không thêm khóa hàng ngoài khóa phiên đã có (`FOR UPDATE` trên `lesson_sessions`); hai `INSERT` không khóa chéo giữa các giao dịch.

### 3.4. Bất biến (dùng để sinh kiểm thử)

| Bất biến | Kiểm bằng |
|---|---|
| Mỗi cặp (người học, mã) có tối đa 1 dòng | PK + kiểm thử đồng thời hai phiên cùng vượt mốc |
| Gọi lại `complete` trên phiên đã xong không trả `celebrations` và không ghi dòng | kiểm thử hợp đồng |
| Mốc ghi `earned` ⇔ đã được trả cho client trong đúng một phản hồi | kiểm thử hợp đồng |
| Đổi mục tiêu / dựng lại lộ trình / đổi lộ trình lớp làm tỷ lệ nhảy qua mốc ⇒ KHÔNG chúc mừng ở lần hoàn thành kế tiếp (ghi `silent`) | kiểm thử tích hợp |
| Tỷ lệ tụt xuống dưới mốc đã đạt ⇒ dòng cũ giữ nguyên, không đạt lại | kiểm thử tích hợp |
| Phiên `review` không bao giờ tạo `first_lesson`/`perfect_lesson` | kiểm thử đơn vị |
| Người học có chuỗi 20 ngày ở lần hoàn thành đầu tiên sau ra mắt: mốc 3, 7, 14 ghi `silent`, không có chúc mừng | kiểm thử tích hợp |
| Khách dùng thử: không có dòng nào (không có tài khoản) | kiểm thử hợp đồng trial |
| Không thay đổi cách chấm, lịch ôn, độ khó, kế hoạch (FR-009) | golden hồi quy kế hoạch/`GET /progress` trước–sau |

## 4. Trạng thái phía client (không lưu server)

| Trạng thái | Nơi giữ | Vòng đời |
|---|---|---|
| `EffectsSettings { soundEnabled, visualEnabled }` | Người học đăng ký: lấy từ `Me.profile` (nguồn thật ở server); khách: provider trong bộ nhớ | Đồng bộ qua `PATCH /me`; đổi nhanh ở nút trong bài học dùng cập nhật lạc quan, thất bại thì hoàn lại và báo lỗi chung |
| `correctStreak` (int) | `LessonState` | Về 0 khi trả lời sai (lượt chính); hủy theo controller khi rời phiên |
| `pendingCelebrations` (hàng đợi) | `CelebrationHost` (gốc ứng dụng) | Điền khi nhận `SessionSummary.celebrations`; xóa khi đóng/đổi tuyến/tự đóng; **không** lưu LocalStore (không chúc mừng bù) |
| `AnswerEffectEvent { id, correct, streakMilestone? }` | `EffectsController` | Sự kiện thoáng qua; id tăng dần để widget phân biệt lần trả lời mới và thay thế hiệu ứng đang chạy (FR-005) |
| `EffectMode` ∈ `full` \| `reduced` \| `off` | Hàm thuần `resolveEffectMode(visualEnabled, reduceMotion)` | Tính khi dựng widget (E12, E13) |

### Chuyển trạng thái của `EffectMode`

```text
visualEnabled=false                      -> off
visualEnabled=true,  reduceMotion=true   -> reduced
visualEnabled=true,  reduceMotion=false  -> full
```

`soundEnabled` không ảnh hưởng chế độ hình ảnh (US3.3); chế độ `off` vẫn hiện kết quả bằng thẻ phản hồi + biểu tượng + chữ và thông báo tĩnh cho thành tựu (US3.4).

## 5. Quy tắc dữ liệu liên quan quyền riêng tư và xóa

- `earned_achievements`/`daily_completion_celebrations` gắn `user_id` với `ON DELETE CASCADE`: tài khoản bị xóa vĩnh viễn (job `job:purge`) kéo theo xóa. Tài khoản khôi phục trong thời hạn chờ xóa giữ nguyên dòng (bảng chỉ bị xóa khi xóa cứng).
- Thành tựu KHÔNG hiển thị cho giáo viên hay tổ chức: không thêm trường nào vào DTO của `/classes*`/`/org*` (spec, "Ngoài phạm vi"); snapshot khóa DTO của spec 004 phải vẫn đạt.
- Không lưu nội dung câu trả lời hay thời gian trả lời thêm; hiệu ứng không đọc tốc độ trả lời (FR-009).
