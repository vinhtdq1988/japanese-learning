# Định dạng CSV: nhập danh sách học viên và xuất báo cáo lớp

**Nhánh**: `004-org-classes` | **Hợp đồng**: [api-changes.md](api-changes.md) §8.1, §10 | **Nghiên cứu**: [research.md §O5](../research.md)

## 1. Nhập danh sách học viên (`POST /classes/{id}/invitations/import`)

**Gửi**: thân yêu cầu là nội dung file CSV, `Content-Type: text/csv; charset=utf-8` (client đọc file và gửi nguyên văn; không dùng multipart). Giới hạn `CSV_IMPORT_MAX_BYTES` (mặc định 256 KB) và `CSV_IMPORT_MAX_ROWS` (mặc định 200 dòng dữ liệu, không tính tiêu đề). Quá giới hạn hoặc không có cột `email` ⇒ **422 toàn file**, không tạo lời mời nào.

**Phân tích** (`domain/csv.ts`, RFC 4180 tối thiểu):

- Chấp nhận BOM UTF-8; xuống dòng CRLF hoặc LF; trường bọc dấu nháy kép, `""` là một dấu nháy; dòng trống bị bỏ qua và **không** tính là dòng dữ liệu.
- Phân tách `,` (mặc định) hoặc `;` (tự nhận từ dòng tiêu đề, vì Excel khu vực dùng `;`).
- Dòng tiêu đề bắt buộc; tên cột chuẩn hóa bằng cách hạ chữ thường, bỏ khoảng trắng đầu/cuối, thay khoảng trắng/`-` bằng `_`. Cột nhận biết: `email` (bắt buộc), `display_name` (tùy chọn; chấp nhận bí danh `name`, `ten`, `ten_hien_thi`). Cột lạ bị bỏ qua.
- `email` được cắt khoảng trắng, hạ chữ thường; `display_name` cắt khoảng trắng, tối đa 80 ký tự (dài hơn ⇒ cắt bớt, không lỗi). Ký tự điều khiển (trừ tab/CR/LF trong trường bọc nháy) ⇒ dòng đó `invalid_email`/bị loại, không làm hỏng cả file.

**Kết quả từng dòng** — mỗi dòng dữ liệu nhận **đúng một** `outcome` (tổng số kết quả = số dòng dữ liệu; không dòng nào bị bỏ qua âm thầm, FR-013). Thứ tự ưu tiên khi nhiều điều kiện cùng đúng:

| Ưu tiên | `outcome` | Điều kiện |
|---|---|---|
| 1 | `invalid_email` | email rỗng hoặc sai định dạng (RFC rút gọn: một `@`, miền có dấu `.`, ≤ 254 ký tự) |
| 2 | `duplicate_in_file` | email đã xuất hiện ở dòng trước trong cùng file (dòng đầu tiên được xử lý bình thường) |
| 3 | `already_in_class` | tài khoản có email này đã là học viên đang hoạt động của **chính lớp này** |
| 4 | `already_in_other_class` | đã là học viên đang hoạt động của lớp **khác trong cùng tổ chức** |
| 5 | `unavailable` | email thuộc tài khoản của **tổ chức khác** (thông báo chung, không nêu tên tổ chức — FR-002), hoặc là giáo viên phụ trách chính lớp này |
| 6 | `already_invited` | đã có lời mời `pending` chưa hết hạn cho email này trong tổ chức |
| 7 | `no_seat` | không còn seat trống sau khi trừ lời mời đang chờ **và các dòng `invited` trước đó trong file** |
| 8 | `invited` | tạo lời mời, giữ chỗ một seat, gửi email |

Các dòng xử lý tuần tự trong **một giao dịch có khóa tổ chức** nên sức chứa không bị vượt kể cả khi có nhập đồng thời; hết seat ở dòng k ⇒ mọi dòng hợp lệ sau đó nhận `no_seat`. Phản hồi:

```json
{
  "summary": { "total": 4, "invited": 2, "invalid_email": 1, "no_seat": 1 },
  "results": [
    { "row": 1, "email": "an@example.com", "outcome": "invited" },
    { "row": 2, "email": "khong-hop-le", "outcome": "invalid_email" },
    { "row": 3, "email": "binh@example.com", "outcome": "invited" },
    { "row": 4, "email": "chi@example.com", "outcome": "no_seat" }
  ]
}
```

(`row` là số thứ tự dòng dữ liệu bắt đầu từ 1, **không** tính tiêu đề.)

**Ví dụ file hợp lệ** (UTF-8, có tiêu đề):

```csv
email,display_name
an@example.com,Nguyễn Văn An
binh@example.com,"Trần, Thị Bình"
sato@example.jp,佐藤 花子
```

## 2. Xuất báo cáo lớp (`GET /classes/{id}/export.csv`)

**Mã hóa & kiểu**: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename*=UTF-8''…`. Nội dung bắt đầu bằng **BOM UTF-8** (`EF BB BF`) để Excel/Google Sheets hiển thị đúng tiếng Việt và tiếng Nhật; xuống dòng CRLF; phân tách `,`; ô có `,` `"` hoặc xuống dòng được bọc nháy kép.

**Cột** (mỗi học viên đang hoạt động một dòng; giá trị bằng đúng `ClassLearnerRow` của bảng điều khiển — SC-009):

| Cột | Nguồn | Ghi chú |
|---|---|---|
| `display_name` | tên hiển thị | chuỗi |
| `email` | email | chuỗi |
| `joined_on` | `joinedAt` theo múi giờ học viên | `YYYY-MM-DD` |
| `status` | `progressStatus` | `on_track\|behind\|ahead\|paused`, hoặc `not_started` khi `hasStarted=false` |
| `alerts` | `alerts` | các mã nối bằng `\|` (ví dụ `absent\|overdue_assignment`) |
| `completion_percent` | `completionRatio × 100` | số, 1 chữ số thập phân; rỗng khi không có đơn vị bắt buộc |
| `expected_percent` | `expectedRatio × 100` | số |
| `streak_days` | | số nguyên |
| `minutes_last_7_days` | | số, 1 chữ số thập phân |
| `minutes_total` | từ khi vào lớp | số, 1 chữ số thập phân |
| `review_accuracy_percent` | | số; rỗng khi chưa ôn |
| `last_active_on` | | `YYYY-MM-DD`; rỗng khi chưa học |
| `absent_days` | | số nguyên |

Dòng đầu là tiêu đề tiếng Anh cố định (tên cột ổn định để bảng tính/script dùng lại); tên tệp gợi ý `class-<tên-lớp-đã-làm-sạch>-<YYYY-MM-DD>.csv`.

### Chi tiết một học viên (`GET /classes/{id}/members/{userId}/export.csv`)

Dạng "dài" một bảng để giữ CSV phẳng: cột `section,label,value,extra`.

| `section` | `label` | `value` | `extra` |
|---|---|---|---|
| `summary` | `completion_percent` / `streak_days` / `minutes_total` / `review_accuracy_percent` | số | |
| `unit` | tên đơn vị | `pending\|in_progress\|completed\|mastered\|exempt` | kỹ năng/trình độ |
| `assignment` | tên đơn vị | `pending\|on_time\|late\|overdue` | hạn `YYYY-MM-DD` |
| `daily_minutes` | ngày `YYYY-MM-DD` (30 ngày gần nhất) | số phút | |
| `weak_topic` | tên chủ đề | độ chính xác (%) | số câu |
| `placement` | `estimated_level` | `none\|N5\|N4\|N3` | điểm/tổng |

## 3. Vô hiệu hóa công thức (CSV injection) — bắt buộc cho **mọi** ô chuỗi

Hàm `csvCell(value)` (có kiểm thử):

1. Nếu `value` là **số** ⇒ ghi số thuần (không tiền tố), kể cả số âm.
2. Nếu `value` là chuỗi và ký tự đầu thuộc `= + - @` **hoặc** `\t` **hoặc** `\r` ⇒ thêm tiền tố nháy đơn `'` *trước khi* bọc nháy kép (ví dụ tên hiển thị `=HYPERLINK("http://x")` ⇒ `'=HYPERLINK(...)`). Áp cả khi ký tự nguy hiểm đứng sau khoảng trắng đầu (cắt khoảng trắng trước khi kiểm).
3. Sau đó áp quy tắc bọc nháy kép của RFC 4180.

Kiểm thử (SC-009): bộ giá trị tấn công `=cmd|' /C calc'!A0`, `+1+1`, `-2+3`, `@SUM(A1)`, `\t=1+1`, `\r=1+1`, `  =1+1`, `"=1+1"`, tên tiếng Việt/Nhật có dấu; mở file bằng trình đọc bảng tính tham chiếu/phân tích lại ⇒ **không ô nào bắt đầu bằng ký tự công thức** và nội dung hiển thị còn nguyên (kèm nháy đơn đứng đầu).

## 4. Nhật ký

Mỗi lần xuất ghi `admin_action_logs` (`action='class.export'`, `target_type='class'`, `target_id=classId`, `diff={type:'class'|'learner', userId?}`, `actor_id`, `organization_id`, `occurred_at`) — FR-008, US7.6.
