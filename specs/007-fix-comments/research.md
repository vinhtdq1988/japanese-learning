# Nghiên cứu (Phase 0): Hoàn thiện trải nghiệm học theo góp ý

**Nhánh**: `007-fix-comments` | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Tài liệu ghi các quyết định kỹ thuật (P1…P14) và các **điểm cần chủ dự án xác nhận** (C1…C8). Mỗi quyết định theo dạng Quyết định / Lý do / Phương án đã cân nhắc. Không còn mục NEEDS CLARIFICATION.

Nền tảng đã khảo sát trong mã nguồn (để các quyết định bám vào cái đã có):

- `skill` là enum PostgreSQL dùng chung cho `topics.skill`, `learning_units.kind`, `content_items.kind`, `learning_profiles.skills/prioritized_skill` (spec 003 đã thêm `kanji` đúng cách này: [0002_kanji_skill.sql](../../backend/src/db/migrations/0002_kanji_skill.sql)).
- Phiên học = đơn vị (`learning_units`) + mục (`content_items`) + bài tập (`exercises`: `multiple_choice | matching | fill_blank`); kết quả đi vào `study_records` → `topic_stats` (cửa sổ 20 câu, cờ `is_weak`) → tiến độ. Bài tập **không gắn mục** (`item_id = NULL`) không vào ôn tập SRS (tiền lệ bài `matching` của Kanji).
- Kế hoạch ngày: `engine/daily-plan.ts` (`planDailyPlan` chặn cứng tổng ≤ quỹ phút; `applyKanjiSlot` là tiền lệ "suất" ưu tiên một kỹ năng).
- Nguồn học (cá nhân/lớp) quyết định ở **một điểm duy nhất** `resolveLearningContext` ([learning-context.ts](../../backend/src/services/learning-context.ts)); hồ sơ hiệu lực của học viên lớp được chồng trong bộ nhớ.
- Màn Tiến độ đã có `weakTopics` (cờ `is_weak`: < 60% với ≥ 8 câu, bỏ cờ khi ≥ 70% – [difficulty.ts](../../backend/src/engine/difficulty.ts)) và `currentStreakDays`, `onTrack`, `notice = replanned_after_gap` ([progress.ts](../../backend/src/services/progress.ts), [daily-plan.ts](../../backend/src/services/daily-plan.ts)).

---

## Nhóm A – Luyện đọc và luyện viết (US2)

### P1. Luyện đọc/viết là hai giá trị mới của enum `skill` (`reading`, `writing`), tái dùng toàn bộ máy móc đơn vị–phiên

- **Quyết định**: thêm `reading` và `writing` vào enum `skill`, hằng `SKILLS`, schema nội dung; mỗi bài luyện là một **đơn vị học** (`learning_units.kind = 'reading' | 'writing'`) có chủ đề (`topics`) riêng theo trình độ N5–N3. Phiên, chấm điểm, `study_records`, `topic_stats`, tiến độ, kế hoạch ngày, admin nội dung, seed đều dùng lại. Không bảng mới, không route phiên mới. Migration `0006_practice_skills.sql` chỉ `ALTER TYPE skill ADD VALUE` (tách file như 0002).
- **Lý do**: (1) FR-010 (ghi vào tiến độ) và FR-017 (năng lực gồm kết quả đọc/viết) được thỏa tự nhiên vì kết quả đi cùng đường với mọi bài khác; (2) FR-012/Nguyên tắc VI: nội dung là dữ liệu quản lý được bằng Admin API/seed hiện có; (3) bật/tắt (FR-013, Nguyên tắc III) chính là danh sách `skills` của hồ sơ – cơ chế đã có, đã có khóa theo lớp (`CLASS_LOCKED_PROFILE_FIELDS` chứa `skills`) nên FR-025 thỏa không cần mã mới; (4) chi phí thấp nhất (xem Theo dõi độ phức tạp).
- **Đã cân nhắc**: (a) *Hệ thống "bài luyện" riêng* (bảng `practice_sets`, `practice_attempts`, route riêng): thêm 3–4 bảng, một luồng chấm và ghi tiến độ thứ hai phải đồng bộ với `topic_stats`/chuỗi ngày/thành tựu – bác vì trùng lặp. (b) *Cờ boolean `practiceEnabled` thay vì skill*: không có chỗ cho nội dung/chủ đề/màu theo kỹ năng, phải sửa mọi nơi liệt kê kỹ năng bằng đường khác – bác.

### P2. Điều kiện "quỹ thời gian ≥ 30 phút" kiểm ở máy chủ tại bốn điểm, dùng một hàm `practiceEligible`

- **Quyết định**: hằng `PRACTICE_MIN_DAILY_MINUTES = 30` và hàm thuần `effectiveSkills(skills, dailyMinutes)` (bỏ `reading`/`writing` khi phút < 30) trong `domain/practice.ts`. Áp dụng:
  1. **Hồ sơ hiệu lực** – `resolveLearningContext` (cả nhánh cá nhân lẫn lớp): `profile.skills`, `params.skills` và `template.skills` (lớp) đều qua `effectiveSkills` với **phút đang áp dụng** (đã tính ghi đè của giáo viên). Từ đó kế hoạch ngày, `GET /path`, `POST /today/extra`, tiến độ và xếp hạng tự loại hai kỹ năng này khi không đủ điều kiện (FR-006, US2.2/2.5/2.7, SC-003) mà không sửa từng nơi.
  2. **Ghi hồ sơ** – `PATCH /me` và hoàn tất onboarding: **thêm mới** `reading`/`writing` vào `skills` khi phút sau cập nhật < 30 bị từ chối `422 VALIDATION_FAILED` (`fields.skills`). Giá trị đã lưu từ trước KHÔNG bị xóa khi hạ phút (chỉ bị lọc khỏi hồ sơ hiệu lực) nên nâng lại 30 phút thì lựa chọn cũ có lại (FR-011, Nguyên tắc III) và một lần `PATCH skills` khác không bị chặn vì giá trị cũ.
  3. **Bắt đầu phiên** – `startSession` (kể cả "học thêm" theo `unitId`): đơn vị `reading`/`writing` khi không đủ điều kiện → `403 PRACTICE_LOCKED` (mã lỗi mới, kèm `fields.minimumDailyMinutes = "30"`). Chặn cả đường gọi API trực tiếp khi mục kế hoạch cũ còn sót (SC-003).
  4. **Nộp/hoàn thành phiên** – `submitAnswer`/`completeSession`/`recordInterval` của phiên có đơn vị luyện: cùng kiểm tra → `403 PRACTICE_LOCKED`. Phiên dở dang vẫn `in_progress` và tiếp tục được khi nâng lại phút (không mất dữ liệu).
- **Lý do**: spec FR-006 đòi kiểm ở máy chủ, "kể cả thao tác trực tiếp qua giao diện lập trình". Điểm 1 là điểm lọc duy nhất nên không thể sót ở kế hoạch/lộ trình; điểm 3–4 bịt đường vào trực tiếp.
- **Đã cân nhắc**: lọc rải rác ở từng service (dễ sót khi thêm màn mới – bác); xóa `reading`/`writing` khỏi `skills` khi hạ phút (mất lựa chọn người học, trái FR-011 và Nguyên tắc III – bác); dùng `FORBIDDEN` chung (client không phân biệt được để hiện lý do "từ 30 phút" – bác, `CLASS_MANAGED` là tiền lệ mã riêng).
- **Hệ quả cần kiểm thử**: `GET /me` trả `skills` **đã lưu** (không lọc) để màn Hồ sơ hiện đúng lựa chọn; chỉ ngữ cảnh học (`LearningContext`) mới lọc. Bảo đảm không có chỗ nào ghi `ctx.profile` ngược vào CSDL (rà soát khi hiện thực).

### P3. Đưa luyện đọc/viết vào kế hoạch ngày bằng "suất luyện tập" (`applyPracticeSlot`), không đổi `planDailyPlan`

- **Quyết định**: thêm hàm thuần `applyPracticeSlot(candidates, input)` vào `engine/daily-plan.ts`, theo đúng khuôn `applyKanjiSlot`: chạy **trước** `planDailyPlan`, chỉ sắp lại thứ tự ứng viên đơn vị mới. Quy tắc:
  - No-op khi `skills` hiệu lực không có `reading`/`writing` hoặc không có ứng viên luyện vừa quỹ (`estMinutes ≤ B`).
  - Cứ **cách một kế hoạch có bài mới** (hằng `PRACTICE_EVERY_N_PLANS = 2`; ngày đầu/chưa từng có thì có ngay) đưa một ứng viên luyện lên vị trí 0, **luân phiên** `reading` ↔ `writing` (loại đối lập với lần luyện gần nhất; nếu loại đó hết ứng viên vừa quỹ thì lấy loại còn lại). `prioritizedSkill` thuộc {reading, writing} thì đưa lên mỗi ngày.
  - Thứ tự áp: `applyPracticeSlot` rồi `applyKanjiSlot` (Kanji vẫn lên đầu như spec 003, luyện đứng thứ hai); phần còn lại `pickNewUnits` (first-fit) và giới hạn 60% ôn tập, luân phiên ôn/mới **không đổi** → tổng `estMinutes` không bao giờ vượt quỹ (FR-013, Nguyên tắc I).
  - Nguồn "lần luyện gần nhất": mở rộng `lastNewUnitPlanKinds` (đã trả mảng `kind` của kế hoạch có bài mới gần nhất) – không truy vấn mới.
- **Lý do**: giữ nguyên các bất biến đã có kiểm thử (quỹ, 60% ôn, luân phiên); người học không chọn luyện thì kế hoạch **giống hệt** (golden không đổi, như SC-006 của spec 003). Không hút hết quỹ: bài luyện 5–10 phút chen cùng bài khác.
- **Đã cân nhắc**: nhân điểm xếp hạng cho luyện trong `rankUnits` (khó đảm bảo xuất hiện đều đặn, đụng golden của mọi người học – bác); luyện mỗi ngày (chiếm chỗ từ vựng/ngữ pháp của quỹ 12 phút bài mới – bác, hằng số chỉnh được).
- **Giới hạn thời lượng phiên**: nội dung biên soạn 5 hoặc 10 phút (tối đa 15) nên mỗi phiên luôn trong 5–15 phút (FR-005, US2.6); quy tắc đo ở P4.

### P4. Mô hình nội dung luyện đọc/viết và quy tắc kiểm tra

- **Quyết định**: dùng đúng cấu trúc đơn vị hiện có; thêm quy tắc riêng trong `content-validation.ts` (như `validateKanjiUnit`) và nâng JSON Schema nội dung `unit` 1.1.0 → **1.2.0** (ghi `content/schema/CHANGELOG.md`). Chi tiết ở [contracts/practice-content.md](contracts/practice-content.md). Tóm tắt:
  - **Luyện đọc** (`kind: reading`): đúng **một mục** `kind: reading` – `japanese` là đoạn văn (≤ 400 ký tự), `reading` là bản kana tùy chọn, `meaning` là bản dịch vi/en, `explanation` ghi chú từ khó; 2–5 bài tập `multiple_choice`, **không gắn mục** (`item = null`, `facet = item`), có phản hồi đúng/sai giải thích (FR-008). Khung thời lượng: `số câu × 60 giây ≤ estMinutes × 60`.
  - **Luyện viết** (`kind: writing`): 3–6 mục `kind: writing` (`japanese` = từ/chữ/câu cần gõ, `reading` kana, `meaning`); mỗi mục có đúng một bài `fill_blank` **không gắn mục**, đề bài nêu nghĩa (và gợi ý cách đọc), `accepted_answers` liệt kê **mọi dạng chấp nhận** (kanji, hiragana…) vì bộ chấm chỉ chuẩn hóa NFKC/khoảng trắng/chữ thường, không đổi hiragana↔katakana hay kana↔kanji ([grading.ts](../../backend/src/domain/grading.ts)). Khung thời lượng: `số câu × 45 giây ≤ estMinutes × 60`. Viết tay/nhận dạng nét/thứ tự nét bị cấm (FR-009).
  - `estMinutes ∈ {5, 10}` khi biên soạn (hợp lệ chung vẫn 5/10/15); mọi ký tự Nhật phải có glyph trong phông đóng gói (kiểm tra có sẵn).
  - Danh mục: mỗi (trình độ × `reading`/`writing`) có ≥ 1 đơn vị 5 phút (tự có khi `SKILLS` mở rộng – `validateCatalog` duyệt `SKILLS`), cộng cam kết ra mắt ở C2.
- **Lý do**: không đổi schema bảng nội dung; chấm điểm `multiple_choice`/`fill_blank` đã được kiểm thử. Không gắn mục để không vào SRS: ôn lại một câu hiểu đoạn văn hay câu gõ theo gợi ý không phải "ghi nhớ một mục" và sai giả định `REVIEW_SECONDS_PER_ITEM` (C6).
- **Đã cân nhắc**: thêm cột `passage` vào `learning_units` (đổi schema bảng chỉ để chứa một chuỗi, trong khi `content_items.japanese` đã đủ – bác); tạo dạng bài tập mới `typed_sentence` (đổi enum bài tập + bộ chấm + client; `fill_blank` đủ cho gõ bàn phím – bác); nhận dạng chữ viết tay (ngoài phạm vi, FR-009).

### P5. Đoạn văn hiển thị cố định phía trên câu hỏi — thuần client, snapshot không đổi

- **Quyết định**: bước giới thiệu (`LessonPhase.intro`) hiện đoạn văn như mọi mục; ở bước làm bài (`exercises`) màn học **ghim** đoạn văn (mục `kind = reading` trong `items` của phiên) phía trên câu hỏi dưới dạng bảng có thể thu gọn. Không đổi snapshot, `PublicExercise` hay API.
- **Lý do**: học viên cần nhìn lại đoạn văn khi trả lời; client đã có `items` của phiên. Không thêm trường hợp đồng.
- **Đã cân nhắc**: nhân đoạn văn vào `prompt` từng câu (lặp dữ liệu, sửa nội dung ở nhiều chỗ – bác); trả `context` trong `PublicExercise` (đổi hợp đồng không cần thiết – bác).

### P6. Gõ tiếng Nhật bằng IME trên Web

- **Quyết định**: dùng lại `FillBlankExercise` (TextField của Flutter web hỗ trợ IME). Rủi ro: phím Enter dùng để chốt chữ đang soạn (composition) có thể bị hiểu là "Kiểm tra". Hiện thực đặt kiểm thử widget mô phỏng `composing` không rỗng và, nếu cần, bỏ qua `onSubmitted` khi `controller.value.composing.isValid`; nút "Kiểm tra" luôn dùng được. Cần chạy thử tay với IME thật (Microsoft IME/Google Japanese Input) trên Chrome/Edge/Safari trước phát hành.
- **Lý do**: Nguyên tắc V (không đưa mã riêng nền tảng ra ngoài lớp trừu tượng) – không cần mã mới, chỉ bảo đảm hành vi.

---

## Nhóm B – Màu sắc theo năng lực (US3)

### P7. Quy tắc phân loại năng lực: một hàm thuần, ba mức, dùng cùng dữ liệu với "mảng yếu"

- **Quyết định**: `engine/competency.ts`, hàm `classifyCompetency({ answered, correct })` trả `'good' | 'needs_improvement' | 'insufficient'` (hằng `COMPETENCY_MIN_ANSWERS = WEAK_MIN_ANSWERS = 8`, `COMPETENCY_GOOD_AT = RECOVER_AT = 0.7`):
  - `answered < 8` → `insufficient` (xám trung tính, "chưa đủ dữ liệu" – FR-016).
  - `accuracy ≥ 0.70` → `good` (xanh lục).
  - ngược lại (`accuracy < 0.70`) → `needs_improvement` (vàng nhạt).
  - Ngưỡng đúng 0.70 thuộc `good` (một mức duy nhất, không hai màu – tình huống biên).
  Dữ liệu vào là cửa sổ 20 câu lượt chính gần nhất đã có trong `topic_stats.recent_results` (không tính câu hỏi lại cuối phiên) nên kết quả luyện đọc/viết tự được tính (FR-017).
- **Nhất quán với "mảng làm kém"**: `is_weak` đặt khi `< 0.60` (≥ 8 câu) và chỉ bỏ khi `≥ 0.70`, nên mọi mảng `is_weak` luôn có `accuracy < 0.70` ⇒ luôn `needs_improvement`; không bao giờ một mảng vừa xanh vừa nằm trong `weakTopics`. Danh sách mảng yếu là **tập con** của mảng vàng (khoảng [0.60, 0.70) chưa bị coi là "yếu" nhưng "cần cải thiện" – C3). Kiểm thử thuộc tính: ∀ hồ sơ mẫu, `weakTopics ⊆ needs_improvement` và `good ∩ weakTopics = ∅`.
- **Lý do**: dùng đúng hằng số đã có nên không thêm khái niệm ngưỡng thứ hai; Giả định của spec yêu cầu "thống nhất với tiêu chí mảng làm kém".
- **Đã cân nhắc**: dải trung gian thứ tư ("khá") – spec chốt ba màu, bác; ngưỡng riêng 80% cho xanh (lệch với `RECOVER_AT`, tạo vùng 70–80% vừa không yếu vừa không xanh – bác).

### P8. Hai mức hiển thị: kỹ năng (gộp) và chủ đề; tính một lần, trả trong ba DTO sẵn có

- **Quyết định**: "đầu mục học tập" = **kỹ năng** (5 giá trị) và **chủ đề** (khi hiển thị dạng đầu mục). Năng lực kỹ năng = gộp kết quả cửa sổ của mọi chủ đề thuộc kỹ năng đó (tổng đúng / tổng trả lời, cùng quy tắc P7). Dịch vụ `services/competency.ts` (`loadCompetency(db, userId)`) đọc `topic_stats` JOIN `topics` **một truy vấn** và dựng cả hai bản đồ; ba màn dùng chung nên nhất quán (FR-018, SC-005):
  - `GET /progress` thêm `competency: { skills: [...], topics: [...] }` (kỹ năng luôn đủ 5 dòng cho kỹ năng đang bật hoặc đã có dữ liệu; chủ đề chỉ những chủ đề có dữ liệu hoặc `weakTopics`).
  - `GET /today` thêm `competency` (mức của **kỹ năng**) cho từng mục `new_unit`; `review_batch` không có kỹ năng đơn → `null` (hiển thị trung tính, không tô màu).
  - `GET /path` thêm `competency` (mức của **chủ đề**) cho từng đơn vị trong lộ trình.
  Chi tiết trường ở [contracts/api-changes.md](contracts/api-changes.md); quy tắc ở [contracts/competency-rules.md](contracts/competency-rules.md).
- **Lý do**: client không tự tính màu (Nguyên tắc VI); tính từ bảng thống kê đã có nên không thêm bảng, không job; màu cập nhật ngay khi `topic_stats` đổi (FR-018, US3.4).
- **Đã cân nhắc**: endpoint riêng `GET /competency` (thêm một vòng gọi mạng ở mỗi màn, dễ lệch phiên bản giữa các màn – bác); lưu mức năng lực vào bảng (trạng thái thứ hai dễ lệch – bác); client tự phân loại từ `accuracy` (nhân đôi quy tắc – bác).

### P9. Màu và khả năng tiếp cận

- **Quyết định**: bổ sung `CompetencyPalette` (ThemeExtension) trong `presentation/shared/theme.dart` với bộ token sáng/tối cho ba mức: **xanh lục** (nền nhạt + chữ/viền xanh đậm), **vàng nhạt** (nền vàng nhạt + chữ nâu sẫm), **trung tính** (nền `surfaceContainer`). Mọi nhãn dùng cặp (màu, biểu tượng, nhãn chữ): ✓ "Tốt", ▲/! "Cần cải thiện", ○ "Chưa đủ dữ liệu" (FR-019). Widget dùng chung `CompetencyChip` + `CompetencyLegend` (chú giải ngắn nêu ba màu, FR-020) đặt ở Hôm nay, Lộ trình, Tiến độ. Kiểm thử đơn vị tính **tỷ lệ tương phản WCAG** của từng cặp (chữ/nền) ≥ 4.5:1 ở cả hai giao diện sáng/tối.
- **Lý do**: màu không là kênh duy nhất (FR-019, SC-006); kiểm tra tương phản tự động thay cho việc xem tay.
- **Đã cân nhắc**: dùng màu cố định không theo giao diện tối (chữ khó đọc ở nền tối – bác); đổi màu nhấn đỏ son của ứng dụng (ngoài phạm vi).

---

## Nhóm C – Gợi ý mặc định theo thời gian (US1)

### P10. Bảng gợi ý là dữ liệu do backend sở hữu, một endpoint tĩnh `GET /study-defaults`

- **Quyết định**: hàm thuần `domain/study-defaults.ts` giữ bảng (Giả định của spec): `5 → [vocabulary]`, `10 → [vocabulary, grammar]`, `15 → [vocabulary, grammar, kanji]`, `30 → [vocabulary, grammar, kanji, reading, writing]`. Endpoint `GET /study-defaults` (cần đăng nhập, chỉ đọc, cacheable) trả toàn bộ bảng cùng `practiceMinDailyMinutes = 30`. "Bật luyện đọc/viết" chính là có `reading`/`writing` trong `skills` (P1) nên bảng chỉ cần danh sách kỹ năng (FR-021).
- **Bất biến kiểm thử**: danh sách kỹ năng **tăng dần** theo phút (tập con của mức trên); `reading`/`writing` chỉ ở mức 30 (FR-022); mô phỏng kế hoạch bằng engine với từng bộ mặc định luôn `estimatedMinutes ≤ B` (US1.5 – khối lượng do engine chặn, bảng chỉ chọn kỹ năng).
- **Lý do**: Nguyên tắc VI – quy tắc nghiệp vụ không nằm cứng ở client; client chỉ hiển thị và so sánh. Một bảng nhỏ nên một lần tải là đủ, không cần tham số.
- **Đã cân nhắc**: hằng số trong client (hai nơi sửa khi tinh chỉnh bảng, trái Nguyên tắc VI – bác); truy vấn theo phút `?dailyMinutes=` (4 vòng gọi, không giúp gì – bác); bảng trong CSDL/Admin (bề mặt quản trị chưa ai yêu cầu – bác, chuyển sau không đổi hợp đồng).

### P11. "Không ghi đè lựa chọn người học": phát hiện "chưa chỉnh" bằng so sánh, không thêm trạng thái

- **Quyết định**: một hàm thuần phía client `reconcileSuggestion(currentSkills, oldMinutes, newMinutes, table)`:
  - Nếu `currentSkills` (sắp xếp) **bằng** gợi ý của `oldMinutes` hoặc rỗng ⇒ coi là "chưa chỉnh" ⇒ **điền** gợi ý của `newMinutes` (nhãn "gợi ý theo thời gian bạn có", FR-023).
  - Ngược lại ⇒ **giữ nguyên** và chỉ hiện lời mời "Gợi ý mới cho {N} phút: … [Áp dụng] [Giữ nguyên]" (FR-024, US1.2/1.4).
  Dùng ở **onboarding** (bước thời gian → bước kỹ năng) và **Hồ sơ** (sau khi lưu quỹ thời gian mới). Ở Hồ sơ máy chủ chỉ lưu phút; việc đổi `skills` chỉ xảy ra khi người học bấm "Áp dụng" (PATCH `skills`) – không có đường ghi đè ngầm (FR-024). Học viên thuộc lớp: các điều khiển bị khóa nên không hiện lời mời áp dụng cho trường bị khóa (FR-025); lời mời chỉ là chuỗi thông tin ở nơi không khóa.
- **Lý do**: không thêm cột/trường nháp nào (bản nháp onboarding lưu `skills` đã điền, không cần cờ "đã chỉnh"); rút gọn thành phép so sánh tất định, kiểm thử bằng bảng.
- **Đã cân nhắc**: cờ `skillsCustomized` trong nháp onboarding và hồ sơ (đổi hợp đồng + migration cho thông tin suy ra được – bác).

---

## Nhóm D – Lời khích lệ (US4)

### P12. Chọn trạng thái và biến thể ở backend, trả trong `GET /today`; nội dung là danh mục trong mã

- **Quyết định**: `engine/encouragement.ts` (thuần hàm) nhận tín hiệu tiến độ và trả `state`; `domain/encouragement.ts` giữ danh mục câu (6 trạng thái × ≥ 4 biến thể × vi/en, có chỗ điền `{n}` cho chuỗi ngày); `DailyPlan` thêm `encouragement: { state, message }` (đã bản địa hóa theo ngôn ngữ hồ sơ, FR-028). Chi tiết ở [contracts/encouragement-catalog.md](contracts/encouragement-catalog.md).
  - **Tín hiệu** (đều từ dữ liệu đã ghi, FR-031): trạng thái kế hoạch hôm nay (số mục xong/tổng), `currentStreakDays`, số ngày vắng (`absentDays`/`notice = replanned_after_gap`), `goal.onTrack`.
  - **Ưu tiên khi trùng** (đúng một câu hiển thị): `day_completed` > `welcome_back` > `in_progress` > `streak` (chuỗi ≥ 3 ngày) > `behind_target` (`onTrack === false`) > `not_started` (C7).
  - **Biến thể**: chọn tất định theo `(userId, ngày địa phương, state)` quay vòng qua các biến thể và **không trùng biến thể của ngày liền trước cùng trạng thái** khi có thể ⇒ trong 5 ngày liên tiếp cùng một trạng thái luôn thấy ≥ 2 câu khác nhau (FR-029, SC-008) và không nhấp nháy khi tải lại trong ngày (C4).
  - **Giọng điệu**: kiểm thử đơn vị quét toàn bộ danh mục bằng bộ từ cấm (đổ lỗi, đe dọa mất chuỗi, so sánh người khác, nhấn thất bại – FR-027, SC-007) cho vi và en; mỗi trạng thái có ≥ 3 biến thể (cam kết 4); `welcome_back` và `behind_target` không chứa từ "bỏ lỡ/chậm/trễ/missed/behind/late".
- **Lý do**: lấy trạng thái dựa trên cùng số liệu của Tiến độ (một nguồn), kiểm thử được bằng hồ sơ mẫu (FR-031); đặt ở backend giữ client "mỏng" (mobile sau này dùng lại, Nguyên tắc V/VI); chưa dùng AI (Giả định, AI Tutor ở Giai đoạn 4).
- **Đã cân nhắc**: client tự chọn câu từ `.arb` (phải kéo thêm chuỗi ngày/số ngày vắng/onTrack về client, trùng logic – bác); bảng DB + Admin quản lý câu (bề mặt chưa cần – bác); chọn ngẫu nhiên mỗi lần mở (nhấp nháy khi tải lại, khó kiểm thử – bác).

### P13. Không nhân đôi hiệu ứng chúc mừng của spec 005 (FR-030)

- **Quyết định**: lời khích lệ là **một dải chữ tĩnh** đặt trên danh sách bài trong màn Hôm nay (không lớp phủ, không âm thanh, không confetti), không thay thế tổng thời lượng hay danh sách. Màn chúc mừng gộp của 005 (`CelebrationHost`) giữ nguyên là khoảnh khắc "một lần" khi vừa hoàn thành; dải `day_completed` chỉ xuất hiện khi người học **quay lại** màn Hôm nay (kế hoạch đã `completed`) và không kích hoạt hiệu ứng. Không đổi `effects_*`.
- **Lý do**: hai kênh khác nhau về bản chất (khoảnh khắc vs. trạng thái bền); tách bằng thiết kế nên không cần phối hợp trạng thái giữa chúng.

---

## Nhóm E – Xem mật khẩu (US5)

### P14. Widget dùng chung `PasswordField` (thuần client)

- **Quyết định**: tách `PasswordField` ở `presentation/auth/` gói `TextFormField` + nút chuyển mắt: trạng thái hiện **chỉ nằm trong `State` của widget** (mặc định ẩn mỗi lần dựng, không lưu `LocalStore`, không giữ qua điều hướng – FR-002/003, US5.3). Nút là `IconButton` (focus được bằng Tab, Enter/Space kích hoạt) có `tooltip` và `Semantics(label)` đổi theo trạng thái ("Hiện mật khẩu" / "Ẩn mật khẩu", FR-004); bật hiện thì đặt `enableSuggestions: false`, `autocorrect: false`. Đổi `obscureText` không thay `TextEditingController` nên nội dung không mất (FR-003). Thay `TextFormField` mật khẩu ở **đăng nhập** (bắt buộc), **đăng ký** và **đặt lại mật khẩu** (NÊN; chi phí ≈ 0 vì dùng chung widget). Đổi mật khẩu trong Hồ sơ (`account_security_sections.dart`) dùng chung nếu cùng khuôn, không bắt buộc.
- **Lý do**: thay đổi nhỏ, độc lập, rủi ro thấp (ưu tiên P3 của spec). Thông báo lỗi đăng nhập hiện không chứa mật khẩu (kiểm thử khẳng định để chặn hồi quy – tình huống biên).
- **Đã cân nhắc**: thêm `PasswordRevealButton` rời (mỗi màn tự quản trạng thái, lặp 3 lần – bác); lưu tùy chọn "luôn hiện" (trái FR-003 – bác).

---

## Nhóm F – Hợp đồng, phạm vi giai đoạn, kiểm thử

### Q1. Hợp đồng API: OpenAPI 1.13.0 → 1.14.0, chỉ bổ sung (và một mã lỗi mới)

- **Quyết định**: (1) enum `Skill` thêm `reading`, `writing` (áp cho `Profile`, `ProfileUpdate`, `OnboardingDraft`, `PlanItem.kind`, `AdminUnit*`…); (2) `DailyPlan.encouragement`, `PlanItem.competency`; (3) `ProgressSummary.competency`; (4) `PathDetail` item `competency`; (5) `GET /study-defaults`; (6) mã lỗi `PRACTICE_LOCKED` (403). Không route nào bị đổi/xóa. Chi tiết ở [contracts/api-changes.md](contracts/api-changes.md).
- **Tương thích**: trường mới tùy chọn nên client 1.13.0 bỏ qua. Hai điểm cần lưu ý (như 004/005): enum `Skill` mở rộng và mã lỗi mới có thể làm client sinh sẵn cũ không phân tích được giá trị lạ – **phát hành client và backend cùng lúc** (đã là thực hành của dự án); client cũ chỉ gặp giá trị lạ khi hồ sơ hoặc kế hoạch chứa `reading/writing`, tức khi người học chủ động bật.

### Q2. Phạm vi giai đoạn (điều kiện hiến pháp của spec)

- **Quyết định**: xử lý theo phương án (b) của spec – **biện minh trong "Theo dõi độ phức tạp" của [plan.md](plan.md)**, đồng thời đưa dưới đây văn bản sửa đổi hiến pháp dự thảo để chủ dự án chọn phương án (a) nếu muốn (C1).
- **Cơ sở biện minh**: (1) chủ dự án trực tiếp yêu cầu (điểm 2 của `comment.txt`); (2) "Learning Content (… nghe, đọc)" đã là mô-đun **trong phạm vi** của hiến pháp – điều khoản phân giai đoạn chỉ xếp "luyện nghe và đọc" vào Giai đoạn 2, không phải mô-đun mới; (3) cách hiện thực **không** thêm dịch vụ, bảng, phụ thuộc hay AI – chỉ nội dung dữ liệu + hai giá trị enum trên máy móc đơn vị–phiên của Giai đoạn 1; (4) luyện viết bằng gõ bàn phím không vi phạm điều loại trừ duy nhất của Giai đoạn 1 ("luyện viết tay Kanji: thứ tự nét, nhận dạng chữ viết"); (5) tính năng chỉ bật cho ≥ 30 phút/ngày nên không ảnh hưởng người học ít thời gian (Nguyên tắc I). **Không** xây: luyện nghe, luyện nói, chấm tự do bằng AI, viết tay.
- **Dự thảo sửa hiến pháp (chỉ áp dụng nếu chọn phương án (a), cần chủ dự án phê duyệt – MINOR 1.2.0 → 1.3.0)**: trong "Phân giai đoạn → Giai đoạn 1 (MVP)" thêm ý *"… luyện đọc hiểu đoạn văn ngắn và luyện viết bằng gõ bàn phím (không viết tay, không chấm tự do) cho người học có quỹ thời gian từ 30 phút mỗi ngày"*; trong "Giai đoạn 2" đổi "luyện nghe và đọc" thành "luyện nghe và đọc nâng cao (đoạn văn dài, có âm thanh)". Ghi chú di trú: spec 007 chuyển sang tuân thủ; 001–006 không ảnh hưởng.

### Q3. Chiến lược kiểm thử

- Kiểm thử đơn vị thuần hàm bằng hồ sơ đại diện (hiến pháp: Learning Engine có kiểm thử với hồ sơ tiêu biểu): `practice` (eligibility), `daily-plan-practice` (slot + bất biến quỹ/60%), `competency` (ngưỡng biên, tính chất ⊆ weak), `encouragement` (đủ 6 trạng thái, ưu tiên, biến thể, từ cấm), `study-defaults` (đơn điệu, ≤ quỹ), `content-validation-practice`, `content-files` (12 đơn vị mới).
- Hợp đồng/tích hợp PostgreSQL: cổng ≥ 30 qua API trực tiếp (SC-003), PATCH hạ phút giữ lựa chọn, lớp (phút ghi đè hạ xuống 15), `GET /today|/path|/progress` nhất quán màu, hoàn tất phiên luyện ghi `topic_stats`, migration 0006 không đổi dữ liệu cũ.
- **Golden hồi quy**: kế hoạch 14 ngày, `GET /path`, `GET /progress` của các hồ sơ đại diện hiện có **không đổi** (trừ trường mới tùy chọn) – bằng chứng Learning Engine không bị đụng cho người không chọn luyện.
- Client `flutter test`: `PasswordField`, `reconcileSuggestion`, onboarding/Hồ sơ (khóa dưới 30 phút), `CompetencyChip/Legend` (nhãn chữ + tương phản), Hôm nay (khích lệ + chip), lesson (ghim đoạn văn, IME composition), l10n khớp vi/en.

---

## Điểm cần chủ dự án xác nhận

| # | Điểm | Mặc định của kế hoạch | Ảnh hưởng nếu đổi |
|---|------|------------------------|-------------------|
| C1 | Xử lý phạm vi giai đoạn: biện minh trong kế hoạch (b) hay sửa hiến pháp 1.3.0 (a) | (b), kèm dự thảo (a) ở Q2 | Chỉ thủ tục; không đổi thiết kế |
| C2 | Khối lượng nội dung ra mắt | 2 bài đọc + 2 bài viết cho mỗi trình độ N5/N4/N3 = **12 đơn vị**, ít nhất 1 bài 5 phút mỗi (trình độ × loại); do ai biên soạn/duyệt? **ĐÃ QUYẾT ĐỊNH (chủ dự án)**: biên soạn tham khảo các nguồn công khai chính thống và giáo trình tiếng Nhật nổi tiếng để bám sát phạm vi trình độ (từ vựng, ngữ pháp, chủ đề) N5/N4/N3. **Ràng buộc**: chỉ tham khảo phạm vi/cấu trúc, KHÔNG sao chép nguyên văn đoạn văn, câu hỏi hay bài tập từ giáo trình (bản quyền); mọi đoạn văn và câu hỏi do ta viết mới. Mỗi bài ghi nguồn tham khảo (tên giáo trình/nguồn, bài/mục) để truy vết; người duyệt cuối vẫn là chủ dự án | Là điều kiện cứng để seed qua `validateCatalog`; thiếu nội dung thì không phát hành US2 |
| C3 | "Vàng nhạt" gồm cả khoảng [60%, 70%) (chưa bị coi là mảng yếu) | Có (P7) | Nếu chỉ muốn vàng = `is_weak` thì `insufficient`/`good` đổi ngưỡng 0.6 – sửa 2 hằng số |
| C4 | SC-008 hiểu theo **ngày** (một câu cố định trong ngày, đổi ngày kế tiếp) | Có (P12) | Muốn đổi mỗi lần mở: cần lưu biến thể vừa hiện (thêm trạng thái) |
| C5 | Giáo viên chọn `reading/writing` cho lớp | API chấp nhận, **giao diện giáo viên chưa thêm lựa chọn** ở bản này | Thêm 2 chip ở `class_path_screen.dart` (nhỏ) nếu muốn |
| C6 | Luyện đọc/viết **không** vào ôn tập SRS | Không vào (P4) | Muốn có: gắn `item` cho bài viết và chấp nhận 30 giây/mục |
| C7 | Thứ tự ưu tiên lời khích lệ khi nhiều trạng thái cùng đúng | `day_completed > welcome_back > in_progress > streak > behind_target > not_started` | Đổi chỉ là đổi mảng ưu tiên trong một hàm |
| C8 | Đo SC-009 (tỷ lệ đăng nhập thất bại do gõ sai) | Hiện chưa có bảng ghi đăng nhập thất bại; kế hoạch **không thêm bảng**, kiểm tay "tìm và bật trong một thao tác" và so nhật ký máy chủ nếu có | Muốn đo tự động: thêm bộ đếm sự kiện (migration nhỏ) |
