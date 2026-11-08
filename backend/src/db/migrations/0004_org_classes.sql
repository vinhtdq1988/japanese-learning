-- Migration 0004: tổ chức, lớp học và lộ trình lớp (spec 004, data-model.md §9).
-- Chạy trong một giao dịch bởi `pnpm db:migrate` (src/db/migrate.ts); không dùng BEGIN/COMMIT ở đây.
-- Chỉ THÊM bảng/kiểu/cột `NULL` nên dữ liệu 001/003 hợp lệ ngay sau migration; KHÔNG sửa dữ liệu hiện có
-- (hồ sơ, lộ trình, kế hoạch, lịch ôn của người học cũ giữ nguyên – research O6).
-- Không `ALTER TYPE … ADD VALUE` nên không cần tách file như 0002/0003.

-- Ràng buộc loại trừ giấy phép chồng ngày cần toán tử `=` trên uuid trong chỉ mục GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Kiểu liệt kê
-- ---------------------------------------------------------------------------
CREATE TYPE org_status AS ENUM ('active', 'disabled');
CREATE TYPE invitation_kind AS ENUM ('owner', 'teacher', 'student');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'revoked', 'expired');
CREATE TYPE class_status AS ENUM ('active', 'archived');
-- `switched_personal`: học viên tự chuyển; `removed`: bị gỡ; `moved`: chuyển lớp (giữ seat).
CREATE TYPE membership_end_reason AS ENUM (
  'switched_personal', 'removed', 'moved', 'seat_revoked', 'seat_expired', 'org_disabled',
  'class_archived', 'account_deleted'
);

-- ---------------------------------------------------------------------------
-- Tổ chức, vai trò, giấy phép và seat
-- ---------------------------------------------------------------------------
-- Ranh giới cô lập dữ liệu; cũng là đối tượng bị khóa `FOR UPDATE` khi thao tác sức chứa (research O3).
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status      org_status NOT NULL DEFAULT 'active',
  disabled_at timestamptz,
  created_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Khóa chính `user_id`: một tài khoản tối đa MỘT tổ chức (FR-002) bằng ràng buộc CSDL.
-- Vai trò học viên không phải cờ: suy ra từ `class_memberships` đang hoạt động (research O1).
CREATE TABLE organization_members (
  user_id         uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations (id),
  is_owner        boolean NOT NULL DEFAULT false,
  is_teacher      boolean NOT NULL DEFAULT false,
  joined_at       timestamptz NOT NULL
);
CREATE INDEX organization_members_org_idx ON organization_members (organization_id);

CREATE TABLE seat_licenses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES organizations (id),
  starts_on          date NOT NULL,
  ends_on            date NOT NULL,
  grace_days         smallint NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 60),
  max_reassignments  smallint NOT NULL DEFAULT 2 CHECK (max_reassignments >= 0),
  -- Đã chạy `processOrgLapse` cho giấy phép này (idempotent).
  lapse_processed_at timestamptz,
  revoked_at         timestamptz,
  created_by         uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_licenses_dates_check CHECK (ends_on >= starts_on),
  -- Giấy phép không chồng lặp ngày trong cùng tổ chức (trừ giấy phép đã thu hồi).
  CONSTRAINT seat_licenses_no_overlap EXCLUDE USING gist (
    organization_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  ) WHERE (revoked_at IS NULL)
);
CREATE INDEX seat_licenses_org_idx ON seat_licenses (organization_id, ends_on DESC);

-- Một dòng mỗi seat: cho phép đếm "đổi người giữ" theo seat và "quay lại không tính đổi" (FR-004).
CREATE TABLE seats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id          uuid NOT NULL REFERENCES seat_licenses (id) ON DELETE CASCADE,
  holder_user_id      uuid REFERENCES users (id) ON DELETE SET NULL,
  last_holder_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  reassignment_count  smallint NOT NULL DEFAULT 0 CHECK (reassignment_count >= 0),
  assigned_at         timestamptz
);
-- Một tài khoản một seat.
CREATE UNIQUE INDEX seats_holder_idx ON seats (holder_user_id) WHERE holder_user_id IS NOT NULL;
CREATE INDEX seats_free_idx ON seats (license_id) WHERE holder_user_id IS NULL;

-- ---------------------------------------------------------------------------
-- Lớp học, lời mời, giáo viên phụ trách
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations (id),
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description           text,
  -- `archived` là một chiều, không khôi phục (FR-009).
  status                class_status NOT NULL DEFAULT 'active',
  archived_at           timestamptz,
  -- Mã tham gia 8 ký tự bảng chữ không nhập nhằng; NULL khi chưa từng sinh.
  join_code             text UNIQUE,
  join_code_enabled     boolean NOT NULL DEFAULT false,
  join_code_expires_at  timestamptz,
  absence_threshold_days smallint NOT NULL DEFAULT 3 CHECK (absence_threshold_days BETWEEN 1 AND 14),
  created_by            uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classes_join_code_check CHECK (NOT join_code_enabled OR join_code IS NOT NULL)
);
CREATE INDEX classes_org_status_idx ON classes (organization_id, status);

CREATE TABLE invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations (id),
  class_id          uuid REFERENCES classes (id),
  kind              invitation_kind NOT NULL,
  email             citext NOT NULL,
  -- Từ cột `display_name` của CSV; chỉ để hiển thị cho giáo viên.
  display_name_hint text,
  -- SHA-256 của token; token gốc chỉ nằm trong email.
  token_hash        text NOT NULL UNIQUE,
  status            invitation_status NOT NULL DEFAULT 'pending',
  expires_at        timestamptz NOT NULL,
  invited_by        uuid REFERENCES users (id) ON DELETE SET NULL,
  responded_at      timestamptz,
  accepted_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_student_class_check CHECK ((kind = 'student') = (class_id IS NOT NULL))
);
-- Tối đa một lời mời chờ cho mỗi (tổ chức, email).
CREATE UNIQUE INDEX invitations_one_pending_idx ON invitations (organization_id, email)
  WHERE status = 'pending';
CREATE INDEX invitations_class_status_idx ON invitations (class_id, status);
CREATE INDEX invitations_org_status_idx ON invitations (organization_id, status, expires_at);

CREATE TABLE class_teachers (
  class_id uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX class_teachers_user_idx ON class_teachers (user_id);

-- ---------------------------------------------------------------------------
-- Lộ trình lớp (tham số mẫu, tính động), bài giao
-- ---------------------------------------------------------------------------
-- Tối đa một lộ trình mỗi lớp; KHÔNG có thao tác xóa (FR-017).
CREATE TABLE class_paths (
  class_id      uuid PRIMARY KEY REFERENCES classes (id) ON DELETE CASCADE,
  start_level   self_level NOT NULL,
  target_level  target_level NOT NULL,
  skills        skill[] NOT NULL CHECK (cardinality(skills) >= 1),
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  -- Nguyên tắc I (Micro-Learning): quỹ thời gian chỉ 5/10/15/30 phút.
  daily_minutes smallint NOT NULL CHECK (daily_minutes IN (5, 10, 15, 30)),
  updated_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_paths_dates_check CHECK (ends_on > starts_on)
);

-- Chế độ liệt kê: có >= 1 dòng thì dùng đúng danh sách giáo viên chọn; không có dòng thì chế độ mẫu.
CREATE TABLE class_path_units (
  class_id  uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  unit_id   uuid NOT NULL REFERENCES learning_units (id),
  position  integer NOT NULL,
  -- NULL = mở ngay; > hôm nay thì khóa (FR-023).
  opens_on  date,
  PRIMARY KEY (class_id, unit_id),
  -- Hoãn kiểm tra đến cuối câu lệnh để hoán đổi thứ tự trong một câu UPDATE.
  CONSTRAINT class_path_units_position_key UNIQUE (class_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE class_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  -- Nhóm các đơn vị giao cùng một lần.
  batch_id     uuid NOT NULL,
  unit_id      uuid NOT NULL REFERENCES learning_units (id),
  due_on       date NOT NULL,
  assigned_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
-- Mỗi đơn vị một bài giao còn hiệu lực; trạng thái từng học viên là dẫn xuất (research O12).
CREATE UNIQUE INDEX class_assignments_active_idx ON class_assignments (class_id, unit_id)
  WHERE cancelled_at IS NULL;

-- ---------------------------------------------------------------------------
-- Thành viên lớp (các giai đoạn), ghi đè cá nhân, tạm dừng
-- ---------------------------------------------------------------------------
CREATE TABLE class_memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          uuid NOT NULL REFERENCES classes (id),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Khử chuẩn hóa để lọc cô lập tổ chức nhanh.
  organization_id   uuid NOT NULL REFERENCES organizations (id),
  -- Mốc bắt đầu hiển thị dữ liệu cho giáo viên (research O11).
  joined_at         timestamptz NOT NULL,
  consent_at        timestamptz NOT NULL,
  -- Phiên bản `SHARED_DATA_V1` đã hiển thị lúc đồng ý.
  consent_version   smallint NOT NULL DEFAULT 1,
  seat_id           uuid REFERENCES seats (id) ON DELETE SET NULL,
  -- NULL = đang hoạt động.
  left_at           timestamptz,
  end_reason        membership_end_reason,
  -- Tên lúc rời, để giáo viên thấy "đã chuyển sang lộ trình cá nhân" mà không cần đọc hồ sơ.
  exit_display_name text,
  CONSTRAINT class_memberships_end_check CHECK ((left_at IS NULL) = (end_reason IS NULL))
);
-- Một lớp tại một thời điểm (FR-014).
CREATE UNIQUE INDEX class_memberships_one_active_idx ON class_memberships (user_id)
  WHERE left_at IS NULL;
CREATE INDEX class_memberships_class_active_idx ON class_memberships (class_id) WHERE left_at IS NULL;
CREATE INDEX class_memberships_class_left_idx ON class_memberships (class_id, left_at);
CREATE INDEX class_memberships_user_idx ON class_memberships (user_id, joined_at DESC);

-- Khóa theo `membership_id` nên ghi đè kết thúc cùng giai đoạn thành viên.
CREATE TABLE class_learner_overrides (
  membership_id uuid PRIMARY KEY REFERENCES class_memberships (id) ON DELETE CASCADE,
  daily_minutes smallint CHECK (daily_minutes IS NULL OR daily_minutes IN (5, 10, 15, 30)),
  shift_days    smallint NOT NULL DEFAULT 0 CHECK (shift_days BETWEEN -60 AND 60),
  updated_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_learner_exemptions (
  membership_id uuid NOT NULL REFERENCES class_memberships (id) ON DELETE CASCADE,
  unit_id       uuid NOT NULL REFERENCES learning_units (id),
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, unit_id)
);

-- Nửa khoảng [started_on, ended_on); `membership_id` NULL = cả lớp. Dạng khớp `PausePeriod` của engine.
CREATE TABLE class_pause_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  membership_id uuid REFERENCES class_memberships (id) ON DELETE CASCADE,
  started_on    date NOT NULL,
  ended_on      date,
  created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_pause_periods_range_check CHECK (ended_on IS NULL OR ended_on > started_on)
);
-- Tối đa một khoảng mở cho mỗi phạm vi (giống `pause_periods_one_open_idx`).
CREATE UNIQUE INDEX class_pause_periods_class_open_idx ON class_pause_periods (class_id)
  WHERE membership_id IS NULL AND ended_on IS NULL;
CREATE UNIQUE INDEX class_pause_periods_member_open_idx ON class_pause_periods (membership_id)
  WHERE membership_id IS NOT NULL AND ended_on IS NULL;

-- ---------------------------------------------------------------------------
-- Kiểm tra trình độ cho cả lớp, chống dò mã tham gia
-- ---------------------------------------------------------------------------
CREATE TABLE class_placement_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
);
-- Một yêu cầu mở mỗi lớp.
CREATE UNIQUE INDEX class_placement_requests_open_idx ON class_placement_requests (class_id)
  WHERE closed_at IS NULL;

-- Đếm theo TÀI KHOẢN (không theo IP); thành công thì xóa dòng.
CREATE TABLE join_code_attempts (
  user_id           uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  failures          smallint NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL,
  locked_until      timestamptz
);

-- ---------------------------------------------------------------------------
-- Thay đổi bảng hiện có (chỉ thêm cột NULL)
-- ---------------------------------------------------------------------------
-- Kết quả do lớp yêu cầu KHÔNG thành kết quả hiện hành cá nhân (research O14); dòng cũ NULL.
ALTER TABLE placement_results
  ADD COLUMN class_placement_request_id uuid REFERENCES class_placement_requests (id) ON DELETE SET NULL,
  ADD CONSTRAINT placement_results_class_request_not_current_check
    CHECK (class_placement_request_id IS NULL OR NOT is_current);
CREATE UNIQUE INDEX placement_results_class_request_idx
  ON placement_results (user_id, class_placement_request_id)
  WHERE class_placement_request_id IS NOT NULL;

-- Nhật ký hành động của chủ tổ chức/giáo viên, lọc theo tổ chức (FR-008).
ALTER TABLE admin_action_logs
  ADD COLUMN organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL;
CREATE INDEX admin_action_logs_org_idx ON admin_action_logs (organization_id, occurred_at DESC)
  WHERE organization_id IS NOT NULL;
