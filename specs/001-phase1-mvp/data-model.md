# Mô hình dữ liệu: Giai đoạn 1 – MVP

**Nhánh**: `001-phase1-mvp` | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md)

CSDL: PostgreSQL 16. Khóa chính `id` là UUID (v7 ưu tiên) trừ khi ghi chú khác. Mọi bảng có `created_at timestamptz`; bảng có thể sửa có thêm `updated_at`. Văn bản dịch lưu dạng JSONB `{"vi": "...", "en": "..."}` (kiểu `i18n_text`).

## 1. Sơ đồ quan hệ (rút gọn)

```text
users 1─1 learning_profiles
users 1─* learning_paths            (tham số sinh; thứ tự đơn vị tính động, không lưu)
users 1─* unit_progress *─1 learning_units
users 1─* pause_periods
users 1─* auth_sessions
users 1─* password_reset_tokens
users 1─* placement_results *─1 (placement_questions qua answers JSONB)
users 1─* daily_plans 1─* daily_plan_items
users 1─* lesson_sessions *─1 learning_units
users 1─* study_records ──* exercises
users 1─* review_schedules *─1 content_items
users 1─* study_intervals
users 1─* topic_stats
learning_units 1─* content_items (vocab | grammar) ; learning_units 1─* exercises
admin_action_logs *─1 users (actor)
```

## 2. Thực thể

### 2.1 `users` (Tài khoản người học – Learner Account)

| Trường | Kiểu | Ghi chú / ràng buộc |
|---|---|---|
| id | uuid PK | |
| email | citext | `UNIQUE` (không phân biệt hoa thường); KHÔNG nhả lại khi `deletion_requested_at` còn trong 30 ngày (FR-003) |
| password_hash | text | argon2id |
| role | enum(`learner`,`admin`) | mặc định `learner` (FR-004) |
| status | enum(`active`,`disabled`,`pending_deletion`) | `disabled` = admin vô hiệu hóa (FR-031); `pending_deletion` = người học tự xóa |
| deletion_requested_at | timestamptz null | đặt khi `pending_deletion`; xóa vĩnh viễn khi `now() ≥ +30 ngày` |
| from_trial | boolean | mặc định `false`; `true` khi đăng ký ngay sau dùng thử trên cùng trình duyệt (`fromTrial` của `POST /auth/register`, đo SC-011). Không lưu thêm dữ liệu nào về phiên dùng thử |
| created_at, updated_at | timestamptz | |

**Quy tắc**: Đăng nhập và làm mới token bị chặn (403 `ACCOUNT_DISABLED`) nếu `status='disabled'`; khi admin vô hiệu hóa, mọi `auth_sessions` của người dùng bị thu hồi trong cùng giao dịch, access token đã cấp còn hiệu lực đến khi hết hạn (tối đa 15 phút, rủi ro được chấp nhận – research R4). Nếu `pending_deletion` và còn trong 30 ngày, đăng nhập thành công chỉ cho phép gọi `POST /account/restore` (hoặc trả mã đặc biệt để UI hiển thị lời mời khôi phục). Đăng ký email trùng với bản ghi `pending_deletion` bị từ chối với mã `EMAIL_PENDING_DELETION`.

**Đổi email / mật khẩu (FR-002)**: đổi email qua `PATCH /me` bắt buộc kèm `currentPassword` đúng; email mới trùng tài khoản khác bị từ chối 409 `EMAIL_TAKEN`, trùng tài khoản đang chờ xóa bị từ chối 409 `EMAIL_PENDING_DELETION`. Đổi mật khẩu qua `PUT /me/password` yêu cầu `currentPassword` đúng và thu hồi mọi `auth_sessions` khác (giữ phiên hiện tại), tương tự đặt lại mật khẩu.

**Cấp quyền quản trị (FR-004)**: không có đường đăng ký công khai nào tạo `role='admin'`. Tài khoản admin được tạo hoặc nâng quyền bằng lệnh vận hành nội bộ `pnpm admin:create --email <email>` chạy trên máy chủ (cả dev và production); mỗi lần chạy ghi một dòng `admin_action_logs` với `action='user.grant_admin'`, `actor_id` null (thao tác hệ thống).

**Chuyển trạng thái**:
`active → pending_deletion` (người học xóa) → `active` (khôi phục ≤ 30 ngày) | `[xóa cứng]` (quá 30 ngày, job nền).
`active ↔ disabled` (chỉ admin). Tài khoản `disabled` không thể tự khôi phục/xóa.

### 2.2 `auth_sessions`

Phiên đăng nhập (refresh token); khác với `lesson_sessions` là phiên học.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users ON DELETE CASCADE | |
| refresh_token_hash | text UNIQUE | SHA-256 của refresh token (opaque) |
| expires_at | timestamptz | 30 ngày; xoay vòng mỗi lần làm mới |
| revoked_at | timestamptz null | |
| user_agent | text null | |

### 2.3 `password_reset_tokens`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| token_hash | text UNIQUE | SHA-256 của token |
| expires_at | timestamptz | `created_at + 1 giờ` |
| used_at | timestamptz null | dùng một lần; đã dùng hoặc hết hạn bị từ chối (trường hợp biên) |

### 2.4 `learning_profiles` (Hồ sơ học tập – Learning Profile) — quan hệ 1–1 với `users`

| Trường | Kiểu | Ghi chú / ràng buộc |
|---|---|---|
| user_id | uuid PK FK CASCADE | |
| display_name | text | 1–60 ký tự |
| current_level | enum(`none`,`N5`,`N4`,`N3`,`N2`,`N1`) | tự khai báo (FR-005) |
| goal_type | enum(`jlpt`,`daily_conversation`,`work`) | |
| target_level | enum(`N5`,`N4`,`N3`,`N2`,`N1`) null | bắt buộc nếu `goal_type='jlpt'` |
| daily_minutes | smallint | ∈ {5,10,15,30} (FR-005) |
| target_date | date null | mốc mong muốn đạt mục tiêu |
| skills | text[] | tập con của {`vocabulary`,`grammar`}; không rỗng |
| prioritized_skill | enum(`vocabulary`,`grammar`) null | FR-016 |
| language | enum(`vi`,`en`) | mặc định `vi` (FR-019a) |
| timezone | text | IANA, ví dụ `Asia/Ho_Chi_Minh` |
| onboarding_state | enum(`not_started`,`in_progress`,`completed`) | hỗ trợ bỏ dở/tiếp tục onboarding |
| onboarding_draft | jsonb null | các bước đã nhập dở |
| paused | boolean | mặc định false (US5.3); lịch sử các giai đoạn tạm dừng ở `pause_periods` |
| updated_at | timestamptz | |

**Xác thực**: `daily_minutes` ∈ tập cho phép; `skills ⊆ {vocabulary, grammar}` trong Giai đoạn 1 (UI onboarding hiển thị nghe, đọc, Kanji dưới dạng tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này"; server từ chối mọi giá trị ngoài tập trên – trường hợp biên). `current_level`/`target_level` ∈ {`N2`,`N1`} được chấp nhận nhưng nội dung Giai đoạn 1 chỉ đến N3: lộ trình dùng N3 làm trần và báo `scopeNotice='content_ceiling_n3'` (research R7).

### 2.4a `pause_periods` (Giai đoạn tạm dừng)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| started_on | date | ngày địa phương bắt đầu tạm dừng |
| ended_on | date null | ngày địa phương tiếp tục; null = đang tạm dừng |

**Quy tắc**: tối đa một giai đoạn mở mỗi người học (unique partial index `(user_id) WHERE ended_on IS NULL`); `POST /path/pause` mở giai đoạn và đặt `paused=true`, `POST /path/resume` đóng giai đoạn và đặt `paused=false` trong cùng giao dịch. Chuỗi ngày học và phát hiện khoảng nghỉ loại mọi ngày thuộc `[started_on, ended_on)` (R7, R11).

### 2.5 `placement_questions` (Câu hỏi kiểm tra trình độ)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| level | enum(`N5`,`N4`,`N3`) | |
| skill | enum(`vocabulary`,`grammar`) | |
| topic_id | uuid FK → topics | mảng để nhận diện điểm yếu |
| prompt | jsonb | nội dung câu hỏi (Nhật + bản dịch hướng dẫn nếu cần) |
| choices | jsonb | danh sách lựa chọn (trắc nghiệm) |
| correct_choice | smallint | chỉ trả về qua chấm điểm, KHÔNG trả trong `GET /placement/questions` |
| position | smallint | thứ tự trong bộ cố định |
| is_active | boolean | |

**Quy tắc**: Bộ kích hoạt gồm đúng 20 câu (8 N5, 6 N4, 6 N3); chỉ thay đổi bằng thao tác kích hoạt cả bộ (`PUT /admin/placement-questions/active-set`, nguyên tử, trong một giao dịch), kiểm tra khi kích hoạt (FR-007, FR-030). Sửa một câu đang thuộc bộ kích hoạt được phép và có hiệu lực cho lần làm bài sau; `placement_results` cũ giữ nguyên `answers` và `score` đã chấm.

### 2.6 `placement_results`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| answers | jsonb | `[{questionId, choice}]` |
| estimated_level | enum(`none`,`N5`,`N4`,`N3`) | `none` khi đoán mò/kém (an toàn cho người mới) |
| strong_topics, weak_topics | uuid[] | |
| score | smallint | số câu đúng |
| duration_seconds | int | |
| taken_at | timestamptz | |
| is_current | boolean | kết quả hiện hành dùng cho lộ trình; kết quả cũ giữ làm lịch sử (FR-009) |

### 2.7 `topics` (Mảng nội dung)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| skill | enum(`vocabulary`,`grammar`) | |
| name | i18n_text | ví dụ "Trợ từ", "Động từ thể ます", "Đồ ăn thức uống" |
| level | enum(`N5`,`N4`,`N3`) | |

Dùng cho `topic_stats`, điểm yếu (FR-029) và điều chỉnh độ khó (FR-013).

### 2.8 `learning_units` (Đơn vị học – Learning Unit)

| Trường | Kiểu | Ghi chú / ràng buộc |
|---|---|---|
| id | uuid PK | |
| kind | enum(`vocabulary`,`grammar`) | |
| title | i18n_text | |
| level | enum(`N5`,`N4`,`N3`) | FR-021 |
| goal_tags | text[] | tập con của {`jlpt`,`daily_conversation`,`work`} (mức liên quan mục tiêu, FR-021) |
| topic_id | uuid FK → topics | |
| difficulty | smallint | 1–5 |
| tier | enum(`foundation`,`core`) | mặc định `core`; `foundation` = nền tảng người mới (chỉ hợp lệ với `level='N5'`), lộ trình người mới bắt đầu từ đây (US1.5, R7) |
| est_minutes | smallint | CHECK ∈ {5,10,15} (FR-017) |
| sequence | int | thứ tự tham chiếu trong nội dung |
| is_trial | boolean | thuộc tập dùng thử (FR-037) |
| status | enum(`draft`,`active`,`inactive`) | chỉ `active` hiển thị cho người học |
| updated_at | timestamptz | |

**Ràng buộc nội dung** (kiểm tra khi kích hoạt): có ít nhất một nội dung (mục từ vựng/điểm ngữ pháp) và ≥ 1 bài tập; bản dịch vi + en đầy đủ; mỗi (level × kind) có ≥ 1 đơn vị `est_minutes = 5`; `tier='foundation'` chỉ cho `level='N5'`; mỗi `kind` có ≥ 1 đơn vị N5 `foundation` 5 phút.

### 2.9 `content_items` (Mục từ vựng / Điểm ngữ pháp – nội dung nhỏ nhất)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | cũng là khóa để lên lịch ôn tập |
| unit_id | uuid FK → learning_units | |
| kind | enum(`vocabulary`,`grammar`) | |
| japanese | text | từ/cấu trúc tiếng Nhật (FR-019) |
| reading | text null | cách đọc (bắt buộc với `vocabulary`) |
| meaning | i18n_text | nghĩa (vocab) hoặc tên điểm ngữ pháp |
| explanation | i18n_text null | giải thích (bắt buộc với `grammar`) |
| examples | jsonb | `[{ja, reading?, translation: i18n_text}]`; `grammar` yêu cầu ≥ 1; `vocabulary` NÊN có |
| position | smallint | thứ tự trong đơn vị |
| status | enum(`active`,`inactive`) | |

### 2.10 `exercises` (Bài tập)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK | |
| item_id | uuid FK → content_items null | mục mà bài tập kiểm tra (đầu vào cho lịch ôn) |
| type | enum(`multiple_choice`,`matching`,`fill_blank`) | FR-025 (chỉ dạng khách quan) |
| prompt | i18n_text / jsonb | |
| payload | jsonb | `multiple_choice`: `choices[]`, `correct_index`; `matching`: `pairs[]`; `fill_blank`: `accepted_answers[]` (tập cố định, chuẩn hóa khi so khớp) |
| feedback_correct, feedback_incorrect | i18n_text | phản hồi tức thì (FR-018) |
| position | smallint | |
| status | enum(`active`,`inactive`) | |

**Xác thực**: `fill_blank` PHẢI có `accepted_answers` hữu hạn không rỗng; `matching` mỗi cặp hợp lệ; `multiple_choice` `correct_index` nằm trong `choices`.

**Bảo toàn dữ liệu đã lưu khi sửa nội dung** (áp dụng cho `content_items` và `exercises`; Hiến pháp: thay đổi nội dung KHÔNG ĐƯỢC âm thầm làm hỏng dữ liệu đã lưu): admin sửa đơn vị qua payload lồng `AdminUnitWrite`; phần tử có `id` được cập nhật tại chỗ, phần tử không có `id` được tạo mới, phần tử hiện có vắng mặt trong payload bị chuyển `status='inactive'`. Không có thao tác xóa cứng mục/bài tập qua API, nên khóa ngoại từ `study_records.exercise_id`/`item_id` và `review_schedules.item_id` luôn hợp lệ. Mục/bài tập `inactive` không vào snapshot của phiên mới, không được chọn để ôn (§2.16) và không tính vào tiến độ mục tiêu; lịch sử học của chúng vẫn được tính trong độ chính xác và thời gian học đã ghi.

### 2.11 `learning_paths` (Lộ trình học – Learning Path) và `unit_progress`

Lộ trình **không lưu danh sách đơn vị**. `learning_paths` chỉ lưu tham số sinh (điểm xuất phát, khoảng trình độ, mục tiêu, kỹ năng, kết quả placement). Thứ tự đơn vị được engine tính động mỗi khi cần (`GET /path`, sinh kế hoạch ngày, học thêm) từ: tham số lộ trình `active` + hồ sơ hiện tại (`prioritized_skill`) + đơn vị `active` hiện hành + `unit_progress` + `topic_stats` (R7). Nhờ vậy đơn vị admin mới kích hoạt tự động có mặt và đơn vị bị vô hiệu hóa tự động biến mất (SC-008).

`learning_paths`:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| status | enum(`active`,`superseded`) | mỗi người học chỉ có 1 lộ trình `active` (unique partial index) |
| reason | enum(`onboarding`,`rebuild_request`,`goal_change`,`level_change`,`placement_retake`) | lý do sinh lộ trình (đo SC-003) |
| generated_from | jsonb | ảnh chụp tham số sinh (start_level, level_range, goal_type, target_level, target_date, skills, placement_result_id, scope_notice) để tái hiện/kiểm thử |
| created_at | timestamptz | |

`unit_progress` (trạng thái của người học với từng đơn vị, độc lập với lộ trình):

| Trường | Kiểu | Ghi chú |
|---|---|---|
| user_id | uuid FK CASCADE | |
| unit_id | uuid FK → learning_units | |
| status | enum(`in_progress`,`completed`,`mastered`) | không có dòng = chưa học (`pending` trong API); `mastered` = người học đánh dấu đã thành thạo (loại khỏi bài sắp tới, FR-016) |
| updated_at | timestamptz | |
| PK | (user_id, unit_id) | |

**Chuyển trạng thái unit_progress**: (không có dòng) `→ in_progress` (bắt đầu phiên `new_unit`) `→ completed` (hoàn thành phiên); (không có dòng)`|in_progress → mastered` (người học đánh dấu); bỏ đánh dấu `mastered` → xóa dòng (hoặc trả về `completed` nếu đã từng hoàn thành).

**Xây dựng lại lộ trình** (đổi mục tiêu, đổi trình độ, xây dựng lại toàn bộ, theo kết quả placement mới): tạo `learning_paths` mới với `reason` tương ứng, đặt bản cũ `superseded`; **không đụng** `unit_progress`, `study_records`, `review_schedules`, `topic_stats` (lịch sử giữ nguyên, US1.6/US5.2). Đổi `daily_minutes` hoặc `prioritized_skill` không tạo lộ trình mới: chúng được đọc trực tiếp khi sinh kế hoạch kế tiếp.

**Đo SC-003**: người học "chấp nhận điểm xuất phát" khi không có lộ trình nào với `reason ∈ {rebuild_request, goal_change, level_change, placement_retake}` trong 7 ngày kể từ lộ trình `reason='onboarding'`; nhóm "có làm placement" = lộ trình onboarding có `generated_from.placement_result_id` khác null.

### 2.12 `daily_plans` và `daily_plan_items` (Kế hoạch hằng ngày)

`daily_plans`:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| local_date | date | UNIQUE (user_id, local_date): sinh một lần/ngày, idempotent |
| budget_minutes | smallint | `daily_minutes` tại lúc sinh |
| estimated_minutes | smallint | CHECK ≤ budget_minutes (FR-012) |
| status | enum(`open`,`completed`) | `completed` khi mọi mục hoàn thành (US2.3) |
| completed_at | timestamptz null | |

`daily_plan_items`:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| plan_id | uuid FK CASCADE | |
| type | enum(`new_unit`,`review_batch`) | |
| unit_id | uuid null | với `new_unit` |
| review_item_ids | uuid[] null | với `review_batch` (tập mục ôn đến hạn được chọn) |
| est_minutes | smallint | CHECK 1 ≤ giá trị ≤ 15 (Nguyên tắc I); `review_batch` tính theo `REVIEW_SECONDS_PER_ITEM` (research R7) |
| position | smallint | |
| status | enum(`pending`,`in_progress`,`completed`) | |

**Quy tắc**: Gói ôn tập tối đa 60% `budget_minutes` (riêng khi phần dư < 5 phút, như `budget_minutes = 5`, ngày là chỉ-ôn hoặc chỉ-bài-mới và luân phiên, xem research R7); tổng `est_minutes` ≤ `budget_minutes`. Phần ôn vượt 15 phút được chia thành nhiều `review_batch`, mỗi gói ≤ 15 phút (research R7). Không sinh kế hoạch khi `paused`.

### 2.13 `lesson_sessions` (Phiên học)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| plan_item_id | uuid FK null | null với "học thêm" (US2.5) |
| kind | enum(`new_unit`,`review`,`extra`) | |
| unit_id | uuid null | |
| snapshot | jsonb | ảnh chụp bài tập đã bản địa hóa lúc bắt đầu (R12) |
| status | enum(`in_progress`,`completed`) | |
| started_at, completed_at | timestamptz | |

### 2.14 `study_records` (Bản ghi học tập – Study Record)

Mỗi dòng là một câu trả lời bài tập/ôn tập.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| client_event_id | uuid | **UNIQUE (user_id, client_event_id)** (FR-041) |
| session_id | uuid FK → lesson_sessions | |
| exercise_id | uuid FK | |
| item_id | uuid FK → content_items null | |
| topic_id | uuid FK → topics | |
| is_correct | boolean | do server chấm |
| submitted_answer | jsonb | |
| context | enum(`lesson`,`review`) | |
| is_retry | boolean | mặc định `false`; `true` = câu hỏi lại cuối phiên (R6): có phản hồi, không cập nhật `review_schedules`/`topic_stats`, không tính vào độ chính xác |
| occurred_at | timestamptz | |
| local_date | date | ngày địa phương lúc xảy ra (R11) |

### 2.15 `study_intervals` (khoảng thời gian học)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK CASCADE | |
| client_event_id | uuid | UNIQUE (user_id, client_event_id) |
| session_id | uuid FK | |
| started_at | timestamptz | |
| duration_seconds | int | CHECK 0 < giá trị ≤ 1800 mỗi khoảng (chống số liệu bất thường) |
| local_date | date | |

Tổng thời gian học = độ dài của hợp các khoảng `[started_at, started_at + duration_seconds)` theo người học (các khoảng chồng nhau từ nhiều cửa sổ chỉ tính một lần) (FR-026/041).

### 2.16 `review_schedules` (Lịch ôn tập – Review Schedule)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| user_id | uuid FK CASCADE | |
| item_id | uuid FK → content_items | |
| PK | (user_id, item_id) | |
| interval_days | int | |
| ease | numeric(3,2) | 1.30–2.80 |
| repetitions | int | |
| lapses | int | |
| due_date | date | ngày địa phương đến hạn; chỉ mục `(user_id, due_date)` |
| last_result | boolean | |
| last_reviewed_at | timestamptz | |
| last_reviewed_local_date | date null | mỗi mục cập nhật lịch tối đa một lần mỗi ngày địa phương (FR-041) |
| is_hard | boolean | cờ "mục khó" (R6) |

Cập nhật theo R6 trong cùng giao dịch với việc chèn `study_records` (có khóa hàng); bỏ qua khi `is_retry` hoặc khi `last_reviewed_local_date` bằng ngày địa phương hiện tại.

Khi chọn mục ôn đến hạn, bỏ qua mục có `content_items.status='inactive'` hoặc không còn bài tập `active` nào gắn với nó; dòng `review_schedules` vẫn được giữ nguyên để lịch tiếp tục khi mục được kích hoạt lại (§2.9).

### 2.17 `topic_stats` (thống kê theo mảng – điểm yếu và độ khó thích ứng)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| user_id, topic_id | PK | |
| recent_results | smallint[] | tối đa 20 kết quả gần nhất (1/0) |
| accuracy | numeric(4,3) | tính từ `recent_results` |
| difficulty_bias | smallint | −2..+2 (FR-013) |
| consecutive_low, consecutive_high | smallint | đếm phiên liên tiếp < 60% / > 90% |
| is_weak | boolean | cờ điểm yếu cơ bản (FR-029): accuracy < 60% với ≥ 8 câu; tự bỏ cờ khi accuracy ≥ 70% |

### 2.18 `admin_action_logs` (Nhật ký hành động quản trị – FR-032)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| id | uuid PK | |
| actor_id | uuid FK → users (SET NULL khi actor bị xóa cứng) | |
| action | text | ví dụ `unit.create`, `unit.update`, `user.disable` |
| target_type, target_id | text, uuid | |
| diff | jsonb | trước/sau (đã loại thông tin nhạy cảm) |
| occurred_at | timestamptz | |

### 2.19 `aggregate_daily_stats` (Thống kê tổng hợp ẩn danh)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| day | date | |
| metric | text | thuộc danh sách cố định (xem §4); máy chủ từ chối giá trị khác |
| value | bigint | bộ đếm, tăng bằng upsert |
| PK | (day, metric) | |

Không có khóa ngoại tới người dùng, không lưu IP/định danh (FR-038, SC-011); được giữ lại khi xóa vĩnh viễn tài khoản (FR-003).

## 3. Thực thể không nằm trong CSDL

- **Phiên dùng thử (Trial Session)** — chỉ ở trình duyệt (`LocalStore`): `{ trialProgress, trialAnswers, placementAnswers, startedAt }`. Không có bảng tương ứng (FR-038). Khi đăng ký, `placementAnswers` được gửi để server chấm và tạo `placement_results` (FR-039).
- **Tóm tắt tiến độ (Progress Summary)** — là **chế độ xem tính toán** (không lưu): tổng hợp từ `study_intervals`, `study_records`, `unit_progress`, `pause_periods`, `review_schedules`, `topic_stats` (xem `GET /progress`).

## 4. Xóa vĩnh viễn (FR-003)

Job nền hằng ngày: `DELETE FROM users WHERE status='pending_deletion' AND deletion_requested_at < now() - interval '30 days'`. Mọi bảng người học tham chiếu `users` bằng `ON DELETE CASCADE` nên dữ liệu cá nhân bị xóa hết. Thống kê tổng hợp ẩn danh (nếu có) nằm ở bảng riêng `aggregate_daily_stats` (không có khóa ngoại tới người dùng, chỉ đếm số lượng theo ngày, xem §2.19); ngoài số liệu xóa tài khoản còn có các metric dùng thử, mỗi metric là bộ đếm ẩn danh theo ngày, không lưu IP/định danh (FR-038, SC-011): `trial_content_loaded` (lượt tải nội dung dùng thử), `trial_lesson_completed` (lượt hoàn thành bài mẫu), `trial_placement_completed` (lượt hoàn thành bài kiểm tra trình độ), `trial_placement_level_none|N5|N4|N3` (phân bố trình độ ước tính). Tên metric thuộc danh sách cố định; máy chủ từ chối giá trị khác.

## 5. Chỉ mục và ràng buộc quan trọng

- `users(email)` unique (citext).
- `learning_paths(user_id) WHERE status='active'` unique (một lộ trình hoạt động).
- `daily_plans(user_id, local_date)` unique.
- `study_records(user_id, client_event_id)`, `study_intervals(user_id, client_event_id)` unique (idempotent).
- `study_records(session_id, exercise_id) WHERE is_retry = false` unique (một câu trả lời lượt chính cho mỗi bài tập trong phiên, FR-041).
- `pause_periods(user_id) WHERE ended_on IS NULL` unique (một giai đoạn tạm dừng mở).
- `unit_progress(user_id, unit_id)` PK.
- `review_schedules(user_id, due_date)`.
- `learning_units(status, level, kind)`; `exercises(unit_id)`; `content_items(unit_id)`.
