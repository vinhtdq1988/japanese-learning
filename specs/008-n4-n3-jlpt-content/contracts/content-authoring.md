# Hợp đồng: Quy ước biên soạn và quy tắc kiểm tra nội dung N4/N3

**Nhánh**: `008-n4-n3-jlpt-content` | **Đặc tả**: FR-004 → FR-015, FR-019 | **Mô hình**: [data-model.md §5–§6](../data-model.md) | **Quyết định**: [research.md D8, D9, D10, D14](../research.md)

Tài liệu này **bổ sung** (không thay) các quy ước đã có trong [`content/README.md`](../../../content/README.md) (Kanji — spec 003; luyện đọc/viết — spec 007). Schema `unit` nâng 1.2.0 → **1.3.0** (chỉ thêm trường tùy chọn); các quy tắc mới đặt ở `backend/src/domain/content-validation.ts` và chỉ áp cho đơn vị **ngoài baseline** (`000-baseline` được miễn vì không sửa được bằng file).

## 1. Kích thước đơn vị và thời lượng (FR-012)

Quỹ thời lượng hiện hành giữ nguyên: số bài tập × 30 giây ≤ `estMinutes` × 60 (luyện đọc 60 giây/câu, luyện viết 45 giây/câu).

| Loại | 5 phút | 10 phút | Ghi chú |
|---|---|---|---|
| Từ vựng | 6 từ, 8–10 bài tập | 12 từ, 16–20 bài tập | 1 chủ đề/đơn vị; ≈ 1,5 bài tập/từ |
| Ngữ pháp | 2 mẫu, 6–8 bài tập | 4–5 mẫu (trung bình ≥ 4,5), 12–16 bài tập | ≥ 2 bài tập gắn mục mỗi mẫu |
| Chữ Hán | 3 chữ, ≈ 10 bài (quy ước 003) | 4–5 chữ, 13–16 bài | Không đổi so với spec 003 |
| Luyện đọc | 1 đoạn ≤ 200 ký tự, 2–5 câu | 1 đoạn ≤ 400 (N4) / ≤ 700 (N3), 2–5 câu | §5 |
| Luyện viết | 3–6 mục | 3–6 mục | Không đổi spec 007 |

- **Tỷ lệ 5 phút**: mỗi (loại × trình độ) của từ vựng, ngữ pháp, Kanji có **≥ 30% đơn vị 5 phút** (lint cảnh báo) để học viên 5 phút có "đường băng" (research D17).
- Đơn vị 15 phút **không** dùng ở bản này (không có nhu cầu; vẫn hợp lệ nếu cần).
- Chủ đề (một đơn vị một chủ đề), `difficulty` 1–5 (N4 chủ yếu 2–3, N3 chủ yếu 3–4), `goalTags` **bắt buộc có `jlpt`** (FR-011) cộng `work`/`daily_conversation` khi phù hợp, `tier = core`, `isTrial = false`.

## 2. Cấu trúc nội dung từng loại

### 2.1 Từ vựng (FR-005)

- Mục: `japanese` (viết bằng chữ như đề thi N4/N3, có Kanji nếu từ thường viết bằng Kanji), `reading` kana, `meaning` vi + en, **≥ 1** `examples[]` với `ja`, `reading` (kana, **bắt buộc**), `translation` vi + en.
- Nhóm theo chủ đề mạch lạc (công việc, sức khỏe, giao thông, xã hội, cảm xúc…); ví dụ dùng từ trong ngữ cảnh tự nhiên, ưu tiên từ cùng chặng hoặc thấp hơn.
- Ví dụ dùng chữ Hán chưa học vẫn có `reading` kana đầy đủ (Trường hợp biên của spec).
- Đồng tự (như 方 かた/ほう): mỗi cách đọc là một mục khác nhau (khóa `japanese|reading`).

### 2.2 Ngữ pháp (FR-004)

- Mục: `japanese` (mẫu), `meaning` vi + en (ý nghĩa/cách dùng), `explanation` vi + en gồm **ý nghĩa, cách chia/kết hợp** (ví dụ "Vる/V ない + ために"), **sắc thái hoặc khác biệt với mẫu gần nghĩa** (khi có), `examples[]` ≥ 1 (có `reading` kana, bản dịch vi + en), và `scopeRef` trỏ dòng `g-…` của danh mục.
- Mẫu dễ nhầm (ví dụ 〜ために / 〜ように; 〜ので / 〜から) PHẢI nằm **cùng đơn vị hoặc đơn vị liền kề** và có ≥ 1 bài `contrast` phân biệt hai mẫu (kịch bản 3 của Câu chuyện 1).
- Kiến thức nền ghi ở `requires[]`; thứ tự theo §6.
- Phản hồi sai giải thích **vì sao đáp án đúng là đúng** (FR-014, kịch bản 5): nêu quy tắc/mẫu liên quan chứ không chỉ "đáp án đúng là B".

### 2.3 Chữ Hán (FR-006)

Theo nguyên văn [`content/README.md` — "Biên soạn bài Kanji"](../../../content/README.md): 3–5 chữ/bài; đủ ba khía cạnh `meaning`, `reading`, `word` mỗi chữ; từ ngữ cảnh trong câu `reading` của chữ nhiều âm; không luyện viết tay/thứ tự nét; mỗi chữ thuộc **một** bài (cách đọc mới ở trình độ cao hơn → `amendments`, [release-manifest.md §4](release-manifest.md)). Thêm: `topic` mỗi chữ là chủ đề `kanji-n4-*`/`kanji-n3-*`.

### 2.4 Luyện đọc và luyện viết

Theo [spec 007 `practice-content.md`](../../007-fix-comments/contracts/practice-content.md) với **một thay đổi giới hạn độ dài** ở §5 dưới đây.

## 3. Ánh xạ dạng câu hỏi thi → dạng bài tập hiện có (FR-008)

Không thêm loại bài tập. Cột `format` là siêu dữ liệu file (không vào DB). Dạng đề thi chưa thể hiện được ghi rõ ở cột cuối.

| Phần thi | Dạng đề thi (N4/N3) | `format` | Loại bài tập dùng | Cách biểu diễn |
|---|---|---|---|---|
| Chữ – từ vựng | 漢字読み (chọn cách đọc chữ Hán) | `kanji_reading` | `multiple_choice` (hoặc `fill_blank` gõ kana) | Câu có từ đặt trong 「」; 3–4 lựa chọn kana |
| | 表記 (chọn chữ Hán đúng cho cách đọc) | `orthography` | `multiple_choice` | Câu viết kana, lựa chọn là các dạng chữ Hán |
| | 文脈規定 (chọn từ hợp ngữ cảnh) | `context_fill` | `multiple_choice` / `fill_blank` | Câu có chỗ trống `（　）` |
| | 言い換え類義 (chọn từ gần nghĩa) | `synonym` | `multiple_choice` | Đề: 「X」と意味が近いもの |
| | 用法 (chọn câu dùng từ đúng; thường từ N3) | `usage` | `multiple_choice` | Đề đưa từ, lựa chọn là bốn câu |
| Ngữ pháp | 文の文法1 (chọn mẫu điền chỗ trống) | `form_fill` | `multiple_choice` / `fill_blank` | Chỗ trống `（　）` |
| | Chọn câu đúng ngữ pháp | `sentence_correct` | `multiple_choice` | Bốn câu, một câu đúng |
| | 文の組み立て (xếp câu, hỏi ô ★) | `sentence_order_star` | `multiple_choice` | Đề: `A　＿　＿　★　＿　B`, lựa chọn là mảnh/số thứ tự nằm ở ★ — **thay cho kéo–thả sắp xếp (chưa thể hiện)** |
| | 文章の文法 (điền chỗ trống trong đoạn) | `text_grammar` | `multiple_choice` | Đoạn ngắn có chỗ trống đánh số |
| | Phân biệt mẫu gần nghĩa | `contrast` | `multiple_choice` | Hai mẫu, chọn mẫu hợp ngữ cảnh |
| Đọc hiểu | 内容理解 (đoạn ngắn) | `comprehension_short` | `multiple_choice` | Đoạn dưới 200 ký tự |
| | 内容理解 (đoạn vừa) | `comprehension_mid` | `multiple_choice` | Đoạn 200–400 (N4) / 200–700 (N3) |
| | 情報検索 (tra cứu thông tin: lịch, quảng cáo, thông báo) | `info_search` | `multiple_choice` | Văn bản nhiều dòng; câu hỏi tìm thông tin theo điều kiện |
| Nghe hiểu | — | — | — | **Ngoài phạm vi** (spec; thông báo ở FR-022) |

Quy tắc phủ dạng (lint, ngoài baseline): **từ vựng** — đơn vị có ≥ 3 `format` khác nhau (≥ 2 với đơn vị 5 phút), và **bắt buộc** có `kanji_reading` khi ≥ 1 mục chứa Kanji; **ngữ pháp** — có ≥ 1 `form_fill`, cộng ≥ 1 `contrast` hoặc `sentence_correct` (cảnh báo nếu chỉ có `form_fill`); đơn vị 10 phút nên có thêm `sentence_order_star`; **đọc hiểu** — mỗi câu có một `format` thuộc nhóm đọc.

## 4. Quy tắc kiểm tra tự động mới (ngoài baseline)

Đặt ở `content-validation.ts`; "lỗi" chặn seed/kích hoạt, "cảnh báo" chỉ báo. Mã AU dùng trong test và checklist.

| Mã | Quy tắc | Mức | Yêu cầu |
|---|---|---|---|
| AU1 | Ví dụ của từ vựng/ngữ pháp có `reading` chỉ gồm kana/dấu câu | lỗi | FR-004, FR-005 |
| AU2 | Mục từ vựng có ≥ 1 ví dụ | lỗi | FR-005 |
| AU3 | `examples[].ja` chứa `japanese` của mục (từ vựng/ngữ pháp có biến cách ⇒ chỉ cảnh báo khi không chứa) | cảnh báo | FR-004/005 |
| AU4 | Mỗi mục từ vựng/ngữ pháp có ≥ 1 bài tập **gắn mục** (không thì mục không bao giờ vào lịch ôn); ngữ pháp có ≥ 2 | lỗi / cảnh báo | Nguyên tắc IV |
| AU5 | Mỗi bài tập của từ vựng, ngữ pháp, đọc hiểu có `format` đúng nhóm của loại (bảng §3) | lỗi | FR-008 |
| AU6 | Phủ dạng đề thi theo §3 (đơn vị từ vựng/ngữ pháp) | lỗi (từ vựng) / cảnh báo (ngữ pháp) | FR-008 |
| AU7 | Mục chính duy nhất theo khóa: Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp = `scopeRef` và `japanese` | lỗi | FR-007 |
| AU8 | `scopeRef` trỏ dòng danh mục tồn tại, cùng loại và cùng trình độ; ngữ pháp mới **phải** có `scopeRef` (baseline được gắn hồi tố ở T271/T272, lint không bắt buộc) | lỗi | FR-001, FR-002 |
| AU9 | `sequence` ≥ 100, theo mẫu `chặng × 100 + vị trí`, **duy nhất** trong (trình độ × loại) trên toàn thư viện (gồm baseline) | lỗi | research D10 |
| AU10 | `requires[]`: đơn vị tồn tại; trình độ ≤; `(trình độ, sequence)` nhỏ hơn; không chu trình; đơn vị mang thẻ mục tiêu ngoài `jlpt` (`work`/`daily_conversation`) KHÔNG có `requires` trỏ tới đơn vị cùng loại (có thể được đề bạt vượt thứ tự theo mục tiêu — research D10) | lỗi | FR-011 |
| AU11 | `goalTags` có `jlpt`; `tier = core` | lỗi | FR-011 |
| AU12 | Chủ đề: `name.en` duy nhất trong (kỹ năng × trình độ); chủ đề từ vựng/ngữ pháp/Kanji có ≥ 2 đơn vị và ≥ 20 bài tập | cảnh báo (lỗi ở `--final`) | FR-013 |
| AU13 | ≥ 30% đơn vị 5 phút mỗi (loại × trình độ) cho từ vựng/ngữ pháp/Kanji | cảnh báo | Trường hợp biên 5 phút |
| AU14 | Mọi ký tự có glyph trong `NotoSansJP.ttf` (mục, ví dụ, đáp án, lựa chọn, đề bài) | lỗi | FR-015 |
| AU15 | Chữ Hán trong đoạn đọc và mục luyện viết thuộc `n5-kanji.ref.json` ∪ danh mục Kanji ≤ trình độ của bài, hoặc được nêu ở `explanation` (chú giải) | lỗi | FR-009, FR-010 |
| AU16 | Phản hồi `feedbackIncorrect` không trùng `feedbackCorrect`, vi + en đều ≥ 15 ký tự; câu hỏi đọc hiểu: `feedbackIncorrect` có trích dẫn 「…」 xuất hiện trong đoạn | cảnh báo | FR-014, Câu chuyện 5 kịch bản 3 |
| AU17 | Không nội dung luyện viết tay/thứ tự nét (kiểm hiện có giữ nguyên) | lỗi | FR-006 |
| AU18 | Số đơn vị: mỗi trình độ ≥ 30 đơn vị `reading` (≥ 8 chủ đề, ≥ 4 dạng qua `scopeRef`) và ≥ 20 đơn vị `writing` (chỉ ở `--final` hoặc khi đợt đánh dấu hoàn tất) | lỗi (`--final`) | FR-009, FR-010, SC-006 |

Phần máy **không** kiểm được (người duyệt chịu trách nhiệm): cách đọc kana đúng, hai đáp án cùng đúng, bản dịch đúng nghĩa/tự nhiên, từ vựng và ngữ pháp trong đoạn đọc nằm trong phạm vi trình độ, ví dụ tự nhiên.

## 5. Thay đổi hợp đồng nội dung: giới hạn đoạn đọc N3 (FR-019)

| Quy tắc (spec 007 PR3) | Trước | Sau |
|---|---|---|
| Độ dài đoạn văn (`items[0].japanese`) | 20–400 ký tự; ≤ 200 khi bài 5 phút | **N4: không đổi.** **N3 và `estMinutes ≥ 10`: 20–700 ký tự.** Bài 5 phút luôn ≤ 200 |
| Xuống dòng trong đoạn | Chưa nêu | Cho phép `\n` (bảng giá, lịch, danh sách) — client PHẢI hiển thị xuống dòng trong `PassagePanel` |

Lý do: đề N3 có đoạn vừa ≈ 350 ký tự, đoạn dài ≈ 550 và tra cứu thông tin ≈ 600; giới hạn 400 không chứa được. **Không làm hỏng nội dung đã lưu** (nới giới hạn, không thu hẹp; đoạn cũ ≤ 400 vẫn hợp lệ). Ghi vào `content/schema/CHANGELOG.md` và `content/README.md`. Quỹ thời lượng đọc (60 giây/câu) không đổi; đoạn dài hơn dành cho bài 10 phút có 2–5 câu.

## 6. Thứ tự học và chặng (FR-011; research D10)

- `sequence = chặng × 100 + vị trí trong chặng (10, 20, …)`. ≈ 20 chặng cho N4, ≈ 30 chặng cho N3. Đơn vị cũ giữ `sequence` hiện có (chặng 0–3). Mọi loại dùng **một trục chặng chung** trong một trình độ; mỗi chặng chứa lượng từ vựng/ngữ pháp/Kanji/đọc/viết **tỷ lệ với tổng khối lượng loại đó** (ví dụ N3 mỗi chặng ≈ 1–2 ngữ pháp, 8–9 từ vựng, 3 Kanji, 1–2 đọc, 1 viết).
- Thứ tự trong chặng ưu tiên: **nền tảng trước** (thể ない/て/た và dạng thường trước điều kiện, bị động, sai khiến, kính ngữ), **từ thường gặp trước từ hiếm**, **mẫu dễ trước mẫu dễ nhầm**.
- `requires[]`: ghi tên file đơn vị nền khi có phụ thuộc khái niệm thật (ví dụ ngữ pháp bị động `requires` ngữ pháp thể ない và thể từ điển). Lint AU10 bảo đảm thứ tự `(trình độ, sequence)`; engine bảo đảm **trong cùng một loại** thứ tự này được tuân (biên giới, [data-model.md §7.1](../data-model.md)). Tiên quyết **chéo loại** chỉ được xếp gần đúng theo chặng.

## 7. Chủ đề (FR-013; research D9)

Khóa theo quy ước ở [data-model.md §6](../data-model.md); giữ nguyên chủ đề hiện có và dùng lại chúng cho đơn vị đầu tiên của mỗi chủ đề. Ví dụ chủ đề ngữ pháp N4: `te-form` (có sẵn), `comparison` (có sẵn), `grammar-n4-purpose-reason`, `grammar-n4-conditionals`, `grammar-n4-giving-receiving`, `grammar-n4-potential-volitional`, `grammar-n4-hearsay-conjecture`, `grammar-n4-honorific-basic`; chủ đề từ vựng N3: `vocab-n3-work-trade`, `vocab-n3-health-medical`, `vocab-n3-feelings-personality`, `vocab-n3-society-media`…

## 8. Checklist duyệt cho người có chuyên môn tiếng Nhật (FR-017; mở rộng `content/README.md`)

Áp cho **mọi** đơn vị mới, ngoài các mục cụ thể của Kanji (spec 003) và luyện đọc/viết (spec 007):

- [ ] Cách đọc kana của **từng mục và từng câu ví dụ** đúng (kể cả trường âm, tiểu âm, rendaku).
- [ ] Không có câu hỏi nào có **hai đáp án cùng đúng**; câu nhiều cách đọc/nghĩa đã nêu ngữ cảnh.
- [ ] Bản dịch vi và en đúng nghĩa, tự nhiên, nhất quán với tiêu đề/giải thích.
- [ ] Từ vựng/ngữ pháp **đúng trình độ** N4/N3 (hoặc thấp hơn); mục chưa đủ trình độ đã được chú giải.
- [ ] Đoạn luyện đọc và mục luyện viết: **mọi từ vựng và mẫu ngữ pháp** trong đoạn thuộc N4/N3 (hoặc thấp hơn) hoặc đã được chú giải ở `explanation` (máy chỉ kiểm chữ Hán — AU15; phần này do người duyệt xác nhận, FR-009).
- [ ] Ví dụ tự nhiên, không máy móc; ngữ pháp có ví dụ nhắc đúng sắc thái (lịch sự/thân mật/văn viết).
- [ ] Dạng câu hỏi bám đề thi (§3) và đủ dạng theo loại; `format` khớp nội dung thật của câu.
- [ ] Phản hồi sai **giải thích lý do**, không chỉ nêu đáp án.
- [ ] `sequence`, `requires`, `topic`, `scopeRef` hợp lý; mục chưa xuất hiện làm mục chính ở đơn vị khác.
- [ ] Đã thử làm hết đơn vị và thời gian xấp xỉ `estMinutes`.
- [ ] Nguồn tham khảo đã ghi ở manifest; **không** chép nguyên văn đoạn/câu hỏi/bài tập từ giáo trình hay web có bản quyền.
