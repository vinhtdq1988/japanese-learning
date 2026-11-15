# Kế hoạch triển khai: Hoàn thiện trải nghiệm học theo góp ý (xem mật khẩu, luyện đọc/viết, màu năng lực, mặc định theo thời gian, lời khích lệ)

**Nhánh**: `007-fix-comments` (tên thư mục tính năng; nhánh git hiện tại là `master`) | **Ngày**: 2026-11-12 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/007-fix-comments/spec.md` (Giai đoạn 1 – MVP, cải tiến trải nghiệm theo hiến pháp v1.2.0; riêng luyện đọc/viết chạm phạm vi Giai đoạn 2 và được biện minh ở "Theo dõi độ phức tạp")

## Tóm tắt

Thêm năm cải tiến lên hệ thống đã hoàn tất (001 MVP, 003 Kanji, 004 Lớp học, 005 Hiệu ứng thưởng), **không thêm bảng, dịch vụ, job hay phụ thuộc**:

1. **Xem mật khẩu (US5, P3)** – widget `PasswordField` dùng chung (đăng nhập, đăng ký, đặt lại mật khẩu): mặc định che, bật/tắt trong `State` của widget (không lưu), nút có nhãn trợ năng và thao tác được bằng bàn phím.
2. **Gợi ý mặc định theo thời gian (US1, P1)** – bảng gợi ý kỹ năng theo quỹ 5/10/15/30 phút do backend sở hữu (`GET /study-defaults`); client điền sẵn ở onboarding **chỉ khi người học chưa chỉnh** và chỉ **mời áp dụng** khi đổi quỹ thời gian về sau (không ghi đè ngầm).
3. **Luyện đọc/viết (US2, P1)** – hai giá trị mới của enum `skill` (`reading`, `writing`) chạy trên máy móc đơn vị–phiên–chấm điểm–tiến độ hiện có; điều kiện **quỹ thời gian đang áp dụng ≥ 30 phút** kiểm ở máy chủ tại một điểm lọc duy nhất (`resolveLearningContext`) cộng bốn chốt chặn phiên (`403 PRACTICE_LOCKED`); Learning Engine đưa vào kế hoạch bằng "suất luyện tập" (`applyPracticeSlot`) mà **không đổi `planDailyPlan`** nên bất biến quỹ thời gian/60% ôn tập giữ nguyên.
4. **Màu năng lực (US3, P2)** – một hàm phân loại thuần (`good` ≥ 70% / `needs_improvement` / `insufficient` < 8 câu) dùng cùng hằng số với cờ "mảng yếu" nên màu vàng và danh sách mảng yếu không mâu thuẫn; tính từ `topic_stats` và trả trong `GET /today`, `GET /path`, `GET /progress` để ba màn luôn khớp; màu luôn đi kèm biểu tượng + nhãn chữ + chú giải, tương phản ≥ 4.5:1.
5. **Lời khích lệ (US4, P2)** – backend chọn trạng thái từ tín hiệu tiến độ đã ghi (sáu trạng thái, thứ tự ưu tiên cố định) và biến thể tất định theo ngày (≥ 3 biến thể mỗi trạng thái, vi/en, kiểm thử từ cấm); `GET /today` trả `encouragement`; client hiện một dải chữ tĩnh, không trùng hiệu ứng chúc mừng của spec 005.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Tái dùng thay vì xây mới**: luyện đọc/viết là đơn vị học (`kind = reading | writing`) với bài `multiple_choice` / `fill_blank` không gắn mục (không vào SRS); kết quả vào `study_records` → `topic_stats` → tiến độ và màu năng lực mà không có đường ghi thứ hai (P1, P4).
- **Bật/tắt = danh sách `skills` của hồ sơ** – cơ chế đã có khóa theo lớp (FR-025 thỏa miễn phí) và quyền tắt/bật của người học (Nguyên tắc III); hạ quỹ thời gian chỉ **lọc** ở hồ sơ hiệu lực, không xóa lựa chọn đã lưu (P2).
- **Năng lực là giá trị suy ra**, không lưu: một truy vấn `topic_stats ⨝ topics` cho cả mức kỹ năng lẫn chủ đề (P7, P8).
- **Hợp đồng**: OpenAPI 1.13.0 → 1.14.0, chỉ bổ sung (một route đọc, hai giá trị enum, một mã lỗi, vài trường tùy chọn) – [contracts/api-changes.md](contracts/api-changes.md).
- **Phạm vi giai đoạn**: biện minh bằng văn bản ở mục "Theo dõi độ phức tạp" (phương án (b) của spec), kèm dự thảo sửa hiến pháp 1.3.0 ở [research.md §Q2](research.md) nếu chủ dự án muốn phương án (a).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend TypeScript 5.x trên Node.js 22 LTS; client Dart 3.x / Flutter stable (web) – không đổi so với 001–006.

**Phụ thuộc chính**: **Không thêm phụ thuộc chạy** ở cả backend lẫn client. Backend: Fastify, Zod, Drizzle ORM (đã có). Client: Riverpod, go_router, dio, API client sinh bằng openapi-generator `dart-dio` (sinh lại từ OpenAPI 1.14.0).

**Lưu trữ**: PostgreSQL 16; migration mới `0006_practice_skills.sql` (một file, chỉ `ALTER TYPE skill ADD VALUE 'reading'/'writing'`) – **không bảng/cột mới** ([data-model.md §1](data-model.md)). Nội dung mới: 12 file `content/units/*.json` (2 bài đọc + 2 bài viết × N5/N4/N3) và các chủ đề mới trong `content/topics.json`; JSON Schema `unit` 1.1.0 → 1.2.0.

**Kiểm thử**: Vitest – đơn vị thuần hàm (`practice`, `daily-plan-practice`, `competency`, `encouragement` + `encouragement-catalog`, `study-defaults`, `content-validation-practice`, `content-files`), hợp đồng (`fix-us1…fix-us4`, ma trận quyền `/study-defaults`, OpenAPI 1.14.0), tích hợp PostgreSQL (`practice-gate`, `competency-consistency`, hạ/nâng phút, học viên lớp, migration), golden hồi quy kế hoạch/lộ trình/tiến độ. `flutter test` – widget/đơn vị (`PasswordField`, `reconcileSuggestion`, onboarding/Hồ sơ khóa dưới 30 phút, chip/chú giải năng lực + tương phản, dải khích lệ, đoạn văn ghim, IME composition, l10n).

**Nền tảng đích**: Trình duyệt desktop (Chrome, Edge, Firefox, Safari); server Linux (Docker) – không đổi.

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST) với thư mục nội dung `content/` – mở rộng dự án hiện có.

**Mục tiêu hiệu năng**: `GET /today` và `GET /progress` p95 tăng ≤ 50 ms (thêm một truy vấn `topic_stats ⨝ topics`, `listActiveDays` đã có ở /progress); kế hoạch ngày vẫn sinh một lần/ngày (không đổi tần suất); `GET /study-defaults` là bảng tĩnh (không truy vấn CSDL). Phiên luyện đọc/viết hoàn thành trong 5–15 phút (SC-004); `generatePlan` thêm không quá một lần gọi hàm thuần.

**Ràng buộc**: tổng `estMinutes` kế hoạch ≤ quỹ khai báo (Nguyên tắc I, I1); luyện đọc/viết chỉ khi quỹ hiệu lực ≥ 30 và kiểm ở máy chủ (FR-006); mặc định chỉ là gợi ý, không ghi đè ngầm (FR-024); lựa chọn bị lớp khóa không bị mặc định đổi (FR-025); màu không là kênh thông tin duy nhất (FR-019); lời khích lệ luôn tích cực, không đe dọa mất chuỗi (FR-027); mật khẩu che mặc định, trạng thái hiện không lưu (FR-002/003); không đổi chấm điểm/lịch ôn/độ khó của Learning Engine cho người không chọn luyện (golden); song ngữ vi/en.

**Quy mô/Phạm vi**: 2 giá trị enum, 1 route mới (đọc), 1 mã lỗi, 4 trường DTO tùy chọn; 3 hàm engine thuần mới (`competency`, `encouragement`, `applyPracticeSlot`) + 2 miền (`practice`, `study-defaults`); 12 đơn vị nội dung; ~8 màn hình client được chạm (đăng nhập, đăng ký, đặt lại mật khẩu, onboarding, Hồ sơ, Hôm nay, Lộ trình, Tiến độ, bài học) + 4 widget dùng chung mới; 0 bảng, 0 dịch vụ nền.

Không còn mục NEEDS CLARIFICATION (đã giải quyết trong [research.md](research.md)); tám điểm cần chủ dự án biết nằm ở "Điểm cần chủ dự án xác nhận" (C1…C8) – đáng chú ý **C2 (nội dung 12 bài do ai biên soạn/duyệt – điều kiện cứng để phát hành US2)** và C1 (thủ tục phạm vi giai đoạn).

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.2.0:

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – spec đặt mỗi phiên luyện 5–15 phút và kế hoạch ≤ quỹ (FR-005, FR-013) | ĐẠT – nội dung luyện biên soạn 5/10 phút, quỹ thời lượng kiểm bằng quy tắc PR6; `applyPracticeSlot` chỉ **sắp lại ứng viên** trước `planDailyPlan` nên chặn cứng tổng ≤ `B`, ôn ≤ 60% vẫn do engine cũ bảo đảm; thuộc tính I1 kiểm trên nhiều quỹ/ngày; luyện chỉ bật từ 30 phút nên người ít thời gian không bị quá tải |
| II. Personalized Learning Engine | CẢNH BÁO nhẹ – hai kỹ năng mới phải do Learning Engine phân bổ (FR-013), không để cố định | ĐẠT – luyện đọc/viết được **Learning Engine** đưa vào kế hoạch (slot luân phiên reading↔writing, cách một kế hoạch, ưu tiên khi người học đặt `prioritizedSkill`), tính theo trình độ/mục tiêu qua `rankUnits` như mọi đơn vị; năng lực suy ra từ kết quả quan sát được; golden chứng minh kế hoạch người không chọn luyện **không đổi**; hàm mới đều thuần và có kiểm thử hồ sơ đại diện |
| III. Learner Control | ĐẠT – FR-023/024/013 nêu rõ gợi ý đổi được, không ghi đè, tắt/bật lại được | ĐẠT – mặc định chỉ điền khi "chưa chỉnh" và chỉ mời áp dụng khi đổi quỹ thời gian (`reconcileSuggestion`); hạ quỹ không xóa lựa chọn đã lưu (I4); tắt/bật luyện = chỉnh `skills`; học viên lớp chịu khóa của lớp như cũ (`CLASS_MANAGED`) và mặc định không đụng trường bị khóa; xem mật khẩu do người dùng tự bật |
| IV. Evidence-Based Learning Methods | ĐẠT – luyện đọc/viết là "học qua thực hành"; màu và khích lệ phục vụ điểm yếu, thói quen | ĐẠT – kết quả luyện vào `topic_stats`/tiến độ; màu năng lực dùng chính cửa sổ kết quả và ngưỡng của cờ yếu; khích lệ dựa chuỗi ngày/hoàn thành, không thưởng theo tốc độ; SRS không đổi (luyện không gắn mục, C6) |
| V. Cross-Platform, Web-First | ĐẠT – không có hành vi riêng nền tảng mới | ĐẠT – `PasswordField`, chip, dải khích lệ là widget Flutter thuần; không `dart:html`/`package:web` mới; mọi quy tắc nghiệp vụ (điều kiện, năng lực, chọn câu, bảng gợi ý) ở backend nên mobile dùng lại nguyên; gõ IME dùng `TextField` chuẩn |
| VI. Separated Architecture | ĐẠT – spec đòi điều kiện ≥ 30 ở máy chủ, nội dung là dữ liệu, hợp đồng ghi tài liệu | ĐẠT – nội dung luyện là dữ liệu JSON/Admin (không sửa client để thêm bài); bảng gợi ý, năng lực, khích lệ do backend sở hữu, client chỉ hiển thị; OpenAPI 1.14.0 chỉ bổ sung, nhật ký trong `info.description`; migration chỉ thêm giá trị enum |
| Phạm vi theo giai đoạn | **CẦN BIỆN MINH** – "luyện nghe và đọc" xếp ở Giai đoạn 2 | ĐẠT CÓ BIỆN MINH – xem dòng đầu bảng "Theo dõi độ phức tạp" (yêu cầu trực tiếp của chủ dự án; mô-đun Learning Content (nghe, đọc) đã trong phạm vi; không thêm dịch vụ/bảng/AI; luyện viết bằng gõ bàn phím không thuộc điều loại trừ "viết tay"; không xây luyện nghe/nói/AI). Có thể thay bằng sửa hiến pháp 1.3.0 (C1) mà không đổi thiết kế |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết | ĐẠT – `competency`, `encouragement`, `applyPracticeSlot`, `study-defaults`, `practice` đều là hàm thuần có kiểm thử với hồ sơ đại diện (mới, 15/30 phút, vắng nhiều ngày, mảng yếu/hồi phục…) và golden hồi quy |
| Thay đổi hợp đồng/schema được ghi nhận, không phá dữ liệu | Cam kết | ĐẠT – 1.14.0 ghi trong `info.description`; migration chỉ `ADD VALUE`; schema nội dung 1.2.0 ghi `CHANGELOG`; trường mới tùy chọn; hạn chế enum `Skill` mở rộng được nêu và xử lý bằng phát hành client + backend cùng lúc |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – không bảng/dịch vụ/phụ thuộc mới; ba hàm thuần + hai module miền có lý do ở bảng "Theo dõi độ phức tạp" |

**Kết luận**: Cổng ĐẠT (có một điều kiện được biện minh bằng văn bản: phạm vi giai đoạn) trước Phase 0 và sau thiết kế Phase 1; không có vi phạm chưa biện minh, không có điều kiện treo trong thiết kế. Điều kiện về hiến pháp của spec ("phải xử lý trước khi hoàn tất `/speckit-plan`") được xử lý ở dòng đầu "Theo dõi độ phức tạp" và [research.md §Q2](research.md).

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/007-fix-comments/
├── plan.md                          # Tệp này (/speckit-plan)
├── research.md                      # Phase 0 – quyết định P1…P14, Q1…Q3 + điểm cần xác nhận C1…C8
├── data-model.md                    # Phase 1 – migration enum, nội dung luyện, thuật toán dẫn xuất, bất biến, trạng thái client
├── quickstart.md                    # Phase 1 – kịch bản kiểm chứng QS1…QS6 + danh sách kiểm tay
├── contracts/
│   ├── api-changes.md               # Phase 1 – OpenAPI 1.13.0 → 1.14.0 (áp vào specs/001-phase1-mvp/contracts/openapi.yaml)
│   ├── competency-rules.md          # Phase 1 – quy tắc phân loại năng lực, màu, trợ năng
│   ├── encouragement-catalog.md     # Phase 1 – 6 trạng thái × 4 biến thể × vi/en, chọn trạng thái/biến thể, từ cấm
│   └── practice-content.md          # Phase 1 – cấu trúc & quy tắc kiểm tra nội dung luyện đọc/viết
├── checklists/
│   └── requirements.md
├── comment.txt                      # Góp ý gốc của chủ dự án
└── tasks.md                         # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã) – các vị trí thay đổi

```text
content/
├── units/                           # mới: n5|n4|n3-reading-*.json, n5|n4|n3-writing-*.json (12 đơn vị)
├── topics.json                      # SỬA: + chủ đề reading-*/writing-* theo trình độ
├── schema/unit.schema.json          # SỬA: 1.2.0 (kind thêm reading, writing)
├── schema/topics.schema.json        # SỬA: skill thêm reading, writing
├── schema/CHANGELOG.md              # SỬA: ghi 1.2.0
└── README.md                        # SỬA: mục "Biên soạn bài luyện đọc/viết"

backend/
├── src/
│   ├── domain/
│   │   ├── types.ts                 # SỬA: SKILLS + PRACTICE_SKILLS; ERROR_CODES + PRACTICE_LOCKED
│   │   ├── practice.ts              # mới: PRACTICE_MIN_DAILY_MINUTES, isPracticeEligible, effectiveSkills
│   │   ├── study-defaults.ts        # mới: bảng gợi ý + suggestedSkills(dailyMinutes)
│   │   ├── encouragement.ts         # mới: danh mục câu vi/en (6 trạng thái × 4)
│   │   ├── profile-validation.ts    # SỬA: skillsSchema nhận reading/writing; thông điệp lỗi
│   │   └── content-validation.ts    # SỬA: validateReadingUnit / validateWritingUnit (PR1…PR9)
│   ├── engine/
│   │   ├── competency.ts            # mới: classifyCompetency, aggregate (kỹ năng/chủ đề) – hàm thuần
│   │   ├── encouragement.ts         # mới: pickEncouragementState, pickVariant – hàm thuần
│   │   └── daily-plan.ts            # SỬA: + applyPracticeSlot (planDailyPlan KHÔNG đổi)
│   ├── db/
│   │   ├── migrations/0006_practice_skills.sql   # mới
│   │   ├── schema.ts                             # SỬA: skill enum + reading, writing
│   │   └── repositories/
│   │       ├── topic-stats.ts       # SỬA: + listTopicWindows(userId) (⨝ topics.skill)
│   │       └── plans.ts             # (lastNewUnitPlanKinds dùng lại; kiểm kiểu trả về)
│   ├── services/
│   │   ├── learning-context.ts      # SỬA: áp effectiveSkills lên profile/params/template (điểm lọc duy nhất)
│   │   ├── daily-plan.ts            # SỬA: applyPracticeSlot trước applyKanjiSlot; + competency/encouragement trong DTO
│   │   ├── competency.ts            # mới: loadCompetency(deps, userId)
│   │   ├── encouragement.ts         # mới: buildEncouragement(deps, userId, ctx, plan)
│   │   ├── progress.ts              # SỬA: + competency (skills/topics); trích tín hiệu dùng chung
│   │   ├── path.ts                  # SỬA: + competency theo chủ đề cho từng item
│   │   ├── profile.ts               # SỬA: từ chối THÊM reading/writing khi phút < 30
│   │   ├── onboarding.ts            # SỬA: cùng quy tắc khi lưu nháp/hoàn tất
│   │   └── lesson-session.ts        # SỬA: chốt chặn PRACTICE_LOCKED (start/answers/intervals/complete)
│   ├── api/
│   │   ├── study-defaults.ts        # mới: GET /study-defaults (đăng ký trong routes.ts)
│   │   └── routes.ts                # SỬA
│   ├── seed/content.ts              # (nạp đơn vị luyện: item_id = NULL cho bài tập)
│   └── reports/product-metrics.sql  # SỬA: + tỷ lệ học viên bật luyện đọc/viết (SC-003/004 theo dõi)
└── tests/
    ├── unit/                        # practice, daily-plan-practice, competency, encouragement, encouragement-catalog,
    │                                #   study-defaults, content-validation-practice (+ content-files mở rộng)
    ├── contract/                    # fix-us1 (defaults), fix-us2 (luyện/cổng), fix-us3 (năng lực), fix-us4 (khích lệ); mở rộng authz-matrix
    ├── integration/                 # practice-gate, competency-consistency, practice-profile-minutes, practice-class, migration (mở rộng)
    └── fixtures/learner-profiles/   # competency-mixed|new|recovering.json, practice-30min.json, encouragement-*.json; golden plans-pre-practice.json

client/
├── lib/
│   ├── data/api/generated/          # sinh lại từ OpenAPI 1.14.0
│   ├── data/study_defaults_repository.dart   # mới: StudyDefaults + provider (cache theo phiên)
│   ├── domain/
│   │   ├── onboarding_form.dart     # SỬA: OnboardingOptions.skills + reading/writing; reconcileSuggestion (hàm thuần)
│   │   └── study_suggestion.dart    # mới: reconcileSuggestion, isPracticeLockedFor(minutes, threshold)
│   ├── presentation/
│   │   ├── auth/
│   │   │   ├── password_field.dart  # mới: TextFormField + nút hiện/ẩn (State cục bộ)
│   │   │   ├── login_screen.dart    # SỬA: dùng PasswordField
│   │   │   ├── register_screen.dart # SỬA
│   │   │   └── reset_password_screen.dart  # SỬA
│   │   ├── competency/              # mới
│   │   │   ├── competency_chip.dart     # biểu tượng + nhãn + Semantics
│   │   │   ├── competency_legend.dart   # chú giải ba màu
│   │   │   └── competency_palette.dart  # ThemeExtension (sáng/tối), hàm tương phản cho kiểm thử
│   │   ├── today/
│   │   │   ├── today_screen.dart    # SỬA: + EncouragementBanner, chip năng lực, biểu tượng reading/writing, legend
│   │   │   └── encouragement_banner.dart   # mới
│   │   ├── onboarding/onboarding_screen.dart  # SỬA: nhãn gợi ý, điền sẵn/giữ lựa chọn, khóa luyện < 30
│   │   ├── profile/profile_screen.dart        # SỬA: lời mời gợi ý mới, mục kỹ năng khóa kèm lý do
│   │   ├── path/path_screen.dart              # SỬA: chip năng lực + legend
│   │   ├── progress/progress_screen.dart      # SỬA: dải năng lực theo kỹ năng + chủ đề + legend
│   │   ├── lesson/lesson_screen.dart          # SỬA: PassagePanel ghim đoạn văn khi có mục kind=reading; chặn Enter khi đang soạn IME
│   │   └── shared/theme.dart                  # SỬA: đăng ký CompetencyPalette
│   ├── router.dart                  # (không đổi)
│   └── l10n/app_vi.arb, app_en.arb  # SỬA: chuỗi luyện đọc/viết, năng lực, gợi ý, nhãn trợ năng mật khẩu
└── test/                            # mới: auth/password_field, onboarding/suggestion, practice/{locked_skills,passage_panel,ime_submit},
                                     #   competency/{chip,legend,palette_contrast}, today/encouragement_banner
```

**Quyết định cấu trúc**: Giữ nguyên ba phần `backend/`, `client/`, `content/` (Nguyên tắc VI); không thêm dự án, dịch vụ, job hay thư viện. Quy tắc quyết định (điều kiện luyện, suất luyện, phân loại năng lực, chọn câu khích lệ, bảng gợi ý) nằm ở `domain/` và `engine/` thuần hàm để kiểm thử bằng hồ sơ đại diện; phần có trạng thái ở `services/`. Client chỉ hiển thị và quản lý trạng thái giao diện cục bộ.

## Thứ tự triển khai đề xuất

0. **Chụp ảnh golden trước khi sửa**: kế hoạch 14 ngày, `GET /path`, `GET /progress` của các hồ sơ đại diện hiện có (mở rộng bộ golden) – chuẩn so sánh cho bất biến I2; kiểm tra nhanh "phản hồi cũ chỉ thêm trường tùy chọn".
1. **Nền tảng** (chặn mọi câu chuyện): migration 0006 + `schema.ts` + `types.ts`; OpenAPI 1.14.0 và sinh lại API client; `domain/practice.ts`, `domain/study-defaults.ts` và kiểm thử; `engine/competency.ts` + kiểm thử biên; `CompetencyPalette` + kiểm thử tương phản.
2. **US5 (P3) – xem mật khẩu**: `PasswordField` + thay ở đăng nhập (bắt buộc), đăng ký, đặt lại mật khẩu; l10n. Độc lập hoàn toàn, có thể ra sớm nhất.
3. **US1 (P1) – gợi ý mặc định**: `GET /study-defaults` + hợp đồng; `reconcileSuggestion`; onboarding (nhãn + điền sẵn/giữ lựa chọn); Hồ sơ (lời mời áp dụng). Phần "bật reading/writing" hoàn chỉnh sau US2 nhưng bảng và logic độc lập.
4. **US2 (P1) – luyện đọc/viết**: quy tắc nội dung (PR1…PR9) + schema 1.2.0 + chủ đề → **biên soạn 12 đơn vị (điều kiện cứng, C2)** → `effectiveSkills` ở `resolveLearningContext` + chốt chặn `PRACTICE_LOCKED` + kiểm tra khi lưu hồ sơ/onboarding → `applyPracticeSlot` + golden → client (kỹ năng khóa/mở, biểu tượng, `PassagePanel`, IME) → admin editor chọn kind. *Không phát hành US2 khi thiếu kiểm thử cổng ≥ 30 qua API trực tiếp (SC-003) và kiểm thử bất biến quỹ thời gian (I1).*
5. **US3 (P2) – màu năng lực**: `services/competency.ts` + gắn vào `/progress`, `/today`, `/path` + kiểm thử nhất quán ba endpoint; `CompetencyChip`/`Legend` ở ba màn; hồ sơ mẫu ba mức.
6. **US4 (P2) – lời khích lệ**: `domain/encouragement.ts` (+ kiểm thử từ cấm) → `engine/encouragement.ts` → `services/encouragement.ts` + gắn `GET /today` → `EncouragementBanner`; chủ dự án duyệt giọng điệu.
7. Rà soát l10n (`tool/check_l10n.dart`); ma trận quyền; đo p95 `/today` và `/progress`; chạy toàn bộ kiểm thử + golden; danh sách kiểm tay (IME thật, mù màu, màn hẹp).

## Theo dõi độ phức tạp

| Sai lệch / quyết định có chi phí | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| **Đưa luyện đọc/viết vào phạm vi hiện tại dù hiến pháp xếp "luyện nghe và đọc" ở Giai đoạn 2** (điều kiện hiến pháp của spec, cách (b)) | Chủ dự án yêu cầu trực tiếp (điểm 2 của `comment.txt`); "Learning Content (… nghe, đọc)" đã là mô-đun trong phạm vi của hiến pháp, chỉ phần "luyện" nâng cao bị xếp Giai đoạn 2; hiện thực **không** thêm dịch vụ/bảng/phụ thuộc/AI – chỉ nội dung dữ liệu và hai giá trị enum trên máy móc Giai đoạn 1; luyện viết bằng gõ bàn phím không thuộc điều loại trừ "viết tay Kanji"; giới hạn ≥ 30 phút bảo vệ Nguyên tắc I; **không** xây luyện nghe/nói/chấm tự do | Hoãn sang Giai đoạn 2: trái yêu cầu của chủ dự án. Sửa hiến pháp (a): hợp lệ nhưng là thủ tục của chủ dự án; dự thảo 1.3.0 có sẵn ở [research.md §Q2](research.md), không đổi thiết kế |
| Hai giá trị enum `skill` (`reading`, `writing`) | Cách ít thay đổi nhất để đi qua toàn bộ máy móc: nội dung, phiên, chấm, tiến độ, kế hoạch, khóa theo lớp, màu theo kỹ năng | Bảng/route "bài luyện" riêng: 3–4 bảng và luồng chấm + ghi tiến độ thứ hai phải đồng bộ với `topic_stats`, chuỗi ngày, thành tựu; cờ `practiceEnabled`: không có chỗ cho nội dung/chủ đề/màu |
| Bốn chốt chặn `PRACTICE_LOCKED` cộng một điểm lọc `effectiveSkills` | FR-006/SC-003 đòi 100% chặn kể cả qua API trực tiếp; điểm lọc duy nhất bảo đảm kế hoạch/lộ trình/học thêm nhất quán, chốt chặn bịt mục kế hoạch cũ và phiên dở dang | Chỉ ẩn ở giao diện: vi phạm FR-006; lọc rải rác từng service: dễ sót khi thêm màn mới |
| `applyPracticeSlot` (hàm thuần mới) | FR-013 đòi luyện đọc/viết *xuất hiện đều* trong kế hoạch mà rank thuần điểm không bảo đảm; theo khuôn `applyKanjiSlot` nên bất biến quỹ giữ nguyên | Nhân điểm trong `rankUnits`: khó đảm bảo xuất hiện, đụng golden của mọi người học |
| Hàm `classifyCompetency` + dịch vụ `loadCompetency` | Một nguồn quy tắc cho ba màn (FR-018) và nhất quán với cờ "mảng yếu" | Client tự phân loại ở từng màn: nhân bản quy tắc, dễ lệch |
| Bảng gợi ý ở backend (`GET /study-defaults`) | Nguyên tắc VI: quy tắc nghiệp vụ không cứng ở client; tinh chỉnh một chỗ | Hằng số trong client: hai nơi sửa, không dùng lại được cho mobile |
| `reconcileSuggestion` thuần client, không cờ "đã chỉnh" | Đáp ứng FR-024 mà không đổi hợp đồng/migration | Cột/cờ `skillsCustomized`: thêm trạng thái suy ra được bằng so sánh |
| Danh mục khích lệ trong mã (6×4×2 câu) + chọn biến thể theo ngày | FR-029, SC-008, kiểm thử tất định; không bề mặt quản trị chưa ai yêu cầu | Bảng DB + Admin: thêm bề mặt; chọn ngẫu nhiên mỗi lần mở: nhấp nháy, khó kiểm thử |
| `PasswordField` dùng chung | 3 màn cùng khuôn; trạng thái cục bộ bảo đảm FR-002/003 | Tự viết nút ở từng màn: lặp và dễ sót ở màn đăng ký/đặt lại |
| Bài tập luyện không gắn mục (không vào SRS) | Câu hiểu đoạn văn/gõ theo gợi ý không phải "ghi nhớ một mục" và không khớp giả định 30 giây/mục của lịch ôn | Gắn mục để vào ôn: lịch ôn phải xử lý đoạn văn dài, quỹ thời gian gói ôn sai lệch |

## Rủi ro và điểm cần theo dõi

- **Nội dung là điều kiện cứng**: không có 12 đơn vị đã duyệt thì `validateCatalog` (mỗi trình độ × reading/writing có ≥ 1 bài 5 phút) làm seed thất bại và US2 không phát hành được. Cần chủ dự án xác nhận người biên soạn/duyệt sớm (C2); có thể giảm cam kết còn 1 bài/loại/trình độ (= 6 bài) làm mức tối thiểu ra mắt nhưng vẫn đủ quy tắc danh mục.
- **Thủ tục phạm vi giai đoạn** (C1): kế hoạch đã biện minh nên không chặn thiết kế; nếu chủ dự án muốn sửa hiến pháp thì làm song song, không cần đổi tài liệu thiết kế.
- **Chấm luyện viết dựa trên danh sách đáp án chấp nhận**: bộ chấm không đổi kana↔Kanji nên bài biên soạn thiếu dạng đáp án sẽ chấm sai oan. Giảm bằng danh sách duyệt (PR5 + checklist) và rà soát nội dung; về sau có thể bổ sung chuẩn hóa hiragana↔katakana (ngoài phạm vi bản này).
- **Gõ IME trên Web**: Enter chốt chữ đang soạn có thể kích hoạt "Kiểm tra" trên một số trình duyệt; cần kiểm thử widget mô phỏng `composing` + thử tay với IME thật (QS3, research P6).
- **Enum `Skill` mở rộng làm hỏng client cũ**: chỉ khi người học bật luyện; xử lý bằng phát hành đồng thời client+backend như 004/005.
- **`ctx.profile` hiệu lực bị lọc**: rủi ro nếu có nơi ghi `ctx.profile` ngược vào CSDL (sẽ làm mất `reading/writing` đã lưu). Rà soát khi hiện thực; kiểm thử I4 (hạ rồi nâng phút) bắt lỗi này.
- **Phiên luyện dở dang khi hạ quỹ thời gian**: bị `PRACTICE_LOCKED` ở bước tiếp theo; phiên giữ `in_progress` và tiếp tục được khi nâng lại. Chấp nhận (tình huống hiếm); người học thấy thông báo rõ lý do.
- **Tải của `GET /today`**: thêm năng lực (một truy vấn) và khích lệ (dùng `listActiveDays`, `onTrack` → `rankForContext`); đo p95 ≤ +50 ms. Nếu vượt: chỉ tính `onTrack` khi có `targetDate` và khi trạng thái chưa thuộc `day_completed`/`in_progress`.
- **SC-009 chưa đo tự động** (C8): chưa có nơi ghi đăng nhập thất bại; kế hoạch không thêm bảng, dùng kiểm tay + nhật ký máy chủ nếu có.
- **Giọng điệu khích lệ và độ phủ từ cấm**: bộ từ cấm bắt được từ khóa nhưng không bắt được sắc thái; vì vậy chủ dự án vẫn duyệt tay (QS5, danh sách kiểm tay).
- **Học viên lớp & giáo viên**: API cho phép giáo viên đặt `reading/writing` trong mẫu lộ trình lớp nhưng giao diện giáo viên chưa có lựa chọn (C5); hiệu lực vẫn theo quỹ thời gian ≥ 30 của từng học viên.
