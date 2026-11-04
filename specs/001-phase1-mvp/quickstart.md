# Hướng dẫn kiểm chứng nhanh: Giai đoạn 1 – MVP

**Nhánh**: `001-phase1-mvp` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/openapi.yaml](contracts/openapi.yaml) | **Mô hình dữ liệu**: [data-model.md](data-model.md)

Tài liệu này mô tả cách dựng môi trường và các kịch bản kiểm chứng đầu-cuối. Đây là hướng dẫn chạy/kiểm chứng, không chứa mã hiện thực. Các lệnh dưới đây là **lệnh dự kiến**; chúng sẽ có hiệu lực khi các task tương ứng trong `tasks.md` được hoàn thành.

## 1. Điều kiện tiên quyết

- Node.js 22 LTS, pnpm
- Flutter (kênh stable) có bật hỗ trợ web, trình duyệt Chrome
- Docker + Docker Compose (PostgreSQL 16, Mailpit)

## 2. Dựng môi trường

```bash
# Hạ tầng dev: PostgreSQL và Mailpit (hộp thư thử nghiệm, giao diện tại http://localhost:8025)
docker compose up -d db mailpit

# Backend
cd backend
pnpm install
pnpm db:migrate          # chạy migration
pnpm seed                # nạp nội dung mẫu từ ../content (kiểm tra bằng JSON Schema) + câu hỏi placement + tài khoản admin dev
pnpm dev                 # API tại http://localhost:3000/api/v1

# Client (cửa sổ khác)
cd client
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Biến môi trường chính của backend (xem `backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `SMTP_URL`, `APP_BASE_URL`.

## 3. Chạy kiểm thử tự động

```bash
cd backend && pnpm test            # đơn vị engine (hồ sơ đại diện) + hợp đồng + tích hợp (Testcontainers)
cd client  && flutter test         # widget + đơn vị
cd client  && flutter test integration_test -d chrome   # luồng P1 đầu-cuối
```

**Kết quả mong đợi**: toàn bộ xanh. Bộ kiểm thử engine PHẢI gồm các hồ sơ: người mới/10 phút; N3/30 phút; quay lại sau khoảng nghỉ; 5 phút với nhiều bài ôn tồn đọng; placement đoán mò; liên tục điểm thấp ở một mảng; liên tục điểm cao ở một mảng; mảng yếu đã hồi phục; N2 tự khai báo; mục tiêu JLPT N1 (FR-035).

## 4. Kịch bản kiểm chứng thủ công

Mỗi kịch bản ánh xạ tới câu chuyện người dùng/tiêu chí thành công trong [spec.md](spec.md).

### K1 – Đăng ký → onboarding → bài học đầu tiên (US1, SC-001)
1. Mở client, chọn **Đăng ký**, nhập email/mật khẩu/tên hiển thị.
2. Hoàn tất onboarding: trình độ "chưa biết gì", mục tiêu giao tiếp, 10 phút/ngày, kỹ năng từ vựng + ngữ pháp, **bỏ qua** bài kiểm tra.
3. **Mong đợi**: thấy lộ trình bắt đầu bằng nền tảng người mới và kế hoạch hôm nay có tổng ước tính ≤ 10 phút; tổng thời gian từ đăng ký đến bài học đầu < 5 phút.

### K2 – Kiểm tra trình độ (US1, FR-007)
1. Tài khoản mới, làm bài kiểm tra 20 câu.
2. **Mong đợi**: nhận trình độ ước tính + mảng mạnh/yếu; lộ trình bắt đầu theo kết quả. Trả lời toàn sai/ngẫu nhiên → lộ trình vẫn an toàn cho người mới.
3. Làm lại bài kiểm tra từ Hồ sơ → được hỏi giữ hay xây dựng lại lộ trình; lịch sử và lịch ôn không đổi.

### K3 – Bài học hằng ngày (US2, SC-002)
1. Mở màn hình hôm nay → làm một bài từ vựng: xem giải thích, làm bài tập, nhận phản hồi tức thì.
2. Đóng tab giữa chừng rồi mở lại → tiếp tục từ câu chưa trả lời.
3. Hoàn thành mọi mục → ngày được đánh dấu hoàn thành kèm tóm tắt; "học thêm" là tùy chọn và không đổi kế hoạch mặc định.

### K4 – Ôn tập lặp lại ngắt quãng (US3, SC-005)
1. Học một tập mục; ngày hôm sau (dùng công cụ đẩy ngày giả lập của môi trường test hoặc sửa `due_date` bằng script seed) ôn: trả lời đúng một số, sai một số.
2. **Mong đợi**: mục đúng có ngày ôn kế xa hơn; mục sai quay lại sớm hơn (xem trường `nextReviewDate` của phản hồi trả lời); mục đến hạn xuất hiện trong kế hoạch và tổng không vượt quỹ thời gian.

### K5 – Tiến độ (US4, SC-007)
1. Từ màn hình hôm nay, mở **Tiến độ** trong ≤ 2 lần nhấp.
2. **Mong đợi**: thời gian, bài hoàn thành, độ chính xác ôn, chuỗi ngày, tỷ lệ hoàn thành mục tiêu/đúng tiến độ khớp hoạt động đã ghi; tài khoản mới hiển thị trạng thái trống thân thiện.

### K6 – Điều chỉnh kế hoạch (US5, SC-006)
1. Đổi thời gian 10 → 15 phút; đổi mục tiêu; tạm dừng/tiếp tục; ưu tiên ngữ pháp; đánh dấu một đơn vị là đã thành thạo; yêu cầu xây dựng lại.
2. **Mong đợi**: mỗi thay đổi thể hiện ở kế hoạch được sinh kế tiếp; lịch sử và lịch ôn giữ nguyên; tạm dừng không sinh kế hoạch hay "ngày bỏ lỡ".
3. Mô phỏng vắng 5 ngày → kế hoạch quay lại ở mức xử lý được, không có "khoản nợ".

### K7 – Quản trị (US6, SC-008)
1. Đăng nhập bằng tài khoản admin dev, tạo và kích hoạt một đơn vị từ vựng mới (đủ vi + en).
2. **Mong đợi**: trong vòng 5 phút (thực tế ≤ 60 giây, TTL bộ đệm) đơn vị xuất hiện ở màn hình Lộ trình của người học phù hợp và chọn được qua "Học thêm"; vào kế hoạch hôm nay từ kế hoạch được sinh kế tiếp; không cần phát hành client; hành động được ghi trong nhật ký; tài khoản người học thường gọi `/admin/*` nhận 403.
3. Vô hiệu hóa một tài khoản người học → đăng nhập và làm mới token bị từ chối (`ACCOUNT_DISABLED`); phiên đang mở còn dùng được tối đa 15 phút (đến khi access token hết hạn); kích hoạt lại thì đăng nhập được.

### K8 – Hồ sơ, ngôn ngữ, xóa tài khoản (US7)
1. Đổi ngôn ngữ vi → en: giao diện, nghĩa, giải thích, phản hồi chuyển tiếng Anh; chữ Nhật/cách đọc/ví dụ giữ nguyên.
2. Xóa tài khoản → phiên hiện tại bị đăng xuất và bị chặn đăng nhập thường; cửa sổ thứ hai đang mở mất quyền truy cập trong ≤ 15 phút (khi access token hết hạn); đăng nhập lại để **khôi phục** trong 30 ngày; đăng ký bằng email đó trong thời gian chờ bị từ chối kèm gợi ý khôi phục.
3. Quên mật khẩu: mở Mailpit lấy liên kết, đặt lại thành công; liên kết dùng lại/hết hạn bị từ chối.
4. Chạy job xóa (lệnh `pnpm job:purge` trong test, với đồng hồ giả lập +31 ngày) → dữ liệu người học bị xóa cứng.

### K9 – Dùng thử (US8, SC-011)
1. Chưa đăng nhập, từ trang đầu chọn **Dùng thử** (≤ 3 lần nhấp), học bài mẫu và làm bài kiểm tra trình độ.
2. **Mong đợi**: không có bản ghi định danh nào của khách trong CSDL (bảng `users`, `study_records` không đổi; chỉ các bộ đếm ẩn danh `trial_content_loaded`, `trial_lesson_completed`, `trial_placement_completed`, `trial_placement_level_*` tăng); thử mở "Kế hoạch/Tiến độ" → được mời đăng ký.
3. Đăng ký cùng trình duyệt → onboarding dùng sẵn kết quả kiểm tra, có tùy chọn bỏ để làm lại. Đăng ký ở trình duyệt khác → onboarding bình thường.
4. Gửi > 10 yêu cầu/phút đến chấm placement công khai → nhận 429.

### K10 – Đồng thời (FR-041, SC-012)
1. Mở cùng tài khoản ở hai cửa sổ, mở cùng một mục trong "Hôm nay" (cả hai dùng chung phiên), trả lời cùng một bài tập ở cả hai cửa sổ; để cả hai cửa sổ cùng mở trong vài phút.
2. **Mong đợi**: chỉ một câu trả lời được tính (cửa sổ thứ hai nhận kết quả cũ), lịch ôn của mục chỉ cập nhật một lần, thời gian học không bị nhân đôi (kiểm thử tích hợp tự động T060 bao phủ cả trường hợp trùng và khác `clientEventId`).

### K11 – Hiệu năng (SC-010)
- Chạy bộ kiểm thử tải (k6) với 1.000 người dùng đồng thời ("tải bình thường" theo SC-010) gọi `/today`, `/sessions`, `/sessions/{id}/answers`, `/progress`; trong lúc tải đang chạy, chạy `flutter test integration_test/perf_lesson_test.dart -d chrome` để đo thời gian từ thao tác đến khi hiển thị màn hình bài học và phản hồi câu trả lời. **Mong đợi**: p95 phía server < 500 ms; p95 đầu-cuối phía client < 1 giây.

## 5. Dọn dẹp

```bash
docker compose down -v   # xóa container và dữ liệu dev
```
