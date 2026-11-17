# Ghi chú rà soát đợt 014-final (39 đơn vị từ vựng bù phần chưa phủ)

> Bản nháp do tác nhân (LLM) soạn. File này KHÔNG phải hồ sơ duyệt; hồ sơ duyệt G1 nằm ở `content/releases/014-final.json`.

## Phạm vi

- Mục đích: đưa độ phủ từ vựng lên 100% (SC-001) bằng cách soạn đúng các dòng danh mục `content:coverage --list-uncovered` còn thiếu sau các đợt 004, 005, 008–011: **36 dòng N4** và **201 dòng N3** (tổng 237 từ).
- 39 đơn vị: N4 6 đơn vị (36 từ), N3 33 đơn vị (30 đơn vị × 6 từ + 3 đơn vị × 7 từ = 201 từ). Tất cả là đơn vị 5 phút, `difficulty` 2–3 (N4) hoặc 4 (N3), `goalTags` luôn có `jlpt`.
- Mỗi đơn vị thuộc một chủ đề từ vựng đã có (thêm đơn vị vào chủ đề, không tạo chủ đề mới); từ xếp theo thứ tự danh mục phạm vi nên cùng nhóm nghĩa. `sequence` cấp tự động ở các vị trí còn trống trong chặng 4–23 (N4) và 4–33 (N3), rải đều.
- Mỗi từ có đúng 1 câu ví dụ dùng ĐÚNG dạng từ điển của từ đó (AU3 sạch), `reading` kana đầy đủ.

## Cách sinh bài tập

Trình dựng dùng lại khuôn của các đợt từ vựng trước: mỗi từ một bài `context_fill` (điền từ vào chỗ trống, kèm nghĩa câu để chỉ có một đáp án hợp lý), tối đa 2 bài `kanji_reading` và 1 bài `orthography` cho các từ chứa chữ Hán có cách đọc duy nhất trong đơn vị. 8–10 bài mỗi đơn vị (≤ 10 theo quỹ 30 giây × số bài ≤ 5 phút), có ít nhất 2 `format` (AU6). Đáp án sai lấy từ các từ khác trong cùng đơn vị (ba đơn vị có danh sách đáp án nhiễu chọn tay: liên từ N4 `n4-vocabulary-adverbs-expressions-04`, từ nối N3 `n3-vocabulary-discourse-05` và `n3-vocabulary-adjectives-evaluation-08`).

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Cách đọc kana của 237 câu ví dụ**: đã đối chiếu máy với pykakasi; mọi khác biệt (41 câu) là do pykakasi đọc sai (ví dụ 間 → かん, 人 → にん, 今日 → こんにち, 十八歳 → ろくさい), cách đọc ghi ở file là cách đọc đúng của câu. Nên bấm lại các số/ngày/từ ghép: 十八歳 (じゅうはっさい), 七十歳 (ななじゅっさい), 五分 (ごふん), 十一時 (じゅういちじ), 二十パーセント (にじゅうパーセント).
- **Từ đồng âm cùng đơn vị**: 荒い (波が荒い) và 粗い (目が粗い) cùng đọc あらい ở `n3-vocabulary-adjectives-evaluation-08` — đáp án nhiễu của hai bài này đã chọn tay để không lẫn nhau; 起源 (きげん, ở đơn vị quốc tế) và 紀元 (きげん, ở đơn vị lịch sử) nằm ở hai đơn vị khác nhau. Hai từ 現す (あらわす) và 成る (なる) là cách dùng văn viết; 欠く/課す/担う cũng là động từ trang trọng.
- **Từ nhiều nghĩa chỉ nêu nghĩa thông dụng**: 円 (hình tròn; yên), 渋い (chát; trầm), 極 (ごく), ぺこぺこ (đói meo; cúi lia lịa), 紀元 (câu ví dụ dùng 紀元前), フォーム (biểu mẫu; dáng điệu). Người duyệt cân nhắc có cần tách thành mục riêng không.
- **Ngữ cảnh lệch nhẹ**: đơn vị gom từ theo thứ tự danh mục nên đôi khi trộn hai nhóm nghĩa (ví dụ `n3-vocabulary-quantity-degree-06`: phản ánh/đồng bộ/vật lý/toàn quốc); tiêu đề đơn vị nêu cả hai nhóm.
- **Sắc thái**: các từ văn viết/trang trọng (甚だ, 誠に, 強いて, 並びに, 要は, 遂げる) có câu ví dụ ngắn; cần xem có tự nhiên không.
- **Thời lượng**: 8–10 bài × 30 giây ≤ 5 phút; chưa ai làm thử đo thời gian thật.
- Mọi ký tự có glyph trong `NotoSansJP.ttf` theo AU14 (lint sạch); chưa kiểm thị giác trên trình duyệt.
