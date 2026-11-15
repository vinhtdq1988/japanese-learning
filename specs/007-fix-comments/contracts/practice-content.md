# Hợp đồng nội dung luyện đọc và luyện viết

**Nhánh**: `007-fix-comments` | **Đặc tả**: FR-005, FR-008, FR-009, FR-012 | **Nghiên cứu**: [research.md §P1, P4, P5](../research.md)

Nội dung là **dữ liệu** (Nguyên tắc VI): file JSON trong `content/units/*.json` kiểm tra bằng JSON Schema `unit` **1.2.0** và quy tắc ở `backend/src/domain/content-validation.ts`, nạp bằng `pnpm seed` và quản lý qua Admin API/giao diện admin hiện có. Cấu trúc đơn vị, mục, bài tập giữ nguyên ([content/README.md](../../../content/README.md)); tài liệu này chỉ nêu phần **riêng** của `reading` và `writing`.

## 1. Quy ước chung

- `kind`: `"reading"` hoặc `"writing"`; `tier: "core"`; `goalTags` không rỗng (ví dụ `["jlpt","daily_conversation","work"]`); trình độ N5–N3.
- `estMinutes` biên soạn là **5 hoặc 10** (hợp lệ chung vẫn 5/10/15) để mỗi phiên luôn nằm trong 5–15 phút (FR-005).
- Mỗi đơn vị thuộc một chủ đề (`topic`) có `skill` tương ứng; tên chủ đề song ngữ. Ví dụ khóa: `reading-n5-daily-life`, `writing-n5-greetings`. Chủ đề là mảng thống kê và màu năng lực của bài (không trùng khóa chủ đề từ vựng/Kanji).
- Mọi văn bản người học thấy có đủ vi + en; mọi ký tự Nhật phải có glyph trong `client/assets/fonts/NotoSansJP.ttf` (kiểm tra có sẵn).
- **Bài tập không gắn mục**: bỏ `item` trong định nghĩa bài tập (`itemId = null`, `facet = item`) → không tạo lịch ôn, không vào gói ôn. Chủ đề thống kê = chủ đề của đơn vị.
- **Không** có nội dung viết tay, thứ tự nét, nhận dạng nét, hay chấm tự do (FR-009).

## 2. Luyện đọc (`kind: "reading"`)

Cấu trúc:

| Thành phần | Quy tắc |
|---|---|
| `items` | Đúng **1** mục `kind: reading` |
| `items[0].japanese` | Đoạn văn tiếng Nhật, 20–400 ký tự (≤ 200 với `estMinutes = 5`) |
| `items[0].reading` | Bản kana đầy đủ của đoạn văn (tùy chọn nhưng NÊN có cho N5/N4) |
| `items[0].meaning` | Bản dịch vi + en (bắt buộc) |
| `items[0].explanation` | Ghi chú từ/ngữ pháp đáng chú ý, vi + en (tùy chọn) |
| `items[0].examples` | Có thể rỗng |
| `exercises` | 2–5 bài `multiple_choice`, **không** `item`; 3–4 lựa chọn; đúng một đáp án đúng |
| Phản hồi | `feedbackCorrect`, `feedbackIncorrect` bắt buộc, **giải thích vì sao** theo nội dung đoạn văn (FR-008), vi + en |
| Quỹ thời lượng | `số bài tập × 60 giây ≤ estMinutes × 60` (5 phút ≤ 5 câu; 10 phút ≤ 10 câu) |

Ví dụ rút gọn (`content/units/n5-reading-daily-life-1.json`):

```json
{
  "kind": "reading", "level": "N5", "tier": "core", "estMinutes": 5, "topic": "reading-n5-daily-life",
  "title": { "vi": "Đọc: Một ngày của Tanaka", "en": "Reading: Tanaka's day" },
  "goalTags": ["jlpt", "daily_conversation", "work"],
  "items": [{
    "japanese": "田中さんは毎朝七時に起きます。八時に会社へ行きます。",
    "reading": "たなかさんはまいあさしちじにおきます。はちじにかいしゃへいきます。",
    "meaning": { "vi": "Anh Tanaka mỗi sáng thức dậy lúc 7 giờ. Lúc 8 giờ anh đi đến công ty.", "en": "Mr. Tanaka gets up at seven every morning. He goes to the office at eight." }
  }],
  "exercises": [{
    "type": "multiple_choice",
    "prompt": { "vi": "Anh Tanaka đi làm lúc mấy giờ?", "en": "What time does Mr. Tanaka go to work?" },
    "payload": { "choices": ["7:00", "8:00", "9:00"], "correct_index": 1 },
    "feedbackCorrect": { "vi": "Đúng! Đoạn văn nói 八時に会社へ行きます.", "en": "Correct! The text says 八時に会社へ行きます." },
    "feedbackIncorrect": { "vi": "Chưa đúng. 7 giờ là lúc anh thức dậy; anh đi làm lúc 8 giờ (八時).", "en": "Not quite. Seven is when he wakes up; he goes to work at eight (八時)." }
  }]
}
```

Cách hiển thị (client, không đổi API): bước giới thiệu hiện đoạn văn + bản dịch; ở bước làm bài đoạn văn được **ghim** phía trên câu hỏi (thu gọn được).

## 3. Luyện viết (`kind: "writing"`)

Cấu trúc:

| Thành phần | Quy tắc |
|---|---|
| `items` | 3–6 mục `kind: writing` |
| `items[].japanese` | Từ, chữ Kanji hoặc câu ngắn (≤ 40 ký tự) cần gõ |
| `items[].reading` | Cách đọc bằng kana (bắt buộc – dùng làm gợi ý khi cần) |
| `items[].meaning` | Nghĩa vi + en (bắt buộc – dùng làm đề bài) |
| `exercises` | Mỗi mục **đúng 1** bài `fill_blank`, **không** khai `item` (xem quy ước §1); đề bài tự nêu nghĩa của mục cần gõ |
| `payload.accepted_answers` | **Mọi dạng chấp nhận**: bản có Kanji, bản hiragana (và katakana nếu hợp lý). Phần tử đầu là **đáp án tham chiếu** hiển thị khi sai |
| `payload.hint` | Gợi ý cách đọc/số ký tự (tùy chọn nhưng NÊN có với N4/N3) |
| Quỹ thời lượng | `số bài tập × 45 giây ≤ estMinutes × 60` (5 phút ≤ 6 câu; 10 phút ≤ 13 câu) |

Bộ chấm hiện có chỉ chuẩn hóa NFKC/khoảng trắng/chữ thường ([grading.ts](../../../backend/src/domain/grading.ts)) và **không** đổi qua lại hiragana↔katakana hay kana↔Kanji, vì vậy người biên soạn PHẢI liệt kê đủ dạng chấp nhận. Danh sách duyệt (đánh dấu trước khi kích hoạt):

- [ ] `accepted_answers` có đủ dạng hợp lý (Kanji, hiragana, và cách ghi thông dụng khác); không có đáp án nào khiến câu trả lời sai về nghĩa được chấp nhận.
- [ ] Đề bài chỉ có **một** đáp án đúng theo nghĩa (câu nhiều cách nói đã nêu ngữ cảnh/gợi ý).
- [ ] Phần tử đầu của `accepted_answers` là dạng chuẩn muốn hiển thị khi sai.
- [ ] Không có yêu cầu viết tay/thứ tự nét.

Ví dụ rút gọn (`content/units/n5-writing-greetings-1.json`):

```json
{
  "kind": "writing", "level": "N5", "tier": "core", "estMinutes": 5, "topic": "writing-n5-greetings",
  "title": { "vi": "Viết: Lời chào", "en": "Writing: Greetings" },
  "goalTags": ["jlpt", "daily_conversation", "work"],
  "items": [
    { "japanese": "おはようございます", "reading": "おはようございます", "meaning": { "vi": "Chào buổi sáng", "en": "Good morning" } }
  ],
  "exercises": [{
    "type": "fill_blank",
    "prompt": { "vi": "Gõ bằng tiếng Nhật: “Chào buổi sáng”", "en": "Type in Japanese: “Good morning”" },
    "payload": { "accepted_answers": ["おはようございます", "おはよう ございます"], "hint": "お… (9 ký tự kana)" },
    "feedbackCorrect": { "vi": "Chính xác!", "en": "Correct!" },
    "feedbackIncorrect": { "vi": "Đáp án tham chiếu: おはようございます.", "en": "Reference answer: おはようございます." }
  }]
}
```

## 4. Quy tắc kiểm tra (`validateUnit`)

Thêm vào `content-validation.ts` (khuôn `validateKanjiUnit`); mỗi lỗi có `path` + thông điệp tiếng Việt:

| Mã quy tắc | Nội dung |
|---|---|
| PR1 | `kind ∈ {reading, writing}` ⇒ `tier = core`, `goalTags` không rỗng, `estMinutes ∈ {5, 10, 15}` |
| PR2 | `reading`: đúng 1 mục active kind `reading`; `japanese` 20–400 ký tự (≤ 200 nếu 5 phút); có bản dịch vi+en |
| PR3 | `reading`: 2–5 bài active, mọi bài `multiple_choice`, 3–4 lựa chọn, `correct_index` hợp lệ, **không** `item_id` |
| PR4 | `writing`: 3–6 mục active kind `writing` có `reading` kana và `meaning` vi+en; số bài `fill_blank` = số mục; không `item_id` |
| PR5 | `writing`: `accepted_answers` không rỗng, mỗi phần tử không rỗng sau chuẩn hóa, không trùng nhau sau chuẩn hóa |
| PR6 | Quỹ thời lượng: reading `n × 60 ≤ est × 60`; writing `n × 45 ≤ est × 60` |
| PR7 | Phản hồi đúng/sai bắt buộc, vi+en, không rỗng |
| PR8 | Mọi ký tự Nhật có glyph trong phông đóng gói |
| PR9 | Không có `kanjiDetails` ở mục luyện; mục luyện không thuộc chủ đề Kanji |

Danh mục (`validateCatalog`): mỗi (trình độ N5/N4/N3 × `reading`/`writing`) có ≥ 1 đơn vị `active` 5 phút (tự áp khi `SKILLS` mở rộng). **Cam kết ra mắt** (research C2): 2 bài đọc + 2 bài viết cho mỗi trình độ = 12 đơn vị, do chủ dự án xác nhận người biên soạn/duyệt.

## 5. Nhập nội dung (Admin)

Luồng quản trị hiện có (`/admin/units`, giao diện admin) chấp nhận `kind = reading | writing`; trình soạn thảo đơn vị (admin) thêm hai lựa chọn kind và hiển thị trường đoạn văn/mục viết theo kind. Quy tắc §4 cũng áp khi kích hoạt qua Admin API (cùng hàm kiểm tra với seed). Không thay đổi quyền của vai trò nào.
