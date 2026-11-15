# Ứng viên `amendments` cho đợt 007-kanji-n3-b (bản nháp, chưa duyệt)

> Phục vụ T167/T201. Schema `scope.schema.json` 1.0.0 không có trường `notes`, nên ghi chú về chữ Hán đã học ở N5/N4 nhưng có cách đọc mới ở N3 được đặt ở file này thay vì trong `n3-kanji.json`. Danh sách do tác nhân soạn nháp từ kiến thức sẵn có, CHƯA đối chiếu nguồn; T201 phải xác minh từng cách đọc trước khi đưa vào manifest.

Quy ước: chỉ THÊM cách đọc/ví dụ/bài tập vào mục hiện có (đơn vị baseline hoặc đợt 003), không tạo chữ lặp.

| Chữ | Đã có ở | Cách đọc có thể bổ sung ở N3 | Từ minh họa gợi ý |
| --- | ------- | ---------------------------- | ----------------- |
| 生 | N5 (ref) | ショウ, う.まれる | 一生（いっしょう）, 生まれる |
| 外 | N5 (ref) | ゲ | 外科（げか） |
| 上 / 下 | N5 (ref) | ジョウ / ゲ | 上手（じょうず）, 下手（へた） |
| 風 | baseline N4 | ふう | 和風（わふう） |
| 体 | baseline N4 | テイ | 体裁（ていさい） |
| 空 | baseline N4 | から | 空っぽ（からっぽ） |

## Kết quả xác minh (T201, 2026-11-15)

Đối chiếu từng ứng viên với `kanjiDetails` của các đơn vị Kanji thật trong thư viện:

| Chữ | Kết luận |
| --- | -------- |
| 生, 外, 上, 下 | KHÔNG hợp lệ: chỉ có trong `n5-kanji.ref.json`, thư viện chưa có đơn vị Kanji nào chứa các chữ này nên không có mục hiện có để bổ sung. |
| 風 (ふう) | Đã có: `onReadings` baseline gồm フウ, フ. |
| 体 (テイ) | Đã có: `onReadings` baseline gồm タイ, テイ. |
| 空 (から) | Đã có: `kunReadings` baseline gồm そら, あ.く, から. |

Rà thêm các chữ baseline còn lại và 162 chữ đợt 003: không tìm được cách đọc N3 thông dụng nào còn thiếu. Kết luận: `amendments` của đợt 007-kanji-n3-b để rỗng; người duyệt G1 có thể bổ sung nếu biết trường hợp thật (lưu ý quỹ thời lượng của bài 5 phút baseline đã đầy).
