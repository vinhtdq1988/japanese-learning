# Mô hình dữ liệu: Bài học Kanji

**Nhánh**: `003-kanji-lessons` | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md)

Tài liệu này chỉ mô tả **phần thay đổi** so với [data-model 001](../001-phase1-mvp/data-model.md); mọi bảng, quy tắc không nhắc tới ở đây giữ nguyên. Số mục `§2.x` tham chiếu tài liệu 001.

**Thuật ngữ thống nhất**: *khía cạnh* = `facet` (nghĩa / cách đọc / từ chứa chữ = `meaning` / `reading` / `word`); *cặp* = (chữ, khía cạnh); *mảng yếu* = chủ đề có cờ yếu, trả về ở API là `weakTopics`; *Học thêm* = luồng `POST /today/extra`; *bài Kanji* = đơn vị học `kind='kanji'`.

## 1. Tổng quan thay đổi

```text
skill (enum)            + 'kanji'                                   [0002_kanji_skill.sql]
review_facet (enum)     mới: item | meaning | reading | word        [0003_kanji.sql]

learning_profiles       + kanji_selected_at
topics                  (skill='kanji' cho chủ đề Kanji – không đổi cột)
learning_units          (kind='kanji' – không đổi cột)
content_items           + topic_id, + kanji_details ; examples[] + kanjiReading
exercises               + facet
study_records           + facet
review_schedules        + facet (vào khóa chính), + mastered_at
daily_plan_items        + review_facets
placement_questions     + CHECK skill <> 'kanji'
```

Quan hệ mới: `content_items *─0..1 topics` (chủ đề của chữ Kanji).

## 2. Kiểu liệt kê

### 2.1 `skill` (mở rộng)

`('vocabulary', 'grammar', 'kanji')`. Thêm bằng `ALTER TYPE skill ADD VALUE 'kanji'` trong migration riêng (research K2).

Hằng ứng dụng (`backend/src/domain/types.ts`):

| Hằng | Giá trị | Dùng ở |
|---|---|---|
| `SKILLS` | vocabulary, grammar, kanji | hồ sơ, đơn vị, mục, chủ đề |
| `PLACEMENT_SKILLS` | vocabulary, grammar | câu hỏi placement (Kanji ngoài phạm vi) |
| `TRIAL_SKILLS` | vocabulary, grammar | nội dung dùng thử (Kanji ngoài phạm vi) |

### 2.2 `review_facet` (mới)

| Giá trị | Ý nghĩa | Áp dụng cho |
|---|---|---|
| `item` | toàn bộ mục (khía cạnh duy nhất) | từ vựng, ngữ pháp; bài tập Kanji không gắn chữ |
| `meaning` | nhận diện nghĩa của chữ | Kanji |
| `reading` | chọn/điền cách đọc của chữ | Kanji |
| `word` | đọc/hiểu từ chứa chữ | Kanji |

Hằng `KANJI_FACETS = ['meaning', 'reading', 'word']`.

## 3. Thay đổi theo bảng

### 3.1 `learning_profiles` (§2.4)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| skills | skill[] | **Nới**: tập con không rỗng của {`vocabulary`,`grammar`,`kanji`}. Nghe, đọc vẫn bị từ chối (UI hiển thị khóa) |
| prioritized_skill | skill null | có thể là `kanji`; PHẢI thuộc `skills`. Bỏ kỹ năng đang ưu tiên khỏi `skills` → tự đặt `null` trong cùng giao dịch |
| kanji_selected_at | timestamptz null | **Mới**. Đặt `now()` khi `kanji` được thêm vào `skills` (onboarding hoặc `PATCH /me`) mà trước đó không có; giữ nguyên khi bỏ chọn (lịch sử); đặt lại khi chọn lại. Chỉ dùng đo SC-001/SC-008 |

**Quy tắc**: đổi `skills` KHÔNG tạo `learning_paths` mới; có hiệu lực ở kế hoạch sinh kế tiếp (research K5). Không đụng `unit_progress`, `study_records`, `review_schedules`, `topic_stats`.

Người dùng hiện có: migration KHÔNG sửa `skills` (giả định "không bị thay đổi hồ sơ tự động").

### 3.2 `topics` (§2.7)

Không đổi cột. Chủ đề Kanji có `skill='kanji'`, `level` ∈ N5–N3, tên song ngữ. Nguồn: `content/topics.json` (khóa ổn định, ví dụ `kanji-n5-numbers`).

### 3.3 `learning_units` (§2.8) – đơn vị `kind='kanji'` (Bài học Kanji)

Không đổi cột. Ràng buộc bổ sung khi kích hoạt (research K10):

| Quy tắc | Chi tiết |
|---|---|
| Số chữ | 3–5 mục `kind='kanji'`, `status='active'` |
| Tầng | `tier='core'` (không có Kanji `foundation`) |
| Thẻ mục tiêu | `goal_tags` không rỗng (FR-011; từ vựng/ngữ pháp vẫn cho phép rỗng như 001) |
| Chủ đề đơn vị | `topic_id` trỏ tới chủ đề `skill='kanji'` |
| Bao phủ bài tập | với mỗi chữ `active` và mỗi khía cạnh ∈ `KANJI_FACETS`: ≥ 1 bài tập `active` có `item_id` = chữ đó, `facet` = khía cạnh đó |
| Trộn loại | mọi mục `active` của đơn vị Kanji có `kind='kanji'`; đơn vị từ vựng/ngữ pháp không chứa mục Kanji |
| Thời lượng | số bài tập `active` × `REVIEW_SECONDS_PER_ITEM` (cấu hình, mặc định 30 giây) ≤ `est_minutes` × 60 (Hiến pháp I); vượt → lỗi `exercises` |
| Chữ duy nhất | mỗi `japanese` chỉ có ở một mục Kanji `active` trong toàn danh mục (không trùng lịch ôn); trùng → lỗi `items[i].japanese` |
| Danh mục | mỗi trình độ N5, N4, N3 có ≥ 1 đơn vị Kanji `active` với `est_minutes=5` (SC-004); quy tắc "N5 foundation 5 phút" không áp dụng cho `kanji` |

### 3.4 `content_items` (§2.9) – mục `kind='kanji'` (Chữ Kanji)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| japanese | text | Kanji: đúng một ký tự CJK Unified Ideographs, có glyph trong phông đóng gói (research K9) |
| reading | text null | Kanji: NULL (cách đọc nằm trong `kanji_details`) |
| meaning | i18n_text | nghĩa vi + en |
| explanation | i18n_text null | tùy chọn (ghi chú dùng chữ, mẹo nhớ) |
| examples | jsonb | Kanji: các **từ ví dụ** `[{ja, reading, translation, kanjiReading?}]`; ≥ 1 bắt buộc, NÊN ≥ 2 |
| topic_id | uuid null FK → topics | **Mới**. Bắt buộc khi `kind='kanji'` lúc kích hoạt (thẻ chủ đề – FR-018; có thể NULL ở bản nháp), NULL với kind khác |
| kanji_details | jsonb null | **Mới**. Bắt buộc khi `kind='kanji'` lúc kích hoạt (có thể NULL ở bản nháp), NULL với kind khác. Dạng ở dưới |

`kanji_details`:

```json
{
  "onReadings":  ["ニチ", "ジツ"],
  "kunReadings": ["ひ", "か"],
  "strokeCount": 4,
  "components":  { "vi": "Bộ Nhật (日)", "en": "Sun radical (日)" }
}
```

| Khóa | Kiểu | Quy tắc |
|---|---|---|
| onReadings | string[] | katakana (cho phép `ー`); có thể rỗng |
| kunReadings | string[] | hiragana, `.` phân cách okurigana (ví dụ `た.べる`); có thể rỗng |
| (onReadings ∪ kunReadings) | | không rỗng (FR-002: ít nhất một cách đọc). Phía hiển thị chỉ hiện nhóm có phần tử (trường hợp biên) |
| strokeCount | integer | 1–30 |
| components | i18n_text | tùy chọn (FR-002: CÓ THỂ có bộ thủ/thành phần) |

Từ ví dụ (`examples[]` của mục Kanji):

| Khóa | Quy tắc |
|---|---|
| ja | chứa chính chữ Kanji của mục; mọi ký tự có glyph |
| reading | bắt buộc, chỉ kana |
| translation | i18n_text vi + en |
| kanjiReading | tùy chọn: cách đọc của chữ trong từ này (bỏ okurigana); NÊN thuộc tập cách đọc của chữ – khác thì chỉ cảnh báo (biến âm). Bài học hiển thị để nêu rõ cách đọc nào dùng trong từ nào |

**CHECK DB** (`0003_kanji.sql`), một chiều để vẫn lưu được bản nháp chữ chưa đủ thông tin (việc đủ dữ liệu được kiểm khi kích hoạt – research K10):
- `kind = 'kanji' OR kanji_details IS NULL`
- `kind = 'kanji' OR topic_id IS NULL`

Từ ví dụ là dữ liệu riêng của mục Kanji – không khóa ngoại tới mục `vocabulary` (Làm rõ 2026-11-05).

### 3.5 `exercises` (§2.10)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| facet | review_facet | **Mới**, NOT NULL DEFAULT `item`. Bài tập gắn mục Kanji: ∈ `KANJI_FACETS`; mọi bài tập khác: `item` |

**Xác thực** (ứng dụng, khi kích hoạt): `item_id` trỏ mục Kanji ⇔ `facet ≠ 'item'`. Loại bài tập giữ nguyên (`multiple_choice`, `matching`, `fill_blank`). Câu `reading` của chữ có nhiều cách đọc PHẢI nêu từ ngữ cảnh trong đề (hướng dẫn biên soạn, kiểm qua checklist).

Bảo toàn khi sửa (§2.10) không đổi: bài tập vắng mặt trong payload → `inactive`; không xóa cứng.

### 3.6 `study_records` (§2.14)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| facet | review_facet | **Mới**, NOT NULL DEFAULT `item`; sao chép từ bài tập trong snapshot lúc ghi |

`topic_id` lúc ghi = chủ đề của mục được kiểm tra nếu mục có `topic_id`, ngược lại chủ đề của đơn vị (research K4). Dòng cũ không đổi.

Chỉ mục mới: `study_records(user_id, item_id, facet, occurred_at DESC) WHERE is_retry = false` – phục vụ "độ chính xác gần đây" theo cặp (R6).

### 3.7 `review_schedules` (§2.16) – Lịch ôn theo cặp (mục, khía cạnh)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| user_id, item_id | | như cũ |
| facet | review_facet | **Mới**, NOT NULL DEFAULT `item` |
| PK | (user_id, item_id, facet) | **Đổi** từ (user_id, item_id) |
| mastered_at | timestamptz null | **Mới**. Đặt khi người học đánh dấu chữ Kanji đã thành thạo (áp cho mọi khía cạnh của chữ); NULL = đang ôn |
| interval_days, ease, repetitions, lapses, due_date, last_result, last_reviewed_at, last_reviewed_local_date, is_hard | | như cũ, nay tính **theo cặp** |

**Quy tắc**:
- Cập nhật theo SM-2 biến thể (R6) cho đúng cặp `(item_id, facet)` của bài tập vừa trả lời; các khía cạnh khác của chữ không đổi (US3.3). Mỗi cặp cập nhật tối đa một lần mỗi ngày địa phương.
- Chọn mục đến hạn (`listDueReviewItems`): `due_date ≤ hôm nay` AND `mastered_at IS NULL` AND mục `active` AND đơn vị `active` AND tồn tại bài tập `active` có cùng `item_id` **và** `facet` AND (mục không phải Kanji OR người học có `unit_progress.status='completed'` cho đơn vị chứa chữ).
- Dòng lịch có thể được ghi theo từng câu trả lời trong bài dở dang (như 001); với Kanji, bài dở dang chưa làm chữ "đến hạn" hay "đã học".
- Chữ "đến hạn" = có ≥ 1 cặp thỏa điều kiện trên; "đã học" (Kanji) = có ≥ 1 dòng lịch bất kể `mastered_at` **và** đơn vị chứa chữ đã `completed` với người học.
- Chỉ mục `(user_id, due_date)` giữ nguyên.

**Chuyển trạng thái thành thạo của chữ** (chỉ mục Kanji, research K7):
`mastered_at = NULL` (đang ôn) `→` `mastered_at = now()` (đánh dấu) `→` `NULL` (bỏ đánh dấu; lịch tiếp tục từ `due_date` đã lưu, nếu đã qua thì đến hạn ngay).

Migration: thêm cột với DEFAULT `item` (dòng cũ thành cặp `(item_id,'item')`), xóa PK cũ, tạo PK mới – không mất dữ liệu.

### 3.8 `daily_plan_items` (§2.12)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| review_item_ids | uuid[] null | như cũ: phần tử thứ i là `item_id` của câu ôn thứ i (một chữ Kanji có thể xuất hiện nhiều lần với khía cạnh khác nhau) |
| review_facets | review_facet[] null | **Mới**. Song song với `review_item_ids`: phần tử thứ i là khía cạnh của câu ôn thứ i. NULL = mọi phần tử `item` (mọi dòng cũ và mọi gói không có Kanji) |

**CHECK**: `review_facets IS NULL OR cardinality(review_facets) = cardinality(review_item_ids)`.

Khóa ghép dùng với engine: `itemId` khi facet `item`, `itemId:facet` khi Kanji (research K3). `est_minutes` và quy tắc ≤ 15 phút/gói, ôn ≤ 60% quỹ không đổi. `PlanItem.itemCount` = số câu ôn (số phần tử).

### 3.9 `placement_questions` (§2.5)

Thêm CHECK `skill <> 'kanji'` (bộ 20 câu giữ nguyên, Kanji ngoài phạm vi placement).

### 3.10 `admin_action_logs` (§2.18)

Không đổi. Thao tác trên bài Kanji ghi `unit.create` / `unit.update` / `unit.status` như đơn vị khác; `diff` bao gồm `kanjiDetails`, `topicId`, `facet` thay đổi (FR-023).

## 4. Thực thể tính toán (không lưu)

### 4.1 Tiến độ Kanji (mở rộng Progress Summary)

| Trường | Nguồn |
|---|---|
| `kanji.charactersLearned` | `COUNT(DISTINCT rs.item_id)` từ `review_schedules rs JOIN content_items ci` với `ci.kind='kanji'`, nối `unit_progress up` (cùng `user_id`, `up.unit_id = ci.unit_id`) với `up.status='completed'` |
| `kanji.lessonsCompleted` | `unit_progress.status='completed'` của đơn vị `kind='kanji'` |
| `kanji.minutes` | hợp khoảng `study_intervals` của phiên có `unit.kind='kanji'` + phần phân bổ của phiên ôn hỗn hợp theo tỷ lệ câu lượt chính Kanji (research K8) |
| `kanji.reviewAccuracy` | câu lượt chính, `context='review'`, mục `kind='kanji'`: đúng / tổng; null nếu chưa ôn Kanji |
| `weakTopics[].skill` | `topics.skill` của chủ đề yếu |

`kanji` = null khi `kanji ∉ skills` **và** chưa có dữ liệu học Kanji nào (người học không chọn Kanji thấy tiến độ như cũ).

### 4.2 Tóm tắt phiên

`attentionItems[]`: các mục Kanji có ≥ 1 câu lượt chính sai trong phiên, theo thứ tự xuất hiện; `{itemId, japanese}`.

### 4.3 Snapshot phiên học (`domain/session-snapshot.ts`, R12)

Bổ sung trường tùy chọn, giữ `SNAPSHOT_VERSION = 1`:

| Vị trí | Trường | Ghi chú |
|---|---|---|
| `items[]` | `topicId?` | chủ đề của mục (Kanji) |
| `items[]` | `kanji?` | `{ onReadings, kunReadings, strokeCount, components? }` (đã bản địa hóa `components`) |
| `items[].examples[]` | `kanjiReading?` | |
| `exercises[]` | `facet?` | vắng mặt = `item` (snapshot cũ) |

`buildReviewSnapshot` nhận danh sách cặp `{itemId, facet}` thay cho `itemIds` và chọn bài tập khớp cả hai.

## 5. Migration

| File | Nội dung |
|---|---|
| `backend/src/db/migrations/0002_kanji_skill.sql` | `ALTER TYPE skill ADD VALUE IF NOT EXISTS 'kanji';` (file riêng vì giá trị enum mới chỉ dùng được sau commit) |
| `backend/src/db/migrations/0003_kanji.sql` | `CREATE TYPE review_facet`; cột mới §3.1, §3.4–§3.8; CHECK §3.4, §3.8, §3.9; đổi PK `review_schedules`; chỉ mục §3.6 |

Cả hai chỉ thêm cột có DEFAULT hoặc NULL → dữ liệu 001 hợp lệ ngay sau migration; kiểm thử tích hợp chạy migration trên CSDL đã seed nội dung 001 và có lịch ôn (Hiến pháp: không âm thầm phá dữ liệu đã lưu). `backend/src/db/schema.ts` cập nhật tương ứng (Drizzle chỉ để truy vấn có kiểu).

## 6. Chỉ mục và ràng buộc quan trọng (bổ sung)

- `review_schedules` PK `(user_id, item_id, facet)`.
- `study_records(user_id, item_id, facet, occurred_at DESC) WHERE is_retry = false`.
- `content_items(topic_id) WHERE topic_id IS NOT NULL`.
- CHECK `content_items` (một chiều): `kind = 'kanji' OR kanji_details IS NULL`, `kind = 'kanji' OR topic_id IS NULL`.
- CHECK `daily_plan_items`: độ dài `review_facets` = `review_item_ids` khi khác NULL.
- CHECK `placement_questions.skill <> 'kanji'`.
