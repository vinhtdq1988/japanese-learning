# Mô hình dữ liệu: Tổ chức, Lớp học và Lộ trình lớp

**Nhánh**: `004-org-classes` | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md)

Tài liệu mô tả **thay đổi so với** [data-model 001](../001-phase1-mvp/data-model.md) và [003](../003-kanji-lessons/data-model.md). Mọi thay đổi là **bổ sung** (bảng mới, cột `NULL`/`DEFAULT` mới) nên dữ liệu 001/003 hợp lệ ngay sau migration; không có bảng cũ nào bị đổi khóa chính hay kiểu cột. Migration: một file `0004_org_classes.sql` (không `ALTER TYPE … ADD VALUE` nên không cần tách file như 0002/0003).

Quy ước giữ nguyên 001: khóa `uuid` mặc định `gen_random_uuid()`, `timestamptz` cho thời điểm, `date` cho ngày địa phương/ngày giấy phép, `citext` cho email, tên bảng số nhiều snake_case; Drizzle (`db/schema.ts`) chỉ để truy vấn có kiểu — **file SQL là nguồn sự thật**.

## 1. Tổng quan quan hệ

```text
users 1──0..1 organization_members *──1 organizations 1──* seat_licenses 1──* seats ──0..1 users(holder)
                                          │ 1
                                          ├──* classes 1──* class_teachers *──1 users
                                          │       │ 1──0..1 class_paths 1──* class_path_units *──1 learning_units
                                          │       │ 1──* class_assignments *──1 learning_units
                                          │       │ 1──* class_memberships *──1 users ──0..1 (ĐANG HOẠT ĐỘNG)
                                          │       │           ├──0..1 class_learner_overrides
                                          │       │           ├──* class_learner_exemptions *──1 learning_units
                                          │       │           └──* class_pause_periods (membership_id NULL = cả lớp)
                                          │       └──* class_placement_requests 1──* placement_results
                                          └──* invitations
users 1──0..1 join_code_attempts
```

**Không đổi** (được tái sử dụng nguyên trạng): `users`, `learning_profiles`, `learning_paths`, `pause_periods`, `unit_progress`, `daily_plans`, `daily_plan_items`, `lesson_sessions`, `study_records`, `study_intervals`, `review_schedules`, `topic_stats`, `learning_units`, `content_items`, `exercises`.

## 2. Kiểu liệt kê mới

| Kiểu | Giá trị |
|---|---|
| `org_status` | `active`, `disabled` |
| `invitation_kind` | `owner`, `teacher`, `student` |
| `invitation_status` | `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `class_status` | `active`, `archived` |
| `membership_end_reason` | `switched_personal` (học viên tự chuyển), `removed` (bị gỡ), `moved` (chuyển lớp), `seat_revoked`, `seat_expired`, `org_disabled`, `class_archived`, `account_deleted` |

## 3. Bảng mới

### 3.1 `organizations`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | 1–120 ký tự; có thể trùng giữa các tổ chức |
| `status` | `org_status` NOT NULL DEFAULT `active` | `disabled` ⇒ xử lý như hết seat (FR-038) |
| `disabled_at` | timestamptz NULL | |
| `created_by` | uuid NULL → `users` ON DELETE SET NULL | quản trị viên tạo |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

Là **ranh giới cô lập dữ liệu** và là đối tượng bị khóa `FOR UPDATE` khi thao tác sức chứa (research O3).

### 3.2 `organization_members`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `user_id` | uuid **PK** → `users` ON DELETE CASCADE | **một tài khoản tối đa một tổ chức** (FR-002) |
| `organization_id` | uuid NOT NULL → `organizations` | |
| `is_owner` | boolean NOT NULL DEFAULT false | chủ tổ chức không chiếm seat |
| `is_teacher` | boolean NOT NULL DEFAULT false | giáo viên chiếm một seat |
| `joined_at` | timestamptz NOT NULL | |

- Học viên **không** có cờ: có dòng này là do có `class_memberships` đang hoạt động (research O1). Dòng bị xóa khi `NOT is_owner AND NOT is_teacher` và không còn thành viên lớp đang hoạt động.
- Chỉ mục: `(organization_id)`; `UNIQUE (organization_id) WHERE is_owner` **không** áp dụng (cho phép nhiều chủ tổ chức; spec không giới hạn).
- Bất biến (kiểm tra ứng dụng + kiểm thử): mỗi tài khoản có seat ⇔ `is_teacher` hoặc học viên đang trong lớp.

### 3.3 `seat_licenses`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL → `organizations` | |
| `starts_on`, `ends_on` | date NOT NULL | `CHECK (ends_on >= starts_on)` |
| `grace_days` | smallint NOT NULL DEFAULT 7 | `CHECK (grace_days BETWEEN 0 AND 60)` (FR-006) |
| `max_reassignments` | smallint NOT NULL DEFAULT 2 | `CHECK (max_reassignments >= 0)` (FR-004) |
| `lapse_processed_at` | timestamptz NULL | đã chạy `processOrgLapse` cho giấy phép này (idempotent) |
| `revoked_at` | timestamptz NULL | thu hồi toàn bộ giấy phép |
| `created_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at` | timestamptz NOT NULL | |

- `EXCLUDE USING gist (organization_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&) WHERE (revoked_at IS NULL)` — không chồng lặp (cần `btree_gist`).
- **Hiệu lực** tại ngày `d` (theo `ORG_TIMEZONE`): `revoked_at IS NULL AND starts_on <= d AND d <= ends_on + grace_days`. "Trong ân hạn" ⇔ `ends_on < d <= ends_on + grace_days` (chủ tổ chức/giáo viên thấy cảnh báo). "Sắp hết" ⇔ `ends_on - d <= SEAT_EXPIRY_WARNING_DAYS`.
- Số seat = `COUNT(seats)`; không có cột `seat_count` thừa (tránh lệch).

### 3.4 `seats`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `license_id` | uuid NOT NULL → `seat_licenses` ON DELETE CASCADE | |
| `holder_user_id` | uuid NULL → `users` ON DELETE SET NULL | người đang giữ |
| `last_holder_user_id` | uuid NULL → `users` ON DELETE SET NULL | người giữ gần nhất (để "quay lại không tính đổi") |
| `reassignment_count` | smallint NOT NULL DEFAULT 0 | số lần đổi người giữ trong kỳ hạn |
| `assigned_at` | timestamptz NULL | |

- `UNIQUE (holder_user_id) WHERE holder_user_id IS NOT NULL` — một tài khoản một seat (FR-004).
- `CHECK (reassignment_count >= 0)`. Chỉ mục `(license_id) WHERE holder_user_id IS NULL` để chọn seat trống.
- **Quy tắc gán/giải phóng** (`allocateSeat`/`releaseSeat`, research O3): gán — ưu tiên seat có `last_holder = user` (không tăng), rồi seat chưa có `last_holder`, rồi seat khác còn `reassignment_count < max_reassignments` (tăng 1, đặt `last_holder`); giải phóng — `holder_user_id := NULL` (giữ `last_holder_user_id`).

### 3.5 `invitations`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL → `organizations` | |
| `class_id` | uuid NULL → `classes` | bắt buộc khi `kind='student'` |
| `kind` | `invitation_kind` NOT NULL | |
| `email` | citext NOT NULL | chuẩn hóa chữ thường |
| `display_name_hint` | text NULL | từ cột `display_name` của CSV; chỉ để hiển thị cho giáo viên |
| `token_hash` | text NOT NULL UNIQUE | SHA-256 của token (token gốc chỉ có trong email) |
| `status` | `invitation_status` NOT NULL DEFAULT `pending` | |
| `expires_at` | timestamptz NOT NULL | mặc định +14 ngày |
| `invited_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `responded_at` | timestamptz NULL | |
| `accepted_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at` | timestamptz NOT NULL | |

- `CHECK ((kind = 'student') = (class_id IS NOT NULL))`.
- `UNIQUE (organization_id, email) WHERE status = 'pending'` — "đã có lời mời chờ" (FR-013); lời mời quá hạn được chuyển `expired` trước khi chèn lời mời mới cùng email.
- Chỉ mục `(class_id, status)`, `(organization_id, status, expires_at)` (đếm giữ chỗ).
- **Giữ chỗ seat** = `COUNT(*) WHERE organization_id=$1 AND kind IN ('teacher','student') AND status='pending' AND expires_at > now()`.

### 3.6 `classes`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL → `organizations` | |
| `name` | text NOT NULL | 1–120 ký tự |
| `description` | text NULL | |
| `status` | `class_status` NOT NULL DEFAULT `active` | `archived` không khôi phục (FR-009) |
| `archived_at` | timestamptz NULL | |
| `join_code` | text NULL UNIQUE | 8 ký tự bảng chữ không nhập nhằng; NULL khi chưa từng sinh |
| `join_code_enabled` | boolean NOT NULL DEFAULT false | |
| `join_code_expires_at` | timestamptz NULL | hạn tùy chọn |
| `absence_threshold_days` | smallint NOT NULL DEFAULT 3 | `CHECK (BETWEEN 1 AND 14)` (FR-031) |
| `created_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

- Chỉ mục `(organization_id, status)`. `CHECK (NOT join_code_enabled OR join_code IS NOT NULL)`.
- Ràng buộc ứng dụng (trong giao dịch có khóa dòng lớp): số thành viên đang hoạt động ≤ `CLASS_MAX_MEMBERS` (mặc định 100); bật mã/mời chỉ khi có `class_paths` (`CLASS_NOT_READY`, FR-010).

### 3.7 `class_teachers`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `class_id` | uuid → `classes` ON DELETE CASCADE | PK `(class_id, user_id)` |
| `user_id` | uuid → `users` ON DELETE CASCADE | phải có `is_teacher` cùng tổ chức (kiểm tra ứng dụng) |
| `added_at` | timestamptz NOT NULL | |

- "Luôn có ≥ 1 giáo viên phụ trách" được bảo đảm ở **thao tác tạo/đổi giáo viên** (không cho gỡ người cuối); riêng trường hợp giáo viên bị gỡ vai trò tổ chức (FR-040) lớp có thể tạm không còn giáo viên ⇒ cảnh báo dẫn xuất cho chủ tổ chức.
- Chỉ mục `(user_id)` để liệt kê "lớp tôi phụ trách".

### 3.8 `class_paths` (lộ trình lớp, tham số mẫu)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `class_id` | uuid **PK** → `classes` ON DELETE CASCADE | tối đa một lộ trình/lớp; **không có thao tác xóa** (FR-017) |
| `start_level` | `self_level` NOT NULL | `none` ⇒ N5 + nền tảng trước |
| `target_level` | `target_level` NOT NULL | N2/N1 ⇒ cắt N3 + `scopeNotice` |
| `skills` | `skill[]` NOT NULL | `CHECK (cardinality(skills) >= 1)` |
| `starts_on`, `ends_on` | date NOT NULL | mốc; `CHECK (ends_on > starts_on)` |
| `daily_minutes` | smallint NOT NULL | `CHECK (daily_minutes IN (5,10,15,30))` — Nguyên tắc I |
| `updated_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at`, `updated_at` | timestamptz NOT NULL | |

Lộ trình được **tính động** từ các cột này + `class_path_units` + nội dung `active` (research O7); không lưu danh sách đơn vị đã sinh và không có bản sao theo học viên.

### 3.9 `class_path_units` (chế độ liệt kê – US5)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `class_id` | uuid → `classes` ON DELETE CASCADE | PK `(class_id, unit_id)` |
| `unit_id` | uuid → `learning_units` | đơn vị phải `active` khi thêm; bị vô hiệu hóa sau đó vẫn giữ dòng (hiện `contentNotices`) |
| `position` | integer NOT NULL | `UNIQUE (class_id, position) DEFERRABLE INITIALLY DEFERRED` để hoán đổi thứ tự trong một câu lệnh |
| `opens_on` | date NULL | NULL = mở ngay; > hôm nay ⇒ khóa (FR-023) |

Có ≥ 1 dòng ⇒ chế độ liệt kê; không dòng ⇒ chế độ mẫu. `PUT` thay toàn bộ danh sách trong một giao dịch (mất kết nối ⇒ trọn vẹn hoặc không đổi, trường hợp biên).

### 3.10 `class_assignments`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `class_id` | uuid NOT NULL → `classes` ON DELETE CASCADE | |
| `batch_id` | uuid NOT NULL | nhóm các đơn vị giao cùng một lần |
| `unit_id` | uuid NOT NULL → `learning_units` | |
| `due_on` | date NOT NULL | hạn (cuối ngày địa phương của từng học viên) |
| `assigned_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at` | timestamptz NOT NULL | |
| `cancelled_at` | timestamptz NULL | hủy bài giao |

`UNIQUE (class_id, unit_id) WHERE cancelled_at IS NULL` (mỗi đơn vị một bài giao còn hiệu lực). Trạng thái từng học viên là **dẫn xuất** (research O12), không có bảng trạng thái.

### 3.11 `class_memberships` (thành viên lớp – các giai đoạn)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `class_id` | uuid NOT NULL → `classes` | |
| `user_id` | uuid NOT NULL → `users` ON DELETE CASCADE | |
| `organization_id` | uuid NOT NULL → `organizations` | khử chuẩn hóa để lọc cô lập nhanh |
| `joined_at` | timestamptz NOT NULL | **mốc bắt đầu hiển thị dữ liệu cho giáo viên** |
| `consent_at` | timestamptz NOT NULL | thời điểm xác nhận thông báo (FR-016) |
| `consent_version` | smallint NOT NULL DEFAULT 1 | phiên bản `SHARED_DATA_V1` đã hiển thị |
| `seat_id` | uuid NULL → `seats` ON DELETE SET NULL | seat đang giữ (NULL sau khi đóng) |
| `left_at` | timestamptz NULL | NULL = đang hoạt động |
| `end_reason` | `membership_end_reason` NULL | `CHECK ((left_at IS NULL) = (end_reason IS NULL))` |
| `exit_display_name` | text NULL | tên lúc rời, để giáo viên thấy "đã chuyển sang lộ trình cá nhân" mà không cần đọc hồ sơ |

- `UNIQUE (user_id) WHERE left_at IS NULL` — một lớp tại một thời điểm (FR-014).
- Chỉ mục `(class_id) WHERE left_at IS NULL`, `(class_id, left_at)`, `(user_id, joined_at DESC)`.
- Danh sách học viên của giáo viên (FR-015) là hợp của: thành viên đang hoạt động (`đã vào lớp`), thành viên đã đóng (`đã chuyển sang cá nhân` / `bị gỡ` / các lý do khác — chỉ tên + ngày), `invitations.status='pending'` (`lời mời chờ`), `invitations.status='declined'` (`học viên đã từ chối`).

### 3.12 `class_learner_overrides`, `class_learner_exemptions` (US5, FR-026)

`class_learner_overrides`: `membership_id uuid PK → class_memberships ON DELETE CASCADE`, `daily_minutes smallint NULL CHECK (daily_minutes IS NULL OR daily_minutes IN (5,10,15,30))`, `shift_days smallint NOT NULL DEFAULT 0 CHECK (shift_days BETWEEN -60 AND 60)`, `updated_by uuid NULL → users SET NULL`, `updated_at`.

`class_learner_exemptions`: PK `(membership_id, unit_id)`, `unit_id → learning_units`, `created_by`, `created_at`.

Khóa theo `membership_id` nên ghi đè kết thúc cùng giai đoạn thành viên (rời lớp rồi vào lại: bắt đầu sạch).

### 3.13 `class_pause_periods` (FR-022)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `class_id` | uuid NOT NULL → `classes` ON DELETE CASCADE | |
| `membership_id` | uuid NULL → `class_memberships` ON DELETE CASCADE | NULL = cả lớp |
| `started_on` | date NOT NULL | |
| `ended_on` | date NULL | nửa khoảng `[started_on, ended_on)`; NULL = đang mở; có thể ở tương lai; `CHECK (ended_on IS NULL OR ended_on > started_on)` |
| `created_by` | uuid NULL → `users` ON DELETE SET NULL | |
| `created_at` | timestamptz NOT NULL | |

`UNIQUE (class_id) WHERE membership_id IS NULL AND ended_on IS NULL` và `UNIQUE (membership_id) WHERE membership_id IS NOT NULL AND ended_on IS NULL` — tối đa một khoảng mở cho mỗi phạm vi (giống `pause_periods_one_open_idx`). Dạng `PausePeriod {startedOn, endedOn}` khớp engine.

### 3.14 `class_placement_requests` (US8)

`id uuid PK`, `class_id → classes ON DELETE CASCADE`, `requested_by uuid NULL → users SET NULL`, `requested_at timestamptz`, `closed_at timestamptz NULL`. `UNIQUE (class_id) WHERE closed_at IS NULL` — một yêu cầu mở/lớp.

### 3.15 `join_code_attempts`

`user_id uuid PK → users ON DELETE CASCADE`, `failures smallint NOT NULL DEFAULT 0`, `window_started_at timestamptz NOT NULL`, `locked_until timestamptz NULL`. Thành công ⇒ xóa dòng.

## 4. Thay đổi bảng hiện có

| Bảng | Thay đổi | Lý do |
|---|---|---|
| `placement_results` | `ADD COLUMN class_placement_request_id uuid NULL REFERENCES class_placement_requests(id) ON DELETE SET NULL`; `UNIQUE (user_id, class_placement_request_id) WHERE class_placement_request_id IS NOT NULL`; `CHECK (class_placement_request_id IS NULL OR NOT is_current)` | kết quả do lớp yêu cầu **không** thành kết quả hiện hành cá nhân (research O14); dòng cũ NULL |
| `admin_action_logs` | `ADD COLUMN organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL`; chỉ mục `(organization_id, occurred_at DESC) WHERE organization_id IS NOT NULL` | FR-008: ghi hành động của chủ tổ chức/giáo viên; lọc theo tổ chức; `actor_id` đã cho phép bất kỳ người dùng |
| `learning_profiles`, `users`, `learning_paths`, … | **không đổi** | O6: lớp phủ trong bộ nhớ |

Từ khóa hành động mới của `admin_action_logs.action` (text tự do, không đổi kiểu): `org.create`, `org.disable`, `org.enable`, `license.create`, `license.adjust`, `license.revoke`, `seat.assign`, `seat.revoke`, `teacher.invite`, `teacher.remove`, `class.create`, `class.archive`, `class.move_student`, `class.remove_student`, `class.path_update`, `class.assign`, `class.override`, `class.pause`, `class.join_code`, `class.export`, `class.placement_request`. `target_type` ∈ `organization|license|seat|class|membership|assignment`.

## 5. Chuyển trạng thái

**Lời mời**: `pending → accepted | declined | revoked | expired`. `accepted` (student) chỉ khi học viên chọn `join_class` + xác nhận; `declined` khi chọn `stay_personal` (đóng, không tốn seat, FR-016). `expired` do quá `expires_at`.

**Thành viên lớp**: `(không có) → active (left_at NULL) → ended(end_reason)`. Bước `→ active` yêu cầu: lớp `active` có `class_paths`, tổ chức `active`, giấy phép hiệu lực, còn seat (`allocateSeat`), chưa đủ `CLASS_MAX_MEMBERS`, tài khoản chưa có thành viên lớp hiệu lực, không thuộc tổ chức khác. `active → ended` khi: học viên tự chuyển (`switched_personal`), giáo viên gỡ (`removed`), chuyển lớp (`moved`; chỉ sau khi học viên chấp nhận lời mời chuyển lớp, mở dòng mới ngay trong cùng giao dịch, **giữ seat**), thu hồi seat (`seat_revoked`), hết hạn (`seat_expired`), vô hiệu hóa tổ chức (`org_disabled`), lưu trữ lớp (`class_archived`), xóa tài khoản (`account_deleted`). Mọi kết thúc (trừ `moved`): giải phóng seat, đặt `exit_display_name`, xóa kế hoạch hôm nay nếu toàn bộ `pending` (O6), xóa `organization_members` nếu hết vai trò.

**Giấy phép**: `chưa bắt đầu → hiệu lực → (ends_on) ân hạn → (ends_on+grace) hết hiệu lực [processOrgLapse, đặt lapse_processed_at]`; hoặc `revoked`. **Tổ chức**: `active ⇄ disabled`.

**Lớp**: `active → archived` (một chiều).

## 6. Công thức dẫn xuất (không lưu)

| Đại lượng | Định nghĩa |
|---|---|
| `seatSummary` | `total = COUNT(seats của giấy phép hiệu lực)`, `used = COUNT(holder NOT NULL)`, `reserved` = giữ chỗ (§3.5), `available = assignableFree − reserved` (không âm) |
| `completionRatio` | `|{u ∈ R: completed∨mastered}| / |R|`, `R` = đơn vị bắt buộc (research O7/O10) |
| `expectedRatio` | tỷ lệ ngày làm việc đã qua / tổng ngày làm việc của `[starts_on+shift, ends_on+shift]` (research O10) |
| `progressStatus` | `paused` / `behind` / `ahead` / `on_track` (O10); `hasStarted`, `pathCompleted` |
| `alerts` | tập con của `absent`, `behind`, `overdue_assignment` (O10) |
| thời gian học | `unionDurationSeconds(study_intervals kể từ joined_at)`: 7 ngày gần nhất và tổng |
| `reviewAccuracy` | đúng/tổng `study_records` `context='review' ∧ is_retry=false` kể từ `joined_at` |
| `streakDays` | `currentStreakDays(activeDays kể từ joined_at, today, khoảng tạm dừng lớp)` |
| `lastActiveOn` | `MAX(local_date)` của `study_records` kể từ `joined_at` |
| `assignmentState` | `on_time` / `late` / `overdue` / `pending` (O12) |
| `classWeakTopics` | chủ đề có `COUNT(lượt chính) ≥ 30 ∧ accuracy < 0.60` kể từ khi vào lớp của các thành viên; cờ yếu từng học viên theo `nextWeakFlag` trên ≤ 20 kết quả mới nhất kể từ `joined_at` (O11) |
| `feasibility` | `requiredMinutes`, `capacityMinutes = ngày còn lại không tạm dừng × daily_minutes`, `overBy` (O7) |
| `contentNotices` | `class_path_units`/`class_assignments` trỏ tới đơn vị không còn `active` (O7) |
| `orphanClass` | lớp `active` không còn dòng `class_teachers` (FR-040) |

## 7. Hiệu năng và chỉ mục

- Truy vấn bảng điều khiển dùng chỉ mục sẵn có `study_records(user_id, local_date)`, `study_intervals(user_id, started_at)`, `unit_progress` PK; thêm `class_memberships (class_id) WHERE left_at IS NULL` để lấy thành viên. Không thêm bảng tổng hợp (research O11); nếu đo thấy chậm ở lớp 100 học viên, bổ sung chỉ mục `study_records (user_id, occurred_at)` cho lọc `>= joined_at`.
- `loadOrgContext` là một truy vấn theo khóa chính `organization_members.user_id` + 2 join theo khóa ngoại.
- Đếm giữ chỗ dùng chỉ mục `(organization_id, status, expires_at)`.

## 8. Xóa dữ liệu và quyền riêng tư

- `ON DELETE CASCADE` từ `users`: `organization_members`, `class_memberships`, `class_teachers`, `join_code_attempts` (dữ liệu thuộc chính người đó). `ON DELETE SET NULL`: mọi cột "ai làm" (`created_by`, `invited_by`, `assigned_by`, `updated_by`, `seats.holder_user_id/last_holder_user_id`). Xóa cứng tài khoản học viên (job purge) vì vậy **không** để lại dòng trỏ tới họ (FR-039).
- Học viên rời lớp: toàn bộ lịch sử học, lịch ôn, tiến độ, kế hoạch **không bị xóa hay sửa** (SC-008). Dữ liệu tổ chức giữ lại: dòng `class_memberships` đã đóng (id, thời điểm, lý do, `exit_display_name`) và nhật ký hành động; giáo viên chỉ đọc được tên + ngày (O13).
- Lưu trữ lớp không xóa dòng nào: cấu trúc và danh sách thành viên (đã đóng) vẫn đọc được (FR-009).

## 9. Migration `0004_org_classes.sql`

Thứ tự trong một giao dịch: `CREATE EXTENSION IF NOT EXISTS btree_gist` → kiểu liệt kê → `organizations` → `organization_members` → `seat_licenses` (+ EXCLUDE) → `seats` → `classes` → `invitations` → `class_teachers` → `class_paths` → `class_path_units` → `class_assignments` → `class_memberships` → `class_learner_overrides/exemptions` → `class_pause_periods` → `class_placement_requests` → `join_code_attempts` → `ALTER placement_results`, `ALTER admin_action_logs`. Không động chạm dữ liệu hiện có; kiểm thử `migration.test.ts` xác nhận kế hoạch/lịch ôn của người học 001/003 giữ nguyên. Drizzle `schema.ts` cập nhật tương ứng (chú thích tiêu đề file thêm `0004_org_classes.sql`).
