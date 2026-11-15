# Hợp đồng: Đợt phát hành nội dung và hồ sơ duyệt

**Nhánh**: `008-n4-n3-jlpt-content` | **Đặc tả**: FR-016, FR-017, FR-018, SC-004, SC-007 | **Mô hình**: [data-model.md §4](../data-model.md) | **Quyết định**: [research.md D5, D6, D7](../research.md)

Một **đợt** là nhóm đơn vị được duyệt và kích hoạt cùng lúc, mỗi đợt dùng được độc lập (FR-018). Hồ sơ duyệt nằm trong git, cùng commit với file nội dung.

## 1. Quy ước thư mục

```text
content/
├── units/                  # CHỈ đơn vị ĐÃ DUYỆT (thuộc đúng một manifest). Đóng kín: file mồ côi ⇒ lỗi
├── drafts/<mã-đợt>/        # bản nháp chờ duyệt (KHÔNG nạp, KHÔNG hiển thị cho người học)
└── releases/
    ├── 000-baseline.json   # 33 đơn vị đã có từ spec 001/003/007 (baseline: true)
    ├── 001-….json
    └── …                   # schema: content/schema/release.schema.json (1.0.0)
```

Vòng đời một đơn vị mới:

1. **Soạn** trong `drafts/<mã-đợt>/` (có thể nhiều người, nhiều nhánh git).
2. **Lint** bản nháp: `pnpm content:lint --drafts` (schema, quy tắc [content-authoring.md](content-authoring.md) §4, glyph, trùng lặp so với `units/`).
3. **Tự rà** theo checklist từng loại (`content/README.md`).
4. **Duyệt** bởi người có chuyên môn tiếng Nhật: nếu đạt, `git mv drafts/<đợt>/<file> units/<file>` và thêm dòng vào `releases/<đợt>.json` **trong cùng commit**; nếu không đạt, file ở lại `drafts/` (hoặc bị xóa) — **không** vào `units/`.
5. **Phát hành**: merge → chạy `pnpm seed` ở môi trường đích; `ContentCache` (TTL 60 giây) làm người học thấy đơn vị mới mà không cần phát hành client.

## 2. Cấu trúc manifest

```jsonc
{
  "$schema": "../schema/release.schema.json",
  "id": "001-grammar-n4",
  "date": "2026-12-05",
  "title": { "vi": "Ngữ pháp N4 (đợt 1)", "en": "N4 grammar (batch 1)" },
  "baseline": false,                         // true chỉ ở 000-baseline
  "sources": [
    { "name": "Tên nguồn tham khảo", "note": "Chỉ tham khảo phạm vi trình độ và danh sách mẫu; nội dung viết mới" }
  ],
  "units": [
    { "file": "n4-grammar-conditionals-01.json",
      "reviewer": "Tên người duyệt", "reviewedOn": "2026-12-04", "checklist": true }
  ],
  "amendments": [                            // tùy chọn — chỉ Kanji, chỉ thêm (xem §4)
    { "unit": { "kind": "kanji", "level": "N4", "titleEn": "People and body" }, "item": "生",
      "add": { "onReadings": ["ショウ"], "kunReadings": ["い.きる"], "examples": [ … ], "exercises": [ … ] } }
  ],
  "notes": "Đợt đầu của Câu chuyện 1."
}
```

## 3. Quy tắc kiểm tra (bắt buộc, tự động)

| # | Quy tắc | Khi vi phạm |
|---|---|---|
| M1 | Mỗi file `content/units/*.json` thuộc **đúng một** `units[].file` của một manifest | Validate nội dung thất bại; seed không chạy (đóng kín) |
| M2 | Mỗi `units[].file` tồn tại trong `content/units/` | Lỗi |
| M3 | Với đợt không phải baseline: `reviewer` và `reviewedOn` không rỗng; `reviewedOn` ≤ `date`; `checklist = true` (baseline được miễn — hồ sơ lịch sử của spec 001/003/007) | Lỗi (SC-004) |
| M4 | `id` manifest duy nhất, dạng `NNN-slug`; `date` hợp lệ; `sources` không rỗng với đợt không phải baseline | Lỗi |
| M5 | `000-baseline` có `baseline: true` và liệt kê đúng 33 file hiện có; mọi manifest khác **không** có `baseline: true` | Lỗi |
| M6 | `amendments`: đơn vị đích tồn tại (đã duyệt, `kind = kanji`); chữ tồn tại; `add` không rỗng; đơn vị sau gộp đạt quy tắc Kanji | Lỗi |
| M7 | File ở `drafts/` không bao giờ bị nạp: kiểm bằng test nạp thư mục tạm có `drafts/` rồi seed ⇒ 0 đơn vị từ nháp | Lỗi |

## 4. Bổ sung cho mục hiện có (`amendments`)

- Phạm vi: **chỉ Kanji**; chỉ thêm `onReadings`, `kunReadings`, `examples`, `exercises` (facet `reading`/`word`). Không xóa, không đổi giá trị đang có.
- Khóa so khớp (idempotent): âm = chuỗi; ví dụ = `ja`; bài tập = `(item, facet, prompt.en)`. Phần đã có ⇒ bỏ qua (chạy lại không đổi gì).
- Id mục, id bài tập, `review_schedules`, `unit_progress`, `study_records` của người học **không đổi** (FR-018, I2).
- Nếu bài tập thêm làm số bài vượt quỹ `estMinutes × 60 / 30`, người soạn PHẢI nêu ở `notes` phương án (đổi `estMinutes` của đơn vị qua Admin API trước/cùng lúc) — manifest không tự đổi `estMinutes`.

## 5. Seed theo đợt

`loadContent(dir, { releases })` đọc manifest và chỉ nạp đơn vị của các đợt được chọn:

```text
releases = 'all'                  → mọi manifest trong content/releases/ (mặc định production)
releases = ['000-baseline']       → chỉ baseline (mặc định của vitest, research D7)
env CONTENT_RELEASES=all|id1,id2  → cùng ý nghĩa; tham số tường minh thắng biến môi trường
```

Seed vẫn **chỉ chèn** (khóa tự nhiên `(kind, level, title.en)`); đơn vị đã có thì bỏ qua; amendments áp sau khi chèn. Cải tiến hiệu năng (research D15): đọc một lần toàn bộ khóa đơn vị đã có; ghi mục/bài tập theo lô.

## 6. Xử lý sự cố nội dung sau phát hành

| Tình huống | Cách xử lý | Dữ liệu người học |
|---|---|---|
| Đơn vị có lỗi nghiêm trọng (đáp án sai…) | Admin API: `status = inactive` → biến mất khỏi kế hoạch/lộ trình trong ≤ 60 giây | Giữ nguyên tiến độ và lịch ôn |
| Cần thay bản đúng | File mới (**tiêu đề khác** ⇒ danh tính khác) qua đợt tiếp theo; cân nhắc `requires`/`sequence` giống bản cũ | Bản cũ `inactive` còn tiến độ; bản mới là đơn vị mới |
| Thiếu cách đọc/ví dụ của chữ Kanji | `amendments` ở đợt tiếp theo | Không đổi |
| Sai nhỏ không ảnh hưởng đáp án | Sửa qua Admin API (có nhật ký) và đồng bộ lại file trong PR kế tiếp | Không đổi |
