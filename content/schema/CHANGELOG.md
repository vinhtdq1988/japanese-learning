# Nhật ký thay đổi JSON Schema nội dung

Mọi thay đổi JSON Schema trong thư mục này PHẢI tăng phiên bản trong `$id` và được ghi tại đây
(Hiến pháp: thay đổi hợp đồng/schema phải được ghi nhận). Thay đổi phá vỡ tương thích tăng phiên bản chính.

| Schema | Phiên bản | Ngày | Thay đổi |
|---|---|---|---|
| `unit.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: đơn vị học (gồm `tier`, `isTrial`), mục nội dung, bài tập `multiple_choice` / `matching` / `fill_blank`; lựa chọn và vế ghép nhận chuỗi dùng chung hoặc văn bản dịch vi + en. |
| `placement.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: bộ cố định 20 câu (8 N5, 6 N4, 6 N3), mỗi câu 4 lựa chọn. |
| `topics.schema.json` | 1.0.0 | 2026-11-04 | Phiên bản đầu: danh sách mảng nội dung có khóa ổn định, song ngữ vi/en. |
