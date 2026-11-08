# Báo cáo chỉ số sản phẩm

Các truy vấn trong [`product-metrics.sql`](product-metrics.sql) trích xuất số liệu cho các tiêu chí thành công
**SC-003**, **SC-009**, **SC-011**, hai chỉ số Kanji **SC-001**, **SC-008** (spec `003-kanji-lessons`) và chỉ số lớp học
**SC-010** (spec `004-org-classes`) trực tiếp từ dữ liệu đã ghi (không cần bảng phân tích riêng).

```bash
cd backend
pnpm report:metrics                      # chạy mọi truy vấn, in từng bảng
pnpm report:metrics sc003_start_point_accepted sc011_summary   # chỉ một số truy vấn
```

Lệnh dùng `DATABASE_URL` (xem `.env.example`) và đặt phiên ở chế độ chỉ đọc. Mỗi khối `-- name:` trong file SQL
cũng chạy độc lập được trong `psql`. Trong image Docker của API, lệnh tương đương là
`node dist/src/reports/run.js`.

## Truy vấn và cách đọc kết quả

| Truy vấn                              | Chỉ số          | Mục tiêu                         | Định nghĩa                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sc003_start_point_accepted`          | SC-003          | mỗi nhóm ≥ 80%                   | Hai dòng: `co_lam_placement` / `bo_qua_placement`. Người học **chấp nhận** điểm xuất phát khi không có lộ trình `reason ∈ {rebuild_request, goal_change, level_change, placement_retake}` trong 7 ngày kể từ lộ trình `onboarding` (data-model §2.11). Nhóm "có làm placement" = lộ trình onboarding có `generated_from.placement_result_id` khác null. Chỉ tính người đã onboarding ≥ 7 ngày. |
| `sc009_retention`                     | SC-009          | ngày 2 ≥ 40%; ≥ 3 ngày học ≥ 25% | `giu_chan_ngay_2`: ngày địa phương hôm sau ngày onboarding có bắt đầu phiên học hoặc đăng nhập mới (nhóm đã onboarding ≥ 2 ngày). `hoc_>=3_ngay_trong_2_tuan`: có phiên học `completed` trong ≥ 3 ngày địa phương khác nhau trong 14 ngày đầu (nhóm đã onboarding ≥ 14 ngày).                                                                                                                  |
| `sc011_daily`                         | SC-011          | tham khảo                        | Theo ngày (UTC): số lượt `trial_lesson_completed` (bộ đếm ẩn danh) và số tài khoản đăng ký có `users.from_trial`. Hai vế không cùng danh tính nên tỷ lệ theo ngày chỉ để xem xu hướng.                                                                                                                                                                                                         |
| `sc011_summary`                       | SC-011          | ≥ 20%                            | `dang_ky_tu_dung_thu / hoan_thanh_bai_mau` trên toàn bộ thời gian.                                                                                                                                                                                                                                                                                                                             |
| `trial_placement_levels`              | SC-011 (bổ trợ) | –                                | Phân bố kết quả kiểm tra trình độ của khách (`trial_placement_level_none/N5/N4/N3`).                                                                                                                                                                                                                                                                                                           |
| `kanji_first_plan_has_kanji_ratio`    | Kanji SC-001    | kỳ vọng 100% (kiểm tra vận hành) | Trong số người học có `learning_profiles.kanji_selected_at`, tỷ lệ có **kế hoạch đầu tiên** sinh từ lúc chọn Kanji (`daily_plans.created_at ≥ kanji_selected_at`) chứa mục `new_unit` là bài Kanji. Mẫu số chỉ gồm các kế hoạch đầu tiên đó có phần bài mới (kế hoạch toàn ôn tập không tính).                                                                                                 |
| `kanji_completed_within_3_days_ratio` | Kanji SC-008    | ≥ 80%                            | Trong số người học có `kanji_selected_at` cách đây ≥ 3 ngày, tỷ lệ có `unit_progress.status = 'completed'` cho một đơn vị Kanji với `updated_at` nằm trong khoảng `[kanji_selected_at, kanji_selected_at + 3 ngày]`. Người bỏ rồi chọn lại Kanji được tính từ `kanji_selected_at` mới (bài đã học ở lần chọn trước không tính).                                                                |
| `sc010_class_week4_active_days`       | Lớp SC-010      | ≥ 70%                            | Spec 004. Mỗi thành viên lớp `class_memberships` là một quan sát (đã vào lớp ≥ 28 ngày): đạt khi có bản ghi trả lời `study_records` trong **≥ 3 ngày địa phương** thuộc tuần thứ 4 (ngày 21–27 tính từ ngày địa phương của `joined_at`, múi giờ học viên). Người rời lớp trước tuần 4 vẫn nằm trong mẫu số; học viên được chuyển lớp có hai quan sát. Một dòng mỗi lớp + dòng `TONG`.          |

## Lưu ý khi diễn giải

- Nhóm "chưa chín" bị loại để tỷ lệ không thấp giả tạo; khi mới có ít người học, `so_nguoi_hoc` nhỏ nên tỷ lệ
  dao động mạnh — hãy đọc cùng cột `so_nguoi_hoc`.
- "Quay lại" ở SC-009 chỉ nhìn thấy hoạt động ghi vào CSDL (phiên học, đăng nhập mới). Người mở lại ứng dụng bằng
  refresh token còn hiệu lực mà không học thì không được tính.
- Tài khoản bị xóa cứng sau 30 ngày chờ (FR-003) biến mất khỏi các truy vấn trên; bộ đếm ẩn danh của dùng thử vẫn
  được giữ trong `aggregate_daily_stats`.
- Kiểm thử các truy vấn: `backend/tests/integration/reports.test.ts`.
