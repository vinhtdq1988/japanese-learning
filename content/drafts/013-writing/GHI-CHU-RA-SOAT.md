# Ghi chú rà soát đợt 013-writing (40 đơn vị luyện viết N4 + N3)

> Bản nháp do tác nhân (LLM) soạn. File này KHÔNG phải hồ sơ duyệt; hồ sơ duyệt G1 chỉ được ghi ở `content/releases/013-writing.json` bởi người duyệt (hoặc theo chỉ định trực tiếp của người duyệt trong phiên làm việc).

## Kết quả `content:lint --drafts`

0 lỗi và 0 cảnh báo cho 40 đơn vị (AU3, AU12, AU13, AU15, AU16, AU17 đều sạch). Máy soạn không có `pnpm`; lệnh tương đương `node_modules/.bin/tsx src/seed/lint.ts --drafts` từ `backend/`.

## Quy mô

- N4: 20 đơn vị (10 bài 5 phút × 5 mục, 10 bài 10 phút × 6 mục), 110 mục, 5 chủ đề `writing-n4-*`.
- N3: 20 đơn vị (10 bài 5 phút × 5 mục, 10 bài 10 phút × 6 mục), 110 mục, 5 chủ đề `writing-n3-*`.
- Tổng 220 bài `fill_blank`, 423 đáp án chấp nhận (197 bài có hai dạng trở lên: Kanji + hiragana, thêm biến thể khi có; 23 bài chỉ một dạng vì từ viết sẵn bằng kana/katakana).
- `sequence` theo `content/scope/stage-plan.md` (bảng "luyện viết"); không có `requires`; `goalTags` luôn có `jlpt`.

## Cách soạn

- **Chủ đề 1–9 (từ đơn)**: mỗi mục là một từ lấy NGUYÊN từ đơn vị từ vựng đã phát hành cùng trình độ (cách đọc và nghĩa vi/en đã qua duyệt ở các đợt 004/005/008–011), chọn ngẫu nhiên có hạt giống cố định (`20261117-<chủ đề>`) giữa các chủ đề từ vựng nguồn gần chủ đề viết, không lặp từ giữa các đơn vị, không lặp từ đã có ở bài viết baseline, không hai mục cùng nghĩa vi trong một chủ đề. Mọi chữ Hán của mục thuộc N5 ref ∪ Kanji ≤ trình độ (AU15). Tối đa 4 mục viết sẵn bằng kana/katakana mỗi chủ đề.
- **Chủ đề `writing-n3-opinions` (cụm/câu ngắn)**: 22 cụm/câu viết tay về nêu ý kiến, nêu lý do, nối ý/kết luận, dự đoán–đề nghị–quyết định, dùng mẫu ngữ pháp N3 (～と思います, ～からです, ～ので, ～せいで, ～べきだ, ～かもしれません, ～に違いない, ～ようにしている, ～ことにする, ～ずに). Đề bài ghi sẵn mẫu cần dùng để chỉ có MỘT đáp án theo nghĩa.
- Đề bài: `Gõ bằng tiếng Nhật: “<nghĩa>”` + `hint` `よみ: <kana>` (từ viết bằng katakana/hiragana thì hint nêu loại chữ và số ký tự). `accepted_answers[0]` là dạng chuẩn hiển thị khi sai; dạng kana đầy đủ luôn được chấp nhận.
- Không bài nào yêu cầu viết tay hay thứ tự nét; không bài tập gắn `item` (không tạo lịch ôn).

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Từ lấy từ đơn vị từ vựng nhưng nghĩa rút gọn thành đề bài**: đề bài dùng nguyên nghĩa vi của từ vựng; vài nghĩa có chú thích trong ngoặc (ví dụ 止める "Dừng; đỗ (xe); tắt (máy)" và 止まる "Dừng lại; đỗ lại (tự động từ)") — nhờ gợi ý `よみ:` nên chỉ một đáp án đúng, nhưng người duyệt nên rà các cặp gần nghĩa: 止める/止まる, 以上/以下, 食事/夕食, 運動/運動会, 公開/公表/発表, 輸入/輸送.
- **Từ ghép Hán + katakana** (電子レンジ): `accepted_answers` = 電子レンジ, でんしレンジ (giữ katakana phần レンジ); dạng viết toàn hiragana KHÔNG được chấp nhận (cố ý, giống quy ước katakana → không đổi sang hiragana).
- **Từ katakana** (カーテン, ビザ, パスポート, メール…): chỉ chấp nhận katakana (hiragana bị từ chối) — hint nêu rõ "Viết bằng katakana".
- **Biến thể chữ**: `なぜなら` chấp nhận thêm 何故なら; `かもしれません` chấp nhận thêm 知れません; bài `意見を言う`, `日本で働く…` có thêm biến thể mix Kanji/kana (意見をいう, 日本ではたらく…). Người duyệt cân nhắc có thêm biến thể thông dụng nào khác không.
- **Độ khít chủ đề**: từ chọn ngẫu nhiên từ các chủ đề từ vựng nguồn nên một số từ lệch nhẹ khỏi tên chủ đề viết (ví dụ `writing-n4-work-basic` có 心, 思い出; `writing-n3-health-lifestyle` có 雑貨; `writing-n4-health-travel` có 空, 森, 林). Chủ đề viết chỉ dùng để thống kê/màu năng lực, không ảnh hưởng chấm điểm; nếu muốn khít hơn, hoán đổi từ giữa các đơn vị cùng trình độ không đổi cấu trúc.
- **Thời lượng**: bài 6 mục xếp 10 phút (gõ Kanji bằng IME thường chậm hơn quỹ 45 giây/câu), bài 5 mục xếp 5 phút; chưa ai làm thử đo thời gian thật.
- **Hiển thị chữ**: mọi ký tự có glyph trong `NotoSansJP.ttf` theo AU14 (lint sạch); chưa kiểm thị giác trên trình duyệt.

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì để lại `drafts/` (không ảnh hưởng đơn vị khác); mỗi trình độ cần ≥ 20 đơn vị `writing` ở ngưỡng `--final` (hiện baseline đã có 2 bài/trình độ nên N4 và N3 mỗi bên còn dư 2 bài so với 20 mới).
- `$schema` của file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích ở `content/units/`).
