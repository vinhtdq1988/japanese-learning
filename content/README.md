# Nội dung học (`content/`)

Nội dung gốc của ứng dụng là **dữ liệu**, không phải mã (Nguyên tắc VI): mỗi file JSON trong thư mục này được kiểm tra bằng JSON Schema (`schema/`) và quy tắc nội dung (`backend/src/domain/content-validation.ts`), rồi nạp vào CSDL bằng `pnpm seed` (trong `backend/`). Thay đổi cấu trúc file PHẢI ghi vào `schema/CHANGELOG.md`.

| Đường dẫn | Nội dung |
|---|---|
| `topics.json` | Mảng (chủ đề) nội dung: khóa ổn định, kỹ năng, trình độ, tên vi/en |
| `units/*.json` | Mỗi file một đơn vị học (từ vựng, ngữ pháp hoặc Kanji) kèm mục nội dung và bài tập |
| `placement/placement-v1.json` | Bộ 20 câu kiểm tra trình độ (không có Kanji) |
| `schema/` | JSON Schema: `unit` 1.1.0, `topics` 1.1.0, `placement` 1.0.0 |

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

### Kiểm tra

```bash
cd backend
pnpm exec vitest run --project unit tests/unit/content-files.test.ts   # kiểm tra toàn bộ thư viện
pnpm seed                                                              # nạp vào CSDL (idempotent)
```
