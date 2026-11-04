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

- [ ] T001 Tạo cấu trúc thư mục theo plan.md: `backend/src/{api,engine,domain,db,services,jobs,reports,seed}`, `backend/tests/{unit,contract,integration,load,fixtures/learner-profiles}`, `client/lib/{domain,data,platform/web,presentation,l10n}`, `content/{schema,units,placement}` (file `content/topics.json` do T027 tạo)
- [ ] T002 Khởi tạo dự án backend Node.js 22 + TypeScript 5 với pnpm trong `backend/package.json`, `backend/tsconfig.json` (strict); thêm phụ thuộc: fastify, zod, drizzle-orm, pg, pg-boss, argon2, jose, nodemailer, @fastify/rate-limit, vitest, testcontainers
- [ ] T003 [P] Khởi tạo dự án Flutter web trong `client/pubspec.yaml` với phụ thuộc: flutter_riverpod, go_router, dio, intl, flutter_localizations; bật `generate: true` cho l10n
- [ ] T004 [P] Cấu hình ESLint + Prettier cho backend trong `backend/eslint.config.js`, `backend/.prettierrc`, và `flutter_lints` trong `client/analysis_options.yaml`
- [ ] T005 [P] Tạo `docker-compose.yml` ở thư mục gốc với dịch vụ `db` (PostgreSQL 16), `mailpit` (chỉ dev, giao diện cổng 8025), `api`
- [ ] T006 [P] Tạo `backend/.env.example` với các biến `DATABASE_URL`, `JWT_SECRET`, `SMTP_URL`, `APP_BASE_URL` và cấu hình ngưỡng (rate-limit, 60%/90% độ khó, `REVIEW_SECONDS_PER_ITEM` mặc định 30) kèm comment tiếng Việt

---

## Phase 2: Nền tảng (điều kiện chặn mọi câu chuyện)

**Mục đích**: Hạ tầng cốt lõi PHẢI hoàn tất trước khi làm bất kỳ câu chuyện nào

**⚠️ QUAN TRỌNG**: Không câu chuyện nào được bắt đầu trước khi phase này xong

### CSDL và cấu hình

- [ ] T007 Viết cấu hình môi trường (đọc/validate bằng Zod) trong `backend/src/config.ts`
- [ ] T008 Tạo migration SQL tường minh `backend/src/db/migrations/0001_init.sql`: bật extension `citext`; tạo enum và bảng `users` (gồm `from_trial`), `auth_sessions`, `password_reset_tokens`, `learning_profiles`, `pause_periods`, `topics`, `learning_units` (gồm `tier`), `content_items`, `exercises`, `placement_questions`, `placement_results`, `learning_paths` (gồm `reason`), `unit_progress`, `daily_plans`, `daily_plan_items`, `lesson_sessions`, `study_records` (gồm `is_retry`), `study_intervals`, `review_schedules` (gồm `last_reviewed_local_date`), `topic_stats`, `admin_action_logs`, `aggregate_daily_stats` (khóa `(day, metric)`) đúng theo data-model.md; bao gồm các ràng buộc: `learning_units.est_minutes` CHECK ∈ {5,10,15}; CHECK `tier='foundation'` chỉ khi `level='N5'`; unique partial index `study_records(session_id, exercise_id) WHERE is_retry = false`; unique partial index `pause_periods(user_id) WHERE ended_on IS NULL`; `daily_plans.estimated_minutes` CHECK ≤ `budget_minutes`; `daily_plan_items.est_minutes` CHECK 1 ≤ giá trị ≤ 15; `study_intervals.duration_seconds` CHECK 0 < giá trị ≤ 1800; UNIQUE `(user_id, client_event_id)` trên `study_records` và `study_intervals`; UNIQUE `(user_id, local_date)` trên `daily_plans`; unique partial index `learning_paths(user_id) WHERE status='active'`; chỉ mục `review_schedules(user_id, due_date)`, `learning_units(status, level, kind)`, `exercises(unit_id)`, `content_items(unit_id)`; mọi bảng người học tham chiếu `users` bằng `ON DELETE CASCADE`
- [ ] T009 Định nghĩa schema Drizzle khớp migration trong `backend/src/db/schema.ts` và kết nối/giao dịch trong `backend/src/db/client.ts`
- [ ] T010 [P] Viết trình chạy migration (`pnpm db:migrate`) trong `backend/src/db/migrate.ts`

### Engine nền và miền

- [ ] T011 [P] Định nghĩa kiểu miền dùng chung (Level, Skill, GoalType, I18nText, LocalDate, v.v.) trong `backend/src/domain/types.ts`
- [ ] T012 [P] Cài `Clock` có thể tiêm và tiện ích ngày địa phương theo IANA timezone (R11) trong `backend/src/engine/clock.ts`
- [ ] T013 [P] Tiện ích bản địa hóa `i18n_text` theo `profile.language` (mặc định `vi`) trong `backend/src/domain/i18n.ts`
- [ ] T014 [P] Quy tắc kiểm tra nội dung (R13, data-model 2.8–2.10): `est_minutes ∈ {5,10,15}`, mỗi (level × kind) có ≥ 1 đơn vị 5 phút, `tier='foundation'` chỉ cho N5 và mỗi kind có ≥ 1 đơn vị N5 `foundation` 5 phút, đơn vị có ≥ 1 mục và ≥ 1 bài tập, bản dịch vi+en đầy đủ, `fill_blank` có `accepted_answers` hữu hạn không rỗng, `multiple_choice` có `correct_index` nằm trong `choices`, `matching` mỗi cặp hợp lệ, `grammar` có `explanation` và ≥ 1 ví dụ, `vocabulary` có `reading` trong `backend/src/domain/content-validation.ts`
- [ ] T015 [P] Bộ chấm bài tập khách quan (multiple_choice, matching, fill_blank; chuẩn hóa chuỗi khi so khớp) trong `backend/src/domain/grading.ts`

### API nền

- [ ] T016 Khởi tạo ứng dụng Fastify (đăng ký route dưới tiền tố `/api/v1`, xử lý lỗi theo schema lỗi trong openapi.yaml, nhật ký không ghi IP vào CSDL) trong `backend/src/app.ts` và `backend/src/server.ts`
- [ ] T017 [P] Middleware xác thực JWT (jose, access token 15 phút, không tra CSDL mỗi request) và kiểm tra vai trò `learner`/`admin` (FR-004); claim `status='pending_deletion'` chỉ cho phép `POST /account/restore` và `POST /auth/logout`, các route khác trả 403 `ACCOUNT_PENDING_DELETION` (R4) trong `backend/src/api/middleware/auth.ts`
- [ ] T018 [P] Middleware rate-limit theo IP bằng `@fastify/rate-limit` với bộ đếm trong bộ nhớ, ngưỡng cấu hình được: `/trial/*` (gồm `POST /trial/events`) và `/placement/questions` 60/phút, `POST /trial/placement/grade` 10/phút, `/auth/*` đăng ký/đăng nhập/đặt lại 10/phút (R9, FR-040) trong `backend/src/api/middleware/rate-limit.ts`
- [ ] T019 [P] Khung hàng đợi pg-boss (khởi động/dừng, đăng ký handler) trong `backend/src/jobs/boss.ts`
- [ ] T020 [P] Giao diện `EmailSender` + triển khai SMTP (nodemailer) + triển khai in-memory cho kiểm thử trong `backend/src/services/email.ts`
- [ ] T021 [P] Cấu hình CSP, HSTS và header bảo mật (R16) trong `backend/src/api/middleware/security-headers.ts`

### Kiểm thử nền

- [ ] T022 [P] Thiết lập Vitest + Testcontainers PostgreSQL (khởi động DB, chạy migration, dọn giữa các test) trong `backend/vitest.config.ts` và `backend/tests/integration/setup.ts`
- [ ] T023 [P] Thiết lập kiểm thử hợp đồng đối chiếu `specs/001-phase1-mvp/contracts/openapi.yaml` (validate request/response) trong `backend/tests/contract/helper.ts`
- [ ] T024 [P] Tạo bộ hồ sơ người học đại diện dạng fixture (FR-035, hiến pháp): người mới/10 phút, N3/30 phút, quay lại sau khoảng nghỉ, 5 phút nhiều bài ôn tồn đọng, placement đoán mò, liên tục < 60% ở một mảng (≥ 2 phiên), liên tục > 90% ở một mảng (≥ 2 phiên), mảng yếu đã hồi phục (≥ 70%), N2 tự khai báo, mục tiêu JLPT N1; mỗi hồ sơ gồm hồ sơ học tập, lịch sử `study_records` và kết quả mong đợi trong `backend/tests/fixtures/learner-profiles/*.json`

### Nội dung và seed

- [ ] T025 [P] Viết JSON Schema cho đơn vị học (gồm `tier`), mục, bài tập, câu hỏi placement trong `content/schema/unit.schema.json`, `content/schema/placement.schema.json`
- [ ] T026 Viết lệnh `seed` (`pnpm seed`): nạp `content/` có kiểm tra JSON Schema + quy tắc T014, nạp topics, tạo tài khoản admin dev bằng hàm của T026a trong `backend/src/seed/index.ts`
- [ ] T026a Lệnh vận hành `pnpm admin:create --email <email>` (FR-004, data-model §2.1): tạo tài khoản admin mới hoặc nâng quyền tài khoản có sẵn, không có đường đăng ký công khai nào tạo `role='admin'`; ghi `admin_action_logs` với `action='user.grant_admin'`, `actor_id` null; dùng được cho cả dev và production trong `backend/src/seed/create-admin.ts`
- [ ] T027 [P] Biên soạn nội dung tối thiểu N5 song ngữ vi/en: ≥ 1 đơn vị 5 phút cho mỗi (level × kind), ≥ 1 đơn vị `foundation` 5 phút cho mỗi kind, và chủ đề trong `content/units/n5-vocabulary-*.json`, `content/units/n5-grammar-*.json`, `content/topics.json`
- [ ] T028 [P] Biên soạn bộ 20 câu placement cố định (8 N5, 6 N4, 6 N3, gắn topic, có `position`) trong `content/placement/placement-v1.json`

### Client nền

- [ ] T029 [P] Định nghĩa giao diện nền tảng `TokenStore`, `LocalStore`, `Timezone`, `Links` trong `client/lib/platform/platform.dart` và triển khai web trong `client/lib/platform/web/*.dart` (Nguyên tắc V)
- [ ] T030 [P] Sinh API client từ `specs/001-phase1-mvp/contracts/openapi.yaml` vào `client/lib/data/api/`, tên hàm lấy theo `operationId` (ghi hướng dẫn lệnh sinh trong `client/lib/data/api/README.md`), cấu hình `dio` với interceptor gắn bearer token và tự làm mới qua `/auth/refresh` trong `client/lib/data/api/dio_client.dart`
- [ ] T031 [P] Thiết lập i18n ARB: `client/lib/l10n/app_vi.arb` (mặc định) và `client/lib/l10n/app_en.arb` với các khóa chung (nút, lỗi, điều hướng)
- [ ] T032 Thiết lập `main.dart`, theme, `go_router` với guard xác thực/vai trò (route công khai, người học, `/admin/*`) và Riverpod providers gốc trong `client/lib/main.dart`, `client/lib/presentation/shared/theme.dart`, `client/lib/router.dart`
- [ ] T033 [P] Widget dùng chung (khung trang desktop, hộp thoại xác nhận, trạng thái trống/lỗi/đang tải) trong `client/lib/presentation/shared/`

**Điểm kiểm tra**: Nền tảng sẵn sàng – có thể bắt đầu các câu chuyện

---

## Phase 3: US1 – Nhận kế hoạch cá nhân và bắt đầu học ngay (P1) 🎯 MVP

**Mục tiêu**: Đăng ký → onboarding (có/không placement) → lộ trình cá nhân + bài học hôm nay.

**Kiểm thử độc lập**: Đăng ký tài khoản mới, hoàn tất onboarding ở cả hai nhánh (có và không làm placement), xác minh lộ trình và kế hoạch hôm nay khớp trình độ, mục tiêu, thời gian khai báo (quickstart K1, K2).

### Kiểm thử US1

- [ ] T034 [P] [US1] Kiểm thử đơn vị `placement.ts` (trình độ = mức cao nhất mà tỷ lệ đúng ≥ 60% và các nhóm thấp hơn cũng ≥ 60%; mảng yếu = topic đúng < 50%; tổng tỷ lệ đúng ≤ 25% → `none`) trong `backend/tests/unit/placement.test.ts`
- [ ] T035 [P] [US1] Kiểm thử đơn vị `path.ts` trên hồ sơ đại diện (người mới → các mục đầu là `tier='foundation'`; 10 phút; N3; placement đoán mò → mức an toàn; N2 → bắt đầu N3 kèm `scopeNotice='content_ceiling_n3'`; JLPT N1 → khoảng trình độ cắt ở N3; không tạo lộ trình cố định chung cho mọi hồ sơ; `rankUnits` tự đưa đơn vị `active` mới vào và loại đơn vị `inactive`/`mastered`) trong `backend/tests/unit/path.test.ts`
- [ ] T036 [P] [US1] Kiểm thử đơn vị `daily-plan.ts` phần thuộc T041 (danh sách mục ôn được truyền vào làm tham số, không kiểm thử việc chọn/chia gói): tổng `est_minutes` ≤ `budget_minutes` cho mọi hồ sơ; `B=5` chỉ chứa mục ≤ 5 phút; danh sách ôn rỗng → toàn bộ quỹ cho bài mới; có danh sách ôn → phần ôn ≤ 60% `B`, không có bài mới phù hợp → toàn bộ quỹ cho ôn; khi phần dư < 5 phút ngày là chỉ-ôn hoặc chỉ-bài-mới và luân phiên theo kế hoạch ngày liền trước (sau ngày chỉ-ôn thì ưu tiên bài mới); `paused` → không sinh kế hoạch (FR-012, SC-002) trong `backend/tests/unit/daily-plan.test.ts`
- [ ] T037 [P] [US1] Kiểm thử hợp đồng cho `/auth/*` (gồm cờ `fromTrial`), `GET/PATCH /me`, `/onboarding`, `/onboarding/complete`, `/placement/submit`, `POST /path/rebuild` với `usePlacementResultId`, `/path`, `/today` trong `backend/tests/contract/us1.test.ts`
- [ ] T038 [P] [US1] Kiểm thử tích hợp: đăng ký → onboarding bỏ qua placement → có lộ trình và `/today`; đăng ký email trùng; email sai định dạng/mật khẩu yếu trả lỗi cụ thể; đặt lại mật khẩu (liên kết dùng một lần, hết hạn 1 giờ, vô hiệu hóa mọi phiên); làm lại placement (US1.6, FR-009): kết quả mới `is_current`, kết quả cũ giữ làm lịch sử, chọn xây dựng lại → lộ trình mới `reason='placement_retake'`, chọn giữ → lộ trình không đổi, cả hai trường hợp không đụng `unit_progress`/`study_records`/`review_schedules` trong `backend/tests/integration/us1-onboarding.test.ts`

### Triển khai backend US1

- [ ] T039 [P] [US1] Engine chấm placement và ước tính trình độ (R8) trong `backend/src/engine/placement.ts`
- [ ] T040 [P] [US1] Engine lộ trình thuần hàm (R7): `buildPathParams` chọn điểm xuất phát (người mới/placement `none` → đơn vị `tier='foundation'` trước) và khoảng trình độ (cắt trần N3, trả `scopeNotice` khi trình độ/mục tiêu là N2/N1); `rankUnits(pathParams, profile, activeUnits, unitProgress, topicStats)` tính động thứ tự đơn vị, không lưu: lọc theo kỹ năng/`active`/chưa thành thạo/khoảng trình độ, chấm điểm theo `goal_tags`, `prioritized_skill`, `sequence`, mảng yếu; ước lượng đơn vị mới/ngày đến `target_date` chỉ để đánh giá tiến độ trong `backend/src/engine/path.ts`
- [ ] T041 [US1] Engine kế hoạch ngày thuần hàm (R7): nhận danh sách mục ôn đã chọn làm tham số (US1 truyền rỗng; việc chọn và chia gói do T078), dành tối đa 60% `B` cho ôn, phần còn lại cho đơn vị mới có `est_minutes ≤` phần còn lại, tổng KHÔNG ĐƯỢC vượt `B`, không có bài ôn thì toàn bộ quỹ cho bài mới và ngược lại, khi phần dư sau 60% ôn < 5 phút thì luân phiên chỉ-ôn/chỉ-bài-mới theo kế hoạch ngày liền trước (research R7), không sinh khi `paused` trong `backend/src/engine/daily-plan.ts`
- [ ] T042 [P] [US1] Repository người dùng/phiên/token đặt lại (Drizzle) trong `backend/src/db/repositories/users.ts`
- [ ] T043 [US1] Dịch vụ xác thực: đăng ký (argon2id; từ chối `EMAIL_PENDING_DELETION` cho email đang chờ xóa), đăng nhập, làm mới refresh token xoay vòng 30 ngày (lưu SHA-256), tài khoản `disabled` bị từ chối khi đăng nhập/làm mới với 403 `ACCOUNT_DISABLED`, access token mang claim `status`, đăng xuất, yêu cầu/xác nhận đặt lại mật khẩu (token 256-bit, hết hạn 1 giờ, dùng một lần, phản hồi yêu cầu luôn giống nhau); nhận cờ `fromTrial` khi đăng ký và lưu vào `users.from_trial` (đo SC-011) trong `backend/src/services/auth.ts`
- [ ] T044 [US1] Route `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password-reset/request`, `/auth/password-reset/confirm` trong `backend/src/api/auth.ts`
- [ ] T045 [US1] Job gửi email đặt lại mật khẩu có thử lại qua pg-boss trong `backend/src/jobs/send-email.ts`
- [ ] T046 [US1] Dịch vụ hồ sơ/onboarding: lưu `onboarding_draft` (bỏ dở/tiếp tục), validate `daily_minutes ∈ {5,10,15,30}`, `skills ⊆ {vocabulary, grammar}` không rỗng (từ chối mọi giá trị khác), `target_level` bắt buộc khi `goal_type='jlpt'`, `display_name` 1–60 ký tự; báo giới hạn nội dung N3 trước khi hoàn tất khi trình độ/mục tiêu là N2/N1 trong `backend/src/services/onboarding.ts`
- [ ] T047 [US1] Route `GET/PUT /onboarding`, `POST /onboarding/complete` (sinh lộ trình từ hồ sơ + placement hiện hành với `reason='onboarding'`) trong `backend/src/api/onboarding.ts`; và tạo `backend/src/api/account.ts` với `GET /me` và `PATCH /me` (lưu trường hồ sơ cơ bản; hệ quả xây dựng lại lộ trình do T093 bổ sung, đổi mật khẩu/xóa/khôi phục do T111 bổ sung)
- [ ] T048 [US1] Dịch vụ placement trong `backend/src/services/placement.ts` (chấm trên server bằng T039, lưu `placement_results` với `is_current`, giữ kết quả cũ làm lịch sử; hỗ trợ đính kèm câu trả lời từ dùng thử để chấm lại theo FR-039) và route `GET /placement/questions` (công khai, KHÔNG trả `correct_choice`), `POST /placement/submit` gọi dịch vụ này trong `backend/src/api/placement.ts`
- [ ] T049 [US1] Dịch vụ lộ trình: tạo `learning_paths` (lưu `generated_from` và `reason`), đặt bản cũ `superseded`, không đụng `unit_progress`; route `GET /path` tính thứ tự đơn vị động qua `rankUnits` (T040) từ nội dung `active` trong bộ đệm, trả `reason`, `scopeNotice` trong `backend/src/services/path.ts`, `backend/src/api/path.ts`
- [ ] T050 [US1] Dịch vụ kế hoạch ngày: sinh lười khi mở lần đầu trong ngày địa phương, chọn đơn vị mới qua `rankUnits` tại thời điểm sinh, idempotent theo `(user_id, local_date)`, lưu `daily_plans`/`daily_plan_items` (kế hoạch đã sinh không đổi khi nội dung đổi trong ngày); route `GET /today` trong `backend/src/services/daily-plan.ts`, `backend/src/api/daily.ts`
- [ ] T051 [US1] Làm lại placement (US1.6): mở rộng `backend/src/services/placement.ts` để khi hoàn thành trả kết quả mới kèm lựa chọn xây dựng lại hay giữ lộ trình; tạo `POST /path/rebuild` nhánh có `usePlacementResultId` → lộ trình mới `reason='placement_retake'` (nhánh không tham số do T093 bổ sung); giữ nguyên lịch sử học và lịch ôn trong `backend/src/services/path.ts`, `backend/src/api/path.ts`

### Triển khai client US1

- [ ] T052 [P] [US1] Repository auth và màn hình đăng ký/đăng nhập/quên mật khẩu/đặt lại mật khẩu (hiển thị lỗi cụ thể, gợi ý khôi phục khi `EMAIL_PENDING_DELETION`) trong `client/lib/data/auth_repository.dart`, `client/lib/presentation/auth/`
- [ ] T053 [P] [US1] Màn hình onboarding nhiều bước (trình độ, mục tiêu, thời gian, mốc thời gian, kỹ năng; nghe, đọc, Kanji hiển thị là tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này"; tự lưu nháp; tiếp tục/làm lại; tự lấy timezone từ trình duyệt) trong `client/lib/presentation/onboarding/`
- [ ] T054 [P] [US1] Màn hình placement (đồng hồ 10 phút, bỏ qua bất cứ lúc nào, hiển thị kết quả trình độ + mảng mạnh/yếu, lựa chọn xây dựng lại/giữ lộ trình khi làm lại) trong `client/lib/presentation/placement/`
- [ ] T055 [US1] Màn hình lộ trình và màn hình "Hôm nay" cơ bản (hiển thị bài mới, bài ôn, tổng thời lượng; thông báo `scopeNotice` khi nội dung chỉ đến N3) trong `client/lib/presentation/path/`, `client/lib/presentation/today/`
- [ ] T056 [US1] Chuỗi ngôn ngữ vi/en cho auth, onboarding, placement, path, today vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [ ] T057 [US1] Kiểm thử tích hợp client luồng đăng ký → onboarding → thấy "Hôm nay" trên Chrome trong `client/integration_test/us1_onboarding_test.dart`

**Điểm kiểm tra**: US1 hoạt động độc lập – đây là MVP tối thiểu cùng US2

---

## Phase 4: US2 – Hoàn thành bài học ngắn hằng ngày (P1)

**Mục tiêu**: Học bài từ vựng/ngữ pháp có bài tập, phản hồi tức thì, tiếp tục dở dang, đánh dấu hoàn thành ngày.

**Kiểm thử độc lập**: Với lộ trình có sẵn, hoàn thành từng mục của kế hoạch hôm nay trong 5–15 phút, kết quả được ghi, ngày được đánh dấu hoàn thành (quickstart K3).

### Kiểm thử US2

- [ ] T058 [P] [US2] Kiểm thử hợp đồng cho `/today/extra`, `/sessions`, `/sessions/{sessionId}/answers`, `/sessions/{sessionId}/intervals`, `/sessions/{sessionId}/complete` trong `backend/tests/contract/us2.test.ts`
- [ ] T059 [P] [US2] Kiểm thử tích hợp: tiếp tục phiên dở dang không mất câu trả lời; hoàn thành mục cuối → `daily_plans.status='completed'`; sửa nội dung giữa chừng không đổi bài tập của phiên đang học (snapshot); "học thêm" không ghi đè kế hoạch mặc định trong `backend/tests/integration/us2-lesson.test.ts`
- [ ] T060 [P] [US2] Kiểm thử đồng thời hai cửa sổ (FR-041, SC-012, quickstart K10) cho phần thuộc US2: (a) trùng `client_event_id` → một `study_records`/`study_intervals`; (b) cùng phiên, cùng bài tập, `client_event_id` khác → một bản ghi lượt chính, lần sau `duplicate=true`; (c) hai cửa sổ gửi khoảng thời gian chồng nhau → tổng thời gian = độ dài hợp (phần lịch ôn kiểm thử ở T075) trong `backend/tests/integration/concurrency.test.ts`

### Triển khai backend US2

- [ ] T061 [US2] Dịch vụ phiên học: `POST /sessions` tạo `lesson_sessions` kèm `snapshot` bài tập đã bản địa hóa (R12), chỉ gồm mục/bài tập `active` (data-model §2.10), `kind ∈ {new_unit, review, extra}`; đặt `unit_progress.status='in_progress'` với phiên `new_unit`/`extra`; nếu đã có phiên `in_progress` cho cùng mục thì trả lại phiên đó (`kind='review'` chỉ dùng được đầy đủ từ T079 của US3) trong `backend/src/services/lesson-session.ts`
- [ ] T062 [US2] Ghi câu trả lời idempotent: chấm phía server bằng `grading.ts`, `INSERT … ON CONFLICT DO NOTHING` theo `(user_id, client_event_id)` và theo `(session_id, exercise_id)` lượt chính, trả kết quả đã có kèm `duplicate=true` khi trùng, nhận `isRetry` (câu hỏi lại cuối phiên), trả phản hồi đúng/sai theo ngôn ngữ người học; route `POST /sessions/{sessionId}/answers` (lưu `local_date` theo timezone hồ sơ) trong `backend/src/api/sessions.ts`
- [ ] T063 [US2] Ghi khoảng thời gian học idempotent: route `POST /sessions/{sessionId}/intervals` với CHECK `0 < duration_seconds ≤ 1800` trong `backend/src/api/sessions.ts`
- [ ] T064 [US2] Hoàn thành phiên: chỉ đánh dấu hoàn thành sau khi mọi câu đã được server xác nhận; cập nhật `daily_plan_items` và `daily_plans.status/completed_at`, cập nhật `unit_progress.status='completed'`; route `POST /sessions/{sessionId}/complete` trả tóm tắt kết quả trong `backend/src/services/lesson-session.ts`, `backend/src/api/sessions.ts`
- [ ] T065 [US2] Route `POST /today/extra`: trả thêm đơn vị kế tiếp (chọn qua `rankUnits`) ngoài kế hoạch, không ghi đè kế hoạch mặc định; khi hết nội dung phù hợp trả thông báo rõ ràng kèm gợi ý mảng kế tiếp trong `backend/src/api/daily.ts`
- [ ] T066 [US2] Bộ đệm đọc nội dung đã bản địa hóa với TTL ≤ 60 giây (R13, R17, SC-008) trong `backend/src/services/content-cache.ts`

### Triển khai client US2

- [ ] T067 [P] [US2] Hàng đợi sự kiện chưa gửi (lưu qua `LocalStore`, thử lại cùng `client_event_id`, UUID v4 sinh phía client) trong `client/lib/data/event_queue.dart`
- [ ] T068 [P] [US2] Widget bài tập `multiple_choice`, `matching`, `fill_blank` với phản hồi đúng/sai tức thì trong `client/lib/presentation/lesson/exercises/`
- [ ] T069 [US2] Màn hình bài học: phần giải thích từ vựng/ngữ pháp (chữ Nhật, cách đọc, nghĩa theo ngôn ngữ, ví dụ) → bài tập → hỏi lại câu sai một lần ở cuối phiên (gửi `isRetry=true`, R6) → tóm tắt; tiếp tục từ câu chưa trả lời; ghi khoảng thời gian học trong `client/lib/presentation/lesson/`
- [ ] T070 [US2] Hoàn thiện màn hình "Hôm nay": mở/tiếp tục mục, trạng thái hoàn thành ngày, tóm tắt kết quả, nút "Học thêm", thông báo hết nội dung, xử lý mất kết nối (không báo hoàn thành khi chưa lưu) trong `client/lib/presentation/today/`
- [ ] T071 [US2] Bổ sung chuỗi vi/en cho bài học vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [ ] T072 [US2] Kiểm thử tích hợp client luồng học một đơn vị đến khi hoàn thành ngày trong `client/integration_test/us2_lesson_test.dart`

**Điểm kiểm tra**: US1 + US2 hoạt động – có thể demo MVP end-to-end

---

## Phase 5: US3 – Ôn lại những gì sắp quên (P2)

**Mục tiêu**: Lặp lại ngắt quãng SM-2 biến thể, bài ôn đến hạn vào kế hoạch ngày.

**Kiểm thử độc lập**: Học một tập mục, trả lời đúng/sai khi ôn, ngày ôn kế tiếp khác nhau và mục đến hạn xuất hiện trong kế hoạch (quickstart K4).

### Kiểm thử US3

- [ ] T073 [P] [US3] Kiểm thử đơn vị `srs.ts` đúng công thức R6 (lần đầu đúng: `interval=1`, `ease=2.3`, `repetitions=1`; đúng: `interval = repetitions==2 ? 3 : round(interval × ease)`, `ease = min(2.8, ease+0.05)`; sai: `lapses+1`, `repetitions=0`, `interval=1`, `ease = max(1.3, ease−0.2)`; mục khó khi `lapses ≥ 3` và độ chính xác gần đây < 60% thì `ease ≤ 2.0`) và kiểm tra SC-005 (mục sai ôn lại sớm hơn mục đúng) trên hồ sơ đại diện trong `backend/tests/unit/srs.test.ts`
- [ ] T074 [P] [US3] Kiểm thử đơn vị chọn và chia gói ôn (T078): quá hạn lâu nhất và mục khó được ưu tiên; ước lượng theo `REVIEW_SECONDS_PER_ITEM`; mọi `daily_plan_items.est_minutes` ≤ 15; `B=30` với 100 mục đến hạn → 2 gói ôn 9 phút, tổng ≤ 30; `B=30` chỉ-ôn → 2 gói 15 phút; `B=5` nhiều bài ôn tồn đọng vẫn ≤ 5 phút, mục không vừa giữ nguyên `due_date`; mục `inactive` không được chọn (luân phiên chỉ-ôn/chỉ-bài-mới đã kiểm thử ở T036) (FR-024, FR-017, SC-002) trong `backend/tests/unit/daily-plan-review.test.ts`
- [ ] T075 [P] [US3] Kiểm thử tích hợp: trả lời đúng/sai cập nhật `review_schedules` trong cùng giao dịch với `study_records` (khóa hàng `FOR UPDATE`), mục đến hạn xuất hiện trong `/today`; đồng thời (FR-041, SC-012, quickstart K10): hai phiên khác nhau cùng ôn một mục trong ngày → `review_schedules` chỉ cập nhật một lần (`last_reviewed_local_date`), câu `isRetry=true` không đổi lịch ôn; mục bị admin chuyển `inactive` không vào gói ôn nhưng dòng `review_schedules` vẫn còn trong `backend/tests/integration/us3-review.test.ts`

### Triển khai US3

- [ ] T076 [P] [US3] Engine SRS thuần hàm theo R6 (gồm cờ `is_hard`) trong `backend/src/engine/srs.ts`
- [ ] T077 [US3] Tích hợp cập nhật `review_schedules` vào luồng ghi câu trả lời (`due_date` = ngày địa phương + `interval`; chỉ cập nhật khi chèn `study_records` thành công; bỏ qua khi `is_retry` hoặc `last_reviewed_local_date` = hôm nay; khóa hàng) trong `backend/src/services/lesson-session.ts`, `backend/src/db/repositories/review.ts`
- [ ] T078 [US3] Bổ sung gói ôn (`review_batch`) vào engine/dịch vụ kế hoạch ngày: chọn mục đến hạn sắp theo mức quá hạn, ưu tiên mục khó, bỏ qua mục `inactive` hoặc không còn bài tập `active` (data-model §2.16), giới hạn 60% `B`, ước lượng theo `REVIEW_SECONDS_PER_ITEM` và chia gói ≤ 15 phút (R7); mục đến hạn không vừa quỹ hôm nay giữ nguyên `due_date` để được ưu tiên hôm sau (việc dời lịch sau khoảng nghỉ do T092) trong `backend/src/engine/daily-plan.ts`, `backend/src/services/daily-plan.ts`
- [ ] T079 [US3] Phiên ôn tập (`kind='review'`): tạo snapshot bài tập `active` từ `review_item_ids`, hoàn thành cập nhật `daily_plan_items` trong `backend/src/services/lesson-session.ts`
- [ ] T080 [US3] Client: hiển thị mục ôn trong "Hôm nay" và màn hình ôn tập dùng lại widget bài tập, phản hồi tức thì, chuỗi vi/en trong `client/lib/presentation/review/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US3 hoạt động độc lập

---

## Phase 6: US4 – Theo dõi tiến độ và mức đạt mục tiêu (P2)

**Mục tiêu**: Màn hình tiến độ: thời gian, số bài, độ chính xác ôn, chuỗi ngày, tiến độ mục tiêu, điểm yếu.

**Kiểm thử độc lập**: Sau vài ngày học, số liệu khớp hoạt động đã ghi; trạng thái trống rõ ràng cho người mới (quickstart K5).

### Kiểm thử US4

- [ ] T081 [P] [US4] Kiểm thử đơn vị `difficulty.ts` trên các hồ sơ "liên tục < 60%" và "mảng yếu đã hồi phục" của T024: `topic_stats` trượt 20 câu, cờ `is_weak` khi accuracy < 60% với ≥ 8 câu và tự bỏ cờ khi ≥ 70%, câu `is_retry` không được tính trong `backend/tests/unit/difficulty-weakness.test.ts`
- [ ] T082 [P] [US4] Kiểm thử hợp đồng cho `GET /progress` trong `backend/tests/contract/us4.test.ts`
- [ ] T083 [P] [US4] Kiểm thử tích hợp: tổng thời gian = độ dài hợp các khoảng (chồng nhau chỉ tính một lần), chuỗi ngày theo `local_date` (bỏ qua ngày thuộc `pause_periods`, đúng cả khi tạm dừng rồi tiếp tục nhiều lần, không đứt khi đổi múi giờ), trạng thái trống cho người học mới, đúng/chậm tiến độ so với `target_date` trong `backend/tests/integration/us4-progress.test.ts`

### Triển khai US4

- [ ] T084 [US4] Engine thống kê mảng (`topic_stats`: `recent_results`, `accuracy`, `is_weak`) trong `backend/src/engine/difficulty.ts` và cập nhật trong cùng giao dịch ghi câu trả lời (bỏ qua `is_retry`) tại `backend/src/services/lesson-session.ts`
- [ ] T085 [US4] Dịch vụ tính Tóm tắt tiến độ (chế độ xem tính toán, không lưu): thời gian học (hợp các khoảng), bài đã hoàn thành (`unit_progress`), độ chính xác ôn (chỉ câu lượt chính), chuỗi ngày (R11, loại `pause_periods`), tỷ lệ nội dung mục tiêu đã xong (chỉ tính đơn vị `active`), cờ đúng tiến độ (FR-028), `scopeNotice`, danh sách mảng yếu trong `backend/src/services/progress.ts`
- [ ] T086 [US4] Route `GET /progress` trong `backend/src/api/progress.ts`
- [ ] T087 [US4] Client: màn hình tiến độ (chỉ số, tiến độ mục tiêu kèm `scopeNotice`, điểm yếu, trạng thái trống thân thiện), liên kết từ màn hình hằng ngày trong ≤ 2 lần nhấp (SC-007), chuỗi vi/en trong `client/lib/presentation/progress/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US4 hoạt động độc lập

---

## Phase 7: US5 – Tự điều chỉnh kế hoạch (P2)

**Mục tiêu**: Người học ghi đè hệ thống; lộ trình tự thích ứng theo kết quả và khoảng nghỉ.

**Kiểm thử độc lập**: Lần lượt đổi từng thiết lập, kế hoạch tiếp theo phản ánh thay đổi; bỏ vài ngày rồi quay lại thấy kế hoạch cân đối (quickstart K6).

### Kiểm thử US5

- [ ] T088 [P] [US5] Kiểm thử đơn vị `difficulty.ts` trên các hồ sơ "liên tục < 60%" và "liên tục > 90%" của T024: < 60% liên tiếp 2 phiên → `difficulty_bias` −1 (giới hạn −2), > 90% liên tiếp 2 phiên → +1 (giới hạn +2), và đơn vị kế tiếp do `rankUnits` chọn dễ hơn/khó hơn tương ứng trong `backend/tests/unit/difficulty-bias.test.ts`
- [ ] T088a [P] [US5] Kiểm thử đơn vị xử lý khoảng nghỉ trên hồ sơ "quay lại sau khoảng nghỉ" của T024: vắng ≥ 2 ngày (không tính ngày thuộc `pause_periods`) → kế hoạch vẫn ≤ 60% `B` cho ôn, mục quá hạn dư được dời dần qua các ngày sau mà giữ `due_date` gốc làm thứ tự ưu tiên, `DailyPlan.notice` mang mã `replanned_after_gap`, không có trường "nợ" (FR-015) trong `backend/tests/unit/daily-plan-gap.test.ts`
- [ ] T089 [P] [US5] Kiểm thử hợp đồng cho `/path/rebuild`, `/path/pause`, `/path/resume`, `/path/units/{unitId}/master` (trả `MasterResult` khớp schema) và hệ quả của `PATCH /me` (đổi mục tiêu/`currentLevel` sinh lộ trình mới với `reason` tương ứng; đổi thời gian mỗi ngày không sinh lộ trình mới; đặt `prioritizedSkill` ảnh hưởng thứ tự đơn vị kế tiếp) trong `backend/tests/contract/us5.test.ts`
- [ ] T090 [P] [US5] Kiểm thử tích hợp SC-006: mỗi ghi đè (mục tiêu, thời gian/ngày, tạm dừng/tiếp tục, ưu tiên kỹ năng, thành thạo, xây dựng lại) có hiệu lực trong kế hoạch kế tiếp; mỗi lần sinh lộ trình lưu đúng `reason`; xây dựng lại không đụng `unit_progress`/`study_records`/`review_schedules`/`topic_stats`; tạm dừng không sinh kế hoạch hay ngày bỏ lỡ; đánh dấu đơn vị cuối cùng → `remainingUnits=0` kèm `suggestion` đúng cho hồ sơ N5 (`raise_level`) và N3 (`content_exhausted`) trong `backend/tests/integration/us5-overrides.test.ts`

### Triển khai US5

- [ ] T091 [US5] Hoàn thiện `difficulty.ts`: `consecutive_low/high`, `difficulty_bias` (−2..+2) và thêm đơn vị củng cố cho mảng yếu khi chọn đơn vị kế tiếp; nối vào luồng `POST /sessions/{sessionId}/complete` (T064): khi hoàn thành phiên, tính độ chính xác của phiên theo từng mảng và cập nhật `consecutive_low/high`, `difficulty_bias` trong cùng giao dịch trong `backend/src/engine/difficulty.ts`, `backend/src/engine/path.ts`, `backend/src/services/lesson-session.ts`
- [ ] T092 [US5] Xử lý khoảng nghỉ (FR-015): phát hiện vắng ≥ 2 ngày (loại ngày thuộc `pause_periods`), lập lại kế hoạch ở mức xử lý được (dời dần mục quá hạn dư, giữ `due_date` gốc), đặt `DailyPlan.notice` = `replanned_after_gap`, không hiển thị "nợ" trong `backend/src/engine/daily-plan.ts`, `backend/src/services/daily-plan.ts`
- [ ] T093 [US5] Dịch vụ ghi đè: bổ sung nhánh không tham số của `POST /path/rebuild` (`reason='rebuild_request'`; nhánh `usePlacementResultId` → `placement_retake` đã có từ T051), `POST /path/pause` và `POST /path/resume` (mở/đóng `pause_periods` trong cùng giao dịch), `PUT /path/units/{unitId}/master` (đặt/bỏ `unit_progress.status='mastered'`, loại đơn vị khỏi bài sắp tới; trả `MasterResult` với `remainingUnits` tính qua `rankUnits`, khi bằng 0 trả `suggestion` = `raise_level` nếu còn trình độ cao hơn trong N5–N3, ngược lại `content_exhausted`), ưu tiên kỹ năng (trường `prioritizedSkill` của `PATCH /me`, không có route riêng); qua `PATCH /me`: đổi mục tiêu sinh lộ trình mới với `reason='goal_change'`, đổi `currentLevel` sau onboarding sinh lộ trình mới với `reason='level_change'`, đổi `daily_minutes` áp dụng trực tiếp cho kế hoạch kế tiếp (bổ sung vào route `PATCH /me` đã tạo ở T047) trong `backend/src/services/path.ts`, `backend/src/api/path.ts`, `backend/src/api/account.ts`
- [ ] T094 [US5] Client: màn hình điều chỉnh kế hoạch (đổi mục tiêu/thời gian, tạm dừng/tiếp tục, ưu tiên kỹ năng, đánh dấu thành thạo, xây dựng lại có xác nhận, nghe/đọc/Kanji hiển thị là tùy chọn bị khóa như T053; khi đánh dấu đơn vị cuối cùng còn lại thì hiển thị hộp thoại xác nhận, sau khi nhận `suggestion` thì đưa ra lựa chọn nâng trình độ hoặc làm lại placement (`raise_level`) hoặc thông báo hết nội dung (`content_exhausted`)), chuỗi vi/en trong `client/lib/presentation/path/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: US1–US5 hoạt động độc lập

---

## Phase 8: US8 – Dùng thử khi chưa đăng ký (P2)

**Mục tiêu**: Khách học bài mẫu và làm placement mà không đăng ký, không lưu dữ liệu định danh trên server, mang kết quả placement sang onboarding.

**Kiểm thử độc lập**: Chưa đăng nhập, hoàn thành bài mẫu + placement, không có lộ trình/kế hoạch nào được tạo; đăng ký rồi kết quả placement được mang sang (quickstart K9).

### Kiểm thử US8

- [ ] T095 [P] [US8] Kiểm thử hợp đồng cho `GET /trial/content`, `POST /trial/placement/grade`, `POST /trial/events` (ghi chú: `/placement/questions` đã thuộc T037/T048) trong `backend/tests/contract/us8.test.ts`
- [ ] T096 [P] [US8] Kiểm thử tích hợp: endpoint dùng thử không ghi bản ghi định danh nào vào CSDL (chỉ tăng các bộ đếm ẩn danh `trial_content_loaded`, `trial_lesson_completed`, `trial_placement_completed`, `trial_placement_level_*`; từ chối tên metric ngoài danh sách; `POST /trial/events` không nhận dữ liệu nào khác ngoài tên sự kiện), bị rate-limit khi vượt ngưỡng (60/phút và 10/phút), không ghi IP vào CSDL (FR-038, FR-040); mang kết quả sang (FR-039): đăng ký với `fromTrial=true` rồi gửi `placementAnswers` dùng thử tới `POST /placement/submit` → server chấm lại, lưu `placement_results` `is_current` và `POST /onboarding/complete` dùng kết quả đó (`generated_from.placement_result_id`); bỏ kết quả rồi làm lại thì kết quả mới thay thế trong `backend/tests/integration/us8-trial.test.ts`

### Triển khai US8

- [ ] T097 [US8] Route công khai chỉ đọc `GET /trial/content` trả đơn vị `is_trial=true` (mặc định 2 đơn vị: 1 từ vựng + 1 ngữ pháp, mỗi đơn vị 5 phút, tổng ≤ 10 phút) kèm đáp án để client tự chấm, bản địa hóa theo tham số ngôn ngữ; tăng bộ đếm ẩn danh `trial_content_loaded` qua repository ở T098a (không lưu IP, SC-011) trong `backend/src/api/trial.ts`
- [ ] T098 [US8] Route `POST /trial/placement/grade` chấm không lưu, không ghi nhật ký định danh; tăng bộ đếm ẩn danh `trial_placement_completed` và `trial_placement_level_<mức>` trong `backend/src/api/trial.ts`
- [ ] T098a [US8] Route công khai `POST /trial/events` (body chỉ `{event: lesson_completed}`) tăng bộ đếm `trial_lesson_completed`; và repository tăng bộ đếm `aggregate_daily_stats` (upsert `(day, metric)`, danh sách metric cố định) trong `backend/src/api/trial.ts`, `backend/src/db/repositories/aggregate-stats.ts`
- [ ] T099 [P] [US8] Client: trạng thái dùng thử (`trialProgress`, `trialAnswers`, `placementAnswers`, `startedAt`) lưu qua `LocalStore`, chịu được việc mất dữ liệu trình duyệt và cho dùng thử lại từ đầu trong `client/lib/presentation/trial/trial_state.dart`
- [ ] T100 [US8] Client: trang đầu với nút "Dùng thử" (≤ 3 lần nhấp tới bài mẫu), bài mẫu chấm phía client với phản hồi tức thì, gọi `POST /trial/events` một lần khi hoàn thành bài mẫu, placement dùng thử, màn hình hết nội dung dùng thử mời đăng ký, giải thích + lời mời đăng ký khi vào tính năng cần tài khoản, hỗ trợ vi/en trong `client/lib/presentation/trial/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`
- [ ] T101 [US8] Client: khi đăng ký trên cùng trình duyệt, gửi `placementAnswers` (không phải kết quả) sang onboarding để server chấm lại qua `POST /placement/submit`; cho phép bỏ kết quả để làm lại; không mang sang khi trình duyệt khác (FR-039); gửi `fromTrial=true` khi đăng ký ngay sau dùng thử (SC-011) trong `client/lib/presentation/onboarding/`, `client/lib/data/auth_repository.dart`

**Điểm kiểm tra**: US1–US5 và US8 hoạt động độc lập

---

## Phase 9: US6 – Quản trị nội dung và người dùng (P3)

**Mục tiêu**: Admin quản lý nội dung và tài khoản mà không cần phát hành client.

**Kiểm thử độc lập**: Admin thêm/sửa một mục từ vựng và một bài ngữ pháp, người học thấy thay đổi ≤ 5 phút; admin xem/vô hiệu hóa tài khoản; người học thường bị từ chối (quickstart K7).

### Kiểm thử US6

- [ ] T102 [P] [US6] Kiểm thử hợp đồng cho `/admin/*` trong `backend/tests/contract/us6.test.ts`
- [ ] T103 [P] [US6] Kiểm thử tích hợp: người học thường nhận 403 ở mọi `/admin/*`; kích hoạt đơn vị thiếu bản dịch/bài tập bị từ chối; kích hoạt đơn vị mới → xuất hiện trong `GET /path` và chọn được qua `POST /today/extra` của người học phù hợp sau TTL bộ đệm (≤ 60 giây), không xuất hiện ở người học khác kỹ năng, kế hoạch hôm nay đã sinh không đổi (SC-008); sửa đơn vị bỏ một mục/bài tập khỏi payload → phần tử đó thành `inactive`, `study_records`/`review_schedules` liên quan vẫn còn và hợp lệ, phiên mới không chứa phần tử đó; `PUT /admin/placement-questions/active-set` với số câu sai theo trình độ trả 422 `PLACEMENT_SET_INVALID` và bộ hiện hành không đổi; vô hiệu hóa người dùng → đăng nhập và refresh trả 403 `ACCOUNT_DISABLED`, kích hoạt lại thì đăng nhập được; mỗi thay đổi ghi `admin_action_logs` (ai, khi nào, diff đã loại thông tin nhạy cảm); phiên đang học không bị đổi trong `backend/tests/integration/us6-admin.test.ts`

### Triển khai US6

- [ ] T104 [US6] Dịch vụ nội dung admin: tạo/sửa/kích hoạt-vô hiệu hóa/sắp xếp đơn vị học; mục nội dung và bài tập được tạo/sửa lồng trong payload `AdminUnitWrite` của đơn vị (không có route riêng, đúng openapi): phần tử có `id` cập nhật tại chỗ, không có `id` tạo mới, phần tử hiện có vắng mặt chuyển `inactive`, KHÔNG xóa cứng (data-model §2.10); gắn cờ `is_trial`; chạy quy tắc kiểm tra T014 khi kích hoạt; ghi `admin_action_logs` trong `backend/src/services/content.ts`
- [ ] T105 [US6] Route `GET/POST /admin/units`, `GET/PUT /admin/units/{unitId}`, `PUT /admin/units/{unitId}/status` (`POST`/`PUT` nhận cả mục nội dung và bài tập của đơn vị trong cùng payload; FR-030) trong `backend/src/api/admin/units.ts`
- [ ] T106 [US6] Route `GET/POST /admin/placement-questions`, `PUT /admin/placement-questions/{questionId}` (sửa nội dung/position) và `PUT /admin/placement-questions/active-set` (kích hoạt nguyên tử, kiểm tra đúng 20 câu 8/6/6, trả `PLACEMENT_SET_INVALID`); mỗi thay đổi ghi `admin_action_logs` trong `backend/src/api/admin/placement.ts`
- [ ] T107 [US6] Route `GET /admin/users` (tìm kiếm, xem trạng thái), `PUT /admin/users/{userId}/status` (vô hiệu hóa/kích hoạt lại; vô hiệu hóa thu hồi mọi `auth_sessions` trong cùng giao dịch, access token đã cấp còn hiệu lực tối đa 15 phút theo R4; tài khoản `disabled` không thể tự khôi phục; ghi `admin_action_logs`), `GET /admin/action-logs` trong `backend/src/api/admin/users.ts`
- [ ] T108 [P] [US6] Client: các màn hình `/admin/*` (danh sách/soạn đơn vị học gồm `tier`, mục, bài tập, câu hỏi placement, chọn và kích hoạt bộ câu hỏi placement, danh sách người dùng, nhật ký hành động), ẩn UI theo vai trò nhưng bảo vệ thực sự ở server, chuỗi vi/en trong `client/lib/presentation/admin/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: Quản trị hoạt động độc lập

---

## Phase 10: US7 – Quản lý hồ sơ, ngôn ngữ và tài khoản (P3)

**Mục tiêu**: Sửa hồ sơ, đổi ngôn ngữ vi/en, xóa/khôi phục tài khoản với 30 ngày chờ.

**Kiểm thử độc lập**: Đổi ngôn ngữ/hồ sơ được lưu; xóa tài khoản chặn đăng nhập, khôi phục trong 30 ngày, quá hạn thì xóa vĩnh viễn (quickstart K8).

### Kiểm thử US7

- [ ] T109 [P] [US7] Kiểm thử hợp đồng cho `PUT /me/password`, `/account/delete`, `/account/restore` trong `backend/tests/contract/us7.test.ts`
- [ ] T110 [P] [US7] Kiểm thử tích hợp: xóa → `pending_deletion` chặn truy cập dữ liệu; token mới cấp sau khi xóa chỉ gọi được `/account/restore`, `/auth/logout`; phiên khác dùng access token cấp trước khi xóa vẫn truy cập được đến khi token hết hạn (Clock giả lập +15 phút → 401) theo FR-003 đã làm rõ; đăng nhập chỉ cho phép khôi phục trong 30 ngày; đăng ký lại email đang chờ xóa bị từ chối `EMAIL_PENDING_DELETION`; job xóa cứng quá 30 ngày cascade toàn bộ dữ liệu cá nhân và chỉ giữ `aggregate_daily_stats`; đổi ngôn ngữ đổi nội dung bản địa hóa; đổi email thiếu/sai `currentPassword` → 401, trùng tài khoản khác → 409 `EMAIL_TAKEN`, trùng tài khoản chờ xóa → 409 `EMAIL_PENDING_DELETION`; `PUT /me/password` thu hồi mọi phiên khác, giữ phiên hiện tại trong `backend/tests/integration/us7-account.test.ts`

### Triển khai US7

- [ ] T111 [US7] Dịch vụ tài khoản: sửa hồ sơ phần không ảnh hưởng lộ trình (tên hiển thị, email, ngôn ngữ, timezone; mục tiêu, trình độ, thời gian/ngày và kỹ năng ưu tiên đã do T093 xử lý, KHÔNG cài lại); đổi email bắt buộc `currentPassword`, từ chối `EMAIL_TAKEN`/`EMAIL_PENDING_DELETION` (data-model §2.1); đổi mật khẩu thu hồi mọi phiên khác; xóa (đặt `pending_deletion` và `deletion_requested_at`, thu hồi phiên; phản hồi `POST /account/delete` yêu cầu client xóa token ngay trong phiên hiện tại), khôi phục trong 30 ngày; mở rộng `PATCH /me` (đã có từ T047) và thêm route `PUT /me/password`, `POST /account/delete`, `POST /account/restore` trong `backend/src/services/account.ts`, `backend/src/api/account.ts`
- [ ] T112 [US7] Job pg-boss hằng ngày xóa cứng `users` có `status='pending_deletion' AND deletion_requested_at < now() - interval '30 days'` (cascade) và ghi thống kê tổng hợp ẩn danh vào `aggregate_daily_stats` trong `backend/src/jobs/purge-deleted-accounts.ts`
- [ ] T113 [P] [US7] Client: màn hình hồ sơ (sửa thông tin, đổi email yêu cầu nhập mật khẩu hiện tại, đổi mật khẩu, chọn ngôn ngữ vi/en áp dụng ngay cho giao diện), xóa tài khoản có xác nhận, lời mời khôi phục khi đăng nhập tài khoản đang chờ xóa, chuỗi vi/en trong `client/lib/presentation/profile/`, `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`

**Điểm kiểm tra**: Tất cả câu chuyện hoạt động độc lập

---

## Phase 11: Hoàn thiện và việc xuyên suốt

**Mục đích**: Cải thiện ảnh hưởng nhiều câu chuyện

- [ ] T114 [P] Biên soạn nội dung N4 và N3 song ngữ (từ vựng + ngữ pháp, giữ quy tắc ≥ 1 đơn vị 5 phút cho mỗi level × kind) trong `content/units/n4-*.json`, `content/units/n3-*.json`
- [ ] T115 [P] Kiểm thử tải k6 với 1.000 người dùng đồng thời ("tải bình thường" của SC-010) cho `/today`, `/sessions`, `/sessions/*/answers` và `/progress` (mục tiêu p95 < 500 ms phía server, SC-010, quickstart K11) trong `backend/tests/load/today-answers.js`
- [ ] T115a [P] Đo hiệu năng đầu-cuối phía client (SC-010): `integration_test` trên Chrome đo thời gian từ thao tác đến khi hiển thị màn hình bài học và phản hồi câu trả lời, chạy trong lúc T115 tạo tải, khẳng định p95 < 1 giây trong `client/integration_test/perf_lesson_test.dart`
- [ ] T116 [P] Rà soát bảo mật: CSP chặt chẽ cho client web, không rò `correct_choice`/đáp án qua endpoint người học ngoài phiên, thông điệp lỗi không lộ dữ liệu người khác (FR-034, R16) trong `backend/src/api/middleware/` và `client/web/index.html`
- [ ] T117 [P] Kiểm tra mọi chuỗi giao diện có đủ khóa ở cả `client/lib/l10n/app_vi.arb` và `client/lib/l10n/app_en.arb` (script so khớp khóa) trong `client/tool/check_l10n.dart`
- [ ] T118 [P] Dockerfile cho `api` và build tĩnh `flutter build web` phục vụ qua nginx với proxy `/api` và TLS (chuyển hướng HTTP → HTTPS); ghi yêu cầu vận hành cho FR-034 (mã hóa volume PostgreSQL và bản sao lưu, quản lý `JWT_SECRET`, chạy `pnpm admin:create`) trong `backend/Dockerfile`, `client/Dockerfile`, `client/nginx.conf`, `docker-compose.yml`, `backend/README.md`
- [ ] T119 [P] Truy vấn báo cáo chỉ số sản phẩm: SC-003 theo quy tắc data-model §2.11 (hai nhóm có/không làm placement; không có lộ trình `reason ∈ {rebuild_request, goal_change, level_change, placement_retake}` trong 7 ngày đầu), SC-009 (giữ chân ngày 2, ≥ 3 ngày học trong 2 tuần), SC-011 (COUNT `users.from_trial` theo ngày / `trial_lesson_completed`; thêm phân bố `trial_placement_level_*`) trong `backend/src/reports/product-metrics.sql` và `backend/src/reports/README.md`
- [ ] T120 [P] Kiểm tra tương thích trên Chrome, Edge, Firefox, Safari (FR-033): chạy kịch bản K1–K3 trên từng trình duyệt và ghi kết quả trong `specs/001-phase1-mvp/quickstart.md` (mục mới "Tương thích trình duyệt")
- [ ] T121 [P] Kiểm thử khả dụng thủ công với nhóm người dùng thử nghiệm cho SC-004 (≥ 90% hoàn thành bài học đầu mà không cần trợ giúp); ghi kịch bản và kết quả trong `specs/001-phase1-mvp/quickstart.md`
- [ ] T122 Chạy toàn bộ kịch bản kiểm chứng K1–K11 trong `specs/001-phase1-mvp/quickstart.md`, cập nhật các lệnh nếu khác thực tế, và ghi thời gian đo thực tế của K1 (đăng ký → bài học đầu < 5 phút, SC-001)
- [ ] T123 Hoàn tất: `pnpm test`, `flutter test` và lint (T004) đều xanh, không còn cảnh báo lint

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
