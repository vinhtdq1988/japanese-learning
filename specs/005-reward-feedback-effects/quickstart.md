# Hướng dẫn kiểm chứng: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Nhánh**: `005-reward-feedback-effects` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/api-changes.md](contracts/api-changes.md), [contracts/client-effects.md](contracts/client-effects.md)

Tài liệu này mô tả các kịch bản chạy được để chứng minh tính năng hoạt động đầu-cuối. Cài đặt môi trường, biến môi trường và lệnh chung xem [quickstart 001](../001-phase1-mvp/quickstart.md); ở đây chỉ nêu phần khác. Chi tiết dữ liệu xem [data-model.md](data-model.md), không lặp lại ở đây.

## 1. Chuẩn bị

```bash
docker compose up -d db mailpit
cd backend
pnpm install
pnpm db:migrate     # chạy thêm 0005_reward_effects.sql
pnpm seed           # nội dung 001/003 là đủ
pnpm dev            # http://localhost:3000

cd ../client
# sinh lại API client từ OpenAPI 1.13.0: làm đúng các bước trong client/lib/data/api/README.md
dart run tool/generate_sounds.dart      # (chỉ khi sửa âm thanh) sinh lại client/assets/sounds/*.wav
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Chạy kiểm thử tự động của riêng tính năng:

```bash
cd backend
pnpm test:unit                                   # achievements-engine, achievement-catalog, ...
pnpm vitest run --project db tests/contract/reward-us2.test.ts tests/contract/reward-us3.test.ts \
  tests/integration/reward-achievements.test.ts tests/integration/migration.test.ts
cd ../client
flutter test test/effects                        # hiệu ứng, âm thanh, màn chúc mừng, thiết lập
dart run tool/check_l10n.dart                    # khóa l10n vi/en khớp nhau
```

Kiểm thử DB cần PostgreSQL (Docker hoặc `TEST_DATABASE_URL`).

**Tài khoản thử**: đăng ký qua giao diện hoặc `POST /auth/register`; hoàn tất onboarding. Dùng `$LRN` làm token người học mới, `$LRN2` làm người học thứ hai (cửa sổ thứ hai), `$OLD` là người học có sẵn tiến độ trước khi migrate.

**Kết quả mong đợi** sau migrate: bảng `earned_achievements` và `daily_completion_celebrations` rỗng; `SELECT count(*) FROM learning_profiles WHERE sound_enabled AND visual_effects_enabled` bằng tổng số hồ sơ; số dòng các bảng cũ không đổi.

## 2. Kịch bản kiểm chứng

Mỗi kịch bản ánh xạ câu chuyện người dùng trong [spec.md](spec.md).

### RF1 – Phản hồi âm thanh và hình ảnh khi trả lời (US1, SC-001)

1. Đăng nhập `$LRN`, mở bài học đầu tiên trong "Hôm nay", qua phần giải thích, bắt đầu làm bài.
2. Trả lời **đúng** một câu trắc nghiệm → ngay khi thẻ phản hồi hiện: nghe cue `correct`, thấy vòng xung xanh + tia lấp lánh, thẻ có biểu tượng ✓ và chữ "Đúng"; nút "Tiếp tục" bấm được ngay trong lúc hiệu ứng chạy.
3. Trả lời **sai** một câu điền chỗ trống → nghe cue `incorrect` (nhẹ, trầm), thấy lớp phủ hổ phách mờ dần (không rung/đỏ gắt); thẻ vẫn hiện "Chưa đúng", đáp án đúng và giải thích như trước tính năng.
4. Làm một bài ghép cặp → bấm "Kiểm tra" nhận **đúng một** hiệu ứng cho cả lần nộp (research E16).
5. Mở một bài **ôn tập** và một **bài học mẫu của khách** (`/trial`) → cùng kiểu phản hồi.
6. Mở **bài kiểm tra trình độ** → trả lời các câu: **không** có hiệu ứng/âm thanh đúng-sai nào.
7. Bấm "Kiểm tra" liên tiếp thật nhanh nhiều câu → chỉ một hiệu ứng và một cue tại một thời điểm (cái sau thay cái trước), không giật.

Mong đợi: 100% lần trả lời có hiệu ứng ≤ 0,2 s sau khi kết quả hiện (widget test với backend giả độ trễ cố định); kết quả đúng/sai nhận ra được khi tắt màu (biểu tượng + chữ).

### RF2 – Chúc mừng thành tựu và hoàn thành ngày (US2, SC-003)

1. `$LRN` hoàn thành bài học mới đầu tiên **không sai câu nào** (kể cả không có câu hỏi lại) → phản hồi `POST /sessions/{id}/complete` có `celebrations.achievements = [first_lesson, perfect_lesson]`. Trên giao diện: **một màn gộp**, hiện lần lượt "Bài học đầu tiên" rồi "Bài học hoàn hảo", mỗi thẻ có âm `achievement`.
2. Nếu đó là mục cuối của kế hoạch hôm nay: `celebrations.dayCompleted = true` và thẻ "Hoàn thành ngày" đứng **đầu** cùng màn gộp (không tách màn).
3. Bấm "Tiếp tục" ngay khi màn chúc mừng đang hiện → điều hướng xảy ra ngay (lớp phủ không chặn) và màn chúc mừng đóng.
4. Gọi lại `POST /sessions/{id}/complete` cùng phiên (`curl`) → **không** có `celebrations`; `SELECT count(*) FROM earned_achievements WHERE user_id=…` không đổi.
5. Tải lại trang, đăng nhập lại ở thiết bị/cửa sổ khác → không chúc mừng lại.
6. Học thêm một bài ngoài kế hoạch sau khi ngày đã xong → `celebrations.dayCompleted` là `false` (chúc mừng ngày tối đa một lần).
7. Đổi ngôn ngữ giao diện sang tiếng Anh, tạo thành tựu mới → tên/mô tả bằng tiếng Anh (theo `profile.language`).

### RF3 – Mốc chuỗi, số mục, tiến độ mục tiêu (US2.2–2.3)

Dùng dữ liệu dựng sẵn (script kiểm thử đặt `study_records` cho 6 ngày liên tiếp):

1. `$LRN` ở ngày học thứ 6, hoàn thành phiên ngày thứ 7 → `celebrations.achievements` chứa `streak_7` (và chỉ đúng một lần).
2. Người học có 49 mục đã học; hoàn thành bài chứa ≥ 1 mục mới → `items_50`.
3. Người học ở 24% mục tiêu; hoàn thành đơn vị đưa tỷ lệ ≥ 25% → `goal_25`.
4. Phiên **ôn tập** hoàn thành bởi người học chưa có `first_lesson` → KHÔNG có `first_lesson`/`perfect_lesson` (Làm rõ Q3).

### RF4 – Không chúc mừng bù, không thu hồi, vượt mốc do đổi cấu hình (FR-016, FR-017a)

1. Hủy yêu cầu `complete` ngay sau khi gửi (hoặc chặn phản hồi trong DevTools) rồi gọi lại → thành tựu **đã ghi** (`earned_achievements` có dòng `source='earned'`) nhưng lần gọi lại **không** trả `celebrations`; mở lại ứng dụng cũng không thấy chúc mừng.
2. Người học ở 40% mục tiêu: đổi mục tiêu (`PATCH /me {goalType…}`) làm tỷ lệ nhảy lên 60% → hoàn thành phiên kế tiếp **không** chúc mừng `goal_50` (kiểm tra `earned_achievements` có `goal_50` với `source='silent'`).
3. Rồi đổi mục tiêu làm tỷ lệ tụt về 10% → dòng `goal_25`, `goal_50` vẫn còn; khi tỷ lệ tăng lại qua 25% nhờ học → **không** chúc mừng lại.
4. `$OLD` (chuỗi 20 ngày, 120 mục, chưa có dòng nào): hoàn thành phiên đầu sau ra mắt → không có chúc mừng nào ngoài mốc thật sự vừa đạt; các mốc 3/7/14, 50/100 được ghi `silent`.
5. Hai cửa sổ cùng đạt một mốc gần như đồng thời (kiểm thử đồng thời): chỉ một phản hồi có mốc đó; có đúng một dòng.

### RF5 – Tùy chỉnh và tiếp cận (US3, SC-004, SC-005)

1. Mở Hồ sơ → mục "Hiệu ứng": hai công tắc "Âm thanh" và "Hiệu ứng hình ảnh", mặc định bật; đổi được trong ≤ 10 giây.
2. Tắt "Âm thanh" → làm bài, đạt thành tựu: **không** có tiếng, hiệu ứng hình ảnh vẫn chạy.
3. Bật lại âm, tắt "Hiệu ứng hình ảnh" → không hoạt ảnh trang trí; kết quả đúng/sai vẫn rõ (biểu tượng + chữ); thành tựu hiện bằng **một dòng thông báo tĩnh**; âm thanh vẫn phát.
4. Trong bài học, bấm nút loa trên thanh tiêu đề → tắt/bật tiếng ngay, không rời bài; giá trị lưu qua `PATCH /me`.
5. Bật "giảm chuyển động" của hệ điều hành/trình duyệt (Chrome DevTools → Rendering → *Emulate CSS prefers-reduced-motion*) → với "Hiệu ứng hình ảnh" đang bật, hiệu ứng chuyển sang dạng tĩnh/mờ, không confetti hay chuyển động.
6. Đăng xuất, đăng nhập lại (và ở trình duyệt khác) → thiết lập giữ nguyên.
7. Khách `/trial`: bấm nút loa/hiệu ứng → áp dụng ngay; tải lại trang → về mặc định (bật); không có yêu cầu mạng nào ghi tùy chọn; `localStorage`/`sessionStorage` không có khóa tùy chọn.
8. Học viên thuộc lớp (spec 004): `PATCH /me {soundEnabled:false}` → 200 (không `CLASS_MANAGED`).
9. Trình đọc màn hình (NVDA/VoiceOver): kết quả "Đúng"/"Chưa đúng" và nội dung thành tựu được đọc; tiêu điểm bàn phím không bị cướp.
10. Chặn âm thanh (đặt `AudioContext` bị chặn hoặc xóa tệp `.wav` trong DevTools): hiệu ứng hình ảnh vẫn chạy, không có thông báo lỗi.

### RF6 – Chuỗi đúng liên tiếp (US4, P3)

1. Trong một bài, trả lời đúng 3 câu lượt chính liên tiếp → câu thứ 3 nhận phản hồi nổi bật hơn (cue `streak` + huy hiệu "3 liên tiếp"); tương tự ở 5 và 10.
2. Trả lời sai → bộ đếm về 0, chỉ có phản hồi sai nhẹ thông thường.
3. Rời bài rồi vào lại → bộ đếm bắt đầu từ 0; không có dữ liệu nào lưu (không có yêu cầu mạng, không có khóa LocalStore).

### RF7 – Không làm hỏng học tập, hiệu năng, bảo mật (FR-009, SC-002)

1. So sánh `GET /path`, `GET /progress`, kế hoạch 14 ngày, lịch ôn của các hồ sơ đại diện **trước và sau** khi cài tính năng (golden hồi quy) → giống hệt.
2. Đo `POST /sessions/{id}/complete` p95 trên hồ sơ lớn nhất: tăng ≤ 100 ms so với trước.
3. Thời gian hoàn thành một kế hoạch điển hình (kịch bản tự động, đồng hồ giả) không tăng quá 3%; không có chờ nào sau khi trả lời (nút "Tiếp tục" luôn bấm được).
4. Phản hồi `/classes/*` và `/org/*` không chứa trường thành tựu; ma trận quyền (`org-authz-matrix`) vẫn đạt.
5. Kiểm tra CSP: không có vi phạm CSP trong Console khi phát âm thanh (`default-src 'self'`).

### RF8 – Chỉ số sau ra mắt (SC-006, SC-007)

`pnpm report:metrics` (đã mở rộng): in tỷ lệ người học hoạt động ≥ 14 ngày tắt cả hai hiệu ứng và tỷ lệ quay lại ngày kế tiếp sau ngày hoàn thành kế hoạch, trước/sau ngày ra mắt (ngày ra mắt = ngày của dòng `earned_achievements` sớm nhất, không cần tham số). Khảo sát "thú vị hơn" (SC-006) do đội sản phẩm thực hiện ngoài hệ thống.
