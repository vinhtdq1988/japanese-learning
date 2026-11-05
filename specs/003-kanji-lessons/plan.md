# Kế hoạch triển khai: Bài học Kanji

**Nhánh**: `003-kanji-lessons` | **Ngày**: 2026-11-05 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/003-kanji-lessons/spec.md`

## Tóm tắt

Bổ sung bài học Kanji (3–5 chữ mới mỗi bài, 5–15 phút) vào hệ thống MVP đã hoàn tất: người học chọn Kanji khi onboarding hoặc điều chỉnh kế hoạch; kế hoạch hằng ngày tự chen bài Kanji trong đúng quỹ thời gian; mỗi cặp (chữ, khía cạnh nghĩa/cách đọc/từ chứa chữ) có lịch ôn lặp lại ngắt quãng riêng; tiến độ và mảng yếu Kanji (theo thẻ chủ đề của chữ) hiển thị riêng; quản trị viên soạn và kích hoạt bài Kanji bằng công cụ hiện có. Người học không chọn Kanji không bị thay đổi gì.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Tái sử dụng mô hình nội dung**: bài Kanji = `learning_units(kind='kanji')`, chữ = `content_items(kind='kanji')` + JSONB `kanji_details` + `topic_id`, từ ví dụ nằm trong `examples` của chữ (K1, K4). Thêm `kanji` vào enum `skill` (K2).
- **Lịch ôn theo cặp**: enum `review_facet`, cột `facet` ở `exercises`/`study_records`/`review_schedules` (vào khóa chính), `daily_plan_items.review_facets`; engine SRS và chia gói ôn không đổi chữ ký, dịch vụ dùng khóa ghép `itemId:facet` (K3, K6).
- **Kế hoạch ngày**: hàm thuần mới `applyKanjiSlot` trong engine bảo đảm bài Kanji xuất hiện từ ngày đầu và không bị bỏ đói/chiếm hết; no-op khi không chọn Kanji nên kế hoạch cũ giống hệt (K5).
- **Hợp đồng**: OpenAPI 1.10.0 → 1.11.0 (bổ sung), JSON Schema nội dung `unit` 1.1.0 (K13, [contracts/](contracts/)).
- **Hiển thị**: phông Noto Sans JP đã đóng gói + kiểm tra phủ glyph tự động ở seed/kích hoạt (K9).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend TypeScript 5.x trên Node.js 22 LTS; client Dart 3.x / Flutter stable (web) – không đổi so với 001.

**Phụ thuộc chính**: Không thêm phụ thuộc. Backend: Fastify, Zod, Drizzle ORM, ajv (JSON Schema nội dung), pg-boss. Client: Riverpod, go_router, dio, API client sinh bằng openapi-generator `dart-dio`.

**Lưu trữ**: PostgreSQL 16; migration mới `0002_kanji_skill.sql` (thêm giá trị enum, file riêng vì giá trị enum chỉ dùng được sau commit) và `0003_kanji.sql` (cột, CHECK, đổi PK `review_schedules`) – [data-model.md §5](data-model.md#5-migration).

**Kiểm thử**: Vitest (đơn vị engine với hồ sơ đại diện mới cho Kanji + kiểm thử golden hồi quy hồ sơ cũ, hợp đồng OpenAPI 1.11.0, tích hợp PostgreSQL qua Testcontainers); `flutter test` (widget bài Kanji, màn hình điều chỉnh kế hoạch, tiến độ, soạn bài admin).

**Nền tảng đích**: Trình duyệt desktop (Chrome, Edge, Firefox, Safari); server Linux (Docker) – không đổi.

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST) với thư mục nội dung `content/` – mở rộng dự án hiện có.

**Mục tiêu hiệu năng**: Không thêm mục tiêu mới; giữ biện pháp của 001 (bộ đệm danh mục nội dung, chỉ mục). Thêm chỉ mục `study_records(user_id, item_id, facet, occurred_at DESC)` cho độ chính xác gần đây theo cặp. Số dòng `review_schedules` của người học Kanji tăng ×3 mỗi chữ (≤ 28 chữ × 3 cặp ở thư viện đầu) – không đáng kể.

**Ràng buộc**: Kế hoạch ngày không vượt quỹ, mỗi mục ≤ 15 phút (FR-008); kế hoạch của người không chọn Kanji không đổi (FR-009, SC-006); nội dung là dữ liệu, kích hoạt ≤ 5 phút không phát hành client (SC-009); không làm hỏng dữ liệu học đã lưu khi migration hoặc khi sửa nội dung (FR-022, Hiến pháp).

**Quy mô/Phạm vi**: Thư viện ban đầu 7 bài / 28 chữ N5–N3 (research K14); ~4 màn hình client thay đổi (onboarding, điều chỉnh kế hoạch, bài học, tiến độ) + 1 màn hình admin; 2 ngôn ngữ giao diện.

Không còn mục NEEDS CLARIFICATION (đã giải quyết trong [research.md](research.md)).

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.1.0 (sửa đổi 2026-11-05: Giai đoạn 1 bao gồm Kanji N5–N3, nhận diện nghĩa/cách đọc, không luyện viết; lặp lại ngắt quãng áp dụng cho cả Kanji):

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – FR-001 (3–5 chữ, 5–15 phút), FR-008 | ĐẠT – `est_minutes ∈ {5,10,15}` (CHECK DB sẵn có) áp cho bài Kanji; `applyKanjiSlot` chỉ đổi thứ tự ứng viên, không đổi quỹ/giới hạn 60% ôn/luân phiên của `planDailyPlan`; ôn Kanji dùng chung gói ≤ 15 phút; hướng dẫn biên soạn 5 phút = 3 chữ × 3 câu (K5, K10) |
| II. Personalized Learning Engine | ĐẠT – FR-008, FR-011 | ĐẠT – bài Kanji là đơn vị rời rạc có trình độ, thẻ mục tiêu, độ khó; `rankUnits` phân bổ động; chủ đề yếu Kanji vào `topic_stats` để điều chỉnh độ khó (K4, K5) |
| III. Learner Control | ĐẠT – FR-007, FR-010 | ĐẠT – `PATCH /me.skills`, `prioritizedSkill=kanji`, `PUT /path/units/{id}/master`, mới `PUT /path/items/{id}/master`, xây dựng lại lộ trình sẵn có (contracts/api-changes.md §3) |
| IV. Evidence-Based Learning Methods | ĐẠT – FR-014 → FR-019; hiến pháp v1.1.0 nêu rõ lặp lại ngắt quãng cho Kanji | ĐẠT – SM-2 biến thể theo cặp (chữ, khía cạnh) điều khiển bởi kết quả đã ghi; học bằng làm (bài tập tự chấm mọi khía cạnh); tiến độ/mảng yếu Kanji hiển thị (K3, K6, K8) |
| V. Cross-Platform, Web-First | ĐẠT – Flutter web | ĐẠT – không thêm mã đặc thù nền tảng; phông đóng gói dùng được cho Android/iOS; API bearer-token không đổi (K9) |
| VI. Separated Architecture | ĐẠT – FR-020 | ĐẠT – nội dung Kanji là dữ liệu trong `content/` + CSDL, quản lý qua Admin API; hợp đồng OpenAPI 1.11.0 và JSON Schema 1.1.0 tường minh |
| Phạm vi theo giai đoạn | ĐẠT – Giai đoạn 1 (v1.1.0) liệt kê "Kanji (N5–N3, nhận diện nghĩa/cách đọc, không luyện viết)" | ĐẠT – thiết kế chỉ gồm nhận diện nghĩa/cách đọc/từ chứa chữ cho N5–N3; không luyện viết tay, không nghe/đọc, không AI, không mobile (xem "Giới hạn phạm vi" bên dưới) |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết (FR-024) | ĐẠT – 7 hồ sơ Kanji mới + kiểm thử golden mọi hồ sơ cũ (K16) |
| Thay đổi hợp đồng/schema được ghi nhận, không phá dữ liệu | Cam kết | ĐẠT – nhật ký OpenAPI 1.11.0, `content/schema/CHANGELOG.md`; migration chỉ thêm cột DEFAULT/NULL, đổi PK giữ dữ liệu (`facet='item'`); snapshot phiên cũ vẫn đọc được (K13) |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – không thêm dịch vụ/phụ thuộc; tái dùng bảng thay vì bảng Kanji riêng; các quyết định có chi phí ghi ở dưới |

### Giới hạn phạm vi Kanji (theo Giai đoạn 1 của hiến pháp v1.1.0)

- **Trạng thái sửa đổi hiến pháp**: đề xuất trong bản kế hoạch trước (bổ sung Kanji vào Giai đoạn 1) **đã được áp dụng** ở hiến pháp v1.1.0 (MINOR, 2026-11-05). Sai lệch "Phạm vi theo giai đoạn" không còn tồn tại nên không cần biện minh; spec `001-phase1-mvp` giữ nguyên (đã hoãn Kanji và giao cho spec này).
- **Trong phạm vi**: chỉ mở rộng các mô-đun Giai đoạn 1 đã có (bài học ngắn, lộ trình, ôn tập, tiến độ, quản trị) cho loại nội dung Kanji N5–N3 với ba khía cạnh nhận diện: nghĩa, cách đọc, từ chứa chữ.
- **Ngoài phạm vi** (KHÔNG ĐƯỢC đưa vào khi triển khai): luyện viết tay Kanji (thứ tự nét, nhận dạng chữ viết) – hiến pháp ghi rõ ngoài Giai đoạn 1; mọi tính năng Giai đoạn 2–4 (luyện nghe/đọc, AI, mobile, thông báo). Số nét trong `kanji_details` chỉ là thông tin hiển thị, không phải bài luyện viết.

**Kết luận**: Cổng ĐẠT trước Phase 0 và sau thiết kế Phase 1. Không có sai lệch hay vi phạm nào cần biện minh; các quyết định có chi phí được ghi ở mục Theo dõi độ phức tạp.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/003-kanji-lessons/
├── plan.md                  # Tệp này (/speckit-plan)
├── research.md              # Phase 0 – quyết định K1…K16
├── data-model.md            # Phase 1 – thay đổi schema so với 001
├── quickstart.md            # Phase 1 – kịch bản kiểm chứng KJ1…KJ10
├── contracts/
│   ├── api-changes.md       # Phase 1 – thay đổi OpenAPI 1.10.0 → 1.11.0 (áp vào specs/001-phase1-mvp/contracts/openapi.yaml)
│   └── content-schema.md    # Phase 1 – JSON Schema nội dung unit 1.1.0, topics 1.1.0
├── checklists/
│   └── requirements.md
└── tasks.md                 # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã) – các vị trí thay đổi

```text
backend/
├── src/
│   ├── api/
│   │   ├── account.ts            # PATCH /me nhận skills
│   │   ├── path.ts               # + PUT /path/items/{itemId}/master
│   │   └── admin/units.ts        # lọc ?kind=, kind=kanji
│   ├── engine/
│   │   ├── daily-plan.ts         # + applyKanjiSlot (thuần hàm)
│   │   └── srs.ts                # không đổi (áp theo cặp)
│   ├── domain/
│   │   ├── types.ts              # SKILLS + kanji, PLACEMENT_SKILLS, TRIAL_SKILLS, REVIEW_FACETS, KANJI_FACETS
│   │   ├── content-validation.ts # quy tắc Kanji (K10), validateCatalog cho Kanji
│   │   ├── font-coverage.ts      # mới: đọc cmap Noto Sans JP, kiểm tra phủ glyph (K9)
│   │   ├── review-key.ts         # mới: mã hóa/giải mã khóa ghép itemId[:facet] (K3)
│   │   ├── session-snapshot.ts   # kanji/topicId/facet; buildReviewSnapshot theo cặp
│   │   ├── profile-validation.ts # skillsSchema nhận kanji; skills trong profileUpdateSchema
│   │   └── admin-validation.ts   # kanjiDetails, topicId, facet trong AdminUnitWrite
│   ├── db/
│   │   ├── migrations/0002_kanji_skill.sql, 0003_kanji.sql
│   │   ├── schema.ts
│   │   └── repositories/         # review.ts (facet, mastered_at), progress.ts (số liệu Kanji),
│   │                             #   plans.ts (review_facets), units-admin.ts, profiles.ts
│   ├── services/
│   │   ├── daily-plan.ts         # khóa ghép, applyKanjiSlot, kanjiNotice, PlanItem.kind
│   │   ├── lesson-session.ts     # facet khi ghi/ôn, topic theo mục, attentionItems
│   │   ├── progress.ts           # khối kanji, weakTopics.skill
│   │   ├── profile.ts            # đổi skills, kanji_selected_at, xóa prioritizedSkill
│   │   ├── path.ts               # setItemMastered
│   │   ├── trial.ts, placement.ts, admin-placement.ts  # chặn kanji (TRIAL_SKILLS/PLACEMENT_SKILLS)
│   │   └── content.ts            # ghi đơn vị Kanji (admin)
│   ├── seed/content.ts           # ánh xạ topic/kanjiDetails/facet; kiểm tra phủ glyph
│   └── reports/product-metrics.sql  # SC-001, SC-008
└── tests/
    ├── unit/                     # daily-plan-kanji, srs-kanji-facets, content-validation-kanji,
    │                             #   kanji-regression-golden, font-coverage, review-key
    ├── contract/kanji.test.ts
    ├── integration/kanji-*.test.ts, migration.test.ts (0002/0003 trên dữ liệu 001)
    └── fixtures/
        ├── learner-profiles/kanji-*.json
        └── golden/plans-pre-kanji.json   # ảnh chụp kế hoạch hồ sơ cũ, sinh TRƯỚC khi đổi engine

client/
├── lib/
│   ├── data/api/generated/       # sinh lại từ OpenAPI 1.11.0
│   ├── domain/onboarding_form.dart          # kanji không còn bị khóa
│   ├── presentation/
│   │   ├── onboarding/           # kỹ năng Kanji chọn được
│   │   ├── path/plan_adjust_screen.dart     # bật/tắt Kanji, ưu tiên Kanji (bỏ 'kanji' khỏi _lockedSkills)
│   │   ├── lesson/kanji/         # mới: thẻ chữ Kanji (chữ lớn, On/Kun, số nét, từ ví dụ)
│   │   ├── today/                # nhãn Kanji cho PlanItem.kind, kanjiNotice
│   │   ├── progress/             # khối Kanji, nhãn kỹ năng của mảng yếu, đánh dấu chữ thành thạo
│   │   └── admin/admin_unit_editor_screen.dart, admin_unit_elements.dart  # trường Kanji, facet
│   └── l10n/app_vi.arb, app_en.arb
└── test/

content/
├── schema/unit.schema.json (1.1.0), topics.schema.json (1.1.0), CHANGELOG.md
├── topics.json               # + 6 chủ đề kanji-*
└── units/n5-kanji-*.json, n4-kanji-*.json, n3-kanji-*.json   # 7 bài (K14)
```

**Quyết định cấu trúc**: Giữ nguyên cấu trúc ba phần `backend/`, `client/`, `content/` của 001 (Nguyên tắc VI); không thêm dự án hay mô-đun mới. Logic quyết định (suất Kanji, SRS theo cặp) nằm trong `engine/` thuần hàm để kiểm thử bằng hồ sơ đại diện; phần đặc thù Kanji ở `domain/` (quy tắc nội dung, khóa ghép, phủ glyph) và `presentation/lesson/kanji/`.

## Thứ tự triển khai đề xuất

1. **Ảnh chụp golden trước khi sửa engine**: sinh `tests/fixtures/golden/plans-pre-kanji.json` từ mã hiện tại (bảo đảm SC-006 có chuẩn so sánh thật).
2. Migration + schema Drizzle + hằng `types.ts` + khóa ghép (nền tảng, chặn mọi câu chuyện).
3. US1 (P1): quy tắc nội dung, seed + thư viện ban đầu, snapshot/hiển thị bài Kanji, tóm tắt phiên.
4. US2 (P1): `skills` trong `PATCH /me`, onboarding/điều chỉnh kế hoạch, `applyKanjiSlot`, `kanjiNotice`.
5. US3 (P2): ôn theo cặp, `review_facets`, đánh dấu chữ thành thạo.
6. US4 (P2): tiến độ Kanji, mảng yếu theo chủ đề chữ, tiến độ mục tiêu.
7. US5 (P3): admin soạn bài Kanji.
8. Báo cáo chỉ số (SC-001, SC-008).

## Theo dõi độ phức tạp

| Sai lệch / quyết định có chi phí | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| `review_facet` + đổi PK `review_schedules` | Làm rõ: mỗi cặp (chữ, khía cạnh) có lịch riêng; sai một khía cạnh không đổi khía cạnh khác | Một lịch/chữ xoay vòng khía cạnh trái với Làm rõ; nhân bản chữ thành 3 mục làm méo nội dung |
| Mảng song song `daily_plan_items.review_facets` | Gói ôn cần biết khía cạnh của từng câu | Đổi `review_item_ids` sang JSONB phá kiểu cột đang dùng và dữ liệu kế hoạch cũ |
| Hàm `applyKanjiSlot` | Bài Kanji không có tầng nền tảng nên bị đơn vị nền tảng (trọng số 1000) đẩy xuống, có thể vắng nhiều ngày (trái SC-001) | Gắn Kanji `foundation` biến Kanji thành bắt buộc chiếm các ngày đầu; quota phút theo kỹ năng phá quy tắc first-fit đã kiểm thử |
| Bộ đọc `cmap` tự viết (`font-coverage.ts`) | FR-006: chặn tự động chữ thiếu glyph (ô vuông) trước khi tới người học | Thêm thư viện phông (fontkit/opentype.js) là phụ thuộc mới cho một kiểm tra nhỏ; kiểm tay không bảo đảm SC-003 |
| Phân bổ thời gian phiên ôn hỗn hợp theo tỷ lệ câu Kanji | Hiển thị thời gian học Kanji riêng (FR-017) | Tách gói ôn Kanji riêng làm thay đổi cách chia gói/làm tròn đã kiểm thử và có thể vượt quỹ |

## Rủi ro và điểm cần theo dõi

- **Biên soạn nội dung Kanji song ngữ** (28 chữ, mỗi chữ ≥ 3 bài tập + từ ví dụ) nằm trên đường găng của SC-003/SC-004; ưu tiên ba bài 5 phút (mỗi trình độ một bài) trước.
- **Mật độ bài tập**: quy tắc "mỗi chữ đủ ba khía cạnh" làm bài 5 phút có ≈ 9 câu; cần đo thời lượng thực tế với người dùng và chỉnh hướng dẫn (3 chữ/bài 5 phút) nếu vượt.
- **Client sinh mã cũ** không giải mã `Skill=kanji` → client và backend phát hành cùng lúc; trình duyệt giữ bản client cũ trong bộ đệm có thể lỗi ở tài khoản đã chọn Kanji từ bản mới (giảm thiểu bằng cache-busting của Flutter build).
- **Câu đọc mơ hồ** (chữ nhiều cách đọc) không kiểm được hoàn toàn tự động; dựa vào hướng dẫn biên soạn + checklist duyệt nội dung.
- **Trọng số `applyKanjiSlot`** (cách một ngày) là quy tắc khởi đầu; theo dõi chỉ số SC-001/SC-008 để hiệu chỉnh.
- **Lấn phạm vi sang luyện viết**: yêu cầu kiểu "luyện thứ tự nét" dễ phát sinh khi hiển thị số nét; hiến pháp v1.1.0 đặt luyện viết tay ngoài Giai đoạn 1, nên mọi đề xuất như vậy PHẢI tách thành spec của giai đoạn sau hoặc qua sửa đổi hiến pháp.
