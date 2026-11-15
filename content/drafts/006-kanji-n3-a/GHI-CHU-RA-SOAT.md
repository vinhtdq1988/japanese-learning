# Ghi chú rà soát đợt 006-kanji-n3-a (42 đơn vị, 165 chữ Hán mới)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" (nếu có) vào `notes` của `content/releases/006-kanji-n3-a.json` khi duyệt (T192). Không được xem file này là hồ sơ duyệt.

## Kết quả `pnpm content:lint --drafts`

0 lỗi và 0 cảnh báo cho 42 đơn vị của đợt này (AU3, AU12, AU13, AU16 đều sạch). Ghi chú môi trường: máy soạn không có `pnpm`, lệnh được chạy tương đương bằng `node_modules/.bin/tsx src/seed/lint.ts --drafts` từ `backend/`.

## Quy mô và tỷ lệ

- 6 chủ đề: công việc – kinh doanh (29 chữ, 7 đơn vị), xã hội – chính trị (28 chữ, 7), kinh tế – tiền bạc (30 chữ, 8), giáo dục – văn hóa (28 chữ, 7), pháp luật – trật tự (30 chữ, 8), quốc tế (20 chữ, 5) = 42 đơn vị.
- 17 đơn vị 5 phút (3 chữ, 10 bài tập) và 25 đơn vị 10 phút (4–5 chữ, 13–16 bài tập). Tỷ lệ 5 phút của riêng đợt = 40,5%; toàn Kanji N3 sau cả hai đợt 006 + 007 và 2 đơn vị baseline = 35/91 ≈ 38,5% (≥ 30%).
- **Số đơn vị khác ước lượng ở tasks.md** (≈ 40 đơn vị/đợt; phân bổ 7/7/6/6/7/7): số chữ mỗi chủ đề do danh mục `n3-kanji.json` (359 dòng) quyết định; để phủ 352 chữ mới mà vẫn có ≥ 30% đơn vị 5 phút thì cần 89 đơn vị cho cả hai đợt (42 + 47) thay vì 80. Bảng chặng/`sequence` ở `content/scope/stage-plan.md` đã cập nhật theo số thật (đợt 006: chặng 4–18; đợt 007: chặng 19–33).
- Việc chia chữ vào chủ đề/đơn vị theo ngữ nghĩa gần đúng; một số chữ đa nghĩa được xếp theo nghĩa thường gặp ở N3 (ví dụ 反, 当, 合, 面).
- Mỗi chữ là mục chính của đúng một đơn vị; kiểm tra ngoài lint: 165 chữ đợt này + 187 chữ đợt 007 + 7 chữ baseline = 359 dòng của danh mục, không trùng, không thiếu.

## Cấu trúc bài tập (sinh có kiểm soát từ dữ liệu soạn)

- Giống đợt 003: mỗi chữ có đúng 3 bài (`meaning` chọn nghĩa, `reading` gõ cách đọc của chữ TRONG TỪ NÊU RÕ, `word` chọn cách đọc của cả từ) + 1 bài `matching`; số bài 3n + 1 (10 / 13 / 16), trong quỹ thời lượng.
- Không có bài viết tay hay thứ tự nét; `strokeCount` chỉ hiển thị.
- Phương án nhiễu câu `word`: ưu tiên (1) đọc chữ bằng âm còn lại (On ↔ Kun), (2) từ thật của chữ khác cùng đơn vị (với từ có okurigana hoặc chữ đứng riêng), (3) đổi đục/trong, bỏ trường âm. Một số phương án là chuỗi không phải từ thật (chủ ý).

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Cách đọc kana của từ ví dụ và cách đọc của chữ trong từ** (`kanjiReading`): toàn bộ 165 chữ × 2 từ. Từ có biến âm/âm khó cần soát riêng: 組織 (そしき), 派手 (はで), 都合 (つごう), 市場 (いちば — còn đọc しじょう; đề đã ghi nghĩa "chợ" để định hướng), 面白い, 年賀状, 郵便局, 結局, お客さん, 財布 (さいふ), 割合, 留守.
- **Số nét (`strokeCount`)** do tác nhân ghi theo trí nhớ; cần đối chiếu từ điển chữ Hán (chỉ hiển thị).
- **Cách đọc On/Kun từng chữ** và việc có nên giữ cả âm hiếm: 係 (かかり), 位 (くらい), 内 (ダイ), 納 (ナッ, ナ, トウ), 作, 合 (ガッ, カッ), 平 (ビョウ), 和 (オ).
- **Chữ nhiều nghĩa gần nhau trong cùng đơn vị** (nguy cơ hai đáp án cùng đúng ở `meaning`): 保/守/防 (đã tách: "giữ gìn; bảo đảm" / "canh giữ; tuân thủ" / "phòng; ngăn"), 戦/争, 勝/敗, 提/案/申, 認/承, 賛/反, 論/説/述, 記/録, 判/断, 検/察/警, 増/減, 割/率/倍, 貯/預/収/納. Tác nhân đã bảo đảm nghĩa vi/en khác nhau theo chuỗi, người duyệt cần xác nhận khác nhau về nghĩa.
- **Từ ví dụ dùng chữ Hán ngoài danh mục Kanji N4/N3** (khoảng 40 chữ N2–N1 hoặc chưa có trong danh mục, ví dụ 結, 接, 査, 税, 統, 義, 芸, 裁, 郵, 貿, 逮, 較…; ngoài ra có chữ N5 chưa có bài): đều có `reading` kana đầy đủ và đã qua kiểm glyph AU14; người duyệt xác nhận mức độ phù hợp với N3.
- **Từ gắn với trình độ**: 了承, 貯蔵, 逮捕 (ví dụ của 捕), 破壊 có thể vượt N3; người duyệt quyết định giữ hay thay.
- **Bản dịch vi/en** tự nhiên; **thời lượng** (chưa ai làm thử đủ từng đơn vị đo thời gian thật).

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì để lại `drafts/` (không ảnh hưởng đơn vị khác); mỗi chủ đề chỉ cần ≥ 2 đơn vị đã phát hành để đạt AU12.
- Khi chuyển file sang `content/units/`, `$schema` của file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích).
- `topics.json` đã có đủ 6 chủ đề của đợt (T184); `sequence` theo bảng chặng đã cập nhật.
