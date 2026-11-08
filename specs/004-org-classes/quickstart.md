# Hướng dẫn kiểm chứng: Tổ chức, Lớp học và Lộ trình lớp

**Nhánh**: `004-org-classes` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/api-changes.md](contracts/api-changes.md)

Tài liệu này mô tả các kịch bản chạy được để chứng minh tính năng hoạt động đầu-cuối. Cài đặt môi trường, biến môi trường và lệnh chung xem [quickstart 001](../001-phase1-mvp/quickstart.md); ở đây chỉ nêu phần khác. Chi tiết dữ liệu xem [data-model.md](data-model.md), không lặp lại ở đây.

## 1. Chuẩn bị

```bash
docker compose up -d db mailpit
cd backend
pnpm install
pnpm db:migrate     # chạy thêm 0004_org_classes.sql (cần extension btree_gist)
pnpm seed           # nội dung 001/003 là đủ; tạo admin dev (chỉ khi NODE_ENV != production)
pnpm dev            # http://localhost:3000 ; hộp thư thử: http://localhost:8025

cd ../client
# sinh lại API client từ OpenAPI 1.12.0: làm đúng các bước trong client/lib/data/api/README.md
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

**Tài khoản thử** (đăng ký qua giao diện hoặc `POST /auth/register`; mật khẩu tùy ý ≥ 8 ký tự):

| Vai trò | Email gợi ý |
|---|---|
| Quản trị viên hệ thống | admin dev do `pnpm seed` tạo (hoặc `pnpm admin:create --email admin@example.com`) |
| Chủ tổ chức | `owner@trungtam.example` |
| Giáo viên | `gv1@trungtam.example`, `gv2@trungtam.example` |
| Học viên | `hv1@…` đến `hv5@…` (một người đã học cá nhân vài ngày trước khi vào lớp) |

**Kết quả mong đợi** sau migrate: bảng mới có mặt; `SELECT count(*) FROM learning_paths` và kế hoạch của người học cũ không đổi; `placement_results.class_placement_request_id` NULL cho dòng cũ.

## 2. Kịch bản kiểm chứng

Mỗi kịch bản ánh xạ câu chuyện người dùng trong [spec.md](spec.md); các bước API dùng token của vai trò tương ứng (`$ADM`, `$OWN`, `$TCH`, `$LRN`…).

### OG1 – Tổ chức, seat, chủ tổ chức mời giáo viên (US1, SC-001)

1. `$ADM`: `POST /admin/organizations {name:"Trung tâm Sakura", ownerEmail:"owner@trungtam.example", license:{seats:20, startsOn:<hôm nay>, endsOn:<+365 ngày>}}` → 201; Mailpit có thư mời **song ngữ vi/en**.
2. Đăng ký/đăng nhập `owner@…`, mở `/invite/{token}` (từ thư) → `POST /invitations/{token}/respond {decision:"accept"}`. `GET /me` có `organization.roles=["owner"]`.
3. `$OWN`: `POST /org/teachers/invitations {email:"gv1@…"}` → `gv1` chấp nhận ⇒ `GET /org` hiện `seats.used = 1` (chủ không chiếm seat).
4. **Cô lập**: tạo tổ chức thứ hai B; `$OWNb` gọi `GET /classes/{lớp-của-A}` → 404 **giống hệt** gọi id ngẫu nhiên. `$OWN`/`$TCH` gọi `GET /admin/organizations` → 403.
5. Thử mời `gv1@…` từ tổ chức B → `INVITEE_UNAVAILABLE` (thân phản hồi không có tên "Sakura").

### OG2 – Giáo viên tạo lớp, đưa học viên vào (US2, SC-002)

1. `$TCH`: `POST /classes {name:"N5 Sáng T2-4-6"}` → 201. `POST /classes/{id}/invitations {invitees:[…]}` khi **chưa có lộ trình** → 409 `CLASS_NOT_READY`; `PUT /classes/{id}/join-code {enabled:true}` → 409.
2. Đặt lộ trình (OG3 bước 1), rồi: mời 3 học viên qua email; `PUT …/join-code {enabled:true}` và lấy mã; `POST …/invitations/import` với [CSV mẫu](contracts/csv-formats.md) (10 dòng, có dòng lỗi, trùng, quá seat) → `results` có đúng 10 phần tử, mỗi dòng một `outcome`.
3. Học viên `hv1` mở liên kết mời: `GET /invitations/{token}` thấy **hai lựa chọn + danh sách dữ liệu chia sẻ**; chọn "Tiếp tục theo lộ trình cá nhân" ⇒ lời mời `declined`, `GET /org` không đổi `used`; sau đó nhập mã `POST /me/class/join {code}` (xem trước) rồi `{code, decision:"join_class", confirmed:true}` ⇒ vào lớp, `used` +1.
4. Nhập sai mã 5 lần → lần 6 trả 429 (kể cả mã đúng); đợi hết khóa (Clock giả trong test) → vào lại bình thường.
5. Hết seat: tạo giấy phép nhỏ (2 seat), mời quá → dòng/yêu cầu thừa bị `no_seat`/409 `SEAT_UNAVAILABLE`, không tạo lời mời; hai học viên cùng chấp nhận lời mời cuối đồng thời ⇒ đúng một người vào được (kiểm thử đồng thời).
6. Gỡ `hv1` (`DELETE …/members/{id}`) → seat giải phóng; lưu trữ lớp có học viên cần `{confirm:true}` và đóng mọi thành viên.

### OG3 – Lộ trình lớp theo mẫu và học viên học theo lớp (US3, SC-003, SC-005, SC-012)

1. `$TCH`: `PUT /classes/{id}/path {startLevel:"N5", targetLevel:"N4", skills:["vocabulary","grammar"], startsOn, endsOn:+90 ngày, dailyMinutes:10}`.
2. `hv2` (người mới hoàn toàn), `hv3` (đã học cá nhân), `hv4` (đã vắng): sau khi vào lớp, `GET /me` → `learningSource="class"`; `GET /today` → tổng `estimatedMinutes ≤ 10`, mỗi mục ≤ 15 phút, bài thuộc đúng trình độ/kỹ năng của lớp. Onboarding chỉ hỏi tên/ngôn ngữ/múi giờ.
3. `hv3`: bài lớp đã học trước đó hiện là đã hoàn thành; `GET /path` cùng `source="class"`.
4. **Khóa**: `hv2` gọi `PATCH /me {dailyMinutes:30}`, `POST /path/pause`, `POST /path/rebuild`, `PUT /path/units/{id}/master`, `POST /placement/submit` (không `classRequestId`) → tất cả **409 `CLASS_MANAGED`**; `PATCH /me {displayName,language,timezone}` vẫn 200. Giao diện: các điều khiển hiện khóa kèm lý do và hướng dẫn "chuyển sang lộ trình cá nhân".
5. `$TCH` đổi `dailyMinutes` → 15 giữa chừng: kế hoạch đã sinh hôm nay không đổi, kế hoạch ngày sau dùng 15; tiến độ/lịch ôn không đổi (SC-005).
6. **Chuyển sang cá nhân**: `hv3` `POST /me/class/leave {confirm:true}` ⇒ `learningSource="personal"`, lộ trình cá nhân cũ và quyền điều khiển trở lại; giáo viên gọi `…/members/{hv3}/detail` → 404 ngay (cùng token); lịch sử học của `hv3` còn nguyên (`GET /progress`). `hv2` (chưa từng onboarding cá nhân) rời lớp ⇒ đi qua onboarding cá nhân.
7. **Hồi quy**: người học không thuộc lớp nhận kế hoạch/lộ trình/tiến độ giống ảnh chụp trước (`plans-pre-org.json`).

### OG4 – Bảng điều khiển và chi tiết (US4, SC-006)

1. Dựng lớp 5 học viên có dữ liệu biết trước (xem `tests/integration/class-dashboard.test.ts`: đúng tiến độ, chậm, vắng, tạm dừng, vừa vào lớp).
2. `$TCH`: `GET /classes/{id}/dashboard` → từng số khớp dữ liệu đã ghi; `?filter=behind` chỉ học viên chậm; `?sort=completion&order=desc`.
3. `GET …/members/{hv}/detail`: tiến độ theo đơn vị, thời gian 30 ngày, mảng yếu, bài giao; **không** có từng câu trả lời.
4. So sánh `ClassLearnerRow` của một học viên với `GET /me/class → progress` của chính họ: **trùng** từng số.
5. Học viên vừa vào lớp: hoạt động trước ngày vào lớp **không** xuất hiện; học viên chưa học: `hasStarted=false` ("chưa bắt đầu").
6. Giáo viên không phụ trách (`$TCHx`) → 404; `$OWN` xem được.
7. **Hiệu năng**: seed 50 học viên × 30 ngày dữ liệu; `GET …/dashboard` ≤ 3 giây (SC-006) — chạy bằng `pnpm test --project db -t "dashboard performance"`.

### OG5 – Tinh chỉnh lộ trình: chọn bài, ngày mở, bài giao, ghi đè, tạm dừng (US5)

1. `PUT /classes/{id}/path/units` với 12 đơn vị, vài đơn vị có `opensOn` tương lai ⇒ kế hoạch/học thêm của học viên **không** chứa đơn vị chưa mở; chuyển ngày (Clock giả) đến `opensOn` ⇒ đơn vị xuất hiện.
2. `POST /classes/{id}/assignments {unitIds:[…], dueOn:+3 ngày}` ⇒ bài giao đứng đầu kế hoạch học viên; để quá hạn ⇒ vẫn hiện, `state="overdue"`; hoàn thành sau hạn ⇒ `late`; đã học trước khi giao ⇒ `on_time`.
3. Giao khối lượng vượt `ngày còn lại × dailyMinutes` ⇒ 200 kèm `warnings:[{code:"over_capacity",…}]` (không chặn); kế hoạch ngày vẫn không vượt quỹ.
4. `PUT …/members/{hv}/exemptions/{unitId}` ⇒ đơn vị biến khỏi kế hoạch của `hv` và khỏi mẫu số; `PUT …/override {dailyMinutes:5, shiftDays:7}` ⇒ kế hoạch 5 phút, mốc dời; "Lớp của tôi" hiện `teacherAdjustments`.
5. Quản trị nội dung vô hiệu hóa một đơn vị trong lộ trình ⇒ biến khỏi kế hoạch và mẫu số; `dashboard.contentNotices` báo cho giáo viên.
6. `POST …/pauses` (cả lớp) ⇒ trong khoảng đó không cảnh báo, không tính chậm; sau kỳ nghỉ `PUT …/path` dời `startsOn/endsOn` ⇒ tiến độ so mốc hợp lý.

### OG6 – Hai lựa chọn, quyền riêng tư, vòng đời (US6, SC-008, SC-013)

1. Bản xem trước (OG2 bước 3) luôn hiện đủ hai lựa chọn + `disclosure` **trước** mọi thay đổi seat; đếm ≤ 3 lần nhấp để chuyển lớp ⇄ cá nhân (không tính xác nhận).
2. **Hết hạn**: Clock giả đến `ends_on + grace_days + 1` ⇒ truy cập kế tiếp của giáo viên/chủ tổ chức vào dữ liệu học viên → 404/403; học viên về `personal`, lịch sử nguyên vẹn; job `org-lifecycle` chạy tay cho kết quả giống (idempotent). Trong ân hạn: `GET /org` có `license.state="in_grace"`.
3. **Vô hiệu hóa tổ chức** (`PATCH /admin/organizations/{id} {status:"disabled"}`) ⇒ như hết seat.
4. **Xóa tài khoản học viên** (`POST /account/delete`) ⇒ giáo viên mất quyền xem ngay, seat giải phóng.
5. **Gỡ giáo viên** (`DELETE /org/teachers/{id}`) ⇒ token cũ của giáo viên nhận 404/403 ngay; lớp `teacherless` được cảnh báo cho chủ tổ chức; học viên vẫn học theo lộ trình lớp.
6. Vào lại lớp sau khi rời: đơn vị đã học (kể cả học cá nhân) ghi nhận hoàn thành.

### OG7 – Cảnh báo, điểm yếu lớp, xuất CSV (US7, SC-007, SC-009)

1. Dữ liệu giả lập: một học viên vắng 4 ngày (ngưỡng mặc định 3), một chậm tiến độ, một chủ đề có độ chính xác gộp thấp (< 60% trên ≥ 30 câu) ⇒ `alerts` đúng; học viên đang tạm dừng không có cảnh báo; lọc "cần chú ý" ≤ 2 lần nhấp.
2. `GET /classes/{id}/weak-topics` ⇒ chủ đề yếu xếp giảm dần, kèm tên học viên bị gắn cờ.
3. `GET …/export.csv` ⇒ BOM UTF-8, tiêu đề cố định, số liệu **trùng** bảng điều khiển; tên hiển thị `=HYPERLINK("http://x")` ra `'=HYPERLINK(...)`; tiếng Việt/Nhật đúng khi mở bằng Excel/Google Sheets. `admin_action_logs` có `class.export`.

### OG8 – Kiểm tra trình độ cho cả lớp, chia nhóm (US8)

1. `POST /classes/{id}/placement-requests` ⇒ học viên thấy `placementRequest` ở `GET /me/class`; nộp `POST /placement/submit {answers, classRequestId}` ⇒ 200; kết quả **không** đổi `GET /placement/current` cá nhân và không đổi lộ trình lớp.
2. `GET …/placement-requests/current` ⇒ kết quả từng học viên + phân bố; học viên chưa làm đánh dấu `pending`.
3. `POST …/members/{hv}/move {toClassId}` (giáo viên có quyền cả hai lớp hoặc chủ) ⇒ 202, học viên nhận lời mời chuyển lớp và vẫn ở lớp cũ; khi học viên chấp nhận (`join_class` + `confirmed`) ⇒ seat không đổi, `reassignment_count` không tăng, tiến độ/lịch ôn giữ, kế hoạch theo lộ trình lớp mới; nếu từ chối thì ở lại lớp cũ.

## 3. Kiểm thử tự động

```bash
cd backend && pnpm test                 # đơn vị + hợp đồng 1.12.0 + tích hợp (cần Docker cho dự án db)
cd backend && pnpm test:unit            # chỉ engine/CSV/seat thuần hàm, không cần CSDL
cd backend && pnpm lint && pnpm typecheck && pnpm format:check
cd client  && flutter test && flutter analyze && dart run tool/check_l10n.dart
```

| Nhóm | File đề xuất | Chứng minh |
|---|---|---|
| Ma trận quyền | `backend/tests/contract/org-authz-matrix.test.ts` + `tests/fixtures/authz-matrix.json` | SC-004: mọi route × mọi vai trò; 404 trùng byte; hiệu lực tức thì với cùng token |
| Seat & giấy phép | `tests/unit/seat-allocation.test.ts`, `tests/integration/org-seats.test.ts`, `org-concurrency.test.ts` | FR-004/005/006: gán ưu tiên người cũ, giới hạn đổi, giữ chỗ, đồng thời, hết hạn/ân hạn/vô hiệu hóa |
| Lời mời & mã | `tests/integration/org-invitations.test.ts`, `join-code.test.ts` | FR-010 → 013, 016: hai lựa chọn, một dùng, hết hạn, thu hồi, khóa nhập sai theo tài khoản, phản hồi 404 chung |
| CSV | `tests/unit/csv.test.ts`, `tests/integration/class-csv-import.test.ts`, `class-csv-export.test.ts` | FR-013, FR-033, SC-009: mỗi dòng một kết quả, 200/201 dòng, BOM, chống công thức, khớp bảng điều khiển |
| Engine lộ trình lớp | `tests/unit/class-path.test.ts`, `class-progress.test.ts`, `class-feasibility.test.ts` + `fixtures/learner-profiles/class-*.json` | FR-017 → 026, 028, 043; SC-003 ở mức 5/10/15/30 phút |
| Khóa quyền cá nhân | `tests/integration/class-managed-lock.test.ts` | FR-018: mọi đường vào bị 409 `CLASS_MANAGED` |
| Vòng đời | `tests/integration/class-lifecycle.test.ts` | FR-037 → 040, SC-008: rời/gỡ/hết hạn/xóa tài khoản/gỡ giáo viên, lịch sử nguyên vẹn |
| Bảng điều khiển | `tests/integration/class-dashboard.test.ts` (+ `dashboard performance`) | FR-027 → 032, 035; SC-006/007; cửa sổ từ lúc vào lớp; khớp `GET /me/class` |
| Hồi quy không lớp | `tests/unit/org-regression-golden.test.ts` + `fixtures/golden/plans-pre-org.json` | FR-041, SC-012 |
| Migration | `tests/integration/migration.test.ts` (mở rộng) | 0004 trên dữ liệu 001/003 không đổi |
| Client | `client/test/classroom/*`, `teacher/*`, `org/*` | khóa điều khiển kèm lý do, hai lựa chọn + thông báo, bảng điều khiển sắp xếp/lọc, song ngữ (`check_l10n`) |

## 4. Tiêu chí hoàn thành kiểm chứng

- Tất cả OG1–OG8 chạy đúng trên cả giao diện và API; `pnpm test`, `flutter test`, lint/typecheck/analyze/format đều xanh.
- `pnpm report:metrics` (mở rộng) in SC-010 (≥ 70% học viên học ≥ 3 ngày ở tuần thứ 4 kể từ khi vào lớp) cho lớp thử nghiệm; SC-011 thu bằng khảo sát giáo viên (ngoài hệ thống).
- Không phát sinh thay đổi hành vi ở người học cá nhân (golden xanh).
