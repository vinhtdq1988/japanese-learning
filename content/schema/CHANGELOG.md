# Nhật ký thay đổi JSON Schema nội dung

Mọi thay đổi JSON Schema trong thư mục này PHẢI tăng phiên bản trong `$id` và được ghi tại đây
(Hiến pháp: thay đổi hợp đồng/schema phải được ghi nhận). Thay đổi phá vỡ tương thích tăng phiên bản chính.

| Schema | Phiên bản | Ngày | Thay đổi |
|---|---|---|---|
| `unit.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: đơn vị học (gồm `tier`, `isTrial`), mục nội dung, bài tập `multiple_choice` / `matching` / `fill_blank`; lựa chọn và vế ghép nhận chuỗi dùng chung hoặc văn bản dịch vi + en. |
| `placement.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: bộ cố định 20 câu (8 N5, 6 N4, 6 N3), mỗi câu 4 lựa chọn. |
| `topics.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: danh sách mảng nội dung có khóa ổn định, song ngữ vi/en. |
| `unit.schema.json` | 1.1.0 | 2026-11-05 | Bài học Kanji (003): `kind` nhận `kanji`; mục thêm `topic`, `kanjiDetails` (`onReadings` katakana, `kunReadings` hiragana + `.`, `strokeCount` 1–30, `components`); ví dụ thêm `kanjiReading`; bài tập thêm `facet` (`item`/`meaning`/`reading`/`word`, mặc định `item`); với `kind=kanji`: `tier=core`, `goalTags` không rỗng, 3–5 mục có đủ `topic`/`kanjiDetails`/`examples`. Bổ sung, file đơn vị cũ vẫn hợp lệ. |
| `topics.schema.json` | 1.1.0 | 2026-11-05 | Bài học Kanji (003): `skill` nhận thêm `kanji`. |
| `placement.schema.json` | 1.0.0 | 2026-11-05 | Không đổi: `skill` vẫn chỉ `vocabulary`, `grammar` (placement không có Kanji). |
| `unit.schema.json` | 1.2.0 | 2026-11-14 | Luyện đọc/viết (spec 007-fix-comments): `kind` nhận thêm `reading`, `writing`. Đơn vị `reading` có đúng một mục là đoạn văn và 2–5 bài `multiple_choice`; đơn vị `writing` có 3–6 mục và mỗi mục một bài `fill_blank`; bài tập của hai loại này KHÔNG khai `item` (không tạo lịch ôn). Quy tắc nghiệp vụ PR1…PR9 do `validateUnit` kiểm tra. Không phá nội dung cũ: mọi file đơn vị 1.1.0 vẫn hợp lệ. |
| `topics.schema.json` | 1.2.0 | 2026-11-14 | Luyện đọc/viết (spec 007-fix-comments): `skill` nhận thêm `reading`, `writing`. Không phá nội dung cũ. |
| `unit.schema.json` | 1.3.0 | 2026-11-14 | Bổ sung nội dung N4 → N3 đầy đủ (spec 008): CHỈ thêm trường tùy chọn, mọi file 1.2.0 vẫn hợp lệ. Đơn vị thêm `requires` (mảng tên file đơn vị nền); mục thêm `scopeRef` (`id` dòng danh mục phạm vi); bài tập thêm `format` (enum `kanji_reading`, `orthography`, `context_fill`, `synonym`, `usage`, `form_fill`, `sentence_correct`, `sentence_order_star`, `text_grammar`, `contrast`, `comprehension_short`, `comprehension_mid`, `info_search`). Ba trường là siêu dữ liệu biên soạn: seed bỏ qua, KHÔNG vào CSDL. Quy tắc AU1…AU18 do `content-validation.ts` kiểm. |
| `scope.schema.json` | 1.0.0 | 2026-11-14 | Phiên bản đầu (spec 008): danh mục phạm vi JLPT `content/scope/{n4,n3}-{kanji,vocabulary,grammar,reading}.json` và `n5-kanji.ref.json` (tham chiếu, không tính độ phủ): `kind`, `level`, `reference`, `sources`, `rows[]` (`id`, `key`, `label`, `sources`, `exclude`, `minUnits`). Trạng thái phủ được suy ra, không lưu. |
| `release.schema.json` | 1.0.0 | 2026-11-14 | Phiên bản đầu (spec 008): đợt phát hành `content/releases/NNN-*.json` gồm `id`, `date`, `title`, `baseline`, `sources`, `units[]` (`file`, `reviewer`, `reviewedOn`, `checklist`), `amendments[]` (bổ sung chỉ-thêm cho Kanji), `notes`. Đợt `baseline: true` chỉ bắt buộc `file`. |

### Nới giới hạn đoạn đọc N3 (spec 008, FR-019) — 2026-11-14

Quy tắc PR3 (độ dài đoạn luyện đọc, `items[0].japanese`) đổi như sau; không phải thay đổi schema (do `validateUnit` kiểm), ghi lại để hợp đồng nội dung có nhật ký:

- **N4**: không đổi (20–400 ký tự); bài 5 phút luôn ≤ 200 ký tự.
- **N3 và `estMinutes` ≥ 10**: nới lên **20–700 ký tự**.
- Cho phép ký tự xuống dòng `\n` trong đoạn (bảng giá, lịch, danh sách); client PHẢI hiển thị xuống dòng trong `PassagePanel`.

Nới (không thu hẹp) nên mọi đoạn đã lưu (≤ 400 ký tự) vẫn hợp lệ.
