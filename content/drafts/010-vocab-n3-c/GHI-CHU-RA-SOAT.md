# Ghi chú rà soát đợt 010-vocab-n3-c (50 đơn vị, 510 từ mới)

> Bản nháp do tác nhân (LLM) soạn; hồ sơ duyệt G1 ghi theo chỉ định trực tiếp của người duyệt tdq_vinh trong phiên 2026-11-15 ("Duyệt cho cả các đợt N3 sau này"). File này KHÔNG phải hồ sơ duyệt.

## Kết quả `pnpm content:lint --drafts`

0 lỗi. Không có cảnh báo AU3/AU12/AU16 ở đợt này. Cảnh báo AU13 (tỷ lệ đơn vị 5 phút của cả từ vựng N3) chỉ đạt ≥ 30% khi đủ bốn đợt 008–011; đợt này có 15/50 đơn vị 5 phút.

## Quy mô

- 50 đơn vị, 510 từ mới; phủ 510/548 dòng danh mục thuộc các nhóm chủ đề của đợt (93.1%, đã tính từ baseline).
- Bài tập sinh có kiểm soát từ dữ liệu soạn: mỗi từ có 1 bài `context_fill` (4 lựa chọn, đề kèm bản dịch câu để chỉ một đáp án hợp), cộng bài `kanji_reading` và `orthography` (và `usage` cho đơn vị toàn katakana), trong quỹ thời lượng.

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Hai đáp án cùng đúng ở câu `context_fill`** với các nhóm từ gần nghĩa (ví dụ 不況/不景気, 輸送/運送, 許可/承認, 上昇/下落, 設立/創業). Đã chọn câu mẫu khác nhau và thêm bản dịch vào đề, nhưng cần soát lại.
- **Cách đọc kana** của toàn bộ từ và câu ví dụ (số đếm, rendaku, trường âm) và bản dịch vi/en.
- **Từ gắn với trình độ**: danh mục là dự thảo đã duyệt G0, việc gán trình độ từng dòng là ước tính.
- **Thời lượng**: số bài tập ≤ `estMinutes × 2`; chưa ai làm thử đủ từng đơn vị đo thời gian thật.

## Từ trong dải danh mục chưa có đơn vị (38 từ — để đợt 014 hoặc chủ đề tương ứng bù)

疲れ, 容態, 健やか, 保健所, 診療所, 往診, 治癒, 処置, 汗ばむ, 愛, 好み, 妬む, 憤る, 嘆く, 悲観, 人間関係, 親切心, 来客, 家系, 照明, 明かり, 塵, 灰, 栓, 磨き, 衣服, 渋い, 塩辛い, 保存食, 勝敗, 乗馬, 賭け, 見当, 悟る, 思い切って, 計る, 推理, 概念
