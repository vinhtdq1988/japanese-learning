# Kế hoạch triển khai: Tổ chức, Lớp học và Lộ trình lớp (B2B theo seat)

**Nhánh**: `004-org-classes` (tên thư mục tính năng; nhánh git hiện tại là `master`) | **Ngày**: 2026-11-07 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/004-org-classes/spec.md` (Giai đoạn 1.5 theo hiến pháp v1.2.0)

## Tóm tắt

Thêm lớp quản lý tổ chức cho trung tâm tiếng Nhật vào hệ thống đã hoàn tất (001 MVP + 003 Kanji): quản trị viên hệ thống cấp tổ chức, giấy phép và seat thủ công; chủ tổ chức mời giáo viên; giáo viên tạo lớp, đưa học viên vào bằng lời mời email / mã tham gia / CSV, đặt **lộ trình lớp** (mẫu đơn giản, sau đó chọn bài, ngày mở, bài giao, ghi đè cá nhân, tạm dừng) và theo dõi bảng điều khiển, cảnh báo, điểm yếu chung, xuất CSV, kiểm tra trình độ cho cả lớp. Học viên **tự chọn** theo lộ trình lớp (thấy rõ dữ liệu chia sẻ, có thể từ chối) hoặc ở lộ trình cá nhân, và chuyển qua lại bất cứ lúc nào; khi thuộc lớp các quyền cá nhân bị khóa, kế hoạch hằng ngày vẫn do Learning Engine sinh riêng cho từng người trong quỹ thời gian của lớp. Người học không thuộc lớp không bị thay đổi gì.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Không sửa hồ sơ/lộ trình cá nhân**: một dịch vụ `resolveLearningContext` quyết định nguồn học (cá nhân hay lớp) và chồng lên hồ sơ cá nhân một "hồ sơ hiệu lực" trong bộ nhớ (số phút, kỹ năng, tạm dừng của lớp); rời lớp = đóng thành viên, mọi thứ cá nhân tự nguyên vẹn (O6).
- **Tái dùng engine**: lộ trình lớp là tham số mẫu → `PathParams` → `rankUnits`/`planDailyPlan`/`applyKanjiSlot`/SRS không đổi chữ ký; thêm các hàm thuần `engine/class-path.ts`, `class-progress.ts`, `seats.ts` (O7, O10).
- **Phân quyền tra CSDL mỗi request** (không vào JWT) với 404 chung cho đối tượng ngoài phạm vi ⇒ cô lập tổ chức và hiệu lực tức thì (O2); ma trận quyền là dữ liệu dùng sinh kiểm thử ([permissions-matrix.md](contracts/permissions-matrix.md)).
- **Seat theo dòng** + giữ chỗ theo đếm + khóa theo tổ chức; vòng đời hết hạn vừa lười vừa job định kỳ (O3).
- **Dữ liệu bảng điều khiển là dẫn xuất** từ bản ghi học tập sẵn có, cắt theo `joined_at`, gộp theo lô; học viên thấy cùng số liệu qua "Lớp của tôi" (O11).
- **Hợp đồng**: OpenAPI 1.11.0 → 1.12.0 (bổ sung), mã lỗi mới, CSV có BOM + chống công thức (O5, O17; [contracts/](contracts/)).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend TypeScript 5.x trên Node.js 22 LTS; client Dart 3.x / Flutter stable (web) – không đổi so với 001/003.

**Phụ thuộc chính**: Không thêm phụ thuộc chạy. Backend: Fastify, Zod, Drizzle ORM, ajv, pg-boss, jose, nodemailer, @fastify/rate-limit (đã có). CSV tự phân tích trong `domain/csv.ts` (O5). Client: Riverpod, go_router, dio, API client sinh bằng openapi-generator `dart-dio`. Yêu cầu hạ tầng mới duy nhất: extension PostgreSQL `btree_gist` (đi kèm bản phân phối chuẩn, "trusted" từ PG 13).

**Lưu trữ**: PostgreSQL 16; migration mới `0004_org_classes.sql` (một file, không đổi enum có sẵn) – [data-model.md §9](data-model.md#9-migration-0004_org_classessql). 16 bảng mới, 2 bảng cũ thêm cột `NULL`.

**Kiểm thử**: Vitest (đơn vị engine/seat/CSV với hồ sơ đại diện mới; hợp đồng OpenAPI 1.12.0 + **ma trận quyền sinh từ dữ liệu**; tích hợp PostgreSQL qua Testcontainers cho vòng đời, đồng thời, bảng điều khiển, hiệu năng; golden hồi quy người học không thuộc lớp); `flutter test` (khóa điều khiển, hai lựa chọn, bảng điều khiển, song ngữ).

**Nền tảng đích**: Trình duyệt desktop (Chrome, Edge, Firefox, Safari); server Linux (Docker) – không đổi. Bảng điều khiển giáo viên tối ưu desktop (spec, Giả định).

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST) với thư mục nội dung `content/` – mở rộng dự án hiện có; **không đổi nội dung học** (giáo viên chỉ chọn bài trong thư viện sẵn có).

**Mục tiêu hiệu năng**: Bảng điều khiển lớp 50 học viên ≤ 3 giây (SC-006) bằng truy vấn gộp theo lô trên chỉ mục sẵn có (O11), kèm kiểm thử đo; thêm 1 truy vấn khóa chính cho mỗi request tổ chức. Không thêm mục tiêu cho đường dẫn người học (kế hoạch ngày thêm vài truy vấn nhỏ chỉ khi thuộc lớp).

**Ràng buộc**: kế hoạch ngày không vượt quỹ và mỗi mục ≤ 15 phút kể cả trong lớp (FR-019, SC-003); người học không thuộc lớp không đổi (FR-041, SC-012); không bao giờ vượt số seat dưới đồng thời (FR-005); mất quyền xem dữ liệu tức thì (FR-037, SC-008); không có endpoint trả từng câu trả lời (FR-035); song ngữ vi/en (FR-042).

**Quy mô/Phạm vi**: Khách đầu tiên là một trung tâm: vài chục giáo viên, ≤ 100 học viên/lớp, vài chục lớp; thiết kế không giả định một tổ chức duy nhất. ~16 màn hình client mới + 3 màn hình cũ thay đổi (điều chỉnh kế hoạch, hồ sơ, onboarding, Hôm nay), 2 ngôn ngữ giao diện.

Không còn mục NEEDS CLARIFICATION (đã giải quyết trong [research.md](research.md)); các giả định cần chủ dự án biết nằm ở mục "Điểm cần xác nhận" của research.

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.2.0 (sửa đổi 2026-11-07: thêm mô-đun "Organization & Class Management", Giai đoạn 1.5, và làm rõ Nguyên tắc III về lớp học của tổ chức):

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – FR-019, SC-003 | ĐẠT – `class_paths.daily_minutes` và ghi đè cá nhân bị `CHECK ∈ {5,10,15,30}`; kế hoạch vẫn do `planDailyPlan` (trần quỹ, 60% ôn, mục ≤ 15 phút) sinh với `budgetMinutes` của lớp; kiểm thử 5/10/15/30 phút (O7, O19) |
| II. Personalized Learning Engine | ĐẠT – spec nêu rõ lộ trình lớp chỉ áp cho học viên thuộc lớp, kế hoạch riêng từng người | ĐẠT – lộ trình lớp là **tham số mẫu tính động**, không bản sao cố định; thứ tự trong chế độ mẫu vẫn thích ứng theo mảng yếu/độ khó từng người; SRS, độ khó thích ứng, cân đối sau gián đoạn giữ nguyên; người không thuộc lớp vẫn dùng lộ trình cá nhân (O6, O7) |
| III. Learner Control | ĐẠT CÓ ĐIỀU KIỆN – v1.2.0 cho phép tạm khóa khi người học **tự chọn** vào lớp, kèm 4 điều kiện | ĐẠT CÓ ĐIỀU KIỆN – (a) thấy rõ điều kiện trước khi đồng ý: `GET /invitations/{t}` & `POST /me/class/join` trả `disclosure` + hai lựa chọn ngang nhau, tính seat chỉ sau `confirmed:true` (O4, FR-016, SC-013); (b) từ chối lời mời không tốn seat, không đổi hồ sơ; (c) rời lớp bất cứ lúc nào (`POST /me/class/leave`) nhận lại toàn bộ quyền vì hồ sơ/lộ trình cá nhân không bị sửa (O6); (d) không có đường nào thêm học viên vào lớp mà không qua xác nhận của họ (CSV/mã/mời đều chỉ tạo lời mời hoặc yêu cầu xác nhận). (e) *chuyển lớp trong cùng tổ chức* cần học viên **đồng ý lại**: chủ dự án đã chọn "bắt học viên đồng ý lại" (research "Điểm cần xác nhận" #1) nên giáo viên chỉ MỜI chuyển lớp, học viên chấp nhận thì mới chuyển; không còn điều kiện treo |
| IV. Evidence-Based Learning Methods | ĐẠT – giữ SRS, tiến độ | ĐẠT – ôn tập đến hạn vẫn chèn theo SRS trong lớp (FR-019); tiến độ và điểm yếu hiển thị cho học viên ("Lớp của tôi") và giáo viên; không đổi lịch ôn khi vào/rời lớp (O6, O11) |
| V. Cross-Platform, Web-First | ĐẠT – Flutter web | ĐẠT – mọi quy tắc nghiệp vụ ở backend; tải/lưu CSV đi qua giao diện `lib/platform/file_transfer.dart` (cài đặt web trong `platform/web/`), không dùng API trình duyệt ngoài `platform/`; token bearer không đổi (O18) |
| VI. Separated Architecture | ĐẠT – REST + dữ liệu trong CSDL | ĐẠT – tổ chức/lớp/seat là dữ liệu backend; hợp đồng OpenAPI 1.12.0 tường minh; nội dung học không đổi và không nhúng vào client; vai trò tổ chức được kiểm ở server, giao diện chỉ ẩn/hiện (O2) |
| Phạm vi theo giai đoạn | ĐẠT – Giai đoạn 1.5 (v1.2.0) | ĐẠT – chỉ tổ chức, seat thủ công, lớp, lộ trình lớp, theo dõi lớp; **không** thanh toán/hóa đơn, nội dung riêng của tổ chức, push/email cảnh báo giáo viên, SSO/nhân sự, mobile, nhiều cấp tổ chức, chế độ lai, chấm bài viết/hội thoại (spec "Ngoài phạm vi") |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết (FR-043) | ĐẠT – 7 hồ sơ lớp mới + golden hồi quy hồ sơ cũ (O19) |
| Thay đổi hợp đồng/schema được ghi nhận, không phá dữ liệu | Cam kết | ĐẠT – OpenAPI 1.12.0 (bổ sung), nhật ký trong `info.description`; migration chỉ thêm bảng/cột `NULL`; `placement_results` và `admin_action_logs` chỉ thêm cột tùy chọn |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – 16 bảng mới do miền mới (không có cách gọn hơn); các quyết định có chi phí ghi ở "Theo dõi độ phức tạp" bên dưới |

**Kết luận**: Cổng ĐẠT trước Phase 0 và sau thiết kế Phase 1; không có vi phạm cần biện minh. Điểm duy nhất từng cần chủ dự án xác nhận (chuyển lớp — Nguyên tắc III) đã được quyết định: **học viên phải đồng ý lại** nên không còn điều kiện treo.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/004-org-classes/
├── plan.md                       # Tệp này (/speckit-plan)
├── research.md                   # Phase 0 – quyết định O1…O20 + điểm cần xác nhận
├── data-model.md                 # Phase 1 – bảng/ràng buộc/chuyển trạng thái/công thức dẫn xuất
├── quickstart.md                 # Phase 1 – kịch bản kiểm chứng OG1…OG8
├── contracts/
│   ├── api-changes.md            # Phase 1 – OpenAPI 1.11.0 → 1.12.0 (áp vào specs/001-phase1-mvp/contracts/openapi.yaml)
│   ├── permissions-matrix.md     # Phase 1 – ma trận vai trò × route (nguồn của kiểm thử SC-004)
│   └── csv-formats.md            # Phase 1 – CSV nhập/xuất, chống công thức
├── checklists/
│   └── requirements.md
└── tasks.md                      # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã) – các vị trí thay đổi

```text
backend/
├── src/
│   ├── api/
│   │   ├── middleware/org-auth.ts        # mới: loadOrgContext, requireOrgOwner/ClassManager/DataAccess (404 chung)
│   │   ├── admin/organizations.ts        # mới: /admin/organizations* (tổ chức, giấy phép, seat)
│   │   ├── org.ts                        # mới: /org* (tổng quan, giáo viên, seat)
│   │   ├── classes.ts                    # mới: lớp, thành viên, lời mời, mã tham gia, CSV
│   │   ├── class-path.ts                 # mới: lộ trình lớp, bài giao, ghi đè, tạm dừng
│   │   ├── class-reports.ts              # mới: dashboard, chi tiết, điểm yếu, xuất CSV, yêu cầu kiểm tra
│   │   ├── invitations.ts                # mới: /invitations/{token}*
│   │   ├── my-class.ts                   # mới: /me/class* (join, xem, rời lớp)
│   │   ├── account.ts, path.ts, onboarding.ts, placement.ts  # gọi assertNotClassManaged / classRequestId
│   │   └── routes.ts                     # đăng ký nhóm route mới; content-type parser text/csv
│   ├── engine/
│   │   ├── class-path.ts                 # mới: classPathParams, rankClassUnits, computeFeasibility (thuần hàm)
│   │   ├── class-progress.ts             # mới: expectedRatio, progressStatus, alerts, assignmentState (thuần hàm)
│   │   ├── seats.ts                      # mới: chọn seat (ưu tiên người cũ, giới hạn đổi), availableSeats (thuần hàm)
│   │   ├── daily-plan.ts, path.ts        # KHÔNG đổi chữ ký (tái dùng)
│   ├── domain/
│   │   ├── csv.ts                        # mới: parseCsv, csvCell (chống công thức)
│   │   ├── org-types.ts                  # mới: hằng, SHARED_DATA_V1, CLASS_LOCKED_PROFILE_FIELDS, outcome CSV
│   │   ├── org-validation.ts             # mới: Zod cho body các route mới
│   │   └── types.ts                      # + mã lỗi CLASS_MANAGED, SEAT_*, CLASS_*, INVITEE_UNAVAILABLE
│   ├── db/
│   │   ├── migrations/0004_org_classes.sql
│   │   ├── schema.ts                     # + bảng mới, cột mới
│   │   └── repositories/                 # mới: organizations, seats, invitations, classes, class-memberships,
│   │                                     #   class-paths, class-stats, class-pauses, join-code-attempts
│   ├── services/
│   │   ├── learning-context.ts           # mới: resolveLearningContext + effectiveProfile (điểm duy nhất chọn nguồn học)
│   │   ├── org-access.ts, org-seats.ts, org-admin.ts, org-members.ts, org-lifecycle.ts
│   │   ├── classes.ts, class-members.ts, invitations.ts, join-code.ts, class-csv.ts
│   │   ├── class-path.ts, class-adjustments.ts, class-dashboard.ts, class-placement.ts, org-emails.ts
│   │   ├── daily-plan.ts, path.ts, progress.ts, lesson-session.ts   # SỬA: dùng resolveLearningContext
│   │   ├── profile.ts, onboarding.ts, placement.ts, account.ts      # SỬA: khóa lớp, classRequestId, hook xóa tài khoản
│   ├── jobs/org-lifecycle.ts             # mới: queue `org-lifecycle` (cron hằng giờ)
│   ├── config.ts                         # + biến cấu hình O16
│   └── reports/product-metrics.sql       # + SC-010
└── tests/
    ├── unit/                             # class-path, class-progress, class-feasibility, seat-allocation, csv,
    │                                     #   org-regression-golden
    ├── contract/                         # org-authz-matrix, org-us1…org-us8 (theo câu chuyện)
    ├── integration/                      # org-seats, org-concurrency, org-invitations, join-code, class-managed-lock,
    │                                     #   class-lifecycle, class-dashboard, class-csv-import/export, migration (mở rộng)
    └── fixtures/
        ├── learner-profiles/class-*.json
        ├── authz-matrix.json             # sinh/đối chiếu từ contracts/permissions-matrix.md
        └── golden/plans-pre-org.json     # ảnh chụp người học cá nhân, sinh TRƯỚC khi đổi dịch vụ

client/
├── lib/
│   ├── data/api/generated/               # sinh lại từ OpenAPI 1.12.0
│   ├── data/                             # + org_repository.dart, class_repository.dart, classroom_repository.dart
│   ├── platform/file_transfer.dart       # mới: giao diện pickCsv/saveCsv; platform/web/ cài đặt
│   ├── presentation/
│   │   ├── classroom/                    # mới: lời mời (2 lựa chọn + dữ liệu chia sẻ), nhập mã, Lớp của tôi, LockedControl
│   │   ├── teacher/                      # mới: danh sách lớp, chi tiết lớp, lộ trình lớp, dashboard, học viên, điểm yếu
│   │   ├── org/                          # mới: tổng quan chủ tổ chức (seat, giáo viên)
│   │   ├── admin/admin_orgs_screen.dart  # mới: tổ chức/giấy phép/seat (quản trị viên hệ thống)
│   │   ├── path/plan_adjust_screen.dart, profile/, onboarding/, today/   # SỬA: khóa + onboarding rút gọn + nhãn bài giao
│   │   └── shared/                       # + widget khóa, bảng có sắp xếp/lọc
│   ├── router.dart, router_paths.dart    # + tuyến /classes, /org, /my-class, /invite/:token; guard theo vai trò
│   └── l10n/app_vi.arb, app_en.arb
└── test/
```

**Quyết định cấu trúc**: Giữ nguyên ba phần `backend/`, `client/`, `content/` (Nguyên tắc VI); không thêm dự án, dịch vụ hay thư viện. Quy tắc quyết định (seat, lộ trình lớp, trạng thái tiến độ, CSV) nằm ở `engine/` + `domain/` thuần hàm để kiểm thử bằng hồ sơ đại diện; phần có trạng thái ở `services/` + `db/repositories/`; mọi repository tổ chức bắt buộc nhận `organizationId` (O2).

## Thứ tự triển khai đề xuất

0. **Chụp ảnh golden trước khi sửa dịch vụ**: `tests/fixtures/golden/plans-pre-org.json` (kế hoạch 14 ngày, `GET /path`, `GET /progress` của mọi hồ sơ hiện có) – chuẩn so sánh cho SC-012; dựng khung `authz-matrix.json` (test đỏ nếu route thiếu dòng).
1. **Nền tảng** (chặn mọi câu chuyện): migration 0004 + `schema.ts`, `config.ts`, mã lỗi, `domain/csv.ts`, `engine/seats.ts`, `loadOrgContext` + middleware 404 chung, repository khung, `org-emails`.
2. **US1 (P1)**: quản trị viên tạo tổ chức/giấy phép/seat; chủ tổ chức; mời giáo viên; vòng đời hết hạn (lười + job); ma trận quyền cho nhóm route này.
3. **US3-lõi + US2 + FR-016/FR-037 (P1, cùng một lát MVP)**: `resolveLearningContext`, `engine/class-path.ts`, khóa `CLASS_MANAGED`, lộ trình lớp theo mẫu → lớp, mã/lời mời/CSV, **hai lựa chọn + thông báo dữ liệu chia sẻ**, "Lớp của tôi" tối thiểu và `leave`. *Không phát hành tạo lớp/mời học viên khi thiếu FR-016/FR-037* (điều kiện hiến pháp III).
4. **US4 (P2)**: `class-progress`, `class-stats`, bảng điều khiển + chi tiết học viên; khối "tiến độ trong lớp".
5. **US5 (P2)**: chế độ liệt kê/ngày mở/bài giao/cảnh báo khả thi/ghi đè/miễn bài/tạm dừng; thông báo đơn vị bị vô hiệu hóa.
6. **US6 (P2) phần còn lại**: hết hạn/ân hạn/vô hiệu hóa tổ chức/xóa tài khoản/gỡ giáo viên với hiệu lực tức thì; vào lại lớp.
7. **US7 (P3)**: cảnh báo, điểm yếu lớp, xuất CSV.
8. **US8 (P3)**: yêu cầu kiểm tra trình độ cho lớp, mời chuyển lớp (chủ dự án đã chọn "học viên đồng ý lại", điểm #1).
9. Báo cáo chỉ số SC-010; rà soát l10n; chạy lại golden + ma trận quyền toàn bộ.

## Theo dõi độ phức tạp

| Sai lệch / quyết định có chi phí | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| Dòng `seats` riêng + exclusion constraint `btree_gist` trên giấy phép | Giới hạn đổi người giữ **theo seat**, "quay lại không tính đổi", một tài khoản một seat bằng ràng buộc CSDL, giấy phép không chồng ngày (FR-004/005) | Chỉ đếm `used/total` không diễn đạt được đếm đổi người; exclusion thay cho kiểm tra ứng dụng dễ sót khi đồng thời |
| Vai trò tổ chức tra CSDL mỗi request, không vào JWT | Mất quyền xem dữ liệu tức thì, kể cả phiên đang mở (FR-037, SC-008) | Đưa vào JWT chịu độ trễ tới 15 phút của R4; rút ngắn TTL cho mọi người dùng là thay đổi quá rộng |
| Lớp phủ `resolveLearningContext` (hồ sơ hiệu lực trong bộ nhớ) | Giữ nguyên hồ sơ/lộ trình cá nhân để "tạm ngưng không xóa", khôi phục khi rời lớp, không di trú dữ liệu | Cờ/sao chép lộ trình theo học viên trái FR-017 và phải đồng bộ hàng loạt khi đổi lớp/rời lớp |
| Bộ phân tích/viết CSV tự cài (`domain/csv.ts`) | Tránh phụ thuộc mới cho nhu cầu nhỏ; kiểm soát chính xác chống công thức và BOM | Thư viện CSV là phụ thuộc mới + vẫn phải tự viết lớp chống công thức |
| Job `org-lifecycle` (pg-boss) bên cạnh xử lý lười | Dữ liệu nhất quán khi không ai truy cập; đã có hạ tầng pg-boss | Chỉ lười: tổ chức không ai dùng giữ seat/lời mời quá hạn vô thời hạn; chỉ job: quyền còn tới 1 giờ sau hạn, trái SC-008 |
| Dẫn xuất bảng điều khiển bằng truy vấn gộp (không bảng tổng hợp) | Nhất quán tuyệt đối với màn hình học viên (FR-030), không có nguồn dữ liệu thứ hai để lệch | Bảng số liệu lưu sẵn cần cập nhật theo từng câu trả lời và dễ lệch; chỉ cân nhắc nếu đo thấy chậm ở lớp 100 |
| Kết quả kiểm tra của lớp lưu `is_current=false` + cột liên kết yêu cầu | Không đổi kết quả hiện hành/lộ trình cá nhân (FR-034) | Dùng `is_current=true` làm đổi điểm xuất phát cá nhân khi rời lớp |

## Rủi ro và điểm cần theo dõi

- **Hiệu lực quyền tức thì dựa vào kỷ luật mã**: mọi route tổ chức phải đi qua `loadOrgContext` và mọi repository phải lọc `organizationId`; ma trận quyền tự sinh (test đỏ nếu thiếu dòng) và snapshot khóa DTO là lưới an toàn chính (SC-004). Ưu tiên viết trước khi làm các câu chuyện.
- **Ghi vào đường đọc**: `loadOrgContext`/`resolveLearningContext` có thể kích hoạt `processOrgLapse` (ghi) khi phát hiện hết hạn; phải idempotent và dùng khóa advisory để không đua với job/người dùng khác.
- **Đồng thời về sức chứa**: gửi/chấp nhận lời mời, gán seat, chỉnh giấy phép đều khóa `organizations`; kiểm thử đồng thời bắt buộc (`org-concurrency.test.ts`). Gán seat có thể thất bại do `SEAT_REASSIGN_LIMIT` dù đếm cho thấy còn chỗ – thông báo phải rõ và quản trị viên nâng giới hạn được.
- **Công thức khả thi của spec (FR-025)** lấy `ngày còn lại × phút/ngày` và bỏ qua phần quỹ (đến 60%) có thể dành cho ôn; cảnh báo có thể quá lạc quan. Phản hồi trả kèm `capacityMinutes` để giao diện nêu rõ; hiệu chỉnh sau khi chạy thử với khách đầu tiên.
- **Mốc tiến độ tuyến tính** (O10) là quy tắc khởi đầu; chế độ liệt kê có ngày mở không đều có thể làm "mong đợi" lệch so với thực tế dạy trên lớp. Theo dõi `behind` giả ở lớp thử nghiệm và hiệu chỉnh `CLASS_PROGRESS_MARGIN_PCT` hoặc chuyển sang mong đợi theo ngày mở.
- **Hiệu năng bảng điều khiển ở lớp 100 học viên** nhiều tháng dữ liệu: hợp khoảng thời gian tính trong TS trên tập khoảng đã lọc; có thể phải thêm chỉ mục `study_records(user_id, occurred_at)` hoặc tính trước theo ngày (xem data-model §7).
- **Chuyển lớp** (Nguyên tắc III): đã quyết định học viên PHẢI đồng ý lại (mời chuyển lớp, 202); quyền của người mời được kiểm lại lúc học viên chấp nhận.
- **Client cũ (1.11.0)** không hiển thị khóa lớp: phát hành client và backend cùng lúc; trình duyệt giữ bản cũ trong bộ đệm có thể cho học viên thuộc lớp thấy điều khiển cá nhân (máy chủ vẫn từ chối bằng `CLASS_MANAGED`).
- **Tài khoản khôi phục sau xóa** không khôi phục tư cách thành viên lớp (O15): phải được mời lại – cần nêu trong thông báo xóa tài khoản của người đang thuộc lớp.
- **Lời mời gửi tới email có tài khoản ở tổ chức khác** trả `INVITEE_UNAVAILABLE`: cho biết "email này đã có tài khoản không thể mời" (rò rỉ tối thiểu, đã có sẵn ở đăng ký trùng email); không nêu tên tổ chức.
- **Múi giờ**: ngày giấy phép theo `ORG_TIMEZONE` (Việt Nam), ngày học theo múi giờ từng học viên; kiểm thử ranh giới ngày với Clock giả.
