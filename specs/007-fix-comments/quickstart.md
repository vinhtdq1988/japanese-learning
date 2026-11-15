# Hướng dẫn kiểm chứng: Hoàn thiện trải nghiệm học theo góp ý

**Nhánh**: `007-fix-comments` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/api-changes.md](contracts/api-changes.md), [contracts/competency-rules.md](contracts/competency-rules.md), [contracts/encouragement-catalog.md](contracts/encouragement-catalog.md), [contracts/practice-content.md](contracts/practice-content.md)

Các kịch bản chạy được để chứng minh tính năng đầu-cuối. Cài đặt môi trường, biến môi trường và lệnh chung xem [quickstart 001](../001-phase1-mvp/quickstart.md); ở đây chỉ nêu phần khác. Chi tiết dữ liệu xem [data-model.md](data-model.md), không lặp lại.

## 1. Chuẩn bị

```bash
docker compose up -d db mailpit
cd backend
pnpm install
pnpm db:migrate     # chạy thêm 0006_practice_skills.sql
pnpm seed           # nạp thêm 12 đơn vị luyện đọc/viết (cần nội dung đã biên soạn – research C2)
pnpm dev            # http://localhost:3000

cd ../client
# sinh lại API client từ OpenAPI 1.14.0: làm đúng các bước trong client/lib/data/api/README.md
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

Kiểm thử tự động riêng của tính năng:

```bash
cd backend
pnpm test:unit                                   # practice, daily-plan-practice, competency, encouragement-catalog, study-defaults, content-validation-practice, content-files
pnpm vitest run --project db tests/contract/fix-us1.test.ts tests/contract/fix-us2.test.ts \
  tests/contract/fix-us3.test.ts tests/contract/fix-us4.test.ts tests/integration/practice-gate.test.ts \
  tests/integration/competency-consistency.test.ts tests/integration/migration.test.ts
cd ../client
flutter test test/auth test/onboarding test/practice test/competency test/today   # các thư mục kiểm thử mới
dart run tool/check_l10n.dart                    # khóa l10n vi/en khớp nhau
```

Kiểm thử DB cần PostgreSQL (Docker hoặc `TEST_DATABASE_URL`).

**Tài khoản thử**: tạo qua giao diện hoặc `POST /auth/register`; dùng `$L15` (học viên khai báo 15 phút), `$L30` (khai báo 30 phút), `$NEW` (học viên mới chưa có dữ liệu), `$OLD` (học viên có sẵn tiến độ từ trước migrate).

**Kết quả mong đợi sau migrate**: `SELECT unnest(enum_range(NULL::skill))` có thêm `reading`, `writing`; số dòng của mọi bảng cũ không đổi; `learning_profiles.skills` của người học cũ không đổi.

## 2. Kịch bản kiểm chứng

### QS1 – Xem mật khẩu khi đăng nhập (US5, FR-001…004)

1. Mở màn hình đăng nhập, gõ mật khẩu → hiển thị dạng che.
2. Bấm biểu tượng "mắt" (hoặc Tab tới nút rồi Enter/Space) → mật khẩu hiện rõ, nhãn nút đổi thành "Ẩn mật khẩu"; bấm lại → che lại, nội dung gõ **không** mất.
3. Rời sang "Đăng ký" rồi quay lại "Đăng nhập" → mật khẩu về trạng thái che; ô trống.
4. Đăng nhập sai khi đang hiện → thông báo lỗi **không** chứa mật khẩu.
5. Làm lại bước 1–2 ở đăng ký và đặt lại mật khẩu (dùng chung `PasswordField`).
6. Thu nhỏ cửa sổ → nút vẫn thấy và bấm được; trình đọc màn hình đọc "Hiện mật khẩu"/"Ẩn mật khẩu".

**Mong đợi**: `flutter test test/auth/password_field_test.dart` xanh (mặc định che, bật/tắt giữ nội dung, không lưu qua điều hướng, nhãn trợ năng, bàn phím).

### QS2 – Gợi ý mặc định theo thời gian (US1, FR-021…025)

1. `GET /study-defaults` (token bất kỳ) → 4 dòng đúng bảng ở [data-model.md](data-model.md) §3.5, `practiceMinDailyMinutes = 30`; không token → `401`.
2. Onboarding mới: ở bước thời gian chọn 10 phút → bước kỹ năng điền sẵn *Từ vựng, Ngữ pháp* kèm nhãn "gợi ý theo thời gian bạn có". Chọn lại 15 phút (chưa chỉnh) → điền *+ Kanji*. Chọn 30 phút → điền cả *Luyện đọc, Luyện viết*.
3. Quay lại bước thời gian, chọn 15, **bỏ Ngữ pháp**, sang bước kỹ năng; đổi tiếp thời gian sang 30 → lựa chọn đã chỉnh được **giữ nguyên**; chỉ hiện lời mời "Gợi ý mới cho 30 phút … [Áp dụng] [Giữ nguyên]".
4. Hoàn tất mà không đổi gì ngoài thời gian → có kế hoạch học đầu tiên (SC-002: dưới 3 phút).
5. Hồ sơ: học viên 30 phút có luyện đọc/viết, đổi quỹ thời gian xuống 15 và lưu → `GET /me` vẫn trả `skills` cũ (có reading/writing); màn Hồ sơ hiện lời mời gợi ý mới; không `PATCH skills` nào xảy ra cho tới khi bấm "Áp dụng".
6. Học viên thuộc lớp (fixture lớp): các điều khiển bị khóa vẫn khóa; không có nút Áp dụng cho trường bị khóa.

**Mong đợi**: `fix-us1.test.ts`; `flutter test test/onboarding/suggestion_test.dart` (bảng `reconcileSuggestion`).

### QS3 – Luyện đọc và luyện viết, cổng ≥ 30 phút (US2, FR-005…013)

1. `$L30` có luyện đọc/viết bật: `GET /today` (trong vài ngày giả lập, xem hồ sơ golden) có mục `kind = reading` / `writing` xen cùng bài khác, `estimatedMinutes ≤ 30`.
2. Mở bài luyện đọc: đoạn văn hiện ở bước giới thiệu và được ghim phía trên câu hỏi; trả lời → đúng/sai + giải thích; hoàn thành → phiên 5–15 phút, `study_records` có `topic_id` là chủ đề luyện đọc.
3. Mở bài luyện viết: gõ tiếng Nhật bằng IME, chốt chữ bằng Enter **không** nộp sớm; sai → thấy đáp án tham chiếu; đúng với cả dạng Kanji và hiragana đã khai báo.
4. `$L15` (hoặc hạ `$L30` xuống 15): `GET /today`, `GET /path`, `POST /today/extra` không có reading/writing; màn bật/tắt kỹ năng hiện mục khóa "dành cho người học từ 30 phút mỗi ngày" + cách đổi thời gian.
5. Gọi **trực tiếp** `POST /sessions` với `planItemId` là id đơn vị luyện bằng token `$L15` → `403 PRACTICE_LOCKED` (`fields.minimumDailyMinutes = "30"`); tương tự `answers`/`complete` của phiên luyện cũ.
6. `PATCH /me {"skills":["vocabulary","reading"]}` khi phút = 15 → `422`; `PATCH /me {"dailyMinutes":15}` cho `$L30` **không** xóa `skills` đã lưu; nâng lại 30 → có lại; lịch sử kết quả luyện vẫn thấy ở Tiến độ.
7. `$L30` tắt luyện đọc/viết trong Hồ sơ → kế hoạch ngày kế không còn hai mục này, quỹ dùng cho nội dung khác.
8. Đơn vị luyện không tạo `review_schedules`: `SELECT count(*) FROM review_schedules rs JOIN content_items ci ON ci.id = rs.item_id WHERE ci.kind IN ('reading','writing')` = 0.

**Mong đợi**: `fix-us2.test.ts`, `practice-gate.test.ts`, `daily-plan-practice.test.ts`; SC-003 = 100%.

### QS4 – Màu năng lực (US3, FR-014…020)

1. Với `competency-mixed` (mạnh từ vựng ≥ 70%, yếu Kanji < 70%, luyện viết < 8 câu): `GET /progress` → `competency.skills` = vocabulary `good`, kanji `needs_improvement`, writing `insufficient`; `weakTopics ⊆` chủ đề `needs_improvement`.
2. Cùng người học: `GET /today` (`PlanItem.competency`), `GET /path` (`items[].competency`) khớp bảng đáp án mong đợi của hồ sơ; màn Hôm nay/Lộ trình/Tiến độ tô xanh lục / vàng nhạt / trung tính tương ứng, mỗi chip có biểu tượng + nhãn chữ, chú giải ba màu hiện ra.
3. Học thêm để mảng yếu lên ≥ 70% → mở lại màn hình, màu chuyển sang xanh lục (US3.4).
4. `$NEW` (chưa dữ liệu) → mọi chip trung tính "chưa đủ dữ liệu", không thông báo "yếu".
5. Chuyển giao diện tối: nhãn đọc rõ ở cả ba mức; thu hẹp cửa sổ: chip xuống dòng không che nội dung.

**Mong đợi**: `competency.test.ts` (biên 0.70/8 câu), `competency-consistency.test.ts` (ba endpoint khớp), `flutter test test/competency` (nhãn chữ, tương phản ≥ 4.5:1 sáng/tối).

### QS5 – Lời khích lệ ở "Hôm nay" (US4, FR-026…031)

1. Với từng hồ sơ ở [encouragement-catalog §6](contracts/encouragement-catalog.md#6-kiểm-thử-bằng-hồ-sơ-mẫu-fr-031) mở `GET /today` → `encouragement.state` đúng (`not_started`, `in_progress`, `day_completed`, `streak`, `welcome_back`, `behind_target`) và `message` đúng ngôn ngữ hồ sơ (đổi `language` vi↔en kiểm lại).
2. Tải lại nhiều lần trong ngày → cùng một câu; giả lập sang ngày kế (đồng hồ giả) cùng trạng thái → câu khác; qua 5 ngày liên tiếp ≥ 2 câu khác nhau (SC-008).
3. Hoàn thành kế hoạch → màn chúc mừng của spec 005 hiện **một lần**; quay lại "Hôm nay" thấy dải `day_completed` (chữ tĩnh), không hiệu ứng thứ hai (FR-030).
4. Tắt âm thanh/hiệu ứng trong Hồ sơ → dải khích lệ vẫn hiện.
5. Mở danh mục trong test `encouragement-catalog`: mọi câu vi/en qua bộ từ cấm; mỗi trạng thái ≥ 3 biến thể (SC-007).

**Mong đợi**: `encouragement.test.ts`, `encouragement-catalog.test.ts`, `fix-us4.test.ts`, `flutter test test/today/encouragement_banner_test.dart`.

### QS6 – Hồi quy (bất biến Learning Engine)

```bash
cd backend
pnpm vitest run --project unit tests/unit/kanji-regression-golden.test.ts tests/unit/org-regression-golden.test.ts tests/unit/goal-ratio.test.ts
pnpm vitest run --project db tests/contract/authz-matrix.ts tests/contract/org-authz-matrix.test.ts   # thêm dòng /study-defaults
```

**Mong đợi**: kế hoạch 14 ngày, `GET /path`, `GET /progress` của mọi hồ sơ cũ **không đổi** (chỉ thêm trường tùy chọn mới); bộ kiểm thử 5 test spec 003 đã đỏ sẵn tại HEAD (ghi chú trong bộ nhớ dự án) KHÔNG được tính là hồi quy của spec này.

## 3. Danh sách kiểm tay trước phát hành

- [ ] Gõ tiếng Nhật bằng IME thật (Microsoft IME / Google Japanese Input) trên Chrome, Edge, Firefox, Safari: Enter chốt chữ không nộp bài (research P6).
- [ ] Duyệt giọng điệu toàn bộ lời khích lệ vi/en (SC-007) bởi chủ dự án.
- [ ] Duyệt nội dung 12 bài luyện đọc/viết theo danh sách duyệt ở [practice-content.md](contracts/practice-content.md).
- [ ] Nhìn qua ba màu năng lực ở giao diện sáng/tối, và với bộ lọc giả lập mù màu (đỏ–lục) vẫn phân biệt được nhờ nhãn/biểu tượng (SC-006).
- [ ] Màn hình hẹp (≤ 480 px): nút xem mật khẩu, chip năng lực, dải khích lệ, đoạn văn ghim đều đọc được.
- [ ] Đo p95 `GET /today` và `GET /progress` sau khi thêm năng lực/khích lệ: tăng ≤ 50 ms so với trước.
