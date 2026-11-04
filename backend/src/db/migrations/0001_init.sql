-- Migration 0001: lược đồ khởi tạo Giai đoạn 1 – MVP (theo specs/001-phase1-mvp/data-model.md).
-- Chạy trong một giao dịch bởi `pnpm db:migrate` (src/db/migrate.ts); không dùng BEGIN/COMMIT ở đây.
-- Khóa chính là UUID v4 do PostgreSQL sinh (`gen_random_uuid()`, có sẵn từ PG13).

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Kiểu liệt kê
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('learner', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'disabled', 'pending_deletion');
CREATE TYPE skill AS ENUM ('vocabulary', 'grammar');
CREATE TYPE language AS ENUM ('vi', 'en');
CREATE TYPE self_level AS ENUM ('none', 'N5', 'N4', 'N3', 'N2', 'N1');
CREATE TYPE target_level AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1');
CREATE TYPE content_level AS ENUM ('N5', 'N4', 'N3');
CREATE TYPE placement_level AS ENUM ('none', 'N5', 'N4', 'N3');
CREATE TYPE goal_type AS ENUM ('jlpt', 'daily_conversation', 'work');
CREATE TYPE onboarding_state AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE unit_tier AS ENUM ('foundation', 'core');
CREATE TYPE unit_status AS ENUM ('draft', 'active', 'inactive');
CREATE TYPE element_status AS ENUM ('active', 'inactive');
CREATE TYPE exercise_type AS ENUM ('multiple_choice', 'matching', 'fill_blank');
CREATE TYPE path_status AS ENUM ('active', 'superseded');
CREATE TYPE path_reason AS ENUM (
  'onboarding', 'rebuild_request', 'goal_change', 'level_change', 'placement_retake'
);
CREATE TYPE unit_progress_status AS ENUM ('in_progress', 'completed', 'mastered');
CREATE TYPE plan_status AS ENUM ('open', 'completed');
CREATE TYPE plan_item_type AS ENUM ('new_unit', 'review_batch');
CREATE TYPE plan_item_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE session_kind AS ENUM ('new_unit', 'review', 'extra');
CREATE TYPE session_status AS ENUM ('in_progress', 'completed');
CREATE TYPE record_context AS ENUM ('lesson', 'review');

-- ---------------------------------------------------------------------------
-- Tài khoản và phiên đăng nhập
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 citext NOT NULL UNIQUE,
  password_hash         text NOT NULL,
  role                  user_role NOT NULL DEFAULT 'learner',
  status                account_status NOT NULL DEFAULT 'active',
  deletion_requested_at timestamptz,
  -- Đăng ký ngay sau dùng thử trên cùng trình duyệt (đo SC-011); không lưu thêm gì về phiên dùng thử.
  from_trial            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Phiên đăng nhập (refresh token); khác với lesson_sessions là phiên học.
CREATE TABLE auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Hồ sơ học tập (1–1 với users)
-- Hồ sơ được tạo ngay khi đăng ký nên các trường chỉ biết sau onboarding (goal_type, daily_minutes)
-- cho phép NULL; CHECK cuối bảng buộc chúng đầy đủ khi onboarding_state = 'completed'.
-- ---------------------------------------------------------------------------
CREATE TABLE learning_profiles (
  user_id           uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  current_level     self_level NOT NULL DEFAULT 'none',
  goal_type         goal_type,
  target_level      target_level,
  daily_minutes     smallint CHECK (daily_minutes IN (5, 10, 15, 30)),
  target_date       date,
  skills            skill[] NOT NULL DEFAULT ARRAY['vocabulary', 'grammar']::skill[]
                    CHECK (cardinality(skills) >= 1),
  prioritized_skill skill,
  language          language NOT NULL DEFAULT 'vi',
  timezone          text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  onboarding_state  onboarding_state NOT NULL DEFAULT 'not_started',
  onboarding_draft  jsonb,
  paused            boolean NOT NULL DEFAULT false,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (
    onboarding_state <> 'completed'
    OR (
      goal_type IS NOT NULL
      AND daily_minutes IS NOT NULL
      AND (goal_type <> 'jlpt' OR target_level IS NOT NULL)
    )
  )
);

CREATE TABLE pause_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_on date NOT NULL,
  ended_on   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);
-- Tối đa một giai đoạn tạm dừng đang mở cho mỗi người học.
CREATE UNIQUE INDEX pause_periods_one_open_idx ON pause_periods (user_id) WHERE ended_on IS NULL;

-- ---------------------------------------------------------------------------
-- Nội dung học
-- ---------------------------------------------------------------------------
CREATE TABLE topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill      skill NOT NULL,
  name       jsonb NOT NULL,
  level      content_level NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (name ? 'vi' AND name ? 'en')
);

CREATE TABLE learning_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       skill NOT NULL,
  title      jsonb NOT NULL,
  level      content_level NOT NULL,
  goal_tags  text[] NOT NULL DEFAULT '{}'
             CHECK (goal_tags <@ ARRAY['jlpt', 'daily_conversation', 'work']),
  topic_id   uuid NOT NULL REFERENCES topics (id),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  tier       unit_tier NOT NULL DEFAULT 'core',
  est_minutes smallint NOT NULL CHECK (est_minutes IN (5, 10, 15)),
  sequence   integer NOT NULL DEFAULT 0,
  is_trial   boolean NOT NULL DEFAULT false,
  status     unit_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tier = 'core' OR level = 'N5')
);
CREATE INDEX learning_units_status_idx ON learning_units (status, level, kind);

CREATE TABLE content_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES learning_units (id),
  kind        skill NOT NULL,
  japanese    text NOT NULL,
  reading     text,
  meaning     jsonb NOT NULL,
  explanation jsonb,
  examples    jsonb NOT NULL DEFAULT '[]',
  position    smallint NOT NULL DEFAULT 0,
  status      element_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_items_unit_idx ON content_items (unit_id);

CREATE TABLE exercises (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id            uuid NOT NULL REFERENCES learning_units (id),
  item_id            uuid REFERENCES content_items (id),
  type               exercise_type NOT NULL,
  prompt             jsonb NOT NULL,
  payload            jsonb NOT NULL,
  feedback_correct   jsonb NOT NULL,
  feedback_incorrect jsonb NOT NULL,
  position           smallint NOT NULL DEFAULT 0,
  status             element_status NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_unit_idx ON exercises (unit_id);

-- ---------------------------------------------------------------------------
-- Kiểm tra trình độ (placement)
-- ---------------------------------------------------------------------------
CREATE TABLE placement_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level          content_level NOT NULL,
  skill          skill NOT NULL,
  topic_id       uuid NOT NULL REFERENCES topics (id),
  -- Dạng {"ja": "...", "hint": {"vi": "...", "en": "..."}?}; API chỉ trả `ja` dưới tên `prompt`.
  prompt         jsonb NOT NULL,
  choices        jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'array'),
  correct_choice smallint NOT NULL CHECK (correct_choice >= 0),
  position       smallint NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (correct_choice < jsonb_array_length(choices))
);
CREATE INDEX placement_questions_active_idx ON placement_questions (is_active, position);

CREATE TABLE placement_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  answers          jsonb NOT NULL,
  estimated_level  placement_level NOT NULL,
  strong_topics    uuid[] NOT NULL DEFAULT '{}',
  weak_topics      uuid[] NOT NULL DEFAULT '{}',
  score            smallint NOT NULL CHECK (score >= 0),
  duration_seconds integer,
  taken_at         timestamptz NOT NULL DEFAULT now(),
  is_current       boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Mỗi người học chỉ có một kết quả hiện hành; kết quả cũ giữ làm lịch sử (FR-009).
CREATE UNIQUE INDEX placement_results_current_idx ON placement_results (user_id) WHERE is_current;

-- ---------------------------------------------------------------------------
-- Lộ trình và tiến độ đơn vị
-- ---------------------------------------------------------------------------
CREATE TABLE learning_paths (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status         path_status NOT NULL DEFAULT 'active',
  reason         path_reason NOT NULL,
  generated_from jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX learning_paths_one_active_idx ON learning_paths (user_id) WHERE status = 'active';

CREATE TABLE unit_progress (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  unit_id    uuid NOT NULL REFERENCES learning_units (id),
  status     unit_progress_status NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

-- ---------------------------------------------------------------------------
-- Kế hoạch ngày và phiên học
-- ---------------------------------------------------------------------------
CREATE TABLE daily_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  local_date        date NOT NULL,
  budget_minutes    smallint NOT NULL,
  estimated_minutes smallint NOT NULL,
  status            plan_status NOT NULL DEFAULT 'open',
  notice            text,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_date),
  -- Kế hoạch không vượt quỹ thời gian đã khai báo (FR-012, Nguyên tắc I).
  CHECK (estimated_minutes <= budget_minutes)
);

CREATE TABLE daily_plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         uuid NOT NULL REFERENCES daily_plans (id) ON DELETE CASCADE,
  type            plan_item_type NOT NULL,
  unit_id         uuid REFERENCES learning_units (id),
  review_item_ids uuid[],
  -- Mỗi mục là một bài 1–15 phút (Nguyên tắc I); gói ôn tính theo REVIEW_SECONDS_PER_ITEM (R7).
  est_minutes     smallint NOT NULL CHECK (est_minutes BETWEEN 1 AND 15),
  position        smallint NOT NULL DEFAULT 0,
  status          plan_item_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (type = 'new_unit' AND unit_id IS NOT NULL)
    OR (type = 'review_batch' AND review_item_ids IS NOT NULL)
  )
);
CREATE INDEX daily_plan_items_plan_idx ON daily_plan_items (plan_id);

CREATE TABLE lesson_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_item_id uuid REFERENCES daily_plan_items (id) ON DELETE SET NULL,
  kind         session_kind NOT NULL,
  unit_id      uuid REFERENCES learning_units (id),
  -- Ảnh chụp bài tập đã bản địa hóa lúc bắt đầu để phiên đang học không đổi khi admin sửa (R12).
  snapshot     jsonb NOT NULL,
  status       session_status NOT NULL DEFAULT 'in_progress',
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX lesson_sessions_user_idx ON lesson_sessions (user_id, status);

-- ---------------------------------------------------------------------------
-- Bản ghi học tập (ghi idempotent, FR-041)
-- ---------------------------------------------------------------------------
CREATE TABLE study_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_event_id  uuid NOT NULL,
  session_id       uuid NOT NULL REFERENCES lesson_sessions (id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES exercises (id),
  item_id          uuid REFERENCES content_items (id),
  topic_id         uuid NOT NULL REFERENCES topics (id),
  is_correct       boolean NOT NULL,
  submitted_answer jsonb NOT NULL,
  context          record_context NOT NULL,
  -- Câu hỏi lại cuối phiên (R6): không cập nhật review_schedules/topic_stats, không tính độ chính xác.
  is_retry         boolean NOT NULL DEFAULT false,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  local_date       date NOT NULL,
  UNIQUE (user_id, client_event_id)
);
-- Mỗi bài tập trong một phiên chỉ có một câu trả lời lượt chính.
CREATE UNIQUE INDEX study_records_primary_answer_idx
  ON study_records (session_id, exercise_id) WHERE is_retry = false;
CREATE INDEX study_records_user_date_idx ON study_records (user_id, local_date);

CREATE TABLE study_intervals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_event_id  uuid NOT NULL,
  session_id       uuid NOT NULL REFERENCES lesson_sessions (id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 1800),
  local_date       date NOT NULL,
  UNIQUE (user_id, client_event_id)
);
CREATE INDEX study_intervals_user_idx ON study_intervals (user_id, started_at);

CREATE TABLE review_schedules (
  user_id                  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id                  uuid NOT NULL REFERENCES content_items (id),
  interval_days            integer NOT NULL CHECK (interval_days >= 1),
  ease                     numeric(3, 2) NOT NULL CHECK (ease BETWEEN 1.30 AND 2.80),
  repetitions              integer NOT NULL DEFAULT 0,
  lapses                   integer NOT NULL DEFAULT 0,
  due_date                 date NOT NULL,
  last_result              boolean,
  last_reviewed_at         timestamptz,
  -- Mỗi mục cập nhật lịch tối đa một lần mỗi ngày địa phương (FR-041).
  last_reviewed_local_date date,
  is_hard                  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX review_schedules_due_idx ON review_schedules (user_id, due_date);

CREATE TABLE topic_stats (
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  topic_id         uuid NOT NULL REFERENCES topics (id),
  recent_results   smallint[] NOT NULL DEFAULT '{}' CHECK (cardinality(recent_results) <= 20),
  accuracy         numeric(4, 3) CHECK (accuracy BETWEEN 0 AND 1),
  difficulty_bias  smallint NOT NULL DEFAULT 0 CHECK (difficulty_bias BETWEEN -2 AND 2),
  consecutive_low  smallint NOT NULL DEFAULT 0,
  consecutive_high smallint NOT NULL DEFAULT 0,
  is_weak          boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, topic_id)
);

-- ---------------------------------------------------------------------------
-- Quản trị và thống kê tổng hợp ẩn danh
-- ---------------------------------------------------------------------------
CREATE TABLE admin_action_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL cho thao tác hệ thống (ví dụ `pnpm admin:create`) hoặc khi actor bị xóa cứng.
  actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   uuid,
  diff        jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_action_logs_time_idx ON admin_action_logs (occurred_at DESC);

-- Không có khóa ngoại tới người dùng, không lưu IP/định danh (FR-038, SC-011); giữ lại khi xóa tài khoản.
CREATE TABLE aggregate_daily_stats (
  day    date NOT NULL,
  metric text NOT NULL,
  value  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);
