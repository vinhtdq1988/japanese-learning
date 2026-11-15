# Ghi chú rà soát đợt 001-grammar-n4 (28 đơn vị, 96 mẫu mới)

> Bản nháp do tác nhân (LLM) soạn; chưa có hồ sơ duyệt. Người duyệt G1 chép phần "Cảnh báo lint chấp nhận" vào `notes` của `content/releases/001-grammar-n4.json` khi duyệt (T057).

## Kết quả `pnpm content:lint --drafts`

0 lỗi. Cảnh báo còn lại chỉ thuộc **AU3** (ví dụ không chứa nguyên văn `japanese` của mục). Lý do chấp nhận: mẫu được ghi ở dạng nguyên thể có dấu 〜 (ví dụ 「〜てある」) còn ví dụ dùng dạng đã chia (「飾ってあります」), nên so khớp chuỗi nguyên văn không khớp dù ví dụ đúng mẫu. Không còn cảnh báo AU12, AU13, AU16.

## Điểm cần người duyệt xem kỹ (LLM không tự xác nhận được)

- **Hai đáp án cùng đúng**: một số câu `contrast`/`form_fill` có đáp án nhiễu về mặt ngữ pháp vẫn chấp nhận được trong tiếng Nhật thực tế; đã thêm ngữ cảnh ở đề (prompt) để loại, nhưng cần soát lại, đặc biệt: `potential-volitional-02` (見える/聞こえる so với 見られる/聞ける), `time-sequence-02` (ばかり so với ところ), `purpose-reason-01` (ように so với ために), `conditionals-01` (と so với たら), `giving-receiving-01/02`, `honorific-basic-02` (謙譲語 so với 尊敬語).
- **Cách đọc kana** của toàn bộ ví dụ (trường âm, tiểu âm, rendaku) và bản dịch vi/en.
- **Thời lượng**: số bài tập ≤ `estMinutes × 2`; chưa ai làm thử đủ từng đơn vị đo thời gian thật.
- **Đơn vị 3 mẫu**: `conditionals-03` (T047) chỉ có 3 mẫu ở đơn vị 10 phút vì danh mục điều kiện N4 chỉ còn 7 dòng (〜ば/〜たら đã thuộc N3 baseline). Cân nhắc xếp thành 5 phút hoặc bổ sung dòng danh mục sau G0.
- **Thứ tự học**: các mẫu bị động/sai khiến N4 (`passive-causative-01/02`) tự giải thích cách chia, vì thể 受身/使役 cơ bản nằm ở đơn vị baseline N3 (`n3-grammar-passive-causative`). `requires` trên `passive-causative-02` chỉ trỏ `passive-causative-01`; `giving-receiving-02` trỏ `giving-receiving-01`.
- **Chia mẫu giữa N4/N3** theo G0: 〜ば/〜たら/〜ので/〜ために (目的)/受身/使役/使役受身/〜(さ)せてください nằm ở N3 (đơn vị baseline), nên đơn vị N4 chỉ so sánh với các mẫu này trong đề.

## Đã xử lý sau rà soát T057

- **Hai đáp án cùng đúng** (14 đơn vị): thêm dòng ngữ cảnh vào đề, bổ sung `accepted_answers`, hoặc đổi lựa chọn nhiễu. Cụ thể: `giving-receiving-01/02`, `honorific-basic-02`, `passive-causative-01/02`, `obligation-permission-01`, `purpose-reason-01/02`, `hearsay-conjecture-03`, `potential-volitional-01/02`, `te-form-extended-02/03`, `time-sequence-02`.
- **Bài sắp xếp ★ mơ hồ**: `passive-causative-02` E12, `purpose-reason-02` E12, `te-form-extended-02` E10, `time-sequence-02` E14 được dựng lại để chỉ còn một thứ tự hợp lệ.
- **`honorific-basic-02`**: tiêu đề nêu thêm tôn kính ngữ thể bị động (mục 0).
- **`purpose-reason-01`**: thay ví dụ thứ hai của 〜ように bằng câu thật sự dùng 〜ように, bỏ chú thích thừa "(so sánh với ために)".
- **Cách đọc katakana**: 21 ví dụ ở 13 đơn vị đã giữ katakana ở `reading`, thống nhất với đơn vị đã phát hành.
- Chưa xử lý: làm thử đo thời gian so với `estMinutes` và xác nhận nguồn cho `sources[]` (cần người duyệt).
