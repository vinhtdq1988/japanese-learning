# Nghiên cứu (Phase 0): Bài học Kanji

**Nhánh**: `003-kanji-lessons` | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Tài liệu này giải quyết các điểm chưa rõ trong Technical Context và ghi lại các quyết định thiết kế. Quy ước đánh số `K1…K16` để phân biệt với các quyết định `R1…R17` của [research 001](../001-phase1-mvp/research.md); khi một quyết định ở đây chỉ mở rộng một quyết định 001 thì nêu rõ.

Bối cảnh: hệ thống 001 đã hoàn tất (Fastify + PostgreSQL 16 + Drizzle, engine thuần hàm trong `backend/src/engine/`, client Flutter web). Tính năng này **mở rộng** chứ không thay thế: mọi quyết định đều ưu tiên tái sử dụng bảng, engine và endpoint đã có, và giữ nguyên hành vi với người học không chọn Kanji (FR-009, SC-006).

---

## K1. Mô hình nội dung Kanji: tái sử dụng `learning_units` / `content_items` / `exercises`

**Quyết định**: Bài Kanji là một `learning_units` với `kind='kanji'`; mỗi chữ Kanji là một `content_items` với `kind='kanji'`; bài tập Kanji là `exercises` như hiện có. Thông tin riêng của chữ (âm On, âm Kun, số nét, bộ thủ/thành phần) nằm trong cột JSONB mới `content_items.kanji_details`. Từ ví dụ nằm trong `content_items.examples` sẵn có (`{ja, reading, translation}`), bổ sung trường tùy chọn `kanjiReading` (cách đọc của chính chữ Kanji trong từ đó).

**Lý do**:
- `review_schedules.item_id`, `study_records.item_id`, `exercises.item_id`, snapshot phiên học, bộ đệm danh mục, Admin API, kiểm tra nội dung đều đã xoay quanh `content_items`; dùng lại giúp lịch ôn, tiến độ, nhật ký quản trị và bảo toàn dữ liệu khi sửa nội dung (FR-022) hoạt động ngay.
- Từ ví dụ lưu trong chính mục Kanji nên **không liên kết** với thư viện từ vựng (Làm rõ 2026-11-05, FR-002): không có khóa ngoại tới mục `vocabulary`, ôn từ ví dụ chỉ ghi vào lịch ôn Kanji.
- JSONB cho chi tiết Kanji nhất quán với `examples`, `i18n_text`; chỉ một loại mục dùng nên không đáng thêm 4–5 cột thưa.

**Phương án đã cân nhắc**:
- *Bảng riêng `kanji_characters`, `kanji_lessons`, `kanji_exercises`*: tách bạch nhưng phải nhân đôi lịch ôn, snapshot, chấm điểm, admin, bộ đệm, tiến độ → bác bỏ (Hiến pháp: độ phức tạp phải biện minh).
- *Cột riêng `on_readings text[]`, `kun_readings text[]`, `stroke_count smallint`*: kiểm tra kiểu ở DB tốt hơn nhưng thêm cột null cho mọi mục từ vựng/ngữ pháp; chọn JSONB + CHECK một chiều (`kind <> 'kanji'` thì `kanji_details` và `topic_id` PHẢI NULL) + kiểm tra ứng dụng khi kích hoạt (K10). CHECK hai chiều (`kind='kanji'` ⇒ NOT NULL) bị bác bỏ vì chặn lưu nháp chữ chưa đủ thông tin, trái cơ chế "lưu nháp không chặn" của Admin API.

## K2. Thêm `kanji` vào enum `skill` và cách chạy migration

**Quyết định**: `ALTER TYPE skill ADD VALUE 'kanji'` trong migration riêng `0002_kanji_skill.sql`; mọi thay đổi khác ở `0003_kanji.sql`. Hằng `SKILLS` trong `domain/types.ts` thành `['vocabulary','grammar','kanji']`; thêm hằng `PLACEMENT_SKILLS = ['vocabulary','grammar']` và `TRIAL_SKILLS = ['vocabulary','grammar']` cho các nơi KHÔNG nhận Kanji.

**Lý do**: Trình chạy migration (`db/migrate.ts`) chạy mỗi file trong một giao dịch; PostgreSQL 16 cho phép `ADD VALUE` trong giao dịch nhưng **không cho dùng** giá trị mới trước khi commit, nên CHECK/seed dùng `'kanji'` phải ở file sau. Enum `skill` được dùng chung bởi `topics.skill`, `learning_units.kind`, `content_items.kind`, `learning_profiles.skills`, `prioritized_skill`, `placement_questions.skill` – một giá trị mới phủ hết mà không đổi kiểu cột.

**Phương án đã cân nhắc**: Enum riêng `content_kind` cho đơn vị/mục → phải đổi kiểu nhiều cột và mã so sánh `kind === skill` ở engine; bác bỏ.

**Hệ quả cần chặn**: placement (`placement_questions.skill`) và dùng thử không nhận Kanji (ngoài phạm vi) → kiểm tra ứng dụng dùng `PLACEMENT_SKILLS`/`TRIAL_SKILLS`; thêm CHECK `skill <> 'kanji'` trên `placement_questions`.

## K3. Lịch ôn theo cặp (chữ, khía cạnh)

**Quyết định**: Thêm enum `review_facet` = (`item`, `meaning`, `reading`, `word`).
- `item` là khía cạnh duy nhất của mục từ vựng/ngữ pháp (giá trị mặc định cho mọi dòng cũ, không đổi hành vi).
- Mục Kanji dùng `meaning` (nghĩa), `reading` (cách đọc), `word` (từ chứa chữ).
- Cột `facet` thêm vào `exercises` (bài tập kiểm tra khía cạnh nào), `study_records` (khía cạnh của câu trả lời) và `review_schedules`; khóa chính `review_schedules` đổi thành `(user_id, item_id, facet)`.
- `daily_plan_items` thêm `review_facets review_facet[] NULL` song song với `review_item_ids` (cùng độ dài; NULL = mọi phần tử là `item`, đúng với mọi dòng cũ).

**Lý do**: Làm rõ 2026-11-05 chốt mỗi cặp (chữ, khía cạnh) có lịch riêng; câu sai chỉ dời lịch của đúng cặp đó (US3.3). Đặt khía cạnh làm một phần của khóa giúp SM-2 (R6), "mỗi cặp cập nhật tối đa một lần mỗi ngày địa phương" (FR-041 của 001), cờ "mục khó" và độ chính xác gần đây hoạt động nguyên vẹn theo cặp.

**Engine không đổi chữ ký**: `rankDueItems`/`packReviewBatches` làm việc trên chuỗi định danh. Dịch vụ dùng khóa ghép `reviewKey = itemId` (facet `item`) hoặc `itemId:facet` (Kanji) khi gọi engine và giải mã khi ghi `daily_plan_items`. Với người học không có mục Kanji, mọi khóa là `itemId` như cũ → kế hoạch giống hệt (SC-006).

**Cấp chữ là bản tổng hợp** (FR-014): "chữ đến hạn" = có ≥ 1 cặp đến hạn; "số chữ đã học" = số `item_id` Kanji khác nhau có ít nhất một dòng `review_schedules`; độ chính xác tính trên mọi câu ôn của chữ (gộp các khía cạnh).

**Phương án đã cân nhắc**:
- *Một lịch cho mỗi chữ, xoay vòng khía cạnh*: bác bỏ bởi Làm rõ.
- *Mỗi khía cạnh là một `content_items` riêng*: làm méo nội dung (3 bản sao chữ), admin khó soạn; bác bỏ.
- *Đổi `review_item_ids` sang JSONB `[{itemId, facet}]`*: phá vỡ kiểu cột đang dùng; mảng song song đơn giản hơn và tương thích ngược.

## K4. Thẻ chủ đề theo chữ và chỉ báo mảng yếu

**Quyết định**: Thêm `content_items.topic_id uuid NULL → topics`; BẮT BUỘC với mục Kanji khi kích hoạt (kiểm tra ứng dụng K10; DB chỉ cấm giá trị khác NULL ở mục không phải Kanji để cho phép lưu nháp), NULL với mục khác. Chủ đề Kanji là dòng `topics` có `skill='kanji'` (ví dụ "Số đếm", "Thời gian", "Con người", "Thiên nhiên"). Khi dựng snapshot, `topicId` của bài tập = chủ đề của mục được kiểm tra nếu có, ngược lại chủ đề của đơn vị (như cũ). Từ đó `study_records.topic_id` và `topic_stats` (R6/FR-029 của 001) tự động gom theo chủ đề của chữ; chỉ báo yếu dùng đúng ngưỡng hiện có (accuracy < 60% với ≥ 8 câu, bỏ cờ khi ≥ 70%).

**Lý do**: Làm rõ chốt thẻ chủ đề do admin khai báo trên từng chữ; một bài Kanji có thể chứa chữ thuộc chủ đề khác nhau dù cùng "nhóm" bài. Tái dùng `topic_stats` giữ nhất quán "như với từ vựng và ngữ pháp" (FR-018).

**Ghi chú**: `topic_stats` hiện cập nhật từ câu lượt chính ở cả ngữ cảnh bài học và ôn (như 001); spec ghi "độ chính xác ôn tập" mang nghĩa độ chính xác các câu hỏi đã trả lời – giữ cơ chế chung để từ vựng, ngữ pháp, Kanji cùng một định nghĩa. `learning_units.topic_id` của bài Kanji vẫn bắt buộc (chủ đề chính của bài, dùng cho xếp hạng `weakTopic`).

## K5. Kanji trong lộ trình và kế hoạch ngày: "suất Kanji"

**Vấn đề**: `rankUnits` cộng `W.foundation = 1000` cho đơn vị nền tảng của người mới; bài Kanji không có tầng nền tảng (FR-012: không điều kiện tiên quyết) nên với người mới sẽ luôn xếp sau mọi đơn vị nền tảng từ vựng/ngữ pháp và có thể không xuất hiện nhiều ngày, trái US2.2 và SC-001.

**Quyết định**: Thêm hàm thuần `applyKanjiSlot` trong `engine/daily-plan.ts`, áp dụng lên danh sách ứng viên bài mới (đã xếp hạng) trước `planDailyPlan`:

```text
nếu 'kanji' ∉ skills hoặc không có ứng viên Kanji → giữ nguyên danh sách (no-op)
ngược lại, nếu prioritizedSkill = 'kanji' HOẶC kế hoạch gần nhất có bài mới (trước hôm nay) không chứa bài Kanji
   → đưa ứng viên Kanji đứng đầu lên vị trí 0, phần còn lại giữ thứ tự
ngược lại → giữ nguyên
```

- Ngày đầu sau khi chọn Kanji (chưa có kế hoạch nào chứa bài Kanji) bài Kanji đứng đầu → có trong kế hoạch ngay khi ngày đó có phần bài mới (SC-001, FR-012).
- Không ưu tiên Kanji: tối thiểu một bài Kanji cách một ngày có bài mới; thêm nữa nếu xếp hạng tự nhiên chọn → Kanji không bị bỏ đói nhưng không chiếm hết (trường hợp biên 5 phút).
- Ưu tiên Kanji: bài Kanji đứng đầu mọi ngày, cộng thêm `W.prioritizedSkill` sẵn có → tỷ trọng lớn hơn (US2.5).
- Quỹ thời gian, giới hạn 60% ôn, luân phiên chỉ-ôn/chỉ-bài-mới của `planDailyPlan` (R7) **không đổi** → tổng ≤ quỹ (FR-008, SC-002).
- Không có `'kanji'` trong `skills` → hàm là no-op → kế hoạch giống hệt trước (FR-009, SC-006).

**Thay đổi kỹ năng**: `PATCH /me` nhận thêm `skills` (hiện chỉ chỉnh được khi onboarding). Đổi `skills` **không** sinh lộ trình mới – giống `dailyMinutes`/`prioritizedSkill`, có hiệu lực ở kế hoạch sinh kế tiếp vì `rankForUser` đọc `skills` từ hồ sơ (FR-010, US2.4); không cần thêm giá trị `path_reason` và không ảnh hưởng chỉ số SC-003 của 001. Bỏ kỹ năng đang là `prioritizedSkill` thì `prioritizedSkill` tự về `null`. Ghi `learning_profiles.kanji_selected_at` khi Kanji được thêm (dùng đo SC-008).

**Phương án đã cân nhắc**:
- *Gắn `tier='foundation'` cho bài Kanji N5*: biến Kanji thành nền tảng bắt buộc của mọi người mới đã chọn, chiếm hết các ngày đầu; bác bỏ.
- *Phân quota phút theo kỹ năng (ví dụ 1/3 quỹ cho Kanji)*: phá quy tắc first-fit đã kiểm thử, nhiều trường hợp biên với quỹ 5/10 phút; bác bỏ.
- *Xen kẽ vòng tròn mọi kỹ năng*: đổi kế hoạch của người không chọn Kanji (vi phạm SC-006); bác bỏ.

**Hết nội dung Kanji** (FR-013): khi `'kanji' ∈ skills` và không còn bài Kanji sắp tới trong khoảng trình độ, `GET /today` trả trường mới `kanjiNotice = { code: 'kanji_exhausted', suggestion }` với `suggestion` = `raise_level` nếu còn bài Kanji ở trình độ cao hơn, ngược lại `content_exhausted` (tách khỏi trường `notice` sẵn có để không đè thông báo khoảng nghỉ/hết nội dung chung); kế hoạch vẫn sinh từ các kỹ năng còn lại và ôn tập nên không trống.

## K6. Ôn tập Kanji

**Quyết định**:
- SM-2 biến thể (`engine/srs.ts`, R6) dùng nguyên vẹn cho từng cặp; `recentItemResults` lọc thêm theo `facet`.
- Lần đầu lên lịch: như 001, mỗi câu trả lời lượt chính có `item_id` tạo/cập nhật lịch của cặp `(item_id, facet)` của bài tập. Vì quy tắc nội dung (K10) bắt buộc mỗi chữ có ≥ 1 bài tập cho mỗi khía cạnh, hoàn thành bài Kanji đồng nghĩa mọi cặp của chữ đã có lịch (US3.1). Dòng lịch của bài **dở dang** có thể đã tồn tại (ghi theo từng câu), nên chữ Kanji chỉ được coi là "đã học" và chỉ vào gói ôn khi đơn vị chứa chữ có `unit_progress.status='completed'` của người học (Làm rõ 2026-11-05 lần 2); điều kiện này chỉ áp cho `kind='kanji'`, từ vựng/ngữ pháp giữ hành vi 001 (SC-006).
- Gói ôn: `listDueReviewItems` trả thêm `facet` và `kind`; khóa ghép K3 đi qua `rankDueItems` + `packReviewBatches` không đổi, cùng `REVIEW_SECONDS_PER_ITEM` (30 giây/câu) và quỹ ôn chung với từ vựng/ngữ pháp (FR-015).
- Snapshot ôn (`buildReviewSnapshot`): với mỗi cặp chọn một bài tập `active` có cùng `item_id` **và** `facet` (xoay vòng tất định theo ngày như R12); cặp không còn bài tập phù hợp bị bỏ qua, lịch giữ nguyên (FR-022).
- Bài tập `matching` gộp nhiều chữ (`item_id` NULL) chỉ dùng trong bài học, không vào ôn – như 001.
- Chữ đã thành thạo (K7) bị loại khỏi gói ôn.
- **Thứ tự triển khai (an toàn trung gian)**: lịch ôn theo cặp được ghi từ Phase 2, nhưng gói ôn Kanji chỉ đầy đủ ở US3. Để bản phát hành US1+US2 không sinh gói ôn trùng/sai khía cạnh, Phase 2 thêm bộ lọc tạm `facet = 'item'` trong `listDueReviewItems` (T090) — cặp Kanji chưa vào gói ôn cho tới khi US3 (T061) gỡ bộ lọc. Hệ quả chấp nhận: ở bản chỉ có US1+US2, chữ Kanji đã học chưa được ôn tự động.

**Lý do**: Giữ một cơ chế ôn duy nhất cho mọi loại nội dung, đúng FR-015/FR-016, và các bài kiểm thử SRS hiện có vẫn áp dụng.

## K7. Đánh dấu chữ Kanji đã thành thạo

**Quyết định**: Thêm endpoint `PUT /path/items/{itemId}/master` (`{ mastered: boolean }`) **chỉ cho mục Kanji** (mục khác → 422). Đặt `review_schedules.mastered_at` cho mọi cặp của chữ; các cặp có `mastered_at` không vào gói ôn và không tính "đến hạn". Bỏ đánh dấu → `mastered_at = NULL`, lịch tiếp tục từ `due_date` đã lưu. Đánh dấu cả bài Kanji dùng endpoint sẵn có `PUT /path/units/{unitId}/master` (loại khỏi bài sắp tới, giữ lịch ôn – hành vi như từ vựng/ngữ pháp).

**Lý do**: FR-010 cho phép đánh dấu chữ/bài; trường hợp biên "bỏ chọn Kanji" nói lịch ôn vẫn đến hạn **cho đến khi người học chủ động đánh dấu đã thành thạo** → cần cơ chế dừng ôn theo chữ. Giới hạn ở Kanji để không đổi hành vi từ vựng/ngữ pháp (SC-006); có thể mở rộng sau.

**Phương án đã cân nhắc**: Xóa dòng `review_schedules` → mất lịch sử, không bỏ đánh dấu được; bác bỏ.

## K8. Tiến độ Kanji

**Quyết định**: `GET /progress` thêm khối `kanji` (null khi người học chưa từng chọn Kanji và chưa có lịch sử Kanji) và trường `skill` cho mỗi phần tử `weakTopics`:

| Trường | Cách tính |
|---|---|
| `charactersLearned` | số `item_id` Kanji (mục `active` hay không) có ≥ 1 dòng `review_schedules` **và** đơn vị chứa chữ có `unit_progress.status='completed'` (chữ trong bài dở dang chưa tính) |
| `lessonsCompleted` | số `unit_progress.status='completed'` của đơn vị `kind='kanji'` |
| `minutes` | thời gian các phiên của đơn vị Kanji (`new_unit`/`extra`) + phần Kanji của phiên ôn hỗn hợp, phân bổ theo tỷ lệ câu lượt chính Kanji / tổng câu lượt chính của phiên |
| `reviewAccuracy` | đúng/tổng câu lượt chính ngữ cảnh `review` của mục Kanji (gộp các khía cạnh, "tính theo chữ") |

Các trường tổng (`totalMinutes`, `lessonsCompleted`, `reviewAccuracy`, `currentStreakDays`) giữ định nghĩa cũ và **bao gồm** Kanji (US4.1: vẫn nằm trong tổng thời gian và chuỗi ngày học chung).

**Tiến độ mục tiêu** (FR-019): `rankForUser(..., includeMastered: true)` lọc theo `skills` của hồ sơ → bài Kanji `active` trong khoảng trình độ tự động vào `completionRatio`/`onTrack` khi đã chọn Kanji, và không ảnh hưởng người không chọn. Bài/chữ bị ngừng tự động rời khỏi tiến độ mục tiêu (chỉ đơn vị `active`), lịch sử vẫn tính vào thời gian/độ chính xác (FR-022).

**Tóm tắt phiên** (US1.4): `SessionSummary` thêm `attentionItems` (tùy chọn) – danh sách chữ có ít nhất một câu lượt chính sai trong phiên (`{itemId, japanese}`), chỉ có với phiên chứa mục Kanji.

**Độ chính xác của số liệu**: số chữ, số bài, độ chính xác là số đếm chính xác; riêng phút Kanji của phiên ôn hỗn hợp là **ước lượng** theo tỷ lệ (spec FR-017/SC-007 đã ghi rõ). Kiểm thử T069 so sánh phút ước lượng với công thức phân bổ, không với đồng hồ thực.

**Phương án đã cân nhắc** cho thời gian: tách gói ôn Kanji riêng để quy thời gian chính xác → chia gói theo kỹ năng có thể làm tổng phút làm tròn vượt quỹ (R7) và đổi kế hoạch đã kiểm thử; bác bỏ, chọn phân bổ theo tỷ lệ (sai số chấp nhận được với số liệu hiển thị).

## K9. Hiển thị chữ Kanji (FR-006)

**Quyết định**: Dùng phông đã đóng gói `client/assets/fonts/NotoSansJP.ttf` (đã có, SIL OFL; CanvasKit không dùng phông hệ thống và CSP chặn tải phông từ CDN – xem `client/web/index.html`). Noto Sans JP phủ JIS X 0208 cấp 1+2 (≈ 6.355 chữ Kanji), bao trọn bảng Jōyō và mọi chữ N5–N3. Thêm kiểm thử nội dung tự động: mọi ký tự của `japanese`, `examples[].ja` trong các file `content/units/*.json` (và khi admin kích hoạt) PHẢI có glyph trong bảng `cmap` của phông; ký tự thiếu glyph → lỗi kiểm tra nội dung (ngăn ô vuông trống). Bộ đọc `cmap` (định dạng 4 và 12) viết nhỏ trong `backend/src/domain/font-coverage.ts`, không thêm phụ thuộc; danh sách code point được dựng một lần lúc khởi động và lưu bộ nhớ.

Hiển thị: chữ chính cỡ 96 px logic (tối thiểu 72 px ở cửa sổ hẹp), `fontFamily: 'NotoSansJP'`; âm On hiển thị katakana, âm Kun hiragana (phần okurigana phân cách bằng dấu `.` trong dữ liệu, ví dụ `た.べる`, hiển thị `た(べる)`).

**Phương án đã cân nhắc**: tải phông con theo trang từ Google Fonts → bị CSP chặn, phụ thuộc mạng; phông hệ thống → CanvasKit không dùng; bác bỏ.

## K10. Quy tắc nội dung Kanji (FR-021, SC-003)

**Quyết định**: Mở rộng `domain/content-validation.ts`:

Mức đơn vị `kind='kanji'`:
- 3–5 mục Kanji `active` (Làm rõ: 3–5 chữ mới mỗi bài); `tier` PHẢI là `core`.
- `goalTags` PHẢI không rỗng (FR-011: bài Kanji phải có mức liên quan đến mục tiêu để lộ trình chọn lọc được; khác từ vựng/ngữ pháp của 001 vốn cho phép rỗng).
- Có ≥ 1 bài tập `active` cho **mỗi khía cạnh** `meaning`, `reading`, `word` của **mỗi** chữ `active` (bao phủ FR-004 và bảo đảm mọi cặp ôn được).
- Bài tập gắn mục Kanji PHẢI có `facet ≠ item`; bài tập không gắn mục (`itemIndex` null) có `facet='item'` (chỉ dùng trong bài).
- **Thời lượng**: số bài tập `active` × `REVIEW_SECONDS_PER_ITEM` ≤ `est_minutes` × 60 giây; vượt → lỗi `exercises` (Hiến pháp I: bài học vừa trong thời lượng khai báo). `REVIEW_SECONDS_PER_ITEM` là cấu hình có sẵn của 001 (`backend/src/config.ts`, mặc định 30 giây) — hàm kiểm tra thuần nhận giá trị này qua tham số `secondsPerExercise` chứ không cứng hóa 30, để hiệu chỉnh được sau khi đo thời lượng thực (xem plan "Rủi ro"). Ví dụ với mặc định 30 giây: bài 5 phút tối đa 10 bài tập.
- **Chữ duy nhất**: mỗi giá trị `japanese` chỉ xuất hiện ở MỘT mục Kanji `active` trong toàn danh mục; kích hoạt bài chứa chữ đã có ở bài `active` khác → lỗi `items[i].japanese` nêu bài đang chứa. Quy tắc cần ngữ cảnh toàn danh mục nên hàm kiểm tra nhận thêm tập `existingKanjiChars` (chữ → đơn vị) do dịch vụ truyền vào; `validateCatalog` kiểm toàn cục cho thư viện seed. Lý do: mục thuộc đúng một đơn vị nên cùng chữ ở hai bài là hai `item_id` và hai lịch ôn trùng nhau (trường hợp biên "cùng một chữ ở nhiều bài"). Cách đọc mới ở trình độ cao hơn được bổ sung vào mục hiện có.

Mức mục `kind='kanji'`:
- `japanese` đúng **một** ký tự Kanji (khối CJK Unified Ideographs, có glyph trong phông – K9).
- `meaning` vi + en đầy đủ; `kanji_details.onReadings ∪ kunReadings` không rỗng, mỗi phần tử là kana hợp lệ (On: katakana; Kun: hiragana, cho phép `.` phân cách okurigana); `strokeCount` nguyên 1–30; `components` tùy chọn.
- `topicId` bắt buộc, trỏ tới chủ đề `skill='kanji'`.
- ≥ 1 từ ví dụ; mỗi từ chứa chính chữ đó, có `reading` (kana) và bản dịch vi + en; `kanjiReading` (nếu có) PHẢI thuộc tập cách đọc của chữ (bỏ okurigana, chấp nhận biến âm như rendaku do người biên soạn khai báo – chỉ cảnh báo, không chặn). NÊN có ≥ 2 từ ví dụ (cảnh báo).

Mức danh mục (`validateCatalog`): mỗi trình độ N5, N4, N3 có ≥ 1 bài Kanji `est_minutes = 5` (SC-004); quy tắc "N5 foundation 5 phút cho mỗi kind" **không áp dụng** cho Kanji.

Hướng dẫn thời lượng (ghi trong `content/README` và checklist biên soạn, không chặn tự động): bài 5 phút = 3 chữ × 3 bài tập (≈ 9 câu × 30 giây); bài 10 phút = 4–5 chữ; 15 phút = 5 chữ có thêm bài ghép cặp.

Câu đọc không mơ hồ (trường hợp biên): đề bài khía cạnh `reading` PHẢI nêu từ ngữ cảnh khi chữ có nhiều cách đọc; điền cách đọc dùng `fill_blank` với `accepted_answers` cố định – người biên soạn khai báo mọi dạng kana chấp nhận (ví dụ cả `ニチ` và `にち`). Không thêm chuẩn hóa katakana↔hiragana vào `normalizeAnswer` để không đổi cách chấm từ vựng hiện có.

## K11. Quản trị nội dung Kanji (FR-020 → FR-023)

**Quyết định**: Dùng lại `/admin/units*` và màn hình soạn đơn vị. `AdminUnitWrite.kind` nhận `kanji`; mục thêm `topicId`, `kanjiDetails`, ví dụ thêm `kanjiReading`; bài tập thêm `facet`. Kích hoạt (`PUT /admin/units/{id}/status`) chạy K10 và trả 422 kèm danh sách lỗi theo đường dẫn (như hiện có). Bảo toàn dữ liệu (mục/bài tập vắng mặt → `inactive`, không xóa cứng) và nhật ký `admin_action_logs` (`unit.create`, `unit.update`, `unit.status`) giữ nguyên cơ chế. `GET /admin/topics` trả cả chủ đề Kanji (lọc theo `skill`). Bộ đệm danh mục (`services/content-cache.ts`) đã bảo đảm hiển thị ≤ 5 phút (SC-009).

Client admin: `admin_unit_editor_screen.dart` hiển thị nhóm trường Kanji khi `kind='kanji'` (âm On/Kun dạng danh sách, số nét, thành phần, chủ đề, từ ví dụ có `kanjiReading`), và chọn `facet` cho bài tập gắn chữ.

## K12. Phạm vi loại trừ: placement, dùng thử, nội dung N2/N1

**Quyết định**: Bộ placement 20 câu và luồng dùng thử chỉ dùng `vocabulary`/`grammar` (`PLACEMENT_SKILLS`, `TRIAL_SKILLS`); `services/trial.ts` đã lặp cố định hai kỹ năng – thêm kiểm thử hồi quy. Trần nội dung N3 và `scopeNotice='content_ceiling_n3'` áp dụng cho Kanji như các kỹ năng khác (không cần mã mới).

## K13. Hợp đồng API và tương thích

**Quyết định**: Cập nhật **tại chỗ** hợp đồng duy nhất `specs/001-phase1-mvp/contracts/openapi.yaml` lên **1.11.0** (thay đổi bổ sung, ghi nhật ký trong `info.description`), chi tiết ở [contracts/api-changes.md](contracts/api-changes.md). Sinh lại API client Dart (`client/lib/data/api/generated`).

**Rủi ro tương thích**: thêm giá trị `kanji` vào enum `Skill` là bổ sung theo OpenAPI nhưng client sinh mã cũ có thể lỗi giải mã giá trị lạ. Giảm thiểu: client và backend phát hành cùng lúc (cùng kho, cùng `docker-compose`); giá trị `kanji` chỉ xuất hiện trong phản hồi của người học đã chọn Kanji – chỉ có thể chọn được từ client mới. JSON Schema nội dung `unit.schema.json` lên **1.1.0** (bổ sung), xem [contracts/content-schema.md](contracts/content-schema.md).

Snapshot phiên học: thêm trường tùy chọn (`items[].kanji`, `items[].topicId`, `exercises[].facet`) nhưng **giữ `SNAPSHOT_VERSION = 1`**; khi đọc snapshot cũ, `facet` vắng mặt hiểu là `item` → phiên dở dang trước khi triển khai vẫn tiếp tục được.

## K14. Thư viện Kanji ban đầu

**Quyết định**: 7 bài, 27 chữ (3+5+4+3+5+3+4), đặt trong `content/units/` cùng định dạng file đơn vị; chủ đề Kanji thêm vào `content/topics.json`.

| Trình độ | Bài (est_minutes) | Chữ (ví dụ) | Chủ đề |
|---|---|---|---|
| N5 | Số đếm 1 (5) | 一 二 三 | Số đếm |
| N5 | Số đếm 2 (10) | 四 五 六 七 八 | Số đếm |
| N5 | Thời gian (10) | 日 月 年 時 | Thời gian |
| N4 | Con người & cơ thể (5) | 体 首 顔 | Con người |
| N4 | Thiên nhiên (10) | 空 海 林 森 風 | Thiên nhiên |
| N3 | Công việc (5) | 職 給 務 | Công việc |
| N3 | Xã hội (10) | 政 経 済 民 | Xã hội |

Thỏa SC-004 (mỗi trình độ có ≥ 1 bài 5 phút). Danh sách chữ cụ thể là đề xuất ban đầu; người biên soạn có thể thay miễn thỏa quy tắc K10. Biên soạn song ngữ là việc trên đường găng (như rủi ro của 001).

## K15. Đo chỉ số sản phẩm

**Quyết định**: Thêm truy vấn vào `backend/src/reports/product-metrics.sql`:
- **SC-008**: trong số người học có `kanji_selected_at` (≥ 3 ngày trước thời điểm báo cáo), tỷ lệ có `unit_progress.status='completed'` cho một đơn vị Kanji với `updated_at ≤ kanji_selected_at + 3 ngày`.
- **SC-001** (kiểm tra vận hành): tỷ lệ người học đã chọn Kanji có kế hoạch đầu tiên sau `kanji_selected_at` chứa `new_unit` Kanji, trong số kế hoạch có phần bài mới.

## K16. Kiểm thử (FR-024, Hiến pháp)

**Quyết định**:
- Hồ sơ đại diện mới trong `backend/tests/fixtures/learner-profiles/`: `kanji-newcomer-5min`, `kanji-newcomer-10min`, `kanji-n4-15min`, `kanji-prioritized-30min`, `kanji-added-later` (người dùng cũ thêm Kanji), `kanji-removed` (bỏ chọn còn lịch ôn), `kanji-exhausted-n5`.
- **Hồi quy SC-006**: kiểm thử "golden" chạy mọi hồ sơ hiện có (không Kanji) qua `rankUnits` + `applyKanjiSlot` + `planDailyPlan` trong 14 ngày mô phỏng, so với ảnh chụp kết quả sinh từ mã trước thay đổi (lưu `tests/fixtures/golden/plans-pre-kanji.json`); bất kỳ khác biệt nào là lỗi.
- **SC-002**: mọi hồ sơ Kanji × {5, 10, 15, 30} phút × 14 ngày: tổng ≤ quỹ, mỗi mục ≤ 15 phút, có bài Kanji ngày đầu có bài mới.
- **SC-005**: mô phỏng đúng/sai trên cặp (chữ, khía cạnh), khẳng định từ lần ôn thứ hai khoảng cách đến hạn trung bình của cặp sai ngắn hơn ≥ 50% so với cặp đúng (SM-2: sai → 1 ngày; đúng lần 2 → 3 ngày) và các khía cạnh khác không đổi lịch.
- Hợp đồng (OpenAPI 1.11.0), tích hợp PostgreSQL (migration 0002/0003 trên dữ liệu 001 có sẵn, admin kích hoạt bài thiếu thông tin bị 422), kiểm tra nội dung + phủ glyph (K9), widget test Flutter cho màn hình bài Kanji (chỉ hiện phần đọc có, không giá trị giả).

---

Mọi mục "NEEDS CLARIFICATION" trong Technical Context đã được giải quyết bởi các quyết định trên.
