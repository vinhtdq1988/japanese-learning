-- Migration 0005: hiệu ứng thưởng khi trả lời đúng và đạt thành tựu (spec 005, data-model.md §2).
-- Chạy trong một giao dịch bởi `pnpm db:migrate` (src/db/migrate.ts); không dùng BEGIN/COMMIT ở đây.
-- Chỉ THÊM kiểu/bảng/cột; dữ liệu 001–004 hợp lệ ngay sau migration và không bị sửa.
-- Không `ALTER TYPE … ADD VALUE` nên không cần tách file.

-- `earned`: đạt khi học và đã chúc mừng; `silent`: ghi âm thầm (đã vượt mốc trước khi ra mắt,
-- hoặc vượt do đổi mục tiêu/dựng lại lộ trình/đổi lộ trình lớp).
CREATE TYPE achievement_source AS ENUM ('earned', 'silent');

-- Thành tựu đã đạt: mỗi cặp (người học, mốc) tối đa một bản ghi (FR-012). Chỉ thêm, không xóa/sửa.
CREATE TABLE earned_achievements (
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code text NOT NULL CHECK (char_length(achievement_code) BETWEEN 1 AND 40),
  earned_at        timestamptz NOT NULL,
  source           achievement_source NOT NULL,
  PRIMARY KEY (user_id, achievement_code)
);

-- Đánh dấu đã chúc mừng hoàn thành ngày: tối đa một lần mỗi ngày địa phương (FR-015).
CREATE TABLE daily_completion_celebrations (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date    date NOT NULL,
  celebrated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, local_date)
);

-- Tùy chọn hiệu ứng (độc lập nhau); hồ sơ cũ tự nhận mặc định bật.
ALTER TABLE learning_profiles
  ADD COLUMN sound_enabled           boolean NOT NULL DEFAULT true,
  ADD COLUMN visual_effects_enabled  boolean NOT NULL DEFAULT true;
