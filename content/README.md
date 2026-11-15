# Nội dung học (`content/`)

Nội dung gốc của ứng dụng là **dữ liệu**, không phải mã (Nguyên tắc VI): mỗi file JSON trong thư mục này được kiểm tra bằng JSON Schema (`schema/`) và quy tắc nội dung (`backend/src/domain/content-validation.ts`), rồi nạp vào CSDL bằng `pnpm seed` (trong `backend/`). Thay đổi cấu trúc file PHẢI ghi vào `schema/CHANGELOG.md`.

| Đường dẫn | Nội dung |
|---|---|
| `topics.json` | Mảng (chủ đề) nội dung: khóa ổn định, kỹ năng, trình độ, tên vi/en |
| `units/*.json` | Mỗi file một đơn vị học (từ vựng, ngữ pháp, Kanji, luyện đọc hoặc luyện viết) kèm mục nội dung và bài tập. CHỈ chứa đơn vị ĐÃ DUYỆT và thuộc đúng một đợt phát hành (spec 008) |
| `releases/*.json` | Đợt phát hành: danh sách đơn vị đã duyệt, người duyệt, ngày duyệt, nguồn tham khảo, `amendments` (spec 008) |
| `drafts/<mã-đợt>/*.json` | Bản nháp chờ duyệt — KHÔNG BAO GIỜ được nạp hay hiển thị cho người học (spec 008) |
| `scope/*.json` | Danh mục phạm vi JLPT N4/N3 theo loại và tệp tham chiếu `n5-kanji.ref.json`; `scope/stage-plan.md` là kế hoạch chặng; `scope/REVIEW.md` là hồ sơ người duyệt (spec 008) |
| `placement/placement-v1.json` | Bộ 20 câu kiểm tra trình độ (không có Kanji) |
| `schema/` | JSON Schema: `unit` 1.3.0, `topics` 1.2.0, `placement` 1.0.0, `scope` 1.0.0, `release` 1.0.0 |

Quy ước chung: văn bản người học thấy luôn song ngữ `{ "vi": "...", "en": "..." }`; nội dung tiếng Nhật giữ nguyên; tên file đơn vị dạng `<trình-độ>-<loại>-<tên>.json` (ví dụ `n5-kanji-time.json`).

## Biên soạn bài Kanji

Bài Kanji (`"kind": "kanji"`) dạy **3–5 chữ mới** trong 5–15 phút, theo hướng **nhận diện**: nghĩa, cách đọc, từ chứa chữ. Số nét chỉ để hiển thị. KHÔNG biên soạn nội dung luyện viết tay hay thứ tự nét (ngoài phạm vi Giai đoạn 1, hiến pháp v1.1.0).

### Cấu trúc một bài

- `"tier": "core"` (Kanji không có tầng nền tảng), `goalTags` **không rỗng** (ví dụ `["jlpt", "daily_conversation", "work"]`) để lộ trình chọn lọc theo mục tiêu.
- `topic` của bài và `topic` của **từng chữ** là khóa chủ đề Kanji trong `topics.json`, có tiền tố `kanji-` (ví dụ `kanji-n5-time`) để không trùng khóa từ vựng (`numbers`). Chủ đề của chữ quyết định mảng yếu của chữ đó.
- Mỗi chữ (`items[]`) có: `japanese` (đúng **một** ký tự Kanji), `topic`, `meaning` vi + en, `kanjiDetails`, và ≥ 1 (nên ≥ 2) từ ví dụ ở `examples[]`.
- `kanjiDetails`: `onReadings` viết **katakana**, `kunReadings` viết **hiragana** với dấu `.` phân cách okurigana (`た.べる`; client hiển thị `た(べる)`), `strokeCount` 1–30, `components` tùy chọn. Chỉ cần một trong hai nhóm âm có dữ liệu; nhóm rỗng sẽ không hiển thị.
- Từ ví dụ: `ja` PHẢI chứa chính chữ đó, `reading` bằng kana, bản dịch vi + en; `kanjiReading` (tùy chọn) là cách đọc của **chính chữ** trong từ đó, bỏ okurigana (`ひと.つ` → `ひと`). Cách đọc ngoài tập đã khai báo (biến âm, ví dụ rendaku) chỉ bị cảnh báo.
- Mọi ký tự của `japanese` và `examples[].ja` PHẢI có glyph trong phông đóng gói `client/assets/fonts/NotoSansJP.ttf` (kiểm tra tự động; ký tự hiếm ngoài phông sẽ làm seed thất bại).

### Bài tập và khía cạnh

Mỗi chữ có **ít nhất một bài tập active cho mỗi khía cạnh** `facet`:

| `facet` | Kiểm tra | Dạng gợi ý |
|---|---|---|
| `meaning` | nhận diện nghĩa của chữ | `multiple_choice` (các lựa chọn là nghĩa vi/en) |
| `reading` | cách đọc của chữ **trong một từ cụ thể** | `fill_blank` |
| `word` | đọc/hiểu từ chứa chữ | `multiple_choice` |

- Bài tập gắn chữ khai báo `"item": "<chữ>"` và `facet` ≠ `item`. Bài tập không gắn chữ (ví dụ `matching` ghép chữ với nghĩa) bỏ `item` và để `facet` mặc định `item`; loại này chỉ dùng trong bài, không vào ôn tập.
- Câu `reading` của chữ có nhiều cách đọc PHẢI nêu **từ ngữ cảnh** trong đề ("Điền cách đọc của 「日」 trong 「日曜日」"), để không có hai đáp án đúng.
- `fill_blank` khai báo **mọi dạng kana chấp nhận** (ví dụ `["さん", "サン"]`). Hệ thống KHÔNG chuẩn hóa katakana ↔ hiragana khi chấm.
- Mỗi chữ chỉ thuộc **MỘT** bài trong toàn thư viện. Cách đọc mới ở trình độ cao hơn được bổ sung vào mục hiện có, không thêm chữ lặp ở bài khác.

### Thời lượng

Quỹ thời lượng: `số bài tập × 30 giây ≤ estMinutes × 60` (30 giây là cấu hình `REVIEW_SECONDS_PER_ITEM`; seed và kích hoạt trên Admin API cùng áp quy tắc này).

| `estMinutes` | Số chữ gợi ý | Số bài tập tối đa (30 giây/câu) |
|---|---|---|
| 5 | 3 chữ × 3 bài tập ≈ 9 câu, thêm tối đa 1 bài ghép | 10 |
| 10 | 4–5 chữ (12–15 câu) kèm bài ghép | 20 |
| 15 | 5 chữ, thêm bài ghép cặp | 30 |

Mỗi trình độ N5, N4, N3 PHẢI có ít nhất một bài Kanji 5 phút (SC-004).

### Duyệt trước khi kích hoạt

Người duyệt đánh dấu đủ các mục sau trước khi bài được kích hoạt (nhiều mục không kiểm tra hết bằng máy được):

- [ ] Câu `reading` của chữ nhiều cách đọc đã nêu từ ngữ cảnh và **không có hai đáp án đúng** (kể cả ở bài `word`).
- [ ] `fill_blank` khai báo đủ các dạng kana chấp nhận (hiragana và katakana).
- [ ] `goalTags` không rỗng và phù hợp nội dung bài.
- [ ] Chữ chưa có ở bài khác; không có chữ lặp trong cùng bài.
- [ ] Nghĩa, phản hồi và từ ví dụ có đủ vi + en, đọc tự nhiên ở cả hai ngôn ngữ.
- [ ] Số bài tập nằm trong quỹ thời lượng; đã thử làm hết bài và tốn xấp xỉ `estMinutes`.
- [ ] Không có nội dung luyện viết tay/thứ tự nét.

## Biên soạn bài luyện đọc/viết

Tóm tắt [specs/007-fix-comments/contracts/practice-content.md](../specs/007-fix-comments/contracts/practice-content.md). Hai loại `"kind": "reading"` và `"kind": "writing"` chỉ dành cho người học có quỹ thời gian từ 30 phút mỗi ngày, nhưng một bài vẫn dài 5 hoặc 10 phút (`estMinutes`) để mỗi phiên nằm trong 5–15 phút. `tier` luôn là `core`, `goalTags` không rỗng, mỗi bài thuộc một chủ đề (`topic`) cùng `skill` và trình độ (ví dụ `reading-n5-daily-life`, `writing-n5-greetings`).

- **Luyện đọc**: đúng **1** mục là đoạn văn (`japanese` 20–400 ký tự ở N4, **tối đa 700 ký tự ở N3 từ bài 10 phút** (cho phép xuống dòng `
`), tối đa 200 khi bài 5 phút; `reading` kana; `meaning` vi + en) và **2–5** câu `multiple_choice` (3–4 lựa chọn, một đáp án đúng). Phản hồi đúng/sai PHẢI giải thích theo nội dung đoạn văn, vi + en.
- **Luyện viết**: **3–6** mục (từ, chữ Kanji hoặc câu ngắn ≤ 40 ký tự; có `reading` kana và `meaning` vi + en), mỗi mục đúng **1** bài `fill_blank`; đề bài tự nêu nghĩa cần gõ.
- **Bài tập không gắn mục**: KHÔNG khai `item` trong bài tập của hai loại này. Bài tập không gắn mục không tạo lịch ôn và không vào gói ôn tập; kết quả vẫn được ghi theo chủ đề của đơn vị.
- **Quỹ thời lượng**: đọc `số câu × 60 giây ≤ estMinutes × 60`; viết `số câu × 45 giây ≤ estMinutes × 60` (5 phút: tối đa 5 câu đọc / 6 câu viết; 10 phút: 5 câu đọc / 13 câu viết).
- **Liệt kê đủ dạng chấp nhận**: bộ chấm chỉ chuẩn hóa NFKC, khoảng trắng và chữ thường, KHÔNG đổi qua lại hiragana ↔ katakana hay kana ↔ Kanji. `accepted_answers` PHẢI liệt kê mọi dạng hợp lý (Kanji, hiragana, katakana…); phần tử đầu là đáp án tham chiếu hiển thị khi người học sai; các phần tử không được trùng nhau sau chuẩn hóa.
- **Không có** viết tay, thứ tự nét, nhận dạng nét hay chấm tự do (FR-009).
- Mỗi (trình độ × `reading`/`writing`) PHẢI có ít nhất một bài `estMinutes: 5`.

### Duyệt bài luyện viết trước khi kích hoạt

- [ ] `accepted_answers` có đủ dạng hợp lý (Kanji, hiragana, cách ghi thông dụng khác); không đáp án nào khiến câu trả lời sai về nghĩa được chấp nhận.
- [ ] Đề bài chỉ có **một** đáp án đúng theo nghĩa (câu nhiều cách nói đã nêu ngữ cảnh/gợi ý).
- [ ] Phần tử đầu của `accepted_answers` là dạng chuẩn muốn hiển thị khi sai.
- [ ] Không có yêu cầu viết tay/thứ tự nét.

### Kiểm tra

```bash
cd backend
pnpm exec vitest run --project unit tests/unit/content-files.test.ts   # kiểm tra toàn bộ thư viện
pnpm seed                                                              # nạp vào CSDL (idempotent)
```

## Bổ sung nội dung N4 → N3 đầy đủ (spec 008)

Thư viện nội dung N4/N3 được bổ sung theo **đợt phát hành**: mỗi đợt là một nhóm đơn vị được duyệt và kích hoạt cùng lúc, dùng được độc lập. Hợp đồng chi tiết: [contracts/content-authoring.md](../specs/008-n4-n3-jlpt-content/contracts/content-authoring.md), [contracts/release-manifest.md](../specs/008-n4-n3-jlpt-content/contracts/release-manifest.md), [contracts/scope-catalog.md](../specs/008-n4-n3-jlpt-content/contracts/scope-catalog.md).

### Quy trình một đợt

1. **Soạn** nháp ở `content/drafts/<mã-đợt>/<trình-độ>-<loại>-<chủ-đề>-<NN>.json` (không đặt vào `units/` trước khi duyệt).
2. **Lint**: `pnpm content:lint --drafts` (từ `backend/`) cho tới khi sạch lỗi.
3. **Tự rà** theo checklist bên dưới.
4. **Duyệt** bởi người có chuyên môn tiếng Nhật được chỉ định ở `scope/REVIEW.md` (cổng G1). Đạt: `git mv` file sang `units/` và thêm dòng `{ "file", "reviewer", "reviewedOn", "checklist": true }` vào `releases/<mã-đợt>.json` **trong cùng commit**. Không đạt: file ở lại `drafts/` hoặc bị xóa. Tác nhân/LLM KHÔNG ĐƯỢC tự điền hồ sơ duyệt.
5. **Phát hành**: merge rồi `pnpm seed` ở môi trường đích (idempotent; chỉ chèn đơn vị mới, không đổi id, tiến độ hay lịch ôn). Người học thấy đơn vị mới sau tối đa 60 giây (bộ đệm nội dung), không cần phát hành client.

Seed **đóng kín**: file trong `units/` không thuộc manifest nào, hoặc manifest trỏ file không có, làm seed thất bại. Đợt `000-baseline` là hồ sơ lịch sử của 33 đơn vị có từ spec 001/003/007: được miễn hồ sơ duyệt và các quy tắc AU. Sự cố sau phát hành: đặt `status = inactive` qua Admin API (tiến độ người học còn nguyên); thiếu cách đọc của chữ Kanji → `amendments` ở đợt kế tiếp (chỉ thêm, không đổi id).

### Chuẩn soạn thảo (CS1–CS8)

- **CS1**: nháp ở `drafts/<mã-đợt>/`; tên file (không đuôi) là giá trị dùng trong `requires`.
- **CS2**: `tier = "core"`, `goalTags` PHẢI có `jlpt`, `difficulty` 1–5 (N4 chủ yếu 2–3, N3 chủ yếu 3–4), `estMinutes` 5 hoặc 10, `isTrial = false`, `sequence = chặng × 100 + vị trí (10, 20, …)` duy nhất trong (trình độ × loại) theo `scope/stage-plan.md`; `title.en` duy nhất trong (loại × trình độ) vì là khóa tự nhiên của seed.
- **CS3**: quỹ thời lượng `số bài tập × 30 giây ≤ estMinutes × 60`. Từ vựng 5 phút = 6 từ / 8–10 bài, 10 phút = 12 từ / 16–20 bài; ngữ pháp 5 phút = 2 mẫu / 6–8 bài, 10 phút = 4–5 mẫu / 12–16 bài; Kanji 5 phút = 3 chữ / ≈ 10 bài, 10 phút = 4–5 chữ / 13–16 bài; mỗi (loại × trình độ) của từ vựng/ngữ pháp/Kanji có ≥ 30% đơn vị 5 phút.
- **CS4**: mỗi chữ/từ/mẫu là mục chính của đúng **một** đơn vị trong toàn thư viện; xuất hiện làm ví dụ ở đơn vị khác thì được. Từ vựng: `japanese`, `reading` kana, `meaning` vi/en, ≥ 1 ví dụ. Ngữ pháp: `japanese` (mẫu), `meaning`, `explanation` vi/en (ý nghĩa, cách chia/kết hợp, sắc thái/khác biệt với mẫu gần nghĩa), `examples` ≥ 1, `scopeRef` = `id` dòng danh mục `g-…`.
- **CS5**: chỉ dùng `multiple_choice`, `fill_blank`, `matching`; dạng sắp xếp ★ biểu diễn bằng `multiple_choice`. Mỗi bài có `format` đúng nhóm của loại; mỗi mục từ vựng/ngữ pháp có ≥ 1 bài gắn `item` (ngữ pháp ≥ 2); chỉ MỘT đáp án đúng; `feedbackCorrect`/`feedbackIncorrect` vi + en, giải thích VÌ SAO (≥ 15 ký tự, không trùng nhau).
- **CS6**: mọi ví dụ có `reading` kana đầy đủ (kể cả khi dùng chữ Hán chưa học) và `translation` vi + en; mọi ký tự có glyph trong `NotoSansJP.ttf`.
- **CS7**: viết MỚI theo phạm vi danh mục; KHÔNG chép nguyên văn đoạn/câu/bài tập từ giáo trình hay trang web có bản quyền; nguồn tham khảo ghi ở manifest (mô tả phạm vi, không dán nội dung).
- **CS8**: chỉ người duyệt thật điền `reviewer`/`reviewedOn`/`checklist`; LLM chỉ soạn nháp và chạy lint.

### Dạng câu hỏi đề thi → `format` (siêu dữ liệu file, KHÔNG vào CSDL)

| Phần thi | Dạng đề | `format` | Loại bài tập |
|---|---|---|---|
| Chữ – từ vựng | 漢字読み | `kanji_reading` | `multiple_choice` / `fill_blank` |
| | 表記 | `orthography` | `multiple_choice` |
| | 文脈規定 | `context_fill` | `multiple_choice` / `fill_blank` |
| | 言い換え類義 | `synonym` | `multiple_choice` |
| | 用法 | `usage` | `multiple_choice` |
| Ngữ pháp | 文の文法1 | `form_fill` | `multiple_choice` / `fill_blank` |
| | chọn câu đúng | `sentence_correct` | `multiple_choice` |
| | 文の組み立て (ô ★) | `sentence_order_star` | `multiple_choice` (đề: `A ＿ ＿ ★ ＿ B`; thay cho kéo–thả) |
| | 文章の文法 | `text_grammar` | `multiple_choice` |
| | phân biệt mẫu gần nghĩa | `contrast` | `multiple_choice` |
| Đọc hiểu | 内容理解 (ngắn / vừa) | `comprehension_short` / `comprehension_mid` | `multiple_choice` |
| | 情報検索 | `info_search` | `multiple_choice` |

Nghe hiểu ngoài phạm vi (người học JLPT được thông báo ở ứng dụng).

### Quy tắc kiểm tra tự động AU1…AU18

Áp cho đơn vị **ngoài baseline**, ở `pnpm seed` và `pnpm content:lint` — KHÔNG chạy qua Admin API. "Lỗi" chặn seed; "cảnh báo" chỉ báo. Thông báo bắt đầu bằng mã (`AU4: …`).

| Mã | Quy tắc | Mức |
|---|---|---|
| AU1 | `reading` của ví dụ từ vựng/ngữ pháp chỉ gồm kana/dấu câu | lỗi |
| AU2 | Mục từ vựng có ≥ 1 ví dụ | lỗi |
| AU3 | Ví dụ chứa dạng nguyên của mục (từ vựng/ngữ pháp có biến cách) | cảnh báo |
| AU4 | Mỗi mục có ≥ 1 bài tập gắn mục (ngữ pháp ≥ 2) | lỗi / cảnh báo |
| AU5 | `format` đúng nhóm của loại | lỗi |
| AU6 | Phủ dạng đề: từ vựng ≥ 3 `format` (≥ 2 với bài 5 phút), bắt buộc `kanji_reading` khi có Kanji; ngữ pháp ≥ 1 `form_fill` + ≥ 1 `contrast`/`sentence_correct` | lỗi (từ vựng) / cảnh báo (ngữ pháp) |
| AU7 | Mục chính duy nhất: Kanji = ký tự; từ vựng = `japanese` + `reading`; ngữ pháp = `scopeRef` và `japanese` | lỗi |
| AU8 | `scopeRef` trỏ dòng danh mục tồn tại, cùng loại và trình độ; ngữ pháp mới bắt buộc có | lỗi |
| AU9 | `sequence` ≥ 100, dạng chặng×100+vị trí (10…90), duy nhất trong (trình độ × loại) gồm cả baseline | lỗi |
| AU10 | `requires[]`: đích tồn tại, trình độ ≤, `(trình độ, sequence)` nhỏ hơn, không chu trình; đơn vị mang thẻ `work`/`daily_conversation` không `requires` đơn vị cùng loại | lỗi |
| AU11 | `goalTags` có `jlpt`; `tier = core` | lỗi |
| AU12 | `name.en` chủ đề duy nhất trong (kỹ năng × trình độ) (lỗi); chủ đề ≥ 2 đơn vị và ≥ 20 bài tập | lỗi / cảnh báo (lỗi ở `--final`) |
| AU13 | ≥ 30% đơn vị 5 phút mỗi (loại × trình độ) | cảnh báo |
| AU14 | Mọi ký tự Nhật có glyph trong `NotoSansJP.ttf` | lỗi |
| AU15 | Chữ Hán trong đoạn đọc/mục viết thuộc `scope/n5-kanji.ref.json` ∪ danh mục Kanji ≤ trình độ bài, hoặc được chú giải ở `explanation` | lỗi |
| AU16 | Phản hồi giải thích: vi + en ≥ 15 ký tự, sai ≠ đúng; câu đọc hiểu trích dẫn 「…」 có trong đoạn | cảnh báo |
| AU17 | Không luyện viết tay/thứ tự nét | lỗi |
| AU18 | Mỗi trình độ ≥ 30 đơn vị `reading` (≥ 8 chủ đề, ≥ 4 dạng) và ≥ 20 `writing` | lỗi (chỉ `--final`) |

Máy KHÔNG kiểm được (người duyệt chịu trách nhiệm): cách đọc kana đúng, hai đáp án cùng đúng, bản dịch đúng nghĩa/tự nhiên, từ vựng và ngữ pháp trong đoạn đọc nằm trong phạm vi trình độ, ví dụ tự nhiên.

### Checklist duyệt mở rộng (mọi đơn vị mới)

- [ ] Cách đọc kana của **từng mục và từng câu ví dụ** đúng (trường âm, tiểu âm, rendaku).
- [ ] Không câu hỏi nào có **hai đáp án cùng đúng**; câu nhiều cách đọc/nghĩa đã nêu ngữ cảnh.
- [ ] Bản dịch vi và en đúng nghĩa, tự nhiên, nhất quán với tiêu đề/giải thích.
- [ ] Từ vựng/ngữ pháp **đúng trình độ** N4/N3 (hoặc thấp hơn); mục chưa đủ trình độ đã được chú giải.
- [ ] Đoạn đọc và mục viết: **mọi từ vựng và mẫu ngữ pháp** thuộc N4/N3 (hoặc thấp hơn) hoặc đã chú giải ở `explanation` (máy chỉ kiểm chữ Hán — AU15).
- [ ] Ví dụ tự nhiên; ngữ pháp có ví dụ nhắc đúng sắc thái (lịch sự/thân mật/văn viết).
- [ ] Dạng câu hỏi bám đề thi và đủ dạng theo loại; `format` khớp nội dung thật của câu.
- [ ] Phản hồi sai **giải thích lý do**, không chỉ nêu đáp án.
- [ ] `sequence`, `requires`, `topic`, `scopeRef` hợp lý; mục chưa là mục chính ở đơn vị khác.
- [ ] Đã thử làm hết đơn vị và thời gian xấp xỉ `estMinutes`.
- [ ] Nguồn tham khảo đã ghi ở manifest; KHÔNG chép nguyên văn từ giáo trình/web có bản quyền.

### Lệnh

```bash
cd backend
pnpm content:lint                      # kiểm tra toàn bộ thư viện (mọi đợt): lỗi => mã thoát 1
pnpm content:lint --drafts             # + kiểm bản nháp ở drafts/ và so trùng với units/
pnpm content:lint --final              # + quy tắc nghiệm thu (AU12 thành lỗi, AU18)
pnpm content:coverage                  # bảng độ phủ loại × trình độ + kiểm bất biến danh mục
pnpm content:coverage --final          # + ngưỡng FR-003 và 0 "chưa phủ" (SC-001, SC-002)
pnpm content:coverage --kind grammar --level N4 --list-uncovered   # việc còn lại của một ô
pnpm content:stats                     # số đơn vị/phút/mục/chủ đề theo loại × trình độ × thời lượng
```

`CONTENT_RELEASES=all|id1,id2` chọn đợt nạp (`pnpm seed`, kiểm thử); tham số `releases` của `loadContent`/`seedContent` thắng biến môi trường; vắng mặt = `all`. Vitest đặt `CONTENT_RELEASES=000-baseline` để các kiểm thử và golden hiện có giữ nguyên 33 đơn vị; kiểm thử về nội dung thật truyền `releases: 'all'` tường minh.
