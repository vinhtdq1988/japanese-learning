# Kế hoạch triển khai: Bổ sung nội dung học N4 → N3 đầy đủ để thi JLPT

**Nhánh**: `008-n4-n3-jlpt-content` (tên thư mục tính năng; nhánh git hiện tại là `master`) | **Ngày**: 2026-11-14 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/008-n4-n3-jlpt-content/spec.md` (Giai đoạn 1 – MVP, mô-đun Learning Content theo hiến pháp v1.2.0; chỉ mở rộng nội dung trên các loại bài học đã có, không thêm loại bài của giai đoạn sau)

## Tóm tắt

Nâng thư viện từ **33 đơn vị** (mỗi loại N4/N3 chỉ 2 đơn vị) lên khoảng **580 đơn vị** phủ phạm vi thi JLPT N4 và N3 về **chữ – từ vựng, ngữ pháp, đọc hiểu** (cộng luyện viết), đủ để học viên N4 mục tiêu N3 học liên tục ≥ 180 ngày không hết nội dung. Công việc chia thành **hạ tầng nội dung nhỏ + biên soạn lớn theo đợt**:

1. **Danh mục phạm vi và độ phủ (FR-001…003)** – dữ liệu `content/scope/*.json` có nguồn tham khảo; trạng thái phủ **suy ra** từ đơn vị (không lưu tay); `pnpm content:coverage` báo mức phủ và là cổng nghiệm thu (SC-001/002).
2. **Đợt phát hành + hồ sơ duyệt (FR-017/018, SC-004)** – `content/releases/NNN-*.json` ghi nguồn, người duyệt, ngày duyệt; `content/units/` chỉ chứa đơn vị đã duyệt, bản nháp ở `content/drafts/` không bao giờ được nạp; seed **đóng kín** nên đơn vị chưa duyệt không thể tới người học; bổ sung cách đọc cho chữ Hán hiện có bằng `amendments` chỉ-thêm, giữ nguyên id/tiến độ/lịch ôn.
3. **Quy tắc nội dung mới (FR-004…008, FR-011…015)** – mục chính duy nhất cho mọi loại (không chỉ Kanji), ví dụ có kana, mỗi mục có bài tập để vào lịch ôn, phủ dạng câu hỏi thi qua siêu dữ liệu `format`, chủ đề mịn đủ ≥ 20 bài tập; **không thêm loại bài tập mới** (dạng sắp xếp ★ biểu diễn bằng trắc nghiệm).
4. **Learning Engine ở quy mô lớn – hai thay đổi nhỏ** (FR-011, FR-020; Câu chuyện 4): **biên giới thứ tự học** (mỗi loại luôn đi đúng `(trình độ, sequence)`, thích ứng chỉ hoán đổi trong 3 bài tiếp theo) và **ôn lùi có chặn** (người xếp N3 có ≤ 3 đơn vị N4 ở mảng yếu). Cả hai là hàm thuần; thư viện hiện có cho kế hoạch và thứ tự lộ trình **giống hệt** (golden kế hoạch/thứ tự không đổi). Biên giới còn có phần mở rộng theo mục tiêu `work`/`daily_conversation` (tối đa 3 đơn vị trong 12 đơn vị đầu) để Câu chuyện 2 kịch bản 4 còn tác dụng khi thư viện lớn.
5. **Tiến độ và thông báo (FR-022)** – `completionRatio` tính theo tổng phút (phần tiến độ của golden baseline đổi có chủ đích vì baseline có cả đơn vị 5 và 10 phút); thông báo "chưa có phần nghe hiểu" (`notices`) tính lúc đọc cho mọi học viên JLPT, kể cả lộ trình đã lưu.
6. **Hiệu năng và khả năng kiểm thử (SC-007)** – seed theo lô, `GET /path` có lọc/phân trang tùy chọn, kiểm thử vitest dùng `CONTENT_RELEASES=000-baseline` nên 71 điểm `seedContent` và các golden hiện có giữ nguyên, trong khi kiểm thử nội dung thật chạy riêng.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Không migration, không bảng/cột/dịch vụ/phụ thuộc mới**: đơn vị, mục, bài tập, chủ đề dùng nguyên các bảng hiện có; `status` (`draft/active/inactive`) và khóa tự nhiên `(kind, level, title.en)` của seed được tận dụng (D1, D5).
- **Nội dung là dữ liệu có schema** (`unit` 1.3.0 chỉ thêm tùy chọn; `scope` 1.0.0 và `release` 1.0.0 mới), kiểm bằng Ajv + quy tắc nghiệp vụ như các spec trước; siêu dữ liệu biên soạn (`scopeRef`, `format`, `requires`) chỉ nằm trong file (D8).
- **Hợp đồng**: OpenAPI 1.14.0 → 1.15.0, chỉ bổ sung – [contracts/api-changes.md](contracts/api-changes.md); hợp đồng nội dung: [contracts/content-authoring.md](contracts/content-authoring.md) (nới giới hạn đoạn đọc N3 lên 700 ký tự, FR-019).
- **Rủi ro lớn nhất là biên soạn và duyệt ≈ 545 đơn vị**, không phải mã: người duyệt có chuyên môn tiếng Nhật là điều kiện cứng (C1), danh mục phạm vi phải được duyệt trước khi biên soạn hàng loạt (C2).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend TypeScript 5.x trên Node.js 22 LTS; client Dart 3.x / Flutter stable (web) – không đổi so với 001–007.

**Phụ thuộc chính**: **Không thêm phụ thuộc chạy** ở backend lẫn client. Backend: Fastify, Zod, Drizzle ORM, Ajv (đã có). Công cụ nội dung (`content:coverage`, `content:lint`, `content:stats`) là script `tsx` dùng lại loader/validator hiện có. Không thêm bộ phân tích hình thái tiếng Nhật (quyết định D14: kiểm phạm vi từ vựng/ngữ pháp trong đoạn đọc do người duyệt, máy chỉ kiểm chữ Hán).

**Lưu trữ**: PostgreSQL 16; **không migration**. Dữ liệu mới nằm ở tệp: `content/scope/` (8 file + 1 tham chiếu), `content/releases/` (1 baseline + ≈ 14 đợt), `content/units/` (+≈ 545 file), `content/topics.json` (+≈ 150–180 chủ đề), `content/schema/` (`unit` 1.3.0, `scope` 1.0.0, `release` 1.0.0).

**Kiểm thử**: Vitest – đơn vị thuần hàm (`content-scope`, `content-coverage`, `content-releases`, `content-lint-authoring`, `path-frontier`, `path-remedial`, `goal-ratio`, `runway`, `perf-large-catalog`, `content-files` mở rộng), tích hợp PostgreSQL (`seed-release-idempotent`, `seed-amendments`, `admin-activation-duplicate`), hợp đồng (`path-filter`, `scope-notices`, `goal-ratio-minutes`, OpenAPI 1.15.0), golden hồi quy (kế hoạch/lộ trình/tiến độ của thư viện baseline). `flutter test` – widget/đơn vị (banner nghe hiểu, màn Lộ trình lọc/dựng lười, `PassagePanel` xuống dòng, l10n).

**Nền tảng đích**: Trình duyệt desktop (Chrome, Edge, Firefox, Safari); server Linux (Docker) – không đổi.

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST) với thư mục nội dung `content/` – mở rộng dự án hiện có.

**Mục tiêu hiệu năng**: `GET /today` p95 chậm hơn **≤ 10%** so với thư viện baseline (SC-007); `rankUnits` + biên giới trên 700 đơn vị trung vị < 5 ms; seed đầy đủ ≤ 120 giây, chạy lại không đổi gì ≤ 15 giây; `GET /path` không lọc ≤ 300 ms ở thư viện đầy đủ. Phiên học mọi đơn vị mới 5–15 phút (FR-012).

**Ràng buộc**: kế hoạch hằng ngày ≤ quỹ khai báo (Nguyên tắc I, I1); đơn vị chưa duyệt KHÔNG hiển thị (I4, SC-004); KHÔNG đổi khóa/danh tính nội dung và tiến độ người học (I2, FR-018); mục chính duy nhất mọi loại (I5, FR-007); không chép nguyên văn nguồn có bản quyền (FR-016); song ngữ vi/en; không luyện viết tay/thứ tự nét; luyện đọc/viết chỉ từ 30 phút/ngày và trần N3 giữ nguyên (FR-023); **không xây luyện nghe** (Giai đoạn 2).

**Quy mô/Phạm vi**: ≈ 548 đơn vị mới (≈ 56 ngữ pháp, ≈ 266 từ vựng, ≈ 126 Kanji, ≥ 60 luyện đọc, ≥ 40 luyện viết; [research.md D17](research.md)); ≈ 150–180 chủ đề mới; 9 file danh mục; ≈ 14 đợt; 2 hàm engine thuần được chỉnh (`rankUnits`, `goalRatio`) + 1 module thuần mới (`content-scope`); 3 script CLI; 0 bảng, 0 dịch vụ nền; ≈ 4 màn client được chạm (Lộ trình, Tiến độ, onboarding/Hồ sơ banner, `PassagePanel`).

Không còn mục NEEDS CLARIFICATION (đã giải quyết trong [research.md](research.md)); tám điểm cần chủ dự án biết nằm ở "Điểm cần chủ dự án xác nhận" (C1…C8) – đáng chú ý **C1 (người biên soạn/duyệt – điều kiện cứng)** và **C2 (duyệt danh mục + giấy phép nguồn – cổng G0)**.

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.2.0:

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – spec đặt mọi đơn vị 5/10/15 phút và quỹ thời lượng (FR-012) | ĐẠT – kích thước đơn vị theo quỹ 30 giây/câu ([content-authoring.md §1](contracts/content-authoring.md)); ≥ 30% đơn vị 5 phút mỗi (loại × trình độ) để người ít thời gian có bài; `planDailyPlan` **không đổi** nên bất biến quỹ thời gian/60% ôn tập (I1) giữ nguyên; mô phỏng 5/10/15/30 phút kiểm 100% ≤ quỹ |
| II. Personalized Learning Engine | CẢNH BÁO nhẹ – thư viện lớn làm thứ tự giáo trình/tiên quyết phụ thuộc thích ứng quá mức | ĐẠT – Learning Engine vẫn quyết định học gì/ôn gì/bao lâu; hai thay đổi (biên giới D10, ôn lùi D11) là **hàm thuần có hồ sơ đại diện** (hiến pháp) và **không đổi kết quả với thư viện baseline**; tiến độ mục tiêu tính trên toàn phạm vi (D12); mảng yếu mịn hơn nhờ chủ đề D9 |
| III. Learner Control | ĐẠT – spec giữ đánh dấu thành thạo, trần N3, lớp học | ĐẠT – không bỏ lựa chọn nào; người học vẫn đánh dấu thành thạo, đổi mục tiêu/trình độ, dựng lại lộ trình; ôn lùi bị chặn ≤ 3 đơn vị và ghi đè được; ghi rủi ro đánh dấu thành thạo từng đơn vị mất công khi thư viện lớn (spec riêng cho đánh dấu hàng loạt) |
| IV. Evidence-Based Learning Methods | ĐẠT – từ vựng/Kanji vào ôn tập, tiến độ theo dõi được | ĐẠT – quy tắc AU4 (mỗi mục có bài tập gắn mục) bảo đảm **mọi** từ/mẫu mới vào lịch ôn; chủ đề ≥ 20 bài tập khớp cửa sổ thống kê hiện có nên mảng yếu/năng lực có nghĩa; không đổi SRS |
| V. Cross-Platform, Web-First | ĐẠT – không có hành vi riêng nền tảng mới | ĐẠT – client chỉ thêm banner, lọc danh sách, xuống dòng trong đoạn đọc (widget Flutter thuần); mọi quy tắc (biên giới, tiến độ, thông báo) ở backend nên mobile dùng lại |
| VI. Kiến trúc tách biệt | ĐẠT – nội dung là dữ liệu; hợp đồng ghi tài liệu (FR-019) | ĐẠT – nội dung phát hành **không cần phát hành client** (`ContentCache` TTL 60 giây); danh mục/đợt là dữ liệu có schema; OpenAPI 1.15.0 chỉ bổ sung, nhật ký trong `info.description`; nới giới hạn đoạn đọc ghi ở `CHANGELOG` và `content/README.md`, không làm hỏng nội dung đã lưu |
| Phạm vi theo giai đoạn | CẦN BIỆN MINH – spec khẳng định Giai đoạn 1 và loại trừ luyện nghe, nhưng "luyện nghe và đọc" xếp ở Giai đoạn 2 nên việc mở rộng luyện đọc cần biện minh riêng | ĐẠT CÓ BIỆN MINH – Learning Content (từ vựng, ngữ pháp, Kanji N5–N3) thuộc Giai đoạn 1; luyện đọc chạm Giai đoạn 2: spec 007 đã biện minh cho ~12 bài, spec này nâng lên ≥ 60 đơn vị nên có dòng biện minh riêng ở đầu bảng "Theo dõi độ phức tạp" và điểm C8 chờ chủ dự án xác nhận; luyện viết là gõ bàn phím (không phải viết tay); **không** xây luyện nghe/thi thử; có thông báo cho người học (D12). Chưa cần sửa hiến pháp; chủ dự án có thể chọn sửa 1.3.0 thay vì biện minh (C8) |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết | ĐẠT – `rankUnits` (biên giới, ôn lùi) và `goalRatio` có kiểm thử với hồ sơ mới `n4-15min-jlpt-n3`, `n4-5min-runway`, `n3-skip-n4-weak`, `mastered-some-units`, `completed-all-n3`, `n2-goal`, `n4-10min-work-goal` và golden baseline |
| Thay đổi hợp đồng/schema được ghi nhận, không phá dữ liệu | Cam kết | ĐẠT – OpenAPI 1.15.0 (bổ sung); `unit` 1.3.0 (tùy chọn); `scope`/`release` 1.0.0 mới; `CHANGELOG` đầy đủ; seed chỉ chèn nên không phá nội dung đã lưu; không migration |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – không bảng/dịch vụ/phụ thuộc mới; mọi thành phần mới có dòng ở "Theo dõi độ phức tạp" |

**Kết luận**: Cổng ĐẠT trước Phase 0 (một cảnh báo nhẹ ở Nguyên tắc II được giải quyết bằng D10/D11; một điều kiện về phạm vi giai đoạn của luyện đọc được biện minh bằng văn bản ở "Theo dõi độ phức tạp" và chờ chủ dự án xác nhận ở C8) và sau thiết kế Phase 1; không có vi phạm chưa biện minh, không có điều kiện treo trong thiết kế. Điều kiện còn lại là **vận hành** (C1, C2), không phải kiến trúc.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/008-n4-n3-jlpt-content/
├── plan.md                          # Tệp này (/speckit-plan)
├── research.md                      # Phase 0 – quyết định D1…D17 + điểm cần xác nhận C1…C8
├── data-model.md                    # Phase 1 – thực thể tệp, trạng thái suy ra, thuật toán, bất biến I1…I10
├── quickstart.md                    # Phase 1 – kịch bản kiểm chứng QS1…QS8
├── contracts/
│   ├── scope-catalog.md             # Phase 1 – danh mục phạm vi, khớp khóa, báo cáo mức phủ, CLI
│   ├── release-manifest.md          # Phase 1 – đợt phát hành, hồ sơ duyệt, amendments, seed theo đợt, xử lý sự cố
│   ├── content-authoring.md         # Phase 1 – kích thước đơn vị, ánh xạ dạng đề thi, quy tắc AU1…AU18, thứ tự học, checklist duyệt
│   └── api-changes.md               # Phase 1 – OpenAPI 1.14.0 → 1.15.0 (áp vào specs/001-phase1-mvp/contracts/openapi.yaml)
├── checklists/
│   └── requirements.md
└── tasks.md                         # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã) – các vị trí thay đổi

```text
content/
├── scope/                           # mới: {n4,n3}-{kanji,vocabulary,grammar,reading}.json, n5-kanji.ref.json, REVIEW.md
├── releases/                        # mới: 000-baseline.json (33 file hiện có), 001-….json …
├── drafts/                          # mới: <mã-đợt>/*.json – bản nháp chờ duyệt (KHÔNG nạp)
├── units/                           # +≈ 545 file *.json (chỉ đơn vị đã duyệt, thuộc đúng một manifest)
├── topics.json                      # SỬA: + ≈ 150–180 chủ đề (giữ nguyên khóa hiện có)
├── schema/
│   ├── unit.schema.json             # SỬA: 1.3.0 (requires, items[].scopeRef, exercises[].format)
│   ├── scope.schema.json            # mới: 1.0.0
│   ├── release.schema.json          # mới: 1.0.0
│   └── CHANGELOG.md                 # SỬA: ghi 1.3.0, scope 1.0.0, release 1.0.0 + nới giới hạn đoạn đọc N3
└── README.md                        # SỬA: quy trình đợt/duyệt, checklist AU, giới hạn đoạn đọc N3

backend/
├── package.json                     # SỬA: + scripts content:coverage, content:lint, content:stats
├── vitest.config.ts                 # SỬA: env CONTENT_RELEASES=000-baseline cho mọi project
├── src/
│   ├── domain/
│   │   ├── content-validation.ts    # SỬA: AU1…AU18; validateCatalog → mục chính duy nhất (Kanji, từ vựng, ngữ pháp); giới hạn đoạn đọc N3
│   │   └── content-scope.ts         # mới: hàm thuần khớp khóa, trạng thái phủ, vi phạm, ngưỡng --final
│   ├── seed/
│   │   ├── content.ts               # SỬA: loadContent(dir, { releases }) đọc manifest, đóng kín, bỏ drafts/; kiểm scope/topic/sequence/requires
│   │   ├── index.ts                 # SỬA: seed theo lô, đọc khóa đã có một lần, áp amendments
│   │   ├── amendments.ts            # mới: áp bổ sung chỉ-thêm, idempotent (Kanji)
│   │   ├── coverage.ts              # mới: CLI content:coverage / content:stats
│   │   └── lint.ts                  # mới: CLI content:lint (--drafts)
│   ├── engine/
│   │   ├── path.ts                  # SỬA: FRONTIER_SIZE, GOAL_LOOKAHEAD/GOAL_EXTRA, biên giới theo loại, ôn lùi REMEDIAL_MAX_UNITS (hàm thuần)
│   │   └── progress.ts              # SỬA: goalRatio trọng số theo estMinutes
│   ├── services/
│   │   ├── path.ts                  # SỬA: lọc/phân trang GET /path, notices
│   │   ├── progress.ts              # SỬA: goal.notices; dùng goalRatio mới
│   │   ├── achievements.ts          # SỬA nhẹ: goalRatio nhận estMinutes (cùng nguồn)
│   │   └── content.ts               # SỬA: assertActivatable dùng existingItemKeys (Kanji, từ vựng, ngữ pháp)
│   ├── db/repositories/units-admin.ts  # SỬA: listActiveItemKeys(db, unitId, kind)
│   └── api/path.ts                  # SỬA: tham số query kind/level/status/limit/offset
└── tests/
    ├── unit/                        # content-scope, content-coverage, content-releases, content-lint-authoring,
    │                                #   path-frontier, path-remedial, goal-ratio (mở rộng), runway, perf-large-catalog, content-files (mở rộng)
    ├── integration/                 # seed-release-idempotent, seed-amendments, admin-activation-duplicate
    ├── contract/                    # path-filter, scope-notices, goal-ratio-minutes; cập nhật authz-matrix/api-snapshot
    ├── fixtures/learner-profiles/   # n4-15min-jlpt-n3, n4-5min-runway, n4-10min-jlpt-n3, n3-30min-all-skills,
    │                                #   n3-skip-n4-weak, mastered-some-units, completed-all-n3, n2-goal, n4-10min-work-goal (.json)
    └── fixtures/golden/             # plans-pre-008.json (chụp TRƯỚC khi sửa engine – bước 0)

client/
├── lib/
│   ├── data/api/generated/          # sinh lại từ OpenAPI 1.15.0
│   ├── presentation/
│   │   ├── path/path_screen.dart              # SỬA: danh sách dựng lười + lọc theo loại/trình độ (GET /path có tham số)
│   │   ├── path/scope_notice_banner.dart      # SỬA: hiển thị cả listening_not_available (đọc notices)
│   │   ├── progress/progress_screen.dart      # SỬA: banner notices ở thẻ mục tiêu
│   │   ├── onboarding/onboarding_screen.dart  # SỬA: banner nghe hiểu sau khi hoàn tất với mục tiêu JLPT
│   │   ├── profile/profile_screen.dart        # SỬA: banner ở phần mục tiêu
│   │   └── lesson/passage_panel.dart          # SỬA (nếu cần): bảo toàn xuống dòng trong đoạn đọc
│   └── l10n/app_vi.arb, app_en.arb  # SỬA: chuỗi thông báo nghe hiểu
└── test/                            # path (lọc/lười), progress/onboarding (banner), lesson/passage_panel (xuống dòng), l10n_keys
```

**Quyết định cấu trúc**: Giữ nguyên ba phần `backend/`, `client/`, `content/` (Nguyên tắc VI); không thêm dự án, dịch vụ, job hay thư viện. Phần việc chính nằm ở **`content/`** (dữ liệu có schema, danh mục, đợt) và công cụ kiểm tra ở `backend/src/seed` + `domain`. Quy tắc quyết định (độ phủ, biên giới xếp hạng, ôn lùi, tiến độ) ở `domain/` và `engine/` thuần hàm để kiểm thử bằng hồ sơ đại diện; client chỉ hiển thị.

## Chia đợt phát hành (gợi ý – xác nhận ở C3)

Mỗi đợt dùng được độc lập (FR-018). Mã đợt và phạm vi là gợi ý; con số chốt khi danh mục được duyệt. Cổng **G0** = chủ dự án duyệt danh mục phạm vi + giấy phép nguồn (C2); cổng **G1** = người duyệt chuyên môn được chỉ định (C1).

| Đợt | Nội dung | Câu chuyện | Ước lượng đơn vị | Điều kiện |
|---|---|---|---|---|
| 000 | Baseline: 33 đơn vị hiện có | — | 33 | Đã có |
| **H** | **Hạ tầng** (không nội dung mới ngoài đợt mẫu): danh mục rỗng-khung + schema + loader đợt + coverage/lint + tách kiểm thử (D7) + AU + engine D10/D11/D12 + API 1.15.0 + client banner/lọc | nền cho tất cả | 0 + đợt mẫu (nhóm `te-form` 3 đơn vị của đợt 001) | Hạ tầng chạy không cần G0; đợt mẫu cần G1 |
| 001 | Ngữ pháp N4 | US1 (P1) | ≈ 28 | G0, G1 |
| 002 | Ngữ pháp N3 | US1 (P1) | ≈ 28 | G0, G1 |
| 003 | Chữ Hán N4 (+ amendments nếu có) | US3 (P1) | ≈ 46 | G0, G1 |
| 004–005 | Từ vựng N4 (hai đợt theo nhóm chủ đề) | US2 (P1) | ≈ 66 | G0, G1 |
| 006 | Chữ Hán N3 (đợt 1) | US3 (P1) | ≈ 40 | G0, G1 |
| 007 | Chữ Hán N3 (đợt 2) + amendments | US3 (P1) | ≈ 40 | G0, G1 |
| 008–011 | Từ vựng N3 (bốn đợt theo nhóm chủ đề, mỗi đợt ≈ 50 đơn vị) | US2 (P1) | ≈ 200 | G0, G1 |
| 012 | Luyện đọc N4 + N3 (≥ 60 đơn vị, nhiều dạng/chủ đề) | US5 (P2) | ≥ 60 | G0, G1 |
| 013 | Luyện viết N4 + N3 (≥ 40 đơn vị) | US6 (P3) | ≥ 40 | G0, G1 |
| 014 | Rà soát SC-005 (lấy mẫu 5%), bù phần thiếu theo `--final`, nghiệm thu SC-001/002/006/008 | — | bù | Mọi đợt trước |

**Mốc quan trọng**: sau đợt 004–005 + 001 + 003 người học N4 15 phút bắt đầu có nội dung đáng kể; **mốc đường băng SC-003** đạt khi tổng phút từ vựng + ngữ pháp + Kanji N4+N3 ≥ 2.700 (kiểm bằng `content:stats` và `runway.test.ts`) — thường sau đợt 009–010. Sau **mỗi** đợt chạy QS4 + QS5.

## Thứ tự triển khai đề xuất

0. **Chụp trước khi sửa**: golden kế hoạch/lộ trình/tiến độ của hồ sơ đại diện hiện có (`plans-pre-008.json`), số liệu `GET /today` p95 baseline; chuẩn so sánh cho I1, I7, I9. (Tận dụng `generate-plans-pre-*.ts` hiện có.)
1. **Hạ tầng nội dung (đợt H, chặn mọi đợt sau)**: schema `scope`/`release`/`unit` 1.3.0 + `CHANGELOG`; `loadContent` theo manifest + `000-baseline.json` + `CONTENT_RELEASES` + `vitest.config.ts` (D7); `content-scope.ts` + `coverage.ts` + `lint.ts` + script `package.json`; quy tắc AU1…AU18 (`content-validation.ts`) và mục chính duy nhất (`validateCatalog`, `existingItemKeys` ở Admin); seed theo lô + `amendments.ts`; kiểm thử đơn vị/DB tương ứng; cập nhật `content/README.md`.
2. **Learning Engine (đợt H)**: `path.ts` biên giới + ôn lùi (kèm hồ sơ đại diện + golden baseline không đổi); `goalRatio` theo phút + `achievements` (hồi quy thành tựu); `perf-large-catalog` + `runway` (chạy được ngay với nội dung tổng hợp trước khi có nội dung thật).
3. **API + client (đợt H)**: OpenAPI 1.15.0 + sinh lại client Dart; `GET /path` lọc/phân trang; `notices`; banner nghe hiểu + màn Lộ trình lọc/dựng lười + `PassagePanel` xuống dòng; l10n; `quickstart` QS5/QS6.
4. **Danh mục phạm vi (G0)**: soạn 8 file danh mục + `n5-kanji.ref.json` + ghi nguồn/giấy phép; chủ dự án duyệt; `content:coverage` chạy với danh mục đầy đủ (mức phủ ban đầu = 0%); **không** biên soạn hàng loạt trước G0.
5. **Biên soạn theo đợt 001 → 013**: soạn ở `drafts/<đợt>/`; `content:lint --drafts`; người duyệt chuyển sang `units/` + manifest; `pnpm seed` ở môi trường đích; QS4 + QS5 sau mỗi đợt; chạy `content:coverage` để theo dõi.
6. **Nghiệm thu (đợt 014)**: lấy mẫu SC-005; `content:coverage --final`; `runway.test.ts`; QS7 thủ công; văn bản xác nhận SC-008; ghi kết quả vào `quickstart-results.md`.

## Theo dõi độ phức tạp

| Sai lệch / quyết định có chi phí | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| Mở rộng luyện đọc (dạng bài mà hiến pháp xếp vào "luyện nghe và đọc" của Giai đoạn 2) từ ~12 bài của spec 007 lên ≥ 60 đơn vị | Đề JLPT có phần đọc hiểu chiếm tỷ trọng lớn trong điểm kiến thức ngôn ngữ; spec yêu cầu "đầy đủ để thi" (FR-009, SC-006); hiến pháp đã đưa mô-đun Learning Content (nghe, đọc) vào phạm vi, chỉ phần "luyện" xếp Giai đoạn 2; không thêm dịch vụ/bảng/AI, dùng đúng loại bài của spec 007; xếp P2 sau ba mảng nền | Không mở rộng luyện đọc: không đủ cho phần đọc hiểu của kỳ thi; sửa hiến pháp 1.3.0 (dự thảo ở 007/research §Q2): chủ dự án quyết ([C8](research.md)) |
| Danh mục phạm vi dạng dữ liệu + CLI độ phủ (`scope/`, `content:coverage`) | FR-001/002/003 và SC-001/002 đòi danh mục có nguồn, trạng thái rõ và báo cáo mức phủ kiểm được; trạng thái **suy ra** nên không lệch ([D2, D3](research.md)) | Bảng tính ngoài repo: không có cổng tự động, không nghiệm thu được SC-001 |
| Đợt phát hành + manifest + đóng kín seed | FR-017/SC-004: 100% đơn vị của các đợt mới có hồ sơ duyệt (baseline là hồ sơ lịch sử), 0 đơn vị chưa duyệt hiển thị — cần chặn **cứng**, và hồ sơ phải kiểm được ([D5](research.md)) | Nạp bản nháp `status = draft` rồi kích hoạt qua Admin: ≈ 545 lần thao tác tay, không diff review; cột `reviewed_by`: cần migration cho thông tin đã có trong git |
| `amendments` chỉ-thêm cho chữ Hán hiện có | Câu chuyện 3 kịch bản 3 + FR-007/018: cách đọc mới phải vào mục cũ mà không đổi id; seed không cập nhật đơn vị đã có ([D6](research.md)) | Admin API bằng tay: không lặp lại được, không có trong git; seed ghi đè: phá FR-018 |
| `CONTENT_RELEASES` + baseline cho kiểm thử | 71 điểm `seedContent` và golden gắn với 33 đơn vị; seed ≈ 580 đơn vị mỗi file kiểm thử là thêm hàng chục phút CI ([D7](research.md)) | Sao chép 33 file vào `fixtures/`: nhân đôi dữ liệu, dễ lệch; sửa 71 điểm gọi |
| Biên giới trong `rankUnits` (`FRONTIER_SIZE = 3`) | `sequence` nặng 0,01 điểm còn mảng yếu +40/độ lệch ±16 ⇒ thích ứng nhảy tới bất kỳ đâu trong 300+ đơn vị, phá kiến thức nền (FR-011, US1.4) ([D10](research.md)) | Chỉ gán `sequence` cẩn thận: bảo đảm bằng niềm tin; cột `prerequisites` + khóa bài: migration, UI, xử lý người xếp N3 bỏ qua N4 |
| Ôn lùi bị chặn (≤ 3 đơn vị) | Câu chuyện 4 kịch bản 2: người xếp N3 "vẫn có thể được gợi ý ôn N4 ở mảng yếu"; hiện `levelRange` không bao giờ chứa N4 ([D11](research.md)) | Không làm gì: kịch bản 2 không có cơ chế; mở toàn bộ N4: lấn át N3 |
| `goalRatio` theo phút | Tiến độ theo số đơn vị bị lệch về từ vựng (≈ 48% số đơn vị) khi thư viện lớn, và lệch với `isOnTrack` vốn tính theo phút (FR-022) ([D12](research.md)) | Giữ đếm đơn vị: người học xong ngữ pháp + Kanji vẫn thấy ~35% |
| `notices` tính lúc đọc thay vì mở rộng `ScopeNotice` | `ScopeNotice` lưu trong `generated_from` nên lộ trình cũ không có giá trị mới; học viên JLPT hiện có cũng phải thấy FR-022 ([D12](research.md)) | Thêm vào `ScopeNotice`: chỉ áp dụng cho lộ trình dựng sau đó |
| Siêu dữ liệu `scopeRef`/`format`/`requires` chỉ ở file | Phục vụ độ phủ, phủ dạng đề thi và tiên quyết có kiểm tra mà không migration ([D8](research.md)) | Lưu vào DB: cột/bảng không ai đọc lúc chạy |
| `GET /path` lọc/phân trang tùy chọn | ≈ 600 đơn vị (≈ 90 KB) mỗi lần mở Lộ trình; SC-007 và Trường hợp biên cuối ([D15](research.md)) | Giữ nguyên: màn Lộ trình chậm và khó dùng; bắt buộc phân trang: phá client cũ |
| Nới giới hạn đoạn đọc N3 lên 700 ký tự | Đề N3 có đoạn vừa/dài/tra cứu 350–600 ký tự; FR-009 đòi dạng đoạn đa dạng; FR-019 yêu cầu ghi lại mở rộng hợp đồng ([D14](research.md)) | Giữ 400: không có dạng đúng kích thước đề |

## Rủi ro và điểm cần theo dõi

- **Biên soạn và duyệt ≈ 545 đơn vị là điều kiện cứng và là công việc lớn nhất** (C1): thiếu người duyệt chuyên môn thì không đơn vị nào được chuyển sang `units/`. Giảm bằng đợt nhỏ ≈ 40 đơn vị, ưu tiên theo giá trị (ngữ pháp → từ vựng/Kanji N4 → N3 → đọc → viết), cổng lint chặn lỗi máy bắt được để người duyệt tập trung vào cách đọc kana, hai đáp án cùng đúng, bản dịch ([research.md D16](research.md)).
- **Lỗi nội dung quy mô lớn khi bản nháp có hỗ trợ AI** (cách đọc sai, hai đáp án cùng đúng, ví dụ thiếu tự nhiên): duyệt từng đơn vị bắt buộc (không lấy mẫu), lấy mẫu 5% sau phát hành (SC-005) và có sẵn lối thoát `inactive` + `amendments`.
- **Bản quyền và giấy phép nguồn** (C2): chỉ lấy tư cách thành viên danh sách, không lấy nghĩa/ví dụ/bài tập; kiểm tra giấy phép từng nguồn trước khi dùng; ghi nguồn ở manifest.
- **Danh mục phạm vi không phải "chân lý" của JLPT**: JLPT không công bố danh sách (Giả định); danh mục là thỏa thuận được duyệt; SC-008 dựa trên đối chiếu độc lập của người có chuyên môn. Dòng chỉ có một nguồn được xem xét riêng.
- **Thay đổi engine ảnh hưởng người học hiện có**: biên giới và ôn lùi chỉ khác công thức cũ khi một loại còn > 3 đơn vị chưa học; golden baseline giữ nguyên, phần thay đổi (nếu có) được rà soát có chủ đích. Học viên đang giữa lộ trình có thể thấy thứ tự bài kế tiếp thay đổi khi nội dung mở rộng — vì lộ trình vốn **tính động** (không lưu thứ tự), đây là hành vi sẵn có chứ không phải hồi quy; kế hoạch **đã sinh** cho ngày hôm nay không đổi.
- **`completionRatio` giảm đột ngột khi phát hành đợt đầu** (phạm vi tăng gấp nhiều lần) và đổi cách tính (D12): đúng theo FR-022 nhưng cần thông báo thay đổi cho người học; thành tựu `goal_*` đã đạt không bị thu hồi (kiểm hồi quy `reward-achievements`).
- **Đánh dấu thành thạo từng đơn vị mất công khi thư viện lớn** (Nguyên tắc III): chấp nhận ở bản này; đề xuất spec riêng đánh dấu hàng loạt theo chủ đề/chặng.
- **Xếp lớp sai trình độ** (bộ 20 câu giữ nguyên, D13): hệ quả lớn hơn khi có nhiều nội dung N4; giảm bằng quyền dựng lại lộ trình/đổi trình độ và ghi rủi ro cho spec riêng.
- **Màn chọn đơn vị của giáo viên (spec 004) và danh sách Admin** với ≈ 600 đơn vị: rà soát mã khi hiện thực; thêm lọc loại/trình độ/phân trang nếu thiếu (D15).
- **Phông 9,6 MB đã đóng gói**: phủ glyph được kiểm tự động (AU14); không đổi. Nếu hiển thị web trên một trình duyệt vẫn lỗi ô vuông ở chữ hiếm, xử lý ở bước QS7.
- **Thời gian CI**: kiểm thử nội dung thật (`content-files`, `content-coverage`, seed đầy đủ) chạy riêng với `releases: 'all'`; các kiểm thử còn lại dùng baseline (D7). Theo dõi tổng thời gian CI sau đợt H.
