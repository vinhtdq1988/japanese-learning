# Hợp đồng: Danh mục phạm vi JLPT và báo cáo mức phủ

**Nhánh**: `008-n4-n3-jlpt-content` | **Đặc tả**: FR-001, FR-002, FR-003, SC-001, SC-002 | **Mô hình**: [data-model.md §2–§3](../data-model.md) | **Quyết định**: [research.md D2, D3, D4](../research.md)

Danh mục phạm vi là **tài liệu nghiệm thu dạng dữ liệu**, không phải dữ liệu runtime: không vào CSDL, không có API, không ảnh hưởng người học. Mục đích: liệt kê **cái gì cần phủ**, ghi **nguồn**, và cho phép tính **mức phủ** bằng một lệnh.

## 1. Tệp và schema

```text
content/scope/
├── n4-kanji.json        n3-kanji.json
├── n4-vocabulary.json   n3-vocabulary.json
├── n4-grammar.json      n3-grammar.json
├── n4-reading.json      n3-reading.json
├── n5-kanji.ref.json    # tham chiếu (không theo dõi độ phủ): chữ Hán N5 dùng kiểm đoạn đọc
├── REVIEW.md            # xác nhận văn bản của người có chuyên môn (SC-008)
└── (schema)  content/schema/scope.schema.json   # 1.0.0, ghi vào CHANGELOG.md
```

Mỗi file có dạng:

```jsonc
{
  "$schema": "../schema/scope.schema.json",
  "kind": "grammar",                    // kanji | vocabulary | grammar | reading
  "level": "N4",
  "reference": false,                   // true chỉ với *.ref.json (không tính độ phủ)
  "sources": {                          // mã nguồn dùng trong rows[].sources
    "s1": { "name": "Tên giáo trình / tài liệu", "note": "Phần tham khảo (phạm vi), không dán nội dung" },
    "s2": { "name": "…", "note": "…" }
  },
  "rows": [
    { "id": "g-n4-023", "key": "〜ために", "label": { "vi": "để (mục đích)", "en": "in order to" },
      "sources": ["s1", "s2"] },
    { "id": "g-n4-099", "key": "〜ものだ", "label": { "vi": "…", "en": "…" },
      "sources": ["s1"], "exclude": { "reason": "Thường xuất hiện ở N2; chỉ có 1 nguồn" } }
  ]
}
```

## 2. Quy tắc từng loại

| `kind` | `key` | `id` | Khớp với đơn vị bằng | Số đơn vị tối thiểu |
|---|---|---|---|---|
| `kanji` | ký tự Kanji (đúng 1 ký tự CJK) | `k-<lv>-<NNN>` | `items[].japanese` của đơn vị `kind=kanji` (khớp tự động) | 1 (và duy nhất) |
| `vocabulary` | `japanese|reading` (ví dụ `方|かた`) | `v-<lv>-<NNNN>` | `items[].japanese` + `items[].reading` của đơn vị `kind=vocabulary` | 1 (và duy nhất) |
| `grammar` | mẫu viết tự do (để người duyệt đọc) | `g-<lv>-<NNN>` | `items[].scopeRef = id` của đơn vị `kind=grammar` (bắt buộc với ngữ pháp mới) | 1 (và duy nhất) |
| `reading` | mã dạng/chủ đề | `r-<lv>-<dạng|chủ-đề>` | `items[].scopeRef = id` của mục đoạn văn trong đơn vị `kind=reading` | `minUnits` (mặc định 2) |

Quy ước chung:

- `id` **ổn định**: không đổi, không tái sử dụng (kể cả khi dòng bị loại trừ).
- **Đơn vị baseline**: ngữ pháp và đọc hiểu khớp qua `scopeRef` nên 4 đơn vị ngữ pháp và 4 đơn vị đọc hiểu N4/N3 của baseline được gắn `scopeRef` hồi tố (siêu dữ liệu chỉ ở file, không đổi CSDL, id hay tiến độ — tasks T271/T272). Nhờ vậy mẫu/dạng của baseline tính là `covered`; vì mục chính là duy nhất, đơn vị mới KHÔNG tạo lại các mẫu đó. Từ vựng và Kanji của baseline khớp tự động theo khóa tự nhiên.
- Dòng chỉ có **1 nguồn** nên được người duyệt xem xét (giữ hoặc `exclude`); mục tiêu mặc định mỗi dòng giữ lại có ≥ 2 nguồn.
- `exclude.reason` bắt buộc không rỗng (quá hiếm, cổ, thuộc N2, trùng nghĩa với dòng khác…). Dòng bị loại trừ **không** tính vào mẫu số của phần trăm phủ.
- Một ký tự/từ **không** được xuất hiện ở hai dòng cùng loại (khóa duy nhất theo `kind`, cả hai trình độ): chữ Hán có thêm cách đọc ở N3 vẫn là **một** dòng ở trình độ đầu tiên của nó (xem [research.md D6](../research.md)).
- **Nguồn**: chỉ ghi nguồn thuộc phạm vi, KHÔNG chép nghĩa/ví dụ. Mỗi nguồn phải được kiểm tra giấy phép trước khi dùng (xem [research.md C2](../research.md)).

## 3. Tính trạng thái phủ

```text
status(row):
  nếu row.exclude          → excluded
  nếu matches(row) ≥ min   → covered       (min = row.minUnits ?? 1)
  ngược lại                → uncovered
matches(row) = số đơn vị đã duyệt (content/units/, thuộc một manifest) chứa mục khớp (bảng §2)
```

Vi phạm (đều là lỗi, không phải cảnh báo): (1) `scopeRef` không tồn tại; (2) mục chính khớp một dòng nhưng nằm ở ≥ 2 đơn vị (trừ dòng `reading` có `minUnits > 1`); (3) hai dòng cùng khóa; (4) `exclude` thiếu `reason`; (5) dòng `kanji`/`vocabulary` có mục trong đơn vị nhưng **khác trình độ** với dòng danh mục (nội dung xếp sai trình độ).

## 4. Công cụ dòng lệnh

```bash
cd backend
pnpm content:coverage            # kiểm bất biến + in bảng loại × trình độ (mỗi PR)
pnpm content:coverage --final    # + ngưỡng FR-003 và 0 "chưa phủ" (nghiệm thu, SC-001/SC-002)
pnpm content:coverage --kind grammar --level N4 --list-uncovered   # danh sách việc còn lại của một ô
pnpm content:stats               # số đơn vị/phút/mục/chủ đề theo loại × trình độ × thời lượng (research D17)
```

Mã thoát: `0` đạt; `1` có vi phạm (hoặc chưa đạt ngưỡng ở `--final`). Đầu ra ví dụ:

```text
LOẠI         TRÌNH ĐỘ  TỔNG  PHỦ  LOẠI TRỪ  CHƯA PHỦ  %PHỦ   NGƯỠNG
grammar      N4         100    96        3        1    99,0%   ≥ 95% ✔
vocabulary   N3        2250  2010       40      200    91,0%   ≥ 90% ✔
kanji        N3         350   331        5       14    96,0%   ≥ 95% ✔
reading      N4          14    14        0        0   100,0%   —
```

## 5. Kiểm thử

- `content-scope.test.ts` (đơn vị): trạng thái phủ, khớp khóa tự nhiên, `minUnits`, các vi phạm §3, ngưỡng `--final`, trường hợp biên (mục chỉ làm ví dụ không tính là phủ; đơn vị `drafts/` không tính).
- `content-coverage.test.ts`: chạy trên `content/` thật (`releases: 'all'`) — mức bất biến luôn; ngưỡng `--final` chỉ khi đặt `COVERAGE_FINAL=1`.
