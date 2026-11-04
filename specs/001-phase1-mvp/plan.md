# Kế hoạch triển khai: Giai đoạn 1 – MVP (Ứng dụng web học tiếng Nhật cá nhân hóa)

**Nhánh**: `001-phase1-mvp` | **Ngày**: 2026-11-04 | **Đặc tả**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `specs/001-phase1-mvp/spec.md`

## Tóm tắt

Xây dựng ứng dụng web học tiếng Nhật cá nhân hóa cho người đi làm: đăng ký/đăng nhập, onboarding (kèm bài kiểm tra trình độ tùy chọn), lộ trình riêng cho từng người, kế hoạch hằng ngày vừa quỹ thời gian (5–15 phút/bài), bài học từ vựng và ngữ pháp có bài tập tự chấm, ôn tập lặp lại ngắt quãng, theo dõi tiến độ, tự điều chỉnh kế hoạch, dùng thử không cần đăng ký, quản trị nội dung/người dùng, song ngữ vi/en.

**Cách tiếp cận kỹ thuật** (chi tiết ở [research.md](research.md)):

- **Client**: Flutter (web, desktop-first), kiến trúc phân lớp `domain / data / presentation`, mọi phần đặc thù nền tảng nằm sau abstraction để mở rộng sang mobile (Nguyên tắc V).
- **Backend**: Node.js 22 + TypeScript, Fastify, PostgreSQL 16, REST API mô tả bằng OpenAPI ([contracts/openapi.yaml](contracts/openapi.yaml)); nội dung học là dữ liệu trong CSDL, quản lý qua Admin API (Nguyên tắc VI).
- **Learning Engine**: mô-đun thuần hàm, dựa trên quy tắc (sinh lộ trình, kế hoạch ngày, độ khó thích ứng, SM-2 biến thể cho ôn tập), tách khỏi HTTP/CSDL để kiểm thử bằng hồ sơ người học đại diện (Nguyên tắc II, IV; FR-035).
- **Dùng thử**: không có phiên phía server; nội dung công khai chỉ đọc, trạng thái ở trình duyệt, chấm placement không lưu, giới hạn tần suất theo IP (FR-036 → FR-040).
- **Độ tin cậy dữ liệu**: ghi sự kiện idempotent bằng `client_event_id` + ràng buộc unique (FR-041).

## Bối cảnh kỹ thuật (Technical Context)

**Ngôn ngữ/Phiên bản**: Backend: TypeScript 5.x trên Node.js 22 LTS. Client: Dart 3.x / Flutter (stable) cho web.

**Phụ thuộc chính**: Backend: Fastify, Zod, Drizzle ORM, pg-boss, argon2, jose (JWT), nodemailer, @fastify/rate-limit. Client: Riverpod, go_router, dio, `flutter_localizations`/`intl`.

**Lưu trữ**: PostgreSQL 16 (tài khoản, hồ sơ, nội dung, tiến độ, hàng đợi pg-boss). Trình duyệt: bộ nhớ cục bộ cho phiên dùng thử và token qua abstraction `LocalStore`/`TokenStore`.

**Kiểm thử**: Backend: Vitest (đơn vị engine với hồ sơ đại diện, hợp đồng so với OpenAPI, tích hợp với PostgreSQL qua Testcontainers). Client: `flutter test` + `integration_test` trên Chrome. Tải: k6.

**Nền tảng đích**: Trình duyệt desktop hiện đại (Chrome, Edge, Firefox, Safari); server Linux (Docker). Mobile ngoài phạm vi giai đoạn này nhưng kiến trúc không chặn.

**Loại dự án**: Ứng dụng web (frontend Flutter + backend REST API) với thư mục nội dung riêng.

**Mục tiêu hiệu năng**: Màn hình bài học và phản hồi trả lời xuất hiện < 1 giây đầu-cuối cho 95% tương tác ở tải bình thường = 1.000 người học đồng thời (SC-010), đo phía client bằng `integration_test` trên Chrome trong lúc chạy tải k6; p95 phía server < 500 ms; dùng thử và placement công khai chịu giới hạn tần suất.

**Ràng buộc**: Kế hoạch ngày không vượt quỹ thời gian khai báo (FR-012); mỗi bài học 5–15 phút (FR-017); không lưu dữ liệu định danh khách dùng thử (FR-038); ghi sự kiện idempotent (FR-041); nội dung thay đổi hiển thị với người học ≤ 5 phút mà không phát hành client (SC-008).

**Quy mô/Phạm vi**: Hàng trăm đến vài nghìn người học đồng thời; thư viện nội dung ban đầu từ vựng + ngữ pháp N5–N3; ~15 màn hình người học + ~6 màn hình quản trị; 2 ngôn ngữ giao diện.

## Kiểm tra hiến pháp (Constitution Check)

*CỔNG: Phải đạt trước Phase 0. Kiểm tra lại sau Phase 1.*

Đánh giá theo [hiến pháp](../../.specify/memory/constitution.md) v1.0.0:

| Nguyên tắc / ràng buộc | Đánh giá trước Phase 0 | Đánh giá sau thiết kế Phase 1 |
|---|---|---|
| I. Micro-Learning First | ĐẠT – đặc tả ràng buộc 5–15 phút và FR-012 | ĐẠT – "phiên học" là một bài học/đơn vị 5–15 phút; kế hoạch ngày 30 phút gồm nhiều phiên như vậy, mỗi phiên hoàn thành được trong một lần ngồi; `est_minutes ∈ {5,10,15}` (CHECK DB), `estimated_minutes ≤ budget_minutes` (CHECK DB), mỗi gói ôn `review_batch` ≤ 15 phút (CHECK DB trên `daily_plan_items.est_minutes`, chia gói theo `REVIEW_SECONDS_PER_ITEM`), quy tắc nội dung bắt buộc có đơn vị 5 phút cho mỗi trình độ × kỹ năng (R7, R13) |
| II. Personalized Learning Engine | ĐẠT – FR-010 → FR-015 | ĐẠT – engine sinh lộ trình từ hồ sơ + placement, không lộ trình cố định; đơn vị học rời rạc phân bổ động; điều chỉnh độ khó và tăng tần suất ôn (R6, R7) |
| III. Learner Control | ĐẠT – FR-006, FR-016 | ĐẠT – các endpoint `/path/*`, `/me` PATCH, bỏ qua placement, xây dựng lại (openapi) |
| IV. Evidence-Based Methods | ĐẠT – FR-023 → FR-029 | ĐẠT – SM-2 biến thể điều khiển bởi kết quả đúng/sai đã ghi; học bằng làm; tiến độ hiển thị |
| V. Cross-Platform, Web-First | ĐẠT – Flutter, web desktop | ĐẠT – client phân lớp, `lib/platform/` cô lập đặc thù nền tảng; API bearer-token dùng được cho mobile sau này |
| VI. Separated Architecture | ĐẠT – REST + nội dung là dữ liệu | ĐẠT – backend/ client/ content/ tách biệt, hợp đồng OpenAPI, nội dung quản lý qua Admin API không cần phát hành client |
| Phạm vi theo giai đoạn | ĐẠT – chỉ Giai đoạn 1 | ĐẠT – không xây Kanji, nghe/đọc, AI nâng cao, mobile, đồng bộ, thông báo, AI tutor |
| Kiểm thử engine bằng hồ sơ đại diện | Cam kết | ĐẠT – R15, thư mục `backend/tests/fixtures/learner-profiles/` |
| Thay đổi hợp đồng/schema được ghi nhận | Cam kết | ĐẠT – `contracts/openapi.yaml` có phiên bản và nhật ký thay đổi trong `info.description`; migration SQL tường minh; sửa nội dung chỉ vô hiệu hóa mềm mục/bài tập, không xóa cứng dữ liệu đã có lịch sử (data-model §2.10) |
| Độ phức tạp phải biện minh | Cam kết | ĐẠT – không thêm dịch vụ ngoài PostgreSQL (hàng đợi dùng pg-boss thay Redis); xem Theo dõi độ phức tạp |

**Kết luận**: Không có vi phạm; không cần mục Theo dõi độ phức tạp ở mức vi phạm. Phần "Độ phức tạp đã cân nhắc" bên dưới ghi nhận các quyết định có chi phí.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/001-phase1-mvp/
├── plan.md              # Tệp này (/speckit-plan)
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── openapi.yaml     # Phase 1 – hợp đồng REST
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks – KHÔNG do /speckit-plan tạo)
```

### Mã nguồn (thư mục gốc kho mã)

```text
backend/
├── src/
│   ├── api/                 # Route Fastify theo miền: auth, account, trial, onboarding,
│   │                        #   path, daily, progress, admin; middleware (auth, role, rate-limit)
│   ├── engine/              # Learning Engine thuần hàm (không phụ thuộc HTTP/DB)
│   │   ├── placement.ts     #   chấm và ước tính trình độ
│   │   ├── path.ts          #   sinh lộ trình
│   │   ├── daily-plan.ts    #   kế hoạch ngày theo quỹ thời gian
│   │   ├── srs.ts           #   lặp lại ngắt quãng (SM-2 biến thể)
│   │   ├── difficulty.ts    #   điều chỉnh độ khó, điểm yếu
│   │   └── clock.ts         #   Clock/ngày địa phương, tiêm vào để kiểm thử
│   ├── domain/              # Kiểu, quy tắc nghiệp vụ, kiểm tra nội dung
│   ├── db/                  # Schema Drizzle, migration SQL, repository
│   ├── services/            # Điều phối: auth, account-deletion, content, progress, email
│   ├── jobs/                # pg-boss: gửi email, xóa vĩnh viễn sau 30 ngày
│   ├── reports/             # Truy vấn báo cáo chỉ số sản phẩm (SC-003, SC-009, SC-011)
│   └── seed/                # Nạp nội dung từ ../content; lệnh `admin:create` cấp quyền admin (FR-004)
└── tests/
    ├── unit/                # Engine, quy tắc nội dung
    ├── contract/            # So khớp với contracts/openapi.yaml
    ├── integration/         # PostgreSQL thật; kịch bản đồng thời, xóa tài khoản
    ├── load/                # Kịch bản tải k6 (SC-010)
    └── fixtures/
        └── learner-profiles/  # Hồ sơ người học đại diện dùng chung (FR-035)

client/                      # Flutter (web trước)
├── lib/
│   ├── domain/              # Thực thể, giao diện repository (không phụ thuộc Flutter)
│   ├── data/                # API client (sinh từ OpenAPI), repository, hàng đợi sự kiện ngoại tuyến-ngắn
│   ├── platform/            # Giao diện nền tảng: TokenStore, LocalStore, Timezone, Links
│   │   └── web/             #   triển khai web (Android/iOS thêm sau cùng giao diện)
│   ├── presentation/
│   │   ├── auth/ onboarding/ placement/ today/ lesson/ review/
│   │   ├── path/ progress/ profile/ trial/ admin/
│   │   └── shared/          # Widget dùng chung, theme
│   ├── l10n/                # app_vi.arb (mặc định), app_en.arb
│   └── main.dart
└── test/ , integration_test/

content/                     # Nội dung gốc dạng dữ liệu, độc lập với mã
├── schema/                  # JSON Schema cho đơn vị học, mục, bài tập, câu hỏi placement
├── units/                   # Đơn vị từ vựng/ngữ pháp N5–N3 (vi + en)
└── placement/               # Bộ 20 câu kiểm tra trình độ (8 N5, 6 N4, 6 N3)

docker-compose.yml           # db, mailpit (dev), api
```

**Quyết định cấu trúc**: Ứng dụng web có frontend và backend tách biệt (Nguyên tắc VI) cộng thư mục `content/` làm nguồn dữ liệu nội dung. Engine nằm trong backend vì cần dữ liệu tin cậy và đồng bộ giữa các thiết bị trong tương lai; giữ nó thuần hàm để có thể di chuyển hoặc dùng chung nếu cần. Giao diện quản trị nằm trong cùng ứng dụng Flutter (route `/admin/*`), bảo vệ thực sự ở server.

## Độ phức tạp đã cân nhắc

Không có vi phạm hiến pháp. Các thành phần có chi phí được chấp nhận:

| Quyết định | Lý do cần | Phương án đơn giản hơn bị bác vì |
|---|---|---|
| pg-boss (hàng đợi trên PostgreSQL) | Gửi email có thử lại và job xóa sau 30 ngày | Cron + script khó quan sát/thử lại; Redis/BullMQ thêm một dịch vụ cần vận hành |
| Ảnh chụp (snapshot) bài tập trong `lesson_sessions` | Phiên đang học không bị gián đoạn khi admin sửa nội dung (trường hợp biên) | Đọc trực tiếp nội dung hiện hành sẽ đổi bài tập giữa chừng |
| Nội dung song ngữ trong JSONB `i18n_text` | FR-019a: vi + en ngay từ đầu, thêm ngôn ngữ sau không đổi schema | Bảng dịch riêng phức tạp hơn nhiều cho quy mô này |
| Client sinh `client_event_id` | Idempotent cho đa cửa sổ và thử lại sau mất kết nối (FR-041, SC-012) | Khóa theo (phiên, bài tập) không bao phủ thời gian học và thử lại có chủ đích |

## Rủi ro và điểm cần theo dõi

- **Biên soạn nội dung N5–N3 song ngữ** là công việc lớn, nằm trên đường găng của SC-002/SC-004; cần ưu tiên đủ nội dung N5 và tập 5 phút cho mỗi trình độ × kỹ năng trước khi demo.
- **Chất lượng quy tắc engine** (ngưỡng 60%/90%, hệ số SM-2) cần hiệu chỉnh sau dữ liệu thật; ngưỡng đặt ở cấu hình để chỉnh không cần phát hành.
- **Token ở trình duyệt** (không dùng cookie httpOnly) phụ thuộc CSP chặt chẽ chống XSS; xem R4, R16.
- **Vô hiệu hóa tài khoản không tức thời**: refresh token bị thu hồi ngay, nhưng access token đã cấp còn hiệu lực tối đa 15 phút vì middleware không tra trạng thái tài khoản ở mỗi request (rủi ro được chấp nhận, đổi lấy middleware không trạng thái); xem R4.
- **Lộ trình tính động**: thứ tự đơn vị được tính lại mỗi lần `GET /path`/sinh kế hoạch thay vì lưu sẵn; chi phí nhỏ ở quy mô nội dung N5–N3 nhưng cần theo dõi khi thư viện nội dung lớn lên (có thể thêm bộ đệm theo người học); xem R7, R17.
- **Giới hạn tần suất theo IP** có thể chặn nhầm người dùng chung IP văn phòng; ngưỡng cấu hình được.
