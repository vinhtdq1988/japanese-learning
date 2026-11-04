# Nghiên cứu Giai đoạn 0: Giai đoạn 1 – MVP

**Nhánh**: `001-phase1-mvp` | **Ngày**: 2026-11-04 | **Đặc tả**: [spec.md](spec.md)

Tài liệu này chốt các quyết định kỹ thuật còn bỏ ngỏ trong Technical Context của [plan.md](plan.md) (stack backend, lưu trữ, xác thực, thuật toán lặp lại ngắt quãng, v.v.) và các giá trị cụ thể mà đặc tả hoãn sang giai đoạn lập kế hoạch. Mọi mục `NEEDS CLARIFICATION` đều đã được giải quyết.

## R1. Stack backend

- **Quyết định**: Node.js 22 LTS + TypeScript, framework **Fastify**, kiểm tra dữ liệu bằng **Zod**, truy cập CSDL bằng **Drizzle ORM** (migration SQL tường minh).
- **Lý do**: Hiến pháp (Nguyên tắc VI) chỉ yêu cầu REST API tách biệt, không ép ngôn ngữ. TypeScript cho kiểu dữ liệu mạnh, hệ sinh thái trưởng thành, Fastify nhẹ và có sẵn plugin rate-limit, JWT. Quy mô (hàng trăm đến vài nghìn người học đồng thời) không cần kiến trúc phức tạp hơn một tiến trình API đơn.
- **Phương án đã xem xét**:
  - Dart backend (dùng chung ngôn ngữ với Flutter): bị loại vì hệ sinh thái server (ORM, hàng đợi, rate-limit) mỏng hơn; lợi ích chia sẻ code không đáng kể do hợp đồng đã đi qua OpenAPI.
  - NestJS: bị loại vì thêm lớp trừu tượng không cần thiết cho phạm vi MVP (xem Nguyên tắc "độ phức tạp phải được biện minh").
  - Python/FastAPI hoặc .NET: khả thi nhưng không có lợi thế rõ rệt so với TypeScript cho đội này.

## R2. Lưu trữ

- **Quyết định**: **PostgreSQL 16** là nơi lưu duy nhất (tài khoản, hồ sơ, nội dung, tiến độ, hàng đợi tác vụ nền, phiên đăng nhập).
- **Lý do**: Dữ liệu có quan hệ mạnh; cần ràng buộc unique để đảm bảo idempotent (FR-041), giao dịch cho cập nhật lịch ôn tập, JSONB cho nội dung đa ngôn ngữ và ảnh chụp phiên học. Một CSDL duy nhất giữ vận hành đơn giản.
- **Phương án đã xem xét**: MongoDB (mất ràng buộc quan hệ/unique tiện lợi), SQLite (không phù hợp đồng thời nhiều người), thêm Redis (không cần ở quy mô này).

## R3. Tác vụ nền (xóa vĩnh viễn sau 30 ngày, gửi email)

- **Quyết định**: **pg-boss** (hàng đợi dựa trên PostgreSQL) cho: (a) gửi email đặt lại mật khẩu có thử lại, (b) job hằng ngày xóa vĩnh viễn tài khoản quá 30 ngày chờ xóa.
- **Lý do**: Không thêm hạ tầng mới (không Redis/broker); tận dụng PostgreSQL; hỗ trợ lịch cron và thử lại.
- **Phương án đã xem xét**: cron của hệ điều hành + script (khó quan sát và thử lại), BullMQ (cần Redis – thêm thành phần không cần thiết).

## R4. Xác thực và phiên

- **Quyết định**: Mật khẩu băm **argon2id**. Access token **JWT ngắn hạn (15 phút)** + **refresh token đục (opaque) 30 ngày, xoay vòng mỗi lần dùng**, lưu băm trong CSDL (bảng `auth_sessions`). Vai trò (`learner`/`admin`) nằm trong claim và được kiểm tra lại ở middleware. Phía client truy cập token qua abstraction `TokenStore` (web: lưu trong trình duyệt; mobile sau này: secure storage) để đáp ứng Nguyên tắc V.
- **Lý do**: API bearer-token dùng được nguyên vẹn cho client Android/iOS ở Giai đoạn 3. Xoay vòng refresh token và lưu băm giảm rủi ro rò rỉ. Giảm thiểu XSS bằng CSP chặt chẽ.
- **Thu hồi truy cập**: vô hiệu hóa (admin) hoặc xóa tài khoản (người học) đặt `revoked_at` cho mọi `auth_sessions` của người dùng trong cùng giao dịch; đăng nhập và `POST /auth/refresh` với tài khoản `disabled` trả 403 `ACCOUNT_DISABLED`. Middleware KHÔNG tra `users.status` ở mỗi request: access token đã cấp còn hiệu lực đến khi hết hạn (tối đa 15 phút) — rủi ro được chấp nhận để giữ middleware không trạng thái (xem plan.md, Rủi ro). Claim `status` trong access token cho phép middleware giới hạn tài khoản `pending_deletion` chỉ gọi `POST /account/restore` và `POST /auth/logout`; khôi phục thành công cấp token mới. Khi người học tự xóa tài khoản (FR-003, đã làm rõ): phiên thực hiện xóa bị đăng xuất ngay (client xóa token theo phản hồi của `POST /account/delete`), mọi phiên mới chỉ được khôi phục, còn các phiên khác đang mở của chính chủ tài khoản mất quyền truy cập chậm nhất khi access token hết hạn (≤ 15 phút).
- **Đặt lại mật khẩu (FR-001)**: token ngẫu nhiên 256-bit, lưu băm SHA-256, dùng một lần, `expires_at = now + 1h`, vô hiệu hóa mọi phiên hiện có khi đổi mật khẩu thành công. Phản hồi của endpoint yêu cầu đặt lại luôn giống nhau dù email có tồn tại hay không (chống dò tài khoản).
- **Phương án đã xem xét**: cookie phiên httpOnly (an toàn hơn cho web nhưng gây khó cho client di động); OAuth/SSO (ngoài phạm vi theo Giả định).

## R5. Dịch vụ email giao dịch

- **Quyết định**: Giao diện `EmailSender` trong backend; triển khai mặc định qua **SMTP (nodemailer)** cấu hình bằng biến môi trường, cho phép cắm nhà cung cấp (SES, Resend, Mailgun…) mà không đổi code nghiệp vụ. Môi trường dev/test dùng **MailHog/Mailpit** (container) hoặc triển khai in-memory.
- **Lý do**: Đặc tả (FR-001) phụ thuộc dịch vụ email ngoài; trừu tượng hóa giúp kiểm thử và đổi nhà cung cấp.

## R6. Thuật toán lặp lại ngắt quãng (FR-023, FR-025, SC-005)

- **Quyết định**: Biến thể đơn giản của **SM-2** cho kết quả nhị phân (đúng/sai), mỗi cặp (người học, mục) có `interval_days`, `ease`, `repetitions`, `lapses`, `due_date`.
  - Mục mới học (lần đầu trả lời đúng): `interval = 1` ngày, `ease = 2.3`, `repetitions = 1`.
  - Trả lời **đúng**: `repetitions += 1`; `interval = repetitions==2 ? 3 : round(interval × ease)`; `ease = min(2.8, ease + 0.05)`.
  - Trả lời **sai**: `lapses += 1`; `repetitions = 0`; `interval = 1`; `ease = max(1.3, ease − 0.2)`; trong phiên hiện tại mục sai được hỏi lại một lần ở cuối phiên (gửi với `isRetry=true`, không tính vào lịch ôn, `topic_stats` hay độ chính xác).
  - Mỗi mục chỉ cập nhật lịch tối đa một lần mỗi ngày địa phương (`last_reviewed_local_date`, R10).
  - `due_date` = ngày địa phương của người học + `interval` ngày.
  - Mục có `lapses ≥ 3` và độ chính xác gần đây < 60% được đánh dấu "mục khó": hệ số `ease` không cao hơn 2.0 và được ưu tiên khi chọn bài ôn (FR-014).
- **Lý do**: Dễ giải thích, dễ kiểm thử (hàm thuần), thỏa mãn kịch bản "đúng → xa hơn, sai → sớm hơn" và SC-005. Không cần ML (Giai đoạn 2).
- **Phương án đã xem xét**: FSRS (chính xác hơn nhưng cần tham số hóa/huấn luyện và nhiều dữ liệu lịch sử, thừa cho MVP); Leitner cố định (kém linh hoạt với `ease`).

## R7. Thuật toán sinh lộ trình và kế hoạch hằng ngày (FR-010 → FR-016)

- **Quyết định**: Engine dựa trên **quy tắc, thuần hàm, nhận `Clock` tiêm vào**, nằm trong `backend/src/engine/` và không phụ thuộc HTTP/CSDL.
  - **Điểm xuất phát**: trình độ ước tính = kết quả placement nếu có, ngược lại trình độ tự khai báo; "chưa biết gì" → nền tảng người mới (các đơn vị `level = N5`, `tier = foundation` được xếp trước, xem data-model §2.8). Placement kém (toàn sai/đoán mò – tỷ lệ đúng ≤ ngưỡng đoán mò) → lùi về mức an toàn cho người mới.
  - **Chọn đơn vị**: lọc theo kỹ năng được chọn (từ vựng/ngữ pháp), `active`, chưa thành thạo, trình độ từ điểm xuất phát đến trình độ mục tiêu; chấm điểm theo độ liên quan mục tiêu (thẻ `goal_tags`), kỹ năng ưu tiên (`prioritized_skill`), thứ tự nội dung (`sequence`), mảng yếu từ placement và `difficulty_bias`. Kết quả là danh sách có thứ tự được **tính động, không lưu**: hàm thuần `rankUnits(pathParams, profile, activeUnits, unitProgress, topicStats)` được gọi khi `GET /path`, khi sinh kế hoạch ngày và khi học thêm. Lộ trình chỉ lưu tham số sinh (`learning_paths.generated_from`), trạng thái từng đơn vị nằm ở `unit_progress` (data-model §2.11). Vì vậy đơn vị admin mới kích hoạt có mặt ngay ở lần tính kế tiếp (sau TTL bộ đệm nội dung ≤ 60 giây) và đơn vị bị vô hiệu hóa tự động bị loại (SC-008); kế hoạch ngày đã sinh không bị đổi.
  - **Ngoài phạm vi nội dung (N2/N1)**: nội dung Giai đoạn 1 chỉ có N5–N3. Trình độ tự khai báo N2/N1 → điểm xuất phát N3 (chỉ các đơn vị N3 chưa thành thạo, sau đó là ôn tập và học thêm); mục tiêu JLPT N2/N1 → khoảng trình độ cắt ở N3, tiến độ mục tiêu (FR-028) tính trên phần nội dung hiện có. Cả hai trường hợp trả `scopeNotice='content_ceiling_n3'`; onboarding báo trước giới hạn này trước khi hoàn tất (giống trường hợp kỹ năng chưa hỗ trợ).
  - **Lý do sinh lộ trình**: mỗi lộ trình lưu `reason` (`onboarding`, `rebuild_request`, `goal_change`, `level_change`, `placement_retake`) để đo SC-003. Đổi `currentLevel` qua `PATCH /me` sau onboarding sinh lộ trình mới với `reason='level_change'`; đổi `dailyMinutes`/`prioritizedSkill` không sinh lộ trình mới.
  - **Phân bổ theo mốc thời gian**: ước lượng số đơn vị mới/ngày cần thiết = tổng đơn vị còn lại / số ngày đến mốc; chỉ dùng để đánh giá "đúng tiến độ" (FR-028), không được phép làm vượt quỹ thời gian.
  - **Kế hoạch ngày** (tạo lười khi mở app lần đầu trong ngày địa phương, lưu lại để idempotent): quỹ thời gian `B` (phút). Dành tối đa **60%** `B` cho ôn tập, sắp theo mức quá hạn giảm dần (ưu tiên "mục khó"); phần còn lại cho đơn vị mới có `est_minutes ≤` phần còn lại, mỗi đơn vị ước lượng ∈ {5, 10, 15}. Nếu không có bài ôn đến hạn, toàn bộ quỹ dành cho bài mới và ngược lại. Tổng ước lượng KHÔNG ĐƯỢC vượt `B`. Với `B = 5`, phần dư sau khi dành 60% cho ôn (2 phút) nhỏ hơn đơn vị mới nhỏ nhất (5 phút), nên kế hoạch là HOẶC chỉ bài ôn (≤ 5 phút) HOẶC một đơn vị mới 5 phút, luân phiên: ngay sau một ngày chỉ-ôn thì ưu tiên đơn vị mới (nếu còn); ngược lại ưu tiên ôn nếu có bài đến hạn. Quy tắc luân phiên áp dụng cho mọi `B` khi phần dư < 5 phút. Với `B = 5`, kế hoạch chỉ gồm các mục ≤ 5 phút (nội dung PHẢI có đơn vị 5 phút cho mỗi trình độ/kỹ năng – quy tắc kiểm tra nội dung).
    - **Ước lượng thời gian ôn**: mỗi mục ôn được ước lượng `REVIEW_SECONDS_PER_ITEM` giây (cấu hình, mặc định 30). Một gói ôn gồm `n` mục có `est_minutes = ceil(n × REVIEW_SECONDS_PER_ITEM / 60)`; số mục tối đa cho quỹ ôn `R` phút là `floor(R × 60 / REVIEW_SECONDS_PER_ITEM)`.
    - **Chia gói ôn (Nguyên tắc I, FR-017)**: quỹ ôn `R = floor(0,6 × B)` (hoặc `R = B` khi không còn bài mới phù hợp hoặc ở ngày chỉ-ôn) được chia đều thành `k = ceil(R / 15)` gói, mỗi gói có `est_minutes` trong khoảng 1–15. Ví dụ: `B = 30` → `R = 18` → 2 gói 9 phút; `B = 30` chỉ-ôn → `R = 30` → 2 gói 15 phút. Mục đến hạn được phân vào gói theo thứ tự ưu tiên (quá hạn lâu nhất, mục khó trước). Tổng `est_minutes` của mọi mục vẫn KHÔNG ĐƯỢC vượt `B`.
  - **Điều chỉnh độ khó (FR-013)**: với mỗi mảng (`topic`), độ chính xác trượt trên 20 câu gần nhất; < 60% liên tiếp 2 phiên → hạ `difficulty_bias` −1 (giới hạn −2); > 90% liên tiếp 2 phiên → tăng +1 (giới hạn +2). Bias ảnh hưởng việc chọn đơn vị kế tiếp (ưu tiên đơn vị `difficulty` gần mức hiệu dụng) và thêm đơn vị củng cố cho mảng yếu.
  - **Sau khoảng nghỉ (FR-015)**: nếu vắng ≥ 2 ngày, số bài ôn quá hạn không bị cộng dồn thành khối lượng bù: kế hoạch vẫn bị chặn bởi 60% `B`; các mục quá hạn dư được dời lịch dần (phân tán qua các ngày sau, giữ `due_date` gốc để ưu tiên), `DailyPlan.notice` mang mã `replanned_after_gap` và giao diện không hiển thị "nợ". Chuỗi ngày học xử lý theo FR chuỗi (xem R11).
  - **Tạm dừng (US5.3)**: khi `paused`, không sinh kế hoạch ngày và không tính ngày bỏ lỡ; mỗi lần tạm dừng/tiếp tục ghi một bản ghi `pause_periods`; các ngày tạm dừng được loại khỏi tính toán chuỗi/khoảng nghỉ.
  - **Học thêm (US2.5)**: endpoint "nội dung bổ sung" trả thêm đơn vị tiếp theo ngoài kế hoạch mặc định; không ghi đè kế hoạch mặc định.
- **Lý do**: Quy tắc rõ ràng, kiểm thử được bằng hồ sơ đại diện (FR-035), phù hợp "cá nhân hóa dựa trên quy tắc" ở Giả định, và chừa chỗ cho Giai đoạn 2 thay thế bằng mô hình ML qua cùng giao diện `PlanStrategy`.
- **Phương án đã xem xét**: cây lộ trình cố định theo cấp độ (vi phạm Nguyên tắc II); mô hình ML (ngoài phạm vi giai đoạn).

## R8. Bài kiểm tra trình độ (FR-006, FR-007, FR-009)

- **Quyết định**: Ngân hàng 20 câu cố định (từ vựng + ngữ pháp, gắn trình độ N5/N4/N3: khoảng 8 N5, 6 N4, 6 N3; gắn `topic`), tối đa 10 phút (đồng hồ phía client, phía server chỉ chấp nhận trong giới hạn khoan dung). Chấm trên server. Trình độ ước tính = trình độ cao nhất mà tỷ lệ đúng của nhóm ≥ 60%, đồng thời yêu cầu các nhóm thấp hơn đạt ≥ 60%; mảng yếu = `topic` có tỷ lệ đúng < 50%. Kết quả đoán mò (tỷ lệ đúng tổng ≤ 25%, tức xấp xỉ ngẫu nhiên với 4 lựa chọn) → trình độ "người mới".
- **Lý do**: Đúng với yêu cầu đã làm rõ, đơn giản và tất định, dễ kiểm thử.

## R9. Dùng thử không đăng ký (FR-036 → FR-040)

- **Quyết định**:
  - **Không có phiên phía server**. Nội dung dùng thử lấy từ endpoint công khai chỉ đọc `GET /trial/content` (tập đơn vị học đánh dấu `is_trial = true` do admin chỉ định; mặc định ban đầu **2 đơn vị**: 1 từ vựng + 1 ngữ pháp, mỗi đơn vị 5 phút nên tổng ≤ 10 phút, phù hợp ràng buộc `est_minutes ∈ {5,10,15}`).
  - Bài tập dùng thử được chấm **phía client** từ dữ liệu đáp án trả về trong payload dùng thử (đây là nội dung công khai, không nhạy cảm); trạng thái lưu trong `sessionStorage`/`localStorage` của trình duyệt qua abstraction `LocalStore`.
  - Bài kiểm tra trình độ dùng thử: client lấy câu hỏi từ `GET /placement/questions` (công khai, không kèm đáp án) và gửi câu trả lời đến `POST /trial/placement/grade` (**chấm không lưu**, không ghi nhật ký định danh) để nhận kết quả; kết quả và các câu trả lời được giữ ở trình duyệt.
  - Khi đăng ký trên cùng trình duyệt, client gửi **các câu trả lời** (không phải kết quả) tới `POST /placement/submit` để server chấm lại và lưu (chống giả mạo kết quả); người học có thể bỏ (xóa khỏi trình duyệt) để làm lại.
  - **Đo chuyển đổi (SC-011)**: Chỉ tăng các bộ đếm tổng hợp ẩn danh theo ngày trong `aggregate_daily_stats` (không IP, không định danh): `GET /trial/content` → `trial_content_loaded`; `POST /trial/placement/grade` → `trial_placement_completed` và `trial_placement_level_*`; client gọi `POST /trial/events` (`{event: lesson_completed}`, không kèm dữ liệu nào khác) khi khách hoàn thành bài mẫu → `trial_lesson_completed`. Khi đăng ký ngay sau dùng thử, client gửi cờ `fromTrial=true` trong `POST /auth/register`; tỷ lệ chuyển đổi = số tài khoản có `fromTrial` / `trial_lesson_completed`.
  - **Giới hạn tần suất**: `@fastify/rate-limit` theo IP – `/trial/*` (kể cả `POST /trial/events`) và `/placement/questions`: **60 yêu cầu/phút/IP**; `POST /trial/placement/grade`: **10 yêu cầu/phút/IP**; `/auth/*`: **10 yêu cầu/phút/IP** cho đăng ký/đăng nhập/đặt lại. Máy chủ KHÔNG ghi địa chỉ IP vào CSDL (chỉ bộ đếm trong bộ nhớ, hết hạn nhanh) để tuân thủ FR-038; nhật ký truy cập hạ tầng ẩn/băm IP hoặc xoay vòng ngắn.
- **Lý do**: Tuân thủ FR-038 (chỉ lưu thông tin hạn chế, không định danh, không ảnh hưởng bảo mật), cho phép mang kết quả sang đăng ký.

## R10. Idempotency và đồng thời (FR-041, SC-012)

- **Quyết định**: Mọi bản ghi do client tạo (câu trả lời, khoảng thời gian học, hoàn thành mục) mang **`client_event_id` (UUID v4 do client sinh)**; bảng có ràng buộc `UNIQUE (user_id, client_event_id)` và ghi bằng `INSERT … ON CONFLICT DO NOTHING`, trả kết quả đã có khi trùng. Cập nhật `review_schedule` chỉ thực hiện khi chèn câu trả lời thành công, trong cùng một giao dịch với khóa hàng (`SELECT … FOR UPDATE`) để hai cửa sổ không làm hỏng lịch. Thời gian học được tính từ các bản ghi `study_intervals` (mỗi khoảng có id) nên không cộng trùng.
  Ngoài trùng `client_event_id`, server còn chặn trùng theo nghĩa nghiệp vụ: (1) mỗi `(session_id, exercise_id)` chỉ có một câu trả lời lượt chính (unique partial index), lần gửi sau trả lại kết quả cũ với `duplicate=true`; câu hỏi lại cuối phiên gửi `isRetry=true` và không cập nhật lịch ôn/thống kê; (2) mỗi mục chỉ cập nhật `review_schedules` tối đa một lần mỗi ngày địa phương (`last_reviewed_local_date`), kể cả khi hai cửa sổ mở hai phiên khác nhau; (3) thời gian học là độ dài hợp các khoảng, nên hai cửa sổ cùng đo giờ không làm tăng gấp đôi.
- **Lý do**: Đáp ứng SC-012 mà không cần khóa phân tán.

## R11. Múi giờ, "hôm nay" và chuỗi ngày học

- **Quyết định**: Hồ sơ lưu `timezone` (IANA, mặc định lấy từ trình duyệt khi onboarding, sửa được). "Ngày địa phương" tính từ `timezone` hiện tại của hồ sơ. Chuỗi ngày học = số ngày địa phương liên tiếp có ít nhất một hoạt động học được tính (hoàn thành ≥ 1 mục hoặc ≥ 1 câu trả lời), bỏ qua các ngày thuộc giai đoạn tạm dừng. Mỗi `study_record` lưu cả `occurred_at` (UTC) lẫn `local_date` tại thời điểm xảy ra để việc đổi múi giờ sau đó không làm đứt chuỗi đã tính.
- **Lý do**: Đáp ứng trường hợp biên về múi giờ.

## R12. Phiên học, tiếp tục dở dang và thay đổi nội dung khi đang học (FR-020; trường hợp biên)

- **Quyết định**: Khi bắt đầu một đơn vị học, server tạo `lesson_session` chứa **ảnh chụp (snapshot JSONB)** của các bài tập (đã bản địa hóa theo ngôn ngữ hiện tại) và trạng thái (`in_progress`/`completed`). Mỗi câu trả lời được ghi ngay (idempotent) nên rời đi/quay lại tiếp tục từ câu chưa trả lời. Admin sửa nội dung chỉ ảnh hưởng phiên mới. Mất kết nối: client giữ hàng đợi các sự kiện chưa gửi (trong bộ nhớ/`LocalStore`), thử lại với cùng `client_event_id`; đơn vị chỉ được tính hoàn thành sau khi server xác nhận.
- **Lý do**: Phiên đang học không bị gián đoạn khi admin sửa nội dung; không mất câu trả lời.

## R13. Quản lý nội dung độc lập với bản phát hành (FR-022, SC-008)

- **Quyết định**: Nội dung là dữ liệu trong PostgreSQL, quản lý qua API/Admin UI. Nội dung ban đầu (seed) viết dưới dạng **JSON/YAML** trong thư mục `content/` với **JSON Schema** kiểm tra, nạp bằng lệnh `seed`. Trường văn bản dịch (nghĩa, giải thích, phản hồi) lưu dạng `{ "vi": "...", "en": "..." }`; chữ Nhật, cách đọc, câu ví dụ lưu một bản. Người học nhận nội dung đã bản địa hóa theo `profile.language`. Bộ nhớ đệm đọc ngắn hạn (TTL ≤ 60 giây) để đảm bảo người học thấy thay đổi trong vòng 5 phút (SC-008). Đơn vị mới kích hoạt có mặt trong lộ trình của người học phù hợp ở lần tính kế tiếp vì thứ tự đơn vị được tính động (R7); không cần job đồng bộ lộ trình.
- **Quy tắc kiểm tra nội dung** (chạy ở seed và ở khi admin kích hoạt): mỗi đơn vị có `est_minutes ∈ {5,10,15}`; mỗi trình độ × kỹ năng có ít nhất một đơn vị 5 phút; mỗi bài tập có tập đáp án cố định hợp lệ; bản dịch vi và en đều đầy đủ trước khi kích hoạt.

## R14. Frontend Flutter (Nguyên tắc V)

- **Quyết định**: Flutter (kênh stable) mục tiêu **web**; quản lý trạng thái **Riverpod**, điều hướng **go_router**, HTTP **dio**, i18n bằng **ARB + `flutter_localizations`/`intl`** (vi mặc định, en). Cấu trúc theo lớp: `domain` (thực thể, không phụ thuộc Flutter), `data` (repository + API client sinh từ OpenAPI), `presentation` (widget). Mọi truy cập đặc thù nền tảng (lưu trữ token/bộ nhớ cục bộ, múi giờ, mở liên kết) đi qua giao diện trong `lib/platform/` với triển khai `web` riêng, để thêm Android/iOS sau này chỉ cần thêm triển khai mới.
- **Giao diện quản trị**: đặt trong cùng ứng dụng Flutter ở nhánh route `/admin/*`, bị chặn theo vai trò (client chỉ để ẩn UI; bảo vệ thực sự ở server – FR-004).
- **Lý do**: Một codebase, đáp ứng yêu cầu bắt buộc "client dùng Flutter"; Riverpod dễ kiểm thử.

## R15. Kiểm thử (FR-035, Hiến pháp: kiểm thử engine bằng hồ sơ đại diện)

- **Quyết định**:
  - Backend: **Vitest**; (a) kiểm thử đơn vị engine bằng hồ sơ đại diện dạng fixture (người mới/10 phút, N3/30 phút, quay lại sau khoảng nghỉ, placement đoán mò, 5 phút nhiều bài ôn tồn đọng, liên tục điểm thấp ở một mảng, liên tục điểm cao ở một mảng, mảng yếu đã hồi phục, N2/mục tiêu JLPT N1), (b) kiểm thử hợp đồng đối chiếu với `contracts/openapi.yaml`, (c) kiểm thử tích hợp với PostgreSQL thật qua Testcontainers hoặc docker compose, gồm kịch bản hai cửa sổ đồng thời (SC-012).
  - Client: `flutter test` (widget + đơn vị) và `integration_test` chạy trên Chrome cho các luồng P1.
  - Hồ sơ đại diện nằm trong `backend/tests/fixtures/learner-profiles/` và dùng chung giữa các bài kiểm thử.
- **Lý do**: Đáp ứng yêu cầu kiểm thử bắt buộc của hiến pháp.

## R16. Bảo mật và quyền riêng tư (FR-034)

- **Quyết định**: HTTPS bắt buộc (TLS ở reverse proxy), HSTS, CSP; mật khẩu argon2id; mọi truy vấn dữ liệu người học luôn lọc theo `user_id` từ token (không nhận `user_id` từ client); quyền admin kiểm tra bằng middleware theo vai trò; thông điệp lỗi đăng ký/đăng nhập không tiết lộ dữ liệu người khác (trừ trường hợp email đang chờ xóa theo FR-003 đã được đặc tả thừa nhận). Mã hóa đĩa/sao lưu ở mức hạ tầng: yêu cầu vận hành (volume PostgreSQL và bản sao lưu được mã hóa, TLS ở reverse proxy) được ghi trong tài liệu triển khai `backend/README.md` (T118). Xóa vĩnh viễn: job xóa cứng bản ghi người dùng và mọi dữ liệu liên quan (cascade), chỉ giữ thống kê tổng hợp ẩn danh (không có khóa ngoại tới người dùng).
- **Lý do**: Đáp ứng FR-003, FR-034.

## R17. Hiệu năng (SC-010)

- **Quyết định**: Chỉ mục trên `(user_id, due_date)`, `(user_id, local_date)`, `(unit_id)`; kế hoạch ngày được lưu sau lần tính đầu tiên; thứ tự đơn vị của lộ trình tính động trong bộ nhớ từ bộ đệm nội dung (cỡ vài trăm đơn vị N5–N3, chi phí nhỏ); nội dung đã bản địa hóa lấy từ bộ đệm bộ nhớ TTL ngắn; phản hồi chấm bài trả ngay trong yêu cầu ghi câu trả lời (một giao dịch ngắn). Mục tiêu p95 < 500 ms phía server để dành ngân sách cho mạng và render (< 1 s đầu cuối). "Tải bình thường" = 1.000 người học đồng thời (SC-010); thời gian đầu-cuối được đo ở client bằng `integration_test` trên Chrome trong lúc chạy tải k6, không chỉ dựa vào số liệu phía server.

## R18. Triển khai

- **Quyết định**: `docker compose` gồm `api` (Node), `db` (PostgreSQL), `mailpit` (chỉ dev); client web được build tĩnh (`flutter build web`) và phục vụ bởi nginx/CDN, cùng reverse proxy cho API (`/api`). Cấu hình qua biến môi trường.
- **Lý do**: Đủ cho quy mô MVP, đơn giản hóa vận hành.
