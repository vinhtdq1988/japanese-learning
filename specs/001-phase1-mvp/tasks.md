---

description: "Danh sách task triển khai Giai đoạn 1 – MVP (Ứng dụng web học tiếng Nhật cá nhân hóa)"
---

# Danh sách task: Giai đoạn 1 – MVP (Ứng dụng web học tiếng Nhật cá nhân hóa)

**Đầu vào**: Tài liệu thiết kế tại `specs/001-phase1-mvp/`

**Điều kiện tiên quyết**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Kiểm thử**: CÓ tạo task kiểm thử vì FR-035 và hiến pháp bắt buộc kiểm thử tự động engine bằng hồ sơ người học đại diện, SC-012 yêu cầu kiểm thử đồng thời, và R15 cam kết kiểm thử hợp đồng/tích hợp. Phạm vi kiểm thử giới hạn ở các mục đó, không thêm TDD cho mọi lớp.

**Tổ chức**: Task được nhóm theo câu chuyện người dùng (US1–US8) để triển khai và kiểm thử độc lập.

## Định dạng: `[ID] [P?] [Story] Mô tả kèm đường dẫn file`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa xong)
- **[Story]**: Câu chuyện người dùng mà task thuộc về (US1…US8)
- Mọi đường dẫn tính từ thư mục gốc kho mã (`backend/`, `client/`, `content/`)

## Quy ước chung cho mọi task

- Comment và tài liệu đi kèm mã bằng **tiếng Việt**; tên biến/hàm/lớp bằng tiếng Anh (CLAUDE.md).
- Mọi truy vấn dữ liệu người học PHẢI lọc theo `user_id` lấy từ token, KHÔNG nhận `user_id` từ client (R16).
- Văn bản dịch dùng kiểu `i18n_text` = JSONB `{"vi": "...", "en": "..."}`; chữ Nhật, cách đọc, câu ví dụ giữ một bản.
- Tên route, trường JSON, mã lỗi PHẢI khớp `specs/001-phase1-mvp/contracts/openapi.yaml`.
- Mọi thay đổi `openapi.yaml` hoặc JSON Schema nội dung trong `content/schema/` PHẢI tăng phiên bản (`info.version` / `$id`) và ghi vào nhật ký thay đổi; thay đổi phá vỡ tương thích tăng phiên bản chính (Hiến pháp).

---

## Phase 1: Thiết lập (hạ tầng dùng chung)

**Mục đích**: Khởi tạo dự án và cấu trúc thư mục

- [X] T001 Tạo cấu trúc thư mục theo plan.md: `backend/src/{api,engine,domain,db,services,jobs,reports,seed}`, `backend/tests/{unit,contract,integration,load,fixtures/learner-profiles}`, `client/lib/{domain,data,platform/web,presentation,l10n}`, `content/{schema,units,placement}` (file `content/topics.json` do T027 tạo)
- [X] T002 Khởi tạo dự án backend Node.js 22 + TypeScript 5 với pnpm trong `backend/package.json`, `backend/tsconfig.json` (strict); thêm phụ thuộc: fastify, zod, drizzle-orm, pg, pg-boss, argon2, jose, nodemailer, @fastify/rate-limit, vitest, testcontainers
- [X] T003 [P] Khởi tạo dự án Flutter web trong `client/pubspec.yaml` với phụ thuộc: flutter_riverpod, go_router, dio, intl, flutter_localizations; bật `generate: true` cho l10n
- [X] T004 [P] Cấu hình ESLint + Prettier cho backend trong `backend/eslint.config.js`, `backend/.prettierrc`, và `flutter_lints` trong `client/analysis_options.yaml`
- [X] T005 [P] Tạo `docker-compose.yml` ở thư mục gốc với dịch vụ `db` (PostgreSQL 16), `mailpit` (chỉ dev, giao diện cổng 8025), `api`
- [X] T006 [P] Tạo `backend/.env.example` với các biến `DATABASE_URL`, `JWT_SECRET`, `SMTP_URL`, `APP_BASE_URL` và cấu hình ngưỡng (rate-limit, 60%/90% độ khó, `REVIEW_SECONDS_PER_ITEM` mặc định 30) kèm comment tiếng Việt

---

## Phase 2: Nền tảng (điều kiện chặn mọi câu chuyện)

**Mục đích**: Hạ tầng cốt lõi PHẢI hoàn tất trước khi làm bất kỳ câu chuyện nào

**⚠️ QUAN TRỌNG**: Không câu chuyện nào được bắt đầu trước khi phase này xong

### CSDL và cấu hình

- [X] T007 Viết cấu hình môi trường (đọc/validate bằng Zod) trong `backend/src/config.ts`
- [X] T008 Tạo migration SQL tường minh `backend/src/db/migrations/0001_init.sql`: bật extension `citext`; tạo enum và bảng `users` (gồm `from_trial`), `auth_sessions`, `password_reset_tokens`, `learning_profiles`, `pause_periods`, `topics`, `learning_units` (gồm `tier`), `content_items`, `exercises`, `placement_questions`, `placement_results`, `learning_paths` (gồm `reason`), `unit_progress`, `daily_plans`, `daily_plan_items`, `lesson_sessions`, `study_records` (gồm `is_retry`), `study_intervals`, `review_schedules` (gồm `last_reviewed_local_date`), `topic_stats`, `admin_action_logs`, `aggregate_daily_stats` (khóa `(day, metric)`) đúng theo data-model.md; bao gồm các ràng buộc: `learning_units.est_minutes` CHECK ∈ {5,10,15}; CHECK `tier='foundation'` chỉ khi `level='N5'`; unique partial index `study_records(session_id, exercise_id) WHERE is_retry = false`; unique partial index `pause_periods(user_id) WHERE ended_on IS NULL`; `daily_plans.estimated_minutes` CHECK ≤ `budget_minutes`; `daily_plan_items.est_minutes` CHECK 1 ≤ giá trị ≤ 15; `study_intervals.duration_seconds` CHECK 0 < giá trị ≤ 1800; UNIQUE `(user_id, client_event_id)` trên `study_records` và `study_intervals`; UNIQUE `(user_id, local_date)` trên `daily_plans`; unique partial index `learning_paths(user_id) WHERE status='active'`; chỉ mục `review_schedules(user_id, due_date)`, `learning_units(status, level, kind)`, `exercises(unit_id)`, `content_items(unit_id)`; mọi bảng người học tham chiếu `users` bằng `ON DELETE CASCADE`
- [X] T009 Định nghĩa schema Drizzle khớp migration trong `backend/src/db/schema.ts` và kết nối/giao dịch trong `backend/src/db/client.ts`
- [X] T010 [P] Viết trình chạy migration (`pnpm db:migrate`) trong `backend/src/db/migrate.ts`

### Engine nền và miền

- [X] T011 [P] Định nghĩa kiểu miền dùng chung (Level, Skill, GoalType, I18nText, LocalDate, v.v.) trong `backend/src/domain/types.ts`
- [X] T012 [P] Cài `Clock` có thể tiêm và tiện ích ngày địa phương theo IANA timezone (R11) trong `backend/src/engine/clock.ts`
- [X] T013 [P] Tiện ích bản địa hóa `i18n_text` theo `profile.language` (mặc định `vi`) trong `backend/src/domain/i18n.ts`
- [X] T014 [P] Quy tắc kiểm tra nội dung (R13, data-model 2.8–2.10): `est_minutes ∈ {5,10,15}`, mỗi (level × kind) có ≥ 1 đơn vị 5 phút, `tier='foundation'` chỉ cho N5 và mỗi kind có ≥ 1 đơn vị N5 `foundation` 5 phút, đơn vị có ≥ 1 mục và ≥ 1 bài tập, bản dịch vi+en đầy đủ, `fill_blank` có `accepted_answers` hữu hạn không rỗng, `multiple_choice` có `correct_index` nằm trong `choices`, `matching` mỗi cặp hợp lệ, `grammar` có `explanation` và ≥ 1 ví dụ, `vocabulary` có `reading` trong `backend/src/domain/content-validation.ts`
- [X] T015 [P] Bộ chấm bài tập khách quan (multiple_choice, matching, fill_blank; chuẩn hóa chuỗi khi so khớp) trong `backend/src/domain/grading.ts`

### API nền

- [X] T016 Khởi tạo ứng dụng Fastify (đăng ký route dưới tiền tố `/api/v1`, xử lý lỗi theo schema lỗi trong openapi.yaml, nhật ký không ghi IP vào CSDL) trong `backend/src/app.ts` và `backend/src/server.ts`
- [X] T017 [P] Middleware xác thực JWT (jose, access token 15 phút, không tra CSDL mỗi request) và kiểm tra vai trò `learner`/`admin` (FR-004); claim `status='pending_deletion'` chỉ cho phép `POST /account/restore` và `POST /auth/logout`, các route khác trả 403 `ACCOUNT_PENDING_DELETION` (R4) trong `backend/src/api/middleware/auth.ts`
- [X] T018 [P] Middleware rate-limit theo IP bằng `@fastify/rate-limit` với bộ đếm trong bộ nhớ, ngưỡng cấu hình được: `/trial/*` (gồm `POST /trial/events`) và `/placement/questions` 60/phút, `POST /trial/placement/grade` 10/phút, `/auth/*` đăng ký/đăng nhập/đặt lại 10/phút (R9, FR-040) trong `backend/src/api/middleware/rate-limit.ts`
- [X] T019 [P] Khung hàng đợi pg-boss (khởi động/dừng, đăng ký handler) trong `backend/src/jobs/boss.ts`
- [X] T020 [P] Giao diện `EmailSender` + triển khai SMTP (nodemailer) + triển khai in-memory cho kiểm thử trong `backend/src/services/email.ts`
- [X] T021 [P] Cấu hình CSP, HSTS và header bảo mật (R16) trong `backend/src/api/middleware/security-headers.ts`

### Kiểm thử nền

- [X] T022 [P] Thiết lập Vitest + Testcontainers PostgreSQL (khởi động DB, chạy migration, dọn giữa các test) trong `backend/vitest.config.ts` và `backend/tests/integration/setup.ts`
- [X] T023 [P] Thiết lập kiểm thử hợp đồng đối chiếu `specs/001-phase1-mvp/contracts/openapi.yaml` (validate request/response) trong `backend/tests/contract/helper.ts`
- [X] T024 [P] Tạo bộ hồ sơ người học đại diện dạng fixture (FR-035, hiến pháp): người mới/10 phút, N3/30 phút, quay lại sau khoảng nghỉ, 5 phút nhiều bài ôn tồn đọng, placement đoán mò, liên tục < 60% ở một mảng (≥ 2 phiên), liên tục > 90% ở một mảng (≥ 2 phiên), mảng yếu đã hồi phục (≥ 70%), N2 tự khai báo, mục tiêu JLPT N1; mỗi hồ sơ gồm hồ sơ học tập, lịch sử `study_records` và kết quả mong đợi trong `backend/tests/fixtures/learner-profiles/*.json`

### Nội dung và seed

- [X] T025 [P] Viết JSON Schema cho đơn vị học (gồm `tier`), mục, bài tập, câu hỏi placement trong `content/schema/unit.schema.json`, `content/schema/placement.schema.json`
- [X] T026 Viết lệnh `seed` (`pnpm seed`): nạp `content/` có kiểm tra JSON Schema + quy tắc T014, nạp topics, tạo tài khoản admin dev bằng hàm của T026a trong `backend/src/seed/index.ts`
- [X] T026a Lệnh vận hành `pnpm admin:create --email <email>` (FR-004, data-model §2.1): tạo tài khoản admin mới hoặc nâng quyền tài khoản có sẵn, không có đường đăng ký công khai nào tạo `role='admin'`; ghi `admin_action_logs` với `action='user.grant_admin'`, `actor_id` null; dùng được cho cả dev và production trong `backend/src/seed/create-admin.ts`
- [X] T027 [P] Biên soạn nội dung tối thiểu N5 song ngữ vi/en: ≥ 1 đơn vị 5 phút cho mỗi (level × kind), ≥ 1 đơn vị `foundation` 5 phút cho mỗi kind, và chủ đề trong `content/units/n5-vocabulary-*.json`, `content/units/n5-grammar-*.json`, `content/topics.json`
- [X] T028 [P] Biên soạn bộ 20 câu placement cố định (8 N5, 6 N4, 6 N3, gắn topic, có `position`) trong `content/placement/placement-v1.json`

### Client nền

- [X] T029 [P] Định nghĩa giao diện nền tảng `TokenStore`, `LocalStore`, `Timezone`, `Links` trong `client/lib/platform/platform.dart` và triển khai web trong `client/lib/platform/web/*.dart` (Nguyên tắc V)
- [X] T030 [P] Sinh API client từ `specs/001-phase1-mvp/contracts/openapi.yaml` vào `client/lib/data/api/`, tên hàm lấy theo `operationId` (ghi hướng dẫn lệnh sinh trong `client/lib/data/api/README.md`), cấu hình `dio` với interceptor gắn bearer token và tự làm mới qua `/auth/refresh` trong `client/lib/data/api/dio_client.dart`
- [X] T031 [P] Thiết lập i18n ARB: `client/lib/l10n/app_vi.arb` (mặc định) và `client/lib/l10n/app_en.arb` với các khóa chung (nút, lỗi, điều hướng)
- [X] T032 Thiết lập `main.dart`, theme, `go_router` với guard xác thực/vai trò (route công khai, người học, `/admin/*`) và Riverpod providers gốc trong `client/lib/main.dart`, `client/lib/presentation/shared/theme.dart`, `client/lib/router.dart`
- [X] T033 [P] Widget dùng chung (khung trang desktop, hộp thoại xác nhận, trạng thái trống/lỗi/đang tải) trong `client/lib/presentation/shared/`

**Điểm kiểm tra**: Nền tảng sẵn sàng – có thể bắt đầu các câu chuyện

> **Ghi chú triển khai Phase 2** (2026-11-04):
> - Backend (T007–T028, T026a) đã kiểm chứng: `tsc`, `eslint`, `prettier` sạch; 118 kiểm thử xanh (86 đơn vị + 32 trên PostgreSQL 16 thật: migration, ràng buộc, schema Drizzle, seed, `admin:create`). Chạy được `db:migrate`, `seed`, `admin:create` và khởi động `server.ts` (pg-boss tạo schema `pgboss`).
> - **T030 đã xong** (2026-11-04): API client sinh bằng OpenAPI Generator `dart-dio` vào `client/lib/data/api/generated/` (gói `japanese_api`, path dependency trong `client/pubspec.yaml`); đủ 44 `operationId` thành hàm. Cần 2 bước sau khi sinh, đã ghi trong `client/lib/data/api/README.md`: `dart run build_runner build` chạy **trong thư mục `generated/`**, và `dart run tool/patch_generated_api.dart` (vá lỗi generator sinh giá trị mặc định enum sai kiểu; `flutter analyze` bỏ qua thư mục `generated/` nên lỗi này chỉ lộ khi biên dịch). Các `*.g.dart` không commit. Để hai gói cùng language version, cận dưới SDK của gói gốc nâng lên `>=3.8.0` (Flutter `>=3.32.0`). Đã thêm `client/test/generated_api_test.dart` (client sinh ra chạy qua `createDio`, gắn bearer, giải mã `DailyPlan`).
> - **Client T029–T033 đã kiểm chứng** (2026-11-04, Flutter 3.47 / Dart 3.13): `flutter analyze` sạch, `flutter test` 23 kiểm thử xanh, `flutter build web` thành công.
> - **Kiểm thử không cần Docker**: `pnpm test:unit` (`vitest run --project unit`) chạy 86 kiểm thử đơn vị thuần hàm, không cần CSDL; cùng `pnpm typecheck`, `pnpm lint`, `pnpm format:check` đều sạch (kiểm chứng lại 2026-11-04 trên máy không có Docker/PostgreSQL). Dự án `db` (migration, seed, về sau là hợp đồng/tích hợp) bắt buộc có PostgreSQL và sẽ báo lỗi rõ ràng nếu thiếu Docker lẫn `TEST_DATABASE_URL`.
> - Kiểm thử cần Docker (Testcontainers) đã chạy được qua `TEST_DATABASE_URL` trỏ tới PostgreSQL 16 dựng sẵn (cơ sở dữ liệu PHẢI dùng mã hóa UTF8).

---

## Phase 3: US1 – Nhận kế hoạch cá nhân và bắt đầu học ngay (P1) 🎯 MVP

**Mục tiêu**: Đăng ký → onboarding (có/không placement) → lộ trình cá nhân + bài học hôm nay.

**Kiểm thử độc lập**: Đăng ký tài khoản mới, hoàn tất onboarding ở cả hai nhánh (có và không làm placement), xác minh lộ trình và kế hoạch hôm nay khớp trình độ, mục tiêu, thời gian khai báo (quickstart K1, K2).

### Kiểm thử US1

- [X] T034 [P] [US1] Kiểm thử đơn vị `placement.ts` (trình độ = mức cao nhất mà tỷ lệ đúng ≥ 60% và các nhóm thấp hơn cũng ≥ 60%; mảng yếu = topic đúng < 50%; tổng tỷ lệ đúng ≤ 25% → `none`) trong `backend/tests/unit/placement.test.ts`
- [X] T035 [P] [US1] Kiểm thử đơn vị `path.ts` trên hồ sơ đại diện (người mới → các mục đầu là `tier='foundation'`; 10 phút; N3; placement đoán mò → mức an toàn; N2 → bắt đầu N3 kèm `scopeNotice='content_ceiling_n3'`; JLPT N1 → khoảng trình độ cắt ở N3; không tạo lộ trình cố định chung cho mọi hồ sơ; `rankUnits` tự đưa đơn vị `active` mới vào và loại đơn vị `inactive`/`mastered`) trong `backend/tests/unit/path.test.ts`
- [X] T036 [P] [US1] Kiểm thử đơn vị `daily-plan.ts` phần thuộc T041 (danh sách mục ôn được truyền vào làm tham số, không kiểm thử việc chọn/chia gói): tổng `est_minutes` ≤ `budget_minutes` cho mọi hồ sơ; `B=5` chỉ chứa mục ≤ 5 phút; danh sách ôn rỗng → toàn bộ quỹ cho bài mới; có danh sách ôn → phần ôn ≤ 60% `B`, không có bài mới phù hợp → toàn bộ quỹ cho ôn; khi phần dư < 5 phút ngày là chỉ-ôn hoặc chỉ-bài-mới và luân phiên theo kế hoạch ngày liền trước (sau ngày chỉ-ôn thì ưu tiên bài mới); `paused` → không sinh kế hoạch (FR-012, SC-002) trong `backend/tests/unit/daily-plan.test.ts`
- [X] T037 [P] [US1] Kiểm thử hợp đồng cho `/auth/*` (gồm cờ `fromTrial`), `GET/PATCH /me`, `/onboarding`, `/onboarding/complete`, `/placement/submit`, `POST /path/rebuild` với `usePlacementResultId`, `/path`, `/today` trong `backend/tests/contract/us1.test.ts`
- [X] T038 [P] [US1] Kiểm thử tích hợp: đăng ký → onboarding bỏ qua placement → có lộ trình và `/today`; đăng ký email trùng; email sai định dạng/mật khẩu yếu trả lỗi cụ thể; đặt lại mật khẩu (liên kết dùng một lần, hết hạn 1 giờ, vô hiệu hóa mọi phiên); làm lại placement (US1.6, FR-009): kết quả mới `is_current`, kết quả cũ giữ làm lịch sử, chọn xây dựng lại → lộ trình mới `reason='placement_retake'`, chọn giữ → lộ trình không đổi, cả hai trường hợp không đụng `unit_progress`/`study_records`/`review_schedules` trong `backend/tests/integration/us1-onboarding.test.ts`

### Triển khai backend US1

- [X] T039 [P] [US1] Engine chấm placement và ước tính trình độ (R8) trong `backend/src/engine/placement.ts`
- [X] T040 [P] [US1] Engine lộ trình thuần hàm (R7): `buildPathParams` chọn điểm xuất phát (người mới/placement `none` → đơn vị `tier='foundation'` trước) và khoảng trình độ (cắt trần N3, trả `scopeNotice` khi trình độ/mục tiêu là N2/N1); `rankUnits(pathParams, profile, activeUnits, unitProgress, topicStats)` tính động thứ tự đơn vị, không lưu: lọc theo kỹ năng/`active`/chưa thành thạo/khoảng trình độ, chấm điểm theo `goal_tags`, `prioritized_skill`, `sequence`, mảng yếu; ước lượng đơn vị mới/ngày đến `target_date` chỉ để đánh giá tiến độ trong `backend/src/engine/path.ts`
- [X] T041 [US1] Engine kế hoạch ngày thuần hàm (R7): nhận danh sách mục ôn đã chọn làm tham số (US1 truyền rỗng; việc chọn và chia gói do T078), dành tối đa 60% `B` cho ôn, phần còn lại cho đơn vị mới có `est_minutes ≤` phần còn lại, tổng KHÔNG ĐƯỢC vượt `B`, không có bài ôn thì toàn bộ quỹ cho bài mới và ngược lại, khi phần dư sau 60% ôn < 5 phút thì luân phiên chỉ-ôn/chỉ-bài-mới theo kế hoạch ngày liền trước (research R7), không sinh khi `paused` trong `backend/src/engine/daily-plan.ts`
- [X] T042 [P] [US1] Repository người dùng/phiên/token đặt lại (Drizzle) trong `backend/src/db/repositories/users.ts`
- [X] T043 [US1] Dịch vụ xác thực: đăng ký (argon2id; từ chối `EMAIL_PENDING_DELETION` cho email đang chờ xóa), đăng nhập, làm mới refresh token xoay vòng 30 ngày (lưu SHA-256), tài khoản `disabled` bị từ chối khi đăng nhập/làm mới với 403 `ACCOUNT_DISABLED`, access token mang claim `status`, đăng xuất, yêu cầu/xác nhận đặt lại mật khẩu (token 256-bit, hết hạn 1 giờ, dùng một lần, phản hồi yêu cầu luôn giống nhau); nhận cờ `fromTrial` khi đăng ký và lưu vào `users.from_trial` (đo SC-011) trong `backend/src/services/auth.ts`
- [X] T044 [US1] Route `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password-reset/request`, `/auth/password-reset/confirm` trong `backend/src/api/auth.ts`
- [X] T045 [US1] Job gửi email đặt lại mật khẩu có thử lại qua pg-boss trong `backend/src/jobs/send-email.ts`
- [X] T046 [US1] Dịch vụ hồ sơ/onboarding: lưu `onboarding_draft` (bỏ dở/tiếp tục), validate `daily_minutes ∈ {5,10,15,30}`, `skills ⊆ {vocabulary, grammar}` không rỗng (từ chối mọi giá trị khác), `target_level` bắt buộc khi `goal_type='jlpt'`, `display_name` 1–60 ký tự; báo giới hạn nội dung N3 trước khi hoàn tất khi trình độ/mục tiêu là N2/N1 trong `backend/src/services/onboarding.ts`
- [X] T047 [US1] Route `GET/PUT /onboarding`, `POST /onboarding/complete` (sinh lộ trình từ hồ sơ + placement hiện hành với `reason='onboarding'`) trong `backend/src/api/onboarding.ts`; và tạo `backend/src/api/account.ts` với `GET /me` và `PATCH /me` (lưu trường hồ sơ cơ bản; hệ quả xây dựng lại lộ trình do T093 bổ sung, đổi mật khẩu/xóa/khôi phục do T111 bổ sung)
- [X] T048 [US1] Dịch vụ placement trong `backend/src/services/placement.ts` (chấm trên server bằng T039, lưu `placement_results` với `is_current`, giữ kết quả cũ làm lịch sử; hỗ trợ đính kèm câu trả lời từ dùng thử để chấm lại theo FR-039) và route `GET /placement/questions` (công khai, KHÔNG trả `correct_choice`), `POST /placement/submit` gọi dịch vụ này trong `backend/src/api/placement.ts`
- [X] T049 [US1] Dịch vụ lộ trình: tạo `learning_paths` (lưu `generated_from` và `reason`), đặt bản cũ `superseded`, không đụng `unit_progress`; route `GET /path` tính thứ tự đơn vị động qua `rankUnits` (T040) từ nội dung `active` trong bộ đệm, trả `reason`, `scopeNotice` trong `backend/src/services/path.ts`, `backend/src/api/path.ts`
- [X] T050 [US1] Dịch vụ kế hoạch ngày: sinh lười khi mở lần đầu trong ngày địa phương, chọn đơn vị mới qua `rankUnits` tại thời điểm sinh, idempotent theo `(user_id, local_date)`, lưu `daily_plans`/`daily_plan_items` (kế hoạch đã sinh không đổi khi nội dung đổi trong ngày); route `GET /today` trong `backend/src/services/daily-plan.ts`, `backend/src/api/daily.ts`
- [X] T051 [US1] Làm lại placement (US1.6): mở rộng `backend/src/services/placement.ts` để khi hoàn thành trả kết quả mới kèm lựa chọn xây dựng lại hay giữ lộ trình; tạo `POST /path/rebuild` nhánh có `usePlacementResultId` → lộ trình mới `reason='placement_retake'` (nhánh không tham số do T093 bổ sung); giữ nguyên lịch sử học và lịch ôn trong `backend/src/services/path.ts`, `backend/src/api/path.ts`

### Triển khai client US1

- [X] T052 [P] [US1] Repository auth và màn hình đăng ký/đăng nhập/quên mật khẩu/đặt lại mật khẩu (hiển thị lỗi cụ thể, gợi ý khôi phục khi `EMAIL_PENDING_DELETION`) trong `client/lib/data/auth_repository.dart`, `client/lib/presentation/auth/`
- [X] T053 [P] [US1] Màn hình onboarding nhiều bước (trình độ, mục tiêu, thời gian, mốc thời gian, kỹ năng; nghe, đọc, Kanji hiển thị là tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này"; tự lưu nháp; tiếp tục/làm lại; tự lấy timezone từ trình duyệt) trong `client/lib/presentation/onboarding/`
- [X] T054 [P] [US1] Màn hình placement (đồng hồ 10 phút, bỏ qua bất cứ lúc nào, hiển thị kết quả trình độ + mảng mạnh/yếu, lựa chọn xây dựng lại/giữ lộ trình khi làm lại) trong `client/lib/presentation/placement/`
- [X] T055 [US1] Màn hình lộ trình và màn hình "Hôm nay" cơ bản (hiển thị bài mới, bài ôn, tổng thời lượng; thông báo `scopeNotice` khi nội dung chỉ đến N3) trong `client/lib/presentation/path/`, `client/lib/presentation/today/`
- [X] T056 [US1] Chuỗi ngôn ngữ vi/en cho auth, onboarding, placement, path, today vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [X] T057 [US1] Kiểm thử tích hợp client luồng đăng ký → onboarding → thấy "Hôm nay" trên Chrome trong `client/integration_test/us1_onboarding_test.dart`

**Điểm kiểm tra**: US1 hoạt động độc lập – đây là MVP tối thiểu cùng US2

> **Ghi chú triển khai US1** (2026-11-04):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 173 kiểm thử đơn vị xanh (gồm placement, path, daily-plan trên hồ sơ đại diện, validation, bộ đệm TTL, token, email). Client `flutter analyze` sạch, `flutter test` 59 kiểm thử xanh, `flutter build web` thành công. Kịch bản T057 chạy xanh khi chạy như widget test (Flutter chưa hỗ trợ `integration_test` trên `flutter test -d chrome`; chạy trên Chrome cần `flutter drive` + chromedriver).
> - **T037 và T038 đã chạy xanh** (2026-11-04, khi hiện thực US2): chạy trên PostgreSQL 16 (UTF8) qua `TEST_DATABASE_URL`; lần chạy này phát hiện hợp đồng thiếu mã 422 của `PUT /onboarding` (đã bổ sung ở 1.6.0). Mã backend phụ thuộc CSDL (T042–T051) đã được kiểm chứng ở runtime.
> - Hợp đồng nâng lên 1.5.0: `GET /today` khai báo thêm 404 (chưa onboarding). API client sinh ra không đổi; không cần sinh lại.
> - `PATCH /me` mới lưu `displayName`, `language`, `timezone`, `dailyMinutes`; các trường còn lại trả 422 "Chưa hỗ trợ sửa trường này" cho tới T093/T111. `POST /path/rebuild` không tham số (`reason='rebuild_request'`) đã có sẵn trong T051; T093 chỉ còn phần tạm dừng/tiếp tục, thành thạo, đổi mục tiêu/trình độ.
> - `content-cache.ts` (một phần T066) đã có phần danh mục đơn vị cho `GET /path` và `GET /today`; T066 vẫn mở cho phần nội dung đã bản địa hóa của phiên học.
> - Client gửi `PUT /onboarding` và `POST /onboarding/complete` bằng JSON thủ công vì mô hình sinh ra tuần tự hóa `targetDate` thành date-time ISO, sai với `format: date`.

---

## Phase 4: US2 – Hoàn thành bài học ngắn hằng ngày (P1)

**Mục tiêu**: Học bài từ vựng/ngữ pháp có bài tập, phản hồi tức thì, tiếp tục dở dang, đánh dấu hoàn thành ngày.

**Kiểm thử độc lập**: Với lộ trình có sẵn, hoàn thành từng mục của kế hoạch hôm nay trong 5–15 phút, kết quả được ghi, ngày được đánh dấu hoàn thành (quickstart K3).

### Kiểm thử US2

- [X] T058 [P] [US2] Kiểm thử hợp đồng cho `/today/extra`, `/sessions`, `/sessions/{sessionId}/answers`, `/sessions/{sessionId}/intervals`, `/sessions/{sessionId}/complete` trong `backend/tests/contract/us2.test.ts`
- [X] T059 [P] [US2] Kiểm thử tích hợp: tiếp tục phiên dở dang không mất câu trả lời; hoàn thành mục cuối → `daily_plans.status='completed'`; sửa nội dung giữa chừng không đổi bài tập của phiên đang học (snapshot); "học thêm" không ghi đè kế hoạch mặc định trong `backend/tests/integration/us2-lesson.test.ts`
- [X] T060 [P] [US2] Kiểm thử đồng thời hai cửa sổ (FR-041, SC-012, quickstart K10) cho phần thuộc US2: (a) trùng `client_event_id` → một `study_records`/`study_intervals`; (b) cùng phiên, cùng bài tập, `client_event_id` khác → một bản ghi lượt chính, lần sau `duplicate=true`; (c) hai cửa sổ gửi khoảng thời gian chồng nhau → tổng thời gian = độ dài hợp (phần lịch ôn kiểm thử ở T075) trong `backend/tests/integration/concurrency.test.ts`

### Triển khai backend US2

- [X] T061 [US2] Dịch vụ phiên học: `POST /sessions` tạo `lesson_sessions` kèm `snapshot` bài tập đã bản địa hóa (R12), chỉ gồm mục/bài tập `active` (data-model §2.10), `kind ∈ {new_unit, review, extra}`; đặt `unit_progress.status='in_progress'` với phiên `new_unit`/`extra`; nếu đã có phiên `in_progress` cho cùng mục thì trả lại phiên đó (`kind='review'` chỉ dùng được đầy đủ từ T079 của US3) trong `backend/src/services/lesson-session.ts`
- [X] T062 [US2] Ghi câu trả lời idempotent: chấm phía server bằng `grading.ts`, `INSERT … ON CONFLICT DO NOTHING` theo `(user_id, client_event_id)` và theo `(session_id, exercise_id)` lượt chính, trả kết quả đã có kèm `duplicate=true` khi trùng, nhận `isRetry` (câu hỏi lại cuối phiên), trả phản hồi đúng/sai theo ngôn ngữ người học; route `POST /sessions/{sessionId}/answers` (lưu `local_date` theo timezone hồ sơ) trong `backend/src/api/sessions.ts`
- [X] T063 [US2] Ghi khoảng thời gian học idempotent: route `POST /sessions/{sessionId}/intervals` với CHECK `0 < duration_seconds ≤ 1800` trong `backend/src/api/sessions.ts`
- [X] T064 [US2] Hoàn thành phiên: chỉ đánh dấu hoàn thành sau khi mọi câu đã được server xác nhận; cập nhật `daily_plan_items` và `daily_plans.status/completed_at`, cập nhật `unit_progress.status='completed'`; route `POST /sessions/{sessionId}/complete` trả tóm tắt kết quả trong `backend/src/services/lesson-session.ts`, `backend/src/api/sessions.ts`
- [X] T065 [US2] Route `POST /today/extra`: trả thêm đơn vị kế tiếp (chọn qua `rankUnits`) ngoài kế hoạch, không ghi đè kế hoạch mặc định; khi hết nội dung phù hợp trả thông báo rõ ràng kèm gợi ý mảng kế tiếp trong `backend/src/api/daily.ts`
- [X] T066 [US2] Bộ đệm đọc nội dung đã bản địa hóa với TTL ≤ 60 giây (R13, R17, SC-008) trong `backend/src/services/content-cache.ts`

### Triển khai client US2

- [X] T067 [P] [US2] Hàng đợi sự kiện chưa gửi (lưu qua `LocalStore`, thử lại cùng `client_event_id`, UUID v4 sinh phía client) trong `client/lib/data/event_queue.dart`
- [X] T068 [P] [US2] Widget bài tập `multiple_choice`, `matching`, `fill_blank` với phản hồi đúng/sai tức thì trong `client/lib/presentation/lesson/exercises/`
- [X] T069 [US2] Màn hình bài học: phần giải thích từ vựng/ngữ pháp (chữ Nhật, cách đọc, nghĩa theo ngôn ngữ, ví dụ) → bài tập → hỏi lại câu sai một lần ở cuối phiên (gửi `isRetry=true`, R6) → tóm tắt; tiếp tục từ câu chưa trả lời; ghi khoảng thời gian học trong `client/lib/presentation/lesson/`
- [X] T070 [US2] Hoàn thiện màn hình "Hôm nay": mở/tiếp tục mục, trạng thái hoàn thành ngày, tóm tắt kết quả, nút "Học thêm", thông báo hết nội dung, xử lý mất kết nối (không báo hoàn thành khi chưa lưu) trong `client/lib/presentation/today/`
- [X] T071 [US2] Bổ sung chuỗi vi/en cho bài học vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [X] T072 [US2] Kiểm thử tích hợp client luồng học một đơn vị đến khi hoàn thành ngày trong `client/integration_test/us2_lesson_test.dart`

**Điểm kiểm tra**: US1 + US2 hoạt động – có thể demo MVP end-to-end

> **Ghi chú triển khai US2** (2026-11-04):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 298 kiểm thử xanh (190 đơn vị + 108 trên PostgreSQL 16 thật gồm hợp đồng `us2`, tích hợp `us2-lesson`, đồng thời `concurrency`). Client `flutter analyze` sạch, `flutter test` 80 kiểm thử xanh, `flutter build web` thành công; kịch bản T072 chạy xanh khi chạy như widget test (cùng cách với T057).
> - **Hợp đồng nâng lên 1.6.0** (bổ sung, không phá vỡ; đã sinh lại API client): `LessonSession` thêm `kind`, `title`; học thêm trả `PlanItem.id` là **id đơn vị** và client bắt đầu bằng `POST /sessions` với `planItemId` = id đó (phiên `kind='extra'`, không gắn mục kế hoạch); `POST /today/extra` thêm 409 `PATH_PAUSED` và 404 `CONTENT_EXHAUSTED` kèm `fields.suggestion` ∈ {`raise_level`, `add_skill`, `content_exhausted`}; payload bài tập `matching` cho người học là `left[]` + `right[]` (vế phải đã xáo) thay cho `pairs[]`; khai báo các mã 404/409/422 còn thiếu của `/sessions/*` (409 `SESSION_COMPLETED`).
> - Snapshot phiên học (R12) chứa đáp án và chỉ dùng phía server; dạng gửi cho người học không có `correct_index`/`accepted_answers`/`pairs`. `content-cache.ts` (T066) đệm snapshot đã bản địa hóa theo (đơn vị, ngôn ngữ) với cùng TTL 60 giây.
> - Phiên ôn tập (`review_batch`, `kind='review'`) chưa được hỗ trợ: `POST /sessions` trả 422 cho mục `review_batch` cho tới T079 (US3). Chỗ nối cập nhật lịch ôn (T077), thống kê mảng (T084) và độ khó thích ứng (T091) đã được đánh dấu trong `lesson-session.ts`.
> - Máy không có Docker; kiểm thử cần CSDL chạy trên PostgreSQL 16 nhúng (npm `embedded-postgres`, đặt ngoài kho mã) trỏ bằng `TEST_DATABASE_URL`.

---

## Phase 5: US3 – Ôn lại những gì sắp quên (P2)

**Mục tiêu**: Lặp lại ngắt quãng SM-2 biến thể, bài ôn đến hạn vào kế hoạch ngày.

**Kiểm thử độc lập**: Học một tập mục, trả lời đúng/sai khi ôn, ngày ôn kế tiếp khác nhau và mục đến hạn xuất hiện trong kế hoạch (quickstart K4).

### Kiểm thử US3

- [X] T073 [P] [US3] Kiểm thử đơn vị `srs.ts` đúng công thức R6 (lần đầu đúng: `interval=1`, `ease=2.3`, `repetitions=1`; đúng: `interval = repetitions==2 ? 3 : round(interval × ease)`, `ease = min(2.8, ease+0.05)`; sai: `lapses+1`, `repetitions=0`, `interval=1`, `ease = max(1.3, ease−0.2)`; mục khó khi `lapses ≥ 3` và độ chính xác gần đây < 60% thì `ease ≤ 2.0`) và kiểm tra SC-005 (mục sai ôn lại sớm hơn mục đúng) trên hồ sơ đại diện trong `backend/tests/unit/srs.test.ts`
- [X] T074 [P] [US3] Kiểm thử đơn vị chọn và chia gói ôn (T078): quá hạn lâu nhất và mục khó được ưu tiên; ước lượng theo `REVIEW_SECONDS_PER_ITEM`; mọi `daily_plan_items.est_minutes` ≤ 15; `B=30` với 100 mục đến hạn → 2 gói ôn 9 phút, tổng ≤ 30; `B=30` chỉ-ôn → 2 gói 15 phút; `B=5` nhiều bài ôn tồn đọng vẫn ≤ 5 phút, mục không vừa giữ nguyên `due_date`; mục `inactive` không được chọn (luân phiên chỉ-ôn/chỉ-bài-mới đã kiểm thử ở T036) (FR-024, FR-017, SC-002) trong `backend/tests/unit/daily-plan-review.test.ts`
- [X] T075 [P] [US3] Kiểm thử tích hợp: trả lời đúng/sai cập nhật `review_schedules` trong cùng giao dịch với `study_records` (khóa hàng `FOR UPDATE`), mục đến hạn xuất hiện trong `/today`; đồng thời (FR-041, SC-012, quickstart K10): hai phiên khác nhau cùng ôn một mục trong ngày → `review_schedules` chỉ cập nhật một lần (`last_reviewed_local_date`), câu `isRetry=true` không đổi lịch ôn; mục bị admin chuyển `inactive` không vào gói ôn nhưng dòng `review_schedules` vẫn còn trong `backend/tests/integration/us3-review.test.ts`

### Triển khai US3

- [X] T076 [P] [US3] Engine SRS thuần hàm theo R6 (gồm cờ `is_hard`) trong `backend/src/engine/srs.ts`
- [X] T077 [US3] Tích hợp cập nhật `review_schedules` vào luồng ghi câu trả lời (`due_date` = ngày địa phương + `interval`; chỉ cập nhật khi chèn `study_records` thành công; bỏ qua khi `is_retry` hoặc `last_reviewed_local_date` = hôm nay; khóa hàng) trong `backend/src/services/lesson-session.ts`, `backend/src/db/repositories/review.ts`
- [X] T078 [US3] Bổ sung gói ôn (`review_batch`) vào engine/dịch vụ kế hoạch ngày: chọn mục đến hạn sắp theo mức quá hạn, ưu tiên mục khó, bỏ qua mục `inactive` hoặc không còn bài tập `active` (data-model §2.16), giới hạn 60% `B`, ước lượng theo `REVIEW_SECONDS_PER_ITEM` và chia gói ≤ 15 phút (R7); mục đến hạn không vừa quỹ hôm nay giữ nguyên `due_date` để được ưu tiên hôm sau (việc dời lịch sau khoảng nghỉ do T092) trong `backend/src/engine/daily-plan.ts`, `backend/src/services/daily-plan.ts`
- [X] T079 [US3] Phiên ôn tập (`kind='review'`): tạo snapshot bài tập `active` từ `review_item_ids`, hoàn thành cập nhật `daily_plan_items` trong `backend/src/services/lesson-session.ts`
- [X] T080 [US3] Client: hiển thị mục ôn trong "Hôm nay" và màn hình ôn tập dùng lại widget bài tập, phản hồi tức thì, chuỗi vi/en trong `client/lib/presentation/review/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US3 hoạt động độc lập

> **Ghi chú triển khai US3** (2026-11-04):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 342 kiểm thử xanh (đơn vị + hợp đồng + tích hợp trên PostgreSQL nhúng qua `TEST_DATABASE_URL`, gồm `srs`, `daily-plan-review`, `us3-review`). Client `flutter analyze` sạch, `flutter test` 83 kiểm thử xanh (thêm `review_flow_test.dart`), `flutter build web` thành công. Hợp đồng `openapi.yaml` KHÔNG đổi (`AnswerResult.nextReviewDate` và `PlanItem.review_batch` đã có từ trước), nên không tăng phiên bản và không cần sinh lại API client.
> - **Cập nhật lịch ôn** (T077) nằm trong cùng giao dịch với `study_records` (`lesson-session.ts`): khóa tư vấn `(user, item)` rồi `SELECT … FOR UPDATE`, bỏ qua khi `is_retry`, bài tập không gắn mục, hoặc `last_reviewed_local_date ≥` ngày của câu trả lời. Áp dụng cho cả bài học mới lẫn phiên ôn (câu đúng đầu tiên của một mục đã tạo lịch `interval=1`). "Độ chính xác gần đây" của mục khó tính trên 10 câu lượt chính gần nhất của chính mục đó (`RECENT_ACCURACY_WINDOW`). `AnswerResult.nextReviewDate` trả ngày đến hạn mới (hoặc hiện có khi bỏ qua/gửi lại).
> - **Chọn và chia gói ôn** (T078): `rankDueItems` (mục khó trước, rồi quá hạn lâu nhất, rồi `itemId`) và `packReviewBatches` trong `engine/daily-plan.ts`; `listDueReviewItems` chỉ lấy mục `active` thuộc đơn vị `active` và còn bài tập `active`. Số gói `k = ceil(tổng phút / 15)`; nếu làm tròn lên khiến tổng vượt quỹ thì bỏ bớt mục ưu tiên thấp nhất. Mục không vừa quỹ giữ nguyên `due_date`. Dời lịch sau khoảng nghỉ vẫn thuộc T092 (US5).
> - **Phiên ôn** (T079): snapshot dựng từ `review_item_ids` bằng `buildReviewSnapshot` — mỗi mục đúng một bài tập `active`, chọn tất định theo (ngày kế hoạch, mục) nên các ngày khác nhau xoay vòng giữa các bài tập của mục; mục bị gỡ sau khi kế hoạch sinh ra bị bỏ qua, không còn mục nào thì 404 `NOT_FOUND`. `unit_progress` không bị đổi bởi phiên ôn.
> - **Client** (T080): `GET /today` đã hiển thị gói ôn từ US1; phiên `kind='review'` dùng lại `LessonController` nhưng bỏ phần giải thích, phản hồi kèm ngày ôn kế tiếp và có màn tóm tắt riêng (`presentation/review/review_view.dart`). `LessonPractice`, `LessonCompleteOffline`, `BackToTodayButton` được công khai hóa để dùng chung. Chuỗi `review*` thêm vào hai file ARB.
> - Máy không có Docker: kiểm thử `db` chạy trên PostgreSQL nhúng (npm `embedded-postgres`) trỏ bằng `TEST_DATABASE_URL`.

---

## Phase 6: US4 – Theo dõi tiến độ và mức đạt mục tiêu (P2)

**Mục tiêu**: Màn hình tiến độ: thời gian, số bài, độ chính xác ôn, chuỗi ngày, tiến độ mục tiêu, điểm yếu.

**Kiểm thử độc lập**: Sau vài ngày học, số liệu khớp hoạt động đã ghi; trạng thái trống rõ ràng cho người mới (quickstart K5).

### Kiểm thử US4

- [X] T081 [P] [US4] Kiểm thử đơn vị `difficulty.ts` trên các hồ sơ "liên tục < 60%" và "mảng yếu đã hồi phục" của T024: `topic_stats` trượt 20 câu, cờ `is_weak` khi accuracy < 60% với ≥ 8 câu và tự bỏ cờ khi ≥ 70%, câu `is_retry` không được tính trong `backend/tests/unit/difficulty-weakness.test.ts`
- [X] T082 [P] [US4] Kiểm thử hợp đồng cho `GET /progress` trong `backend/tests/contract/us4.test.ts`
- [X] T083 [P] [US4] Kiểm thử tích hợp: tổng thời gian = độ dài hợp các khoảng (chồng nhau chỉ tính một lần), chuỗi ngày theo `local_date` (bỏ qua ngày thuộc `pause_periods`, đúng cả khi tạm dừng rồi tiếp tục nhiều lần, không đứt khi đổi múi giờ), trạng thái trống cho người học mới, đúng/chậm tiến độ so với `target_date` trong `backend/tests/integration/us4-progress.test.ts`

### Triển khai US4

- [X] T084 [US4] Engine thống kê mảng (`topic_stats`: `recent_results`, `accuracy`, `is_weak`) trong `backend/src/engine/difficulty.ts` và cập nhật trong cùng giao dịch ghi câu trả lời (bỏ qua `is_retry`) tại `backend/src/services/lesson-session.ts`
- [X] T085 [US4] Dịch vụ tính Tóm tắt tiến độ (chế độ xem tính toán, không lưu): thời gian học (hợp các khoảng), bài đã hoàn thành (`unit_progress`), độ chính xác ôn (chỉ câu lượt chính), chuỗi ngày (R11, loại `pause_periods`), tỷ lệ nội dung mục tiêu đã xong (chỉ tính đơn vị `active`), cờ đúng tiến độ (FR-028), `scopeNotice`, danh sách mảng yếu trong `backend/src/services/progress.ts`
- [X] T086 [US4] Route `GET /progress` trong `backend/src/api/progress.ts`
- [X] T087 [US4] Client: màn hình tiến độ (chỉ số, tiến độ mục tiêu kèm `scopeNotice`, điểm yếu, trạng thái trống thân thiện), liên kết từ màn hình hằng ngày trong ≤ 2 lần nhấp (SC-007), chuỗi vi/en trong `client/lib/presentation/progress/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US4 hoạt động độc lập

> **Ghi chú triển khai US4** (2026-11-04):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 451 kiểm thử xanh (đơn vị + hợp đồng + tích hợp trên PostgreSQL nhúng qua `TEST_DATABASE_URL`, gồm `difficulty-weakness`, `progress-engine`, hợp đồng `us4`, tích hợp `us4-progress`). Client `flutter analyze` sạch, `flutter test` 109 kiểm thử xanh (thêm `progress_screen_test.dart`), `flutter build web` thành công.
> - **Thống kê mảng** (T084): `engine/difficulty.ts` (`recordAnswer`) ghi cửa sổ trượt 20 câu, `accuracy`, `is_weak` (< 60% với ≥ 8 câu, bỏ cờ khi ≥ 70%, ở khoảng [60%, 70%) giữ cờ hiện có) trong cùng giao dịch với `study_records`; chỉ chạy khi chèn bản ghi thành công nên gửi lại cùng `clientEventId` không đếm hai lần; câu `is_retry` bị bỏ qua. Khóa tư vấn theo `(user, mảng)` luôn được lấy trước khóa lịch ôn để các giao dịch đồng thời không khóa chéo nhau.
> - **Tóm tắt tiến độ** (T085/T086): `services/progress.ts` tính từ dữ liệu đã ghi, không lưu. Tổng thời gian là hợp các khoảng; `reviewAccuracy` chỉ tính câu lượt chính trong ngữ cảnh ôn (null khi chưa ôn); chuỗi ngày dùng `study_records.local_date` đã lưu (đổi múi giờ không làm đứt chuỗi, kể cả khi "hôm nay" lùi trước ngày học gần nhất) và bỏ qua `pause_periods`; `goal.completionRatio` = (hoàn thành + thành thạo) / đơn vị `active` trong khoảng trình độ lộ trình; tài khoản chưa onboarding nhận trạng thái trống (không lỗi).
> - **Quy tắc "đúng tiến độ"** (FR-028; spec chưa quy định công thức nên chọn công thức tất định, giải thích được): số ngày cần = `ceil(tổng phút đơn vị còn lại / (quỹ phút mỗi ngày × 40%))` (60% quỹ dành cho ôn, R7) so với số ngày còn lại đến `target_date`; không có mốc → `onTrack = null`; mốc đã qua mà còn nội dung → chậm. Chỉ để đánh giá, không làm kế hoạch ngày vượt quỹ. Hằng số nằm ở `engine/progress.ts` nên hiệu chỉnh sau dữ liệu thật mà không đổi hợp đồng.
> - **Client** (T087): `presentation/progress/progress_screen.dart` (4 chỉ số, tiến độ mục tiêu kèm `scopeNotice` và đúng/chậm tiến độ, điểm yếu, trạng thái trống); vào từ "Hôm nay" trong 1 lần nhấp (nút "Xem tiến độ" hoặc mục "Tiến độ" trên thanh điều hướng, SC-007).
> - Hợp đồng: không đổi phần US4 (`ProgressSummary` đã đủ); phiên bản nâng lên 1.7.0 chung với US5 (xem ghi chú US5).

---

## Phase 7: US5 – Tự điều chỉnh kế hoạch (P2)

**Mục tiêu**: Người học ghi đè hệ thống; lộ trình tự thích ứng theo kết quả và khoảng nghỉ.

**Kiểm thử độc lập**: Lần lượt đổi từng thiết lập, kế hoạch tiếp theo phản ánh thay đổi; bỏ vài ngày rồi quay lại thấy kế hoạch cân đối (quickstart K6).

### Kiểm thử US5

- [X] T088 [P] [US5] Kiểm thử đơn vị `difficulty.ts` trên các hồ sơ "liên tục < 60%" và "liên tục > 90%" của T024: < 60% liên tiếp 2 phiên → `difficulty_bias` −1 (giới hạn −2), > 90% liên tiếp 2 phiên → +1 (giới hạn +2), và đơn vị kế tiếp do `rankUnits` chọn dễ hơn/khó hơn tương ứng trong `backend/tests/unit/difficulty-bias.test.ts`
- [X] T088a [P] [US5] Kiểm thử đơn vị xử lý khoảng nghỉ trên hồ sơ "quay lại sau khoảng nghỉ" của T024: vắng ≥ 2 ngày (không tính ngày thuộc `pause_periods`) → kế hoạch vẫn ≤ 60% `B` cho ôn, mục quá hạn dư được dời dần qua các ngày sau mà giữ `due_date` gốc làm thứ tự ưu tiên, `DailyPlan.notice` mang mã `replanned_after_gap`, không có trường "nợ" (FR-015) trong `backend/tests/unit/daily-plan-gap.test.ts`
- [X] T089 [P] [US5] Kiểm thử hợp đồng cho `/path/rebuild`, `/path/pause`, `/path/resume`, `/path/units/{unitId}/master` (trả `MasterResult` khớp schema) và hệ quả của `PATCH /me` (đổi mục tiêu/`currentLevel` sinh lộ trình mới với `reason` tương ứng; đổi thời gian mỗi ngày không sinh lộ trình mới; đặt `prioritizedSkill` ảnh hưởng thứ tự đơn vị kế tiếp) trong `backend/tests/contract/us5.test.ts`
- [X] T090 [P] [US5] Kiểm thử tích hợp SC-006: mỗi ghi đè (mục tiêu, thời gian/ngày, tạm dừng/tiếp tục, ưu tiên kỹ năng, thành thạo, xây dựng lại) có hiệu lực trong kế hoạch kế tiếp; mỗi lần sinh lộ trình lưu đúng `reason`; xây dựng lại không đụng `unit_progress`/`study_records`/`review_schedules`/`topic_stats`; tạm dừng không sinh kế hoạch hay ngày bỏ lỡ; đánh dấu đơn vị cuối cùng → `remainingUnits=0` kèm `suggestion` đúng cho hồ sơ N5 (`raise_level`) và N3 (`content_exhausted`) trong `backend/tests/integration/us5-overrides.test.ts`

### Triển khai US5

- [X] T091 [US5] Hoàn thiện `difficulty.ts`: `consecutive_low/high`, `difficulty_bias` (−2..+2) và thêm đơn vị củng cố cho mảng yếu khi chọn đơn vị kế tiếp; nối vào luồng `POST /sessions/{sessionId}/complete` (T064): khi hoàn thành phiên, tính độ chính xác của phiên theo từng mảng và cập nhật `consecutive_low/high`, `difficulty_bias` trong cùng giao dịch trong `backend/src/engine/difficulty.ts`, `backend/src/engine/path.ts`, `backend/src/services/lesson-session.ts`
- [X] T092 [US5] Xử lý khoảng nghỉ (FR-015): phát hiện vắng ≥ 2 ngày (loại ngày thuộc `pause_periods`), lập lại kế hoạch ở mức xử lý được (dời dần mục quá hạn dư, giữ `due_date` gốc), đặt `DailyPlan.notice` = `replanned_after_gap`, không hiển thị "nợ" trong `backend/src/engine/daily-plan.ts`, `backend/src/services/daily-plan.ts`
- [X] T093 [US5] Dịch vụ ghi đè: bổ sung nhánh không tham số của `POST /path/rebuild` (`reason='rebuild_request'`; nhánh `usePlacementResultId` → `placement_retake` đã có từ T051), `POST /path/pause` và `POST /path/resume` (mở/đóng `pause_periods` trong cùng giao dịch), `PUT /path/units/{unitId}/master` (đặt/bỏ `unit_progress.status='mastered'`, loại đơn vị khỏi bài sắp tới; trả `MasterResult` với `remainingUnits` tính qua `rankUnits`, khi bằng 0 trả `suggestion` = `raise_level` nếu còn trình độ cao hơn trong N5–N3, ngược lại `content_exhausted`), ưu tiên kỹ năng (trường `prioritizedSkill` của `PATCH /me`, không có route riêng); qua `PATCH /me`: đổi mục tiêu sinh lộ trình mới với `reason='goal_change'`, đổi `currentLevel` sau onboarding sinh lộ trình mới với `reason='level_change'`, đổi `daily_minutes` áp dụng trực tiếp cho kế hoạch kế tiếp (bổ sung vào route `PATCH /me` đã tạo ở T047) trong `backend/src/services/path.ts`, `backend/src/api/path.ts`, `backend/src/api/account.ts`
- [X] T094 [US5] Client: màn hình điều chỉnh kế hoạch (đổi mục tiêu/thời gian, tạm dừng/tiếp tục, ưu tiên kỹ năng, đánh dấu thành thạo, xây dựng lại có xác nhận, nghe/đọc/Kanji hiển thị là tùy chọn bị khóa như T053; khi đánh dấu đơn vị cuối cùng còn lại thì hiển thị hộp thoại xác nhận, sau khi nhận `suggestion` thì đưa ra lựa chọn nâng trình độ hoặc làm lại placement (`raise_level`) hoặc thông báo hết nội dung (`content_exhausted`)), chuỗi vi/en trong `client/lib/presentation/path/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US5 hoạt động độc lập

> **Ghi chú triển khai US5** (2026-11-04):
> - Đã kiểm chứng cùng đợt với US4 (backend 451 kiểm thử xanh gồm `difficulty-bias`, `daily-plan-gap`, hợp đồng `us5`, tích hợp `us5-overrides`; client 109 kiểm thử xanh gồm `plan_adjust_test.dart`).
> - **Hợp đồng nâng lên 1.7.0** (bổ sung/làm rõ, không phá vỡ; API client sinh ra không đổi nên không cần sinh lại): khai báo mã 404/422 còn thiếu của `POST /path/rebuild`, `POST /path/pause`, `POST /path/resume`, `PUT /path/units/{unitId}/master`; làm rõ `MasterResult.remainingUnits` là số đơn vị còn có thể học (chưa học hoặc đang học dở, chưa thành thạo) và `suggestion` chỉ có khi `remainingUnits = 0`; làm rõ 422 của `PATCH /me`. `tests/contract/helper.ts` coi thành ngữ `nullable: true` + `allOf: [$ref]` là cho phép `null` (cần cho `ProfileUpdate.prioritizedSkill: null` = bỏ ưu tiên).
> - **Độ khó thích ứng** (T091): `applySessionAccuracy` đếm số phiên liên tiếp độ chính xác < 60% / > 90% theo từng mảng; từ phiên thứ 2 cùng chiều mỗi phiên tiếp theo đổi `difficulty_bias` thêm 1 bậc, chặn trong [−2, +2]. Phiên có dưới 3 câu của mảng (`MIN_SESSION_ANSWERS`) bị bỏ qua vì không đủ căn cứ (phiên ôn chỉ chạm 1–2 câu mỗi mảng). Cập nhật trong cùng giao dịch `POST /sessions/{id}/complete`; gọi lại trên phiên đã xong không đếm lần hai. `rankUnits` đã có sẵn trọng số bias và cộng điểm cho mảng yếu (củng cố) nên không đổi.
> - **Khoảng nghỉ** (T092): vắng ≥ 2 ngày (số ngày trong `(ngày học gần nhất, hôm nay]` không thuộc `pause_periods`; người chưa từng học không có khoảng nghỉ) → `DailyPlan.notice = 'replanned_after_gap'`. Việc "dời dần" không cần ghi gì: kế hoạch đã bị chặn bởi 60% quỹ cho ôn và mục dư giữ nguyên `due_date` gốc nên tự được ưu tiên ở các ngày sau (kiểm thử xác nhận `review_schedules` không đổi); kế hoạch không có trường "nợ".
> - **Ghi đè** (T093): `pause`/`resume` mở/đóng `pause_periods` cùng `learning_profiles.paused` trong một giao dịch và idempotent; `PUT /path/units/{id}/master` bỏ đánh dấu thì trả về `completed` nếu từng hoàn thành một phiên, ngược lại xóa dòng; `suggestion` = `raise_level` khi khoảng trình độ lộ trình chưa chạm trần N3, ngược lại `content_exhausted`. `PATCH /me` mở rộng: đổi `goalType`/`targetLevel`/`targetDate` (giá trị thật sự khác) → lộ trình mới `goal_change` (giữ placement đang dùng); đổi `currentLevel` → `level_change` (bỏ placement vì người học tự khai báo lại trình độ); cả hai → `goal_change`; `dailyMinutes`/`prioritizedSkill` chỉ lưu (kế hoạch ngày hôm nay đã sinh lúc hoàn tất onboarding/mở app nên có hiệu lực từ kế hoạch kế tiếp). Mục tiêu khác JLPT không giữ `targetLevel`; `targetDate` mới phải từ hôm nay; `prioritizedSkill` phải nằm trong `skills`; các trường lộ trình trước khi hoàn tất onboarding trả 422. Đổi email/`currentPassword` vẫn chờ T111.
> - **Client** (T094): `presentation/path/plan_adjust_screen.dart` (route `/path/adjust`: mục tiêu + mốc, thời gian mỗi ngày, ưu tiên kỹ năng, tạm dừng/tiếp tục, xây dựng lại có xác nhận; nghe/đọc/Kanji là tùy chọn bị khóa như T053). Đánh dấu "đã thành thạo" nằm ngay trên từng đơn vị ở màn hình Lộ trình (kèm hộp thoại xác nhận khi là đơn vị cuối cùng và hộp thoại gợi ý nâng trình độ / làm lại placement / hết nội dung sau khi nhận `suggestion`). "Hôm nay" khi đang tạm dừng có nút "Tiếp tục lộ trình". `PATCH /me` gửi JSON thủ công (mô hình sinh ra sai định dạng `targetDate`, không gửi được `null` tường minh).
> - Máy không có Docker: kiểm thử `db` chạy trên PostgreSQL nhúng (npm `embedded-postgres`, đặt ngoài kho mã) trỏ bằng `TEST_DATABASE_URL`.

---

## Phase 8: US8 – Dùng thử khi chưa đăng ký (P2)

**Mục tiêu**: Khách học bài mẫu và làm placement mà không đăng ký, không lưu dữ liệu định danh trên server, mang kết quả placement sang onboarding.

**Kiểm thử độc lập**: Chưa đăng nhập, hoàn thành bài mẫu + placement, không có lộ trình/kế hoạch nào được tạo; đăng ký rồi kết quả placement được mang sang (quickstart K9).

### Kiểm thử US8

- [X] T095 [P] [US8] Kiểm thử hợp đồng cho `GET /trial/content`, `POST /trial/placement/grade`, `POST /trial/events` (ghi chú: `/placement/questions` đã thuộc T037/T048) trong `backend/tests/contract/us8.test.ts`
- [X] T096 [P] [US8] Kiểm thử tích hợp: endpoint dùng thử không ghi bản ghi định danh nào vào CSDL (chỉ tăng các bộ đếm ẩn danh `trial_content_loaded`, `trial_lesson_completed`, `trial_placement_completed`, `trial_placement_level_*`; từ chối tên metric ngoài danh sách; `POST /trial/events` không nhận dữ liệu nào khác ngoài tên sự kiện), bị rate-limit khi vượt ngưỡng (60/phút và 10/phút), không ghi IP vào CSDL (FR-038, FR-040); mang kết quả sang (FR-039): đăng ký với `fromTrial=true` rồi gửi `placementAnswers` dùng thử tới `POST /placement/submit` → server chấm lại, lưu `placement_results` `is_current` và `POST /onboarding/complete` dùng kết quả đó (`generated_from.placement_result_id`); bỏ kết quả rồi làm lại thì kết quả mới thay thế trong `backend/tests/integration/us8-trial.test.ts`

### Triển khai US8

- [X] T097 [US8] Route công khai chỉ đọc `GET /trial/content` trả đơn vị `is_trial=true` (mặc định 2 đơn vị: 1 từ vựng + 1 ngữ pháp, mỗi đơn vị 5 phút, tổng ≤ 10 phút) kèm đáp án để client tự chấm, bản địa hóa theo tham số ngôn ngữ; tăng bộ đếm ẩn danh `trial_content_loaded` qua repository ở T098a (không lưu IP, SC-011) trong `backend/src/api/trial.ts`
- [X] T098 [US8] Route `POST /trial/placement/grade` chấm không lưu, không ghi nhật ký định danh; tăng bộ đếm ẩn danh `trial_placement_completed` và `trial_placement_level_<mức>` trong `backend/src/api/trial.ts`
- [X] T098a [US8] Route công khai `POST /trial/events` (body chỉ `{event: lesson_completed}`) tăng bộ đếm `trial_lesson_completed`; và repository tăng bộ đếm `aggregate_daily_stats` (upsert `(day, metric)`, danh sách metric cố định) trong `backend/src/api/trial.ts`, `backend/src/db/repositories/aggregate-stats.ts`
- [X] T099 [P] [US8] Client: trạng thái dùng thử (`trialProgress`, `trialAnswers`, `placementAnswers`, `startedAt`) lưu qua `LocalStore`, chịu được việc mất dữ liệu trình duyệt và cho dùng thử lại từ đầu trong `client/lib/presentation/trial/trial_state.dart`
- [X] T100 [US8] Client: trang đầu với nút "Dùng thử" (≤ 3 lần nhấp tới bài mẫu), bài mẫu chấm phía client với phản hồi tức thì, gọi `POST /trial/events` một lần khi hoàn thành bài mẫu, placement dùng thử, màn hình hết nội dung dùng thử mời đăng ký, giải thích + lời mời đăng ký khi vào tính năng cần tài khoản, hỗ trợ vi/en trong `client/lib/presentation/trial/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [X] T101 [US8] Client: khi đăng ký trên cùng trình duyệt, gửi `placementAnswers` (không phải kết quả) sang onboarding để server chấm lại qua `POST /placement/submit`; cho phép bỏ kết quả để làm lại; không mang sang khi trình duyệt khác (FR-039); gửi `fromTrial=true` khi đăng ký ngay sau dùng thử (SC-011) trong `client/lib/presentation/onboarding/`, `client/lib/data/auth_repository.dart`

**Điểm kiểm tra**: US1–US5 và US8 hoạt động độc lập

> **Ghi chú triển khai US8** (2026-11-04):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 475 kiểm thử xanh (đơn vị + hợp đồng + tích hợp trên PostgreSQL nhúng qua `TEST_DATABASE_URL`, gồm `trial` (đơn vị), hợp đồng `us8`, tích hợp `us8-trial`). Client `flutter analyze` sạch, `flutter test` 124 kiểm thử xanh (thêm `trial_flow_test.dart`, 15 kiểm thử), `flutter build web` thành công.
> - **Hợp đồng nâng lên 1.8.0** (bổ sung/làm rõ, không phá vỡ; đã sinh lại API client): `TrialContent.answerKey` mô tả cụ thể theo loại bài tập (`correctIndex` | `pairs` | `acceptedAnswers`) nên mô hình sinh ra có kiểu thay cho `Object?`; làm rõ 422 của `POST /trial/events`; sửa lỗi cú pháp YAML sẵn có ở `MasterResult.remainingUnits.description` (dấu phẩy trong flow mapping khiến OpenAPI Generator từ chối spec; parser `yaml` của kiểm thử vẫn đọc được nên lỗi không lộ sớm).
> - **Backend**: `api/trial.ts` đăng ký `GET /trial/content`, `POST /trial/placement/grade`, `POST /trial/events` (không xác thực; rate-limit gắn theo đường dẫn ở T018). `services/trial.ts` chọn tập dùng thử (mỗi kỹ năng một đơn vị `is_trial`, ưu tiên ngắn rồi `sequence`, tổng ≤ 10 phút) và dựng bài tập từ snapshot đã bản địa hóa của `content-cache` (cùng TTL 60 giây). `db/repositories/aggregate-stats.ts` upsert nguyên tử `(day, metric)` theo danh sách metric cố định (`TRIAL_METRICS`), từ chối tên lạ; ngày tính theo UTC của đồng hồ tiêm vào. Thân `POST /trial/events` dùng `z.strictObject` nên mọi trường ngoài `event` bị 422. Kiểm thử xác nhận không bảng nào ngoài `aggregate_daily_stats` đổi số dòng và không bảng nào chứa IP khách.
> - **Client**: `domain/trial_grading.dart` chấm cục bộ (chuẩn hóa chỉ xử lý ký tự toàn chiều ASCII vì Dart không có NFKC; khác biệt này chỉ ảnh hưởng phản hồi bài mẫu). `presentation/trial/trial_state.dart` giữ `TrialState` qua `LocalStore` (khóa `trial.state.v1`; dữ liệu hỏng/lạ phiên bản → trạng thái trống; lỗi ghi bị nuốt). Màn hình: `/trial` (trang dùng thử), `/trial/lesson`, `/trial/finished`, `/trial/placement` (dùng lại `PlacementScreen` với `PlacementOrigin.trial`), `/trial/account-required?feature=…`. Từ trang đầu tới bài mẫu: "Dùng thử" → "Bắt đầu bài mẫu" → "Bắt đầu làm bài tập" (3 lần nhấp). `LessonItemCard` và `LessonFeedback` được công khai hóa để dùng chung với bài học thật.
> - **Mang kết quả sang (T101)**: đăng ký gửi `fromTrial=true` khi trình duyệt còn hoạt động dùng thử (hoặc cờ truyền vào); onboarding gửi `placementAnswers` đã lưu tới `POST /placement/submit` để server chấm lại (lưu `is_current`), hiển thị như kết quả có sẵn (dùng/bỏ/làm lại như US1), rồi xóa trạng thái dùng thử khỏi trình duyệt. Trình duyệt khác không có dữ liệu nên không mang gì sang. Gọi `POST /placement/submit` lỗi thì giữ nguyên câu trả lời và để người học làm lại hoặc bỏ qua.
> - Máy không có Docker: kiểm thử `db` chạy trên PostgreSQL nhúng (npm `embedded-postgres`, đặt ngoài kho mã) trỏ bằng `TEST_DATABASE_URL`.

---

## Phase 9: US6 – Quản trị nội dung và người dùng (P3)

**Mục tiêu**: Admin quản lý nội dung và tài khoản mà không cần phát hành client.

**Kiểm thử độc lập**: Admin thêm/sửa một mục từ vựng và một bài ngữ pháp, người học thấy thay đổi ≤ 5 phút; admin xem/vô hiệu hóa tài khoản; người học thường bị từ chối (quickstart K7).

### Kiểm thử US6

- [X] T102 [P] [US6] Kiểm thử hợp đồng cho `/admin/*` trong `backend/tests/contract/us6.test.ts`
- [X] T103 [P] [US6] Kiểm thử tích hợp: người học thường nhận 403 ở mọi `/admin/*`; kích hoạt đơn vị thiếu bản dịch/bài tập bị từ chối; kích hoạt đơn vị mới → xuất hiện trong `GET /path` và chọn được qua `POST /today/extra` của người học phù hợp sau TTL bộ đệm (≤ 60 giây), không xuất hiện ở người học khác kỹ năng, kế hoạch hôm nay đã sinh không đổi (SC-008); sửa đơn vị bỏ một mục/bài tập khỏi payload → phần tử đó thành `inactive`, `study_records`/`review_schedules` liên quan vẫn còn và hợp lệ, phiên mới không chứa phần tử đó; `PUT /admin/placement-questions/active-set` với số câu sai theo trình độ trả 422 `PLACEMENT_SET_INVALID` và bộ hiện hành không đổi; vô hiệu hóa người dùng → đăng nhập và refresh trả 403 `ACCOUNT_DISABLED`, kích hoạt lại thì đăng nhập được; mỗi thay đổi ghi `admin_action_logs` (ai, khi nào, diff đã loại thông tin nhạy cảm); phiên đang học không bị đổi trong `backend/tests/integration/us6-admin.test.ts`

### Triển khai US6

- [X] T104 [US6] Dịch vụ nội dung admin: tạo/sửa/kích hoạt-vô hiệu hóa/sắp xếp đơn vị học; mục nội dung và bài tập được tạo/sửa lồng trong payload `AdminUnitWrite` của đơn vị (không có route riêng, đúng openapi): phần tử có `id` cập nhật tại chỗ, không có `id` tạo mới, phần tử hiện có vắng mặt chuyển `inactive`, KHÔNG xóa cứng (data-model §2.10); gắn cờ `is_trial`; chạy quy tắc kiểm tra T014 khi kích hoạt; ghi `admin_action_logs` trong `backend/src/services/content.ts`
- [X] T105 [US6] Route `GET/POST /admin/units`, `GET/PUT /admin/units/{unitId}`, `PUT /admin/units/{unitId}/status` (`POST`/`PUT` nhận cả mục nội dung và bài tập của đơn vị trong cùng payload; FR-030) trong `backend/src/api/admin/units.ts`
- [X] T106 [US6] Route `GET/POST /admin/placement-questions`, `PUT /admin/placement-questions/{questionId}` (sửa nội dung/position) và `PUT /admin/placement-questions/active-set` (kích hoạt nguyên tử, kiểm tra đúng 20 câu 8/6/6, trả `PLACEMENT_SET_INVALID`); mỗi thay đổi ghi `admin_action_logs` trong `backend/src/api/admin/placement.ts`
- [X] T107 [US6] Route `GET /admin/users` (tìm kiếm, xem trạng thái), `PUT /admin/users/{userId}/status` (vô hiệu hóa/kích hoạt lại; vô hiệu hóa thu hồi mọi `auth_sessions` trong cùng giao dịch, access token đã cấp còn hiệu lực tối đa 15 phút theo R4; tài khoản `disabled` không thể tự khôi phục; ghi `admin_action_logs`), `GET /admin/action-logs` trong `backend/src/api/admin/users.ts`
- [X] T108 [P] [US6] Client: các màn hình `/admin/*` (danh sách/soạn đơn vị học gồm `tier`, mục, bài tập, câu hỏi placement, chọn và kích hoạt bộ câu hỏi placement, danh sách người dùng, nhật ký hành động), ẩn UI theo vai trò nhưng bảo vệ thực sự ở server, chuỗi vi/en trong `client/lib/presentation/admin/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: Quản trị hoạt động độc lập

> **Ghi chú triển khai US6** (2026-11-05):
> - Đã kiểm chứng: backend `tsc`, `eslint`, `prettier` sạch; 508 kiểm thử xanh (475 cũ + 33 mới: hợp đồng `us6` 14, tích hợp `us6-admin` 19 trên PostgreSQL 16 nhúng qua `TEST_DATABASE_URL`). Client `flutter analyze` sạch, `flutter test` 144 kiểm thử xanh (thêm `admin_unit_draft_test.dart` 8, `admin_flow_test.dart` 12), `flutter build web` thành công.
> - **Hợp đồng nâng lên 1.9.0** (bổ sung/làm rõ, không phá vỡ): thêm `GET /admin/topics` (`adminListTopics`) – hợp đồng 1.8.0 bắt `topicId` khi soạn đơn vị/câu hỏi nhưng không có cách liệt kê mảng; bài tập trong `AdminUnitWrite` thêm `itemIndex` (chỉ số mục trong `items` cùng payload) – thiếu nó bài tập admin tạo không gắn được `exercises.item_id` nên không vào lịch ôn; `AdminPlacementQuestion` thêm `hint` và trường bắt buộc khi ghi; `AdminUserPage.items[].role`; `AdminActionLog.diff` và `targetId` nullable (thao tác trên cả bộ câu hỏi); `GET /admin/action-logs` trả con trỏ ở header `X-Next-Cursor` (thân vẫn là mảng, không phá vỡ); khai báo mã 404/422 còn thiếu. **API client Dart chưa sinh lại**: client admin gọi `dio` với JSON trực tiếp (thân `AdminUnitWrite` có `payload` tự do theo loại bài tập, và cần đọc header phân trang), nên các trường mới không ảnh hưởng mã sinh ra hiện có.
> - **Sửa nội dung** (T104): phần tử có `id` cập nhật tại chỗ, không có `id` tạo mới, phần tử hiện có vắng mặt chuyển `inactive` (xếp sau cùng để thứ tự đọc lại khớp thứ tự ghi), không xóa cứng. Danh sách `items`/`exercises` **vắng mặt** nghĩa là giữ nguyên (khác danh sách rỗng = gỡ hết); `goalTags`/`tier`/`sequence` vắng mặt giữ giá trị cũ. Đơn vị mới luôn là `draft`; quy tắc nội dung T014 chỉ bắt buộc khi kích hoạt và khi sửa đơn vị đang `active` (không đạt thì hoàn tác cả lần sửa, 422 kèm `fields` theo vị trí như `items[0].reading`). Mảng phải khớp kỹ năng + trình độ; chỉ đổi `kind` khi còn là bản nháp. Mỗi thay đổi ghi `admin_action_logs` (diff trường đã đổi và id phần tử tạo/sửa/ẩn) cùng giao dịch, sau đó làm mất hiệu lực bộ đệm nội dung của tiến trình (SC-008: người học thấy ngay hoặc chậm nhất sau TTL 60 giây; phiên đang học giữ snapshot).
> - **Bộ câu hỏi placement** (T106): `active-set` chạy trong một giao dịch với khóa tư vấn `pg_advisory_xact_lock` (hai lần kích hoạt đồng thời không bao giờ để lại hơn 20 câu hoạt động – có kiểm thử), kiểm tra đúng 20 câu phân biệt tồn tại và 8/6/6, sai thì 422 `PLACEMENT_SET_INVALID` kèm `fields` theo trình độ và giữ nguyên bộ cũ; `position` = thứ tự mảng từ 1. Câu đang thuộc bộ hiện hành sửa được nội dung nhưng không đổi `level` (422 `PLACEMENT_SET_INVALID`) và không trùng `position` với câu khác của bộ. Câu tạo mới luôn chưa kích hoạt.
> - **Người dùng** (T107): chỉ đổi trạng thái tài khoản người học đang `active`/`disabled`, không phải của chính admin, tài khoản admin hay đang `pending_deletion` (422); gọi lại với trạng thái hiện có là idempotent và không ghi nhật ký thừa; vô hiệu hóa thu hồi mọi `auth_sessions` cùng giao dịch, nhật ký chỉ ghi `{status: {from, to}}`. **Sửa `refresh`** (`services/auth.ts`): kiểm tra tài khoản `disabled` trước khi xét phiên đã thu hồi, vì admin thu hồi hết phiên nên trước đây refresh của tài khoản bị vô hiệu hóa trả 401 thay vì 403 `ACCOUNT_DISABLED` đúng hợp đồng. Phân trang người dùng/nhật ký theo con trỏ là id của dòng cuối (so sánh `(thời gian, id)` ngay trong CSDL, không mất độ chính xác micro giây).
> - **Hạ tầng kiểm thử**: `tests/contract/helper.ts` khớp mẫu đường dẫn tĩnh trước mẫu có tham số (`/admin/placement-questions/active-set` không còn bị coi là `/{questionId}`).
> - **Client** (T108): `/admin` → `/admin/units`; bốn mục `units` (danh sách, lọc, kích hoạt/vô hiệu hóa, cờ dùng thử), `units/new` và `units/:id` (trình soạn mục + bài tập; mục/bài tập đã có chỉ có công tắc "hiển thị với người học", không có nút xóa; đáp án có dạng chuỗi thuần soạn bằng form, dạng nâng cao như lựa chọn song ngữ rơi về JSON thô để không mất dữ liệu), `placement` (chọn bộ với bộ đếm 8/6/6, nút kích hoạt chỉ bật khi đủ), `users`, `logs`. Chuỗi vi/en: 122 khóa `admin*`. Việc ẩn UI theo vai trò chỉ là tiện lợi, quyền thật do server kiểm tra.
> - Máy không có Docker: kiểm thử `db` chạy trên PostgreSQL 16 nhúng (npm `embedded-postgres`, đặt ngoài kho mã) trỏ bằng `TEST_DATABASE_URL`.

---

## Phase 10: US7 – Quản lý hồ sơ, ngôn ngữ và tài khoản (P3)

**Mục tiêu**: Sửa hồ sơ, đổi ngôn ngữ vi/en, xóa/khôi phục tài khoản với 30 ngày chờ.

**Kiểm thử độc lập**: Đổi ngôn ngữ/hồ sơ được lưu; xóa tài khoản chặn đăng nhập, khôi phục trong 30 ngày, quá hạn thì xóa vĩnh viễn (quickstart K8).

### Kiểm thử US7

- [X] T109 [P] [US7] Kiểm thử hợp đồng cho `PUT /me/password`, `/account/delete`, `/account/restore` trong `backend/tests/contract/us7.test.ts`
- [X] T110 [P] [US7] Kiểm thử tích hợp: xóa → `pending_deletion` chặn truy cập dữ liệu; token mới cấp sau khi xóa chỉ gọi được `/account/restore`, `/auth/logout`; phiên khác dùng access token cấp trước khi xóa vẫn truy cập được đến khi token hết hạn (Clock giả lập +15 phút → 401) theo FR-003 đã làm rõ; đăng nhập chỉ cho phép khôi phục trong 30 ngày; đăng ký lại email đang chờ xóa bị từ chối `EMAIL_PENDING_DELETION`; job xóa cứng quá 30 ngày cascade toàn bộ dữ liệu cá nhân và chỉ giữ `aggregate_daily_stats`; đổi ngôn ngữ đổi nội dung bản địa hóa; đổi email thiếu/sai `currentPassword` → 401, trùng tài khoản khác → 409 `EMAIL_TAKEN`, trùng tài khoản chờ xóa → 409 `EMAIL_PENDING_DELETION`; `PUT /me/password` thu hồi mọi phiên khác, giữ phiên hiện tại trong `backend/tests/integration/us7-account.test.ts`

### Triển khai US7

- [X] T111 [US7] Dịch vụ tài khoản: sửa hồ sơ phần không ảnh hưởng lộ trình (tên hiển thị, email, ngôn ngữ, timezone; mục tiêu, trình độ, thời gian/ngày và kỹ năng ưu tiên đã do T093 xử lý, KHÔNG cài lại); đổi email bắt buộc `currentPassword`, từ chối `EMAIL_TAKEN`/`EMAIL_PENDING_DELETION` (data-model §2.1); đổi mật khẩu thu hồi mọi phiên khác; xóa (đặt `pending_deletion` và `deletion_requested_at`, thu hồi phiên; phản hồi `POST /account/delete` yêu cầu client xóa token ngay trong phiên hiện tại), khôi phục trong 30 ngày; mở rộng `PATCH /me` (đã có từ T047) và thêm route `PUT /me/password`, `POST /account/delete`, `POST /account/restore` trong `backend/src/services/account.ts`, `backend/src/api/account.ts`
- [X] T112 [US7] Job pg-boss hằng ngày xóa cứng `users` có `status='pending_deletion' AND deletion_requested_at < now() - interval '30 days'` (cascade) và ghi thống kê tổng hợp ẩn danh vào `aggregate_daily_stats` trong `backend/src/jobs/purge-deleted-accounts.ts`
- [X] T113 [P] [US7] Client: màn hình hồ sơ (sửa thông tin, đổi email yêu cầu nhập mật khẩu hiện tại, đổi mật khẩu, chọn ngôn ngữ vi/en áp dụng ngay cho giao diện), xóa tài khoản có xác nhận, lời mời khôi phục khi đăng nhập tài khoản đang chờ xóa, chuỗi vi/en trong `client/lib/presentation/profile/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

> **Ghi chú triển khai Phase 10** (2026-11-05):
> - **Hợp đồng** `openapi.yaml` lên 1.10.0 (bổ sung, không phá vỡ): khai báo 422 cho `PUT /me/password`, 401/422 cho `POST /account/delete` (`permanentDeletionAt` bắt buộc), 401 và mã lỗi mới `ACCOUNT_DELETED` (410) cho `POST /account/restore`. Mã lỗi mới được thêm vào `ERROR_CODES`.
> - **Dịch vụ** (T111, `services/account.ts`): đổi email gộp vào giao dịch của `PATCH /me` (kiểm tra mật khẩu hiện tại → 401, email trùng → 409; email được chuẩn hóa chữ thường, gửi lại đúng email hiện tại là no-op); `PUT /me/password` thu hồi phiên khác theo `sid` của token và vô hiệu hóa liên kết đặt lại còn hiệu lực; xóa thu hồi MỌI phiên (kể cả phiên hiện tại); khôi phục idempotent. Access token của tài khoản vừa khôi phục vẫn mang `status='pending_deletion'` đến khi hết hạn nên client PHẢI gọi `/auth/refresh` ngay sau đó.
> - **Job xóa cứng** (T112, `jobs/purge-deleted-accounts.ts`): cron hằng ngày 03:17 UTC, dùng `Clock` tiêm vào để kiểm thử (+31 ngày), xóa và ghi bộ đếm ẩn danh `accounts_purged` trong cùng một giao dịch; ngưỡng dùng `<=` 30 ngày để khớp `isDeletionGraceOver` (không có khoảng hở giữa lúc đăng nhập bị chặn và lúc dữ liệu bị xóa). Lệnh chạy tay `pnpm job:purge` (quickstart K8.4).
> - **Client** (T113): `/profile` (tên hiển thị, ngôn ngữ vi/en áp dụng ngay và hoàn tác nếu lưu lỗi, đổi email/mật khẩu, lối tắt tới điều chỉnh kế hoạch, đăng xuất, xóa tài khoản có xác nhận) và `/restore-account` (khôi phục → làm mới token → vào "Hôm nay"; 410 chỉ còn nút đăng xuất). `languageSyncProvider` đồng bộ ngôn ngữ giao diện với `profile.language` khi đăng nhập/mở lại ứng dụng/khôi phục. 37 khóa `profile*`/`restore*` ở cả vi và en.
> - Mã client sinh từ OpenAPI chưa được sinh lại cho 1.10.0 (chỉ khác `permanentDeletionAt` bắt buộc trong phản hồi xóa; client đã xử lý cả hai trường hợp).
> - Máy không có Docker: kiểm thử `db` chạy trên PostgreSQL 16 nhúng (npm `embedded-postgres`, đặt ngoài kho mã, khởi tạo với `--encoding=UTF8 --locale=C`) trỏ bằng `TEST_DATABASE_URL`.

**Điểm kiểm tra**: Tất cả câu chuyện hoạt động độc lập

---

## Phase 11: Hoàn thiện và việc xuyên suốt

**Mục đích**: Cải thiện ảnh hưởng nhiều câu chuyện

- [X] T114 [P] Biên soạn nội dung N4 và N3 song ngữ (từ vựng + ngữ pháp, giữ quy tắc ≥ 1 đơn vị 5 phút cho mỗi level × kind) trong `content/units/n4-*.json`, `content/units/n3-*.json`
- ~~T115~~ **[CHUYỂN SANG SPEC `002-performance` – KHÔNG THỰC HIỆN Ở SPEC NÀY]** Kiểm thử tải k6 với 1.000 người dùng đồng thời ("tải bình thường" của SC-010) cho `/today`, `/sessions`, `/sessions/*/answers` và `/progress` (mục tiêu p95 < 500 ms phía server, SC-010, quickstart K11) trong `backend/tests/load/today-answers.js`
- ~~T115a~~ **[CHUYỂN SANG SPEC `002-performance` – KHÔNG THỰC HIỆN Ở SPEC NÀY]** Đo hiệu năng đầu-cuối phía client (SC-010): `integration_test` trên Chrome đo thời gian từ thao tác đến khi hiển thị màn hình bài học và phản hồi câu trả lời, chạy trong lúc T115 tạo tải, khẳng định p95 < 1 giây trong `client/integration_test/perf_lesson_test.dart`
- [X] T116 [P] Rà soát bảo mật: CSP chặt chẽ cho client web, không rò `correct_choice`/đáp án qua endpoint người học ngoài phiên, thông điệp lỗi không lộ dữ liệu người khác (FR-034, R16) trong `backend/src/api/middleware/` và `client/web/index.html`
- [X] T117 [P] Kiểm tra mọi chuỗi giao diện có đủ khóa ở cả `client/lib/l10n/app_vi.arb` và `client/lib/l10n/app_en.arb` (script so khớp khóa) trong `client/tool/check_l10n.dart`
- [X] T118 [P] Dockerfile cho `api` và build tĩnh `flutter build web` phục vụ qua nginx với proxy `/api` và TLS (chuyển hướng HTTP → HTTPS); ghi yêu cầu vận hành cho FR-034 (mã hóa volume PostgreSQL và bản sao lưu, quản lý `JWT_SECRET`, chạy `pnpm admin:create`) trong `backend/Dockerfile`, `client/Dockerfile`, `client/nginx.conf`, `docker-compose.yml`, `backend/README.md`
- [X] T119 [P] Truy vấn báo cáo chỉ số sản phẩm: SC-003 theo quy tắc data-model §2.11 (hai nhóm có/không làm placement; không có lộ trình `reason ∈ {rebuild_request, goal_change, level_change, placement_retake}` trong 7 ngày đầu), SC-009 (giữ chân ngày 2, ≥ 3 ngày học trong 2 tuần), SC-011 (COUNT `users.from_trial` theo ngày / `trial_lesson_completed`; thêm phân bố `trial_placement_level_*`) trong `backend/src/reports/product-metrics.sql` và `backend/src/reports/README.md`
- [X] T120 [P] Kiểm tra tương thích trên Chrome, Edge, Firefox, Safari (FR-033): chạy kịch bản K1–K3 trên từng trình duyệt và ghi kết quả trong `specs/001-phase1-mvp/quickstart.md` (mục mới "Tương thích trình duyệt")
- [X] T121 [P] Kiểm thử khả dụng thủ công với nhóm người dùng thử nghiệm cho SC-004 (≥ 90% hoàn thành bài học đầu mà không cần trợ giúp); ghi kịch bản và kết quả trong `specs/001-phase1-mvp/quickstart.md`
- [X] T122 Chạy toàn bộ kịch bản kiểm chứng K1–K10 trong `specs/001-phase1-mvp/quickstart.md` (K11 chuyển sang spec `002-performance` cùng T115/T115a), cập nhật các lệnh nếu khác thực tế, và ghi thời gian đo thực tế của K1 (đăng ký → bài học đầu < 5 phút, SC-001)
- [X] T123 Hoàn tất: `pnpm test`, `flutter test` và lint (T004) đều xanh, không còn cảnh báo lint

> **Ghi chú triển khai Phase 11** (2026-11-05):
> - **T114**: thêm 8 đơn vị N4/N3 song ngữ (mỗi level × kind có 1 đơn vị 5 phút + 1 đơn vị còn lại; ngữ pháp thể bị động/sai khiến, so sánh là 10 phút) trong `content/units/n4-*.json`, `n3-*.json`, qua kiểm tra JSON Schema + `validateContent`. Tổng đơn vị seed 6 → 14 nên các kiểm thử đếm cứng (`seed.test.ts`, `us1.test.ts`, `us4-progress.test.ts`) đã cập nhật; mốc "đúng tiến độ" trong `us4-progress` dời sang 2026-02-28 vì nội dung N5–N3 cần ~22 ngày ở quỹ 10 phút/ngày.
> - **T116**: CSP chặt ở `client/web/index.html` (thẻ meta) và `client/nginx.conf` (thêm `frame-ancestors 'none'`, HSTS); kiểm thử `tests/unit/web-csp.test.ts` và `tests/integration/security.test.ts` (header API, không rò đáp án qua `/me`, `/today`, `/path`, `/progress`, phiên, placement; 404 giống hệt cho tài nguyên người khác; `/admin/*` 403/401). Nội dung dùng thử công khai gửi `answerKey` để chấm cục bộ theo thiết kế (FR-036 → FR-040, openapi 1.8.0), không thuộc phạm vi "ngoài phiên" cần che. Client phải build với `--no-web-resources-cdn` để CSP `default-src 'self'` có hiệu lực.
> - **T117**: `client/tool/check_l10n.dart` (khóa + placeholder + giá trị rỗng) và `client/test/l10n_keys_test.dart` để `flutter test` chặn thiếu khóa.
> - **T118**: `backend/Dockerfile` (ngữ cảnh là thư mục gốc, chép `*.sql` migration/báo cáo vào `dist`), `client/Dockerfile`, `client/nginx.conf`, `docker-compose.yml` (profile `app`: `api` không công bố cổng, `web` 80/443, `JWT_SECRET` bắt buộc), `.dockerignore`, `backend/README.md` (yêu cầu vận hành FR-034). **Chưa build/chạy thử** vì máy không có Docker; chỉ kiểm chứng riêng các giả định (build `tsc` + chạy `migrate`/`report` từ `dist`).
> - **T119**: `backend/src/reports/product-metrics.sql`, `run.ts` (`pnpm report:metrics`, phiên chỉ đọc), `README.md`; kiểm thử `tests/integration/reports.test.ts`.
> - **T120, T121** đã hoàn thành: chủ dự án xác nhận kiểm tra thủ công **đạt** (2026-11-05). Chi tiết từng trình duyệt/người tham gia không được ghi lại; khung ở `quickstart.md` mục 6 và 7 đã cập nhật kết luận.
> - **T122** đã hoàn thành: đã chạy thật API và đi K1–K3, K5, K7, K9 qua HTTP, cập nhật lệnh trong `quickstart.md` và ghi thời gian K1 phía máy (~0,7 s); chủ dự án xác nhận K1–K10 thao tác thủ công trên giao diện **đạt** (2026-11-05); xem `quickstart.md` mục 5.
> - **T123**: `pnpm test` (551 test) và `flutter test` (166 test) xanh; `eslint`, `prettier --check`, `tsc --noEmit`, `flutter analyze` không cảnh báo.

---

## Phụ thuộc & Thứ tự thực hiện

### Phụ thuộc giữa các phase

- **Thiết lập (Phase 1)**: không phụ thuộc, bắt đầu ngay
- **Nền tảng (Phase 2)**: phụ thuộc Thiết lập, CHẶN mọi câu chuyện
- **Câu chuyện (Phase 3–10)**: đều phụ thuộc Nền tảng; sau đó có thể song song hoặc tuần tự theo ưu tiên P1 → P2 → P3
- **Hoàn thiện (Phase 11)**: phụ thuộc các câu chuyện mong muốn đã xong

### Phụ thuộc giữa các câu chuyện

- **US1 (P1)**: bắt đầu sau Nền tảng, không phụ thuộc câu chuyện khác
- **US2 (P1)**: cần lộ trình và kế hoạch ngày của US1 (T049, T050) để có dữ liệu học
- **US3 (P2)**: cần luồng ghi câu trả lời của US2 (T062); mở rộng kế hoạch ngày của US1. `kind='review'` ở T061 (US2) chỉ kiểm thử đầy đủ được sau T079, US2 không kiểm thử nhánh `review`
- **US4 (P2)**: cần bản ghi học từ US2; `topic_stats` (T084) chia sẻ với US5
- **US5 (P2)**: cần lộ trình (US1) và `topic_stats` (T084 của US4) cho độ khó thích ứng; `daily-plan.ts` do T041 (US1) tạo, T078 (US3) và T092 (US5) mở rộng tuần tự; `POST /path/rebuild` do T051 (US1) tạo với nhánh `placement_retake`, T093 chỉ thêm nhánh `rebuild_request`
- **US8 (P2)**: nội dung/placement công khai dùng lại T028, T048; bước mang sang onboarding (T101) cần US1
- **US6 (P3)**: độc lập về logic; dùng quy tắc T014; tài khoản admin để kiểm thử tạo bằng T026a
- **US7 (P3)**: `PATCH /me` do T047 (US1) tạo trong `api/account.ts`; US5 (T093) và US7 (T111) chỉ mở rộng file này, không tạo lại

- **File dùng chung `backend/src/services/lesson-session.ts`**: T061, T064 (US2), T077, T079 (US3), T084 (US4), T091 (US5) cùng sửa file này nên PHẢI làm tuần tự theo thứ tự câu chuyện, không chạy song song giữa các câu chuyện

### Trong mỗi câu chuyện

- Kiểm thử (nếu có) viết trước và phải thất bại trước khi hiện thực
- Engine/miền → repository → dịch vụ → route → client
- Hoàn thành câu chuyện trước khi sang ưu tiên kế tiếp

### Cơ hội song song

- Mọi task Thiết lập/Nền tảng đánh dấu [P] chạy song song
- Sau Nền tảng, backend và client của cùng câu chuyện có thể làm song song (client dựa trên hợp đồng OpenAPI)
- Các file kiểm thử của một câu chuyện đánh dấu [P] chạy song song
- Các câu chuyện khác nhau có thể giao cho nhiều người sau Nền tảng

---

## Ví dụ song song: US1

```bash
# Chạy song song các kiểm thử US1:
Task: "Kiểm thử đơn vị placement.ts trong backend/tests/unit/placement.test.ts"
Task: "Kiểm thử đơn vị path.ts trong backend/tests/unit/path.test.ts"
Task: "Kiểm thử đơn vị daily-plan.ts trong backend/tests/unit/daily-plan.test.ts"

# Chạy song song engine và client US1:
Task: "Engine placement trong backend/src/engine/placement.ts"
Task: "Engine path trong backend/src/engine/path.ts"
Task: "Màn hình auth trong client/lib/presentation/auth/"
Task: "Màn hình onboarding trong client/lib/presentation/onboarding/"
```

---

## Chiến lược triển khai

### MVP trước (US1 + US2)

1. Hoàn thành Phase 1: Thiết lập
2. Hoàn thành Phase 2: Nền tảng (quan trọng – chặn mọi câu chuyện)
3. Hoàn thành Phase 3: US1
4. Hoàn thành Phase 4: US2 (US1 một mình chưa cho người học học được bài)
5. **DỪNG và KIỂM CHỨNG**: chạy quickstart K1–K3, K10 (trừ phần lịch ôn của K10, kiểm chứng ở US3 qua T075)
6. Demo nếu sẵn sàng

### Giao tăng dần

1. Thiết lập + Nền tảng → nền tảng sẵn sàng
2. US1 + US2 → kiểm thử → demo (MVP)
3. US3 (ôn tập) → US4 (tiến độ) → US5 (điều chỉnh) → US8 (dùng thử)
4. US6 (quản trị) → US7 (hồ sơ/tài khoản)
5. Hoàn thiện và bổ sung nội dung N4/N3
6. Mỗi câu chuyện thêm giá trị mà không phá câu chuyện trước

### Chiến lược nhiều lập trình viên

1. Cả đội cùng làm Thiết lập + Nền tảng
2. Sau đó: A làm US1→US3, B làm US2→US4→US5, C làm client/US8, D làm nội dung (T027, T028, T114) và US6/US7

---

## Ghi chú

- [P] = khác file, không phụ thuộc
- Nhãn [Story] giúp truy vết task về câu chuyện người dùng
- Rủi ro đường găng: biên soạn nội dung song ngữ (T027, T028, T114) — ưu tiên đủ nội dung N5 và đơn vị 5 phút cho mỗi level × kind trước khi demo (plan.md)
- Ngưỡng 60%/90% và hệ số SM-2 đặt ở cấu hình để chỉnh không cần phát hành
- Commit sau mỗi task hoặc nhóm task hợp lý; dừng ở mỗi điểm kiểm tra để kiểm chứng
- Tránh: task mơ hồ, xung đột cùng file, phụ thuộc chéo phá tính độc lập

---

## Phase 12: Convergence

**Mục đích**: Công việc còn lại do `/speckit-converge` phát hiện (2026-11-05) khi đối chiếu mã nguồn với spec/plan/tasks; hoàn thành bằng `/speckit-implement`. Không có vi phạm hiến pháp.

- [ ] T124 Build và chạy thử `docker compose --profile app up --build` (`backend/Dockerfile`, `client/Dockerfile`, `client/nginx.conf`, `docker-compose.yml`): kiểm tra `api` không công bố cổng, `web` chuyển hướng HTTP → HTTPS, proxy `/api` hoạt động, CSP không chặn khởi động Flutter/CanvasKit và phông Noto Sans JP, rate-limit đọc đúng IP qua `X-Forwarded-For` (`trustProxy`); sửa mọi lỗi phát hiện và ghi kết quả vào `specs/001-phase1-mvp/quickstart.md` mục 5 per FR-034 / plan: Docker + nginx + TLS (partial)
- [ ] T125 Chạy `integration_test` của client trên Chrome bằng `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/us1_onboarding_test.dart -d chrome` và `us2_lesson_test.dart` (cần `chromedriver`), sửa lỗi nếu có, rồi ghi kết quả/lệnh đã xác nhận vào `specs/001-phase1-mvp/quickstart.md` per plan: kiểm thử client `integration_test` trên Chrome / T057, T072 (partial)
- [ ] T126 Sinh lại API client Dart từ `contracts/openapi.yaml` 1.10.0 (hiện `client/lib/data/api/generated/` thiếu `adminListTopics`, 44/45 `operationId`), áp dụng `dart run tool/patch_generated_api.dart`, chạy `flutter analyze` và `flutter test`; xác nhận hoặc chuyển `client/lib/data/admin_repository.dart` dùng hàm sinh ra nếu phù hợp per plan: client sinh từ OpenAPI / T030 (partial)
- [ ] T127 Hoàn thiện bằng chứng kiểm tra thủ công trong `specs/001-phase1-mvp/quickstart.md`: điền bảng mục 6 (trình duyệt, phiên bản, HĐH, K1–K3 `Đạt`/`Lỗi`) thay cho "Chưa kiểm tra" và bảng mục 7 (số người tham gia, tỷ lệ hoàn thành không trợ giúp, thời gian) để khớp kết luận "đạt" per FR-033 / SC-004 / T120, T121 (partial)
