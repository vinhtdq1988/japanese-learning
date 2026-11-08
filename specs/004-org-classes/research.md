# Nghiên cứu (Phase 0): Tổ chức, Lớp học và Lộ trình lớp

**Nhánh**: `004-org-classes` | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Tài liệu này giải quyết các điểm chưa rõ trong Technical Context và ghi lại các quyết định thiết kế. Đánh số `O1…O20` (Organization) để phân biệt với `R1…R17` của [research 001](../001-phase1-mvp/research.md) và `K1…K16` của [research 003](../003-kanji-lessons/research.md); khi một quyết định chỉ mở rộng quyết định cũ thì nêu rõ.

Bối cảnh: hệ thống 001 + 003 đã hoàn tất (Fastify + PostgreSQL 16 + Drizzle, engine thuần hàm trong `backend/src/engine/`, JWT không trạng thái 15 phút, pg-boss, client Flutter web). Tính năng này **mở rộng** chứ không thay thế: mọi quyết định ưu tiên tái sử dụng `rankUnits`, `planDailyPlan`, SRS, `unit_progress`, `study_records`, `pause_periods`, `admin_action_logs`, dịch vụ email; và giữ nguyên hành vi với người học không thuộc lớp (FR-041, SC-012).

Kết luận chung: **không còn mục NEEDS CLARIFICATION**. Các giả định thiết kế cần chủ dự án biết được gom ở cuối (mục "Điểm cần xác nhận").

---

## O1. Mô hình tổ chức, vai trò và ràng buộc "một tài khoản – một tổ chức"

**Quyết định**: Bảng `organization_members` có **khóa chính `user_id`** (một tài khoản tối đa một dòng ⇒ tối đa một tổ chức, đúng FR-002 bằng ràng buộc CSDL, không chỉ kiểm tra ứng dụng). Vai trò là cờ: `is_owner`, `is_teacher`. Vai trò **học viên không phải cờ** mà suy ra từ việc có `class_memberships` đang hoạt động (`left_at IS NULL`). Dòng `organization_members` tồn tại khi tài khoản có ít nhất một vai trò (chủ, giáo viên hoặc học viên đang trong lớp); khi mất vai trò cuối cùng thì dòng bị xóa (tài khoản "tự do", có thể được tổ chức khác mời). Lịch sử nằm ở `admin_action_logs`.

**Lý do**:
- FR-002/FR-004: một tài khoản có thể vừa giáo viên vừa học viên (lớp khác) nhưng chỉ một tổ chức và một seat → một dòng/tài khoản với cờ vai trò đơn giản hơn bảng `(user, org, role)` nhiều dòng và cần thêm ràng buộc duy nhất chéo vai trò.
- Học viên suy ra từ thành viên lớp tránh hai nguồn sự thật (cờ + thành viên lớp) có thể lệch.

**Phương án đã cân nhắc**:
- *Bảng `(user_id, organization_id, role)` nhiều dòng*: cần UNIQUE(user_id) riêng để giữ "một tổ chức" nên không gọn hơn; bác bỏ.
- *Cột `organization_id` trực tiếp trên `users`*: trộn miền tổ chức vào bảng tài khoản cốt lõi, khó mở rộng cho vai trò; bác bỏ.

## O2. Phân quyền, cô lập dữ liệu giữa tổ chức, và hiệu lực tức thì

**Quyết định**:
1. **Vai trò tổ chức KHÔNG đưa vào JWT.** Access token vẫn chỉ mang `role` hệ thống (`learner`/`admin`). Mọi route tổ chức/lớp gọi `loadOrgContext(db, userId)` (một truy vấn: `organization_members` ⨝ `organizations` ⨝ giấy phép seat hiệu lực ⨝ seat) ở mỗi request.
2. **Hiệu lực tức thì**: vì 001 chấp nhận token cũ còn sống 15 phút (R4) nhưng spec yêu cầu giáo viên/chủ tổ chức mất quyền xem học viên "ngay lập tức, kể cả phiên đang mở" (FR-037, SC-008), việc tra CSDL mỗi request là cần thiết và không đổi cơ chế xác thực. Chi phí: +1 truy vấn có khóa chính cho route tổ chức; route người học thông thường không bị ảnh hưởng.
3. **Mọi truy vấn đối tượng được ràng buộc `organization_id` của người gọi** (ví dụ `WHERE c.id = $1 AND c.organization_id = $ctxOrg`). Không tìm thấy hoặc ngoài phạm vi → **404 `NOT_FOUND` thông điệp chung** (không phân biệt "không tồn tại" và "của tổ chức khác", FR-007, SC-004). 403 `FORBIDDEN` chỉ dùng cho kiểm tra vai trò ở mức route khi không có đối tượng nào bị tiết lộ (ví dụ học viên gọi `GET /org`).
4. Giáo viên chỉ thấy lớp mình phụ trách (`class_teachers`); lớp khác trong cùng tổ chức → 404. Chủ tổ chức xem mọi lớp trong tổ chức.
5. **Quyền dữ liệu học viên** (`dataAccess`) = tổ chức `active` ∧ giấy phép còn hiệu lực (kể cả ân hạn) ∧ (chủ tổ chức ∨ giáo viên đang giữ seat) ∧ học viên đích có `class_memberships` đang hoạt động **trong lớp được truy cập** ∧ `users.status = 'active'`. Giáo viên mất seat giữ vai trò nhưng chỉ xem cấu trúc/danh sách thành viên (FR-038).
6. Vai trò tổ chức không bao hàm `admin`: `requireRole('admin')` giữ nguyên; route `/admin/organizations/*` chỉ cho `admin` và **không** có endpoint nào trả tiến độ chi tiết (FR-002).

**Phương án đã cân nhắc**:
- *Đưa `orgId`/vai trò vào JWT*: nhanh nhưng vi phạm "mất quyền ngay"; rút ngắn TTL cho mọi người dùng là thay đổi quá rộng; bác bỏ.
- *Row-Level Security PostgreSQL*: cô lập mạnh nhưng cần đặt `SET LOCAL app.org_id` trong mọi giao dịch, kết nối dùng chung bởi Drizzle/pg-boss, khó kiểm thử và gỡ lỗi; không tương xứng với quy mô. Thay bằng: (a) mọi repository tổ chức nhận `organizationId` bắt buộc ở chữ ký hàm (không có hàm "tìm lớp theo id" không lọc tổ chức), (b) bộ kiểm thử ma trận quyền chạy trên mọi route (SC-004, O19).

## O3. Seat: dòng seat, giữ chỗ cho lời mời, khóa và vòng đời giấy phép

**Quyết định**:
- `seat_licenses` (kỳ hạn: `starts_on`, `ends_on`, `grace_days`, `max_reassignments`) và `seats` (**một dòng mỗi seat**, `holder_user_id`, `last_holder_user_id`, `reassignment_count`). Dòng seat sinh khi cấp giấy phép; tăng/giảm số seat = thêm/xóa các dòng seat **trống**; giảm dưới số đang dùng + giữ chỗ → từ chối (FR-005).
- **Ràng buộc**: UNIQUE `seats(holder_user_id) WHERE holder_user_id IS NOT NULL` (một tài khoản một seat, FR-004). Giấy phép không chồng lặp ngày trong cùng tổ chức bằng **exclusion constraint** (`EXCLUDE USING gist (organization_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&) WHERE (revoked_at IS NULL)`, cần `CREATE EXTENSION btree_gist`; extension "trusted" từ PostgreSQL 13 nên chủ CSDL tạo được, như `citext` ở 0001).
- **Gán seat** (`allocateSeat`): ưu tiên (1) seat trống mà người này từng giữ (`last_holder = user`, không tăng đếm → "rời rồi vào lại không tính đổi", FR-004), (2) seat trống chưa từng có người giữ, (3) seat trống của người khác còn `reassignment_count < max_reassignments` (tăng đếm), (4) không có → `SEAT_REASSIGN_LIMIT` (422) hoặc `SEAT_UNAVAILABLE` (409) nếu thực sự hết.
- **Giữ chỗ**: lời mời `pending` chưa hết hạn của vai trò giáo viên/học viên giữ chỗ **theo đếm** (không gắn seat cụ thể). `available = assignableFreeSeats − pendingReservations`; `assignableFreeSeats` = seat trống có `last_holder IS NULL OR reassignment_count < max_reassignments` (bảo thủ: không tính ưu tiên (1) cho người cụ thể). Gửi lời mời chỉ khi `available ≥ 1` (FR-005, không có trạng thái "chờ seat").
- **Tuần tự hóa**: mọi thao tác ảnh hưởng sức chứa (gửi lời mời, chấp nhận, gán/thu hồi, chỉnh giấy phép) khóa dòng `organizations` bằng `SELECT … FOR UPDATE` trong giao dịch ⇒ không vượt seat dưới đồng thời. Quy mô (≤ vài trăm seat/tổ chức, thao tác thưa) nên khóa theo tổ chức không là điểm nghẽn.
- **Vòng đời hết hạn** (FR-006, FR-038): hiệu lực `ends_on + grace_days` tính theo múi giờ cấu hình `ORG_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh`). Hết ân hạn hoặc tổ chức bị vô hiệu hóa ⇒ `processOrgLapse(orgId)` (idempotent, trong giao dịch có khóa): giải phóng mọi seat, đóng mọi `class_memberships` của học viên (`end_reason = 'seat_expired' | 'org_disabled'`), hủy lời mời `pending`, giáo viên giữ vai trò nhưng không có seat. Kích hoạt theo **hai đường**: (a) **lười**: `loadOrgContext` và `resolveLearningContext` (O6) gọi khi phát hiện hết hạn chưa được xử lý, nên quyền mất ngay đúng thời điểm; (b) **job định kỳ** `org-lifecycle` (pg-boss, cron hằng giờ) quét các tổ chức quá hạn chưa xử lý để dữ liệu nhất quán cả khi không ai truy cập.
- **Gia hạn**: quản trị viên *kéo dài* `ends_on` của giấy phép hiện hành (seat giữ nguyên người). Nếu đã xử lý hết hạn, phải tạo giấy phép mới: giáo viên chưa có seat được cấp lại tự động theo thứ tự mời, tối đa theo số seat (phần thừa hiện cảnh báo cho chủ tổ chức); học viên phải được mời lại và xác nhận lại (FR-016, FR-038).

**Phương án đã cân nhắc**:
- *Chỉ đếm (`seats_total`, `seats_used`) không có dòng seat*: đơn giản hơn nhưng không thể diễn đạt "đổi người giữ tối đa 2 lần mỗi seat" và "cùng người quay lại không tính đổi" (FR-004) mà không thêm bảng nhật ký; dòng seat là mô hình tự nhiên và cho khóa/ràng buộc duy nhất miễn phí.
- *Gán seat cụ thể cho lời mời khi gửi*: giữ chỗ chính xác hơn nhưng phát sinh seat "treo" khi lời mời hết hạn và tăng đếm đổi người sai; giữ chỗ theo đếm đơn giản hơn và đủ (spec chỉ yêu cầu số lời mời chờ không vượt số seat trống).
- *Chỉ job định kỳ (không lười)*: quyền có thể còn tới 1 giờ sau hạn, trái SC-008; bác bỏ.

## O4. Lời mời, mã tham gia và chống dò mã

**Quyết định**:
- **Lời mời**: bảng `invitations` (`kind` = `owner` | `teacher` | `student`; email `citext`; `token_hash` SHA-256 của token ngẫu nhiên 32 byte base64url — token gốc chỉ nằm trong email, cùng cách `password_reset_tokens`). Hết hạn mặc định 14 ngày (`INVITATION_TTL_DAYS`). Chỉ **một lời mời `pending` cho mỗi (tổ chức, email)** — UNIQUE một phần; lời mời quá hạn được chuyển `expired` khi gửi lời mời mới cùng email (cùng giao dịch) và khi đọc, nên chỉ mục không chặn nhầm.
- **Chấp nhận**: bắt buộc đã đăng nhập **và** email tài khoản = email lời mời (so khớp không phân biệt hoa thường); không khớp → 404 chung (không lộ lời mời). Vì đăng ký 001 không xác minh email, lời mời đồng thời chứng minh quyền với email (giả định spec). Người chưa có tài khoản đăng ký bằng đúng email rồi mở lại liên kết `APP_BASE_URL/invite/{token}`.
- **Hai lựa chọn của học viên (FR-016)**: `GET /invitations/{token}` trả bản xem trước **kèm danh sách dữ liệu chia sẻ** (hằng số `SHARED_DATA_V1` dùng chung với trang "Lớp của tôi", FR-036 → không lệch giữa hai nơi); `POST /invitations/{token}/respond {decision: 'join_class' | 'stay_personal', confirmed}`; chỉ `join_class` + `confirmed:true` mới tạo thành viên lớp và tính seat. Ghi `consent_at`, `consent_version` trên thành viên lớp.
- **Từ chối chéo tổ chức (FR-002)**: kiểm tra lúc gửi (email đã thuộc tổ chức khác → lỗi chung `INVITEE_UNAVAILABLE`, không nêu tên tổ chức; cùng tổ chức nhưng đã ở lớp khác → `already_in_other_class`) **và** lúc chấp nhận (chống đua).
- **Mã tham gia**: cột trên `classes` (`join_code` UNIQUE nullable, `join_code_enabled`, `join_code_expires_at`). Mã 8 ký tự từ bảng chữ không nhập nhằng (32 ký tự, loại `0O1IL…`), sinh bằng `crypto.randomInt` (≈ 10¹² khả năng). Đổi mã thay thế giá trị ngay (mã cũ không còn tìm được). Không bật được khi lớp chưa có lộ trình (FR-010).
- **Chống dò mã**: bảng `join_code_attempts(user_id, failures, window_started_at, locked_until)` — đếm **theo tài khoản** (spec: "tạm khóa việc nhập mã của tài khoản"), mặc định 5 lần sai trong 15 phút ⇒ khóa 15 phút (`429 TOO_MANY_REQUESTS`); thành công xóa bộ đếm. Thêm giới hạn IP của `@fastify/rate-limit` cho route nhập mã (đã có cơ chế R9). Mọi lỗi mã (không tồn tại, tắt, hết hạn, lớp lưu trữ, thiếu lộ trình) trả **cùng một** phản hồi 404 để không lộ lớp.
- **Nhập mã dùng hai bước không trạng thái**: `POST /me/class/join {code}` không `decision` → 200 bản xem trước; có `decision` + `confirmed` → thực hiện (mã được kiểm lại ở cả hai bước). Không cần bảng/ticket trung gian.
- **Email**: tái dùng `EmailSender` + hàng đợi `send-email`; mẫu song ngữ vi/en trong cùng thư (FR-011), nằm ở `services/org-emails.ts`.

**Phương án đã cân nhắc**: *Ticket JWT ký cho bước xác nhận mã* — thêm cơ chế token mới mà việc gửi lại mã đủ thay thế; bác bỏ. *Giới hạn nhập mã chỉ theo IP* — không đáp ứng "theo tài khoản" và dễ vượt qua; chỉ dùng làm lớp phụ.

## O5. Nhập CSV và xuất CSV

**Quyết định**:
- **Nhập**: client đọc file và gửi nguyên văn lên `POST /classes/{id}/invitations/import` với `Content-Type: text/csv; charset=utf-8` (đăng ký content-type parser của Fastify, giới hạn `bodyLimit` 256 KB). **Không thêm `@fastify/multipart`** và không thêm thư viện CSV: bộ phân tích RFC 4180 tối thiểu (~50 dòng: dấu nháy kép, `""`, CRLF/LF, BOM UTF-8, tách bằng `,` hoặc `;` tự nhận từ dòng tiêu đề) trong `domain/csv.ts` với kiểm thử đơn vị.
- Cột `email` (bắt buộc), `display_name` (tùy chọn; chấp nhận tiêu đề `name`, `tên`…) — tiêu đề được chuẩn hóa. Tối đa 200 dòng dữ liệu (`CSV_IMPORT_MAX_ROWS`); quá → 422 toàn file. Từng dòng độc lập, kết quả trả theo thứ tự dòng với mã: `invited`, `invalid_email`, `duplicate_in_file`, `already_in_class`, `already_in_other_class`, `already_invited`, `no_seat`, `unavailable`; **mỗi dòng dữ liệu phải có đúng một kết quả** (kiểm thử bằng tổng). Sức chứa được tiêu thụ tuần tự trong cùng giao dịch có khóa tổ chức; hết seat ở dòng k ⇒ các dòng sau hợp lệ cũng nhận `no_seat` (không tạo lời mời nào quá sức chứa).
- **Xuất**: `text/csv; charset=utf-8` có **BOM UTF-8** (Excel hiển thị đúng tiếng Việt/Nhật), xuống dòng CRLF, phân tách bằng dấu `,`; cột số ghi số thuần. **Vô hiệu hóa công thức** (FR-033, SC-009): ô văn bản bắt đầu bằng `=`, `+`, `-`, `@`, tab (`\t`) hoặc CR (`\r`) được thêm tiền tố `'` (khuyến nghị OWASP CSV Injection); áp dụng cho mọi ô chuỗi (tên hiển thị, email, tên bài…), không áp cho cột số. Hàm `csvCell` có kiểm thử với bộ giá trị tấn công (`=cmd|…`, `@SUM(…)`, `+1`, `-2`, `\t=…`).
- Mỗi lần xuất ghi `admin_action_logs` (`action='class.export'`, kèm lớp, loại báo cáo) — FR-008.

**Phương án đã cân nhắc**: `csv-parse`/`papaparse` — thêm phụ thuộc cho nhu cầu nhỏ có thể kiểm thử; tách biệt rõ trong `domain/csv.ts` nên đổi sau dễ. `multipart/form-data` — thêm plugin, giới hạn kích thước/luồng phức tạp hơn.

## O6. Vòng đời thành viên lớp và "ngữ cảnh học hiệu lực" (lớp phủ lên hồ sơ)

**Quyết định**:
- `class_memberships` lưu **các giai đoạn** thuộc lớp: `joined_at`, `left_at`, `end_reason`. Đang hoạt động ⇔ `left_at IS NULL`; UNIQUE một phần `(user_id) WHERE left_at IS NULL` ⇒ một lớp tại một thời điểm (FR-014). Vào lại = dòng mới (lịch sử giữ nguyên, mốc hiển thị cho giáo viên = `joined_at` mới nhất).
- **Hồ sơ và lộ trình cá nhân KHÔNG bị sửa khi vào/rời lớp.** `learning_profiles`, `learning_paths`, `pause_periods`, `unit_progress`, `review_schedules`, … giữ nguyên, nên "tạm ngưng không xóa" và "khôi phục khi rời lớp" (FR-021, FR-037) xảy ra **miễn phí** và không có bước di trú dữ liệu có thể hỏng.
- Dịch vụ mới `resolveLearningContext(db, userId)` (`services/learning-context.ts`) là **điểm duy nhất** quyết định nguồn học:
  - Không có thành viên lớp hiệu lực → `{ source: 'personal', profile, path, params }` — đúng như mã hiện tại (giữ hồ sơ/đường đi hiện có; đảm bảo FR-041).
  - Có → `{ source: 'class', profile: effectiveProfile, params: classPathParams(...), class, membership, overrides, exemptions, assignments, pauses }` với `effectiveProfile` = bản sao hồ sơ cá nhân **ghi đè trong bộ nhớ**: `dailyMinutes = override ?? classPath.dailyMinutes`, `skills = classPath.skills`, `prioritizedSkill = null`, `paused = đang trong khoảng tạm dừng lớp/học viên hôm nay`, `onboardingState = 'completed'` ngữ nghĩa (không cần onboarding cá nhân).
  - Các dịch vụ hiện có (`daily-plan`, `path`, `progress`, `lesson-session` học thêm) đổi từ `getProfile + getActivePath` sang `resolveLearningContext`; phần còn lại của engine (`planDailyPlan`, `packReviewBatches`, `applyKanjiSlot`) **không đổi chữ ký** (FR-019).
- **Vào/rời lớp xử lý kế hoạch hôm nay**: nguồn học đổi giữa ngày ⇒ xóa kế hoạch ngày hôm nay **nếu mọi mục còn `pending`** (cascade xóa mục; không mất dữ liệu học) để học viên thấy ngay kế hoạch đúng nguồn (US3.2, SC-013). Nếu đã có mục `in_progress/completed`, giữ kế hoạch hôm nay và nguồn mới có hiệu lực từ ngày sau. Thay đổi tham số lộ trình lớp **không** xóa kế hoạch đã sinh (đúng US3.7: "từ kế hoạch được sinh kế tiếp").
- **Onboarding rút gọn** (FR-021): client dùng `PATCH /me` (tên, ngôn ngữ, múi giờ — vẫn được phép) và không hiện bước mục tiêu/trình độ/thời gian/kỹ năng khi `me.learningSource = 'class'`. Máy chủ không cần endpoint onboarding mới; `onboarding_state` cá nhân không bị đổi nên sau khi rời lớp học viên chưa từng onboarding sẽ đi qua onboarding cá nhân đúng FR-037.
- **Chuyển lớp** (FR-014/FR-034): giáo viên/chủ tổ chức chỉ **mời** (`POST …/move` tạo lời mời `student` tới lớp đích, 202); khi học viên chấp nhận, trong một giao dịch đóng thành viên lớp A (`end_reason='moved'`) và mở thành viên lớp B, **giữ nguyên seat** (không đổi người giữ, không tăng đếm). Lúc chấp nhận kiểm lại người mời còn quyền ở cả hai lớp. Bài đã xong vẫn tính (do `unit_progress` theo người dùng).

**Phương án đã cân nhắc**:
- *Sao chép lộ trình lớp thành `learning_paths` riêng cho mỗi học viên*: bị spec cấm (FR-017: không sao chép) và làm thay đổi lộ trình lớp phải cập nhật hàng loạt; bác bỏ.
- *Cờ `source` trên `learning_paths`*: phải đổi/khôi phục hàng loạt dòng khi vào/rời lớp, dễ lệch khi lỗi giữa chừng; lớp phủ trong bộ nhớ không có trạng thái cần đồng bộ.

## O7. Lộ trình lớp: tính động bằng engine hiện có

**Quyết định**: Thêm `engine/class-path.ts` (thuần hàm):
1. `classPathParams(template) → PathParams` tái dùng cùng ngữ nghĩa `buildPathParams`: `startLevel` (không chọn/`none` ⇒ N5 + `foundationFirst`), `levelRange = [start, min(target, N3)]`, `skills`, `targetDate = ends_on`, `scopeNotice='content_ceiling_n3'` khi đích N2/N1 (trường hợp biên thư viện thiếu nội dung), `weakTopics=[]`.
2. `rankClassUnits({ template, explicit, units, unitProgress, topicStats, exemptions, assignments, today }) → { ranked, required }`:
   - **Chế độ mẫu** (không có `class_path_units`): dùng `rankUnits(params, {skills, prioritizedSkill:null, goalType:null}, units, …)` ⇒ cùng tập đơn vị cho mọi học viên, thứ tự tinh chỉnh theo mảng yếu/độ khó của từng người (cá nhân hóa kế hoạch, không đổi lộ trình, đúng Làm rõ của spec và Nguyên tắc II).
   - **Chế độ liệt kê** (có `class_path_units`): tập = đúng danh sách giáo viên chọn (bỏ qua bộ lọc trình độ/kỹ năng), thứ tự theo `position`; chỉ đơn vị `active`; đơn vị có `opens_on > today` bị **khóa** (không vào `ranked/upcoming` và không vào "học thêm", FR-023) nhưng vẫn nằm trong `required` (mẫu số tiến độ).
   - **Miễn bài** (`exemptions`) loại khỏi `ranked` và `required` (FR-026).
   - **Bài giao** (`assignments`, chưa hoàn thành, đã mở) được đẩy lên đầu `upcoming`, thứ tự: quá hạn (hạn cũ nhất trước) → hạn gần nhất; bài giao quá hạn chưa xong **vẫn xuất hiện** cho tới khi hoàn thành (FR-024). Bài giao cho đơn vị bị miễn của học viên đó bị bỏ qua.
   - Đơn vị đã `completed/mastered` bởi bất kỳ lý do nào (kể cả trước khi vào lớp) tính hoàn thành (US3.5).
3. `planDailyPlan` nhận ứng viên đã xếp thứ tự ở trên với `budgetMinutes = effectiveProfile.dailyMinutes`; do đó **tổng không vượt quỹ, mỗi mục ≤ 15 phút** được bảo đảm bởi chính engine đã kiểm thử (FR-019, SC-003). `applyKanjiSlot` vẫn chạy (kỹ năng lớp có Kanji ⇒ Kanji xuất hiện đều).
4. Đơn vị bị vô hiệu hóa: `ContentCache.activeUnits()` chỉ chứa `active` nên tự biến mất khỏi kế hoạch và mẫu số (FR-020); **thông báo cho giáo viên** được tính khi đọc (không lưu): danh sách `class_path_units`/`class_assignments` trỏ tới đơn vị không còn `active` trả trong `dashboard.contentNotices` cho tới khi giáo viên gỡ chúng.
5. **Cảnh báo khả thi (FR-025)**: `feasibility = { requiredMinutes, capacityMinutes, overBy }` với `requiredMinutes` = tổng `estMinutes` các đơn vị bắt buộc chưa hoàn thành phải xong trước mốc/hạn, `capacityMinutes = số ngày còn lại (không tính tạm dừng) × dailyMinutes`. Trả dạng `warnings[]` trong phản hồi lưu (không chặn). Hàm thuần `computeFeasibility` có kiểm thử. (Ghi chú: công thức đúng spec; thực tế 60% quỹ có thể dành cho ôn nên trả kèm `capacityMinutes` để giao diện hiển thị rõ — xem Rủi ro.)

**Phương án đã cân nhắc**: Viết bộ xếp hạng riêng cho lớp, không dùng `rankUnits` — nhân đôi quy tắc đã kiểm thử và dễ lệch hành vi; bác bỏ. Chỉ chế độ liệt kê — đòi giáo viên chọn tay mọi bài, mâu thuẫn US3 ("mẫu đơn giản" là P1).

## O8. Khóa quyền kiểm soát của học viên khi thuộc lớp

**Quyết định**: Một hàm `assertNotClassManaged(db, userId, field)` ném `409 CLASS_MANAGED` (mã lỗi mới, thông điệp "do lớp quyết định; chuyển sang lộ trình cá nhân để tự điều chỉnh") khi người dùng có thành viên lớp hiệu lực. Gọi trong **dịch vụ** (không chỉ route) tại: `PATCH /me` với `dailyMinutes|skills|prioritizedSkill|currentLevel|goalType|targetLevel|targetDate`, `PUT /onboarding*`/`POST /onboarding/complete`, `POST /path/pause|resume|rebuild`, `PUT /path/units/{id}/master`, `PUT /path/items/{id}/master`, `POST /placement/submit` (trừ khi kèm `classRequestId` hợp lệ, O14). **Được phép**: `displayName`, `language`, `timezone`, email, mật khẩu, xóa tài khoản, xem mọi tiến độ, học thêm trong phạm vi lớp. `GET /me` trả `learningSource` và (nếu thuộc lớp) `classSummary` để client hiển thị điều khiển khóa kèm lý do (FR-018) mà không đoán.

**Lý do**: đặt ở tầng dịch vụ để "máy chủ từ chối khi bị gọi trực tiếp" đúng cho mọi đường vào; một danh sách duy nhất (`CLASS_LOCKED_PROFILE_FIELDS`) dùng chung cho lỗi trường và kiểm thử.

## O9. Tạm dừng, vắng mặt và cân đối lại kế hoạch trong lớp

**Quyết định**: `class_pause_periods` (phạm vi cả lớp: `membership_id IS NULL`; phạm vi một học viên: `membership_id`), nửa khoảng `[started_on, ended_on)` giống `pause_periods` nên **tái dùng `isPausedOn`, `absentDays`, `hasLearningGap`, `currentStreakDays`** của engine (kiểu `PausePeriod` giữ nguyên). `ended_on` có thể ở tương lai (nghỉ lễ đặt trước) hoặc `NULL` (mở, kết thúc thủ công). Với học viên thuộc lớp, **chỉ** khoảng tạm dừng lớp áp dụng (kể cả `pause_periods` cá nhân bị bỏ qua để một lần tạm dừng cá nhân cũ không làm sai chuỗi/vắng của lớp). Sau nghỉ/vắng ≥ 2 ngày kế hoạch được cân đối như 001 (`hasLearningGap` → thông báo `replanned_after_gap`; ôn dư giữ `due_date` gốc nên không dồn khối lượng bù). Dời mốc ngày của lớp = sửa `starts_on/ends_on` của lộ trình lớp (FR-022); dời riêng một học viên = `shift_days` ghi đè (FR-026).

## O10. Tiến độ so với mốc, trạng thái và cảnh báo (công thức)

**Quyết định** (hàm thuần trong `engine/class-progress.ts`; ngưỡng cấu hình được):
- **Đơn vị bắt buộc** `R` = tập `required` của O7 (đã loại miễn bài, đơn vị không còn `active`). `completionRatio = |{u ∈ R: completed|mastered}| / |R|` (`null` khi `R` rỗng).
- **Tỷ lệ mong đợi** `E(today)` = (số ngày làm việc đã qua từ `starts_on'` đến `min(today, ends_on')`) / (tổng số ngày làm việc từ `starts_on'` đến `ends_on'`), "ngày làm việc" = không thuộc khoảng tạm dừng (cả lớp + riêng); `starts_on' = starts_on + shift_days`, tương tự `ends_on'`. `E = 0` khi `today < starts_on'`, `E = 1` khi `today ≥ ends_on'`.
- **Trạng thái** (FR-028): `paused` nếu hôm nay thuộc khoảng tạm dừng; ngược lại `behind` nếu `completionRatio < E − margin` **hoặc** có bài giao quá hạn chưa xong; `ahead` nếu `completionRatio > E + margin`; còn lại `on_track`. `margin` mặc định 0.10 (`CLASS_PROGRESS_MARGIN_PCT`). `hasStarted=false` (không có bản ghi học nào kể từ `joined_at`) ⇒ giao diện hiện "chưa bắt đầu" thay vì số 0 (US4.6); `completionRatio=1` ⇒ cờ `pathCompleted` (biên "đã hoàn thành lộ trình").
- **Cảnh báo** (FR-031): `absent` khi `absentDays(lastActive ?? joinedLocalDate, yesterday, pauses) ≥ N` (N = `classes.absence_threshold_days`, 1–14, mặc định 3; tính ngày trọn vẹn trước hôm nay để học viên chưa kịp học hôm nay không bị coi là vắng thêm một ngày); `behind`; `overdue_assignment`. Học viên `paused` không có cảnh báo. **Cảnh báo được tính khi đọc**, không lưu và không gửi đi (đúng thực thể Cảnh báo của spec). Lọc "cần chú ý" = `alerts.length > 0` (một thao tác lọc ⇒ ≤ 2 lần nhấp, SC-007).
- **Ngày địa phương** của từng học viên theo múi giờ hồ sơ của chính họ (`localToday(clock, tz)`); giáo viên thấy ngày theo từng học viên.

## O11. Bảng điều khiển: nguồn dữ liệu, cửa sổ "từ khi vào lớp", hiệu năng, khớp với học viên

**Quyết định**:
- Số liệu lấy từ **các bản ghi sẵn có** (`study_records`, `study_intervals`, `unit_progress`, `lesson_sessions`, `topic_stats`, `review_schedules`), không bảng số liệu lưu sẵn (FR-030). Repository mới `db/repositories/class-stats.ts` nhận `{ userIds, since }`, **mọi truy vấn lọc `occurred_at >= class_memberships.joined_at`** của từng học viên (`JOIN class_memberships m ON m.user_id = s.user_id AND m.left_at IS NULL AND s.occurred_at >= m.joined_at`) ⇒ giáo viên không bao giờ thấy hoạt động trước khi vào lớp (FR-030, US4.5).
- **Gộp theo lô, không N+1**: mỗi chỉ số một truy vấn cho cả lớp (`GROUP BY user_id`): đếm/độ chính xác ôn (`context='review' AND is_retry=false`), ngày hoạt động rời rạc (cho chuỗi/ngày học gần nhất), khoảng thời gian học (hợp khoảng tính bằng `unionDurationSeconds` hiện có trong TS trên tập khoảng đã lọc), tiến độ đơn vị. Lớp 50 học viên: ~6–8 truy vấn có chỉ mục `(user_id, local_date)`/`(user_id, started_at)` sẵn có ⇒ đáp ứng SC-006 (3 giây) mà không cần bộ đệm; dựng bộ đo hiệu năng vào kiểm thử tích hợp (seed 50 học viên × 30 ngày).
- **Khớp màn hình học viên (US4.4/SC-006)**: học viên thuộc lớp có `GET /me/class` hiển thị **khối "tiến độ trong lớp"** gọi **đúng các hàm repository** ở trên với `userIds=[mình]` và cùng `since`. `GET /progress` (toàn thời gian, đã có) giữ nguyên. Kiểm thử đối chiếu bảng điều khiển với `getClassProgressFor(self)` từng số (đúng nguồn) và với `GET /progress` trên học viên *vừa vào lớp không có lịch sử* (hai cửa sổ trùng nhau).
- **Mảng yếu của lớp (FR-032)**: truy vấn gộp lượt chính (`is_retry=false`) của thành viên theo `topic_id` kể từ `joined_at`; chủ đề yếu khi `COUNT ≥ 30` và `SUM(correct)/COUNT < 0.60`. "Số học viên bị gắn cờ yếu" tính **từ cùng cửa sổ**: với mỗi (học viên, chủ đề) lấy tối đa `TOPIC_WINDOW=20` kết quả mới nhất kể từ `joined_at` (window function `row_number()`), áp **cùng quy tắc `nextWeakFlag`** (< 60% với ≥ 8 câu) của engine độ khó — không dùng `topic_stats.is_weak` vì nó có thể bao gồm kết quả trước khi vào lớp.
- **Chi tiết một học viên (FR-029)**: tiến độ theo từng đơn vị của lộ trình lớp (trạng thái + hạn nếu là bài giao), thời gian học theo ngày 30 ngày gần nhất, độ chính xác, mảng yếu (cùng quy tắc trên), từng bài giao (`on_time|late|overdue|pending`), kết quả kiểm tra trình độ nếu có. **Không có endpoint trả từng câu trả lời** (FR-035).

**Kết quả đo kịch bản cận trên (T131, 2026-11-08)**: lớp **100** học viên, mỗi người vào lớp từ ~4 tháng trước và học 120 ngày liên tiếp (≈ 48.000 bản ghi trả lời + 12.000 khoảng thời gian), PostgreSQL 17, đo `GET /classes/{id}/dashboard` sau khi làm nóng (3 lần chạy): **tốt nhất 269 ms, tệ nhất 288 ms** so với ngưỡng 3 giây (SC-006). Số truy vấn không tăng theo số học viên (kiểm thử 50 học viên ≤ 40 truy vấn). **Kết luận: KHÔNG cần** chỉ mục `study_records(user_id, occurred_at)` (migration `0005`) ở quy mô này; chỉ cân nhắc lại nếu dữ liệu thực vượt đáng kể (ví dụ > 1 triệu bản ghi trả lời/lớp). Kiểm thử: `backend/tests/integration/class-dashboard.test.ts` ("100 học viên × 120 ngày").

## O12. Bài giao và hoàn thành đúng/trễ hạn

**Quyết định**: `class_assignments` mỗi dòng một đơn vị (`batch_id` nhóm "một lần giao nhiều đơn vị"). Trạng thái theo học viên là **dẫn xuất**: thời điểm hoàn thành = `MIN(lesson_sessions.completed_at)` của phiên `new_unit` hoàn thành cho đơn vị đó của học viên, hoặc `unit_progress.updated_at` nếu là `mastered`/đã hoàn thành từ trước; `on_time` nếu hoàn thành ≤ cuối ngày `due_on` (theo múi giờ học viên) **hoặc đã hoàn thành trước khi bài được giao** (US2.3 "ghi nhận hoàn thành, không làm lại"), `late` nếu sau, `overdue` nếu chưa xong và quá hạn, `pending` nếu chưa tới hạn. Không bảng trạng thái riêng ⇒ không lệch với dữ liệu học thật; "được ghi lại" (FR-024) được đảm bảo vì mốc hoàn thành là dữ liệu đã ghi.

## O13. Quyền riêng tư: danh sách trắng DTO

**Quyết định**: Giáo viên/chủ tổ chức chỉ nhận các DTO `ClassLearnerRow`/`ClassLearnerDetail` có **danh sách trường cố định** khớp FR-035 (tên hiển thị, email, tiến độ, thời gian học, độ chính xác tổng hợp, mảng yếu, chuỗi, trạng thái bài giao, kết quả kiểm tra). Không có DTO nào chứa mật khẩu/phiên, hồ sơ cá nhân ngoài danh sách, hay từng câu trả lời. Hằng `SHARED_DATA_V1` (danh sách mã + nhãn song ngữ) là nguồn duy nhất cho: thông báo trước khi vào lớp (O4), trang "Lớp của tôi" (FR-036), và tài liệu hợp đồng; kiểm thử "snapshot khóa DTO" bảo đảm không rò thêm trường. Học viên đã rời lớp: giáo viên chỉ nhận `{displayName, endedAt, endReason}` (O6 lưu `exit_display_name` lúc đóng).

## O14. Kiểm tra trình độ cho cả lớp và chia nhóm (US8)

**Quyết định**: Bảng `class_placement_requests` (một yêu cầu mở tại một thời điểm cho mỗi lớp). Học viên thuộc lớp thấy yêu cầu trong `GET /me/class`; nộp bài bằng **`POST /placement/submit` có thêm `classRequestId`** (tái dùng bộ chấm `gradeAnswers`/bộ câu hỏi 20 câu hiện có). Kết quả lưu vào `placement_results` với **`is_current = false`** và cột mới `class_placement_request_id` (UNIQUE (user_id, class_placement_request_id)) ⇒ không đụng "kết quả hiện hành" cá nhân và không đổi lộ trình; học viên lớp vẫn bị khóa nộp bài thường (`CLASS_MANAGED`). Giáo viên xem kết quả từng học viên + phân bố `estimatedLevel` của lớp, học viên chưa làm được đánh dấu; kết quả **không tự đổi lộ trình lớp** (FR-034). "Chia nhóm" = chuyển học viên sang lớp khác (O6). Yêu cầu tồn tại cho tới khi giáo viên đóng; học viên vào lớp sau cũng thấy yêu cầu đang mở.

## O15. Xóa tài khoản, vô hiệu hóa, gỡ vai trò

**Quyết định** — các điểm gắn vào cơ chế sẵn có:
- **Học viên yêu cầu xóa** (`POST /account/delete`, FR-039): trong cùng giao dịch `markPendingDeletion`, gọi `endMembership(reason='account_deleted')` (đóng thành viên, giải phóng seat, xóa dòng `organization_members` nếu hết vai trò). Quá trình khôi phục tài khoản 30 ngày **không** khôi phục tư cách thành viên (phải được mời lại).
- **Tài khoản `disabled`/`pending_deletion`** bị loại khỏi mọi truy vấn dữ liệu của giáo viên (`users.status='active'` trong `class-stats`), kể cả khi thành viên chưa đóng.
- **Giáo viên/chủ tổ chức yêu cầu xóa tài khoản**: giải phóng seat giáo viên, gỡ `class_teachers`, phát cảnh báo "lớp không có giáo viên" (dẫn xuất) cho chủ tổ chức (FR-040). Chủ tổ chức cuối cùng của tổ chức yêu cầu xóa: cho phép nhưng tổ chức hiện cảnh báo "chưa có chủ" cho quản trị viên (danh sách `/admin/organizations`).
- **Job xóa cứng** (`purge-deleted-accounts`): các khóa ngoại mới tới `users` dùng `ON DELETE CASCADE` cho dữ liệu thuộc chính người dùng (`class_memberships`, `join_code_attempts`, `organization_members`) và `ON DELETE SET NULL` cho tham chiếu "ai làm" (`created_by`, `invited_by`, `assigned_by`, `seats.holder_user_id`, `admin_action_logs.actor_id` đã có) để không xóa nhầm dữ liệu tổ chức.
- **Vô hiệu hóa tổ chức** (quản trị viên): `processOrgLapse(orgId, 'org_disabled')` (O3).
- **Gỡ giáo viên** (FR-040): xóa cờ `is_teacher`, xóa khỏi `class_teachers`, giải phóng seat; mất quyền ngay (O2). Học viên của lớp vẫn học theo lộ trình lớp.

## O16. Cấu hình mặc định

**Quyết định**: Giá trị mặc định đặt trong `config.ts` (Zod, như R6/R7): `INVITATION_TTL_DAYS=14`, `SEAT_GRACE_DAYS=7`, `SEAT_MAX_REASSIGNMENTS=2`, `SEAT_EXPIRY_WARNING_DAYS=14`, `CLASS_MAX_MEMBERS=100`, `CSV_IMPORT_MAX_ROWS=200`, `CSV_IMPORT_MAX_BYTES=262144`, `JOIN_CODE_MAX_FAILURES=5`, `JOIN_CODE_LOCK_MINUTES=15`, `CLASS_ABSENCE_DEFAULT_DAYS=3`, `CLASS_PROGRESS_MARGIN_PCT=10`, `CLASS_WEAK_ACCURACY_PCT=60`, `CLASS_WEAK_MIN_ANSWERS=30`, `ORG_TIMEZONE=Asia/Ho_Chi_Minh`. **Giá trị theo thực thể** khi spec nói điều chỉnh được: ân hạn và giới hạn đổi seat nằm trên `seat_licenses` (quản trị viên chỉnh theo từng giấy phép, FR-004/FR-006); ngưỡng vắng nằm trên `classes` (giáo viên chỉnh 1–14, FR-031). Hiệu chỉnh sau khi chạy thử với khách đầu tiên chỉ cần đổi cấu hình.

## O17. Hợp đồng API và tương thích

**Quyết định**: OpenAPI **1.11.0 → 1.12.0, thay đổi bổ sung** (không phá vỡ): nhóm route mới (`/admin/organizations*`, `/org*`, `/classes*`, `/invitations*`, `/me/class*`), mã lỗi mới (`CLASS_MANAGED`, `SEAT_UNAVAILABLE`, `SEAT_REASSIGN_LIMIT`, `INVITEE_UNAVAILABLE`, `CLASS_NOT_READY`, `CLASS_FULL`; lời mời/mã không hợp lệ dùng `NOT_FOUND` chung), `Me` thêm `learningSource`, `classSummary`, `organization`; `PlacementAnswers` thêm `classRequestId`. Như 003, ghi vào file `specs/001-phase1-mvp/contracts/openapi.yaml` lúc hiện thực (một nguồn sự thật); chi tiết ở [contracts/api-changes.md](contracts/api-changes.md). Client Dart sinh lại bằng quy trình của `client/lib/data/api/README.md`. Người học không thuộc lớp: mọi phản hồi cũ **không đổi** ngoài các trường tùy chọn mới (`learningSource: 'personal'`).

## O18. Cấu trúc client (Flutter, web ưu tiên)

**Quyết định**: Thêm khu vực giao diện theo vai trò, điều hướng dựa trên `Me.organization` và `Me.learningSource` (guard ở `resolveRedirect` giống quản trị; bảo vệ thực sự ở server):
- `presentation/classroom/` — học viên: nhận lời mời (hai lựa chọn + danh sách dữ liệu chia sẻ), nhập mã, "Lớp của tôi", thẻ điều khiển bị khóa (`LockedControl`) dùng ở màn điều chỉnh kế hoạch/hồ sơ, yêu cầu kiểm tra trình độ lớp.
- `presentation/teacher/` — giáo viên/chủ tổ chức: danh sách lớp, chi tiết lớp (thành viên, lời mời, mã, CSV), lộ trình lớp (mẫu + liệt kê/ngày mở/bài giao/ghi đè/tạm dừng), bảng điều khiển + chi tiết học viên + điểm yếu lớp + xuất CSV, yêu cầu kiểm tra trình độ.
- `presentation/org/` — chủ tổ chức (tổng quan seat, giáo viên) và quản trị viên hệ thống (`admin/admin_orgs_screen.dart`: tạo tổ chức, giấy phép, seat).
- **Nguyên tắc V**: tải lên/xuống tệp CSV đi qua giao diện mới `lib/platform/file_transfer.dart` (`pickCsv()`, `saveCsv(name, bytes)`) với cài đặt web trong `lib/platform/web/`; không dùng `dart:html` ngoài thư mục `platform/`. Repository mới trong `lib/data/` (`org_repository.dart`, `class_repository.dart`, `classroom_repository.dart`).
- Bảng điều khiển tối ưu desktop (bảng có sắp xếp/lọc); chuỗi giao diện song ngữ trong `app_vi.arb`/`app_en.arb` và `tool/check_l10n.dart` (FR-042).

## O19. Chiến lược kiểm thử (FR-043)

**Quyết định**:
1. **Ma trận quyền tự động** (`tests/contract/org-authz-matrix.test.ts`): với mỗi route của contracts/permissions-matrix.md × mỗi vai trò (admin, chủ tổ chức A, giáo viên phụ trách, giáo viên không phụ trách, giáo viên tổ chức B, học viên, ẩn danh) khẳng định mã phản hồi mong đợi và **thân phản hồi 404 không phân biệt được** "không tồn tại" với "của tổ chức khác" (SC-004). Bảng ma trận là dữ liệu (một nguồn) sinh cả tài liệu lẫn test.
2. **Engine bằng hồ sơ đại diện**: thêm `tests/fixtures/learner-profiles/class-*.json` (mới hoàn toàn 10 phút; có tiến độ cá nhân vào giữa chừng; vắng nhiều ngày; bị miễn bài; bài giao quá hạn; giáo viên đổi lộ trình giữa chừng; tạm dừng cả lớp) cho `class-path`, `class-progress`, `daily-plan` ở mức 5/10/15/30 phút (SC-003).
3. **Hồi quy "không thuộc lớp"**: chụp ảnh golden `tests/fixtures/golden/plans-pre-org.json` (kế hoạch 14 ngày + `GET /path` + `GET /progress` của toàn bộ hồ sơ cũ) **trước khi** sửa dịch vụ, rồi so sánh sau (SC-012), cùng cách 003.
4. **Vòng đời bằng Clock giả**: vào/rời/hết hạn/ân hạn/xóa tài khoản/gỡ vai trò, khẳng định quyền bị từ chối ngay sau thời điểm (kể cả "phiên đang mở": cùng access token, request kế tiếp bị 404), lịch sử học còn nguyên (SC-008).
5. **Đồng thời**: hai lời mời chấp nhận cùng lúc cho seat cuối cùng; gửi lời mời đồng thời; nhập mã sai song song (khóa tài khoản). Dùng Testcontainers PostgreSQL như `concurrency.test.ts`.
6. **CSV**: bộ phân tích (BOM, nháy kép, CRLF, 200/201 dòng), tổng kết quả từng dòng = số dòng, xuất khớp bảng điều khiển, bộ giá trị tấn công công thức (SC-009).
7. **Migration**: `migration.test.ts` mở rộng: chạy `0004` trên CSDL có dữ liệu 001/003 ⇒ không đổi dữ liệu hiện có; thêm `placement_results.class_placement_request_id` NULL cho dòng cũ.

## O20. Email giao dịch

**Quyết định**: ba mẫu (mời chủ tổ chức, mời giáo viên, mời vào lớp) trong `services/org-emails.ts`; mỗi thư **có cả tiếng Việt và tiếng Anh trong cùng nội dung** (không phụ thuộc ngôn ngữ người nhận chưa có tài khoản, FR-011), tiêu đề song ngữ, liên kết `APP_BASE_URL/invite/{token}` (client Flutter web dùng định tuyến hash như liên kết đặt lại mật khẩu nên liên kết thực là `APP_BASE_URL/#/invite/{token}`), nêu tên tổ chức/lớp/người mời và ngày hết hạn. Gửi qua hàng đợi `send-email` (thử lại sẵn có). Email không chứa dữ liệu học tập. Lời mời học viên nêu rõ "bạn có thể từ chối và tiếp tục học cá nhân".

---

## Điểm cần xác nhận (không chặn lập kế hoạch)

1. **Chuyển lớp cần học viên đồng ý lại — ĐÃ QUYẾT ĐỊNH (chủ dự án chọn "bắt học viên đồng ý lại").** Giáo viên/chủ tổ chức KHÔNG chuyển thẳng học viên; họ gửi *lời mời chuyển lớp* (`POST /classes/{id}/members/{userId}/move` → 202, tạo lời mời `student` tới lớp đích, không giữ chỗ seat vì học viên đã giữ seat). Học viên mở lời mời, thấy cùng thông báo dữ liệu chia sẻ và hai lựa chọn ngang nhau ("chuyển sang lớp mới" / "ở lại lớp hiện tại"), chỉ khi xác nhận mới chuyển (giữ seat, tiến độ, lịch ôn); từ chối thì không đổi gì. `SHARED_DATA_V1.mayBeMovedWithinOrganization = false` và `MyClass.movedNotice` luôn `null` (không còn "bị chuyển").
2. **Cửa sổ số liệu.** Bảng điều khiển tính từ `joined_at`; `GET /progress` của học viên là toàn thời gian. Spec US4.4 "khớp" được bảo đảm trên cùng cửa sổ qua khối "tiến độ trong lớp" (O11), không bắt `GET /progress` đổi nghĩa.
3. **Đơn vị hoàn thành trước khi vào lớp** vẫn tính vào tỷ lệ hoàn thành lộ trình lớp (US3.5) nhưng ngày/thời gian của chúng không hiển thị cho giáo viên.
4. **Công thức khả thi theo spec** (FR-025: ngày còn lại × phút/ngày) bỏ qua phần quỹ dành cho ôn; xem Rủi ro trong plan.
