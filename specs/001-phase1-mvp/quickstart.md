# Hướng dẫn kiểm chứng nhanh: Giai đoạn 1 – MVP

**Nhánh**: `001-phase1-mvp` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/openapi.yaml](contracts/openapi.yaml) | **Mô hình dữ liệu**: [data-model.md](data-model.md)

Tài liệu này mô tả cách dựng môi trường và các kịch bản kiểm chứng đầu-cuối. Đây là hướng dẫn chạy/kiểm chứng, không chứa mã hiện thực. Các lệnh dưới đây đã được chạy thử ngày 2026-11-05 (xem mục 5 để biết phần đã kiểm chứng và phần còn cần người thực hiện).

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

Chạy cả hệ thống như môi trường triển khai (API + nginx/TLS), xem `backend/README.md` mục "Triển khai":

```bash
export JWT_SECRET="$(openssl rand -base64 48)"   # bắt buộc
docker compose --profile app up -d --build        # thêm dịch vụ `api` và `web` (cần ./certs/fullchain.pem, privkey.pem)
```

Báo cáo chỉ số sản phẩm (SC-003, SC-009, SC-011): `cd backend && pnpm report:metrics` (xem `backend/src/reports/README.md`).

## 3. Chạy kiểm thử tự động

```bash
cd backend && pnpm test            # đơn vị engine (hồ sơ đại diện) + hợp đồng + tích hợp (Testcontainers)
cd backend && pnpm lint && pnpm typecheck && pnpm format:check
cd client  && flutter test         # widget + đơn vị (gồm kiểm tra khóa l10n vi/en)
cd client  && flutter analyze
cd client  && dart run tool/check_l10n.dart             # đối chiếu khóa app_vi.arb / app_en.arb
# luồng P1 đầu-cuối trên Chrome (cần chromedriver; `flutter test -d chrome` chưa hỗ trợ integration_test):
cd client  && flutter drive --driver=test_driver/integration_test.dart --target=integration_test/us1_onboarding_test.dart -d chrome
cd client  && flutter drive --driver=test_driver/integration_test.dart --target=integration_test/us2_lesson_test.dart -d chrome
```

> **Không có Docker**: đặt `TEST_DATABASE_URL` trỏ vào một PostgreSQL 16 **dành riêng cho kiểm thử** (bị xóa sạch giữa các test), ví dụ `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/jl_test pnpm test`. Có thể dùng gói npm `embedded-postgres` (khởi tạo với `--encoding=UTF8 --locale=C`, đặt ngoài kho mã). Không đặt biến này thì Testcontainers cần Docker.

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
> **Đã chuyển sang spec `002-performance`** cùng T115/T115a; không thực hiện và không kiểm chứng ở spec này.

## 5. Ánh xạ kịch bản và kết quả chạy (T122)

Mỗi kịch bản K1–K10 có kiểm thử tự động phía backend và/hoặc client. Các kiểm thử này chạy trong `pnpm test` / `flutter test`.

| Kịch bản | Backend (`backend/tests/…`) | Client (`client/test/…`) |
|---|---|---|
| K1 – Đăng ký → onboarding → bài đầu | `contract/us1.test.ts`, `integration/us1-onboarding.test.ts` | `auth_screens_test.dart`, `onboarding_flow_test.dart`, `integration_test/us1_onboarding_test.dart` |
| K2 – Kiểm tra trình độ | `contract/us1.test.ts`, `unit/placement.test.ts` | `onboarding_flow_test.dart` |
| K3 – Bài học hằng ngày | `contract/us2.test.ts`, `integration/us2-lesson.test.ts` | `lesson_flow_test.dart`, `exercise_widgets_test.dart`, `integration_test/us2_lesson_test.dart` |
| K4 – Ôn tập SRS | `integration/us3-review.test.ts`, `unit/srs.test.ts` | `review_flow_test.dart` |
| K5 – Tiến độ | `contract/us4.test.ts`, `integration/us4-progress.test.ts` | `progress_screen_test.dart` |
| K6 – Điều chỉnh kế hoạch | `contract/us5.test.ts`, `integration/us5-overrides.test.ts` | `plan_adjust_test.dart` |
| K7 – Quản trị | `contract/us6.test.ts`, `integration/us6-admin.test.ts` | `admin_flow_test.dart`, `admin_unit_draft_test.dart` |
| K8 – Hồ sơ, xóa tài khoản | `contract/us7.test.ts`, `integration/us7-account.test.ts` | `profile_flow_test.dart` |
| K9 – Dùng thử | `contract/us8.test.ts`, `integration/us8-trial.test.ts` | `trial_flow_test.dart` |
| K10 – Đồng thời | `integration/concurrency.test.ts` | `event_queue_test.dart` |

**Đã chạy ngày 2026-11-05** (PostgreSQL 16 nhúng qua `TEST_DATABASE_URL`, máy không có Docker):

- `backend`: `pnpm test` toàn bộ xanh; `eslint`, `prettier --check`, `tsc --noEmit` không cảnh báo.
- `client`: `flutter analyze` không vấn đề; `flutter test` xanh (166 test); `dart run tool/check_l10n.dart` xanh (466 khóa vi/en khớp nhau).
- Chạy thật API (`db:migrate` → `seed` → `server`, không qua test) rồi đi kịch bản bằng HTTP: K1 (đăng ký → onboarding → `/path` 14 đơn vị → `/today` 2 mục tổng 10 phút, quỹ 10), K2 (20 câu placement không lộ đáp án), K3 (phiên học, gọi lại trả đúng phiên cũ, hoàn thành), K5 (`/progress` ghi nhận 1 bài, chuỗi 1 ngày), K7 (người học gọi `/admin/*` nhận 403, admin nhận 200), K9 (nội dung dùng thử có `answerKey`; chấm placement công khai lần thứ 11 trở đi nhận 429).
- **Thời gian đo thực tế của K1 (phía máy)**: từ lúc gửi đăng ký đến lúc có phiên học đầu tiên và bài tập đầu **≈ 0,7 giây** (đăng ký 0,42 s → onboarding 0,63 s → `/today` 0,66 s → bắt đầu phiên 0,71 s) trên máy phát triển. Đây chỉ là thời gian xử lý của hệ thống; mục tiêu SC-001 (< 5 phút) bao gồm cả thời gian người dùng đọc và nhập liệu nên cần đo với người thật ở mục 7.

**Kết quả thủ công (2026-11-05)**: chủ dự án xác nhận K1–K10 trên giao diện thật, kiểm tra tương thích trình duyệt (mục 6) và kiểm thử khả dụng (mục 7) đều **đạt**. Số liệu chi tiết không được ghi lại.

**Các hạng mục không thể xác nhận trong môi trường tự động** (không có trình duyệt thật và người dùng; phần thủ công ở trên đã bao phủ):

- K1–K10 thao tác trên giao diện thật trong trình duyệt (bấm, đóng tab giữa chừng, hai cửa sổ cùng tài khoản, xem Mailpit).
- `flutter drive` cho `integration_test/*` trên Chrome (máy này chưa có `chromedriver`).
- Kiểm tra tương thích trình duyệt (mục 6) và kiểm thử khả dụng (mục 7).
- `docker compose --profile app up --build` (máy này không có Docker): `backend/Dockerfile`, `client/Dockerfile`, `client/nginx.conf` chưa được build/chạy. Đã kiểm chứng riêng các giả định của Dockerfile: `tsc` build ra `dist/src/…`, `node dist/src/db/migrate.js` và `node dist/src/reports/run.js` chạy được khi chép thêm `*.sql`.

## 6. Tương thích trình duyệt (FR-033, T120)

Chạy K1–K3 trên bản build (`flutter build web --release --no-web-resources-cdn`) phục vụ qua nginx (hoặc `flutter run -d web-server`) trên từng trình duyệt desktop. Ghi `Đạt`/`Lỗi` và ghi chú. **Kết luận (2026-11-05)**: chủ dự án xác nhận K1–K3 **đạt** trên Chrome, Edge, Firefox, Safari; phiên bản/HĐH cụ thể không được ghi lại.

| Trình duyệt (phiên bản) | HĐH | K1 | K2 | K3 | Ghi chú / lỗi |
|---|---|---|---|---|---|
| Chrome | | Chưa kiểm tra | Chưa kiểm tra | Chưa kiểm tra | |
| Edge | | Chưa kiểm tra | Chưa kiểm tra | Chưa kiểm tra | |
| Firefox | | Chưa kiểm tra | Chưa kiểm tra | Chưa kiểm tra | |
| Safari | macOS | Chưa kiểm tra | Chưa kiểm tra | Chưa kiểm tra | |

Phông tiếng Nhật: CanvasKit không dùng phông hệ thống và CSP chặn việc tải phông dự phòng từ gstatic, nên client đóng gói sẵn Noto Sans JP (SIL OFL) tại `client/assets/fonts/` (khai báo trong `pubspec.yaml`, giấy phép ở `OFL.txt`). Nếu chữ Nhật hiện thành ô vuông, kiểm tra phông này có trong bản build (`build/web/assets/assets/fonts/NotoSansJP.ttf`).

Điểm cần chú ý riêng: CSP (`script-src 'self' 'wasm-unsafe-eval'`) không chặn việc khởi động Flutter/CanvasKit (mở console, không có lỗi `Content Security Policy`); phông tiếng Nhật hiển thị đúng; lưu trạng thái dùng thử ở `localStorage`; Safari xử lý đúng `Strict-Transport-Security` và WebAssembly.

## 7. Kiểm thử khả dụng với người dùng thử nghiệm (SC-004, T121)

**Mục tiêu**: ≥ 90% người tham gia hoàn thành bài học đầu tiên **mà không cần trợ giúp**.

**Chuẩn bị**: 8–10 người đúng đối tượng (người đi làm, chưa quen ứng dụng), mỗi người một tài khoản mới; môi trường triển khai hoặc staging; quan sát viên chỉ ghi chép, không gợi ý.

**Kịch bản giao cho người tham gia**: "Bạn muốn học tiếng Nhật mỗi ngày khoảng 10 phút. Hãy tạo tài khoản và hoàn thành bài học đầu tiên mà ứng dụng đưa ra." Không giải thích thêm.

**Tiêu chí**: *hoàn thành* = làm hết các bài tập của bài đầu tiên và thấy màn hình tóm tắt; *cần trợ giúp* = người tham gia hỏi quan sát viên hoặc quan sát viên phải can thiệp. Ghi thêm thời gian từ lúc mở trang đầu đến khi xong (đối chiếu SC-001 < 5 phút), bước gây khựng và nhận xét.

| Người tham gia | Hoàn thành | Cần trợ giúp | Thời gian | Bước gây khựng / nhận xét |
|---|---|---|---|---|
| P1 | | | | |
| P2 | | | | |
| … | | | | |
| **Tổng** | …/… | …/… | trung vị … | Tỷ lệ hoàn thành không trợ giúp: …% (mục tiêu ≥ 90%) |

Kết quả (2026-11-05): chủ dự án xác nhận **đạt** (đáp ứng SC-004); số người tham gia, tỷ lệ và thời gian cụ thể không được ghi lại — bảng trên giữ làm mẫu cho các đợt kiểm thử sau.

## 8. Dọn dẹp

```bash
docker compose down -v   # xóa container và dữ liệu dev
```
