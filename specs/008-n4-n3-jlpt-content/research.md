# Nghiên cứu (Phase 0): Bổ sung nội dung học N4 → N3 đầy đủ để thi JLPT

**Nhánh**: `008-n4-n3-jlpt-content` | **Ngày**: 2026-11-14 | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Tài liệu này giải quyết mọi điểm chưa rõ của Bối cảnh kỹ thuật. Mỗi quyết định có dạng **Quyết định / Lý do / Phương án đã cân nhắc**. Các điểm chỉ chủ dự án mới quyết được nằm ở cuối (mục **C1…C8**). Đây là spec thiên về **nội dung**, nên phần lớn quyết định là về công cụ, quy trình và quy ước dữ liệu; thay đổi mã được giữ ở mức tối thiểu (D10, D11, D12, D15).

## Hiện trạng đã đọc từ mã nguồn (cơ sở cho các quyết định)

| Phát hiện | Nguồn | Hệ quả |
|---|---|---|
| Thư viện hiện có **33 đơn vị** (N5: 13, N4: 10, N3: 10; mỗi trình độ N4/N3 có 2 từ vựng, 2 ngữ pháp, 2 Kanji, 2 đọc, 2 viết). Phần lớn đơn vị chỉ có 4 mục / 4 bài tập dù quỹ cho phép 10–20 bài | `content/units/*.json` | Đơn vị mới được biên soạn dày hơn; không dùng đơn vị cũ làm mẫu về kích thước |
| Seed **chỉ chèn**, khóa tự nhiên đơn vị = `(kind, level, title.en)`; đơn vị đã có thì bỏ qua, không cập nhật | `backend/src/seed/index.ts` | Giữ nguyên danh tính nội dung cũ (FR-018) miễn phí; nhưng **không sửa được mục đã có bằng file** → cần cơ chế bổ sung (D6) |
| `status` của đơn vị có sẵn `draft/active/inactive`; chỉ `active` hiển thị cho người học (`ContentCache` lọc `active`) | `db/schema.ts`, `services/content-cache.ts` | Không cần migration; "chưa duyệt không hiển thị" thực hiện được bằng cách **không nạp** (D5) |
| Quy tắc **chữ Kanji duy nhất** có ở `validateCatalog` và ở kích hoạt Admin (`existingKanjiChars`); **không có** cho từ vựng và ngữ pháp | `content-validation.ts`, `services/content.ts` | FR-007 cần mở rộng (D4) |
| Từ vựng/ngữ pháp **không bắt buộc** ví dụ có `reading` và từ vựng không bắt buộc có ví dụ; không bắt buộc mỗi mục có bài tập | `validateItem` | FR-004/005 và SRS (mục không có bài tập thì không bao giờ vào lịch ôn) cần quy tắc mới (D8) |
| `rankUnits` chấm điểm: trình độ ±100, thẻ mục tiêu +20, kỹ năng ưu tiên +30, mảng yếu +40, độ lệch độ khó tới ±16, **`sequence` × 0,01** | `engine/path.ts` | Ở quy mô 300+ đơn vị/trình độ, `sequence` gần như vô hiệu so với cộng điểm thích ứng → thứ tự giáo trình và kiến thức nền không còn được bảo đảm (D10) |
| Đơn vị cùng điểm được phá hòa bằng `id` (UUID ngẫu nhiên) | `rankUnits` | `sequence` trùng trong cùng (trình độ × loại) cho thứ tự **không tất định giữa các môi trường** → cần `sequence` duy nhất (D10) |
| `sequence` hiện có theo dải riêng từng loại (từ vựng/ngữ pháp 10–30, Kanji 100+, đọc 200+, viết 300+); Kanji và luyện đọc/viết đi qua "suất" (`applyKanjiSlot`, `applyPracticeSlot`), từ vựng ↔ ngữ pháp chỉ xen kẽ nhờ điểm | `daily-plan.ts` | Tỷ lệ từ vựng : ngữ pháp trong lộ trình phụ thuộc hoàn toàn cách gán `sequence` (D10) |
| `goalRatio` = số đơn vị xong / số đơn vị trong phạm vi (không trọng số) và là **một nguồn duy nhất** cho `GET /progress` lẫn thành tựu `goal_*` | `engine/progress.ts`, `services/achievements.ts` | Tiến độ N4–N3 sẽ bị lệch về từ vựng (≈ 55% số đơn vị) nếu giữ đếm đơn vị (D12) |
| `ScopeNotice` chỉ có `content_ceiling_n3`, **lưu trong `learning_paths.generated_from`** lúc dựng lộ trình | `engine/path.ts` | Thông báo "chưa có phần nghe hiểu" không thể lưu vào lộ trình cũ → phải tính **lúc đọc** (D12) |
| Ôn tập: `REVIEW_SECONDS_PER_ITEM = 30`; mảng yếu cần ≥ 8 câu trong cửa sổ 20; mức năng lực `insufficient` khi < 8 câu | `difficulty.ts`, `competency.ts` | Chủ đề mịn (FR-013) phải đủ ≥ 20 bài tập mới cho tín hiệu có nghĩa (D9) |
| Gợi ý mặc định: 5 phút = từ vựng; 10 = + ngữ pháp; 15 = + Kanji; 30 = + đọc + viết | `domain/study-defaults.ts` | Học viên 15 phút dùng ba loại → cơ sở tính khối lượng (D17) |
| **71 lệnh `seedContent(...)`** trong kiểm thử, `simulate-plans.ts` đọc thẳng `content/`, và `us1.test.ts` khẳng định tổng số đơn vị | `backend/tests/**` | Nội dung tăng gấp ≈ 18 lần sẽ làm chậm toàn bộ bộ kiểm thử và vỡ các golden hiện có nếu không tách (D7) |
| Phông đóng gói `NotoSansJP.ttf` ≈ 9,6 MB; kiểm tra phủ glyph đã tự động ở seed | `font-coverage.ts` | FR-015 đã có cổng tự động; chỉ cần chạy cho mọi đơn vị mới |
| Không có chỉ mục/ràng buộc DB nào cản việc có hàng trăm đơn vị; `learning_units_status_idx` đã có | `db/schema.ts` | **Không cần migration** |

---

## D1. Cách tổ chức nội dung ở quy mô lớn

**Quyết định**: giữ mô hình **một file JSON = một đơn vị** trong `content/units/` (thư mục phẳng), nạp bằng `pnpm seed`; thêm thư mục `content/scope/` (danh mục phạm vi), `content/releases/` (hồ sơ đợt) và `content/drafts/` (bản nháp chưa duyệt, **không nạp**). Quy ước tên file `<trình-độ>-<loại>-<chủ-đề>-<số-thứ-tự-2-chữ-số>.json` (ví dụ `n4-vocabulary-health-02.json`). Không đổi nguồn sự thật sang CSDL/CSV/bảng tính.

**Lý do**: JSON Schema + quy tắc nội dung + review qua git đã chạy cho 33 đơn vị; khóa tự nhiên `(kind, level, title.en)` giữ danh tính; nội dung vẫn là **dữ liệu** độc lập mã client (Nguyên tắc VI). Khoảng 545 file mới × 5–10 KB ≈ 4–5 MB là kích thước thường với git.

**Đã cân nhắc**: (a) gộp nhiều đơn vị vào một file theo chủ đề — làm khóa nội dung và diff review khó theo dõi, mất ánh xạ 1 file = 1 đơn vị đã có trong test và README; (b) biên soạn trực tiếp trên Admin UI — không có kiểm tra hàng loạt, không có diff review, khó đối chiếu danh mục; (c) nhập CSV — mất cấu trúc lồng (ví dụ, bài tập, phản hồi song ngữ).

## D2. Danh mục phạm vi JLPT (FR-001) là dữ liệu có schema

**Quyết định**: tám file `content/scope/{n4,n3}-{kanji,vocabulary,grammar,reading}.json` + một file tham chiếu `content/scope/n5-kanji.ref.json` (chỉ để kiểm tra chữ Hán trong đoạn đọc, **không** theo dõi độ phủ). Schema mới `scope.schema.json` 1.0.0. Mỗi dòng: `id` ổn định, khóa khớp, `level`, `sources[]` (mã nguồn tham khảo), tùy chọn `exclude: { reason }`, và với dạng đọc hiểu có `minUnits`. **Trạng thái phủ KHÔNG lưu tay** mà được **suy ra** bằng cách quét các đơn vị (D3), nên không thể lệch giữa danh mục và nội dung. Cấu trúc chi tiết: [contracts/scope-catalog.md](contracts/scope-catalog.md).

Khóa khớp: chữ Hán = chính ký tự; từ vựng = `japanese|reading` (phân biệt đồng tự như 方 かた/ほう); ngữ pháp = `scopeRef` khai trên mục ngữ pháp (mẫu viết tự do như "AはBより〜" không khớp tự động được); dạng/chủ đề đọc hiểu = `scopeRef` khai trên mục đoạn văn. `scopeRef` cũng dùng được cho từ vựng/Kanji khi khóa tự nhiên không khớp (ngoại lệ, cần ghi chú).

**Lý do**: FR-001/002 đòi danh mục có nguồn, có trạng thái và báo cáo mức phủ; suy ra trạng thái từ nội dung giữ "một nguồn sự thật". Chủ dự án duyệt danh mục bằng review file (cổng G0 trong [plan.md](plan.md)).

**Đã cân nhắc**: (a) lưu trạng thái phủ vào danh mục — hai nơi sửa, dễ lệch; (b) bảng DB `scope_items` — thêm migration và bề mặt Admin chưa ai yêu cầu, và danh mục là tài liệu nghiệm thu chứ không phải dữ liệu runtime; (c) bảng tính ngoài repo — không có cổng tự động, không kiểm được SC-001.

**Quy mô ước tính** (con số cuối do danh mục chốt, theo Giả định của spec): N4 ≈ 200 chữ Hán / 700 từ / 100 mẫu; N3 ≈ 350 chữ Hán / 2.250 từ / 100 mẫu; dạng và chủ đề đọc hiểu ≈ 12–16 mục mỗi trình độ.

**Nguồn tham khảo**: JLPT không công bố danh sách chính thức (Giả định của spec). Danh mục được dựng từ **≥ 2 nguồn công khai độc lập** (ví dụ giáo trình phổ biến như *Minna no Nihongo* II, *Shin Kanzen Master*, *Nihongo So-matome*, cùng các danh sách cộng đồng theo trình độ), mục nào chỉ có 1 nguồn thì người duyệt quyết định giữ hay loại. Chỉ lấy **tư cách thành viên danh sách** (mục nào thuộc N4/N3), KHÔNG lấy nghĩa, ví dụ hay bài tập (FR-016). **Giấy phép từng nguồn phải được kiểm tra trước khi dùng** (xem C2); không giả định nguồn nào miễn phí sử dụng.

## D3. Báo cáo mức phủ và cổng nghiệm thu (FR-002, FR-003, SC-001, SC-002)

**Quyết định**: công cụ dòng lệnh `pnpm content:coverage` (`backend/src/seed/coverage.ts`, hàm tính thuần ở `domain/content-scope.ts`) đọc `content/scope/` + `content/units/` và in: bảng **loại × trình độ** (tổng, đã phủ, loại trừ, chưa phủ, %), danh sách chưa phủ, danh sách loại trừ kèm lý do, mục trùng, `scopeRef` không tồn tại. Hai chế độ:

- Mặc định (mỗi PR): chỉ kiểm **bất biến** — mọi `scopeRef` trỏ tới dòng có thật; mỗi mục chính thuộc đúng một đơn vị (D4); mọi dòng loại trừ có `reason`; không dòng nào trùng khóa. Thất bại → lỗi.
- `--final` (nghiệm thu): thêm ngưỡng FR-003 (ngữ pháp ≥ 95%, Kanji ≥ 95%, từ vựng ≥ 90%, mỗi trình độ) và **0 dòng "chưa phủ"** (SC-001).

Kèm `pnpm content:stats` (số đơn vị, phút, mục, chủ đề theo loại × trình độ × thời lượng) phục vụ D17.

**Lý do**: tiến độ biên soạn đo được theo đợt và nghiệm thu bằng một lệnh; vitest bao hai chế độ để chống hồi quy.

**Đã cân nhắc**: chỉ kiểm ngưỡng ở cuối — đợt giữa chừng có thể làm vỡ bất biến (trùng mục) mà không ai biết đến khi nghiệm thu.

## D4. "Mục chính của đúng một đơn vị" cho mọi loại (FR-007)

**Quyết định**: tổng quát hóa quy tắc Kanji duy nhất thành **mục chính duy nhất** theo khóa: chữ Hán = ký tự; từ vựng = `japanese|reading`; ngữ pháp = `scopeRef` (và `japanese` trùng nguyên văn cũng bị báo). Áp ở hai nơi: (1) `validateCatalog` khi seed/CI (quét mọi file); (2) kích hoạt Admin — mở rộng `existingKanjiChars` thành `existingItemKeys` theo loại (`listActiveItemKeys(db, unitId, kind)`), nên đơn vị tạo qua Admin API cũng không tạo trùng. Mục xuất hiện làm **ví dụ** ở đơn vị khác vẫn được phép (đúng Trường hợp biên của spec).

**Lý do**: FR-017 đòi kiểm tra trùng lặp tự động cho mọi đơn vị; nếu chỉ kiểm file thì Admin API mở đường vòng.

**Đã cân nhắc**: chỉ kiểm ở file — bỏ lọt đường Admin; ràng buộc `UNIQUE` ở DB — không biểu diễn được "đúng một đơn vị `active`" (đơn vị `inactive` giữ mục cũ) và cần migration.

## D5. Đợt phát hành và hồ sơ duyệt (FR-017, FR-018, SC-004)

**Quyết định**: `content/units/` **chỉ chứa đơn vị đã duyệt**. Bản nháp nằm ở `content/drafts/<mã-đợt>/` (không nạp, kiểm bằng `pnpm content:lint --drafts`). Một đợt = một file `content/releases/NNN-<slug>.json` ([contracts/release-manifest.md](contracts/release-manifest.md)) ghi: mã đợt, ngày, nguồn tham khảo, danh sách `units[]` (file, người duyệt, ngày duyệt, đã qua checklist), `amendments[]` (D6) và ghi chú. Khi duyệt, người duyệt `git mv` file từ `drafts/` sang `units/` và thêm dòng vào manifest trong cùng một commit. **Đóng kín (fail closed)**: loader nạp đơn vị theo manifest; file trong `units/` không thuộc manifest nào → lỗi validate (seed thất bại), manifest trỏ file không tồn tại → lỗi. Đợt `000-baseline` liệt kê 33 file hiện có (`"baseline": true`, được miễn các quy tắc mới ở D8 vì không sửa được bằng file).

Đơn vị bị từ chối hoặc chưa duyệt đơn giản **không được chuyển** sang `units/` nên không bao giờ tới người học; các đơn vị khác trong đợt vẫn phát hành (Trường hợp biên). Gỡ nội dung đã phát hành lỗi: đặt `status = inactive` qua Admin API (đã có; tiến độ người học còn nguyên) rồi thêm đơn vị thay thế bằng file mới (tiêu đề mới ⇒ danh tính mới).

**Lý do**: tận dụng `status` và seed insert-only sẵn có, không migration; hồ sơ duyệt nằm trong git (có tác giả, ngày, diff). Đơn vị tạo/sửa qua Admin được "duyệt" bằng chính hành động kích hoạt của quản trị viên, đã có nhật ký `admin_action_logs`.

**Đã cân nhắc**: (a) nạp bản nháp thành `status = draft` rồi kích hoạt từng cái qua Admin — ≈ 545 lần kích hoạt tay, không có diff review, và quản trị viên có thể kích hoạt đơn vị chưa qua checklist; (b) cột `reviewed_by/reviewed_at` trên `learning_units` — cần migration cho thông tin vốn đã nằm trong git.

## D6. Bổ sung cách đọc/ví dụ cho mục hiện có (Câu chuyện 3, kịch bản 3; FR-007, FR-018)

**Quyết định**: mảng `amendments[]` trong manifest đợt; mỗi phần tử trỏ tới một **đơn vị Kanji đã có** (kind, level, title.en) và một chữ, rồi **chỉ thêm**: âm On/Kun mới vào `kanjiDetails`, ví dụ mới, bài tập mới (khía cạnh `reading`/`word`). Seed áp **idempotent**: so khớp theo giá trị (âm đã có thì bỏ qua; ví dụ khớp `ja`; bài tập khớp `(item, facet, prompt.en)`), **không bao giờ xóa hay đổi** giá trị có sẵn. Id mục và bài tập cũ giữ nguyên nên lịch ôn không đổi. Đơn vị sau khi bổ sung vẫn phải đạt quy tắc Kanji (mỗi chữ đủ ba khía cạnh; quỹ thời lượng — nếu thêm bài tập làm vượt quỹ thì phải đổi `estMinutes` qua Admin, ghi trong manifest). Phạm vi bản này: **chỉ Kanji** (trường hợp duy nhất spec nêu và phổ biến nhất); nghĩa bổ sung cho từ vựng/ngữ pháp thêm dưới dạng ví dụ nếu cần.

**Lý do**: giữ file làm nguồn sự thật mà không phá khóa nội dung cũ (FR-018); không thể "sửa file rồi seed lại" vì seed bỏ qua đơn vị đã có.

**Phạm vi**: `amendments` chỉ áp dụng cho Kanji (thêm cách đọc). Từ vựng và ngữ pháp: nghĩa/cách dùng bổ sung ở trình độ cao hơn được trình bày làm ví dụ hoặc giải thích ở đơn vị trình độ cao hơn (ví dụ được phép, mục chính thì không — FR-007); sửa mục đã phát hành dùng Admin API.

**Đã cân nhắc**: (a) làm qua Admin API bằng tay — không lặp lại được giữa các môi trường, không có trong git; (b) seed ghi đè đơn vị đã có — vi phạm FR-018 và xóa chỉnh sửa của quản trị viên; (c) tạo chữ lặp ở bài khác — vi phạm FR-007.

## D7. Tách kiểm thử khỏi nội dung thật (bảo vệ SC-007 và chất lượng CI)

**Quyết định**: `loadContent(dir, { releases })`; mặc định `releases` lấy từ biến `CONTENT_RELEASES` (`all` hoặc danh sách mã đợt, vắng mặt = `all` ở production). `vitest.config.ts` đặt `CONTENT_RELEASES=000-baseline` cho mọi project, nên **71 điểm `seedContent`, `simulate-plans.ts` và các golden hiện có giữ nguyên hành vi** (33 đơn vị). Chỉ các kiểm thử về nội dung thật (`content-files`, `content-coverage`, `content-releases`, `seed` đầy đủ, `runway`, `perf-large-catalog`) truyền `releases: 'all'` tường minh. Bước 0 của triển khai: chụp golden/số liệu trước khi sửa mã.

**Lý do**: seed ≈ 580 đơn vị cho mỗi file kiểm thử (≈ 71 file) là thêm hàng chục phút CI; golden gắn với 33 đơn vị sẽ vỡ ở mỗi đợt. Manifest tạo ra ranh giới tự nhiên nên không cần nhân đôi file vào `fixtures/`.

**Đã cân nhắc**: sao chép 33 file vào `tests/fixtures/content/` — nhân đôi dữ liệu, dễ lệch; cập nhật 71 điểm gọi để truyền tham số — nhiễu, dễ sót.

## D8. Cấu trúc đơn vị theo loại và dạng câu hỏi thi (FR-004, FR-005, FR-006, FR-008, FR-012)

**Quyết định**: chi tiết ở [contracts/content-authoring.md](contracts/content-authoring.md). Tóm tắt:

- **Không thêm dạng bài tập mới**: dùng `multiple_choice`, `fill_blank`, `matching` hiện có. Dạng **sắp xếp câu có ★** (文の組み立て) của đề thi biểu diễn bằng `multiple_choice` ("mảnh nào nằm ở ô ★") — đây là dạng tương đương có sẵn mà FR-008 cho phép; kéo–thả sắp xếp thật **chưa thể hiện** và được ghi ở đây, không ở client.
- **Siêu dữ liệu biên soạn chỉ nằm trong file** (không vào DB, seed bỏ qua; schema `unit` 1.2.0 → 1.3.0, thêm tùy chọn): `exercises[].format` (dạng đề thi), `items[].scopeRef`, `requires[]` (kiến thức nền). Dùng để lint, không ảnh hưởng runtime.
- **Quy tắc mới cho đơn vị ngoài baseline** (cổng tự động): ví dụ của từ vựng/ngữ pháp **phải** có `reading` kana; từ vựng ≥ 1 ví dụ; **mỗi mục từ vựng/ngữ pháp được ≥ 1 bài tập gắn mục** (không thì không bao giờ vào SRS); đơn vị từ vựng phủ ≥ 3 `format` (nếu có chữ Hán thì có `kanji_reading`); đơn vị ngữ pháp có ≥ 1 mục so sánh khi mẫu có "dễ nhầm" (`explanation` nêu mẫu gần nghĩa) và ≥ 1 bài `form_fill`; mỗi câu `incorrect` có phản hồi giải thích.
- **Kích thước đơn vị** (xem D17): từ vựng 5 phút = 6 từ/≤ 10 câu, 10 phút = 12 từ/≤ 20 câu; ngữ pháp 5 phút = 2 mẫu, 10 phút = 4–5 mẫu (trung bình ≥ 4,5 để 28 đơn vị/trình độ đạt ≥ 95% của ≈ 100 mẫu); Kanji 5 phút = 3 chữ, 10 phút = 4–5 chữ (quy ước 003); **≥ 30% số đơn vị mỗi (loại × trình độ) là 5 phút** (lint cảnh báo) để học viên 5 phút có "đường băng" (Trường hợp biên của spec).

**Lý do**: bám đề thi mà không mở rộng hợp đồng nội dung (FR-019 chỉ yêu cầu ghi lại khi mở rộng); các ràng buộc mới đóng đúng khoảng trống mà `validateItem` hiện bỏ ngỏ.

**Đã cân nhắc**: thêm dạng `ordering` (kéo–thả) — thêm loại bài tập mới là thay đổi hợp đồng + client + chấm điểm + dữ liệu đã lưu, vượt phạm vi "chỉ mở rộng nội dung"; lưu `format` vào DB — cần migration cho thứ không ai đọc lúc chạy.

## D9. Chủ đề mịn (FR-013)

**Quyết định**: thêm khoảng **150–180 chủ đề** mới vào `content/topics.json`, **giữ nguyên** khóa/tên các chủ đề hiện có (danh tính, `topic_stats`, bộ placement trỏ tới chúng; seed khớp chủ đề theo `(skill, level, name.en)` nên đổi tên `en` sẽ tạo chủ đề mới). Quy ước khóa: `vocab-n4-<chủ-đề>`, `grammar-n4-<chủ-đề>`, `kanji-n4-<chủ-đề>`, `reading-n4-<dạng|chủ-đề>`, `writing-n4-<chủ-đề>`. Quy tắc kích thước (lint cảnh báo → lỗi ở `--final`): mỗi chủ đề từ vựng/ngữ pháp/Kanji có **≥ 20 bài tập** tổng (cửa sổ `TOPIC_WINDOW = 20`, ngưỡng 8 câu của `insufficient`/mảng yếu) và ≥ 2 đơn vị; `name.en` duy nhất trong (kỹ năng × trình độ).

Ước lượng: ngữ pháp ≈ 10–12 chủ đề/trình độ (điều kiện, lý do, mục đích, so sánh, thể bị động/sai khiến, kính ngữ, cho–nhận, phỏng đoán/truyền đạt, thời gian…); từ vựng ≈ 25 (N4) và ≈ 60 (N3) chủ đề; Kanji ≈ 10–12/trình độ; đọc hiểu theo dạng và chủ đề.

**Lý do**: chủ đề quá hẹp thì tín hiệu yếu "chưa đủ dữ liệu" mãi; quá rộng thì không chỉ được nhóm kiến thức cụ thể. 20 bài tập khớp đúng cửa sổ thống kê hiện có nên **không đổi** engine độ khó/năng lực.

**Đã cân nhắc**: chủ đề theo từng đơn vị (≈ 1 chủ đề/đơn vị) — mỗi chủ đề chỉ 10–20 câu, màn Tiến độ liệt kê hàng trăm mục `insufficient`.

## D10. Thứ tự học ở quy mô lớn (FR-011, FR-020; Câu chuyện 1 kịch bản 4; Câu chuyện 4)

Đây là điểm **duy nhất** mà thiết kế điểm hiện tại không còn đúng khi thư viện lớn.

**Vấn đề đã chứng minh từ mã**: `sequence` chỉ nặng 0,01 điểm/đơn vị còn mảng yếu +40 và độ lệch độ khó ±16 tương đương "nhảy" 1.600–4.000 vị trí `sequence` — tức là nhảy tới bất kỳ đâu trong trình độ. Khi thư viện chỉ có 3–4 đơn vị mỗi loại thì không ai nhận ra; khi có 80–250 đơn vị từ vựng, một mảng yếu hoặc độ lệch độ khó có thể đẩy một bài ngữ pháp "thể bị động" lên trước bài "thể ない" làm nền của nó.

**Quyết định** (ba lớp, từ nội dung tới engine):

1. **Gán `sequence` theo chặng, dùng một trục thời gian chung cho mọi loại trong một trình độ**: `sequence = chặng × 100 + vị trí (10, 20, …)`; ≈ 20 chặng cho N4 và ≈ 30 cho N3; mỗi chặng chứa lượng từ vựng/ngữ pháp/Kanji/đọc/viết **tỷ lệ với tổng khối lượng** của loại đó. `sequence` PHẢI **duy nhất trong (trình độ × loại)** (lint) vì phá hòa theo UUID là không tất định. Đơn vị cũ giữ nguyên `sequence` (không sửa được bằng seed): chúng nằm ở chặng 0–3 một cách tự nhiên (từ vựng/ngữ pháp 10–30, Kanji 100–120, đọc/viết 200–350).
2. **`requires[]` ở cấp file** (kiến thức nền, D8) và lint: đơn vị được yêu cầu phải tồn tại, ở cùng hoặc thấp hơn trình độ và có `(trình độ, sequence)` **nhỏ hơn**. Đây là cách ghi lại tiên quyết có kiểm tra, **không** cần cột DB hay logic khóa bài.
3. **"Biên giới" (frontier) trong `rankUnits`** — thay đổi engine nhỏ, thuần hàm: với mỗi loại, chỉ `FRONTIER_SIZE = 3` đơn vị đầu tiên (theo `(trình độ, sequence)`) còn **chưa học/đang học/chưa thành thạo** được hưởng cộng điểm thích ứng (mảng yếu, độ lệch độ khó, kỹ năng ưu tiên); các đơn vị còn lại ở **ngoài biên giới** có điểm chỉ phụ thuộc `(trình độ, sequence)` và luôn xếp sau biên giới. Đơn vị `in_progress` luôn thuộc biên giới (giữ +2000). **Mở rộng theo mục tiêu** (để Câu chuyện 2 kịch bản 4 còn nghĩa khi thư viện lớn): với học viên có `goalType` là `work` hoặc `daily_conversation`, biên giới của mỗi loại còn gồm tối đa `GOAL_EXTRA = 3` đơn vị đầu tiên có thẻ trùng `goalType` nằm trong `GOAL_LOOKAHEAD = 12` đơn vị pending đầu của loại đó; chúng được chấm điểm như đơn vị trong biên giới (kể cả +20 thẻ mục tiêu). Không áp dụng cho `jlpt` (mọi đơn vị đều mang thẻ `jlpt`) hay khi chưa có mục tiêu. Để việc đề bạt không vượt qua tiên quyết, lint AU10 cấm đơn vị mang thẻ `work`/`daily_conversation` có `requires` trỏ tới đơn vị **cùng loại** (tiên quyết chéo loại vẫn chỉ gần đúng — xem "Giới hạn đã biết"). Hệ quả: mỗi loại luôn đi đúng thứ tự giáo trình; thích ứng chỉ **hoán đổi trong 3 bài tiếp theo**; các loại **tự cân bằng theo trục thời gian chung** (loại nào tụt chặng thì điểm cao hơn nên được chọn nhiều hơn).

**Tương thích**: khi mỗi loại còn ≤ 3 đơn vị chưa học trong phạm vi (như thư viện hiện tại ở hầu hết hồ sơ), biên giới bao trùm tất cả và kết quả **trùng hoàn toàn** với công thức cũ. Các hồ sơ đại diện hiện có (người mới N5 đi qua nhiều trình độ) có thể đổi thứ tự ở phần "ngoài biên giới"; bước 0 chụp golden và phần thay đổi được rà soát có chủ đích (không chấp nhận âm thầm).

**Giới hạn đã biết**: tiên quyết **chéo loại** (ví dụ ngữ pháp cần từ vựng) chỉ được bảo đảm "gần đúng" theo trục chặng, không tuyệt đối; chấp nhận được vì mọi ví dụ đều có cách đọc kana (Trường hợp biên của spec) và tiên quyết thật sự của ngôn ngữ chủ yếu nằm trong **cùng loại** (ngữ pháp → ngữ pháp, Kanji → Kanji).

**Lý do chọn biên giới thay vì cách khác**: không cần cột DB, không cần đồ thị tiên quyết, không cần khóa bài; vẫn là một hàm thuần có thể kiểm bằng hồ sơ đại diện (hiến pháp). Cùng một `rankUnits` được `rankClassUnits` (chế độ mẫu) dùng nên **lớp học nhận cùng bảo đảm**.

**Đã cân nhắc**: (a) tăng `W.sequence` lên ≥ 1 — phá cân bằng với bậc trình độ 100 và đổi mọi golden; (b) cột `prerequisites uuid[]` + khóa bài — migration, logic bỏ qua tiên quyết cho người xếp N3 (nhảy qua N4), UI giải thích vì sao bài bị khóa; (c) không đổi engine, chỉ gán `sequence` cẩn thận — thích ứng vẫn nhảy được tới bất kỳ đâu, bảo đảm chỉ "bằng niềm tin".

## D11. Ôn lùi có chặn cho người xếp thẳng N3 (Câu chuyện 4 kịch bản 2)

**Vấn đề**: `levelRange` thấp nhất = trình độ xuất phát, nên người xếp N3 **không bao giờ** thấy nội dung N4, kể cả mảng placement cho thấy họ yếu; lịch ôn (SRS) cũng không giúp vì họ chưa học mục nào của N4.

**Quyết định**: trong `rankUnits`, đơn vị của **đúng một bậc dưới** trình độ xuất phát đủ điều kiện **chỉ khi** `topicId ∈ params.weakTopics` (mảng yếu do placement, vốn đã được lưu trong lộ trình). Điểm trình độ của chúng **kẹp bằng 0** (không cộng +100 như công thức cũ cho `idx < startIdx`), nằm ngoài biên giới của loại, và **tổng cộng tối đa `REMEDIAL_MAX_UNITS = 3` đơn vị** (3 đơn vị đầu theo `sequence` của nhóm đủ điều kiện, bất kể trạng thái — nên sau khi học xong ba bài thì không bài ôn lùi nào xuất hiện thêm). Học viên không có placement, không xếp N3, hoặc đặt mục tiêu N4 không bị ảnh hưởng. Người học vẫn ghi đè được bằng "thành thạo" (Nguyên tắc III).

**Lý do**: thỏa "vẫn có thể được gợi ý ôn nội dung N4 ở mảng họ yếu" bằng cách **chặn cứng** để khỏi biến N3 thành N4 trá hình (≤ 3 đơn vị ≈ 15–30 phút).

**Đã cân nhắc**: (a) không làm gì, nói rõ người học đổi trình độ để học N4 — kịch bản 2 chỉ còn đúng ở chữ "có thể" mà không có cơ chế; (b) mở toàn bộ N4 cho mảng yếu — có thể đẩy 10–20 đơn vị N4 lên trước N3; (c) tính theo `topic_stats.isWeak` — người xếp N3 gần như không có thống kê N4 nên không bao giờ kích hoạt.

## D12. Tiến độ mục tiêu và thông báo phần nghe hiểu (FR-022, Câu chuyện 4 kịch bản 5)

**Quyết định**:

1. `goalRatio` đổi sang **trọng số theo `estMinutes`**: `ratio = Σ phút(đã xong) / Σ phút(trong phạm vi)` (vẫn làm tròn 3 chữ số, vẫn là **một nguồn** cho `GET /progress` và thành tựu `goal_*`). Lý do: đơn vị 5/10/15 phút lệch nhau và từ vựng chiếm ≈ 45–50% số đơn vị (≈ 260/545) nên tiến độ theo số đơn vị phản ánh "đã học bao nhiêu từ vựng" hơn là "đã đi bao xa đến N3"; cách theo phút cũng **khớp** với `isOnTrack` vốn đã tính theo phút. Cần xác nhận vì đổi số người học nhìn thấy và ngưỡng thành tựu (C4). **Tác động lên golden**: thư viện baseline có 13 đơn vị 10 phút và 20 đơn vị 5 phút nên `completionRatio` của hồ sơ baseline đổi; golden bước 0 được tách hai phần — (a) kế hoạch ngày và thứ tự lộ trình PHẢI giống hệt, (b) `completionRatio` được cập nhật có chủ đích và ghi bảng chênh lệch (hồ sơ, giá trị cũ → mới) vào `quickstart-results.md`.
2. Thêm trường **suy ra lúc đọc** `notices: string[]` (giá trị `content_ceiling_n3`, `listening_not_available`) vào `PathSummary` và `ProgressSummary.goal`; `listening_not_available` có mặt **khi và chỉ khi** `goalType = 'jlpt'`. Giữ nguyên `scopeNotice` (tương thích). Client hiển thị bằng cùng thành phần banner đang dùng cho `content_ceiling_n3` ở: kết thúc onboarding, màn Hồ sơ (mục mục tiêu), Lộ trình, Tiến độ.

**Lý do (2)**: `ScopeNotice` được lưu trong `generated_from` lúc dựng lộ trình nên lộ trình đã tồn tại không có giá trị mới; tính lúc đọc từ hồ sơ làm mọi người học JLPT (cũ lẫn mới) thấy thông báo mà không cần dựng lại lộ trình hay migration dữ liệu.

**Đã cân nhắc**: giữ `goalRatio` đếm đơn vị và chỉ ghi chú — người học đã làm hết ngữ pháp + Kanji vẫn thấy ~35%; thêm `listening_not_available` vào `ScopeNotice` — không áp dụng được cho lộ trình đã lưu.

## D13. Bộ câu hỏi xếp lớp giữ nguyên (FR-021)

**Quyết định**: **không đổi** `placement-v1.json` (20 câu: 8 N5, 6 N4, 6 N3) và không đổi cách chấm. Điểm xuất phát N4/N3 trong thư viện mở rộng là đơn vị đầu của trình độ đó theo `(chặng, sequence)` (D10), nên người xếp N4 đi từ đầu N4.

**Lý do**: placement chỉ cho **trình độ thô** và mảng yếu; khối lượng nội dung tăng không làm trình độ thô sai đi. Các chủ đề placement hiện có vẫn là chủ đề thật (D9 giữ khóa) và là nguồn của `weakTopics` cho D11. Người xếp lệch có hai lối thoát đã có: đánh dấu thành thạo từng đơn vị, hoặc dựng lại lộ trình theo trình độ khác (Nguyên tắc III).

**Đã cân nhắc**: tăng bộ câu hỏi (ví dụ 12 N4 + 12 N3) — chạm engine chấm, ngưỡng đỗ, hồ sơ đại diện và UI thời gian làm bài, không thuộc phạm vi "chỉ mở rộng nội dung"; ghi nhận ở "Rủi ro" của plan (xếp sai trình độ gây tốn công đánh dấu thành thạo từng đơn vị khi thư viện lớn → nên có spec riêng cho đánh dấu hàng loạt theo chủ đề/chặng).

## D14. Luyện đọc hiểu theo dạng đề thi (FR-009, Câu chuyện 5)

**Quyết định**:

- **Hợp đồng nội dung**: nới giới hạn độ dài đoạn văn của quy tắc PR3 (spec 007) từ 400 lên **700 ký tự cho đơn vị N3 từ 10 phút trở lên** (N4 và đơn vị 5 phút giữ nguyên 400/200) để chứa đoạn vừa (中文) và thông tin tra cứu (情報検索: lịch, quảng cáo, bảng giá viết dạng văn bản nhiều dòng). Thay đổi quy tắc, không đổi JSON Schema (schema không giới hạn độ dài); ghi tại [contracts/content-authoring.md](contracts/content-authoring.md) §5 và `CHANGELOG`. Cần xác nhận client hiển thị xuống dòng trong `PassagePanel` (kiểm tra ở bước hiện thực; nếu thiếu thì thêm bảo toàn xuống dòng — thay đổi hiển thị nhỏ).
- **Dạng đọc** (cột `format`): `comprehension_short` (đoạn ngắn), `comprehension_mid` (đoạn vừa), `info_search` (tra cứu thông tin); mỗi trình độ ≥ 30 đơn vị, ≥ 8 chủ đề, ≥ 4 dạng văn bản (thông báo, thư/email, bài viết ngắn, tra cứu) — kiểm bằng `scopeRef` của đoạn văn đối với dòng `reading` của danh mục (D2).
- **Phạm vi từ vựng/ngữ pháp trong đoạn** (FR-009): kiểm tự động **ở mức chữ Hán** — mỗi chữ Hán trong đoạn thuộc N5 (`n5-kanji.ref.json`) hoặc danh mục Kanji ≤ trình độ của bài, nếu không phải được nêu ở `explanation` (chú giải). Từ vựng và ngữ pháp vượt phạm vi do **người duyệt** xác nhận (checklist) vì kiểm tự động cần bộ phân tích hình thái tiếng Nhật (thêm phụ thuộc lớn, không biện minh được cho một lint).
- Chuyển sang quy tắc phản hồi "chỉ ra phần đoạn văn dẫn tới đáp án" (kịch bản 3): lint kiểm `feedbackIncorrect` của câu hỏi đọc hiểu chứa một trích dẫn trong 「」 xuất hiện trong đoạn văn (cảnh báo).

**Đã cân nhắc**: thêm loại bài "đoạn dài có nhiều câu hỏi" — không cần, 2–5 câu hỏi/đoạn đã đúng; thêm bộ phân tích hình thái — phụ thuộc lớn cho lợi ích nhỏ.

## D15. Hiệu năng khi thư viện lớn gấp ≈ 18 lần (SC-007, Trường hợp biên)

**Quyết định**:

- **Engine/bộ đệm**: `ContentCache.activeUnits()` đọc ≈ 600 dòng mỗi 60 giây, `rankUnits` O(n log n) với n ≈ 600 — không cần đổi. Thêm kiểm thử vi mô (`perf-large-catalog.test.ts`): `rankUnits` + biên giới trên 700 đơn vị tổng hợp < 5 ms trung vị; `GET /today` đo p95 với thư viện đầy đủ so với baseline, **không chậm hơn quá 10%** (SC-007; đo ở QS5).
- **Seed**: ghi theo lô (`insert … values [..]` cho mục và bài tập của một đơn vị), đọc **một lần** toàn bộ khóa đơn vị đã có thay vì một truy vấn mỗi đơn vị; mục tiêu seed đầy đủ ≤ 120 giây, chạy lại không đổi gì ≤ 15 giây. Nạp theo đợt: mỗi lần chạy chỉ chèn thêm đơn vị mới.
- **`GET /path`**: hiện trả **toàn bộ** đơn vị xếp hạng (≈ 600 dòng, ≈ 90 KB). Thêm tham số **tùy chọn** `kind`, `level`, `status`, `limit`, `offset` và trường `itemsTotal`; mặc định giữ hành vi cũ (tương thích). Client dùng danh sách dựng lười + lọc theo loại/trình độ. Chi tiết [contracts/api-changes.md](contracts/api-changes.md).
- **Màn khác**: Hôm nay (≤ 6 mục) và Ôn tập không phụ thuộc kích thước thư viện; Tiến độ liệt kê chủ đề **có dữ liệu** nên tăng theo hành vi học, không theo thư viện (nhóm theo kỹ năng ở client).
- **Phải rà soát khi hiện thực**: màn chọn đơn vị của giáo viên (spec 004, chế độ liệt kê) và danh sách Admin — đảm bảo có lọc/phân trang cho ≈ 600 đơn vị (kiểm tra mã ở bước hiện thực; nếu thiếu thì thêm lọc loại/trình độ).

**Đã cân nhắc**: bộ đệm xếp hạng theo người học — thêm trạng thái cần vô hiệu hóa, không cần ở n ≈ 600.

## D16. Quy trình biên soạn an toàn bản quyền và đảm bảo chất lượng (FR-016, FR-017, SC-005, SC-008)

**Quyết định** (mở rộng quyết định của spec 007):

1. **Viết mới** theo phạm vi của danh mục (D2); đoạn văn, câu hỏi, ví dụ **không chép nguyên văn** từ giáo trình/web. Ghi nguồn tham khảo ở `sources[]` của manifest từng đợt (mô tả nguồn và phần tham khảo — phạm vi trình độ/chủ đề — không dán nội dung).
2. **Ba cổng**: (a) cổng máy: `pnpm content:lint` (schema, quy tắc D8, glyph, trùng lặp, `requires`, `sequence`, kanji-trong-phạm-vi cho đoạn đọc) trên `drafts/` và `units/`; (b) **tự rà** của người soạn theo checklist từng loại (mở rộng checklist trong `content/README.md`); (c) **duyệt của người có chuyên môn tiếng Nhật** — mỗi đơn vị, trước khi chuyển sang `units/` (FR-017).
3. **Đợt nhỏ**: tối đa ≈ 40 đơn vị/đợt để người duyệt kiểm hết được; ưu tiên kiểm chặt các lỗi mà máy không bắt được: cách đọc kana sai, đáp án đúng thứ hai (hai đáp án cùng đúng), bản dịch sai nghĩa, ví dụ không tự nhiên.
4. **Lấy mẫu sau phát hành** (SC-005): rà lại 5% đơn vị đã kích hoạt sau mỗi 3 đợt; không quá 1 lỗi/100 mục. Lỗi tìm được xử lý theo D5 (vô hiệu hóa + thay thế) hoặc D6 (bổ sung).
5. **Đối chiếu độc lập** (SC-008): người có chuyên môn đối chiếu danh mục với tài liệu thi tham khảo chuẩn và xác nhận bằng văn bản, lưu cạnh `content/scope/` (`REVIEW.md`).

**Rủi ro nêu rõ**: bản nháp do AI hỗ trợ có thể sai cách đọc kana hoặc tạo hai đáp án cùng đúng ở quy mô lớn; vì vậy cổng (c) là **bắt buộc** cho từng đơn vị chứ không lấy mẫu, và lấy mẫu ở (4) chỉ là kiểm tra chất lượng hồi tố.

## D17. Khối lượng thư viện và đường băng 180 ngày (SC-003, FR-020)

**Quyết định**: kích cỡ đơn vị ở D8 + tỷ lệ 30% đơn vị 5 phút / 70% đơn vị 10 phút cho từ vựng, ngữ pháp, Kanji; cho kết quả ước lượng (mức phủ tối thiểu theo FR-003):

| Loại | Mục cần phủ (N4 + N3) | Mục/đơn vị TB | Số đơn vị ≈ | Phút nội dung mới ≈ |
|---|---|---|---|---|
| Ngữ pháp | 200 × 95% = 190 mẫu | 3,4 | 56 | 476 |
| Từ vựng | 2.950 × 90% = 2.655 từ | 10,2 | 260 | 2.210 |
| Chữ Hán | 550 × 95% = 522 chữ | 4,05 | 129 | 1.096 |
| Luyện đọc | ≥ 30 × 2 | 1 đoạn | ≥ 60 | ≈ 450 (chỉ ≥ 30 phút/ngày) |
| Luyện viết | ≥ 20 × 2 | 3–6 mục | ≥ 40 | ≈ 300 (chỉ ≥ 30 phút/ngày) |
| **Từ vựng + ngữ pháp + Kanji** | | | **≈ 445** | **≈ 3.780** |

**Kiểm tra SC-003 (học viên N4, JLPT, 15 phút/ngày, kỹ năng gợi ý = từ vựng + ngữ pháp + Kanji)**: kể cả giả định xấu nhất (mọi ngày không có bài ôn nên toàn bộ 15 phút là bài mới) cần 180 × 15 = 2.700 phút < 3.780 phút (dư ≈ 40%); trường hợp thực (ôn chiếm tới 60% quỹ) chỉ cần ≈ 1.080 phút. Với hai loại (từ vựng + ngữ pháp = 2.686 phút) giá trị xấu nhất là ≈ 179 ngày — sát ngưỡng nhưng đó không phải hồ sơ 15 phút theo gợi ý; mô phỏng ở QS3 chạy cả hai.

**Mục tiêu bổ sung (không thuộc SC)**: học viên **5 phút/ngày** (chỉ vừa đơn vị 5 phút, thường cách ngày có bài mới vì ôn chiếm 3/5 phút) có ≥ 90 ngày: cần ≥ 90 đơn vị 5 phút; thư viện có ≈ 0,3 × 445 ≈ 134 → đạt.

**Kiểm chứng**: `content:stats` in bảng trên theo thư viện thật; `runway.test.ts` mô phỏng bằng `simulate-plans` (không cần DB) cho các hồ sơ N4/5, N4/10, N4/15, N3/30, quay lại sau gián đoạn trong ≥ 180 ngày: 0 thông báo hết nội dung với hồ sơ 15 phút (SC-003), 100% kế hoạch ≤ quỹ (SC-003), không đơn vị nào xuất hiện lại như bài mới, tỷ lệ ngữ pháp/Kanji/từ vựng trong mọi cửa sổ 30 ngày ≥ 15% mỗi loại đã chọn.

---

## Phát hiện về hiến pháp và phạm vi

Chưa cần sửa hiến pháp (spec khẳng định, kèm điều kiện ở C8): Learning Content gồm từ vựng, ngữ pháp, Kanji N5–N3 thuộc Giai đoạn 1; luyện đọc/viết đã được chấp nhận có biện minh ở spec 007; spec này nâng luyện đọc từ ~12 lên ≥ 60 đơn vị nên **cần biện minh lại** (plan.md, "Theo dõi độ phức tạp") và chủ dự án xác nhận ở C8. **Luyện nghe/nghe hiểu** (Giai đoạn 2) KHÔNG xây; thay vào đó có thông báo (D12). Không thêm dịch vụ nền, bảng, hay phụ thuộc chạy.

## Điểm cần chủ dự án xác nhận

| Mã | Điểm | Mặc định kế hoạch giả định | Ảnh hưởng nếu khác |
|---|---|---|---|
| **C1** | **Ai biên soạn và ai duyệt** từng đơn vị (người có chuyên môn tiếng Nhật, FR-017; xác nhận văn bản SC-008) và năng lực duyệt ≈ 40 đơn vị/đợt | Người duyệt do chủ dự án chỉ định **trước khi** bắt đầu đợt 2 | **Điều kiện cứng**: không có người duyệt thì không đơn vị nào được chuyển sang `units/` (D5, D16) → không phát hành được |
| **C2** | **Duyệt danh mục phạm vi và giấy phép nguồn** (cổng G0) | Chủ dự án duyệt 8 file `content/scope/` + `n5-kanji.ref.json` và danh sách nguồn trước khi biên soạn hàng loạt; từng nguồn được kiểm tra giấy phép | Chưa có G0 thì chỉ làm hạ tầng và đợt mẫu nhỏ; biên soạn hàng loạt trước G0 có nguy cơ làm lại |
| **C3** | **Chia đợt và ngưỡng mở cho người học** | Bảng đợt gợi ý ở [plan.md](plan.md) §"Chia đợt phát hành"; mỗi đợt dùng được độc lập (FR-018), phát hành ngay sau khi duyệt | Gộp đợt lớn hơn: ít lần seed nhưng review nặng hơn |
| **C4** | **Đổi `completionRatio` sang trọng số theo phút** (D12.1) | Đồng ý; ngưỡng thành tựu `goal_*` giữ nguyên, kiểm hồi quy | Giữ đếm đơn vị: tiến độ lệch về từ vựng; không cần đổi hàm |
| **C5** | **Nới giới hạn đoạn đọc N3 lên 700 ký tự** (D14) | Đồng ý | Giữ 400: không có dạng 情報検索/中文 đúng kích thước đề thi N3 |
| **C6** | **Chấp nhận hai thay đổi nhỏ của Learning Engine** (biên giới D10, ôn lùi D11) | Đồng ý; golden kế hoạch/thứ tự baseline giữ nguyên (D10 gồm cả mở rộng theo mục tiêu), mọi thay đổi thứ tự được rà soát | Không đổi engine: thứ tự giáo trình chỉ bảo đảm "bằng niềm tin" và AC2 của Câu chuyện 4 chỉ đúng ở chữ "có thể" |
| **C7** | **Giữ nguyên bộ xếp lớp 20 câu** (D13) | Giữ; ghi rủi ro | Mở rộng bộ câu hỏi: tách spec riêng |
| **C8** | **Phạm vi giai đoạn của luyện đọc**: hiến pháp v1.2.0 xếp "luyện nghe và đọc" ở Giai đoạn 2; spec 007 đã biện minh cho ~12 bài, spec này mở rộng lên ≥ 60 đơn vị | Chấp nhận biện minh bằng văn bản ở plan.md ("Theo dõi độ phức tạp"); không sửa hiến pháp | Chủ dự án có thể chọn sửa hiến pháp 1.3.0 (dự thảo ở 007/research §Q2): không đổi thiết kế, chỉ đổi thủ tục; nếu bác bỏ cả hai thì bỏ US5 và đợt 012 |
