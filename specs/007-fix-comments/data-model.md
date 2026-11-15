# Mô hình dữ liệu (Phase 1): Hoàn thiện trải nghiệm học theo góp ý

**Nhánh**: `007-fix-comments` | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md)

Tính năng này **không thêm bảng, không thêm cột**. Thay đổi lưu trữ duy nhất là mở rộng enum `skill`. Phần còn lại là các giá trị **suy ra** (năng lực, lời khích lệ, bảng gợi ý, điều kiện luyện) tính từ dữ liệu đã có. Tài liệu mô tả: (1) thay đổi lưu trữ, (2) hình dạng nội dung mới, (3) các mô hình dẫn xuất và thuật toán, (4) bất biến, (5) trạng thái client.

## 1. Thay đổi lưu trữ

### Migration `0006_practice_skills.sql` (một file, không đổi dữ liệu cũ)

```sql
-- Luyện đọc/viết (spec 007, research P1): thêm hai giá trị vào enum `skill`.
-- Tách file riêng như 0002_kanji_skill.sql: PostgreSQL cho phép ADD VALUE trong giao dịch nhưng không cho
-- dùng giá trị mới trước khi commit; migration này không dùng giá trị mới trong cùng giao dịch.
ALTER TYPE skill ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE skill ADD VALUE IF NOT EXISTS 'writing';
```

Enum `skill` được dùng bởi `topics.skill`, `learning_units.kind`, `content_items.kind`, `learning_profiles.skills`, `learning_profiles.prioritized_skill`, `placement_questions.skill` → hai giá trị mới phủ tất cả. Không hàng nào bị sửa; mọi hàng cũ giữ nguyên giá trị.

Đồng bộ hằng trong mã:

| Vị trí | Thay đổi |
|---|---|
| `backend/src/domain/types.ts` | `SKILLS = ['vocabulary','grammar','kanji','reading','writing']`; thêm `PRACTICE_SKILLS = ['reading','writing']`; `ERROR_CODES` thêm `PRACTICE_LOCKED`. `PLACEMENT_SKILLS`, `TRIAL_SKILLS` **không đổi** (luyện đọc/viết ngoài bài kiểm tra trình độ và học thử). |
| `backend/src/db/schema.ts` | `skill = pgEnum('skill', [..., 'reading', 'writing'])` |
| `backend/src/domain/profile-validation.ts` | `skillsSchema` chấp nhận hai giá trị mới (cập nhật thông điệp lỗi "nghe, đọc…"); kiểm tra điều kiện phút ở dịch vụ (§3.1) |
| `content/schema/unit.schema.json` | 1.1.0 → **1.2.0**: `kind` thêm `reading`, `writing`; ghi `content/schema/CHANGELOG.md` |
| `content/topics.json` + `topics.schema.json` | `skill` thêm hai giá trị; thêm chủ đề cho từng (trình độ × loại) |

**Tương thích dữ liệu**: các hàng `learning_profiles.skills` hiện có không chứa giá trị mới; kế hoạch, lộ trình, tiến độ của người học hiện tại không đổi (golden hồi quy, research Q3).

## 2. Hình dạng nội dung luyện đọc/viết

Dùng nguyên các bảng `learning_units`, `content_items`, `exercises` (xem [schema.ts](../../backend/src/db/schema.ts)). Quy ước và quy tắc kiểm tra chi tiết ở [contracts/practice-content.md](contracts/practice-content.md); tóm tắt ánh xạ:

| Khái niệm spec | Lưu ở | Ghi chú |
|---|---|---|
| Nội dung luyện đọc (đoạn văn, câu hỏi, đáp án) | `learning_units(kind='reading')` + 1 `content_items(kind='reading')` + 2–5 `exercises(type='multiple_choice', item_id=NULL)` | Đoạn văn ở `content_items.japanese`; bản dịch ở `meaning`; giải thích đúng/sai ở `feedback_*` |
| Nội dung luyện viết (gợi ý, đáp án tham chiếu) | `learning_units(kind='writing')` + 3–6 `content_items(kind='writing')` + mỗi mục 1 `exercises(type='fill_blank', item_id=NULL)` | Gợi ý nghĩa/cách đọc ở `prompt` và `payload.hint`; đáp án tham chiếu là `payload.accepted_answers[0]` (trả về khi sai – `AnswerResult.correctAnswer`) |
| Phiên luyện đọc/viết | `lesson_sessions` (`kind='new_unit'` hoặc `extra`, `unit_id` = đơn vị luyện) | Không loại phiên mới; snapshot nội dung không đổi |
| Kết quả từng câu / thời lượng (FR-010) | `study_records` (+ `topic_id` = chủ đề của đơn vị), `study_intervals` | Cùng đường ghi với mọi bài khác |
| Mức năng lực của chủ đề luyện | `topic_stats` (tự có khi ghi `study_records`) | Chủ đề luyện đọc/viết là dòng `topics` bình thường (`skill='reading'|'writing'`) |
| Lịch sử kết quả khi bị khóa (FR-011) | các bảng trên, **không xóa** | Khóa chỉ lọc ở bước chọn nguồn học (§3.1), dữ liệu cũ vẫn hiện trong tiến độ |

**Không gắn `item_id` cho bài tập** ⇒ bài tập không tạo `review_schedules` và không vào gói ôn (research P4, C6). Chủ đề của câu trả lời là chủ đề của đơn vị (đã đúng tại `buildSnapshot`: `e.topicId` khi `itemId = null`).

## 3. Mô hình dẫn xuất và thuật toán

### 3.1. Điều kiện luyện đọc/viết (`domain/practice.ts`, hàm thuần)

```text
PRACTICE_MIN_DAILY_MINUTES = 30
isPracticeEligible(dailyMinutes) = (dailyMinutes ?? 0) >= 30
effectiveSkills(skills, dailyMinutes) =
    isPracticeEligible(dailyMinutes) ? skills : skills \ {reading, writing}
```

- `dailyMinutes` là **phút đang áp dụng**: hồ sơ cá nhân, hoặc với học viên lớp `override.dailyMinutes ?? classPath.dailyMinutes` (đúng như `buildClassContext` dựng hồ sơ hiệu lực).
- Áp dụng tại: `resolveLearningContext` (lọc `profile.skills`, `params.skills`, `template.skills`), `profile.ts`/`onboarding.ts` (từ chối **thêm mới** khi phút sau cập nhật < 30), `lesson-session.ts` (`startSession`, `submitAnswer`, `completeSession`, `recordInterval` → `PRACTICE_LOCKED`).
- Giá trị `skills` đã lưu **không** bị sửa khi hạ phút.

Bảng chân trị cho hồ sơ (`stored` = đã lưu; `eff` = hiệu lực):

| stored.skills chứa reading/writing | phút | eff | Học được? | PATCH thêm reading/writing |
|---|---|---|---|---|
| có | 30 | có | Có (vào kế hoạch) | cho phép |
| có | 5/10/15 | **không** | Không (khóa, lịch sử còn) | từ chối `422` |
| không | 30 | không | Không (người học tắt) | cho phép |
| không | < 30 | không | Không | từ chối `422` |

### 3.2. Suất luyện tập trong kế hoạch ngày (`engine/daily-plan.ts`)

```text
applyPracticeSlot(candidates, { skills, prioritizedSkill, lastNewUnitPlanKinds, budgetMinutes })
  1. Nếu skills ∩ {reading, writing} = ∅ → trả nguyên danh sách.
  2. fits = ứng viên kind ∈ {reading, writing} với estMinutes ≤ budgetMinutes; rỗng → trả nguyên.
  3. promoteToday =
       prioritizedSkill ∈ {reading, writing}
       HOẶC lastNewUnitPlanKinds = null
       HOẶC lastNewUnitPlanKinds không chứa reading/writing   (PRACTICE_EVERY_N_PLANS = 2)
     Không promoteToday → trả nguyên.
  4. wanted = loại đối lập với lần luyện gần nhất trong lastNewUnitPlanKinds
              (chưa có → reading); nếu fits không có loại wanted → loại còn lại.
  5. Đưa ứng viên đầu tiên của loại wanted trong fits lên vị trí 0; phần còn lại giữ thứ tự.
```

Thứ tự gọi trong `generatePlan`: `applyPracticeSlot` → `applyKanjiSlot` → `planDailyPlan`. `planDailyPlan` không đổi nên các bất biến cũ giữ nguyên: tổng `estMinutes` ≤ `B`; ôn ≤ 60% `B`; mỗi mục 1–15 phút; luân phiên ôn/mới.

`lastNewUnitPlanKinds` (repository `plans.ts`) hiện trả danh sách `kind` của kế hoạch có bài mới gần nhất; mở rộng để phân biệt loại luyện **không cần truy vấn mới** (mảng đã chứa `reading`/`writing`).

### 3.3. Mức năng lực (`engine/competency.ts`, hàm thuần)

```text
COMPETENCY_MIN_ANSWERS = 8   (= WEAK_MIN_ANSWERS)
COMPETENCY_GOOD_AT     = 0.70 (= RECOVER_AT)

classifyCompetency({ answered, correct }):
  answered < 8                       → 'insufficient'
  correct / answered >= 0.70         → 'good'
  ngược lại                          → 'needs_improvement'
```

Đầu vào mỗi **chủ đề**: `recent_results` (≤ 20 kết quả 0/1) của `topic_stats` → `answered = length`, `correct = sum`.
Đầu vào mỗi **kỹ năng**: cộng `answered`, `correct` của mọi chủ đề có `topics.skill = kỹ năng` (một truy vấn `topic_stats ⨝ topics`).

Quan hệ với cờ yếu hiện có: `is_weak` ⇒ `accuracy < 0.70` ⇒ `needs_improvement`. Danh sách `weakTopics` ⊆ chủ đề `needs_improvement`; không chủ đề `good` nào có `is_weak`.

DTO dẫn xuất (xem [contracts/competency-rules.md](contracts/competency-rules.md)):

```text
CompetencyLevel = 'good' | 'needs_improvement' | 'insufficient'
SkillCompetency = { skill, level, answered, accuracy|null }
TopicCompetency = { topicId, skill, level, answered, accuracy|null }
```

### 3.4. Trạng thái và thông điệp khích lệ (`engine/encouragement.ts` + `domain/encouragement.ts`)

Tín hiệu đầu vào (đã có sẵn khi dựng `GET /today`):

| Tín hiệu | Nguồn |
|---|---|
| `planItemsTotal`, `planItemsDone`, `planStatus` | kế hoạch hôm nay (`daily_plan_items.status`) |
| `streakDays` | `currentStreakDays(listActiveDays, today, pauses)` |
| `absentDays` / `afterGap` | `absentDays(latestActiveDay, today, pauses)` ≥ `GAP_THRESHOLD_DAYS` hoặc `plan.notice = replanned_after_gap` |
| `onTrack` | `isOnTrack({remainingMinutes, dailyMinutes, today, targetDate})` (null nếu không có mốc) |

Chọn trạng thái (đầu tiên đúng):

```text
planStatus = 'completed'                                   → day_completed
afterGap  VÀ planItemsDone = 0                             → welcome_back
0 < planItemsDone < planItemsTotal                         → in_progress
streakDays >= 3                                            → streak        (hiện {n})
onTrack = false                                            → behind_target
(còn lại)                                                  → not_started
```

Chọn biến thể: `variants = catalog[state][language]`; `idx = (hash(userId, state) + dayOrdinal(localDate)) mod |variants|`, `|variants| ≥ 3` ⇒ ngày liền kề cùng trạng thái luôn khác biến thể (vì mỗi ngày tăng 1); trong cùng ngày là hằng.

### 3.5. Bảng gợi ý theo thời gian (`domain/study-defaults.ts`)

| `dailyMinutes` | `skills` gợi ý |
|---|---|
| 5 | `vocabulary` |
| 10 | `vocabulary`, `grammar` |
| 15 | `vocabulary`, `grammar`, `kanji` |
| 30 | `vocabulary`, `grammar`, `kanji`, `reading`, `writing` |

`practiceMinDailyMinutes = 30` cùng phản hồi để client không cứng ngưỡng.

## 4. Bất biến (PHẢI có kiểm thử)

| # | Bất biến | Kiểm bằng |
|---|---|---|
| I1 | Tổng `estMinutes` kế hoạch ngày ≤ `B` với mọi tổ hợp kỹ năng/ngày, kể cả khi có luyện (Nguyên tắc I) | `daily-plan-practice` (thuộc tính trên nhiều quỹ, nhiều ngày) |
| I2 | Người học `skills` hiệu lực không chứa luyện ⇒ kế hoạch **giống hệt** trước khi có tính năng | Golden `plans-pre-practice.json` |
| I3 | Phút hiệu lực < 30 ⇒ không `new_unit` kind luyện trong kế hoạch, `GET /path`, `POST /today/extra`; `startSession`/`submitAnswer`/`completeSession` luyện → 403 `PRACTICE_LOCKED` | hợp đồng + tích hợp |
| I4 | Hạ phút xuống < 30 không xóa `skills` đã lưu; nâng lại 30 ⇒ có lại | tích hợp hồ sơ |
| I5 | `weakTopics ⊆ needs_improvement` và `good ∩ is_weak = ∅`; mức năng lực giống nhau ở `/today`, `/path`, `/progress` cho cùng thời điểm | thuộc tính + hợp đồng |
| I6 | Năng lực = hàm của `recent_results`; câu hỏi lại (`is_retry`) không tính | đơn vị |
| I7 | Mỗi trạng thái khích lệ có ≥ 3 (cam kết 4) biến thể vi và en; không từ cấm; ngày kề nhau cùng trạng thái khác câu | đơn vị |
| I8 | Bảng gợi ý đơn điệu tăng; `reading/writing` chỉ ở mức 30; kế hoạch mô phỏng với mỗi bộ ≤ quỹ | đơn vị |
| I9 | Bài tập luyện không tạo `review_schedules` | tích hợp |
| I10 | `GET /me` trả `skills` đã lưu; ngữ cảnh học dùng `effectiveSkills` | hợp đồng |

## 5. Trạng thái phía client (không lưu bền)

| Trạng thái | Nơi giữ | Vòng đời |
|---|---|---|
| Hiện/ẩn mật khẩu | `State` của `PasswordField` | Mất khi widget bị hủy (rời màn, mở lại) – FR-002/003 |
| Bảng gợi ý `StudyDefaults` | Riverpod `FutureProvider` (cache theo phiên đăng nhập) | Một lần tải |
| "Lời mời gợi ý mới" sau khi đổi phút ở Hồ sơ | `State` màn Hồ sơ | Đến khi bấm Áp dụng/Giữ nguyên hoặc rời màn |
| Đoạn văn ghim khi làm bài | `LessonState` suy ra từ `items` của phiên | Theo phiên |
| Thu gọn/mở đoạn văn | `State` của panel | Theo màn |

Không thêm khóa nào vào `LocalStore`/bộ nhớ trình duyệt.
