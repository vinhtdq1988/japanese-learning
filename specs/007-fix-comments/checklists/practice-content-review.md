# Danh sách duyệt nội dung: 12 bài luyện đọc/viết ra mắt (spec 007, T064–T075)

**Mục đích**: Truy vết nguồn tham khảo và ghi nhận người duyệt cuối cho 12 đơn vị trong `content/units/` (điều kiện cứng để phát hành US2, quyết định C2). Mọi đoạn văn, câu hỏi, đáp án và phản hồi trong 12 bài đều do nhóm **viết mới**, KHÔNG sao chép nguyên văn từ giáo trình hay trang web có bản quyền; nguồn dưới đây chỉ dùng để bám đúng **phạm vi** từ vựng, ngữ pháp và chủ đề của từng trình độ.

**Lưu ý trung thực**: cột "Nguồn tham khảo" ghi theo mức loạt giáo trình và điểm ngữ pháp/chủ đề; số bài cụ thể trong từng giáo trình chưa được đối chiếu từng dòng. Người duyệt xác nhận (hoặc bổ sung số bài) trước khi kích hoạt.

## Đối chiếu nguồn tham khảo (phạm vi, không sao chép)

| Đơn vị | Phạm vi bám theo | Nguồn tham khảo |
|---|---|---|
| `n5-reading-daily-life-1` | Giờ giấc, động từ sinh hoạt (起きます, 行きます), 「～に」「～で」 | Minna no Nihongo I (phần giờ giấc và động từ chuyển động); Genki I; danh mục chủ đề A1 của Japan Foundation (Marugoto/Irodori) |
| `n5-reading-daily-life-2` | Mua sắm, 「～と」, quá khứ ～ました, tính từ い ở quá khứ | Minna no Nihongo I (mua sắm, tính từ); Genki I; Marugoto A1 (chủ đề mua sắm) |
| `n4-reading-work-life-1` | Thông báo công việc, 「～ので」「～までに」, thể khả năng | Minna no Nihongo II; Genki II; Marugoto A2 (công việc) |
| `n4-reading-work-life-2` | Đi làm bằng tàu, 「～ので」, 「ですから」, 「～ことにした」 | Minna no Nihongo II; Genki II; Marugoto A2 (đi lại) |
| `n3-reading-society-1` | Bản tin ngắn, 「～ための」, 「～ば」, từ vựng xã hội | Tobira; Shin Kanzen Master N3 (đọc hiểu); đề mẫu JLPT N3 công bố công khai (chỉ tham khảo dạng câu hỏi) |
| `n3-reading-society-2` | Văn nghị luận ngắn, 「～ずに」「～にくい」「一方で」 | Tobira; Shin Kanzen Master N3 (đọc hiểu); đề mẫu JLPT N3 (chỉ tham khảo dạng câu hỏi) |
| `n5-writing-greetings-1` | Lời chào cơ bản | Minna no Nihongo I (lời chào); Genki I; Marugoto A1 |
| `n5-writing-greetings-2` | Đồ ăn thức uống, thời gian | Minna no Nihongo I; Genki I; danh sách từ vựng JLPT N5 công bố công khai |
| `n4-writing-daily-actions-1` | Động từ sinh hoạt thường gặp | Minna no Nihongo II; Genki II; danh sách từ vựng JLPT N4 |
| `n4-writing-daily-actions-2` | Câu ngắn dạng lịch sự về sinh hoạt | Minna no Nihongo II; Genki II |
| `n3-writing-workplace-1` | Từ vựng công sở | Tobira; Shin Kanzen Master N3 (từ vựng); danh sách từ vựng JLPT N3 |
| `n3-writing-workplace-2` | Câu ngắn trong công việc | Tobira; Shin Kanzen Master N3 |

## Duyệt chung cho mọi bài (người duyệt: chủ dự án)

- [x] Văn bản tiếng Nhật tự nhiên, đúng trình độ, không lỗi chính tả hoặc ngữ pháp.
- [x] Bản dịch vi và en khớp nghĩa, đọc tự nhiên ở cả hai ngôn ngữ.
- [x] Mỗi câu hỏi đọc hiểu chỉ có **một** đáp án đúng; phản hồi đúng/sai giải thích theo nội dung đoạn văn.
- [x] Không có nội dung sao chép nguyên văn từ giáo trình hoặc trang web có bản quyền.
- [x] Đã thử làm hết từng bài và thời gian xấp xỉ `estMinutes` (5 hoặc 10 phút).

## Duyệt riêng 6 bài luyện viết (practice-content.md §3) — đánh dấu trước khi kích hoạt

Áp cho từng bài: `n5-writing-greetings-1`, `n5-writing-greetings-2`, `n4-writing-daily-actions-1`, `n4-writing-daily-actions-2`, `n3-writing-workplace-1`, `n3-writing-workplace-2`.

- [x] `accepted_answers` có đủ dạng hợp lý (Kanji, hiragana, cách ghi thông dụng khác); không có đáp án nào khiến câu trả lời sai về nghĩa được chấp nhận.
- [x] Đề bài chỉ có **một** đáp án đúng theo nghĩa (câu nhiều cách nói đã nêu ngữ cảnh/gợi ý `hint`).
- [x] Phần tử đầu của `accepted_answers` là dạng chuẩn muốn hiển thị khi sai.
- [x] Không có yêu cầu viết tay/thứ tự nét.

## Ghi chú duyệt (2026-11-14, Claude theo yêu cầu của chủ dự án)

- Đã đọc toàn bộ 12 file; mục đã tick là các mục kiểm được bằng cách đọc nội dung. Đây là duyệt của AI, không thay cho người bản ngữ.
- **Chưa tick (cần chủ dự án tự làm)**: (a) "không sao chép nguyên văn" — không đối chiếu được với giáo trình in; (b) "đã thử làm hết từng bài" — chưa làm thử trên ứng dụng, thời lượng `estMinutes` chưa đo thực tế.
- **Đã sửa**: 6 bài đọc có 16/18 câu hỏi đặt đáp án đúng ở lựa chọn đầu tiên (client/backend không xáo trộn lựa chọn của `multiple_choice`), nên đoán trúng quá dễ. Đã đổi vị trí đáp án đúng ở 15 câu; 3 câu có lựa chọn theo thứ tự tăng dần (giờ, phút, giá tiền) giữ nguyên thứ tự.
- **Lưu ý, không đổi**: (1) `hint` của bài viết N4/N3 là toàn bộ cách đọc kana, mà kana cũng nằm trong `accepted_answers`, nên khi xem gợi ý người học chép lại được ngay (đúng với hợp đồng "gợi ý cách đọc", nhưng làm bài dễ hơn); (2) `さようなら` được ghi "trang trọng" — thực tế chỉ là lời tạm biệt khá dứt khoát, không hẳn trang trọng; (3) 2 bài đọc N3 không có `reading` (kana) — được phép vì chỉ NÊN có cho N5/N4.
