# Ghi chú rà soát đợt 003-kanji-n4 (46 đơn vị, 162 chữ Hán mới)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" (nếu có) vào `notes` của `content/releases/003-kanji-n4.json` khi duyệt (T182). Không được xem file này là hồ sơ duyệt.

## Kết quả `pnpm content:lint --drafts`

0 lỗi và 0 cảnh báo cho 46 đơn vị của đợt này (AU3, AU12, AU13, AU16 đều sạch). Ghi chú môi trường: máy soạn không có `pnpm`, lệnh được chạy tương đương bằng `node_modules/.bin/tsx src/seed/lint.ts --drafts` từ `backend/`.

## Quy mô và tỷ lệ

- 11 chủ đề, 46 đơn vị: 23 đơn vị 5 phút (3 chữ, 10 bài tập) và 23 đơn vị 10 phút (4–5 chữ, 13–16 bài tập) ⇒ tỷ lệ 5 phút = 50% (≥ 30%).
- 162 chữ mới = toàn bộ dòng `k-n4-…` của `content/scope/n4-kanji.json` trừ 8 chữ baseline (体 首 顔 空 海 林 森 風). Mỗi chữ là mục chính của đúng một đơn vị.
- **Số đơn vị theo chủ đề khác ước lượng ở tasks.md** (3/3/3/4/5/6/4/3/5/4/6 thay vì 4/4/4/4/4/4/4/4/4/5/5): số chữ mỗi chủ đề do danh mục quyết định; để phủ đủ 162 chữ mà vẫn có ≥ 30% đơn vị 5 phút thì 46 đơn vị phải có đúng cơ cấu này. Tổng vẫn là 46. Bảng chặng/`sequence` ở `content/scope/stage-plan.md` đã được cập nhật theo số thật.
- `sequence` theo `stage-plan.md` (410 … 2320), rải đều 2–3 đơn vị Kanji mỗi chặng 4–23; Kanji không có `requires`.

## Cấu trúc bài tập (sinh có kiểm soát từ dữ liệu soạn)

- Mỗi chữ có đúng 3 bài gắn chữ: `meaning` (chọn nghĩa, lựa chọn nhiễu là nghĩa của hai chữ khác cùng đơn vị), `reading` (gõ cách đọc của chữ TRONG MỘT TỪ NÊU RÕ — đề đã ghi từ và nghĩa nên chỉ có một đáp án; chấp nhận cả hiragana và katakana) và `word` (chọn cách đọc của cả từ). Cộng 1 bài `matching` ghép chữ – nghĩa, không gắn chữ riêng lẻ.
- Số bài tập 3n + 1 (n = số chữ) ⇒ 10 / 13 / 16 bài, nằm trong quỹ `estMinutes × 2` (10 / 20).
- Không có bài viết tay hay thứ tự nét; `strokeCount` chỉ là siêu dữ liệu hiển thị. `components` được bỏ qua (tùy chọn) vì chưa có nguồn đối chiếu.
- Phản hồi: đáp án đúng nêu nghĩa/cách đọc kèm loại âm (On/Kun); đáp án sai nêu lại nghĩa kèm từ minh họa, hoặc nêu từ đọc thế nào và chữ mang âm gì.

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Cách đọc kana của từ ví dụ và cách đọc của chữ trong từ** (`kanjiReading`), nhất là các từ có biến âm: 兄弟 (弟 = だい), 文字 (字 = じ), 昼ご飯 (飯 = はん), 世の中, 読み方, 夜中, 田んぼ, 真ん中, 若者, 景色 (色 = しき), 喫茶店 (茶 = さ), 図書館 (図 = と).
- **Số nét (`strokeCount`)** của cả 162 chữ do tác nhân ghi theo trí nhớ; cần đối chiếu từ điển chữ Hán trước khi phát hành (chỉ hiển thị, không ảnh hưởng chấm điểm).
- **Cách đọc On/Kun từng chữ** (đặc biệt chữ nhiều âm: 家, 重, 楽, 悪, 度, 着, 開, 言, 文, 画, 図, 質, 作, 業) và việc có nên bớt âm hiếm cho phù hợp mức N4.
- **Phương án nhiễu của câu `word`** được sinh bán tự động (đổi âm On↔Kun, đổi đục/trong, bỏ trường âm; 14 chữ ghi tay ở `MANUAL`): kiểm tra không có phương án nào TRÙNG một cách đọc hợp lệ khác của từ; một số phương án là chuỗi không phải từ thật (chủ ý, để loại trừ hiển nhiên).
- **Hai đáp án cùng đúng ở câu `meaning`**: đã bảo đảm nghĩa không trùng trong cùng đơn vị, nhưng các cặp gần nghĩa nằm cùng đơn vị cần soát: 研/究 (nghiên cứu), 問/質 (hỏi/chất vấn), 文/字/漢, 写/映, 買/売/貸/借, 林/森 (đã ở baseline), 兄/弟/姉/妹.
- **Từ ví dụ dùng chữ Hán ngoài danh mục N4** (có `reading` kana đầy đủ): 瓶, 卒, 若, 探, 経, 賃, 講, 紅, 焼 — đã bảo đảm có glyph trong phông (lint AU14).
- **Chủ đề gộp**: `kanji-n4-nature-weather` thực chứa mùa và động vật (không có chữ thời tiết) nên tên hiển thị là "Thiên nhiên – mùa – động vật"; `kanji-n4-school-learning` chứa cả nhóm nghệ thuật (画 図 写 映 紙 意 音 歌). Người duyệt có thể đề nghị đổi tên chủ đề ở `content/topics.json`.
- **Thời lượng**: số bài ≤ `estMinutes × 2`; chưa ai làm thử đủ từng đơn vị đo thời gian thật.
- **Ví dụ 2 từ/chữ**: tối thiểu theo quy ước (≥ 2 từ ví dụ); Một số từ thứ hai là từ đơn lẻ (ví dụ 「目」「口」「力」) để kiểm tra cách đọc Kun đứng riêng.

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì để lại `drafts/` (không ảnh hưởng các đơn vị khác); mỗi chủ đề chỉ cần ≥ 2 đơn vị đã phát hành để đạt AU12.
- Khi chuyển file sang `content/units/`, trường `$schema` của file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích).
- Chữ có cách đọc thêm ở N3 (生, 外, 上, 下, 風, 体, 空 …) sẽ bổ sung bằng `amendments` ở đợt 007 (T201), không tạo chữ lặp.
