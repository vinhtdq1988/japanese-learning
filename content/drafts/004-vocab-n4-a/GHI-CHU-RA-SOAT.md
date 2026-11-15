# Ghi chú rà soát đợt 004-vocab-n4-a (33 đơn vị, 336 từ mới)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" vào `notes` của `content/releases/004-vocab-n4-a.json` khi duyệt (T091). Không được xem file này là hồ sơ duyệt.

## Kết quả `pnpm content:lint --drafts`

0 lỗi và 0 cảnh báo ở các đơn vị từ vựng của đợt này (các cảnh báo AU3 còn lại trong lệnh lint thuộc nháp ngữ pháp đợt 001/002). Không có cảnh báo AU3, AU12, AU13, AU16 nào cần ghi chấp nhận cho đợt 004.

## Quy mô và tỷ lệ

- 12 nhóm chủ đề, 33 đơn vị: 10 đơn vị 5 phút (6 từ, 9 bài tập) và 23 đơn vị 10 phút (12 từ, 18 bài tập). Tỷ lệ 5 phút của riêng đợt 004 là 30,3% (đợt 005 sẽ bù thêm để cả N4 ≥ 30%).
- 336 từ mới nằm trong dải danh mục của 12 nhóm chủ đề (367 dòng); cộng 8 từ baseline đã tính là phủ nên đợt này phủ ≈ 93,7% phần danh mục của nó.
- `sequence` theo bảng `content/scope/stage-plan.md` (410 … 1330). Từ vựng không có `requires`.

## Cấu trúc bài tập (sinh có kiểm soát từ dữ liệu soạn)

- Mỗi từ có đúng 1 bài `context_fill` (câu có chỗ trống, 4 lựa chọn) gắn mục; cộng 4 bài `kanji_reading` và 2 bài `orthography` (đơn vị 10 phút) hoặc 2 + 1 (đơn vị 5 phút) lấy từ chính câu ví dụ của từ có chữ Hán. Tổng 18 / 9 bài, trong quỹ thời lượng (≤ 20 / ≤ 10).
- Phản hồi đúng/sai được tạo theo khuôn: nêu nghĩa của từ và nghĩa cả câu, giải thích vì sao đáp án đúng (vi + en, ≥ 15 ký tự, khác nhau).

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Hai đáp án cùng đúng ở câu `context_fill`**: với các nhóm từ cùng trường nghĩa (gia đình, địa điểm, thời gian, loại tàu, động từ nấu ăn…) chỗ trống có thể hợp nhiều từ. Đã xử lý bằng (a) chọn lựa chọn nhiễu loại các từ gần nghĩa hoặc không thể hợp ngữ pháp, và (b) thêm câu dịch vào đề (đoạn "Nghĩa của câu: …") ở khoảng một nửa số câu. Cần soát lại, đặc biệt: `family-people-02` (夫/妻/主人/奥さん), `time-calendar-01/02` (các mốc thời gian), `food-cooking-03` (沸かす/焼く/煮る/炒める/茹でる), `travel-trip-02` (特急/急行/新幹線), `school-study-02` (復習/予習/練習).
- **Đề có kèm câu dịch** ("Nghĩa của câu: …") thực chất kiểm tra việc nhớ từ tiếng Nhật ứng với nghĩa, không phải đoán thuần từ ngữ cảnh. Đây là lựa chọn của người soạn để tránh mơ hồ; người duyệt có thể quyết định bỏ phần dịch ở những câu thấy đã đủ rõ.
- **Cách đọc kana** của toàn bộ từ và câu ví dụ (trường âm, tiểu âm, rendaku, số đếm như 十(じゅっ), 二十歳(はたち), 一昨日(おととい), 一昨年(おととし), 昨夜(ゆうべ)) và bản dịch vi/en.
- **Đồng âm hoặc cùng khóa chữ khác đọc**: `端`/`橋`/`箸` (はし) nằm ở các đơn vị khác nhau (箸 ở đợt này, 橋 ở `city-facilities-02`, 端 thuộc đợt sau) — đã kiểm khóa `japanese|reading` không trùng.
- **Từ gắn với trình độ**: một số từ danh mục có thể thuộc N3 theo nguồn khác (ví dụ 履歴書, 作業 đã bị loại khỏi đợt này). Danh mục là dự thảo đã duyệt ở G0 nhưng việc gán nguồn từng dòng là ước tính.
- **Ví dụ tự nhiên**: một số câu cố ý đặt rõ ràng để chỉ một đáp án hợp (ví dụ 「母の父は、私の祖父です。」); cần xác nhận không máy móc.
- **Thời lượng**: số bài tập ≤ `estMinutes × 2`; chưa ai làm thử đủ từng đơn vị đo thời gian thật.
- **Hỗn hợp loại từ trong đơn vị**: các đơn vị chứa cả danh từ và động từ (ví dụ `work-basic-02/03`, `shopping-money-02`); lựa chọn nhiễu trong câu động từ đã dùng dạng từ điển và đặt cùng loại.

## Từ trong dải danh mục chưa có đơn vị (23 từ — để đợt 014 hoặc chủ đề tương ứng bù)

会社員, 主婦, 温める, 冷める, 冷凍, 腐る, 安売り, 休日, 間, 文化, 文学, 利用, 作業, 履歴書, 温度, 景色, 自然, 市, 運転, 船, 命, 健康, 保険.

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì để lại `drafts/` (không ảnh hưởng các đơn vị khác); các nhóm chủ đề trong `content/topics.json` chỉ cần ≥ 2 đơn vị đã phát hành.
- Khi chuyển file sang `content/units/`, trường `$schema` của các file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích).
