---

description: "Danh sách task triển khai tính năng Bài học Kanji (003-kanji-lessons)"
---

# Danh sách task: Bài học Kanji

**Đầu vào**: Tài liệu thiết kế tại `specs/003-kanji-lessons/`

**Điều kiện tiên quyết**: plan.md, spec.md, research.md (K1–K16), data-model.md, contracts/api-changes.md, contracts/content-schema.md, quickstart.md (KJ1–KJ10)

**Kiểm thử**: CÓ tạo task kiểm thử vì FR-024 và hiến pháp bắt buộc kiểm thử tự động engine bằng hồ sơ người học đại diện (kể cả hồ sơ không chọn Kanji), SC-006 yêu cầu kiểm thử golden hồi quy, và research K16 cam kết kiểm thử hợp đồng OpenAPI 1.11.0, tích hợp PostgreSQL, kiểm tra nội dung + phủ glyph và widget test Flutter. Không thêm TDD ngoài phạm vi đó.

**Tổ chức**: Task được nhóm theo câu chuyện người dùng (US1–US5) để triển khai và kiểm thử độc lập.

## Định dạng: `[ID] [P?] [Story] Mô tả kèm đường dẫn file`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa xong)
- **[Story]**: Câu chuyện người dùng mà task thuộc về (US1…US5)
- Mọi đường dẫn tính từ thư mục gốc kho mã (`backend/`, `client/`, `content/`, `specs/`)

## Quy ước chung cho mọi task

- Comment và tài liệu đi kèm mã bằng **tiếng Việt**; tên biến/hàm/lớp bằng tiếng Anh (CLAUDE.md). Nội dung tiếng Nhật giữ nguyên.
- Đây là tính năng **mở rộng** hệ thống 001 đã hoàn tất: ưu tiên sửa file có sẵn, giữ nguyên chữ ký engine (`rankDueItems`, `packReviewBatches`, `planDailyPlan`, `rankUnits`) và hành vi với người học không chọn Kanji (FR-009, SC-006).
- Mọi truy vấn dữ liệu người học PHẢI lọc theo `user_id` lấy từ token (R16 của 001).
- Tên route, trường JSON, mã lỗi PHẢI khớp `specs/001-phase1-mvp/contracts/openapi.yaml` phiên bản **1.11.0** (sau T003).
- Khóa ghép ôn tập: `itemId` khi facet `item`, `itemId:facet` khi Kanji (research K3) – chỉ mã hóa/giải mã qua `backend/src/domain/review-key.ts`.
- Snapshot phiên giữ `SNAPSHOT_VERSION = 1`; `facet` vắng mặt khi đọc snapshot cũ hiểu là `item` (research K13).
- KHÔNG ĐƯỢC thêm luyện viết tay, thứ tự nét hay chuẩn hóa katakana↔hiragana trong `normalizeAnswer` (plan "Giới hạn phạm vi", research K10).

---

## Phase 1: Thiết lập (hạ tầng dùng chung)

**Mục đích**: Chụp chuẩn so sánh trước khi sửa engine và nâng phiên bản hợp đồng

- [X] T001 Viết script `backend/tests/fixtures/golden/generate-plans-pre-kanji.ts` chạy **mã engine hiện tại (chưa sửa)** cho mọi hồ sơ trong `backend/tests/fixtures/learner-profiles/index.ts` qua `rankUnits` + `planDailyPlan` trong 14 ngày mô phỏng (đồng hồ cố định, kết quả từng ngày được đưa vào trạng thái ngày sau như các test `daily-plan*.test.ts` hiện có), rồi ghi kết quả tất định ra `backend/tests/fixtures/golden/plans-pre-kanji.json`; chạy script và commit file JSON. PHẢI xong trước mọi thay đổi trong `backend/src/engine/` (plan "Thứ tự triển khai" bước 1)
- [X] T002 [P] Nâng JSON Schema nội dung theo contracts/content-schema.md: `content/schema/unit.schema.json` lên 1.1.0 (`$id` `https://japanese-learning.local/schema/unit/1.1.0`; `kind` enum `["vocabulary","grammar","kanji"]`; definition `kanjiDetails` với `required: ["onReadings","kunReadings","strokeCount"]`, `additionalProperties: false`, `onReadings` pattern `^[゠-ヿ]+$`, `kunReadings` pattern `^[぀-ゟ.]+$`, `strokeCount` integer `minimum: 1, maximum: 30`, `components` i18nText; `item.topic`, `item.kanjiDetails`; `example.kanjiReading` string; `exercise.facet` enum `["item","meaning","reading","word"]` default `item`; khối `allOf/if kind=kanji then tier const core, goalTags minItems 1, items minItems 3 maxItems 5, items required ["japanese","meaning","topic","kanjiDetails","examples"]`), `content/schema/topics.schema.json` lên 1.1.0 (`skill` nhận `kanji`), giữ `content/schema/placement.schema.json` 1.0.0; ghi nhật ký vào `content/schema/CHANGELOG.md`
- [X] T003 [P] Áp mọi thay đổi trong contracts/api-changes.md vào `specs/001-phase1-mvp/contracts/openapi.yaml`: `info.version` 1.11.0 và dán nhật ký §1 vào `info.description`; schema `Skill` (+`kanji`), `ReviewFacet`, `KanjiDetails`, `KanjiDetailsWrite`; enum riêng `[vocabulary, grammar]` cho `AdminPlacementQuestion.skill`; `ProfileUpdate.skills` (`minItems: 1`, `uniqueItems: true`); path mới `PUT /path/items/{itemId}/master` (`operationId: setItemMastered`, 200/404/422); `PlanItem.kind`, `DailyPlan.kanjiNotice` (`code` enum `[kanji_exhausted]`, `suggestion` enum `[raise_level, content_exhausted]`); `ContentItem.topicId`, `ContentItem.kanji`, `examples[].kanjiReading`; `Exercise.facet`; `SessionSummary.attentionItems`; `ProgressSummary.kanji` (`required: [charactersLearned, lessonsCompleted, minutes]`, `reviewAccuracy` nullable 0–1), `weakTopics[].skill`; `AdminUnitWrite` (`kind` = `Skill`, `items[].topicId`, `items[].kanjiDetails`, `exercises[].facet` default `item`); tham số lọc `kind` cho `GET /admin/units`, `skill` cho `GET /admin/topics`
- [X] T004 Sinh lại API client Dart từ OpenAPI 1.11.0 vào `client/lib/data/api/generated/` theo đúng các bước trong `client/lib/data/api/README.md` (openapi-generator-cli `dart-dio` → `build_runner` trong `generated/` → `dart run tool/patch_generated_api.dart`); cập nhật `client/test/generated_api_test.dart` để giải mã được `Skill.kanji`, `ReviewFacet`, `kanjiNotice` (phụ thuộc T003)

---

## Phase 2: Nền tảng (điều kiện chặn mọi câu chuyện)

**Mục đích**: Migration, schema, hằng miền, khóa ghép và ghi kết quả theo cặp (chữ, khía cạnh) – mọi câu chuyện đều cần

**⚠️ QUAN TRỌNG**: Không câu chuyện nào được bắt đầu trước khi phase này xong

### CSDL

- [X] T005 Tạo `backend/src/db/migrations/0002_kanji_skill.sql` chỉ gồm `ALTER TYPE skill ADD VALUE IF NOT EXISTS 'kanji';` kèm comment tiếng Việt giải thích vì sao tách file (giá trị enum mới chỉ dùng được sau commit – research K2)
- [X] T006 Tạo `backend/src/db/migrations/0003_kanji.sql` theo data-model.md §5–§6: `CREATE TYPE review_facet AS ENUM ('item','meaning','reading','word')`; `learning_profiles.kanji_selected_at timestamptz NULL`; `content_items.topic_id uuid NULL REFERENCES topics`, `content_items.kanji_details jsonb NULL`; CHECK `content_items` MỘT CHIỀU: `kind = 'kanji' OR kanji_details IS NULL` và `kind = 'kanji' OR topic_id IS NULL` (cho phép lưu nháp chữ Kanji chưa đủ `topic_id`/`kanji_details`; việc đủ dữ liệu được kiểm khi kích hoạt ở T025 – research K10, data-model §3.4); `exercises.facet review_facet NOT NULL DEFAULT 'item'`; `study_records.facet review_facet NOT NULL DEFAULT 'item'`; `review_schedules.facet review_facet NOT NULL DEFAULT 'item'`, `review_schedules.mastered_at timestamptz NULL`, xóa PK cũ `(user_id, item_id)` và tạo PK mới `(user_id, item_id, facet)`; `daily_plan_items.review_facets review_facet[] NULL` với CHECK `review_facets IS NULL OR cardinality(review_facets) = cardinality(review_item_ids)`; CHECK `placement_questions.skill <> 'kanji'`; chỉ mục `study_records(user_id, item_id, facet, occurred_at DESC) WHERE is_retry = false` và `content_items(topic_id) WHERE topic_id IS NOT NULL`. Chỉ thêm cột có DEFAULT hoặc NULL; KHÔNG sửa `learning_profiles.skills` của người dùng hiện có
- [X] T007 Cập nhật schema Drizzle khớp 0002/0003 trong `backend/src/db/schema.ts` (giá trị `kanji` cho enum `skill`, enum `reviewFacet`, các cột mới, PK ghép mới của `review_schedules`) (phụ thuộc T006)
- [X] T008 Mở rộng kiểm thử migration trong `backend/tests/integration/migration.test.ts`: chạy 0001 + seed nội dung 001 + tạo người học có lịch ôn/kế hoạch, rồi chạy 0002, 0003 → mọi dòng `review_schedules`, `exercises`, `study_records` cũ có `facet='item'`, `daily_plan_items.review_facets` NULL, `skills` không đổi, CHECK `placement_questions.skill <> 'kanji'` từ chối chèn Kanji, chèn `content_items` kind khác `kanji` (vocabulary/grammar) có `kanji_details` hoặc `topic_id` khác NULL bị CHECK từ chối, còn chèn `content_items` kind `kanji` thiếu `kanji_details`/`topic_id` (bản nháp) PHẢI được chấp nhận (phụ thuộc T007)

### Miền dùng chung

- [X] T009 [P] Cập nhật hằng trong `backend/src/domain/types.ts`: `SKILLS = ['vocabulary','grammar','kanji']`, mới `PLACEMENT_SKILLS = ['vocabulary','grammar']`, `TRIAL_SKILLS = ['vocabulary','grammar']`, `REVIEW_FACETS = ['item','meaning','reading','word']`, `KANJI_FACETS = ['meaning','reading','word']` và kiểu `ReviewFacet`, `KanjiDetails` (`onReadings: string[]`, `kunReadings: string[]`, `strokeCount: number`, `components?: I18nText`)
- [X] T010 [P] Tạo `backend/src/domain/review-key.ts`: `encodeReviewKey(itemId, facet)` trả `itemId` khi facet `item`, `itemId:facet` khi khác; `decodeReviewKey(key)` trả `{ itemId, facet }` (không có `:` → `item`); ném lỗi với facet không thuộc `REVIEW_FACETS` (phụ thuộc T009)
- [X] T011 [P] Viết kiểm thử đơn vị `backend/tests/unit/review-key.test.ts`: khứ hồi mã hóa/giải mã cho mọi facet, khóa của facet `item` đúng bằng `itemId` (bảo đảm SC-006), từ chối facet lạ (phụ thuộc T010)
- [X] T012 Chặn Kanji ở placement và dùng thử (research K12): thay danh sách kỹ năng cố định bằng `PLACEMENT_SKILLS` trong `backend/src/services/placement.ts`, `backend/src/services/admin-placement.ts` và schema `skill` của câu placement trong `backend/src/domain/admin-validation.ts` (gửi `kanji` → 422); dùng `TRIAL_SKILLS` trong `backend/src/services/trial.ts`; rà mọi chỗ khác lặp `SKILLS` (`grep -rn "SKILLS" backend/src`) và chọn đúng hằng (phụ thuộc T009)
- [X] T013 Mở rộng kiểu snapshot trong `backend/src/domain/session-snapshot.ts` (chưa đổi logic dựng): trường tùy chọn `items[].topicId?`, `items[].kanji?` (`{ onReadings, kunReadings, strokeCount, components? }`), `items[].examples[].kanjiReading?`, `exercises[].facet?`; `parseSnapshot` đọc snapshot thiếu `facet` thành `item`; giữ `SNAPSHOT_VERSION = 1` (data-model §4.3) (phụ thuộc T009)

### Ghi kết quả theo cặp (chữ, khía cạnh)

- [X] T014 Cập nhật `backend/src/db/repositories/review.ts`: upsert lịch ôn theo khóa `(user_id, item_id, facet)`; quy tắc "mỗi cặp cập nhật tối đa một lần mỗi ngày địa phương" áp theo cặp; `recentItemResults` lọc thêm theo `facet` (dùng chỉ mục mới); giữ nguyên hành vi với facet `item` (phụ thuộc T007)
- [X] T015 Cập nhật luồng ghi câu trả lời trong `backend/src/services/lesson-session.ts`: sao chép `facet` của bài tập trong snapshot (vắng mặt = `item`) vào `study_records.facet`; `study_records.topic_id` = `topicId` của mục được kiểm tra nếu có, ngược lại chủ đề của đơn vị (research K4); gọi SRS và `review.ts` theo cặp `(item_id, facet)` (như 001, dòng lịch được ghi theo từng câu; việc chữ Kanji của bài dở dang chưa được tính "đã học" hay vào gói ôn do T061/T072 xử lý, không phải ở đây); `AnswerResult.nextReviewDate` là ngày đến hạn của cặp vừa trả lời (phụ thuộc T013, T014)
- [X] T090 Bộ lọc tạm bảo vệ gói ôn (research K6 "an toàn trung gian"): trong `listDueReviewItems` của `backend/src/db/repositories/review.ts` thêm điều kiện `review_schedules.facet = 'item'` kèm comment tiếng Việt "TẠM THỜI – gỡ ở T061 (US3)" để dòng lịch ôn theo cặp của chữ Kanji (3 dòng/chữ từ T014) không bị trả trùng `item_id` và không lẫn khía cạnh vào gói ôn trước khi US3 hoàn thành; viết kiểm thử tích hợp `backend/tests/integration/kanji-review-guard.test.ts`: người học có 3 dòng `review_schedules` (meaning/reading/word) đến hạn của một chữ Kanji → `GET /today` không có `review_item_ids` trùng lặp và không chứa chữ Kanji đó, còn mục từ vựng/ngữ pháp đến hạn vẫn vào gói ôn như cũ (phụ thuộc T014)
- [X] T016 Chạy lại toàn bộ kiểm thử hiện có (`cd backend && pnpm test`) sau T005–T015 và **T090 (làm T090 trước T016 dù T090 nằm sau trong danh sách)** và sửa hồi quy; mọi test 001 PHẢI xanh trước khi sang câu chuyện

**Checkpoint**: CSDL ở trạng thái 1.11.0, hệ thống 001 vẫn chạy y như cũ – bắt đầu các câu chuyện

---

## Phase 3: US1 – Học một bài Kanji ngắn (Ưu tiên: P1) 🎯 MVP

**Mục tiêu**: Bài Kanji 3–5 chữ (5–15 phút) được kiểm tra nội dung, seed, hiển thị đầy đủ (chữ lớn, nghĩa, On/Kun, số nét, từ ví dụ), có bài tập tự chấm phản hồi tức thì, tiếp tục được, và tóm tắt cuối bài có "chữ cần chú ý".

**Kiểm thử độc lập**: Với thư viện Kanji đã seed, người học có `skills` chứa `kanji` (đặt qua helper kiểm thử) mở bài Kanji từ "Học thêm" (`POST /today/extra`), học hết, làm hết bài tập, dừng/tiếp tục giữa chừng → nội dung đủ, phản hồi tức thì, kết quả được ghi theo cặp, tóm tắt có `attentionItems`, thời lượng ước tính ∈ {5,10,15} (quickstart KJ1, KJ2, KJ10).

### Kiểm thử US1

- [X] T017 [P] [US1] Viết kiểm thử đơn vị `backend/tests/unit/content-validation-kanji.test.ts` cho mọi quy tắc research K10: đơn vị `kind='kanji'` có 3–5 mục Kanji `active` (2 hoặc 6 → lỗi `items`); `tier` khác `core` → lỗi; `goalTags` rỗng → lỗi `goalTags` (FR-011), đơn vị từ vựng/ngữ pháp có `goalTags` rỗng vẫn hợp lệ; thiếu bài tập `active` cho một khía cạnh `meaning`/`reading`/`word` của một chữ → lỗi `exercises` nêu chữ và khía cạnh; bài tập gắn mục Kanji có `facet='item'` → lỗi, bài tập không gắn mục có facet khác `item` → lỗi; `japanese` không phải đúng một ký tự CJK Unified Ideographs → lỗi; thiếu `meaning` vi hoặc en → lỗi; `onReadings ∪ kunReadings` rỗng → lỗi; On không phải katakana / Kun không phải hiragana (cho phép `.`) → lỗi; `strokeCount` ngoài 1–30 hoặc không nguyên → lỗi; thiếu `topicId` hoặc chủ đề có `skill` khác `kanji` → lỗi; không có từ ví dụ → lỗi, 1 từ ví dụ → chỉ cảnh báo; từ ví dụ không chứa chữ, thiếu `reading` kana hoặc thiếu bản dịch vi/en → lỗi; `kanjiReading` ngoài tập cách đọc (bỏ okurigana) → chỉ cảnh báo; đơn vị từ vựng/ngữ pháp chứa mục Kanji → lỗi; `validateCatalog` thiếu bài Kanji `est_minutes=5` ở N5/N4/N3 → lỗi, và quy tắc "N5 foundation 5 phút cho mỗi kind" không áp dụng cho `kanji`; số bài tập `active` × `secondsPerExercise` (tham số, mặc định test 30) vượt `est_minutes` × 60 → lỗi `exercises` (bài 5 phút: 10 bài tập OK, 11 → lỗi; đổi tham số sang 20 thì 15 bài tập OK, 16 → lỗi); chữ `japanese` đã có ở mục Kanji `active` của đơn vị khác (qua tham số `existingKanjiChars`) → lỗi `items[i].japanese` nêu đơn vị đang chứa, còn chữ chỉ trùng với đơn vị `inactive`/chính đơn vị đang kiểm thì hợp lệ; `validateCatalog` phát hiện hai đơn vị `active` cùng chứa một chữ → lỗi
- [X] T018 [P] [US1] Viết kiểm thử đơn vị `backend/tests/unit/font-coverage.test.ts`: đọc `client/assets/fonts/NotoSansJP.ttf`, khẳng định có glyph cho 27 chữ ở research K14 và kana thông dụng; một ký tự ngoài phông (ví dụ ký tự CJK Extension B) được báo thiếu; bảng `cmap` định dạng 4 và 12 đều được đọc
- [X] T019 [P] [US1] Mở rộng `backend/tests/unit/content-files.test.ts`: mọi file `content/units/*-kanji-*.json` hợp lệ với `unit.schema.json` 1.1.0 và `validateCatalog`; mọi ký tự của `japanese` và `examples[].ja` có glyph trong phông (FR-006); mỗi trình độ N5, N4, N3 có ≥ 1 bài Kanji 5 phút (SC-004); mỗi bài Kanji có `goalTags` không rỗng (FR-011); không chữ Kanji nào xuất hiện ở hai bài (research K10 "chữ duy nhất"); số bài tập mỗi bài nằm trong quỹ thời lượng `estMinutes`; mọi file đơn vị cũ vẫn hợp lệ với schema 1.1.0
- [X] T020 [P] [US1] Mở rộng `backend/tests/unit/session-snapshot.test.ts`: `buildSnapshot` cho đơn vị Kanji điền `items[].kanji` (đã bản địa hóa `components` theo ngôn ngữ), `items[].topicId`, `examples[].kanjiReading`, `exercises[].facet`; `publicExercise` không lộ đáp án; snapshot cũ không có `facet` vẫn parse và chấm được
- [X] T021 [P] [US1] Viết kiểm thử hợp đồng `backend/tests/contract/kanji-us1.test.ts` (dùng helper `backend/tests/contract/helper.ts`): `POST /sessions` cho đơn vị Kanji trả `ContentItem.kanji`, `topicId`, `reading = null`, `Exercise.facet` khớp OpenAPI 1.11.0; `POST /sessions/{id}/complete` trả `SessionSummary.attentionItems`; phiên từ vựng không có `attentionItems`
- [X] T022 [P] [US1] Viết kiểm thử tích hợp `backend/tests/integration/kanji-lesson.test.ts` (PostgreSQL thật, dùng `backend/tests/integration/lesson-helpers.ts`): người học có `skills` gồm `kanji` nhận bài Kanji từ `POST /today/extra`; trả lời từng câu → `study_records.facet` đúng khía cạnh, `study_records.topic_id` = chủ đề của chữ; trả lời 2 câu rồi mở lại phiên → tiếp tục từ câu 3, không mất câu đã ghi (US1.3); gửi lại cùng `clientEventId` → ghi một lần; hoàn thành → `unit_progress` completed, mỗi chữ có đủ 3 dòng `review_schedules` (meaning/reading/word – US3.1), tóm tắt có `attentionItems` chứa chữ đã trả lời sai; nghĩa/phản hồi theo `en` khi ngôn ngữ giao diện tiếng Anh (US1.5); mất kết nối giữa chừng (mô phỏng một lần gửi câu trả lời thất bại) → câu đã ghi được giữ và `POST /sessions/{id}/complete` không đánh dấu hoàn thành khi chưa lưu đủ câu trả lời, thử lại thành công thì hoàn thành đúng một lần (trường hợp biên "mất kết nối")
- [X] T023 [P] [US1] Viết widget test `client/test/kanji_card_test.dart`: chữ chính hiển thị cỡ 96 px (≥ 72 px ở cửa sổ hẹp) với `fontFamily: 'NotoSansJP'`; chỉ hiện nhóm âm On/âm Kun có dữ liệu (chữ chỉ có Kun không hiện nhãn On trống); okurigana `た.べる` hiển thị `た(べる)`; số nét, `components` nếu có; từ ví dụ có kana, nghĩa và cách đọc của chữ trong từ (`kanjiReading`); văn bản theo `vi`/`en`

### Triển khai US1

- [X] T024 [P] [US1] Tạo `backend/src/domain/font-coverage.ts`: bộ đọc bảng `cmap` (định dạng 4 và 12) không thêm phụ thuộc; dựng tập code point của `client/assets/fonts/NotoSansJP.ttf` một lần lúc khởi động (lưu bộ nhớ, đường dẫn phông lấy từ `backend/src/config.ts` với mặc định tương đối tới kho mã); hàm `findMissingGlyphs(text): string[]` (research K9)
- [X] T025 [US1] Mở rộng `backend/src/domain/content-validation.ts` với mọi quy tắc Kanji ở research K10 / data-model §3.3–§3.5 (đúng danh sách kiểm thử ở T017), trả lỗi theo đường dẫn (`items`, `items[i].kanjiDetails`, `items[i].topicId`, `items[i].meaning`, `items[i].examples`, `exercises`) và cảnh báo tách riêng; gọi `findMissingGlyphs` cho `japanese` và `examples[].ja`; thêm quy tắc `goalTags` không rỗng với `kind='kanji'` và quy tắc thời lượng (số bài tập `active` × `secondsPerExercise` ≤ `est_minutes` × 60; `secondsPerExercise` là tham số của hàm, dịch vụ truyền `config.REVIEW_SECONDS_PER_ITEM`, mặc định 30 — không cứng hóa trong miền) và quy tắc "chữ duy nhất" (hàm kiểm tra đơn vị nhận thêm tham số `existingKanjiChars: Map<string, {unitId, unitSlug}>` — chữ → đơn vị `active` khác đang chứa — do dịch vụ truyền vào); cập nhật `validateCatalog` (mỗi trình độ N5/N4/N3 có ≥ 1 bài Kanji `active` `est_minutes=5`, không chữ nào ở hai đơn vị `active`, bỏ quy tắc foundation cho `kanji`) (phụ thuộc T009, T024)
- [X] T026 [P] [US1] Thêm 6 chủ đề Kanji vào `content/topics.json` đúng contracts/content-schema.md §3: `kanji-n5-numbers`, `kanji-n5-time`, `kanji-n4-people`, `kanji-n4-nature`, `kanji-n3-work`, `kanji-n3-society` (`skill: "kanji"`, `level`, tên vi/en)
- [X] T027 [P] [US1] Biên soạn 3 bài Kanji N5 theo research K14 và mẫu contracts/content-schema.md §1: `content/units/n5-kanji-numbers-1.json` (一 二 三, `estMinutes` 5), `content/units/n5-kanji-numbers-2.json` (四 五 六 七 八, 10), `content/units/n5-kanji-time.json` (日 月 年 時, 10); mỗi bài khai báo `goalTags` không rỗng (FR-011; ví dụ `["jlpt","daily_conversation","work"]` tùy chủ đề) và số bài tập nằm trong quỹ thời lượng `estMinutes` (30 giây/câu); mỗi chữ đủ nghĩa vi/en, On/Kun, số nét, chủ đề, ≥ 2 từ ví dụ có `kanjiReading`, và ≥ 1 bài tập cho mỗi khía cạnh `meaning`/`reading`/`word` với phản hồi vi/en; câu `reading` của chữ nhiều cách đọc PHẢI nêu từ ngữ cảnh; `fill_blank` khai báo mọi dạng kana chấp nhận (ví dụ cả `さん` và `サン`)
- [X] T028 [P] [US1] Biên soạn 2 bài Kanji N4 theo cùng quy tắc T027 (gồm `goalTags` và quỹ thời lượng): `content/units/n4-kanji-people-body.json` (体 首 顔, 5 phút, chủ đề `kanji-n4-people`), `content/units/n4-kanji-nature.json` (空 海 林 森 風, 10 phút, chủ đề `kanji-n4-nature`)
- [X] T029 [P] [US1] Biên soạn 2 bài Kanji N3 theo cùng quy tắc T027 (gồm `goalTags` và quỹ thời lượng): `content/units/n3-kanji-work.json` (職 給 務, 5 phút, chủ đề `kanji-n3-work`), `content/units/n3-kanji-society.json` (政 経 済 民, 10 phút, chủ đề `kanji-n3-society`)
- [X] T030 [P] [US1] Viết hướng dẫn biên soạn Kanji **kèm checklist duyệt nội dung** (mục "Duyệt trước khi kích hoạt": câu `reading` của chữ nhiều cách đọc đã nêu từ ngữ cảnh và không có hai đáp án đúng; `fill_blank` khai báo đủ dạng kana; `goalTags` không rỗng; chữ chưa có ở bài khác; không nội dung luyện viết) trong `content/README.md`: thời lượng (5 phút = 3 chữ × 3 bài tập ≈ 9 câu; 10 phút = 4–5 chữ; 15 phút = 5 chữ có thêm bài ghép cặp), quy ước On katakana / Kun hiragana với `.` phân cách okurigana, câu `reading` phải nêu từ ngữ cảnh, khai báo đủ dạng kana chấp nhận, khóa chủ đề tiền tố `kanji-`, khai báo `goalTags` cho mỗi bài, quỹ thời lượng (số bài tập × 30 giây ≤ `estMinutes` × 60), mỗi chữ chỉ thuộc MỘT bài (cách đọc mới ở trình độ cao hơn bổ sung vào mục hiện có), cấm nội dung luyện viết (research K10, K14)
- [X] T031 [US1] Cập nhật seed `backend/src/seed/content.ts`: ánh xạ `item.topic` → `content_items.topic_id`, `kanjiDetails` → `kanji_details`, `examples[].kanjiReading`, `exercise.facet` → `exercises.facet`; `reading` = NULL cho mục Kanji; chạy kiểm tra JSON Schema 1.1.0 + `content-validation.ts` (gồm phủ glyph) trước khi ghi; seed lại idempotent; in số bài Kanji đã nạp; mở rộng `backend/tests/integration/seed.test.ts` khẳng định 7 bài Kanji và 6 chủ đề Kanji được nạp, seed hai lần không nhân bản (phụ thuộc T025–T029)
- [X] T032 [US1] Đưa `topic_id`, `kanji_details` của mục vào bộ đệm danh mục `backend/src/services/content-cache.ts` (và truy vấn nạp nội dung nó dùng) để snapshot đọc được (phụ thuộc T007)
- [X] T033 [US1] Dựng snapshot Kanji trong `buildSnapshot` của `backend/src/domain/session-snapshot.ts`: điền `items[].kanji` (bản địa hóa `components` theo ngôn ngữ phiên), `items[].topicId`, `examples[].kanjiReading`, `exercises[].facet` (phụ thuộc T013, T032)
- [X] T034 [US1] Thêm `attentionItems` (`{itemId, japanese}` theo thứ tự xuất hiện, chỉ mục Kanji có ≥ 1 câu lượt chính sai; vắng mặt với phiên không có Kanji) vào tóm tắt phiên trong `backend/src/services/lesson-session.ts` và tuần tự hóa ở `backend/src/api/sessions.ts` (phụ thuộc T015)
- [X] T035 [US1] Tuần tự hóa `ContentItem.kanji`, `topicId`, `examples[].kanjiReading`, `Exercise.facet` đúng OpenAPI 1.11.0 trong `backend/src/api/sessions.ts` (phụ thuộc T033)
- [X] T036 [P] [US1] Tạo widget thẻ chữ `client/lib/presentation/lesson/kanji/kanji_card.dart` theo research K9 (chữ 96 px / tối thiểu 72 px, `NotoSansJP`, On katakana, Kun hiragana hiển thị okurigana dạng `た(べる)`, chỉ hiện nhóm có dữ liệu, số nét, thành phần, danh sách từ ví dụ có kana, nghĩa và `kanjiReading`); comment tiếng Việt
- [X] T037 [US1] Tích hợp thẻ chữ vào luồng bài học: `client/lib/presentation/lesson/lesson_screen.dart` và `client/lib/presentation/lesson/lesson_controller.dart` hiển thị `kanji_card.dart` cho mục có `kanji`; màn hình tóm tắt cuối bài hiển thị mục "Chữ cần chú ý" từ `attentionItems` (phụ thuộc T004, T036)
- [X] T038 [US1] Thêm khóa l10n cho bài Kanji (nhãn âm On, âm Kun, số nét, thành phần, từ ví dụ, "Chữ cần chú ý") vào `client/lib/l10n/app_vi.arb` và `client/lib/l10n/app_en.arb`, sinh lại `app_localizations*.dart`, chạy `dart run tool/check_l10n.dart`

**Checkpoint**: Bài Kanji học được đầu-cuối qua "Học thêm" – US1 hoạt động và kiểm thử độc lập được

---

## Phase 4: US2 – Kanji nằm trong lộ trình và kế hoạch hằng ngày (Ưu tiên: P1)

**Mục tiêu**: Chọn Kanji ở onboarding/điều chỉnh kế hoạch; kế hoạch hằng ngày chen bài Kanji từ ngày đầu, trong quỹ thời gian, ưu tiên được, có thông báo khi hết bài; người không chọn Kanji không đổi gì.

**Kiểm thử độc lập**: Hồ sơ có chọn Kanji ở 5/10/15/30 phút và nhiều trình độ, sinh kế hoạch 14 ngày → có bài Kanji ở ngày đầu có bài mới, tổng ≤ quỹ, mỗi mục ≤ 15 phút; hồ sơ cũ trùng ảnh chụp golden (quickstart KJ1, KJ3, KJ4, KJ8).

### Kiểm thử US2

- [X] T039 [P] [US2] Tạo 7 hồ sơ đại diện Kanji (research K16) trong `backend/tests/fixtures/learner-profiles/`: `kanji-newcomer-5min.json`, `kanji-newcomer-10min.json`, `kanji-n4-15min.json`, `kanji-prioritized-30min.json`, `kanji-added-later.json` (người dùng cũ thêm Kanji, có tiến độ và lịch ôn từ vựng/ngữ pháp), `kanji-removed.json` (bỏ chọn, còn lịch ôn Kanji), `kanji-exhausted-n5.json` (mục tiêu N5, đã hoàn thành mọi bài Kanji N5); đăng ký trong `backend/tests/fixtures/learner-profiles/index.ts` thành nhóm riêng để golden test T040 chỉ duyệt hồ sơ cũ
- [X] T040 [P] [US2] Viết kiểm thử golden `backend/tests/unit/kanji-regression-golden.test.ts`: chạy mọi hồ sơ cũ (không Kanji) qua `rankUnits` + `applyKanjiSlot` + `planDailyPlan` 14 ngày với cùng cách mô phỏng như T001 và so sánh sâu với `backend/tests/fixtures/golden/plans-pre-kanji.json`; mọi khác biệt là lỗi (SC-006, FR-009)
- [X] T041 [P] [US2] Viết kiểm thử đơn vị `backend/tests/unit/daily-plan-kanji.test.ts`: `applyKanjiSlot` no-op khi `kanji ∉ skills` hoặc không có ứng viên Kanji; đưa ứng viên Kanji đầu tiên lên vị trí 0 khi `prioritizedSkill='kanji'` hoặc kế hoạch gần nhất có bài mới (trước hôm nay) không chứa bài Kanji, phần còn lại giữ thứ tự; giữ nguyên trong trường hợp còn lại; mọi hồ sơ Kanji × {5,10,15,30} phút × 14 ngày: tổng ≤ quỹ, mỗi mục ≤ 15 phút, ngày đầu có bài mới chứa bài Kanji (SC-001, SC-002, FR-012), Kanji xuất hiện ít nhất cách một ngày có bài mới và không chiếm mọi ngày khi không ưu tiên (trường hợp biên 5 phút); hồ sơ ưu tiên có tỷ trọng Kanji trong phần bài mới lớn hơn cùng hồ sơ không ưu tiên (US2.5); hồ sơ `kanji-removed` không có bài Kanji mới nhưng vẫn có cặp Kanji đến hạn trong gói ôn
- [X] T042 [P] [US2] Viết kiểm thử hợp đồng `backend/tests/contract/kanji-us2.test.ts`: `PATCH /me` với `skills` (thêm/bỏ `kanji`) khớp `ProfileUpdate`; `skills` rỗng hoặc chứa `listening`/`reading` → 422 `VALIDATION_FAILED` với `fields.skills`; `GET /today` có `PlanItem.kind` (Skill với `new_unit`, null với `review_batch`) và `kanjiNotice` khi hết bài; người không chọn Kanji không có `kanjiNotice` và không có `PlanItem.kind = kanji`
- [X] T043 [P] [US2] Viết kiểm thử tích hợp `backend/tests/integration/kanji-plan.test.ts`: onboarding với `skills` gồm `kanji` → `kanji_selected_at` được đặt, kế hoạch hôm nay có bài Kanji đúng trình độ; người dùng cũ `PATCH /me` thêm Kanji → kế hoạch hôm nay không đổi, kế hoạch ngày hôm sau có bài Kanji, `unit_progress`/`review_schedules`/`topic_stats` giữ nguyên, không tạo `learning_paths` mới (US2.4); bỏ kỹ năng đang là `prioritizedSkill` → `prioritizedSkill = null` trong cùng giao dịch; bỏ rồi chọn lại → `kanji_selected_at` đặt lại; `POST /path/rebuild` với người học có Kanji (FR-010) → lộ trình dựng lại có bài Kanji đúng trình độ, `unit_progress`/`review_schedules`/`topic_stats` giữ nguyên; `PUT /path/units/{unitId}/master` với bài Kanji → bài rời khỏi danh sách bài sắp tới, lịch ôn các chữ của bài giữ nguyên, bỏ đánh dấu thì bài quay lại; hồ sơ hết bài Kanji N5 → `kanjiNotice = {code: kanji_exhausted, suggestion: raise_level}` và kế hoạch không trống; `POST /today/extra` trả được đơn vị Kanji; mục tiêu/trình độ N2/N1 → nội dung Kanji chỉ tới N3 với `scopeNotice` hiện có
- [X] T044 [P] [US2] Cập nhật widget test `client/test/onboarding_flow_test.dart` và `client/test/plan_adjust_test.dart`: Kanji chọn được (không khóa), Nghe/Đọc vẫn khóa kèm ghi chú "chưa có trong phiên bản này"; bật/tắt Kanji và chọn ưu tiên Kanji gửi `PATCH /me` đúng; bỏ Kanji khi đang ưu tiên Kanji thì UI xóa lựa chọn ưu tiên; mở rộng test màn hình "Hôm nay" trong `client/test/lesson_flow_test.dart` cho nhãn Kanji của mục bài mới và banner `kanjiNotice`

### Triển khai US2

- [X] T045 [US2] Cập nhật `backend/src/domain/profile-validation.ts`: `skillsSchema` là tập con không rỗng, không trùng của `SKILLS` (gồm `kanji`; `listening`/`reading` bị từ chối với thông điệp "chưa có trong phiên bản này"); thêm `skills` vào `profileUpdateSchema`; `prioritizedSkill` có thể là `kanji` và PHẢI thuộc `skills` (phụ thuộc T009)
- [X] T046 [US2] Cập nhật `backend/src/db/repositories/profiles.ts` và `backend/src/services/profile.ts`: đổi `skills` qua `PATCH /me` KHÔNG sinh lộ trình mới, không đụng `unit_progress`/`study_records`/`review_schedules`/`topic_stats`; nếu `prioritizedSkill` hiện tại hoặc gửi kèm không thuộc `skills` mới thì đặt `null` trong cùng giao dịch; đặt `kanji_selected_at = now()` khi `kanji` được thêm mà trước đó không có, giữ nguyên khi bỏ chọn; 422 khi chưa hoàn tất onboarding (phụ thuộc T045)
- [X] T047 [US2] Đặt `kanji_selected_at` khi onboarding hoàn tất với `skills` gồm `kanji` trong `backend/src/services/onboarding.ts` (`PUT /onboarding`, `POST /onboarding/complete` nhận `kanji`) (phụ thuộc T046)
- [X] T048 [US2] Nhận `skills` trong `PATCH /me` tại `backend/src/api/account.ts`, trả lỗi 422 `fields.skills` đúng hợp đồng (phụ thuộc T046)
- [X] T049 [US2] Thêm hàm thuần `applyKanjiSlot` vào `backend/src/engine/daily-plan.ts` theo đúng thuật toán research K5 (no-op khi `'kanji' ∉ skills` hoặc không có ứng viên Kanji; đưa ứng viên Kanji đầu tiên lên vị trí 0 khi `prioritizedSkill = 'kanji'` HOẶC kế hoạch gần nhất có bài mới trước hôm nay không chứa bài Kanji; ngược lại giữ nguyên); KHÔNG đổi `planDailyPlan`, `MAX_REVIEW_SHARE`, `MAX_ITEM_MINUTES`, quy tắc luân phiên; rà `backend/src/engine/path.ts` để khẳng định `rankUnits` không gán trọng số `foundation` cho đơn vị Kanji (không cần sửa nếu đã đúng) (phụ thuộc T001, T009)
- [X] T050 [US2] Thêm truy vấn "kế hoạch gần nhất trước hôm nay có mục `new_unit` và các `kind` của đơn vị trong đó" vào `backend/src/db/repositories/plans.ts` (phụ thuộc T007)
- [X] T051 [US2] Tích hợp vào `backend/src/services/daily-plan.ts`: gọi `applyKanjiSlot` lên danh sách ứng viên đã xếp hạng trước `planDailyPlan`; điền `PlanItem.kind` (kỹ năng đơn vị với `new_unit`, null với `review_batch`); tính `kanjiNotice` khi `'kanji' ∈ skills` và không còn bài Kanji sắp tới trong khoảng trình độ (`suggestion = raise_level` nếu còn bài Kanji `active` ở trình độ cao hơn ≤ N3, ngược lại `content_exhausted`), tách khỏi trường `notice` hiện có; `POST /today/extra` chọn được đơn vị Kanji khi đã chọn Kanji (phụ thuộc T049, T050)
- [X] T052 [US2] Tuần tự hóa `PlanItem.kind` và `DailyPlan.kanjiNotice` trong `backend/src/api/daily.ts` (phụ thuộc T051)
- [X] T053 [P] [US2] Bỏ khóa Kanji trong `client/lib/domain/onboarding_form.dart` và hiển thị Kanji chọn được trong `client/lib/presentation/onboarding/onboarding_screen.dart`, `client/lib/presentation/onboarding/onboarding_labels.dart` (Nghe/Đọc vẫn khóa kèm ghi chú) (phụ thuộc T004)
- [X] T054 [P] [US2] Cho phép bật/tắt Kanji và ưu tiên Kanji trong `client/lib/presentation/path/plan_adjust_screen.dart` (bỏ `'kanji'` khỏi `_lockedSkills`), gửi `skills` qua `client/lib/data/plan_adjustment_repository.dart`; bỏ Kanji khi đang ưu tiên Kanji thì xóa lựa chọn ưu tiên trên UI (phụ thuộc T004)
- [X] T055 [P] [US2] Hiển thị nhãn Kanji cho `PlanItem.kind = kanji` và banner `kanjiNotice` (thông báo + gợi ý `raise_level`/`content_exhausted`) trong `client/lib/presentation/today/today_screen.dart`; bắt đầu bài Kanji ≤ 2 lần nhấp từ "Hôm nay" (SC-001) (phụ thuộc T004)
- [X] T056 [US2] Thêm khóa l10n cho kỹ năng Kanji, ưu tiên Kanji, nhãn mục Kanji và thông báo `kanji_exhausted` vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb`; sinh lại và chạy `dart run tool/check_l10n.dart` (phụ thuộc T053–T055)

**Checkpoint**: US1 + US2 = MVP Kanji: người học chọn Kanji và có bài Kanji trong "Hôm nay" mà không tự lên kế hoạch

---

## Phase 5: US3 – Ôn lại Kanji sắp quên (Ưu tiên: P2)

**Mục tiêu**: Mỗi cặp (chữ, khía cạnh) có lịch ôn SM-2 riêng, vào gói ôn chung chỉ với các khía cạnh đến hạn; đánh dấu/bỏ đánh dấu chữ thành thạo.

**Kiểm thử độc lập**: Người học đã học vài bài Kanji, mô phỏng ngày trôi qua và kết quả đúng/sai → gói ôn có đúng các cặp đến hạn, cặp sai quay lại sớm hơn, khía cạnh khác không đổi lịch, chữ đã thành thạo bị loại (quickstart KJ5, KJ7).

### Kiểm thử US3

- [X] T057 [P] [US3] Viết kiểm thử đơn vị `backend/tests/unit/srs-kanji-facets.test.ts`: mô phỏng nhiều cặp (chữ, khía cạnh) qua `backend/src/engine/srs.ts` – từ lần ôn thứ hai, khoảng cách đến hạn trung bình của cặp trả lời sai ngắn hơn ≥ 50% so với cặp đúng trên mọi hồ sơ (SC-005), đúng liên tiếp làm khoảng cách tăng dần (US3.4), cập nhật một cặp không đổi lịch các khía cạnh khác (US3.3); khóa ghép `itemId:facet` đi qua `rankDueItems` + `packReviewBatches` giữ đúng thứ tự quá hạn, mỗi gói ≤ 15 phút và tôn trọng `REVIEW_SECONDS_PER_ITEM`
- [X] T058 [P] [US3] Viết kiểm thử hợp đồng `backend/tests/contract/kanji-us3.test.ts`: `PUT /path/items/{itemId}/master` 200 `{itemId, mastered}`, idempotent; 404 khi người học chưa học chữ (không có lịch ôn) hoặc chưa onboarding; 422 khi mục không phải Kanji hoặc thân yêu cầu sai; `AnswerResult.nextReviewDate` có mặt cho câu ôn Kanji
- [X] T059 [P] [US3] Viết kiểm thử tích hợp `backend/tests/integration/kanji-review.test.ts`: sau khi hoàn thành bài Kanji và tiến +1 ngày, `GET /today` có gói ôn với `review_item_ids` và `review_facets` song song cùng độ dài, chỉ các cặp đến hạn, chung quỹ với ôn từ vựng; trả lời đúng (X, meaning), sai (X, reading) → (X, reading) đến hạn sau 1 ngày, (X, meaning) muộn hơn, (X, word) không đổi; gói ôn không có Kanji có `review_facets` NULL; không còn `review_item_ids` trùng cho cùng chữ (thay thế bộ lọc tạm T090); đánh dấu chữ thành thạo → mọi cặp có `mastered_at`, không vào gói ôn; bỏ đánh dấu → quay lại từ `due_date` đã lưu; ngừng bài tập duy nhất của một cặp → cặp bị bỏ qua, lịch giữ nguyên (FR-022); hai cửa sổ trả lời cùng câu ôn → ghi một lần; bài Kanji **dở dang** (đã trả lời một số câu, chưa hoàn thành) → dòng `review_schedules` của chữ đã trả lời có thể tồn tại nhưng chữ KHÔNG vào gói ôn dù quá hạn, và vào gói ôn sau khi bài hoàn thành; đánh dấu thành thạo cả bài (`PUT /path/units/{unitId}/master`) không loại lịch ôn các chữ của bài khỏi gói ôn (chỉ đánh dấu cấp chữ mới loại)
- [X] T060 [P] [US3] Mở rộng widget test `client/test/review_flow_test.dart`: câu ôn Kanji hiển thị đúng chữ bằng `NotoSansJP` theo khía cạnh; nút đánh dấu chữ thành thạo gọi `setItemMastered` và cập nhật trạng thái

### Triển khai US3

- [X] T061 [US3] Cập nhật `listDueReviewItems` trong `backend/src/db/repositories/review.ts` — GỠ bộ lọc tạm `facet = 'item'` của T090 và xóa/đổi `kanji-review-guard.test.ts` cho khớp hành vi mới — trả thêm `facet` và `kind`, lọc `due_date ≤ hôm nay AND mastered_at IS NULL AND mục active AND đơn vị active AND tồn tại bài tập active có cùng item_id và facet AND (mục không phải Kanji OR người học có unit_progress.status='completed' cho đơn vị chứa chữ)` (chữ trong bài dở dang không vào gói ôn – data-model §3.7); thêm `setItemMastered(userId, itemId, mastered)` đặt/xóa `mastered_at` cho mọi cặp của chữ (phụ thuộc T014)
- [X] T062 [US3] Ghi/đọc `review_facets` song song với `review_item_ids` trong `backend/src/db/repositories/plans.ts` (NULL khi mọi phần tử là `item`) (phụ thuộc T050)
- [X] T063 [US3] Trong `backend/src/services/daily-plan.ts`: mã hóa mục đến hạn bằng `encodeReviewKey` trước khi gọi `rankDueItems`/`packReviewBatches`, giải mã bằng `decodeReviewKey` khi ghi `daily_plan_items`; `PlanItem.itemCount` = số câu ôn (phụ thuộc T010, T061, T062)
- [X] T064 [US3] Đổi `buildReviewSnapshot` trong `backend/src/domain/session-snapshot.ts` nhận danh sách cặp `{itemId, facet}` thay cho `itemIds` và chọn bài tập `active` khớp cả `item_id` lẫn `facet` (xoay vòng tất định theo ngày như R12); cặp không còn bài tập phù hợp bị bỏ qua; bài tập `matching` không gắn mục không vào ôn; cập nhật nơi gọi tạo phiên ôn trong `backend/src/services/lesson-session.ts` để đọc `review_facets` của mục kế hoạch (phụ thuộc T033, T062)
- [X] T065 [US3] Thêm `setItemMastered` trong `backend/src/services/path.ts` (404 khi chưa onboarding hoặc không có lịch ôn của chữ; 422 khi mục không phải `kind='kanji'`; idempotent) và route `PUT /path/items/{itemId}/master` trong `backend/src/api/path.ts` (phụ thuộc T061)
- [X] T066 [US3] Thêm `setItemMastered` vào `client/lib/data/learning_repository.dart`; hiển thị câu ôn Kanji với chữ dùng `NotoSansJP` và nút "Đánh dấu đã thành thạo"/"Bỏ đánh dấu" cho chữ Kanji trong `client/lib/presentation/review/review_view.dart` và trong mục "Chữ cần chú ý" của tóm tắt bài (`client/lib/presentation/lesson/lesson_screen.dart`); thêm khóa l10n vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb` (phụ thuộc T004, T065)

**Checkpoint**: Ôn Kanji theo cặp hoạt động độc lập trên dữ liệu từ US1

---

## Phase 6: US4 – Theo dõi tiến độ và điểm yếu về Kanji (Ưu tiên: P2)

**Mục tiêu**: `GET /progress` có khối `kanji`, `weakTopics[].skill`; tiến độ mục tiêu tính bài Kanji khi đã chọn Kanji; client hiển thị.

**Kiểm thử độc lập**: Hoàn thành bài và ôn Kanji với kết quả đã biết → số liệu khớp; ≥ 8 câu sai ở chủ đề "Thời gian" → chủ đề xuất hiện trong mảng yếu kèm nhãn Kanji; người không chọn Kanji có `kanji = null` (quickstart KJ3, KJ6).

### Kiểm thử US4

- [X] T067 [P] [US4] Viết kiểm thử đơn vị `backend/tests/unit/progress-kanji.test.ts` cho hàm phân bổ thời gian phiên ôn hỗn hợp theo tỷ lệ câu lượt chính Kanji / tổng câu lượt chính (0 câu → 0 phút, toàn Kanji → toàn bộ, hỗn hợp → tỷ lệ) trong `backend/src/engine/progress.ts`
- [X] T068 [P] [US4] Viết kiểm thử hợp đồng `backend/tests/contract/kanji-us4.test.ts`: `ProgressSummary.kanji` khớp schema (`charactersLearned`, `lessonsCompleted`, `minutes`, `reviewAccuracy` nullable 0–1), `weakTopics[].skill` có mặt; người không chọn Kanji và chưa có dữ liệu Kanji → `kanji = null`
- [X] T069 [P] [US4] Viết kiểm thử tích hợp `backend/tests/integration/kanji-progress.test.ts`: sau bài và ôn Kanji với kết quả đã biết → `charactersLearned` = số chữ có ≥ 1 dòng `review_schedules` **và** đơn vị chứa chữ `completed` với người học (kể cả chữ đã thành thạo hoặc đã ngừng; chữ trong bài dở dang KHÔNG tính), `lessonsCompleted` = số bài Kanji completed, `minutes` gồm phiên bài Kanji + phần phân bổ ước lượng của phiên ôn hỗn hợp (so với công thức phân bổ của T071, không so với đồng hồ thực – spec FR-017), `reviewAccuracy` gộp các khía cạnh; các trường tổng (`totalMinutes`, `lessonsCompleted`, `reviewAccuracy`, `currentStreakDays`) bao gồm Kanji; ≥ 8 câu sai, accuracy < 60% ở chủ đề `kanji-n5-time` → có trong `weakTopics` với `skill = kanji`; `goal.completionRatio` tính bài Kanji khi `kanji ∈ skills`, không đổi khi không chọn; bài Kanji bị ngừng rời khỏi tiến độ mục tiêu nhưng lịch sử vẫn tính thời gian/độ chính xác (FR-022)
- [X] T070 [P] [US4] Mở rộng widget test `client/test/progress_screen_test.dart`: khối Kanji hiển thị bốn số liệu khi `kanji` khác null, ẩn khi null; nhãn kỹ năng của mảng yếu; "Tiến độ" mở được ≤ 2 lần nhấp từ "Hôm nay" (SC-007)

### Triển khai US4

- [X] T071 [P] [US4] Thêm hàm thuần phân bổ thời gian phiên ôn hỗn hợp theo tỷ lệ câu Kanji vào `backend/src/engine/progress.ts` (research K8)
- [X] T072 [US4] Thêm truy vấn số liệu Kanji vào `backend/src/db/repositories/progress.ts` theo data-model §4.1: `charactersLearned` = `COUNT(DISTINCT rs.item_id)` từ `review_schedules rs JOIN content_items ci` với `ci.kind='kanji'`, nối `unit_progress` (`unit_id = ci.unit_id`, cùng `user_id`) với `status='completed'`; `lessonsCompleted` = `unit_progress.status='completed'` của đơn vị `kind='kanji'`; phút từ hợp khoảng `study_intervals` của phiên có `unit.kind='kanji'` + số câu lượt chính Kanji/tổng của từng phiên ôn; `reviewAccuracy` = đúng/tổng câu lượt chính `context='review'` mục `kind='kanji'` (null nếu chưa ôn); `skill` của chủ đề cho `weakTopics` (phụ thuộc T007)
- [X] T073 [US4] Cập nhật `backend/src/services/progress.ts`: dựng khối `kanji` (null khi `kanji ∉ skills` **và** chưa có dữ liệu học Kanji), `weakTopics[].skill`; xác nhận tiến độ mục tiêu (`rankForUser(..., includeMastered: true)`) lọc theo `skills` nên tự tính bài Kanji active (không đổi với người không chọn); tuần tự hóa trong `backend/src/api/progress.ts` (phụ thuộc T071, T072)
- [X] T074 [US4] Hiển thị khối Kanji (số chữ đã học, số bài Kanji, thời gian Kanji, độ chính xác ôn Kanji) và nhãn kỹ năng cho mảng yếu trong `client/lib/presentation/progress/progress_screen.dart` qua `client/lib/data/progress_repository.dart`; thêm khóa l10n vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb` (phụ thuộc T004)

**Checkpoint**: Tiến độ Kanji hiển thị và khớp dữ liệu đã ghi

---

## Phase 7: US5 – Quản trị viên quản lý nội dung Kanji (Ưu tiên: P3)

**Mục tiêu**: Admin tạo/sửa/kích hoạt/vô hiệu hóa bài Kanji bằng công cụ hiện có; kích hoạt bài thiếu thông tin bị 422 kèm danh sách lỗi; dữ liệu học không hỏng; mọi thao tác được ghi nhật ký.

**Kiểm thử độc lập**: Admin tạo bài Kanji 2 chữ thiếu chủ đề → kích hoạt bị 422 nêu "3–5 chữ" và "thiếu thẻ chủ đề"; sửa đủ → kích hoạt được, người học phù hợp thấy bài trong ≤ 5 phút; sửa chữ đang có lịch ôn và ngừng bài tập → lịch sử/lịch ôn nguyên vẹn; nhật ký có đủ thao tác (quickstart KJ9).

### Kiểm thử US5

- [X] T075 [P] [US5] Viết kiểm thử hợp đồng `backend/tests/contract/kanji-us5.test.ts`: `POST /admin/units`, `PUT /admin/units/{unitId}` nhận `kind=kanji`, `items[].topicId`, `items[].kanjiDetails`, `exercises[].facet`; `PUT /admin/units/{unitId}/status` (`active`) trả 422 `VALIDATION_FAILED` với `fields` theo đường dẫn như ví dụ contracts/api-changes.md §4.1 (gồm `goalTags` rỗng → lỗi `goalTags`); `GET /admin/units?kind=kanji`, `GET /admin/topics?skill=kanji` (6 chủ đề); `AdminPlacementQuestion.skill = kanji` → 422
- [X] T076 [P] [US5] Viết kiểm thử tích hợp `backend/tests/integration/kanji-admin.test.ts` (dùng `backend/tests/integration/admin-helpers.ts`): lưu nháp bài Kanji không bị chặn bởi quy tắc K10 — gồm nháp có chữ thiếu `topicId`/`kanjiDetails` (DB CHECK một chiều phải cho qua); kích hoạt bài 2 chữ, chữ thứ hai thiếu chủ đề → 422 liệt kê mọi lỗi (gồm `items` và `items[1].topicId`); kích hoạt bài chứa chữ đã có ở bài `active` khác → 422 `items[i].japanese` nêu bài đang chứa, còn sau khi bài kia bị vô hiệu hóa thì kích hoạt được; bài 5 phút có 11 bài tập → 422 `exercises` (với `REVIEW_SECONDS_PER_ITEM` mặc định 30; đổi cấu hình trong test thì ngưỡng đổi theo); kích hoạt bài Kanji có `goalTags` rỗng → 422 `goalTags`, còn bài từ vựng/ngữ pháp `goalTags` rỗng vẫn kích hoạt được; đổi `sequence` của hai bài Kanji (FR-020 "sắp xếp") → thứ tự trong `GET /admin/units?kind=kanji` đổi theo và `admin_action_logs` có `unit.update` cho thay đổi; chữ có ký tự thiếu glyph → 422; sửa đủ → kích hoạt thành công và người học N4 đã chọn Kanji thấy bài qua `POST /today/extra` sau khi bộ đệm làm mới (≤ 5 phút, SC-009); sửa nghĩa một chữ đang có lịch ôn và bỏ một bài tập khỏi payload → bài tập thành `inactive`, `review_schedules`/`study_records` nguyên vẹn, bài tập ngừng không vào phiên mới; `admin_action_logs` có `unit.create`, `unit.update`, `unit.status` với người thực hiện, thời gian và `diff` gồm `kanjiDetails`/`topicId`/`facet` (FR-023)
- [X] T077 [P] [US5] Mở rộng widget test `client/test/admin_unit_draft_test.dart` (gồm chọn thẻ mục tiêu bắt buộc với Kanji) và `client/test/admin_flow_test.dart`: chọn `kind = Kanji` hiện nhóm trường Kanji (âm On/Kun dạng danh sách, số nét, thành phần vi/en, chủ đề Kanji, từ ví dụ có `kanjiReading`), chọn `facet` cho bài tập gắn chữ; payload gửi đúng `AdminUnitWrite`; lỗi 422 hiển thị đúng trường theo đường dẫn

### Triển khai US5

- [X] T078 [US5] Cập nhật `backend/src/domain/admin-validation.ts`: `AdminUnitWrite.kind` nhận `kanji`; mục thêm `topicId` (uuid nullable, bắt buộc khi `kind=kanji` lúc kích hoạt, bỏ qua với kind khác), `kanjiDetails` (`onReadings: string[]`, `kunReadings: string[]`, `strokeCount` integer 1–30, `components` i18n nullable; NULL được chấp nhận ở bản nháp, bắt buộc đầy đủ khi kích hoạt `kind=kanji` — kiểm ở T025/T080; `reading` khi đó để null); ví dụ thêm `kanjiReading?`; bài tập thêm `facet` (enum `REVIEW_FACETS`, mặc định `item`); lưu nháp chỉ kiểm tra kiểu và KHÔNG yêu cầu `topicId`/`kanjiDetails` (phụ thuộc T009)
- [X] T079 [US5] Cập nhật `backend/src/db/repositories/units-admin.ts`: ghi/đọc `topic_id`, `kanji_details`, `examples[].kanjiReading`, `exercises.facet`; lọc `kind`; giữ cơ chế mục/bài tập vắng mặt → `inactive` (không xóa cứng) và `diff` nhật ký gồm các trường mới; thêm truy vấn `listActiveKanjiCharacters(excludeUnitId?)` trả map chữ → đơn vị `active` khác đang chứa (cho quy tắc "chữ duy nhất") (phụ thuộc T007, T078)
- [X] T080 [US5] Cập nhật `backend/src/services/content.ts`: kích hoạt đơn vị `kind='kanji'` chạy `content-validation.ts` (K10 + `goalTags` + phủ glyph + thời lượng + chữ duy nhất, truyền `existingKanjiChars` từ `listActiveKanjiCharacters` và `secondsPerExercise = config.REVIEW_SECONDS_PER_ITEM`) và trả 422 `VALIDATION_FAILED` với `fields` theo đường dẫn; làm mất hiệu lực bộ đệm danh mục như đơn vị khác; `listAdminTopics` lọc theo `skill` (phụ thuộc T025, T079)
- [X] T081 [US5] Thêm tham số lọc `kind` cho `GET /admin/units` và `skill` cho `GET /admin/topics` trong `backend/src/api/admin/units.ts` (phụ thuộc T080)
- [X] T082 [US5] Mở rộng mô hình nháp admin trong `client/lib/domain/admin_models.dart`, `client/lib/domain/admin_unit_draft.dart` và `client/lib/data/admin_repository.dart` cho `kind=kanji`, `topicId`, `kanjiDetails`, `kanjiReading`, `facet` (phụ thuộc T004)
- [X] T083 [US5] Thêm nhóm trường Kanji và chọn `facet` cho bài tập gắn chữ trong `client/lib/presentation/admin/admin_unit_editor_screen.dart`, `client/lib/presentation/admin/admin_unit_elements.dart`; lọc theo loại Kanji trong `client/lib/presentation/admin/admin_units_screen.dart`; thêm khóa l10n vào `client/lib/l10n/app_vi.arb`, `client/lib/l10n/app_en.arb` (phụ thuộc T082)

**Checkpoint**: Mọi câu chuyện US1–US5 hoạt động độc lập

---

## Phase 8: Hoàn thiện và việc xuyên suốt

**Mục đích**: Chỉ số sản phẩm, hồi quy phạm vi loại trừ, kiểm chứng đầu-cuối

- [X] T084 [P] Thêm truy vấn `kanji_first_plan_has_kanji_ratio` (SC-001: tỷ lệ người học đã chọn Kanji có kế hoạch đầu tiên sau `kanji_selected_at` chứa `new_unit` Kanji, trong số kế hoạch có phần bài mới) và `kanji_completed_within_3_days_ratio` (SC-008: trong số người học có `kanji_selected_at` ≥ 3 ngày trước thời điểm báo cáo, tỷ lệ có `unit_progress.status='completed'` cho đơn vị Kanji với `updated_at ≤ kanji_selected_at + 3 ngày`) vào `backend/src/reports/product-metrics.sql`, cập nhật `backend/src/reports/run.ts`, `backend/src/reports/README.md` và kiểm thử `backend/tests/integration/reports.test.ts` (research K15)
- [X] T085 [P] Viết kiểm thử hồi quy phạm vi loại trừ `backend/tests/integration/kanji-exclusions.test.ts`: `GET /trial/content` và `GET /placement/questions` không bao giờ chứa nội dung Kanji khi thư viện Kanji đã seed; placement của người học chọn Kanji vẫn 20 câu (research K12)
- [X] T086 [P] Bổ sung trường hợp Kanji vào `backend/tests/integration/concurrency.test.ts`: cùng tài khoản học bài Kanji ở hai phiên đồng thời → mỗi câu trả lời và khoảng thời gian chỉ ghi một lần, mỗi cặp (chữ, khía cạnh) cập nhật lịch tối đa một lần mỗi ngày địa phương
- [ ] T087 Chạy toàn bộ kiểm tra chất lượng: `cd backend && pnpm test && pnpm lint && pnpm typecheck && pnpm format:check`; `cd client && flutter test && flutter analyze && dart run tool/check_l10n.dart`; sửa mọi lỗi
- [ ] T088 Chạy thủ công các kịch bản KJ1–KJ10 trong `specs/003-kanji-lessons/quickstart.md` (gồm build `flutter build web --release --no-web-resources-cdn` và kiểm tra phông trên Chrome, Edge, Firefox, Safari – KJ10); đồng thời **bấm giờ làm hết từng bài Kanji seed** (ít nhất bài 5 phút của mỗi trình độ) và so với `est_minutes` / `REVIEW_SECONDS_PER_ITEM` (mặc định 30 giây/câu); nếu vượt, chỉnh cấu hình `REVIEW_SECONDS_PER_ITEM` hoặc hướng dẫn biên soạn (T030); ghi kết quả, thời lượng đo được và sai lệch (nếu có) vào cuối `specs/003-kanji-lessons/quickstart.md`
- [X] T089 [P] Cập nhật trạng thái `specs/003-kanji-lessons/spec.md` thành "Đã triển khai" và rà `CLAUDE.md`/README gốc nếu có mô tả lệnh hoặc phạm vi cần nhắc Kanji

---

## Phụ thuộc & Thứ tự thực hiện

### Phụ thuộc giữa các phase

- **Phase 1 (Thiết lập)**: T001 PHẢI chạy trên mã engine chưa sửa – làm trước mọi thay đổi trong `backend/src/engine/` (T002, T003 không đụng engine nên có thể song song với T001). T002 ∥ T003; T004 sau T003.
- **Phase 2 (Nền tảng)**: sau Phase 1; chặn mọi câu chuyện. Thứ tự: T005 → T006 → T007 → (T008, T014); T009 → (T010 → T011, T012, T013); T014 → T090; T013 + T014 → T015; T015 + T090 → T016. (T090 là số hiệu bổ sung sau phân tích, nằm trong Phase 2.)
- **Phase 3–7 (Câu chuyện)**: đều sau Phase 2.
- **Phase 8 (Hoàn thiện)**: sau các câu chuyện muốn phát hành.

### Phụ thuộc giữa các câu chuyện

- **US1 (P1)**: chỉ cần Phase 2. Cung cấp nội dung Kanji đã seed (T026–T031) mà mọi câu chuyện sau dùng làm dữ liệu kiểm thử.
- **US2 (P1)**: cần Phase 2; kiểm thử tích hợp T043 cần thư viện seed của US1 (T031). Logic engine (T049) độc lập với US1.
- **US3 (P2)**: cần dữ liệu học từ US1 (bài Kanji hoàn thành tạo lịch ôn) và T050 của US2 (truy vấn plans) cho T062.
- **US4 (P2)**: cần dữ liệu từ US1; số liệu ôn Kanji (`reviewAccuracy`, phút phiên ôn) đầy đủ khi có US3, nhưng kiểm thử được bằng dữ liệu chèn trực tiếp.
- **US5 (P3)**: cần T025 (quy tắc nội dung) của US1; độc lập với US2–US4.

### Trong mỗi câu chuyện

- Kiểm thử viết trước và PHẢI thất bại trước khi triển khai.
- Miền/engine → repository → service → API → client → l10n.
- File `client/lib/l10n/app_*.arb`, `backend/src/services/daily-plan.ts`, `backend/src/services/lesson-session.ts`, `backend/src/domain/session-snapshot.ts` được nhiều câu chuyện sửa → không chạy song song các task cùng file giữa các câu chuyện.

### Cơ hội song song

- Phase 1: T001 ∥ T002 ∥ T003 (T001 chỉ cần xong trước khi sửa engine).
- Phase 2: T009 ∥ T005–T007; T010, T011, T012, T013 sau T009.
- US1: kiểm thử T017–T023 song song; T024, T026–T030, T036 song song với nhau (biên soạn nội dung 3 trình độ chạy song song).
- US2: T039–T044 song song; client T053, T054, T055 song song.
- US3: T057–T060 song song.
- US4: T067–T070 song song; T071 song song với T072.
- US5: T075–T077 song song.
- Phase 8: T084, T085, T086, T089 song song.
- Sau Phase 2, US1 và logic engine của US2 (T039–T041, T049) có thể làm song song bởi hai người; US5 backend (T078–T081) có thể bắt đầu ngay khi T025 xong.

---

## Ví dụ song song: US1

```bash
# Viết mọi kiểm thử US1 cùng lúc:
Task: "T017 content-validation-kanji.test.ts"
Task: "T018 font-coverage.test.ts"
Task: "T019 content-files.test.ts (Kanji)"
Task: "T020 session-snapshot.test.ts (Kanji)"
Task: "T021 contract/kanji-us1.test.ts"
Task: "T022 integration/kanji-lesson.test.ts"
Task: "T023 client/test/kanji_card_test.dart"

# Biên soạn nội dung và widget song song:
Task: "T026 content/topics.json – 6 chủ đề Kanji"
Task: "T027 content/units/n5-kanji-*.json"
Task: "T028 content/units/n4-kanji-*.json"
Task: "T029 content/units/n3-kanji-*.json"
Task: "T030 content/README.md"
Task: "T036 client/lib/presentation/lesson/kanji/kanji_card.dart"
```

## Ví dụ song song: US2

```bash
Task: "T039 hồ sơ learner-profiles/kanji-*.json"
Task: "T040 kanji-regression-golden.test.ts"
Task: "T041 daily-plan-kanji.test.ts"
Task: "T042 contract/kanji-us2.test.ts"
Task: "T043 integration/kanji-plan.test.ts"
# Client sau T004:
Task: "T053 onboarding" ; Task: "T054 plan_adjust_screen" ; Task: "T055 today_screen"
```

---

## Chiến lược triển khai

### MVP trước (US1 + US2)

1. Phase 1: chụp golden (T001) **trước** khi động vào engine, nâng hợp đồng/schema.
2. Phase 2: migration, hằng miền, khóa ghép, ghi theo cặp, bộ lọc tạm gói ôn (T090) – chạy lại toàn bộ test 001 (T016).
3. Phase 3 (US1): bài Kanji học được qua "Học thêm". **Dừng và kiểm chứng** KJ1, KJ2, KJ10.
4. Phase 4 (US2): Kanji tự vào "Hôm nay". **Dừng và kiểm chứng** KJ3, KJ4, KJ8 + golden test xanh.
5. US1 + US2 là MVP có thể phát hành: người học chọn Kanji và học hằng ngày. Lịch ôn theo cặp đã được ghi từ Phase 2 nhưng bộ lọc tạm T090 giữ cặp Kanji ra khỏi gói ôn (tránh `review_item_ids` trùng/sai khía cạnh) cho tới khi US3 gỡ bộ lọc (T061); **hạn chế đã biết của bản MVP: chữ Kanji đã học chưa được ôn tự động** — nên phát hành US3 sớm sau MVP.

### Giao tăng dần

1. MVP (US1 + US2) → phát hành (client và backend cùng lúc – rủi ro `Skill=kanji` ở client cũ).
2. US3 (ôn theo cặp, gỡ bộ lọc tạm T090, đánh dấu thành thạo) → kiểm chứng KJ5, KJ7 → phát hành.
3. US4 (tiến độ Kanji) → kiểm chứng KJ6 → phát hành.
4. US5 (admin Kanji) → kiểm chứng KJ9 → phát hành.
5. Phase 8: chỉ số SC-001/SC-008, hồi quy loại trừ, kiểm chứng toàn bộ.

### Chiến lược nhiều lập trình viên

Sau Phase 2: người A làm US1 (nội dung + hiển thị); người B làm engine/kế hoạch US2 (T039–T052); người C biên soạn nội dung Kanji (T026–T030) rồi chuyển sang US5 backend khi T025 xong. US3/US4 bắt đầu khi US1 có dữ liệu seed.

---

## Ghi chú

- [P] = khác file, không phụ thuộc task chưa xong.
- Nhãn [USx] ánh xạ task về câu chuyện để truy vết.
- Commit sau mỗi task hoặc nhóm task logic; dừng ở mỗi checkpoint để kiểm chứng câu chuyện độc lập.
- Kiểm thử hợp đồng tách theo câu chuyện (`backend/tests/contract/kanji-us1.test.ts` … `kanji-us5.test.ts`) thay cho một file `kanji.test.ts` trong plan để các câu chuyện không sửa chung một file.
- Ngoài phạm vi (KHÔNG tạo task): luyện viết tay/thứ tự nét, từ điển Kanji, Kanji trong placement/dùng thử, nội dung N2/N1, furigana trong bài từ vựng/ngữ pháp.
