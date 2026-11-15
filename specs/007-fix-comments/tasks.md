---

description: "Danh sách nhiệm vụ triển khai: Hoàn thiện trải nghiệm học theo góp ý (xem mật khẩu, luyện đọc/viết, màu năng lực, mặc định theo thời gian, lời khích lệ)"
---

# Nhiệm vụ: Hoàn thiện trải nghiệm học theo góp ý (xem mật khẩu, luyện đọc/viết, màu năng lực, mặc định theo thời gian, lời khích lệ)

**Đầu vào**: Tài liệu thiết kế tại `specs/007-fix-comments/`

**Điều kiện tiên quyết**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-changes.md](contracts/api-changes.md), [contracts/competency-rules.md](contracts/competency-rules.md), [contracts/encouragement-catalog.md](contracts/encouragement-catalog.md), [contracts/practice-content.md](contracts/practice-content.md), [quickstart.md](quickstart.md)

**Kiểm thử**: CÓ. Hiến pháp yêu cầu kiểm thử engine bằng hồ sơ đại diện; plan và quickstart cam kết kiểm thử đơn vị, hợp đồng, tích hợp PostgreSQL và widget test cho từng câu chuyện. Trong mỗi câu chuyện, viết kiểm thử TRƯỚC và bảo đảm chúng ĐỎ trước khi hiện thực.

**Tổ chức**: Nhiệm vụ nhóm theo câu chuyện người dùng để mỗi câu chuyện hiện thực và kiểm thử độc lập được.

## Quy tắc "mỗi nhiệm vụ một file"

Theo yêu cầu "Keep each task small and limited to one file":

- Mỗi nhiệm vụ có file chỉ **tạo mới hoặc sửa đúng một file** (đường dẫn nêu ở đầu mô tả). Chỗ nào thiết kế cần sửa nhiều file thì được tách thành nhiều nhiệm vụ nối tiếp.
- Khi cùng một file bị nhiều nhiệm vụ chạm tới (ví dụ `openapi.yaml`, `today_screen.dart`, `services/daily-plan.ts`, `app_vi.arb`), các nhiệm vụ đó **không bao giờ đánh `[P]` với nhau** và PHẢI làm theo thứ tự ID.
- **Ngoại lệ duy nhất**: nhiệm vụ mang nhãn **(lệnh)** chạy một công cụ (sinh API client, sinh `app_localizations*.dart`, chạy seed/kiểm thử) và không sửa tay file nào; thứ nó ghi ra là mã sinh tự động hoặc kết quả chạy.

## Định dạng: `[ID] [P?] [Story] Mô tả kèm đường dẫn file`

- **[P]**: Chạy song song được (khác file, không phụ thuộc nhiệm vụ chưa xong).
- **[Story]**: Câu chuyện người dùng (US1…US5) mà nhiệm vụ thuộc về. Setup, Foundational và Polish không có nhãn này.
- Mọi đường dẫn tính từ thư mục gốc kho mã `D:\my_owner_workspace\japanese-learning` (tài liệu dùng dấu `/`).
- "(phụ thuộc Txxx)" nêu phụ thuộc cụ thể khi không hiển nhiên từ thứ tự phase.

## Quy ước đường dẫn (ứng dụng web: `backend/` + `client/` + `content/`)

- Backend: `backend/src/{domain,engine,db,db/repositories,services,api,reports,seed}`, kiểm thử `backend/tests/{unit,contract,integration,fixtures}`.
- Client Flutter: `client/lib/{data,domain,presentation,l10n}`, kiểm thử `client/test/`.
- Nội dung: `content/{units,schema,topics.json}`.
- Hợp đồng duy nhất: `specs/001-phase1-mvp/contracts/openapi.yaml` (KHÔNG tạo file OpenAPI thứ hai).

## Ghi chú chạy kiểm thử

- Kiểm thử cần PostgreSQL: dùng PostgreSQL nhúng (không Docker) và `vitest --project db` — xem memory "Chạy test backend cần DB". Năm test spec 003 (`kanji-admin`, `kanji-us5`) đỏ sẵn tại HEAD, KHÔNG phải hồi quy của spec 007 — ghi lại ở T001 để so sánh.
- Client: `cd client && flutter test <đường-dẫn>`; kiểm tra l10n: `cd client && dart run tool/check_l10n.dart`.
- Danh sách kiểm tay trước phát hành ở [quickstart.md §3](quickstart.md) (IME thật, duyệt giọng điệu khích lệ, duyệt nội dung 12 bài, mù màu, màn hẹp) KHÔNG nằm trong nhiệm vụ nào; người phát hành tự thực hiện.
- Hai điểm cần chủ dự án quyết định/cung cấp (không phải nhiệm vụ mã): **C1** thủ tục phạm vi giai đoạn (kế hoạch đã biện minh, dự thảo hiến pháp 1.3.0 ở [research.md §Q2](research.md)); **C2** đã quyết định — 12 bài luyện đọc/viết (T064–T075) được biên soạn tham khảo nguồn công khai chính thống và giáo trình nổi tiếng, viết mới không sao chép nguyên văn (xem ghi chú trước T064); chủ dự án duyệt cuối. Có đủ 12 bài vẫn là **điều kiện cứng để phát hành US2**.
- Không có nhiệm vụ cho `ClassPath*.skills` ở giao diện giáo viên (C5): API chấp nhận `reading/writing` nhưng `client/lib/presentation/teacher/class_path_screen.dart` giữ nguyên ở bản này. Đổi mật khẩu trong Hồ sơ (`account_security_sections.dart`) cũng ngoài phạm vi (không bắt buộc, [research.md §P14](research.md)).

---

## Phase 1: Setup (hạ tầng dùng chung)

**Mục đích**: Chốt chuẩn so sánh TRƯỚC khi sửa bất kỳ mã nào.

- [X] T001 (lệnh) Chạy và ghi lại kết quả baseline TRƯỚC khi sửa mã: `cd backend && pnpm typecheck && pnpm test:unit` và `pnpm vitest run --project db tests/integration/org-regression-api.test.ts tests/contract/us2.test.ts tests/integration/us2-lesson.test.ts`; `cd client && flutter analyze && flutter test`. Ghi danh sách test đỏ sẵn (5 test spec 003: `kanji-admin`, `kanji-us5`) vào mô tả commit/ghi chú để phân biệt với hồi quy về sau.
  - **Baseline đo ngày 2026-11-12 (HEAD `283b362`, chưa sửa mã)**: `tsc --noEmit` sạch; unit 44 file / 723 test xanh; DB (3 file nêu trên) 3 file / 24 test xanh; `flutter analyze` không lỗi; `flutter test` 412 test xanh.
  - **Test đỏ sẵn tại HEAD (spec 003, không phải hồi quy spec 007)** — chạy `kanji-admin` + `kanji-us5`: 4 test đỏ (số thực đo, memory ghi 5): `kanji-us5.test.ts` › "GET /admin/topics?skill=kanji trả đúng 6 chủ đề Kanji…"; `kanji-admin.test.ts` › "chữ đã có ở bài active khác → 422…", "bài active vừa kích hoạt xuất hiện ngay với người học N4…", "sửa nghĩa chữ đang có lịch ôn và bỏ một bài tập…".
  - Môi trường: máy không có `pnpm` trên PATH nên dùng trực tiếp `npx tsc` / `npx vitest`; DB test dùng PostgreSQL nhúng cổng 5434, CSDL `jl_test2`.
- [X] T002 Tạo `backend/tests/fixtures/golden/generate-plans-pre-practice.ts` theo khuôn `generate-plans-pre-kanji.ts` cùng thư mục: nạp `loadLearnerProfiles()` (chỉ hồ sơ CŨ), dùng danh mục mô phỏng CÓ đơn vị Kanji (`loadSimCatalog(true)`) và biến đổi ứng viên bằng đúng `kanjiSlot` (`applyKanjiSlot`) như trong `backend/tests/unit/kanji-regression-golden.test.ts`; ghi `{ days: SIMULATION_DAYS, profiles }` vào `plans-pre-practice.json`. Ghi chú đầu file: PHẢI chạy trên engine CHƯA thêm `applyPracticeSlot`; lệnh chạy `cd backend && pnpm exec tsx tests/fixtures/golden/generate-plans-pre-practice.ts`.
- [X] T003 (lệnh) Chạy script T002 (khi `backend/src/engine/daily-plan.ts` còn chưa có `applyPracticeSlot`) để sinh `backend/tests/fixtures/golden/plans-pre-practice.json` — chuẩn so sánh cho bất biến I2 (người không chọn luyện ⇒ kế hoạch 14 ngày giống hệt). Commit file JSON trước khi làm bất kỳ nhiệm vụ nào sửa engine. (phụ thuộc T002)

---

## Phase 2: Foundational (điều kiện chặn mọi câu chuyện)

**Mục đích**: Mở rộng enum `skill`, điều kiện luyện thuần hàm, hợp đồng OpenAPI 1.14.0, API client sinh lại, chủ đề nội dung, loader hồ sơ mẫu và các chuỗi/nhánh `switch` bị vỡ khi enum mở rộng — mọi câu chuyện đều dùng.

**⚠️ QUAN TRỌNG**: Chưa câu chuyện nào được bắt đầu khi phase này chưa xong.

### Cơ sở dữ liệu và miền (backend)

- [X] T004 [P] Tạo `backend/tests/unit/practice.test.ts` (viết TRƯỚC, đỏ): kiểm `PRACTICE_MIN_DAILY_MINUTES === 30`; `isPracticeEligible(null)`, `(0)`, `(5)`, `(10)`, `(15)` là `false` và `(30)` là `true`; `effectiveSkills` theo bảng chân trị [data-model.md §3.1](data-model.md) — `skills` chứa `reading/writing` + phút 30 ⇒ giữ nguyên; + phút 5/10/15 ⇒ bỏ `reading`, `writing`; không chứa + phút bất kỳ ⇒ giữ nguyên; không đổi thứ tự các kỹ năng còn lại; không sửa mảng đầu vào (hàm thuần). Import từ `../../src/domain/practice.js`.
- [X] T005 Tạo migration `backend/src/db/migrations/0006_practice_skills.sql` đúng nội dung [data-model.md §1](data-model.md#1-thay-đổi-lưu-trữ): `ALTER TYPE skill ADD VALUE IF NOT EXISTS 'reading';` và `ALTER TYPE skill ADD VALUE IF NOT EXISTS 'writing';` kèm chú thích đầu file (tách file riêng như `0002_kanji_skill.sql`: không dùng giá trị mới trong cùng giao dịch). KHÔNG bảng/cột mới. Kiểm tra `backend/src/db/migrate.ts` nhận file mới theo thứ tự tên.
- [X] T006 Cập nhật `backend/src/db/schema.ts` dòng 35: `skill = pgEnum('skill', ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'])`. (phụ thuộc T005)
- [X] T007 Cập nhật `backend/src/domain/types.ts`: `SKILLS = ['vocabulary','grammar','kanji','reading','writing']`; thêm `export const PRACTICE_SKILLS = ['reading', 'writing'] as const;` và `export type PracticeSkill`; thêm `PRACTICE_LOCKED` vào `ERROR_CODES`. `PLACEMENT_SKILLS` và `TRIAL_SKILLS` KHÔNG đổi (luyện đọc/viết ngoài bài kiểm tra trình độ và học thử).
- [X] T008 Tạo `backend/src/domain/practice.ts`: `export const PRACTICE_MIN_DAILY_MINUTES = 30`; `isPracticeEligible(dailyMinutes: number | null | undefined): boolean` = `(dailyMinutes ?? 0) >= 30`; `effectiveSkills(skills, dailyMinutes)` = giữ `skills` nếu đủ điều kiện, ngược lại loại `reading`/`writing` (trả mảng mới, giữ thứ tự). Làm cho T004 xanh. (phụ thuộc T007)
- [X] T009 Cập nhật `backend/src/domain/profile-validation.ts` quanh dòng 82: `skillsSchema` chấp nhận `reading`, `writing` (đã dựa trên `SKILLS`; kiểm tra) và sửa thông điệp lỗi liệt kê kỹ năng hợp lệ cho khớp ("từ vựng, ngữ pháp, Kanji, luyện đọc, luyện viết"); `prioritizedSkill` (dòng 160) chấp nhận hai giá trị mới. KHÔNG kiểm tra phút ở đây (kiểm ở dịch vụ, T084/T085). (phụ thuộc T007)
- [X] T010 Cập nhật `backend/src/domain/content-validation.ts` hàm `validateCatalog` (vòng `for (const kind of SKILLS)` quanh dòng 556): TẠM THỜI bỏ qua `PRACTICE_SKILLS` (ví dụ `SKILLS.filter((k) => !(PRACTICE_SKILLS as readonly string[]).includes(k))`) kèm chú thích `// TẠM: gỡ ở T076 khi đã có 12 đơn vị luyện` để mở rộng enum KHÔNG làm seed/kiểm thử tích hợp của mọi câu chuyện khác đỏ. (phụ thuộc T007)
- [X] T011 [P] Cập nhật `content/schema/topics.schema.json`: thuộc tính `skill` của chủ đề thêm hai giá trị `reading`, `writing` (giữ nguyên các ràng buộc khác).
- [X] T012 Cập nhật `content/topics.json`: thêm 6 chủ đề đúng khuôn các chủ đề hiện có, tên song ngữ vi/en: `reading-n5-daily-life` (N5, `reading`), `reading-n4-work-life` (N4, `reading`), `reading-n3-society` (N3, `reading`), `writing-n5-greetings` (N5, `writing`), `writing-n4-daily-actions` (N4, `writing`), `writing-n3-workplace` (N3, `writing`). Khóa chủ đề KHÔNG trùng khóa từ vựng/ngữ pháp/Kanji hiện có ([practice-content.md §1](contracts/practice-content.md)). (phụ thuộc T011)

### Kiểm thử nền tảng

- [X] T013 [P] Mở rộng `backend/tests/integration/migration.test.ts`: sau migrate, `SELECT unnest(enum_range(NULL::skill))` có thêm `reading`, `writing`; số dòng mọi bảng cũ không đổi; `learning_profiles.skills` của hồ sơ có sẵn không đổi; chạy lại migration (idempotent nhờ `IF NOT EXISTS`) không lỗi. (phụ thuộc T005)
- [X] T014 [P] Cập nhật `backend/tests/fixtures/learner-profiles/index.ts`: thêm tiền tố `PRACTICE_PREFIX = 'practice-'`, `COMPETENCY_PREFIX = 'competency-'`, `ENCOURAGEMENT_PREFIX = 'encouragement-'` (xuất ra, kèm chú thích như `REWARD_PREFIX`); LOẠI ba tiền tố này khỏi `loadLearnerProfiles()` để golden `plans-pre-org.json`, `plans-pre-kanji.json`, `plans-pre-practice.json` không lệch; thêm `loadPracticeProfiles()`, `loadCompetencyProfiles()`, `loadEncouragementProfiles()` dùng `readProfilesWithPrefix`; mở rộng `loadLearnerProfile(id)` tìm cả ba nhóm mới.
- [X] T015 [P] Cập nhật `backend/tests/fixtures/golden/api-snapshot.ts`: thêm hàm `stripNewOptionalFields(value)` đệ quy bỏ các khóa `competency` và `encouragement` (trường tùy chọn mới của 1.14.0) khỏi `body` của `path`/`progress`/`today` trước khi chụp/so sánh, để golden `api-pre-org.json` và `org-regression-api.test.ts` vẫn chứng minh "chỉ thêm trường tùy chọn, phần còn lại không đổi" (QS6). Dùng cho cả script sinh lẫn kiểm thử hồi quy.

### Hợp đồng OpenAPI 1.14.0 (cùng một file, làm tuần tự)

- [X] T016 Cập nhật `specs/001-phase1-mvp/contracts/openapi.yaml` (1/4 – nền): `info.version` → `1.14.0`; dán nhật ký 1.14.0 vào `info.description` đúng [api-changes.md §1](contracts/api-changes.md#1-nhật-ký-thay-đổi-dán-vào-infodescription-đổi-infoversion-thành-1140); `Skill` → `enum: [vocabulary, grammar, kanji, reading, writing]`; ghi chú `TrialContent`/`PlacementQuestionSet` "không có `reading/writing`"; thêm `PRACTICE_LOCKED` vào ví dụ của `Error.code` và mô tả response `403` (kèm `fields.minimumDailyMinutes = "30"`); nếu route phiên (`POST /sessions`, `/sessions/{id}/answers`, `/intervals`, `/complete`) chưa tham chiếu response `403` thì thêm.
- [X] T017 Cập nhật `specs/001-phase1-mvp/contracts/openapi.yaml` (2/4 – gợi ý): thêm route `GET /study-defaults` (`operationId: getStudyDefaults`, tag `onboarding`, chỉ `200` và `401`) và schema `StudyDefaults` (`required: [items, practiceMinDailyMinutes]`; `items[].dailyMinutes` enum `[5, 10, 15, 30]`; `items[].skills` là mảng `Skill`) đúng [api-changes.md §4](contracts/api-changes.md#4-get-study-defaults-route-mới). (phụ thuộc T016)
- [X] T018 Cập nhật `specs/001-phase1-mvp/contracts/openapi.yaml` (3/4 – năng lực): thêm schema `CompetencyLevel` (`enum: [good, needs_improvement, insufficient]`); `PlanItem.competency` (nullable, `allOf` `CompetencyLevel`); `ProgressSummary.competency` (`required: [skills, topics]`, mỗi phần tử `required: [skill, level, answered]` / `[topicId, skill, level, answered]`, `answered` `minimum: 0`, `accuracy` nullable `0..1`); `PathDetail.items[].competency` — đúng [api-changes.md §5](contracts/api-changes.md#5-năng-lực-competency). Tất cả trường MỚI là tùy chọn (không vào `required` của schema cha). (phụ thuộc T017)
- [X] T019 Cập nhật `specs/001-phase1-mvp/contracts/openapi.yaml` (4/4 – khích lệ): thêm `DailyPlan.encouragement` (object nullable, `required: [state, message]`, `state` enum `[not_started, in_progress, day_completed, streak, welcome_back, behind_target]`, `message` string) đúng [api-changes.md §6](contracts/api-changes.md#6-dailyplanencouragement-trong-get-today); trường tùy chọn. (phụ thuộc T018)
- [X] T020 (lệnh) Sinh lại API client Dart từ OpenAPI 1.14.0 đúng các bước trong `client/lib/data/api/README.md` (openapi-generator `dart-dio` → `dart run build_runner build` trong `client/lib/data/api/generated` → `flutter pub get` → `dart run tool/patch_generated_api.dart`); xác nhận `Skill.reading`, `Skill.writing`, `getStudyDefaults`, `CompetencyLevel`, `DailyPlanEncouragement` có trong mã sinh. Không sửa tay file sinh. (phụ thuộc T019)

### Chuỗi và nhánh `switch` bị vỡ khi enum mở rộng (client)

- [X] T021 [P] Thêm vào `client/lib/l10n/app_vi.arb` hai khóa theo đúng khuôn `progressWeakSkillKanji` (kèm khối `@…`): `progressWeakSkillReading` = "Đọc", `progressWeakSkillWriting` = "Viết".
- [X] T022 [P] Thêm vào `client/lib/l10n/app_en.arb` hai khóa tương ứng: `progressWeakSkillReading` = "Reading", `progressWeakSkillWriting` = "Writing".
- [X] T023 (lệnh) Sinh lại `client/lib/l10n/app_localizations*.dart` bằng `cd client && flutter gen-l10n`. (phụ thuộc T021, T022)
- [X] T024 Cập nhật `client/lib/presentation/progress/progress_screen.dart` quanh dòng 347–349: biểu thức `switch` theo `Skill` thêm `Skill.reading => l10n.progressWeakSkillReading` và `Skill.writing => l10n.progressWeakSkillWriting` (nhánh bắt buộc vì enum mở rộng làm `switch` không còn đầy đủ). (phụ thuộc T020, T023)

**Checkpoint**: Foundation sẵn sàng.

- [X] T025a Cập nhật `backend/tests/unit/content-files.test.ts` (phát sinh từ T025, mỗi nhiệm vụ một file): sau T012, 6 chủ đề luyện đọc/viết chưa có đơn vị nào nên hai test "mỗi mảng N4 và N3 có ít nhất một đơn vị…" và "mỗi mảng có ít nhất một câu placement hoặc một đơn vị…" đỏ; TẠM THỜI loại chủ đề có `skill ∈ PRACTICE_SKILLS` khỏi hai vòng kiểm tra, kèm chú thích `// TẠM: gỡ ở T076a`. (phụ thuộc T012)
- [X] T025b Cập nhật `backend/tests/integration/seed.test.ts` (phát sinh từ T025): số chủ đề sau seed là 26 (20 cũ + 6 chủ đề luyện của T012), số đơn vị vẫn 21 cho tới T064–T075. (phụ thuộc T012)
- [X] T025 (lệnh) Kiểm tra nền: `cd backend && pnpm typecheck && pnpm test:unit` (T004 xanh, các test cũ không đổi) và `pnpm vitest run --project db tests/integration/migration.test.ts tests/integration/seed.test.ts`; `cd client && flutter analyze && flutter test` (không lỗi biên dịch do enum mới). Mọi lỗi mới so với baseline T001 PHẢI sửa trước khi sang Phase 3 (sửa bằng nhiệm vụ riêng ghi thêm vào đây, mỗi nhiệm vụ một file).
  - **Kết quả đo ngày 2026-11-14**: `tsc --noEmit` sạch; unit 45 file / 745 test xanh (T004 xanh; 2 test đỏ của `content-files.test.ts` được sửa ở T025a); DB `migration` + `seed` + `org-regression-api` + `us2` + `us2-lesson` xanh (66 + 13 test; `seed.test.ts` sửa ở T025b); `flutter analyze` không lỗi, `flutter test` 412 test xanh (bằng baseline), `dart run tool/check_l10n.dart` hợp lệ (932 khóa).

---

## Phase 3: User Story 1 - Tùy chọn mặc định theo thời gian học mỗi ngày (Ưu tiên: P1) 🎯 MVP

**Mục tiêu**: Khi chọn/đổi quỹ thời gian 5/10/15/30 phút, người học thấy bộ kỹ năng gợi ý (có nhãn "gợi ý theo thời gian bạn có"), đổi/bỏ được từng lựa chọn; lựa chọn đã chỉnh không bị ghi đè ngầm — chỉ có lời mời "Áp dụng / Giữ nguyên".

**Kiểm thử độc lập**: `GET /study-defaults` trả đúng bảng 4 dòng; đi qua onboarding với từng mức thời gian và quan sát bộ mặc định; chỉnh tay rồi đổi thời gian ⇒ giữ nguyên + hiện lời mời; ở Hồ sơ đổi phút ⇒ `skills` đã lưu không đổi cho tới khi bấm Áp dụng.

> Ghi chú độc lập với US2: bảng gợi ý ở mức 30 chứa `reading`/`writing`, nhưng màn onboarding chỉ điền những kỹ năng nằm trong `OnboardingOptions.skills` (US2 mới thêm hai kỹ năng này vào lựa chọn, T089). Do đó US1 phát hành riêng vẫn đúng (mức 30 gợi ý từ vựng, ngữ pháp, Kanji).

### Kiểm thử cho User Story 1 (viết TRƯỚC, phải ĐỎ) ⚠️

- [X] T026 [P] [US1] Tạo `backend/tests/unit/study-defaults.test.ts`: bảng đúng [data-model.md §3.5](data-model.md) (5 → `[vocabulary]`; 10 → `[vocabulary, grammar]`; 15 → `[vocabulary, grammar, kanji]`; 30 → `[vocabulary, grammar, kanji, reading, writing]`); I8: tập của mức nhỏ là tập con của mức lớn hơn; `reading`/`writing` CHỈ ở mức 30 (FR-022); `practiceMinDailyMinutes === PRACTICE_MIN_DAILY_MINUTES`; mô phỏng kế hoạch bằng `loadSimCatalog`/`simulatePlans` (`backend/tests/fixtures/golden/simulate-plans.ts`) với hồ sơ `newcomer-10min` đổi `dailyMinutes` và `skills` theo từng dòng bảng: mọi ngày `estimatedMinutes ≤ dailyMinutes` (US1.5).
- [X] T027 [P] [US1] Tạo `backend/tests/contract/fix-us1.test.ts` (theo khuôn `backend/tests/contract/us1.test.ts`, dùng `backend/tests/contract/client.ts`): `GET /study-defaults` có token → `200`, đúng 4 dòng theo thứ tự tăng dần và `practiceMinDailyMinutes = 30`; không token → `401`; học viên thuộc lớp cũng `200` (đọc bảng tĩnh); `PATCH /me {"dailyMinutes":15}` KHÔNG đổi `skills` đã lưu (FR-024, máy chủ không tự áp gợi ý).
- [X] T028 [P] [US1] Tạo `client/test/onboarding/suggestion_test.dart` kiểm hàm thuần `reconcileSuggestion` theo bảng ([research.md §P11](research.md)): kỹ năng hiện tại bằng gợi ý của phút cũ ⇒ điền gợi ý phút mới (`filled = true`, không lời mời); rỗng ⇒ điền; đã chỉnh (khác gợi ý phút cũ) ⇒ giữ nguyên + trả lời mời với gợi ý phút mới; thứ tự kỹ năng không ảnh hưởng so sánh; chỉ giữ kỹ năng nằm trong danh sách lựa chọn khả dụng; hàm `isPracticeLockedFor(minutes, threshold)`.
- [X] T029 [P] [US1] Tạo `client/test/onboarding/onboarding_suggestion_flow_test.dart` (dùng `client/test/support/fake_backend.dart`): ở onboarding chọn 10 phút ⇒ bước kỹ năng điền sẵn Từ vựng + Ngữ pháp kèm nhãn "gợi ý theo thời gian bạn có"; chọn lại 15 (chưa chỉnh) ⇒ điền thêm Kanji; chọn 15, bỏ Ngữ pháp, đổi sang 30 ⇒ lựa chọn đã chỉnh giữ nguyên và hiện lời mời "Gợi ý mới cho 30 phút" với nút "Áp dụng"/"Giữ nguyên"; bấm Áp dụng ⇒ điền theo gợi ý; hoàn tất mà không đổi gì ngoài thời gian ⇒ gửi đúng bộ gợi ý.
- [X] T030 [P] [US1] Tạo `client/test/profile/suggestion_invite_test.dart`: ở Hồ sơ đổi quỹ thời gian và lưu ⇒ hiện lời mời gợi ý mới; TRƯỚC khi bấm "Áp dụng" không có yêu cầu `PATCH` nào chứa `skills`; "Áp dụng" gửi `PATCH {skills: …}`; "Giữ nguyên" ẩn lời mời và không gửi gì; học viên thuộc lớp (điều khiển bị khóa, `CLASS_MANAGED`) KHÔNG thấy nút Áp dụng cho trường bị khóa (FR-025).

### Hiện thực backend cho User Story 1

- [X] T031 [P] [US1] Tạo `backend/src/domain/study-defaults.ts`: hằng bảng `STUDY_DEFAULTS` đúng [data-model.md §3.5](data-model.md) (kiểu `{ dailyMinutes: 5|10|15|30; skills: Skill[] }[]`, thứ tự tăng dần), `suggestedSkills(dailyMinutes)`, và `studyDefaultsDto()` trả `{ practiceMinDailyMinutes: PRACTICE_MIN_DAILY_MINUTES, items }`. Hàm thuần, không truy vấn CSDL. Làm cho T026 xanh. (phụ thuộc T008)
- [X] T032 [US1] Tạo `backend/src/api/study-defaults.ts`: handler `GET /study-defaults` theo khuôn các route đọc khác (đã đăng nhập, mọi vai trò; `401` khi thiếu token) trả `studyDefaultsDto()`; thêm header cache theo phiên nếu các route tĩnh khác có. (phụ thuộc T031)
- [X] T033 [US1] Cập nhật `backend/src/api/routes.ts`: đăng ký route của T032. Làm cho T027 xanh. (phụ thuộc T032)
- [X] T034 [P] [US1] Cập nhật `backend/tests/fixtures/authz-matrix.json`: thêm dòng `GET /study-defaults` = mọi học viên đã đăng nhập (và admin) được phép, khách `401` (đúng [api-changes.md §8](contracts/api-changes.md#8-tương-thích)); chạy `backend/tests/contract/authz-matrix.ts` và `backend/tests/unit/authz-matrix-schema.test.ts` xác nhận khớp.

### Hiện thực client cho User Story 1

- [X] T035 [P] [US1] Tạo `client/lib/domain/study_suggestion.dart`: hàm thuần `reconcileSuggestion({required Set<String> currentSkills, required int? oldMinutes, required int newMinutes, required Map<int, List<String>> table, required List<String> availableSkills})` trả `SuggestionResult { skills, filled, invite }` theo [research.md §P11](research.md) (bằng gợi ý phút cũ hoặc rỗng ⇒ điền gợi ý phút mới; ngược lại giữ nguyên và `invite` = gợi ý phút mới lọc theo `availableSkills`); và `isPracticeLockedFor(int? minutes, int threshold)` = `(minutes ?? 0) < threshold`. Làm cho T028 xanh.
- [X] T036 [P] [US1] Tạo `client/lib/data/study_defaults_repository.dart`: lớp `StudyDefaults { practiceMinDailyMinutes, Map<int, List<String>> bySkills }` dựng từ phản hồi `getStudyDefaults` của API client sinh, và `studyDefaultsProvider` (Riverpod `FutureProvider`, cache theo phiên đăng nhập, theo khuôn các provider trong `client/lib/data/api_providers.dart`). Không lưu vào `LocalStore`.
- [X] T037 [P] [US1] Thêm khóa vào `client/lib/l10n/app_vi.arb` (kèm khối `@…`, đặt chung nhóm với khóa onboarding): `onboardingSuggestionLabel` = "Gợi ý theo thời gian bạn có"; `suggestionInviteTitle` (tham số `minutes`) = "Gợi ý mới cho {minutes} phút"; `suggestionInviteBody` (tham số `skills`) = "Bộ kỹ năng gợi ý: {skills}"; `suggestionApply` = "Áp dụng"; `suggestionKeep` = "Giữ nguyên".
- [X] T038 [P] [US1] Thêm các khóa tương ứng vào `client/lib/l10n/app_en.arb`: "Suggested for the time you have"; "New suggestion for {minutes} minutes"; "Suggested skills: {skills}"; "Apply"; "Keep mine".
- [X] T039 [US1] (lệnh) Sinh lại `client/lib/l10n/app_localizations*.dart` bằng `cd client && flutter gen-l10n`. (phụ thuộc T037, T038)
- [X] T040 [US1] Cập nhật `client/lib/presentation/onboarding/onboarding_screen.dart`: đọc `studyDefaultsProvider`; ở bước thời gian (khi người học chọn `dailyMinutes`) gọi `reconcileSuggestion` với `_form.skills`, phút cũ/mới và `OnboardingOptions.skills`; nếu `filled` thì `_update(_form.copyWith(skills: …))` và hiện nhãn `onboardingSuggestionLabel` ở bước kỹ năng; nếu có `invite` thì hiện thẻ lời mời với `suggestionApply` (điền gợi ý) / `suggestionKeep` (ẩn lời mời, giữ lựa chọn). Lưu nháp onboarding như hiện nay (không thêm cờ "đã chỉnh"). Lỗi tải bảng gợi ý ⇒ không điền, màn vẫn dùng được. Làm cho T029 xanh. (phụ thuộc T035, T036, T039)
- [X] T041 [US1] Cập nhật `client/lib/presentation/profile/profile_screen.dart`: sau khi lưu quỹ thời gian mới thành công, tính `reconcileSuggestion` với `skills` đã lưu và phút cũ/mới; nếu có `invite` thì hiện thẻ lời mời (trạng thái cục bộ `State`, mất khi rời màn); "Áp dụng" gửi `PATCH /me {skills}` qua repository hồ sơ hiện có; "Giữ nguyên" chỉ ẩn thẻ; KHÔNG hiện thẻ cho học viên đang bị lớp khóa trường `skills` (`CLASS_MANAGED`, dùng cùng cờ khóa mà màn đang dùng cho `locked_control.dart`). Làm cho T030 xanh. (phụ thuộc T035, T036, T039)
  - **Ghi chú hiện thực (2026-11-14)**: màn `profile_screen.dart` KHÔNG có điều khiển quỹ thời gian — phút/kỹ năng được đổi ở màn "Điều chỉnh kế hoạch" (`client/lib/presentation/path/plan_adjust_screen.dart`, mở từ Hồ sơ), nên lời mời được hiện ở đó (đúng chỗ `PATCH /me {dailyMinutes}` được gọi); `profile_screen.dart` giữ nguyên. Học viên thuộc lớp thấy bản khóa (`_ClassManagedAdjust`) nên không bao giờ có nút Áp dụng (FR-025). Thẻ lời mời dùng chung của onboarding và màn này nằm ở `client/lib/presentation/shared/suggestion_invite_card.dart` (file mới, ngoài danh sách). Test T030 vẫn ở `client/test/profile/suggestion_invite_test.dart`.

**Checkpoint**: US1 chạy độc lập (T026–T030 xanh; `flutter test test/onboarding test/profile/suggestion_invite_test.dart`).

---

## Phase 4: User Story 2 - Luyện đọc và luyện viết cho người học từ 30 phút mỗi ngày (Ưu tiên: P1)

**Mục tiêu**: Hai loại bài mới `reading`/`writing` chạy trên máy móc đơn vị–phiên–chấm–tiến độ hiện có; chỉ người có quỹ thời gian hiệu lực ≥ 30 phút dùng được (kiểm ở máy chủ, kể cả gọi API trực tiếp); nằm trong kế hoạch ngày do Learning Engine sinh, tổng không vượt quỹ; người dưới 30 phút thấy mục khóa kèm lý do.

**Kiểm thử độc lập**: Hai học viên 15 và 30 phút: người 30 phút thấy/mở/chấm được luyện đọc/viết, người 15 phút bị khóa kèm lời giải thích và `POST /sessions` trực tiếp trả `403 PRACTICE_LOCKED`; nâng quỹ thời gian lên 30 thì dùng lại được.

### Kiểm thử cho User Story 2 (viết TRƯỚC, phải ĐỎ) ⚠️

- [X] T042 [P] [US2] Tạo `backend/tests/unit/content-validation-practice.test.ts` theo khuôn `backend/tests/unit/content-validation-kanji.test.ts`: mỗi quy tắc PR1…PR9 ở [practice-content.md §4](contracts/practice-content.md#4-quy-tắc-kiểm-tra-validateunit) có ca hợp lệ và ca vi phạm với `path` + thông điệp tiếng Việt: PR1 (`tier = core`, `goalTags` không rỗng, `estMinutes ∈ {5,10,15}`); PR2 (đúng 1 mục `reading`; `japanese` 20–400 ký tự, ≤ 200 khi 5 phút; có bản dịch vi+en); PR3 (2–5 bài `multiple_choice`, 3–4 lựa chọn, `correct_index` hợp lệ, không `item`); PR4 (3–6 mục `writing` có `reading` kana và `meaning` vi+en; số `fill_blank` = số mục; không `item`); PR5 (`accepted_answers` không rỗng, không trùng sau chuẩn hóa NFKC); PR6 (reading `n×60 ≤ est×60`; writing `n×45 ≤ est×60`); PR7 (phản hồi đúng/sai vi+en không rỗng); PR8 (ký tự Nhật có glyph trong phông); PR9 (không `kanjiDetails`, không thuộc chủ đề Kanji); và `validateCatalog` yêu cầu mỗi (trình độ × reading/writing) ≥ 1 đơn vị 5 phút (sau khi T076 gỡ ngoại lệ tạm).
- [X] T043 [P] [US2] Tạo `backend/tests/unit/daily-plan-practice.test.ts` theo khuôn `backend/tests/unit/daily-plan-kanji.test.ts`: `applyPracticeSlot` — no-op khi `skills` không chứa `reading`/`writing` hoặc không có ứng viên luyện vừa quỹ; ngày đầu (`lastNewUnitPlanKinds = null`) đưa ứng viên luyện lên vị trí 0 và bắt đầu bằng `reading`; chỉ đưa lên khi kế hoạch có bài mới gần nhất KHÔNG chứa luyện (`PRACTICE_EVERY_N_PLANS = 2`); luân phiên `reading` ↔ `writing`, hết loại đối lập thì lấy loại còn lại; `prioritizedSkill ∈ {reading, writing}` ⇒ lên mỗi ngày; phần còn lại giữ thứ tự. Thuộc tính I1 trên quỹ 5/10/15/30 × 14 ngày (qua `applyPracticeSlot` → `applyKanjiSlot` → `planDailyPlan`): tổng `estMinutes ≤ B`, ôn ≤ 60% `B`, mỗi mục 1–15 phút. I2: `skills` không chứa luyện ⇒ đầu ra y hệt đầu vào.
- [X] T044 [P] [US2] Tạo `backend/tests/unit/practice-regression-golden.test.ts` theo khuôn `backend/tests/unit/kanji-regression-golden.test.ts`: nạp `plans-pre-practice.json` (T003); biến đổi ứng viên bằng `applyPracticeSlot` rồi `applyKanjiSlot` (cùng cách dịch vụ dùng); khẳng định kế hoạch 14 ngày của MỌI hồ sơ trong `loadLearnerProfiles()` giống hệt ảnh chụp (I2, SC-006 spec 003 mở rộng) và tập hồ sơ trong golden khớp tập hồ sơ hiện có.
- [X] T045 [P] [US2] Tạo `backend/tests/fixtures/learner-profiles/practice-30min.json` (khuôn các hồ sơ khác; `id: "practice-30min"`): N5, `dailyMinutes: 30`, `skills: ["vocabulary","grammar","kanji","reading","writing"]`, `prioritizedSkill: null`, `language: "vi"`, `asOf` cố định, không lịch sử; `expected.dailyPlan` nêu các bất biến mong đợi (có `reading` ở ngày đầu, `writing` ở lần luyện kế, tổng ≤ 30). Thuộc nhóm `practice-` nên KHÔNG lẫn vào `loadLearnerProfiles()` (T014).
- [X] T046 [P] [US2] Tạo `backend/tests/contract/fix-us2.test.ts` (khuôn `backend/tests/contract/kanji-us2.test.ts`): `$L30` bật luyện — `GET /today` qua vài ngày giả lập có mục `kind = reading`/`writing`, `estimatedMinutes ≤ 30`; `$L15` — `GET /today`, `GET /path`, `POST /today/extra` KHÔNG có `reading/writing`; `POST /sessions` với id đơn vị luyện bằng token `$L15` → `403 PRACTICE_LOCKED` với `fields.minimumDailyMinutes = "30"` (SC-003); `PATCH /me {"skills":["vocabulary","reading"]}` khi phút 15 → `422 VALIDATION_FAILED` `fields.skills`; `GET /me` trả `skills` ĐÃ LƯU (I10); mã `PRACTICE_LOCKED` đúng ở `answers`, `intervals`, `complete`. (Cần nội dung từ T064–T075 để có đơn vị luyện thật.)
- [X] T047 [P] [US2] Tạo `backend/tests/integration/practice-gate.test.ts` (khuôn `backend/tests/integration/kanji-lesson.test.ts`, dùng `backend/tests/integration/lesson-helpers.ts`): học viên 30 phút hoàn thành trọn một phiên luyện đọc và một phiên luyện viết (đúng/sai từng câu + giải thích/đáp án tham chiếu, thời lượng phiên 5–15 phút); hạ phút xuống 15 giữa chừng ⇒ phiên đang `in_progress` bị `403 PRACTICE_LOCKED` ở bước kế tiếp nhưng vẫn `in_progress` và tiếp tục được sau khi nâng lại 30 (không mất dữ liệu); `POST /today/extra` không trả đơn vị luyện khi < 30.
- [X] T048 [P] [US2] Tạo `backend/tests/integration/practice-profile-minutes.test.ts`: I4 — hạ phút 30→15 KHÔNG xóa `skills` đã lưu (`GET /me` vẫn có `reading/writing`), nâng lại 30 ⇒ kế hoạch có lại; bảng chân trị [data-model.md §3.1](data-model.md) (4 hàng) cho `PATCH /me`; onboarding (`PUT /onboarding`, `POST /onboarding/complete`) từ chối THÊM `reading/writing` khi phút < 30 (`422`); tắt luyện ở Hồ sơ (30 phút) ⇒ kế hoạch ngày kế không còn hai mục, quỹ dùng cho nội dung khác (US2.7).
- [X] T049 [P] [US2] Tạo `backend/tests/integration/practice-class.test.ts` (khuôn `backend/tests/integration/class-learning-context.test.ts`, dùng `class-activity-helpers.ts`): học viên lớp có mẫu `skills` chứa `reading/writing` — phút áp dụng = `override.dailyMinutes ?? classPath.dailyMinutes`: ghi đè của giáo viên hạ xuống 15 ⇒ bị khóa (`PRACTICE_LOCKED`, kế hoạch không có luyện); 30 ⇒ có; `PATCH /me` với `skills` vẫn `409 CLASS_MANAGED`.
- [X] T050 [P] [US2] Tạo `backend/tests/integration/practice-records.test.ts`: I9 — sau khi hoàn thành phiên luyện, `SELECT count(*) FROM review_schedules rs JOIN content_items ci ON ci.id = rs.item_id WHERE ci.kind IN ('reading','writing')` = 0; `study_records` có `topic_id` là chủ đề của đơn vị luyện và `topic_stats` cập nhật (FR-010); sau khi hạ phút (khóa) lịch sử `study_records`/`topic_stats` vẫn còn và `GET /progress` vẫn hiện (FR-011, US2.5).
- [X] T051 [P] [US2] Tạo `backend/tests/integration/practice-admin.test.ts` (khuôn `backend/tests/integration/kanji-admin.test.ts`, dùng `admin-helpers.ts`): Admin API tạo/kích hoạt đơn vị `kind = reading` và `writing` hợp lệ ⇒ thành công; vi phạm PR2…PR6 ⇒ `422 VALIDATION_FAILED` kèm `fields` theo đường dẫn lỗi; quyền các vai trò khác không đổi.
- [X] T052 [P] [US2] Mở rộng `backend/tests/unit/content-files.test.ts`: 12 file `content/units/{n5,n4,n3}-{reading,writing}-*.json` tồn tại và hợp lệ theo JSON Schema `unit` 1.2.0 + `validateUnit`; mỗi (trình độ × reading/writing) có ≥ 1 đơn vị `estMinutes = 5`; khóa `topic` của mỗi đơn vị có trong `content/topics.json` và `topic.skill`/`topic.level` khớp `kind`/`level`; mọi ký tự Nhật có glyph trong `client/assets/fonts/NotoSansJP.ttf`. (Đỏ cho tới T075.)
- [X] T053 [P] [US2] Tạo `client/test/practice/locked_skills_test.dart`: ở onboarding và Hồ sơ với quỹ thời gian 5/10/15, mục Luyện đọc/Luyện viết hiển thị KHÓA (không bấm bật được) kèm lý do "dành cho người học từ 30 phút mỗi ngày" và hướng dẫn đổi thời gian; ở 30 phút bật được; hạ phút ở onboarding bỏ hai kỹ năng này khỏi lựa chọn; Hồ sơ có `skills` đã lưu chứa `reading/writing` nhưng phút 15 ⇒ hiện trạng thái khóa kèm lý do (không xóa lựa chọn đã lưu).
- [X] T054 [P] [US2] Tạo `client/test/practice/passage_panel_test.dart`: bài có mục `kind = reading` trong `items` ⇒ ở bước làm bài đoạn văn được GHIM phía trên câu hỏi dưới dạng bảng thu gọn/mở được và trạng thái thu gọn chỉ nằm trong `State`; bài không có mục `reading` ⇒ không hiện bảng; màn hẹp (≤ 480 px) không tràn.
- [X] T055 [P] [US2] Tạo `client/test/practice/ime_submit_test.dart`: ô nhập của `FillBlankExercise` khi `controller.value.composing` hợp lệ/không rỗng (mô phỏng đang soạn IME) và bấm Enter ⇒ KHÔNG gọi nộp bài; hết soạn ⇒ Enter nộp bài; nút "Kiểm tra" luôn dùng được ([research.md §P6](research.md)).
- [X] T056 [P] [US2] Mở rộng `client/test/admin_unit_draft_test.dart`: `kUnitKinds` gồm `reading`, `writing`; bản nháp `kind = reading` yêu cầu đúng 1 mục và 2–5 bài `multiple_choice` không gắn mục; `kind = writing` yêu cầu 3–6 mục và mỗi mục 1 bài `fill_blank` có `accepted_answers`; `toJson` của bài tập không gắn mục không gửi `item`.

### Quy tắc nội dung, schema và chủ đề

- [X] T057 [P] [US2] Cập nhật `content/schema/unit.schema.json`: `version` 1.1.0 → **1.2.0**; thuộc tính `kind` thêm `reading`, `writing`; cho phép đơn vị `reading` có đúng một mục `kind: reading` và đơn vị `writing` có các mục `kind: writing` (giữ nguyên mọi ràng buộc hiện có; không đổi cấu trúc đơn vị/mục/bài tập).
- [X] T058 [P] [US2] Cập nhật `content/schema/CHANGELOG.md`: thêm mục `1.2.0 (spec 007-fix-comments)` — `unit.kind` thêm `reading`/`writing`; `topics.skill` thêm `reading`/`writing`; ghi rõ không phá nội dung cũ.
- [X] T059 [US2] Cập nhật `backend/src/domain/content-validation.ts` (1/3 – luyện đọc): thêm `validateReadingUnit(unit, options)` theo khuôn `validateKanjiUnit` (dòng ~368) cho PR1, PR2, PR3, PR6 (reading) và PR7 theo [practice-content.md §2, §4](contracts/practice-content.md): đúng 1 mục active `kind: reading`; `japanese` 20–400 ký tự (≤ 200 khi `estMinutes = 5`); bản dịch vi+en bắt buộc; 2–5 bài `multiple_choice` active, 3–4 lựa chọn, `correct_index` hợp lệ, KHÔNG `item`; `n × 60 ≤ estMinutes × 60`; `feedbackCorrect`/`feedbackIncorrect` vi+en không rỗng. Mỗi lỗi có `path` + thông điệp tiếng Việt. (phụ thuộc T042)
- [X] T060 [US2] Cập nhật `backend/src/domain/content-validation.ts` (2/3 – luyện viết): thêm `validateWritingUnit(unit, options)` cho PR1, PR4, PR5, PR6 (writing), PR7: 3–6 mục active `kind: writing` có `reading` kana và `meaning` vi+en; mỗi mục đúng 1 bài `fill_blank`, số bài = số mục, KHÔNG `item`; `payload.accepted_answers` không rỗng, mỗi phần tử không rỗng sau chuẩn hóa NFKC/khoảng trắng/chữ thường và không trùng nhau sau chuẩn hóa (dùng chuẩn hóa của `backend/src/domain/grading.ts`); `n × 45 ≤ estMinutes × 60`. (phụ thuộc T059)
- [X] T061 [US2] Cập nhật `backend/src/domain/content-validation.ts` (3/3 – nối vào `validateUnit`): thêm PR8 (mọi ký tự Nhật có glyph — dùng `backend/src/domain/font-coverage.ts` như các đơn vị khác) và PR9 (không `kanjiDetails` ở mục luyện; mục luyện không thuộc chủ đề Kanji); trong `validateUnit` (dòng ~531) gọi `validateReadingUnit`/`validateWritingUnit` theo `unit.kind` như nhánh Kanji (dòng ~520). Làm cho T042 xanh. (phụ thuộc T060)
- [X] T062 [P] [US2] Cập nhật `content/README.md`: thêm mục "Biên soạn bài luyện đọc/viết" tóm tắt [practice-content.md](contracts/practice-content.md) — cấu trúc đơn vị `reading`/`writing`, bài tập không gắn mục (không vào ôn tập), quỹ thời lượng 60 s/câu (đọc) và 45 s/câu (viết), phải liệt kê đủ dạng chấp nhận (Kanji, hiragana…) vì bộ chấm không đổi kana↔Kanji, danh sách duyệt 4 mục, không có viết tay/thứ tự nét/chấm tự do.
- [X] T063 [US2] Cập nhật `backend/src/seed/content.ts`: bảo đảm nạp được đơn vị `reading`/`writing` — bài tập KHÔNG khai `item` được ghi `item_id = NULL` (`facet = item`), mục luyện lấy chủ đề của đơn vị (`topics.get(u.topic)` khớp `kind`/`level` như dòng ~226–235), danh mục yêu cầu theo `requiredLevels` hiện có; không đổi hành vi nạp cho đơn vị cũ (`backend/tests/integration/seed.test.ts` vẫn xanh). (phụ thuộc T012, T061)

### Biên soạn nội dung ra mắt — 12 đơn vị (điều kiện cứng, C2)

> Mỗi file thực hiện đúng [practice-content.md §1–§3](contracts/practice-content.md): `tier: "core"`, `goalTags` không rỗng (ví dụ `["jlpt","daily_conversation","work"]`), mọi văn bản song ngữ vi+en, giải thích đúng/sai theo nội dung bài.
>
> **Nguồn nội dung (C2 đã quyết định)**: tham khảo các nguồn công khai chính thống và giáo trình tiếng Nhật nổi tiếng (ví dụ danh mục chủ đề/ngữ pháp theo trình độ của Japan Foundation – Marugoto/Irodori, JLPT, Minna no Nihongo, Genki, Tobira…) để bám đúng phạm vi từ vựng, ngữ pháp và chủ đề N5/N4/N3. **KHÔNG sao chép nguyên văn** đoạn văn, câu hỏi hay bài tập từ giáo trình hoặc trang web có bản quyền: mọi đoạn văn, câu hỏi, phản hồi do ta viết mới ở đúng trình độ. Với mỗi bài, ghi nguồn tham khảo (tên nguồn, bài/mục) vào mô tả commit và vào checklist duyệt để truy vết; chủ dự án duyệt cuối theo danh sách duyệt ở [practice-content.md §3](contracts/practice-content.md). Đánh dấu danh sách duyệt 4 mục (§3) cho mỗi bài `writing` trước khi kích hoạt. Mỗi cặp (trình độ × loại) có một bài `estMinutes: 5` (bắt buộc cho `validateCatalog`) và một bài `estMinutes: 10`.

- [X] T064 [P] [US2] Tạo `content/units/n5-reading-daily-life-1.json`: `kind: reading`, `level: N5`, `estMinutes: 5`, `topic: "reading-n5-daily-life"`; đoạn văn "Một ngày của Tanaka" ≤ 200 ký tự (có thể dùng nguyên ví dụ ở [practice-content.md §2](contracts/practice-content.md)) với bản kana, bản dịch vi/en; 2–5 câu `multiple_choice` (≤ 5 câu vì 5 phút).
- [X] T065 [P] [US2] Tạo `content/units/n5-reading-daily-life-2.json`: `kind: reading`, `level: N5`, `estMinutes: 10`, `topic: "reading-n5-daily-life"`; đoạn văn N5 về đi mua sắm cuối tuần (≤ 400 ký tự); 3–5 câu `multiple_choice`.
- [X] T066 [P] [US2] Tạo `content/units/n4-reading-work-life-1.json`: `kind: reading`, `level: N4`, `estMinutes: 5`, `topic: "reading-n4-work-life"`; đoạn văn N4 ≤ 200 ký tự (thông báo họp nhóm); 2–5 câu `multiple_choice`.
- [X] T067 [P] [US2] Tạo `content/units/n4-reading-work-life-2.json`: `kind: reading`, `level: N4`, `estMinutes: 10`, `topic: "reading-n4-work-life"`; đoạn văn N4 về đi làm bằng tàu điện (≤ 400 ký tự); 3–5 câu.
- [X] T068 [P] [US2] Tạo `content/units/n3-reading-society-1.json`: `kind: reading`, `level: N3`, `estMinutes: 5`, `topic: "reading-n3-society"`; đoạn văn N3 ≤ 200 ký tự (bản tin ngắn về tái chế); 2–5 câu.
- [X] T069 [P] [US2] Tạo `content/units/n3-reading-society-2.json`: `kind: reading`, `level: N3`, `estMinutes: 10`, `topic: "reading-n3-society"`; đoạn văn N3 về làm việc từ xa (≤ 400 ký tự); 3–5 câu.
- [X] T070 [P] [US2] Tạo `content/units/n5-writing-greetings-1.json`: `kind: writing`, `level: N5`, `estMinutes: 5`, `topic: "writing-n5-greetings"`; 3–5 mục lời chào (có thể dùng `おはようございます` ở [practice-content.md §3](contracts/practice-content.md)), mỗi mục 1 bài `fill_blank`, `accepted_answers` liệt kê đủ dạng (phần tử đầu là đáp án tham chiếu), `hint` có cách đọc/số ký tự; số bài ≤ 6.
- [X] T071 [P] [US2] Tạo `content/units/n5-writing-greetings-2.json`: `kind: writing`, `level: N5`, `estMinutes: 10`, `topic: "writing-n5-greetings"`; 4–6 mục từ về đồ ăn thức uống/thời gian (N5); số bài ≤ 13; `accepted_answers` đủ dạng Kanji/hiragana.
- [X] T072 [P] [US2] Tạo `content/units/n4-writing-daily-actions-1.json`: `kind: writing`, `level: N4`, `estMinutes: 5`, `topic: "writing-n4-daily-actions"`; 3–5 mục hành động hằng ngày (N4); `hint` bắt buộc nêu cách đọc cho từ có Kanji.
- [X] T073 [P] [US2] Tạo `content/units/n4-writing-daily-actions-2.json`: `kind: writing`, `level: N4`, `estMinutes: 10`, `topic: "writing-n4-daily-actions"`; 4–6 mục (N4), có câu ngắn ≤ 40 ký tự.
- [X] T074 [P] [US2] Tạo `content/units/n3-writing-workplace-1.json`: `kind: writing`, `level: N3`, `estMinutes: 5`, `topic: "writing-n3-workplace"`; 3–5 mục từ vựng công sở (N3); `accepted_answers` đủ dạng.
- [X] T075 [P] [US2] Tạo `content/units/n3-writing-workplace-2.json`: `kind: writing`, `level: N3`, `estMinutes: 10`, `topic: "writing-n3-workplace"`; 4–6 mục (N3), có câu ngắn ≤ 40 ký tự.
- [X] T076 [US2] Cập nhật `backend/src/domain/content-validation.ts` hàm `validateCatalog`: GỠ ngoại lệ tạm `PRACTICE_SKILLS` ở T010 để vòng kiểm tra duyệt lại toàn bộ `SKILLS` (mỗi trình độ × `reading`/`writing` có ≥ 1 đơn vị 5 phút). (phụ thuộc T064–T075)
- [X] T076a [US2] Cập nhật `backend/tests/unit/content-files.test.ts`: GỠ hai bộ lọc tạm `PRACTICE_SKILLS` (thêm ở T025a) ở các test "mỗi mảng N4 và N3 có ít nhất một đơn vị…" và "mỗi mảng có ít nhất một câu placement hoặc một đơn vị…" để 6 chủ đề luyện đọc/viết cũng phải có đơn vị tham chiếu. (phụ thuộc T064–T075)
- [X] T077 [US2] (lệnh) Kiểm tra nội dung: `cd backend && pnpm seed` thành công; `pnpm test:unit` (T042, T052 xanh); `pnpm vitest run --project db tests/integration/seed.test.ts`. (phụ thuộc T063, T076)

### Hiện thực backend cho User Story 2

- [X] T078 [US2] Cập nhật `backend/src/services/learning-context.ts`: trong `resolveLearningContext` (nhánh cá nhân, dòng ~92–93) trả `profile` và `params` với `skills` đã qua `effectiveSkills(skills, profile.dailyMinutes)` (tạo đối tượng MỚI trong bộ nhớ, KHÔNG bao giờ ghi lại CSDL) và `prioritizedSkill` về `null` nếu là `reading/writing` mà không đủ điều kiện; trong `buildClassContext` (dòng ~112–131) lọc `skills` của `effective`, `template.skills` và `classPathParams(template)` với phút áp dụng `override?.dailyMinutes ?? classPath.dailyMinutes`. Đây là điểm lọc DUY NHẤT cho kế hoạch/lộ trình/học thêm/tiến độ (research P2). (phụ thuộc T008)
- [X] T079 [US2] Cập nhật `backend/src/engine/daily-plan.ts`: thêm `PRACTICE_EVERY_N_PLANS = 2` và hàm thuần `applyPracticeSlot(candidates, input)` ngay sau `applyKanjiSlot` (dòng ~301) theo [data-model.md §3.2](data-model.md#32-suất-luyện-tập-trong-kế-hoạch-ngày-enginedaily-plants) — chỉ sắp lại thứ tự ứng viên, KHÔNG sửa `planDailyPlan`; đầu vào `{ skills, prioritizedSkill, lastNewUnitPlanKinds: string[] | null, budgetMinutes }`; no-op khi không có `reading/writing` trong `skills` hoặc không ứng viên luyện nào `estMinutes ≤ budgetMinutes`. Làm cho T043 và T044 xanh. (phụ thuộc T043, T044)
- [X] T080 [US2] Cập nhật `backend/src/services/daily-plan.ts` hàm `generatePlan` (dòng ~176–185): gọi `applyPracticeSlot` TRƯỚC `applyKanjiSlot` với `lastNewUnitPlanKinds: lastKinds` (đã có từ `lastNewUnitPlanKinds(deps.db, userId, localDate)`, không truy vấn mới) và `budgetMinutes`; đầu ra truyền tiếp cho `applyKanjiSlot` rồi `planDailyPlan`. (phụ thuộc T079)
- [X] T081 [US2] Cập nhật `backend/src/services/daily-plan.ts` nơi gọi `suggestAfterExhaustion` (dòng ~349): lọc `catalog` bỏ đơn vị `reading/writing` khi người học KHÔNG đủ điều kiện (`!isPracticeEligible(profile.dailyMinutes)`) để gợi ý "thêm kỹ năng" không bao giờ mời người dưới 30 phút bật luyện đọc/viết. (phụ thuộc T080)
- [X] T082 [US2] Cập nhật `backend/src/services/lesson-session.ts` (1/2 – bắt đầu phiên): thêm helper `assertPracticeAllowed(deps, userId, unitKind)` — nếu `unitKind ∈ PRACTICE_SKILLS` thì lấy ngữ cảnh học qua `resolveLearningContext` (phút áp dụng, đã tính ghi đè của giáo viên) và ném `AppError(403, 'PRACTICE_LOCKED', 'Luyện đọc/viết dành cho người học từ 30 phút mỗi ngày', { minimumDailyMinutes: '30' })` khi `!isPracticeEligible(phút)`; gọi trong `startPlanItemSession` (sau khi biết `item.unitId`, trước `insertSession`) và `startExtraSession` (theo `unitId`). (phụ thuộc T078)
- [X] T083 [US2] Cập nhật `backend/src/services/lesson-session.ts` (2/2 – tiếp tục phiên): gọi `assertPracticeAllowed` ở `submitAnswer`, `recordInterval`, `completeSession` khi đơn vị của phiên có `kind ∈ {reading, writing}` (lấy kind từ snapshot/đơn vị của phiên, không truy vấn nội dung lại nếu đã có); phiên dở dang giữ `in_progress`, KHÔNG sửa dữ liệu khi bị chặn. Làm cho T046, T047 xanh. (phụ thuộc T082)
- [X] T084 [US2] Cập nhật `backend/src/services/profile.ts` hàm `updateMe` (dòng ~239–259): khi `input.skills` (hoặc `input.dailyMinutes`) khiến `skillsAfter` chứa `reading/writing` MỚI THÊM so với `profile.skills` đã lưu mà phút sau cập nhật `< 30` ⇒ `validationFailed({ skills: 'Luyện đọc/viết dành cho người học từ 30 phút mỗi ngày' })` (`422 VALIDATION_FAILED`); giá trị đã lưu từ trước KHÔNG bị xóa khi hạ phút; xác nhận `GET /me` (`profileToDto`) trả `skills` ĐÃ LƯU không lọc (I10). Làm cho T048 xanh (phần `PATCH`). (phụ thuộc T008)
- [X] T085 [US2] Cập nhật `backend/src/services/onboarding.ts` (`saveOnboardingDraft` và `completeOnboarding`): cùng quy tắc với T084 — nháp/hoàn tất có `skills` chứa `reading/writing` mà `dailyMinutes < 30` ⇒ `422 VALIDATION_FAILED` `fields.skills` (đúng thông điệp ở T084). Làm cho T048 xanh (phần onboarding). (phụ thuộc T008)

### Hiện thực client cho User Story 2

- [X] T086 [P] [US2] Thêm khóa vào `client/lib/l10n/app_vi.arb` (kèm khối `@…`): `onboardingSkillReading` = "Luyện đọc"; `onboardingSkillWriting` = "Luyện viết"; `practiceLockedReason` (tham số `minutes`) = "Dành cho người học từ {minutes} phút mỗi ngày"; `practiceLockedHint` = "Tăng thời gian học mỗi ngày trong Hồ sơ để dùng luyện đọc/viết"; `practiceLockedError` = "Luyện đọc/viết chỉ dành cho người học từ 30 phút mỗi ngày"; `lessonPassageTitle` = "Đoạn văn"; `lessonPassageCollapse` = "Thu gọn"; `lessonPassageExpand` = "Mở rộng"; `todaySkillReading` = "Luyện đọc"; `todaySkillWriting` = "Luyện viết".
- [X] T087 [P] [US2] Thêm các khóa tương ứng vào `client/lib/l10n/app_en.arb`: "Reading practice"; "Writing practice"; "For learners with {minutes} minutes or more per day"; "Raise your daily time in Profile to use reading/writing practice"; "Reading/writing practice is for learners with 30+ minutes per day"; "Passage"; "Collapse"; "Expand"; "Reading practice"; "Writing practice".
- [X] T088 [US2] (lệnh) Sinh lại `client/lib/l10n/app_localizations*.dart` bằng `cd client && flutter gen-l10n`. (phụ thuộc T086, T087)
- [X] T089 [P] [US2] Cập nhật `client/lib/domain/onboarding_form.dart` dòng 29: `OnboardingOptions.skills` thêm `'reading'`, `'writing'` (sau `'kanji'`), và thêm `static const List<String> practiceSkills = <String>['reading', 'writing'];` để màn hình khóa theo ngưỡng. Không đổi logic hợp lệ của biểu mẫu khác. (phụ thuộc T035)
- [X] T090 [P] [US2] Cập nhật `client/lib/presentation/onboarding/onboarding_labels.dart` (switch nhãn kỹ năng, dòng ~45): thêm `reading` → `l10n.onboardingSkillReading`, `writing` → `l10n.onboardingSkillWriting`. (phụ thuộc T088)
- [X] T091 [P] [US2] Cập nhật `client/lib/presentation/shared/error_messages.dart`: ánh xạ mã lỗi `PRACTICE_LOCKED` sang `l10n.practiceLockedError` (theo khuôn mã `CLASS_MANAGED`). (phụ thuộc T088)
- [X] T092 [P] [US2] Tạo `client/lib/presentation/lesson/passage_panel.dart`: widget `PassagePanel` (StatefulWidget) hiển thị đoạn văn tiếng Nhật + bản dịch của mục `kind = reading` dưới dạng bảng thu gọn/mở được (`lessonPassageTitle`, `lessonPassageCollapse/Expand`); trạng thái thu gọn chỉ ở `State`; xuống dòng đúng ở màn hẹp (`Wrap`/`Flexible`), phông Nhật theo theme. Làm cho T054 xanh (phần widget). (phụ thuộc T088)
- [X] T093 [P] [US2] Cập nhật `client/lib/presentation/lesson/exercises/fill_blank_exercise.dart` quanh dòng 52–58: `onSubmitted` bỏ qua khi `controller.value.composing.isValid && !controller.value.composing.isCollapsed` (đang soạn IME — Enter chỉ chốt chữ); nút "Kiểm tra" giữ nguyên và luôn nộp được; không thêm mã riêng nền tảng. Làm cho T055 xanh.
- [X] T094 [US2] Cập nhật `client/lib/presentation/lesson/lesson_screen.dart`: ở bước làm bài (`LessonPhase.exercises`), nếu `items` của phiên có mục `kind == Skill.reading` thì ghim `PassagePanel` phía trên câu hỏi; bước giới thiệu hiển thị đoạn văn như mọi mục; không đổi snapshot/API. Làm cho T054 xanh. (phụ thuộc T092)
- [X] T095 [P] [US2] Cập nhật `client/lib/presentation/today/today_screen.dart` quanh dòng 322 (hiển thị chip/biểu tượng kỹ năng của mục kế hoạch): hỗ trợ `Skill.reading` (biểu tượng sách/`menu_book`) và `Skill.writing` (biểu tượng bút/`edit`) với nhãn `todaySkillReading`/`todaySkillWriting`, thay vì rơi về nhánh từ vựng/ngữ pháp. (phụ thuộc T088)
- [X] T096 [US2] Cập nhật `client/lib/presentation/onboarding/onboarding_screen.dart` (bước kỹ năng, quanh dòng 335–338 và 517): với `OnboardingOptions.practiceSkills` dùng `isPracticeLockedFor(_form.dailyMinutes, practiceMinDailyMinutes)` — khi khóa thì chip bị vô hiệu kèm `practiceLockedReason` + `practiceLockedHint`; khi người học hạ phút xuống dưới ngưỡng thì loại `reading/writing` khỏi `_form.skills`; ngưỡng lấy từ `studyDefaultsProvider` (không cứng 30). Làm cho T053 xanh (phần onboarding). (phụ thuộc T040, T089, T090)
- [X] T097 [US2] Cập nhật `client/lib/presentation/profile/profile_screen.dart` (mục kỹ năng): thêm Luyện đọc/Luyện viết; khóa khi quỹ thời gian đang áp dụng < `practiceMinDailyMinutes` kèm `practiceLockedReason` + `practiceLockedHint`; khi `skills` ĐÃ LƯU chứa hai kỹ năng này mà đang bị khóa thì hiện trạng thái khóa nhưng KHÔNG xóa lựa chọn đã lưu; học viên lớp vẫn bị khóa theo lớp như cũ. Làm cho T053 xanh (phần Hồ sơ). (phụ thuộc T041, T089, T090)
- [X] T098 [US2] Cập nhật `client/lib/presentation/path/plan_adjust_screen.dart` (danh sách kỹ năng quanh dòng 33): thêm `'reading'`, `'writing'` với nhãn từ T086/T087 và cùng quy tắc khóa dưới ngưỡng như T096. (phụ thuộc T089, T090)
- [X] T099 [P] [US2] Cập nhật `client/lib/domain/admin_unit_draft.dart`: `kUnitKinds` thêm `'reading'`, `'writing'` (dòng 11); `validate` theo `kind`: `reading` đúng 1 mục và 2–5 bài `multiple_choice` không gắn mục; `writing` 3–6 mục, mỗi mục 1 bài `fill_blank` có `accepted_answers` không rỗng; `toJson` bài tập không gắn mục không gửi `item`. Làm cho T056 xanh.
- [X] T100 [US2] Cập nhật `client/lib/presentation/admin/admin_unit_editor_screen.dart`: ô chọn `kind` hiển thị thêm `reading`/`writing` (nhãn qua `admin_support.dart`/l10n theo khuôn các kind khác) và hiện trường theo kind (đoạn văn ở mục đọc, danh sách mục viết). (phụ thuộc T099)
- [X] T101 [US2] Cập nhật `client/lib/presentation/admin/admin_unit_elements.dart` (dòng ~127): với `kind == 'reading'` ô `japanese` của mục là nhiều dòng (đoạn văn ≤ 400 ký tự, có bộ đếm); với `kind == 'writing'` hiển thị ô `accepted_answers`/`hint` của bài `fill_blank`; bài tập của hai kind này cho phép không chọn mục. (phụ thuộc T099)

- [X] T076b [US2] Cập nhật `backend/tests/unit/content-validation.test.ts`, `backend/tests/unit/content-validation-kanji.test.ts`, `backend/tests/unit/content-files.test.ts` (phát sinh từ T076, mỗi nhiệm vụ một file): sau khi gỡ ngoại lệ tạm, `validateCatalog` yêu cầu đủ 5 kỹ năng cho mỗi trình độ — hai trình giúp `full()` thêm `reading`/`writing`; bài "mọi file đơn vị cũ vẫn hợp lệ với schema 1.1.0" loại cả file `-reading-`/`-writing-`. (phụ thuộc T076)
- [X] T076c [US2] Cập nhật `backend/tests/contract/kanji-us2.test.ts` (phát sinh từ T009): `reading` nay là kỹ năng hợp lệ nên ca "422 với listening/reading" đổi thành `listening`/`speaking` và thông điệp mới "không hợp lệ". Cập nhật `backend/tests/integration/seed.test.ts`: 33 đơn vị (21 cũ + 12 luyện). Cập nhật `client/test/onboarding_flow_test.dart` và `client/test/plan_adjust_test.dart`: chỉ `listening` còn "chưa có trong phiên bản", `reading`/`writing` khóa theo thời gian (< 30 phút). (phụ thuộc T076, T096, T098)
- **Ghi chú hiện thực US2 (lệch có chủ ý so với văn bản nhiệm vụ)**:
  - **T079/T080**: `applyPracticeSlot` nhận thêm trường tùy chọn `lastPracticeKind` ngoài `lastNewUnitPlanKinds`. Chỉ dựa vào kế hoạch có bài mới gần nhất thì không thể luân phiên đọc ↔ viết giữa các ngày (kế hoạch đứng ngay trước luôn không chứa luyện khi tới lượt đưa lên), nên `generatePlan` truyền thêm loại luyện gần nhất qua truy vấn nhỏ `lastPracticeKind` ở `backend/src/db/repositories/plans.ts` (không đổi bảng). Không truyền thì hàm tự suy từ `lastNewUnitPlanKinds` như mô tả ban đầu.
  - **T082/T083**: cổng `PRACTICE_LOCKED` kiểm theo kỹ năng của mục trong ảnh chụp phiên (không truy vấn nội dung lại); phiên đã `completed` vẫn trả tóm tắt như cũ. Bắt đầu phiên luyện cũng bị chặn khi mở lại phiên đang dở lúc < 30 phút.
  - **T093**: dùng `onEditingComplete` thay cho `onSubmitted`, vì Flutter xóa vùng `composing` trước khi gọi `onSubmitted` nên không còn phân biệt được đang soạn IME.
  - **T097**: `profile_screen.dart` không có mục chọn kỹ năng (kỹ năng nằm ở màn "Điều chỉnh kế hoạch", T098) nên không có thay đổi mã ở file này; yêu cầu khóa/giữ kỹ năng đã lưu ở Hồ sơ được hiện thực và kiểm thử ở `plan_adjust_screen.dart` (T098, `client/test/practice/locked_skills_test.dart`).
  - **T077**: `pnpm seed` được kiểm bằng `seedContent` trên PostgreSQL nhúng trong `seed.test.ts` (33 đơn vị nạp, nạp lại idempotent); chưa chạy lệnh `pnpm seed` trực tiếp vào CSDL phát triển.
  - **T064–T075**: nguồn tham khảo ghi ở [checklists/practice-content-review.md](checklists/practice-content-review.md); danh sách duyệt nội dung ở đó CHƯA được tick (chủ dự án duyệt cuối trước khi phát hành US2).

**Checkpoint**: US2 chạy độc lập (T042–T056 xanh; SC-003 = 100% qua API trực tiếp; golden I2 không đổi). KHÔNG phát hành US2 khi thiếu kiểm thử cổng ≥ 30 (T046, T047) và bất biến quỹ thời gian (T043).

---

## Phase 5: User Story 3 - Màu sắc đầu mục học tập theo năng lực cá nhân (Ưu tiên: P2)

**Mục tiêu**: Mỗi đầu mục (kỹ năng, chủ đề) mang màu xanh lục / vàng nhạt / trung tính theo một quy tắc phân loại duy nhất ở backend, nhất quán ở Hôm nay, Lộ trình, Tiến độ; màu luôn đi kèm biểu tượng + nhãn chữ + chú giải, tương phản ≥ 4.5:1.

**Kiểm thử độc lập**: Dùng ba hồ sơ mẫu (`competency-mixed`, `competency-new`, `competency-recovering`): ba endpoint trả cùng mức theo bảng đáp án; màn hình tô đúng màu kèm chú giải.

### Kiểm thử cho User Story 3 (viết TRƯỚC, phải ĐỎ) ⚠️

- [X] T102 [P] [US3] Tạo `backend/tests/fixtures/learner-profiles/competency-mixed.json` (`id: "competency-mixed"`, khuôn hồ sơ khác): người học 30 phút, đủ 5 kỹ năng, `history` sao cho từ vựng ≥ 70% (≥ 8 câu), Kanji < 70% (≥ 8 câu), luyện đọc ≥ 70% (≥ 8 câu, chủ đề `reading-n5-daily-life`), luyện viết < 8 câu (chủ đề `writing-n5-greetings`); `expected.competency` gồm bảng mức theo kỹ năng và theo chủ đề (vocabulary `good`, kanji `needs_improvement`, reading `good`, writing `insufficient`, grammar `insufficient`…). (phụ thuộc T012, T014)
- [X] T103 [P] [US3] Tạo `backend/tests/fixtures/learner-profiles/competency-new.json` (`id: "competency-new"`): người học mới, `history: []`, `expected.competency`: mọi kỹ năng/chủ đề `insufficient`. (phụ thuộc T014)
- [X] T104 [P] [US3] Tạo `backend/tests/fixtures/learner-profiles/competency-recovering.json` (`id: "competency-recovering"`): chủ đề từng yếu (< 60% với ≥ 8 câu) nay ≥ 70% trong cửa sổ 20 câu gần nhất; `expected.competency`: chủ đề đó `good`, KHÔNG nằm trong `weakTopics`. (phụ thuộc T014)
- [X] T105 [P] [US3] Tạo `backend/tests/unit/competency.test.ts`: `classifyCompetency` đúng bảng biên ở [competency-rules.md §1](contracts/competency-rules.md#bảng-ví-dụ-kiểm-thử-biên) (0/0, 7/7 ⇒ `insufficient`; 8/5 ⇒ `needs_improvement`; 10/7 ⇒ `good` đúng ngưỡng; 20/13, 20/11 ⇒ `needs_improvement`; 16/15 ⇒ `good`); hằng `COMPETENCY_MIN_ANSWERS === WEAK_MIN_ANSWERS` và `COMPETENCY_GOOD_AT === RECOVER_AT` (import từ `backend/src/engine/difficulty.ts`); gộp theo kỹ năng bằng cách cộng `answered`/`correct` của chủ đề; I5 trên cả ba hồ sơ `competency-*` (chạy `recordAnswer` qua `history`): `is_weak ⇒ needs_improvement`, `good ∩ is_weak = ∅`; I6: câu hỏi lại (`is_retry`) không tính; bảng `expected.competency` của từng hồ sơ khớp.
- [X] T106 [P] [US3] Tạo `backend/tests/contract/fix-us3.test.ts`: với từng hồ sơ `competency-*` dựng dữ liệu `topic_stats` rồi so `GET /progress` (`competency.skills`, `competency.topics`), `GET /today` (`PlanItem.competency` = mức kỹ năng với `new_unit`, `null` với `review_batch`), `GET /path` (`items[].competency` = mức chủ đề, chưa có dữ liệu ⇒ `insufficient`) với bảng `expected.competency`; `weakTopics ⊆` chủ đề `needs_improvement` và mọi `weakTopics[i].topicId` có trong `competency.topics`.
- [X] T107 [P] [US3] Tạo `backend/tests/integration/competency-consistency.test.ts`: cùng thời điểm, cùng đầu mục ⇒ cùng mức ở ba endpoint (I5, SC-005); học thêm để mảng yếu lên ≥ 70% ⇒ lần gọi sau cả ba endpoint đổi sang `good` (US3.4); `competency-new` ⇒ mọi mức `insufficient`, `weakTopics` rỗng.
- [X] T108 [P] [US3] Tạo `client/test/competency/competency_palette_test.dart`: với mỗi mức (`good`, `needs_improvement`, `insufficient`) ở cả theme sáng và tối, tỷ lệ tương phản WCAG chữ/nền ≥ 4.5:1 (hàm tính tỷ lệ từ token của `CompetencyPalette`).
- [X] T109 [P] [US3] Tạo `client/test/competency/competency_chip_test.dart`: chip mỗi mức có biểu tượng + nhãn chữ (`check_circle` "Tốt"; `trending_up`/`flag` "Cần cải thiện"; `hourglass_empty` "Chưa đủ dữ liệu"); `Semantics(label)` nêu mức bằng lời ("Từ vựng: Tốt"); chip không dựa vào màu làm kênh duy nhất.
- [X] T110 [P] [US3] Tạo `client/test/competency/competency_legend_test.dart`: chú giải có đủ ba mức (biểu tượng + nhãn như chip); màn hẹp (≤ 480 px) xuống dòng bằng `Wrap`, không tràn.
- [X] T111 [P] [US3] Tạo `client/test/competency/competency_screens_test.dart` (dùng `client/test/support/learning_scenario.dart`): màn Hôm nay, Lộ trình, Tiến độ cùng dùng chip + chú giải; `competency = null`/thiếu trường (máy chủ cũ) ⇒ không chip, màn bình thường; người học mới ⇒ toàn chip trung tính và không có thông báo "yếu"; giao diện tối đọc rõ.

### Hiện thực backend cho User Story 3

- [X] T112 [US3] Tạo `backend/src/engine/competency.ts` (hàm thuần): `COMPETENCY_MIN_ANSWERS = WEAK_MIN_ANSWERS`, `COMPETENCY_GOOD_AT = RECOVER_AT` (import từ `./difficulty.js`); `classifyCompetency({ answered, correct })` — `answered < 8` ⇒ `insufficient`; `correct / answered >= 0.70` ⇒ `good`; còn lại `needs_improvement`; kiểu `CompetencyLevel`, `SkillCompetency`, `TopicCompetency`; hàm dựng từ danh sách `{ topicId, skill, recentResults }` (`answered = length`, `correct = sum`; kỹ năng = cộng theo chủ đề; `accuracy` null khi `answered = 0`). Làm cho T105 xanh. (phụ thuộc T105)
- [X] T113 [P] [US3] Cập nhật `backend/src/db/repositories/topic-stats.ts`: thêm `listTopicWindows(db, userId)` — MỘT truy vấn `topic_stats ⨝ topics` trả `{ topicId, skill, recentResults }[]` (`recent_results` ≤ 20 kết quả 0/1).
- [X] T114 [US3] Tạo `backend/src/services/competency.ts`: `loadCompetency(deps, userId)` gọi `listTopicWindows` một lần và dựng bản đồ mức theo chủ đề và theo kỹ năng bằng `backend/src/engine/competency.ts`; dùng chung cho `progress`, `daily-plan`, `path` để ba màn khớp nhau. (phụ thuộc T112, T113)
- [X] T115 [US3] Cập nhật `backend/src/services/progress.ts`: `getProgress` (và `emptySummary`) thêm `competency: { skills, topics }` — `skills` theo thứ tự `vocabulary, grammar, kanji, reading, writing` cho kỹ năng đang bật (hiệu lực) hoặc đã có dữ liệu; `topics` gồm mọi chủ đề có dữ liệu và luôn gồm các chủ đề trong `weakTopics`; đảm bảo `weakTopics ⊆ needs_improvement`. Làm cho T106 xanh (phần progress). (phụ thuộc T114)
- [X] T116 [US3] Cập nhật `backend/src/services/daily-plan.ts`: trong `toDto`/`getTodayPlan` thêm `competency` cho từng `PlanItemDto` — mức của KỸ NĂNG của đơn vị với `new_unit`, `null` với `review_batch` (tải bằng `loadCompetency` một lần mỗi yêu cầu). Làm cho T106 xanh (phần today). (phụ thuộc T114, T081)
- [X] T117 [US3] Cập nhật `backend/src/services/path.ts`: mỗi đơn vị trong `PathDetail.items` thêm `competency` = mức của CHỦ ĐỀ của đơn vị (chưa có dữ liệu chủ đề ⇒ `insufficient`) từ `loadCompetency`. Làm cho T106, T107 xanh. (phụ thuộc T114)

### Hiện thực client cho User Story 3

- [X] T118 [P] [US3] Thêm khóa vào `client/lib/l10n/app_vi.arb` (kèm khối `@…`): `competencyGood` = "Tốt"; `competencyNeedsImprovement` = "Cần cải thiện"; `competencyInsufficient` = "Chưa đủ dữ liệu"; `competencyLegendTitle` = "Mức năng lực"; `competencySemantics` (tham số `skill`, `level`) = "{skill}: {level}"; `progressCompetencyTitle` = "Năng lực theo kỹ năng"; `progressCompetencyTopics` = "Năng lực theo chủ đề".
- [X] T119 [P] [US3] Thêm các khóa tương ứng vào `client/lib/l10n/app_en.arb`: "Strong"; "Needs practice"; "Not enough data"; "Competency levels"; "{skill}: {level}"; "Competency by skill"; "Competency by topic".
- [X] T120 [US3] (lệnh) Sinh lại `client/lib/l10n/app_localizations*.dart` bằng `cd client && flutter gen-l10n`. (phụ thuộc T118, T119)
- [X] T121 [P] [US3] Tạo `client/lib/presentation/competency/competency_palette.dart`: `ThemeExtension` `CompetencyPalette` với token nền/chữ/viền cho ba mức ở bản sáng và tối (gợi ý khởi điểm ở [competency-rules.md §3](contracts/competency-rules.md): `good` `#E3F4E4`/`#1B5E20`; `needs_improvement` `#FFF6CC`/`#5C4A00`; `insufficient` = `surfaceContainer`/`onSurfaceVariant`; chọn bản tối đạt ≥ 4.5:1) và hàm `contrastRatio(Color, Color)` cho kiểm thử. Làm cho T108 xanh.
- [X] T122 [US3] Cập nhật `client/lib/presentation/shared/theme.dart`: đăng ký `CompetencyPalette` vào `extensions` của cả `ThemeData` sáng và tối. (phụ thuộc T121)
- [X] T123 [P] [US3] Tạo `client/lib/presentation/competency/competency_chip.dart`: widget `CompetencyChip({ required CompetencyLevel? level, required String label })` — biểu tượng + nhãn chữ của mức (`competencyGood`/`…NeedsImprovement`/`…Insufficient`), màu từ `CompetencyPalette`, bọc `Semantics(label: competencySemantics(skill, level))`; `level == null` ⇒ không hiển thị gì. Làm cho T109 xanh. (phụ thuộc T120, T122)
- [X] T124 [P] [US3] Tạo `client/lib/presentation/competency/competency_legend.dart`: widget `CompetencyLegend` — một dòng `Wrap` nêu ý nghĩa ba mức (biểu tượng + nhãn như chip) với tiêu đề `competencyLegendTitle`. Làm cho T110 xanh. (phụ thuộc T120, T122)
- [X] T125 [US3] Cập nhật `client/lib/presentation/today/today_screen.dart`: hiển thị `CompetencyChip` theo `PlanItem.competency` cho mục `new_unit` (`review_batch` không chip) và đặt `CompetencyLegend` dưới danh sách bài. (phụ thuộc T123, T124, T095)
- [X] T126 [US3] Cập nhật `client/lib/presentation/path/path_screen.dart` (quanh dòng 344): hiển thị `CompetencyChip` theo `items[].competency` của chủ đề cho từng đơn vị và `CompetencyLegend`. (phụ thuộc T123, T124)
- [X] T127 [US3] Cập nhật `client/lib/presentation/progress/progress_screen.dart`: thêm dải "Năng lực theo kỹ năng" (`progressCompetencyTitle`, tối đa 5 chip từ `summary.competency.skills`), danh sách chủ đề có năng lực (`progressCompetencyTopics`, gồm mảng yếu) và `CompetencyLegend`; thiếu `competency` ⇒ bỏ qua. Làm cho T111 xanh. (phụ thuộc T123, T124, T024)

- **Ghi chú hiện thực US3 (lệch có chủ ý so với văn bản nhiệm vụ, 2026-11-14)**:
  - **T102–T107**: thêm hai file hỗ trợ ngoài danh sách (mỗi nhiệm vụ một file vẫn giữ cho file chính): `backend/tests/fixtures/topic-catalog.ts` (tra khóa chủ đề `topics.json` ↔ id CSDL) và `backend/tests/integration/competency-helpers.ts` (dựng người học từ hồ sơ `competency-*`, ghi `topic_stats` bằng cách phát lại `recordAnswer`). T107 mô phỏng "học thêm" bằng cách ghi lại `topic_stats` qua đúng `recordAnswer` thay vì chạy lại cả phiên học (kiểm thử nhất quán ba endpoint, không kiểm thử đường ghi của phiên — đường đó đã có ở `practice-records.test.ts`/`us4-progress.test.ts`).
  - **T112**: ngoài `classifyCompetency`, engine có `topicCompetencies` và `skillCompetencies(windows, enabledSkills)` (kỹ năng đang bật hoặc có dữ liệu, theo thứ tự `SKILLS`); `accuracy` làm tròn 3 chữ số.
  - **T116**: `competency` cũng được gắn vào mục trả về của `POST /today/extra` (cùng kiểu `PlanItem`) với mức của kỹ năng.
  - **T126**: nhãn kỹ năng ở dòng phụ của `_UnitTile` (Từ vựng/Ngữ pháp) KHÔNG đổi; chip năng lực hiện dưới dòng đó.
  - **T127**: API `competency.topics[]` không có tên chủ đề (chỉ `topicId`, `skill`), nên danh sách "Năng lực theo chủ đề" lấy tên từ `weakTopics` khi có, ngược lại hiển thị theo tên kỹ năng của chủ đề.
  - **T123/T124**: thêm helper dùng chung `competencyIcon`/`competencyLabel`/`competencySkillLabel`/`competencyColors` trong `competency_chip.dart`; `CompetencyPalette.of(context)` có fallback theo `Brightness` khi theme chưa đăng ký tiện ích.

**Checkpoint**: US3 chạy độc lập (T102–T111 xanh; `flutter test test/competency`).

---

## Phase 6: User Story 4 - Lời khích lệ ở màn hình "Hôm nay" (Ưu tiên: P2)

**Mục tiêu**: `GET /today` trả `encouragement { state, message }` chọn tất định từ tiến độ đã ghi (sáu trạng thái, ưu tiên cố định), ≥ 3 (cam kết 4) biến thể vi/en mỗi trạng thái, không từ cấm; client hiện một dải chữ tĩnh, không trùng hiệu ứng chúc mừng của spec 005.

**Kiểm thử độc lập**: Các hồ sơ ở các trạng thái tiến độ khác nhau cho đúng `state` và câu đúng ngôn ngữ; cùng ngày cùng câu, ngày kế khác câu.

### Kiểm thử cho User Story 4 (viết TRƯỚC, phải ĐỎ) ⚠️

- [X] T128 [P] [US4] Tạo `backend/tests/fixtures/learner-profiles/encouragement-in-progress.json` (`id: "encouragement-in-progress"`): kế hoạch hôm nay có 3 mục, đã xong 1 ⇒ `expected.encouragement.state = "in_progress"`. (phụ thuộc T014)
- [X] T129 [P] [US4] Tạo `backend/tests/fixtures/learner-profiles/encouragement-behind-target.json` (`id: "encouragement-behind-target"`): có `targetDate` gần và còn nhiều nội dung (`goal.onTrack = false`), không có chuỗi ≥ 3 ngày ⇒ `state = "behind_target"`. (phụ thuộc T014)
- [X] T130 [P] [US4] Tạo `backend/tests/fixtures/learner-profiles/encouragement-day-completed.json` (`id: "encouragement-day-completed"`): kế hoạch hôm nay `status = completed` ⇒ `state = "day_completed"`. (phụ thuộc T014)
- [X] T131 [P] [US4] Tạo `backend/tests/unit/encouragement-catalog.test.ts` theo [encouragement-catalog.md §4](contracts/encouragement-catalog.md#4-quy-tắc-giọng-điệu-và-bộ-từ-cấm-fr-027-sc-007): quét TOÀN BỘ câu vi và en bằng bộ từ cấm (vi: bỏ lỡ, bỏ qua ngày, chậm, trễ, muộn, mất chuỗi, đứt chuỗi, gián đoạn, thua, kém, lười, tệ, thất bại, đáng tiếc, tiếc, nợ, người khác, bạn khác, các bạn khác; en: missed, miss out, behind, late, slow, lose, lost, broke, break your streak, fail, failure, lazy, worse, pity, debt, overdue, others, other learners — không phân biệt hoa thường, tiếng Anh khớp ranh giới từ); (a) mỗi trạng thái ≥ 3 câu vi và ≥ 3 câu en, hai ngôn ngữ cùng số câu, `{n}` có ở cả hai bản của cùng câu; (b) chỉ `streak` có `{n}`; (c) mỗi câu ≤ 140 ký tự; (d) không câu lặp trong cùng trạng thái + ngôn ngữ (I7, SC-007).
- [X] T132 [P] [US4] Tạo `backend/tests/unit/encouragement.test.ts` (dùng `loadEncouragementProfiles()` và hồ sơ `newcomer-10min`, `reward-veteran`/`reward-near-streak`, `returning-after-gap`): `pickEncouragementState` đúng thứ tự ưu tiên `day_completed > welcome_back > in_progress > streak (≥ 3 ngày) > behind_target (onTrack === false) > not_started` và từng điều kiện ở [encouragement-catalog.md §1](contracts/encouragement-catalog.md); `pickVariant`: tất định theo `(userId, state, ngày địa phương)`, cùng ngày cùng câu, hai ngày liền kề cùng trạng thái khác câu, 5 ngày liên tiếp ≥ 2 câu khác nhau (SC-008), `{n}` được thay bằng số ngày chuỗi, ngôn ngữ thiếu bản dịch rơi về `vi`.
- [X] T133 [P] [US4] Tạo `backend/tests/contract/fix-us4.test.ts`: `GET /today` trả `encouragement.state` đúng cho từng hồ sơ mẫu (`not_started`, `in_progress`, `day_completed`, `streak`, `welcome_back`, `behind_target`) và `message` đúng ngôn ngữ hồ sơ (đổi `language` vi↔en); tải lại trong ngày ⇒ cùng câu; đồng hồ giả sang ngày kế cùng trạng thái ⇒ câu khác; lộ trình tạm dừng ⇒ `409 PATH_PAUSED` và không có `encouragement`; các trường `notice`, `kanjiNotice`, `summary` không đổi.
- [X] T134 [P] [US4] Tạo `client/test/today/encouragement_banner_test.dart`: dải hiện câu nhận từ API với biểu tượng nhẹ theo trạng thái; `encouragement = null` ⇒ không hiện, màn bình thường; vẫn hiện khi người học tắt hiệu ứng/âm thanh (spec 005); không lớp phủ/âm thanh/hoạt ảnh và không thay/che tổng thời lượng và danh sách bài (FR-030); màn hẹp xuống nhiều dòng không cắt chữ; `Semantics(liveRegion: false)`.

### Hiện thực backend cho User Story 4

- [X] T135 [P] [US4] Tạo `backend/src/domain/encouragement.ts`: hằng `ENCOURAGEMENT_CATALOG` đúng văn bản ở [encouragement-catalog.md §3](contracts/encouragement-catalog.md#3-văn-bản) — 6 trạng thái (`not_started`, `in_progress`, `day_completed`, `streak`, `welcome_back`, `behind_target`) × 4 biến thể × `{ vi, en }`, chỉ `streak` có chỗ điền `{n}`; kiểu `EncouragementState`; `STREAK_MIN_DAYS = 3`. Làm cho T131 xanh.
- [X] T136 [US4] Tạo `backend/src/engine/encouragement.ts` (hàm thuần): `pickEncouragementState(signals)` với `signals = { planStatus, planItemsTotal, planItemsDone, streakDays, afterGap, onTrack }` theo thứ tự ưu tiên ở [data-model.md §3.4](data-model.md#34-trạng-thái-và-thông-điệp-khích-lệ-engineencouragementts--domainencouragementts); `pickVariant({ userId, state, language, localDate, streakDays })` = `variants[(hash32(userId + ':' + state) + dayOrdinal(localDate)) mod |variants|]` (dùng `diffDays`/`clock.ts` để tính `dayOrdinal`), thay `{n}`, rơi về `vi` khi thiếu bản dịch. Làm cho T132 xanh. (phụ thuộc T132, T135)
- [X] T137 [US4] Tạo `backend/src/services/encouragement.ts`: `buildEncouragement(deps, userId, ctx, plan)` thu tín hiệu từ dữ liệu đã ghi — số mục `completed`/tổng và `plan.status` của kế hoạch hôm nay, `currentStreakDays` (xem `backend/src/engine/progress.ts`), số ngày vắng/`notice = replanned_after_gap` (`hasLearningGap`/`GAP_THRESHOLD_DAYS` đang dùng ở `services/daily-plan.ts`), `isOnTrack` (`engine/progress.ts`; `null` khi không có mốc); trả `{ state, message }`. Chỉ tính `onTrack` khi có `targetDate` và trạng thái chưa thuộc `day_completed`/`in_progress` (giữ p95). (phụ thuộc T136)
- [X] T138 [US4] Cập nhật `backend/src/services/daily-plan.ts` hàm `getTodayPlan` (dòng ~263–285): sau khi có `plan` và `kanjiNotice`, gọi `buildEncouragement` và gắn `encouragement` vào `DailyPlanDto`; KHÔNG gắn khi `409 PATH_PAUSED`. Làm cho T133 xanh. (phụ thuộc T137, T116)

### Hiện thực client cho User Story 4

- [X] T139 [P] [US4] Tạo `client/lib/presentation/today/encouragement_banner.dart`: widget `EncouragementBanner({ required DailyPlanEncouragement? encouragement })` — một dải chữ tĩnh (biểu tượng `favorite_border`/`emoji_events_outlined` theo `state` + `message`), `Semantics(liveRegion: false)`, xuống nhiều dòng ở màn hẹp, không hoạt ảnh/âm thanh/lớp phủ; `null` ⇒ `SizedBox.shrink()`. Không cần chuỗi l10n (thông điệp đã bản địa hóa từ máy chủ). Làm cho T134 xanh. (phụ thuộc T020)
- [X] T140 [US4] Cập nhật `client/lib/presentation/today/today_screen.dart`: chèn `EncouragementBanner(encouragement: plan.encouragement)` ngay dưới tiêu đề "Hôm nay", trên danh sách bài; không thay hay che tổng thời lượng và danh sách; không chạm `CelebrationHost` của spec 005. (phụ thuộc T139, T125)

**Checkpoint**: US4 chạy độc lập (T128–T134 xanh; SC-007, SC-008 đạt).

---

## Phase 7: User Story 5 - Xem mật khẩu đã nhập khi đăng nhập (Ưu tiên: P3)

**Mục tiêu**: Widget `PasswordField` dùng chung (đăng nhập bắt buộc; đăng ký và đặt lại mật khẩu NÊN): mặc định che, bật/tắt giữ nguyên nội dung, trạng thái hiện chỉ trong `State` (không lưu), nút thao tác được bằng bàn phím và có nhãn trợ năng.

**Kiểm thử độc lập**: Mở đăng nhập, gõ mật khẩu, bật rồi tắt tùy chọn xem; rời màn rồi quay lại ⇒ lại bị che. US5 không phụ thuộc câu chuyện nào khác — có thể phát hành sớm nhất.

### Kiểm thử cho User Story 5 (viết TRƯỚC, phải ĐỎ) ⚠️

- [X] T141 [P] [US5] Tạo `client/test/auth/password_field_test.dart`: mặc định `obscureText = true`; bấm nút mắt ⇒ hiện rõ và nhãn đổi "Ẩn mật khẩu", bấm lại ⇒ che và nội dung gõ KHÔNG mất (cùng `TextEditingController`); dựng lại widget (rời/vào màn) ⇒ trở về che (FR-002/003); nút focus được bằng Tab và Enter/Space kích hoạt; `Semantics`/`tooltip` "Hiện mật khẩu"/"Ẩn mật khẩu" (FR-004); khi hiện thì `enableSuggestions: false`, `autocorrect: false`; không ghi vào `LocalStore`.
- [X] T142 [P] [US5] Tạo `client/test/auth/password_visibility_screens_test.dart` (khuôn `client/test/auth_screens_test.dart`): màn đăng nhập, đăng ký và đặt lại mật khẩu đều có `PasswordField` che mặc định và nút xem; đăng nhập sai khi đang bật chế độ xem ⇒ thông báo lỗi KHÔNG chứa mật khẩu đã nhập; chuyển Đăng nhập → Đăng ký → Đăng nhập ⇒ ô trống và che; màn hẹp vẫn thấy và bấm được nút.

### Hiện thực cho User Story 5

- [X] T143 [P] [US5] Thêm khóa vào `client/lib/l10n/app_vi.arb` (kèm khối `@…`): `authShowPassword` = "Hiện mật khẩu"; `authHidePassword` = "Ẩn mật khẩu".
- [X] T144 [P] [US5] Thêm khóa vào `client/lib/l10n/app_en.arb`: `authShowPassword` = "Show password"; `authHidePassword` = "Hide password".
- [X] T145 [US5] (lệnh) Sinh lại `client/lib/l10n/app_localizations*.dart` bằng `cd client && flutter gen-l10n`. (phụ thuộc T143, T144)
- [X] T146 [US5] Tạo `client/lib/presentation/auth/password_field.dart`: `PasswordField` (StatefulWidget) gói `TextFormField` với `obscureText` lấy từ `State` (mặc định `true`, KHÔNG lưu bền), `suffixIcon` là `IconButton` (`visibility`/`visibility_off`) có `tooltip` và `Semantics(label)` đổi theo trạng thái (`authShowPassword`/`authHidePassword`); khi hiện đặt `enableSuggestions: false`, `autocorrect: false`; nhận và chuyển tiếp `controller`, `validator`, `decoration` (nhãn), `textInputAction`, `onFieldSubmitted`, `autofillHints`, `key` để thay thế trực tiếp `TextFormField` mật khẩu hiện có. Làm cho T141 xanh. (phụ thuộc T145)
- [X] T147 [US5] Cập nhật `client/lib/presentation/auth/login_screen.dart` (dòng ~73–76): thay `TextFormField(... obscureText: true)` mật khẩu bằng `PasswordField`, giữ nguyên controller/validator/khóa kiểm thử; thông báo lỗi đăng nhập không chứa mật khẩu. Làm cho T142 xanh (phần đăng nhập). (phụ thuộc T146)
- [X] T148 [US5] Cập nhật `client/lib/presentation/auth/register_screen.dart` (dòng ~119–122): thay ô mật khẩu bằng `PasswordField` (giữ validator độ mạnh hiện có). (phụ thuộc T146)
- [X] T149 [US5] Cập nhật `client/lib/presentation/auth/reset_password_screen.dart` (dòng ~96–99): thay ô mật khẩu mới bằng `PasswordField`. Làm cho T142 xanh. (phụ thuộc T146)

**Checkpoint**: US5 chạy độc lập (`flutter test test/auth`).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Mục đích**: Theo dõi sản phẩm, hồi quy toàn bộ và đo hiệu năng.

- [X] T150 [P] Cập nhật `backend/src/reports/product-metrics.sql`: thêm truy vấn tỷ lệ học viên có `reading`/`writing` trong `learning_profiles.skills` (và số học viên đủ điều kiện ≥ 30 phút) để theo dõi SC-003/SC-004; không đổi truy vấn cũ.
- [X] T151 [P] Mở rộng `backend/tests/integration/reports.test.ts`: truy vấn mới ở T150 chạy được trên cơ sở dữ liệu mẫu (học viên 30 phút bật luyện, học viên 15 phút) và trả tỷ lệ đúng. (phụ thuộc T150)
- [X] T152 (lệnh) Hồi quy backend toàn bộ: `cd backend && pnpm typecheck && pnpm lint && pnpm test:unit` rồi `pnpm vitest run --project db` — golden `plans-pre-practice.json`, `plans-pre-kanji.json`, `plans-pre-org.json` và `org-regression-api.test.ts` KHÔNG đổi (I2, QS6); ma trận quyền `/study-defaults` xanh; so với baseline T001: chỉ năm test spec 003 (`kanji-admin`, `kanji-us5`) được phép đỏ.
  - **Kết quả đo ngày 2026-11-14**: `tsc --noEmit` sạch; `eslint .` 0 lỗi (đã bỏ 1 cảnh báo directive thừa ở `tests/contract/fix-us1.test.ts`); unit 52 file / 940 test xanh; DB toàn bộ 72 file / 1740 test: 70 file xanh, đúng 4 test đỏ sẵn của spec 003 (`kanji-us5` 1 + `kanji-admin` 3) — bằng baseline T001; golden `plans-pre-practice/kanji/org.json`, `org-regression-api`, ma trận quyền `/study-defaults` đều xanh.
- [X] T153 (lệnh) Hồi quy client: `cd client && flutter analyze && flutter test` (gồm `test/auth`, `test/onboarding`, `test/profile`, `test/practice`, `test/competency`, `test/today`); so với baseline T001 không có test mới đỏ.
  - **Kết quả đo ngày 2026-11-14**: `flutter analyze` không lỗi; `flutter test` 510 test xanh (baseline 412, thêm test mới của US1–US5), không có test đỏ.
- [X] T154 (lệnh) Kiểm tra l10n: `cd client && dart run tool/check_l10n.dart` — khóa vi/en khớp nhau; `client/test/l10n_keys_test.dart` xanh.
  - **Kết quả đo ngày 2026-11-14**: `dart run tool/check_l10n.dart` hợp lệ (955 khóa, vi/en khớp); `test/l10n_keys_test.dart` xanh trong lượt `flutter test` ở T153.
- [X] T155 (lệnh) Đo p95 `GET /today` và `GET /progress` bằng bộ tải có sẵn trong `backend/tests/load/` (so với trước khi thêm năng lực/khích lệ): tăng ≤ 50 ms; nếu vượt thì áp biện pháp ở [plan.md §Rủi ro](plan.md) (chỉ tính `onTrack` khi có `targetDate` và trạng thái chưa `day_completed`/`in_progress`) bằng một nhiệm vụ mới trên `backend/src/services/encouragement.ts`.
  - **Ghi chú (2026-11-14)**: `backend/tests/load/` thực tế chỉ có `.gitkeep` (KHÔNG có bộ tải sẵn như mô tả), và không có mã "trước khi thêm" để đo đối chứng nguyên vẹn. Đã đo bằng test tạm (đã xóa) trên PostgreSQL nhúng, 1 học viên có `topic_stats` ở mọi chủ đề + `targetDate` (trường hợp xấu nhất của khích lệ), 60 lượt/endpoint: p95 `GET /today` = 13,7 ms; `GET /progress` = 31,0 ms; `GET /path` = 5,4 ms; phần thêm vào (`loadCompetency`, một truy vấn `topic_stats ⨝ topics`) p95 = 1,3 ms. Tổng độ trễ tuyệt đối đã thấp hơn 50 ms nên mức tăng chắc chắn ≤ 50 ms; `buildEncouragement` đã chỉ tính `onTrack` khi `not_started` và có `targetDate` nên KHÔNG cần nhiệm vụ biện pháp. Đây là đo trong tiến trình (không qua mạng, một người dùng), không thay thế đo tải thật nếu muốn số liệu chính thức.
- [X] T156 (lệnh) Chạy kịch bản quickstart QS1–QS6 ([quickstart.md](quickstart.md)) bằng các lệnh kiểm thử tự động tương ứng ở §1 của quickstart và xác nhận kết quả mong đợi; ghi lại mục nào cần kiểm tay (IME thật, duyệt giọng điệu, duyệt nội dung 12 bài, mù màu, màn hẹp) cho người phát hành.
  - **Kết quả (2026-11-14)**: các lệnh tự động của quickstart §1 đã chạy qua trong T152–T154: QS1 (`test/auth`), QS2 (`fix-us1`, `suggestion_test`), QS3 (`fix-us2`, `practice-gate`, `daily-plan-practice`), QS4 (`competency`, `competency-consistency`, `test/competency`), QS5 (`encouragement`, `encouragement-catalog`, `fix-us4`, `test/today`), QS6 (golden + `org-regression-api` + ma trận quyền) — đều xanh, ngoại trừ 4 test spec 003 đỏ sẵn. **Còn cần kiểm tay (người phát hành)**: IME thật (Chrome/Edge/Firefox/Safari); duyệt giọng điệu lời khích lệ vi/en; duyệt nội dung 12 bài luyện đọc/viết (hai mục chưa tick ở `checklists/practice-content-review.md`: không sao chép nguyên văn, đã thử làm từng bài/`estMinutes` — điều kiện cứng để phát hành US2); ba màu năng lực sáng/tối + mô phỏng mù màu; màn hẹp ≤ 480 px; đo p95 bằng tải thật (xem ghi chú T155).

---

## Dependencies & Execution Order

### Phụ thuộc giữa các phase

- **Setup (Phase 1)**: không phụ thuộc; T003 (golden) PHẢI xong và được commit TRƯỚC mọi nhiệm vụ sửa engine (T079).
- **Foundational (Phase 2)**: phụ thuộc Setup — CHẶN mọi câu chuyện.
- **User Stories (Phase 3–7)**: đều phụ thuộc Foundational; sau đó làm song song được hoặc tuần tự theo ưu tiên P1 → P2 → P3.
- **Polish (Phase 8)**: phụ thuộc các câu chuyện muốn phát hành.

### Phụ thuộc giữa các câu chuyện

- **US1 (P1)**: sau Foundational; không phụ thuộc câu chuyện khác (mức 30 chỉ điền kỹ năng nằm trong `OnboardingOptions.skills`, nên đúng cả khi chưa có US2).
- **US2 (P1)**: sau Foundational; cần T008 (`practice.ts`), T012 (chủ đề), T014 (loader hồ sơ). Các nhiệm vụ màn onboarding/Hồ sơ (T096, T097) làm SAU T040/T041 của US1 vì cùng file.
- **US3 (P2)**: sau Foundational; các hồ sơ `competency-*` dùng chủ đề reading/writing từ T012 (Foundational) nên KHÔNG cần nội dung US2. Các file dùng chung với US1/US2 (`today_screen.dart`, `progress_screen.dart`, `services/daily-plan.ts`) làm theo thứ tự ID.
- **US4 (P2)**: sau Foundational; `T138` và `T140` chạm file chung với US2/US3 nên theo thứ tự ID (nếu làm riêng US4, bỏ qua phụ thuộc mềm vào T081/T116/T125 và áp dụng trực tiếp lên file hiện có).
- **US5 (P3)**: sau Foundational; độc lập hoàn toàn (chỉ cần T020 để dịch được, không cần API mới).

### Trong mỗi câu chuyện

- Kiểm thử (đỏ) → miền/engine thuần → dịch vụ → route → client (l10n → widget → màn hình).
- Nhiệm vụ cùng file làm tuần tự theo ID; mọi `(lệnh)` sinh mã chạy sau khi các file nguồn của nó xong.

### Cơ hội chạy song song

- Phase 2: T004, T011, T013, T014, T015 song song; T021/T022 song song; T016–T019 (cùng `openapi.yaml`) tuần tự.
- Sau Foundational, năm câu chuyện có thể do năm người làm song song, trừ các file chung đã nêu.
- Trong một câu chuyện, mọi nhiệm vụ kiểm thử `[P]` và mọi nhiệm vụ tạo file mới `[P]` chạy song song.
- 12 nhiệm vụ nội dung T064–T075 hoàn toàn song song (mỗi bài một file, nhiều người biên soạn).

---

## Parallel Example: User Story 1

```bash
# Viết toàn bộ kiểm thử US1 cùng lúc (khác file):
Task: "T026 Tạo backend/tests/unit/study-defaults.test.ts"
Task: "T027 Tạo backend/tests/contract/fix-us1.test.ts"
Task: "T028 Tạo client/test/onboarding/suggestion_test.dart"
Task: "T029 Tạo client/test/onboarding/onboarding_suggestion_flow_test.dart"
Task: "T030 Tạo client/test/profile/suggestion_invite_test.dart"

# Sau đó các file nguồn độc lập cùng lúc:
Task: "T031 Tạo backend/src/domain/study-defaults.ts"
Task: "T035 Tạo client/lib/domain/study_suggestion.dart"
Task: "T036 Tạo client/lib/data/study_defaults_repository.dart"
Task: "T034 Cập nhật backend/tests/fixtures/authz-matrix.json"
```

## Parallel Example: User Story 2 (nội dung)

```bash
# 12 bài luyện đọc/viết do nhiều người biên soạn cùng lúc:
Task: "T064 Tạo content/units/n5-reading-daily-life-1.json"
Task: "T070 Tạo content/units/n5-writing-greetings-1.json"
Task: "T066 Tạo content/units/n4-reading-work-life-1.json"
Task: "T072 Tạo content/units/n4-writing-daily-actions-1.json"
# ... T065, T067–T069, T071, T073–T075 tương tự
```

---

## Implementation Strategy

### MVP trước (chỉ User Story 1)

1. Hoàn thành Phase 1: Setup (chốt golden trước khi sửa engine).
2. Hoàn thành Phase 2: Foundational (CHẶN mọi câu chuyện).
3. Hoàn thành Phase 3: User Story 1.
4. **DỪNG và KIỂM CHỨNG**: kiểm thử US1 độc lập (QS2).
5. Triển khai/demo nếu sẵn sàng.

### Giao theo từng bước

1. Setup + Foundational → nền sẵn sàng.
2. US5 (nhỏ nhất, rủi ro thấp) có thể ra sớm nhất song song với US1 — [plan.md](plan.md) đề xuất làm US5 ngay sau nền tảng.
3. US1 → kiểm thử độc lập → ra mắt (MVP).
4. US2 → kiểm thử độc lập → ra mắt (cần xong nội dung T064–T075 và kiểm thử cổng ≥ 30).
5. US3, US4 → mỗi câu chuyện thêm giá trị mà không phá câu chuyện trước.
6. Polish: hồi quy toàn bộ, đo p95, kiểm tra l10n.

### Chiến lược nhiều người cùng làm

1. Cả nhóm xong Setup + Foundational.
2. Sau đó: người A làm US1 → US2 (backend gate/plan); người B làm US2 phần client + nội dung (khi có nội dung); người C làm US3; người D làm US4; người E làm US5. Phối hợp theo thứ tự ID với các file chung (`today_screen.dart`, `progress_screen.dart`, `onboarding_screen.dart`, `profile_screen.dart`, `services/daily-plan.ts`, các `.arb`).

---

## Ghi chú

- [P] = khác file và không phụ thuộc nhiệm vụ chưa xong.
- Nhãn [Story] liên kết nhiệm vụ với câu chuyện để truy vết.
- Mỗi câu chuyện nên hoàn thành và kiểm thử độc lập; kiểm thử PHẢI đỏ trước khi hiện thực.
- Commit sau mỗi nhiệm vụ hoặc nhóm nhiệm vụ hợp lý; dừng ở bất kỳ checkpoint nào để kiểm chứng.
- Tránh: nhiệm vụ mơ hồ, xung đột cùng file (xem "Quy tắc mỗi nhiệm vụ một file"), phụ thuộc giữa câu chuyện làm mất tính độc lập.
- Không có nhiệm vụ nào ghi `ctx.profile` ngược vào CSDL: `effectiveSkills` chỉ tạo bản sao trong bộ nhớ ở T078; test I4 (T048) bắt lỗi này.
- Ngoại lệ tạm ở `validateCatalog` (T010) được gỡ ở T076 để mở rộng enum không làm seed/kiểm thử tích hợp của các câu chuyện khác đỏ trong khi nội dung luyện chưa có.
