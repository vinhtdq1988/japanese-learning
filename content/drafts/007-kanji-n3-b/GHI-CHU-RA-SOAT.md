# Ghi chú rà soát đợt 007-kanji-n3-b (47 đơn vị, 187 chữ Hán mới; `amendments` rỗng)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" (nếu có) vào `notes` của `content/releases/007-kanji-n3-b.json` khi duyệt (T203). Không được xem file này là hồ sơ duyệt.

## Kết quả `pnpm content:lint --drafts`

0 lỗi và 0 cảnh báo cho 47 đơn vị của đợt này (AU3, AU12, AU13, AU16 đều sạch). Ghi chú môi trường: máy soạn không có `pnpm`, lệnh được chạy tương đương bằng `node_modules/.bin/tsx src/seed/lint.ts --drafts` từ `backend/`.

## Quy mô và tỷ lệ

- 6 chủ đề: thiên nhiên – môi trường (30 chữ, 8 đơn vị), cơ thể – cảm xúc (39 chữ, 9), đời sống – nhà cửa (23 chữ, 6), giao tiếp – diễn đạt (18 chữ, 5), động từ – hành động (32 chữ, 8), tính từ – số lượng (45 chữ, 11) = 47 đơn vị.
- 17 đơn vị 5 phút (3 chữ, 10 bài tập) và 30 đơn vị 10 phút (4–5 chữ, 13–16 bài tập); tỷ lệ 5 phút của riêng đợt = 36,2%.
- 187 chữ + 165 chữ đợt 006 + 7 chữ baseline = 359 dòng của `n3-kanji.json`, không trùng, không thiếu. `sequence` theo `stage-plan.md` (chặng 19–33, 1910 … 3330).
- **Số đơn vị khác ước lượng ở tasks.md** (≈ 40; 6/7/7/7/7/6): xem giải thích ở ghi chú đợt 006. Chủ đề `kanji-n3-adjectives-quantity` (45 chữ) và `kanji-n3-body-feelings` (39 chữ) lớn nhất vì danh mục có nhiều tính từ/chữ chỉ cảm xúc; người duyệt có thể đề nghị tách chủ đề.

## Cấu trúc bài tập

Giống đợt 003/006: mỗi chữ có 3 bài gắn chữ (`meaning`, `reading` trong từ cụ thể, `word`) + 1 bài `matching`; 3n + 1 bài mỗi đơn vị. Không có bài viết tay/thứ tự nét.

## `amendments` (T201): danh sách RỖNG, có chủ đích

Tác nhân đã xác minh danh sách ứng viên cũ ở `content/scope/kanji-amendment-candidates.md` đối chiếu với các đơn vị thật trong thư viện và KHÔNG tìm được ứng viên hợp lệ:

- 生, 外, 上, 下: chỉ nằm trong `n5-kanji.ref.json` (chữ tham chiếu cho đoạn đọc), thư viện KHÔNG có đơn vị Kanji chứa các chữ này ⇒ không có mục hiện có để bổ sung; muốn dạy phải tạo bài Kanji mới (ngoài phạm vi danh mục N4/N3).
- 風 (フウ/フ), 体 (タイ/テイ), 空 (から): cách đọc ứng viên đã có sẵn trong `kanjiDetails` của đơn vị baseline.
- Rà thêm các chữ còn lại của baseline (政 経 済 民 職 給 務 / 首 顔 / 一…八 日 月 年 時) và 162 chữ đợt 003: cách đọc N3 thông dụng đều đã có trong tập âm khai báo.

Vì vậy manifest `007-kanji-n3-b.json` khi tạo ở T203 có `amendments: []` (hoặc bỏ trường). Nếu người duyệt biết cách đọc thật sự thiếu, thêm phần tử theo `release.schema.json` (`unit` {kind `kanji`, level, titleEn}, `item`, `add`); lưu ý bài 5 phút của baseline (`n4-kanji-people-body`, `n3-kanji-work`, `n5-kanji-numbers-1`) đã đủ quỹ 10 bài nên thêm bài tập sẽ vượt quỹ thời lượng.

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Cách đọc kana của từ ví dụ và cách đọc của chữ trong từ** (`kanjiReading`) cho toàn bộ 187 chữ × 2 từ; các từ dễ nhầm: 愛想 (あいそ), 格好 (かっこう), 性分, 私達, お歳暮 (おせいぼ), 神様, 再来週 (さらいしゅう), 最期 (さいご), 居間, 津波, 原っぱ, 弁護士, 留守, 突然, 悪夢.
- **Số nét (`strokeCount`)** do tác nhân ghi theo trí nhớ; cần đối chiếu từ điển chữ Hán (chỉ hiển thị).
- **Từ có nhiều cách đọc hợp lệ**: 怒り (いかり; 怒る có thể là いかる/おこる nên đã dùng 怒り), 良く (よく; 良い có thể là よい/いい nên dùng 良く), 家賃, 宿, 成る (văn viết), 永い (văn chương). Người duyệt quyết định giữ hay thay bằng từ thông dụng hơn.
- **Hai đáp án cùng đúng ở `meaning`**: các nhóm gần nghĩa (ví dụ 悲/苦/痛/疲, 笑/泣/怒, 速/低/超, 初/次/末, 全/各/両) có thể rơi vào cùng đơn vị; nghĩa vi/en đã khác nhau theo chuỗi (bộ sinh chặn trùng), cần người duyệt xác nhận khác nhau về nghĩa.
- **Phương án nhiễu câu `word`**: tự sinh theo thứ tự ưu tiên âm còn lại (On ↔ Kun), từ thật của chữ khác cùng đơn vị, đổi đục/trong; một số là chuỗi không phải từ thật (chủ ý). Đợt này không dùng phương án nhiễu thủ công.
- **Từ ví dụ dùng chữ Hán ngoài danh mục** (khoảng 50 chữ N2–N1 hoặc ngoài danh mục, ví dụ 劇, 功, 尊, 導, 拒, 援, 撃, 環, 漠, 激, 睡, 祉, 票, 胞, 膚, 航, 護, 革…): đều có `reading` kana và đã qua kiểm glyph AU14; người duyệt xác nhận mức độ phù hợp với N3.
- **Chủ đề**: tên chủ đề và chữ nào thuộc nhóm nào do tác nhân phân theo nghĩa gần đúng (ví dụ 象 xếp ở "thiên nhiên – môi trường", 停/側/横 ở "đời sống – nhà cửa", 満/善 ở "tính từ – số lượng").
- **Bản dịch vi/en** tự nhiên; **thời lượng** (chưa ai làm thử đủ từng đơn vị đo thời gian thật).

## Gợi ý khi duyệt

- Đơn vị nào không đạt thì để lại `drafts/` (không ảnh hưởng đơn vị khác); mỗi chủ đề chỉ cần ≥ 2 đơn vị đã phát hành để đạt AU12.
- Khi chuyển file sang `content/units/`, `$schema` của file nháp đã trỏ `../schema/unit.schema.json` (đúng vị trí đích).
- Đợt 007 phụ thuộc đợt 006 về tên chủ đề/`sequence`; nên phát hành 006 trước rồi mới 007 để thư viện liền mạch.
