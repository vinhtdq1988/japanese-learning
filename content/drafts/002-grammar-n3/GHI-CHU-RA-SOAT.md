# Ghi chú rà soát đợt 002-grammar-n3 (28 đơn vị, 98 mẫu mới)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" vào `notes` của `content/releases/002-grammar-n3.json` khi duyệt (T071).

## Kết quả `pnpm content:lint --drafts`

0 lỗi. Cảnh báo còn lại chỉ thuộc **AU3** (cùng lý do như đợt 001: mẫu dạng nguyên thể có dấu 〜 còn ví dụ dùng dạng đã chia). Không còn cảnh báo AU12, AU13, AU16.

## Điểm cần người duyệt xem kỹ

- Nghĩa/sắc thái từng mẫu N3 (phân biệt おかげで/せいで, わけがない/はずがない/わけではない, かねない/かねる, 〜として/〜にとって/〜に対して…) và khả năng hai đáp án cùng đúng ở các câu `contrast`.
- **Phụ thuộc đợt**: `passive-causative-honorific-01` có `requires` tới `n3-grammar-passive-causative` (baseline) và `n4-grammar-honorific-basic-03` (đợt 001) — phải phát hành đợt 001 TRƯỚC đợt 002, hoặc bỏ `requires` này.
- Hai mẫu ở N3 dùng ví dụ có 「べき」/「とは限らない」 trước khi học đến mẫu đó; đã nằm trong danh mục N3 nên chấp nhận được, người duyệt cân nhắc đổi ví dụ nếu muốn tránh.
- `〜てさしあげる` có chú thích sắc thái (dễ nghe như ban ơn khi nói thẳng với người trên); cần người có chuyên môn xác nhận cách diễn đạt.
- Cách đọc kana, bản dịch vi/en và thời lượng thực tế khi làm thử (chưa đo).
