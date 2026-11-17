# Ghi chú rà soát đợt 012-reading (60 đơn vị luyện đọc N4 + N3)

> Bản nháp do tác nhân (LLM) soạn. File này KHÔNG phải hồ sơ duyệt; hồ sơ duyệt G1 nằm ở `content/releases/012-reading.json`. Người duyệt xem lại các điểm bên dưới nếu muốn rà kỹ hơn.

## Kết quả `content:lint --drafts`

0 lỗi và 0 cảnh báo cho 60 đơn vị (AU3, AU12, AU13, AU16 đều sạch). Ghi chú môi trường: máy soạn không có `pnpm`; lệnh chạy tương đương `node_modules/.bin/tsx src/seed/lint.ts --drafts` từ `backend/`. Ngoài lint còn có một kiểm tra phụ (script tạm, không nằm trong dự án) đối chiếu `reading` kana của đoạn N4 với đoạn gốc (đoạn kana xen giữa chữ Hán phải xuất hiện đúng thứ tự); chỉ còn 3 trường hợp báo nhầm do số được viết thành chữ kana ở bài tra cứu.

## Quy mô

- N4: 30 đơn vị (16 đơn vị 5 phút, 14 đơn vị 10 phút), 9 chủ đề (`reading-n4-*`, gồm chủ đề baseline `work-life`), 4 dạng (thông báo 8, thư/email 8, bài viết ngắn 8, tra cứu 6). Đoạn dài 89–222 ký tự.
- N3: 30 đơn vị (8 đơn vị 5 phút, 22 đơn vị 10 phút), 8 chủ đề (`reading-n3-*`, gồm chủ đề baseline `society`), 5 dạng (thông báo 5, email công việc 6, cột báo 7, đoạn vừa 7, tra cứu 5). Đoạn dài 98–369 ký tự (xuống dòng bằng `\n` ở email, thông báo nhiều mục và bảng giá).
- `sequence` theo `content/scope/stage-plan.md` (bảng "luyện đọc"); không có `requires`; `goalTags` luôn có `jlpt`.
- 27 dòng danh mục `r-n4-*`/`r-n3-*` đều có ≥ `minUnits` đơn vị (xem `pnpm content:coverage --kind reading`).

## Cấu trúc bài tập

- Mỗi đơn vị có ĐÚNG một mục đoạn văn (`scopeRef` = dòng danh mục) và 3–4 câu `multiple_choice` không khai `item` (không tạo lịch ôn), `format` thuộc nhóm đọc (`comprehension_short` cho bài 5 phút, `comprehension_mid` cho bài 10 phút/đoạn vừa, `info_search` cho tra cứu).
- `feedbackIncorrect` luôn mở đầu bằng việc quay lại trích dẫn 「…」 lấy NGUYÊN VĂN từ đoạn (script dựng đã kiểm trích dẫn có trong đoạn), rồi giải thích vì sao; `feedbackCorrect` cũng trích đoạn.
- Lựa chọn song ngữ vi/en; vị trí đáp án đúng đã xáo (0/1/2).
- Chữ Hán ngoài danh mục N5 ∪ N4 (bài N4) hoặc ∪ N3 (bài N3) được xử lý bằng một trong hai cách: viết kana ở đoạn (ví dụ にもつ, せんざい) hoặc chú giải ở `explanation` (ví dụ 申し訳ございません, 照会, 検討).
- Bài N4 có `reading` kana đầy đủ cho đoạn; bài N3 bỏ `reading` (trường tùy chọn) để tránh sai kana ở đoạn dài.

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Cách đọc kana của đoạn N4** (30 đơn vị): đặc biệt số đếm và ngày (二十日 = はつか, 十日 = とおか, 三日 = みっか, 二日間 = ふつかかん, 三十分 = さんじゅっぷん, 一時五十分 = いちじごじゅっぷん) và các từ ghép (今週中 = こんしゅうちゅう, 一日中 = いちにちじゅう).
- **Từ vựng/ngữ pháp trong đoạn nằm trong phạm vi N4/N3** (FR-009): máy chỉ kiểm chữ Hán (AU15). Đoạn N4 dùng mẫu ～てしまう, ～ようにする, ～てもらう, ～ながら, ～たら…; đoạn N3 dùng ～ことになる, ～ものだ, ～べき, ～てこそ, ～たところ, ～かどうか, ～さえ, ～ずに. Từ khó của đoạn N3 (照会, 振込, 納品, 見込み, 検討…) đã chú giải ở `explanation`.
- **Hai đáp án cùng đúng**: các câu tính tiền (bài tra cứu: thuê xe đạp, câu lạc bộ thể thao, thuê ô tô, thực đơn) đã tính tay: 900/1.200 yên (xe đạp), 8.200/4.950 yên (câu lạc bộ), 15.000/9.500 yên (thuê ô tô), 1.250 yên (xe buýt), 1.200/800 yên (quán cà phê), 2.000 yên (vé ẩm thực). Nên bấm lại một lần.
- **Dữ liệu bịa trong bài tra cứu** (tên cửa hàng, giá, giờ): tất cả là hư cấu, không đại diện cho cơ sở thật nào; tên địa danh dùng có thật chỉ là 京都 (きょうと).
- **Văn phong email công việc N3** (kính ngữ, khiêm nhường, mở đầu お世話になっております…): người duyệt xem có tự nhiên không.
- **Ánh xạ danh mục hồi tố cho baseline (T272)**: `n4-reading-work-life-1` → `r-n4-notice-workplace`, `n4-reading-work-life-2` → `r-n4-essay-daily-impression`, `n3-reading-society-1` → `r-n3-column-society`, `n3-reading-society-2` → `r-n3-midtext-explanation`. Chỉ thêm `scopeRef` vào file, không đổi nội dung/id/tiến độ.
- **Thời lượng**: số câu hỏi × 60 giây ≤ `estMinutes` × 60 cho mọi đơn vị; chưa ai làm thử đo thời gian thật.
- **Xuống dòng ở client**: đoạn có `\n` (thư/email, bảng giá) cần hiển thị đúng ở `PassagePanel` (đã xử lý ở T226); nên mở vài bài để xem.

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì đưa lại `drafts/` (không ảnh hưởng các đơn vị khác); mỗi dòng danh mục có `minUnits` 2–3 nên rút bớt một đơn vị cần soát lại độ phủ bằng `content:coverage`.
- `$schema` của file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích ở `content/units/`).
