-- Truy vấn báo cáo chỉ số sản phẩm (T119): SC-003, SC-009, SC-011.
-- Chạy bằng `pnpm report:metrics` (in từng bảng) hoặc dán từng khối vào psql. Mỗi khối bắt đầu bằng
-- dòng `-- name: <tên>` và là MỘT câu SELECT độc lập, chỉ đọc. Giải thích số liệu: README.md cùng thư mục.
--
-- Quy ước chung
--   * Người học = users.role = 'learner'. "Hoàn tất onboarding" = có learning_paths.reason = 'onboarding'
--     (lấy lộ trình onboarding sớm nhất của mỗi người).
--   * Chỉ tính nhóm đã "chín": đã qua đủ khoảng quan sát (7 ngày cho SC-003, 2 ngày/14 ngày cho SC-009),
--     nếu không tỷ lệ bị thấp giả tạo vì người dùng mới chưa có thời gian quay lại.
--   * Ngày địa phương tính theo learning_profiles.timezone của người học (mặc định Asia/Ho_Chi_Minh).
--   * Tài khoản đã bị xóa cứng sau 30 ngày không còn trong các bảng này (FR-003); bộ đếm ẩn danh của dùng thử
--     (aggregate_daily_stats) thì được giữ lại.

-- name: sc003_start_point_accepted
-- SC-003: tỷ lệ người học chấp nhận điểm xuất phát (không xây dựng lại lộ trình / đổi mục tiêu / đổi trình độ
-- trong 7 ngày kể từ lộ trình onboarding), báo cáo riêng hai nhóm; mục tiêu mỗi nhóm >= 80% (data-model §2.11).
WITH onboarding AS (
  SELECT DISTINCT ON (lp.user_id)
         lp.user_id,
         lp.created_at AS onboarded_at,
         (lp.generated_from ->> 'placement_result_id') IS NOT NULL AS took_placement
    FROM learning_paths lp
    JOIN users u ON u.id = lp.user_id AND u.role = 'learner'
   WHERE lp.reason = 'onboarding'
   ORDER BY lp.user_id, lp.created_at
),
judged AS (
  SELECT o.took_placement,
         NOT EXISTS (
           SELECT 1
             FROM learning_paths r
            WHERE r.user_id = o.user_id
              AND r.reason IN ('rebuild_request', 'goal_change', 'level_change', 'placement_retake')
              AND r.created_at >  o.onboarded_at
              AND r.created_at <= o.onboarded_at + interval '7 days'
         ) AS accepted
    FROM onboarding o
   WHERE o.onboarded_at <= now() - interval '7 days'
)
SELECT CASE WHEN took_placement THEN 'co_lam_placement' ELSE 'bo_qua_placement' END AS nhom,
       count(*)                                                             AS so_nguoi_hoc,
       count(*) FILTER (WHERE accepted)                                     AS chap_nhan,
       round(100.0 * count(*) FILTER (WHERE accepted) / count(*), 1)        AS ty_le_pct,
       100.0 * count(*) FILTER (WHERE accepted) / count(*) >= 80            AS dat_muc_tieu_80
  FROM judged
 GROUP BY took_placement
 ORDER BY took_placement DESC;

-- name: sc009_retention
-- SC-009: (a) giữ chân ngày 2 >= 40%; (b) >= 25% có bài học hoàn thành trong >= 3 ngày khác nhau
-- trong 14 ngày đầu (ngày 0 = ngày địa phương hoàn tất onboarding).
-- "Quay lại ngày 2" = ngày hôm sau (ngày địa phương) có bắt đầu ít nhất một phiên học hoặc đăng nhập mới.
WITH cohort AS (
  SELECT DISTINCT ON (lp.user_id)
         lp.user_id,
         lp.created_at AS onboarded_at,
         COALESCE(p.timezone, 'Asia/Ho_Chi_Minh') AS tz
    FROM learning_paths lp
    JOIN users u ON u.id = lp.user_id AND u.role = 'learner'
    LEFT JOIN learning_profiles p ON p.user_id = lp.user_id
   WHERE lp.reason = 'onboarding'
   ORDER BY lp.user_id, lp.created_at
),
c AS (
  SELECT user_id, onboarded_at, tz, (onboarded_at AT TIME ZONE tz)::date AS day0
    FROM cohort
),
activity AS (
  SELECT ls.user_id, (ls.started_at AT TIME ZONE c.tz)::date AS day
    FROM lesson_sessions ls JOIN c ON c.user_id = ls.user_id
  UNION
  SELECT a.user_id, (a.created_at AT TIME ZONE c.tz)::date
    FROM auth_sessions a JOIN c ON c.user_id = a.user_id
),
completed_days AS (
  SELECT DISTINCT ls.user_id, (ls.completed_at AT TIME ZONE c.tz)::date AS day
    FROM lesson_sessions ls JOIN c ON c.user_id = ls.user_id
   WHERE ls.status = 'completed' AND ls.completed_at IS NOT NULL
),
day2 AS (
  SELECT c.user_id,
         EXISTS (SELECT 1 FROM activity a WHERE a.user_id = c.user_id AND a.day = c.day0 + 1) AS ok
    FROM c
   WHERE c.onboarded_at <= now() - interval '2 days'
),
three_days AS (
  SELECT c.user_id,
         (SELECT count(*)
            FROM completed_days d
           WHERE d.user_id = c.user_id AND d.day BETWEEN c.day0 AND c.day0 + 13) >= 3 AS ok
    FROM c
   WHERE c.onboarded_at <= now() - interval '14 days'
)
SELECT 'giu_chan_ngay_2' AS chi_so,
       count(*)                                                       AS so_nguoi_hoc,
       count(*) FILTER (WHERE ok)                                     AS dat,
       round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*), 0), 1) AS ty_le_pct,
       40 AS muc_tieu_pct,
       100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*), 0) >= 40 AS dat_muc_tieu
  FROM day2
UNION ALL
SELECT 'hoc_>=3_ngay_trong_2_tuan',
       count(*),
       count(*) FILTER (WHERE ok),
       round(100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*), 0), 1),
       25,
       100.0 * count(*) FILTER (WHERE ok) / NULLIF(count(*), 0) >= 25
  FROM three_days;

-- name: sc011_daily
-- SC-011 theo ngày (UTC): số lượt hoàn thành bài mẫu (bộ đếm ẩn danh) so với số tài khoản đăng ký kèm
-- cờ users.from_trial. Hai vế không cùng danh tính nên tỷ lệ theo ngày chỉ để tham khảo xu hướng.
WITH signups AS (
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*) AS dang_ky_tu_dung_thu
    FROM users
   WHERE from_trial AND role = 'learner'
   GROUP BY 1
),
completed AS (
  SELECT day, value AS hoan_thanh_bai_mau
    FROM aggregate_daily_stats
   WHERE metric = 'trial_lesson_completed'
)
SELECT COALESCE(s.day, c.day)                       AS ngay,
       COALESCE(c.hoan_thanh_bai_mau, 0)            AS hoan_thanh_bai_mau,
       COALESCE(s.dang_ky_tu_dung_thu, 0)           AS dang_ky_tu_dung_thu,
       round(100.0 * COALESCE(s.dang_ky_tu_dung_thu, 0) / NULLIF(c.hoan_thanh_bai_mau, 0), 1) AS ty_le_pct
  FROM signups s
  FULL JOIN completed c ON c.day = s.day
 ORDER BY ngay;

-- name: sc011_summary
-- SC-011 tổng hợp: tỷ lệ chuyển đổi = tài khoản đăng ký kèm from_trial / lượt hoàn thành bài mẫu; mục tiêu >= 20%.
SELECT t.hoan_thanh_bai_mau,
       u.dang_ky_tu_dung_thu,
       round(100.0 * u.dang_ky_tu_dung_thu / NULLIF(t.hoan_thanh_bai_mau, 0), 1) AS ty_le_pct,
       100.0 * u.dang_ky_tu_dung_thu / NULLIF(t.hoan_thanh_bai_mau, 0) >= 20      AS dat_muc_tieu_20
  FROM (SELECT COALESCE(sum(value), 0)::bigint AS hoan_thanh_bai_mau
          FROM aggregate_daily_stats
         WHERE metric = 'trial_lesson_completed') t,
       (SELECT count(*) AS dang_ky_tu_dung_thu
          FROM users
         WHERE from_trial AND role = 'learner') u;

-- name: trial_placement_levels
-- Phân bố kết quả kiểm tra trình độ của khách dùng thử (trial_placement_level_*), kèm tổng lượt hoàn thành.
SELECT replace(metric, 'trial_placement_level_', '') AS muc_uoc_tinh,
       sum(value)::bigint                            AS so_luot,
       round(100.0 * sum(value) / NULLIF(sum(sum(value)) OVER (), 0), 1) AS ty_le_pct
  FROM aggregate_daily_stats
 WHERE metric LIKE 'trial\_placement\_level\_%'
 GROUP BY metric
 ORDER BY muc_uoc_tinh;
