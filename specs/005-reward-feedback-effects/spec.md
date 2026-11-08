# Đặc tả tính năng: Hiệu ứng âm thanh và hình ảnh khi trả lời đúng và đạt thành tựu

**Nhánh tính năng**: `005-reward-feedback-effects` (tên thư mục; chưa tạo nhánh git)

**Ngày tạo**: 2026-11-08

**Trạng thái**: Bản nháp; sẵn sàng cho `/speckit-clarify` hoặc `/speckit-plan`

**Giai đoạn**: Giai đoạn 1 – MVP (cải tiến trải nghiệm cho các mô-đun Daily Learning, Review System và Progress Tracking, theo hiến pháp v1.2.0). Tính năng chạy trên Web; hành vi riêng của nền tảng (ví dụ rung trên thiết bị di động) nằm ngoài phạm vi.

**Đầu vào**: Mô tả của người dùng: "Hiệu ứng âm thanh và hình ảnh khi chọn đúng đáp án cũng như đạt thành tựu giúp học viên hứng thú"

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (2) bài học hằng ngày vẫn vừa trong 5–15 phút (hiệu ứng không được kéo dài phiên học); (5) theo dõi được tiến độ và mức đạt mục tiêu (các mốc thành tựu làm tiến độ trở nên hữu hình). Tính năng phục vụ Nguyên tắc IV (xây dựng thói quen hằng ngày) và Nguyên tắc III (người học tự bật/tắt được hiệu ứng). Tiêu chí (6) không bị ảnh hưởng.

## Làm rõ

### Phiên 2026-11-08

- Q: Nếu người học đã đạt một thành tựu nhưng chưa kịp thấy màn chúc mừng (đóng tab, mất mạng ngay sau khi hoàn thành bài), lần mở ứng dụng sau có chúc mừng bù không? → A: Không; thành tựu vẫn được ghi nhận nhưng chỉ chúc mừng đúng một lần, ngay tại thời điểm đạt, và không bao giờ hiển thị lại nếu bị bỏ lỡ.
- Q: Khi cùng một lần hoàn thành vừa hoàn thành kế hoạch hôm nay vừa làm đạt thành tựu, người học thấy một màn gộp hay hai màn riêng? → A: Một màn gộp duy nhất: lời chúc mừng hoàn thành ngày hiện trước, sau đó lần lượt các thành tựu đạt được.
- Q: Thành tựu "bài học đầu tiên" và "bài hoàn hảo" có tính cả bài ôn tập hay chỉ bài học mới? → A: Chỉ bài học mới (từ vựng, ngữ pháp, Kanji); bài ôn tập không kích hoạt hai thành tựu này.
- Q: Màn chúc mừng thành tựu có chặn thao tác bên dưới (modal) hay là lớp phủ không chặn? → A: Lớp phủ không chặn: nút "Tiếp tục" và điều hướng vẫn dùng được ngay; thao tác đó đóng màn chúc mừng.
- Q: Khi người học đổi mục tiêu hoặc dựng lại lộ trình làm phần trăm tiến độ nhảy qua nhiều mốc hoặc tụt dưới mốc đã đạt thì xử lý thế nào? → A: Mốc đã đạt không bao giờ bị thu hồi; mốc bị vượt chỉ vì đổi mục tiêu/dựng lại lộ trình được ghi âm thầm (không chúc mừng); chỉ chúc mừng khi tiến độ tăng nhờ học tập.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Nhận phản hồi âm thanh và hình ảnh ngay khi trả lời (Ưu tiên: P1)

Mỗi khi người học chọn hoặc nhập một đáp án ở nơi ứng dụng vốn đã hiển thị phản hồi đúng/sai tức thì (bài học từ vựng, ngữ pháp, Kanji; bài ôn tập; bài học mẫu khi dùng thử), họ nghe một âm thanh ngắn và thấy một hiệu ứng hình ảnh ngắn thể hiện kết quả. Đáp án đúng được đón nhận vui vẻ, rõ ràng; đáp án sai được phản hồi nhẹ nhàng, khích lệ, không gây nản.

**Lý do ưu tiên**: Đây là khoảnh khắc lặp lại nhiều nhất trong mỗi phiên học (hàng chục lần mỗi ngày), nên là nơi tạo cảm giác hứng thú rõ nhất và là nền tảng của toàn bộ tính năng.

**Kiểm thử độc lập**: Mở một bài học (và một bài ôn tập, một bài học mẫu dùng thử), lần lượt trả lời đúng và sai ở từng loại bài tập, và xác minh: mỗi câu trả lời kích hoạt đúng một phản hồi âm thanh và hình ảnh phân biệt được đúng/sai, xuất hiện ngay lập tức, không chặn việc sang câu kế tiếp.

**Kịch bản chấp nhận**:

1. **Với** một bài tập có phản hồi đúng/sai tức thì, **Khi** người học trả lời đúng, **Thì** họ nghe một âm thanh vui tai và thấy một hiệu ứng hình ảnh tích cực gắn với đáp án vừa chọn, ngay sau khi trả lời.
2. **Với** một bài tập có phản hồi đúng/sai tức thì, **Khi** người học trả lời sai, **Thì** họ nghe một âm thanh nhẹ, trung tính và thấy hiệu ứng hình ảnh nhẹ nhàng (không có màu hay chuyển động mang tính trừng phạt); đáp án đúng và giải thích ngắn vẫn hiển thị như trước khi có tính năng này.
3. **Với** bất kỳ loại bài tập nào (trắc nghiệm, ghép cặp, điền vào chỗ trống) và bất kỳ loại nội dung nào (từ vựng, ngữ pháp, Kanji), **Khi** người học trả lời, **Thì** phản hồi âm thanh và hình ảnh nhất quán giữa các loại; với bài ghép cặp, mỗi lần ghép một cặp được tính là một lần trả lời.
4. **Với** một bài ôn tập hoặc bài học mẫu của khách dùng thử, **Khi** người học trả lời, **Thì** họ nhận được cùng kiểu phản hồi như trong bài học.
5. **Với** một người học trả lời liên tiếp rất nhanh, **Khi** các câu trả lời dồn dập, **Thì** hiệu ứng không chồng chất hay làm chậm thao tác; hiệu ứng của câu trước được thay bằng hiệu ứng của câu sau.
6. **Với** một bài kiểm tra trình độ (không hiển thị đúng/sai theo từng câu), **Khi** người học trả lời, **Thì** không có hiệu ứng đúng/sai nào xuất hiện, để không làm lộ kết quả của bài đánh giá.

---

### Câu chuyện người dùng 2 - Được chúc mừng khi đạt thành tựu (Ưu tiên: P1)

Khi người học đạt một mốc đáng tự hào (hoàn thành bài học đầu tiên, giữ chuỗi ngày học liên tiếp, học được nhiều mục, tiến gần mục tiêu, hoàn thành bài không sai câu nào), họ thấy một màn chúc mừng nổi bật có âm thanh riêng, nêu rõ họ vừa đạt gì. Khi hoàn thành toàn bộ kế hoạch hôm nay, họ cũng nhận một lời chúc mừng cho ngày học đó.

**Lý do ưu tiên**: Thành tựu biến tiến độ trừu tượng thành cảm giác thành công cụ thể và thúc đẩy thói quen học hằng ngày; đây là nửa thứ hai của yêu cầu ban đầu và có thể kiểm thử độc lập với Câu chuyện 1.

**Kiểm thử độc lập**: Với tài khoản kiểm thử ở sát một mốc (ví dụ ngày học thứ 6 của một chuỗi, hoặc sắp hoàn thành bài đầu tiên), hoàn thành hành động đưa họ qua mốc và xác minh: màn chúc mừng xuất hiện đúng một lần với tên và mô tả mốc, có âm thanh và hình ảnh, tắt được; tải lại hoặc lặp lại hành động không làm xuất hiện lại.

**Kịch bản chấp nhận**:

1. **Với** một người học vừa hoàn thành bài học mới đầu tiên của mình (bài ôn tập không tính), **Khi** bài được ghi nhận hoàn thành, **Thì** họ thấy màn chúc mừng thành tựu "bài học đầu tiên" kèm âm thanh và hiệu ứng hình ảnh.
2. **Với** một người học có chuỗi ngày học liên tiếp, **Khi** chuỗi đạt một mốc trong danh mục (ví dụ 3, 7, 14, 30, 60, 100 ngày), **Thì** họ được chúc mừng với số ngày của mốc đó, ở lần hoàn thành ngày học làm chuỗi đạt mốc.
3. **Với** một người học, **Khi** tổng số mục đã học hoặc tiến độ hướng tới mục tiêu của họ vượt một mốc trong danh mục, **Thì** họ được chúc mừng mốc tương ứng.
4. **Với** một người học vừa hoàn thành một bài học mới mà mọi câu đều đúng ngay lần trả lời đầu (bài ôn tập không tính), **Khi** bài hoàn thành, **Thì** họ được chúc mừng thành tựu "bài hoàn hảo" (chỉ lần đầu tiên).
5. **Với** một người học hoàn thành mục cuối cùng của kế hoạch hôm nay, **Khi** ngày được đánh dấu hoàn thành, **Thì** họ thấy lời chúc mừng hoàn thành ngày học kèm tóm tắt kết quả vốn có; lời chúc mừng này xuất hiện tối đa một lần mỗi ngày, kể cả khi họ học thêm nội dung bổ sung.
6. **Với** một thành tựu đã được chúc mừng, **Khi** người học tải lại trang, mở ứng dụng ở cửa sổ khác, lặp lại hành động hoặc đăng nhập lại, **Thì** thành tựu đó không được chúc mừng lần nữa.
7. **Với** một hành động làm đạt nhiều thành tựu cùng lúc, **Khi** chúng được hiển thị, **Thì** người học thấy một màn chúc mừng gộp (lần lượt từng thành tựu) thay vì nhiều cửa sổ chồng nhau; nếu cùng lúc hoàn thành kế hoạch hôm nay, lời chúc mừng hoàn thành ngày nằm đầu cùng màn gộp đó, không tách thành màn riêng.
8. **Với** màn chúc mừng đang hiển thị, **Khi** người học muốn tiếp tục, **Thì** họ đóng được ngay bằng một thao tác, hoặc bấm thẳng nút "Tiếp tục"/điều hướng bên dưới mà không bị chặn (màn là lớp phủ không chặn); nếu không thao tác, màn tự đóng sau vài giây.
9. **Với** người học chọn tiếng Anh hoặc tiếng Việt làm ngôn ngữ giao diện, **Khi** màn chúc mừng xuất hiện, **Thì** tên và mô tả thành tựu hiển thị đúng ngôn ngữ đã chọn.

---

### Câu chuyện người dùng 3 - Tự điều chỉnh hoặc tắt hiệu ứng (Ưu tiên: P2)

Người học có thể bật/tắt riêng âm thanh và hiệu ứng hình ảnh (hoạt ảnh, màn chúc mừng) theo ý thích, hoàn cảnh (học ở nơi công cộng, văn phòng) hoặc nhu cầu tiếp cận (nhạy cảm với chuyển động). Hệ thống cũng tôn trọng thiết lập "giảm chuyển động" của thiết bị hoặc trình duyệt.

**Lý do ưu tiên**: Người học là nhân viên văn phòng thường học ở nơi cần yên lặng; hiệu ứng không tắt được sẽ gây phiền và phản tác dụng. Đây cũng là yêu cầu của Nguyên tắc III (người học nắm quyền kiểm soát) và tiếp cận. Ở mức P2 vì giá trị chỉ có sau khi đã có hiệu ứng (Câu chuyện 1, 2), nhưng PHẢI hoàn thành trước khi phát hành.

**Kiểm thử độc lập**: Bật/tắt từng tùy chọn, làm một vài bài tập và một hành động đạt thành tựu, rồi xác minh: tắt âm thanh thì không có tiếng nhưng hình ảnh còn; tắt hiệu ứng hình ảnh thì không có hoạt ảnh nhưng kết quả đúng/sai vẫn thể hiện rõ; thiết lập được giữ sau khi đăng xuất và đăng nhập lại.

**Kịch bản chấp nhận**:

1. **Với** một người học, **Khi** họ mở phần thiết lập, **Thì** họ thấy hai tùy chọn độc lập: "Âm thanh" và "Hiệu ứng hình ảnh", mỗi tùy chọn bật/tắt được; mặc định cả hai đều bật.
2. **Với** một người học đang ở giữa bài học, **Khi** họ muốn tắt tiếng nhanh, **Thì** họ có một nút tắt/bật âm thanh ngay trên màn hình bài học mà không phải rời bài.
3. **Với** âm thanh đang tắt, **Khi** người học trả lời hoặc đạt thành tựu, **Thì** không có âm thanh nào phát, còn hiệu ứng hình ảnh (nếu bật) vẫn hiển thị.
4. **Với** hiệu ứng hình ảnh đang tắt, **Khi** người học trả lời, **Thì** kết quả đúng/sai vẫn được thể hiện rõ bằng biểu tượng và chữ như phản hồi vốn có, không có hoạt ảnh trang trí; thành tựu vẫn được thông báo bằng một dòng thông báo tĩnh, ngắn gọn.
5. **Với** thiết bị hoặc trình duyệt của người học bật "giảm chuyển động", **Khi** hiệu ứng hình ảnh phát, **Thì** hoạt ảnh chuyển động được thay bằng dạng tĩnh hoặc chuyển mờ nhẹ, kể cả khi tùy chọn "Hiệu ứng hình ảnh" của họ đang bật.
6. **Với** người học đã đăng ký, **Khi** họ đổi thiết lập rồi đăng xuất và đăng nhập lại (kể cả ở thiết bị khác), **Thì** thiết lập được giữ nguyên.
7. **Với** khách đang dùng thử, **Khi** họ đổi thiết lập, **Thì** thiết lập chỉ áp dụng trong phiên dùng thử hiện tại và không được lưu thành dữ liệu định danh họ.

---

### Câu chuyện người dùng 4 - Động lực khi trả lời đúng liên tiếp (Ưu tiên: P3)

Khi người học trả lời đúng nhiều câu liên tiếp trong cùng một phiên học, phản hồi tăng dần mức hứng khởi (ví dụ lời khen ngắn kèm số câu đúng liên tiếp), và quay về mức thường khi họ trả lời sai.

**Lý do ưu tiên**: Tạo thêm nhịp độ và cảm giác "đang vào guồng" trong một phiên, nhưng không thiết yếu: Câu chuyện 1–3 đã đáp ứng yêu cầu cốt lõi.

**Kiểm thử độc lập**: Trong một bài học, trả lời đúng liên tiếp nhiều câu rồi trả lời sai một câu, và xác minh mức phản hồi tăng ở các ngưỡng, rồi trở lại mức thường sau câu sai.

**Kịch bản chấp nhận**:

1. **Với** một phiên học, **Khi** người học trả lời đúng liên tiếp đến các ngưỡng 3, 5 và 10 câu, **Thì** họ nhận phản hồi nổi bật hơn phản hồi của một câu đúng đơn lẻ, kèm số câu đúng liên tiếp.
2. **Với** chuỗi đúng liên tiếp đang chạy, **Khi** người học trả lời sai, **Thì** chuỗi về 0 mà không có phản hồi tiêu cực thêm nào ngoài phản hồi sai nhẹ nhàng thông thường.
3. **Với** người học thoát khỏi phiên học, **Khi** họ bắt đầu phiên mới, **Thì** chuỗi đúng liên tiếp bắt đầu lại từ 0; chuỗi này không được lưu và không phải là thành tựu.

---

### Các trường hợp biên

- Trình duyệt chặn tự phát âm thanh, âm lượng thiết bị bằng 0 hoặc tệp âm thanh không tải được → hiệu ứng hình ảnh vẫn hoạt động đầy đủ; không hiển thị lỗi cho người học.
- Câu trả lời đúng nhưng người học đã thử nhiều lần ở bài ghép cặp (ghép sai trước khi ghép đúng) → mỗi lần ghép sai nhận phản hồi sai nhẹ, lần ghép đúng nhận phản hồi đúng; "bài hoàn hảo" chỉ tính khi mọi câu đúng ngay lần đầu.
- Mất kết nối khi hoàn thành bài → lời chúc mừng thành tựu chỉ xuất hiện sau khi kết quả được ghi nhận thành công; hiệu ứng đúng/sai trong bài vẫn hoạt động vì không phụ thuộc kết nối.
- Người học đóng tab hoặc mất kết nối ngay khi vừa đạt thành tựu, không kịp thấy màn chúc mừng → thành tựu vẫn được ghi nhận nhưng không được chúc mừng bù ở các lần mở sau (không phát lại).
- Cùng một tài khoản mở ở hai cửa sổ cùng lúc và cả hai cùng đạt một mốc → thành tựu chỉ được ghi và chúc mừng một lần.
- Người học đã có sẵn tiến độ đáng kể trước khi tính năng ra mắt (ví dụ chuỗi 20 ngày) → các mốc họ đã vượt trước thời điểm ra mắt được ghi nhận âm thầm, không chúc mừng dồn dập; chỉ các mốc đạt sau thời điểm ra mắt mới được chúc mừng.
- Người học đổi mục tiêu hoặc dựng lại lộ trình khiến tiến độ mục tiêu nhảy qua nhiều mốc hoặc tụt dưới mốc đã đạt → mốc đã đạt được giữ nguyên; mốc vượt thêm chỉ vì thay đổi này được ghi âm thầm, không chúc mừng (FR-017a).
- Người học tạm dừng lộ trình rồi quay lại → chuỗi ngày và các mốc xử lý theo quy tắc chuỗi hiện có (tạm dừng không làm đứt chuỗi); không có chúc mừng nào phát sinh chỉ vì tạm dừng hoặc tiếp tục.
- Người học thuộc một lớp của tổ chức (spec 004) → nhận cùng hiệu ứng và thành tựu như học viên cá nhân; thành tựu không hiển thị cho giáo viên hay tổ chức trong phạm vi tính năng này.
- Hiệu ứng hình ảnh có chớp sáng → không được chớp quá 3 lần mỗi giây, để an toàn cho người nhạy cảm với ánh sáng nhấp nháy.
- Người học dùng trình đọc màn hình → kết quả đúng/sai và thành tựu được thông báo bằng văn bản cho công nghệ hỗ trợ; hiệu ứng trang trí không làm nhiễu việc đọc.
- Màn hình nhỏ hoặc cửa sổ hẹp → hiệu ứng và màn chúc mừng không che mất câu hỏi, đáp án hay nút thao tác chính, và không gây cuộn ngang.
- Khách dùng thử đạt "thành tựu" (ví dụ bài học mẫu hoàn hảo) → khách thấy hiệu ứng đúng/sai nhưng không có thành tựu nào được ghi nhận, vì khách chưa có tài khoản; thành tựu chỉ tính từ khi có tài khoản.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Phản hồi khi trả lời**

- **FR-001**: Hệ thống PHẢI hiển thị hiệu ứng hình ảnh phân biệt rõ đúng/sai ngay sau mỗi lần người học trả lời, ở mọi nơi ứng dụng vốn đã hiển thị phản hồi đúng/sai tức thì (bài học từ vựng, ngữ pháp, Kanji; bài ôn tập; bài học mẫu dùng thử).
- **FR-002**: Hệ thống PHẢI phát âm thanh ngắn phân biệt được đáp án đúng và đáp án sai khi tùy chọn âm thanh đang bật.
- **FR-003**: Phản hồi cho đáp án sai PHẢI nhẹ nhàng và khích lệ; KHÔNG ĐƯỢC dùng âm thanh, màu sắc hay chuyển động mang tính trừng phạt hoặc gây giật mình. Đáp án đúng và giải thích ngắn PHẢI vẫn hiển thị như trước.
- **FR-004**: Hiệu ứng KHÔNG ĐƯỢC chặn thao tác của người học: người học PHẢI sang được câu kế tiếp ngay mà không phải chờ hiệu ứng kết thúc, và hiệu ứng KHÔNG ĐƯỢC làm tăng thời lượng ước tính của bài học hay kế hoạch hằng ngày.
- **FR-005**: Hiệu ứng KHÔNG ĐƯỢC chồng chất khi người học trả lời dồn dập; hiệu ứng mới thay thế hiệu ứng đang chạy.
- **FR-006**: Hiệu ứng PHẢI nhất quán giữa các loại bài tập (trắc nghiệm, ghép cặp, điền vào chỗ trống) và các loại nội dung (từ vựng, ngữ pháp, Kanji).
- **FR-007**: Hệ thống KHÔNG ĐƯỢC hiển thị hiệu ứng đúng/sai ở nơi không có phản hồi đúng/sai theo từng câu (bài kiểm tra trình độ).
- **FR-008**: Kết quả đúng/sai KHÔNG ĐƯỢC chỉ truyền đạt bằng màu sắc hoặc âm thanh; PHẢI luôn có biểu tượng hoặc chữ đi kèm, và PHẢI được thông báo bằng văn bản cho công nghệ hỗ trợ.
- **FR-009**: Hiệu ứng KHÔNG ĐƯỢC ảnh hưởng đến cách chấm điểm, lịch ôn, độ khó hay kế hoạch của Learning Engine, và KHÔNG ĐƯỢC thưởng theo tốc độ trả lời (để không khuyến khích đoán nhanh).

**Thành tựu**

- **FR-010**: Hệ thống PHẢI có một danh mục thành tựu cố định, gồm tối thiểu các loại: (a) hoàn thành bài học đầu tiên; (b) chuỗi ngày học liên tiếp đạt các mốc; (c) tổng số mục đã học (từ vựng, ngữ pháp, Kanji) đạt các mốc; (d) tiến độ hướng tới mục tiêu đạt các mốc; (e) hoàn thành bài hoàn hảo (mọi câu đúng ngay lần đầu) lần đầu tiên. Hai thành tựu (a) và (e) CHỈ tính với bài học mới (từ vựng, ngữ pháp, Kanji); bài ôn tập KHÔNG kích hoạt chúng, nhưng vẫn đóng góp vào (b), (c), (d) theo cách tính tiến độ hiện có. Các mốc cụ thể mặc định nêu trong mục Giả định.
- **FR-011**: Hệ thống PHẢI phát hiện khi tiến độ đã được ghi nhận của người học vượt một mốc trong danh mục, ghi nhận thành tựu (kèm thời điểm đạt) và chúc mừng người học.
- **FR-012**: Mỗi thành tựu PHẢI được ghi nhận và chúc mừng tối đa một lần cho mỗi người học, bất kể tải lại trang, dùng nhiều cửa sổ, lặp lại hành động hay đăng nhập lại.
- **FR-013**: Màn chúc mừng thành tựu PHẢI có hiệu ứng hình ảnh nổi bật hơn hiệu ứng trả lời, có âm thanh riêng (khi âm thanh bật), nêu tên và mô tả thành tựu bằng ngôn ngữ giao diện của người học (tiếng Việt hoặc tiếng Anh), và đóng được bằng một thao tác; nếu không thao tác, màn tự đóng sau vài giây. Màn chúc mừng là lớp phủ KHÔNG chặn: người học vẫn dùng được ngay nút "Tiếp tục" và điều hướng bên dưới, và thao tác đó đóng màn chúc mừng; màn KHÔNG ĐƯỢC bắt người học phải đóng hoặc chờ trước khi thao tác tiếp (nhất quán với FR-004). Với công nghệ hỗ trợ, nội dung chúc mừng PHẢI được thông báo mà không cướp tiêu điểm thao tác.
- **FR-014**: Khi một hành động làm đạt nhiều thành tựu cùng lúc, hệ thống PHẢI hiển thị chúng trong một màn chúc mừng gộp, lần lượt từng thành tựu. Khi cùng lúc còn có lời chúc mừng hoàn thành ngày (FR-015), cả hai PHẢI nằm trong cùng một màn gộp duy nhất: lời chúc mừng hoàn thành ngày hiện trước, sau đó lần lượt các thành tựu; KHÔNG ĐƯỢC hiển thị hai màn chúc mừng riêng liên tiếp.
- **FR-015**: Hệ thống PHẢI chúc mừng người học khi hoàn thành mọi mục của kế hoạch hôm nay, tối đa một lần mỗi ngày, kể cả khi người học học thêm nội dung bổ sung sau đó. Lời chúc mừng này là hiệu ứng lặp hằng ngày, không phải thành tựu một lần.
- **FR-016**: Lời chúc mừng thành tựu và hoàn thành ngày CHỈ được hiển thị sau khi kết quả học tương ứng đã được ghi nhận thành công. Thành tựu được báo cho client đúng một lần, trong phản hồi của chính lần ghi nhận làm đạt mốc; nếu người học bỏ lỡ lúc đó (đóng tab, mất kết nối khi nhận phản hồi), hệ thống KHÔNG ĐƯỢC chúc mừng bù ở các lần mở ứng dụng sau (thành tựu vẫn được ghi nhận).
- **FR-017**: Với người học đã có tiến độ trước thời điểm ra mắt, hệ thống PHẢI ghi nhận âm thầm các mốc đã vượt (không chúc mừng) và chỉ chúc mừng các mốc đạt sau thời điểm ra mắt.
- **FR-017a**: Thành tựu đã đạt KHÔNG ĐƯỢC bị thu hồi, kể cả khi tiến độ tụt xuống dưới mốc sau này. Khi người học đổi mục tiêu hoặc dựng lại lộ trình làm tiến độ mục tiêu vượt thêm mốc, các mốc đó PHẢI được ghi âm thầm (không chúc mừng); chỉ tiến độ tăng nhờ kết quả học mới được chúc mừng.
- **FR-018**: Khách dùng thử KHÔNG ĐƯỢC có thành tựu được ghi nhận; khách vẫn nhận hiệu ứng trả lời đúng/sai.

**Tùy chỉnh và tiếp cận**

- **FR-019**: Người học PHẢI có hai tùy chọn độc lập, "Âm thanh" và "Hiệu ứng hình ảnh", mỗi tùy chọn bật/tắt được; mặc định cả hai bật. Khi hiệu ứng hình ảnh tắt, hệ thống vẫn PHẢI thông báo kết quả đúng/sai và thành tựu bằng dạng tĩnh, ngắn gọn.
- **FR-020**: Màn hình bài học PHẢI có nút tắt/bật nhanh âm thanh mà không cần rời bài.
- **FR-021**: Thiết lập của người học đã đăng ký PHẢI được lưu theo tài khoản và giữ nguyên qua các lần đăng nhập, kể cả trên thiết bị khác. Thiết lập của khách dùng thử chỉ áp dụng cho phiên hiện tại và KHÔNG ĐƯỢC lưu thành dữ liệu định danh.
- **FR-022**: Hệ thống PHẢI tôn trọng thiết lập "giảm chuyển động" của thiết bị hoặc trình duyệt: khi bật, hoạt ảnh chuyển động PHẢI được thay bằng dạng tĩnh hoặc chuyển mờ nhẹ.
- **FR-023**: Hiệu ứng hình ảnh KHÔNG ĐƯỢC chớp quá 3 lần mỗi giây; âm thanh PHẢI ngắn (mỗi tín hiệu trả lời không quá khoảng 1 giây), âm lượng vừa phải và đồng đều giữa các âm.
- **FR-024**: Khi không phát được âm thanh (bị trình duyệt chặn, thiết bị tắt tiếng, tệp lỗi), hệ thống PHẢI tiếp tục hiển thị hiệu ứng hình ảnh bình thường và KHÔNG ĐƯỢC hiển thị lỗi cho người học.
- **FR-025**: Âm thanh CHỈ được phát sau thao tác của người học (trả lời, đóng/mở màn chúc mừng do hành động của họ gây ra); KHÔNG ĐƯỢC tự phát khi vừa mở trang hay màn hình.
- **FR-026**: Hiệu ứng và màn chúc mừng KHÔNG ĐƯỢC che khuất câu hỏi, đáp án hoặc nút thao tác chính, và PHẢI hiển thị tốt trên màn hình nhỏ.

**Chuỗi trả lời đúng liên tiếp (Ưu tiên P3)**

- **FR-027**: Hệ thống NÊN theo dõi số câu trả lời đúng liên tiếp trong một phiên học và hiển thị phản hồi nổi bật hơn ở các ngưỡng 3, 5 và 10 câu kèm số câu liên tiếp; chuỗi về 0 khi trả lời sai hoặc khi bắt đầu phiên mới, và KHÔNG ĐƯỢC lưu hay tính là thành tựu.

### Thực thể chính

- **Mốc thành tựu (Achievement Definition)**: Một mốc trong danh mục cố định (ví dụ "chuỗi 7 ngày"). Có mã định danh, loại, ngưỡng và tên/mô tả bằng tiếng Việt và tiếng Anh.
- **Thành tựu đã đạt (Earned Achievement)**: Bản ghi cho biết một người học đã đạt một mốc, kèm thời điểm đạt và nguồn ghi nhận (đạt trong lúc học, hoặc ghi âm thầm khi ra mắt). Không có trạng thái "chưa chúc mừng" cần xử lý về sau: thành tựu chỉ được chúc mừng tại thời điểm đạt. Mỗi cặp (người học, mốc) có tối đa một bản ghi.
- **Tùy chọn hiệu ứng (Effects Preference)**: Thiết lập của người học gồm bật/tắt âm thanh và bật/tắt hiệu ứng hình ảnh; thuộc hồ sơ của người học đã đăng ký.
- **Chuỗi đúng liên tiếp trong phiên**: Bộ đếm tạm thời trong một phiên học, không lưu (Câu chuyện 4).

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: Trong kiểm thử trên mọi loại bài tập và loại nội dung ở bài học, ôn tập và dùng thử, 100% lần trả lời hiển thị hiệu ứng đúng/sai trong vòng 0,2 giây sau thao tác, và người học nhận ra kết quả (đúng hay sai) mà không cần nhìn riêng vào màu sắc.
- **SC-002**: Hiệu ứng không làm tăng thời gian hoàn thành một kế hoạch hằng ngày điển hình quá 3% so với trước khi có tính năng, và thời lượng bài học vẫn nằm trong 5–15 phút.
- **SC-003**: Trong kiểm thử lặp lại (tải lại, hai cửa sổ cùng lúc, lặp lại hành động), 100% thành tựu chỉ được chúc mừng đúng một lần cho mỗi người học; không có thành tựu nào bị bỏ sót khi tiến độ đã được ghi nhận vượt mốc.
- **SC-004**: Khi tắt âm thanh, tắt hiệu ứng hình ảnh hoặc bật "giảm chuyển động", 100% kết quả đúng/sai và thành tựu vẫn được truyền đạt đầy đủ, không có tiếng hoặc chuyển động ngoài thiết lập; thiết lập được giữ sau khi đăng nhập lại ở 100% trường hợp thử.
- **SC-005**: Người học tìm và đổi được thiết lập âm thanh/hiệu ứng trong không quá 10 giây, và tắt tiếng được ngay trong bài học bằng một thao tác.
- **SC-006**: Ít nhất 70% người học được khảo sát sau hai tuần sử dụng cho biết hiệu ứng khiến việc học thú vị hơn, và dưới 20% người học tắt cả hai loại hiệu ứng.
- **SC-007**: Tỷ lệ người học quay lại học vào ngày kế tiếp sau một ngày hoàn thành kế hoạch tăng ít nhất 5 điểm phần trăm so với giai đoạn ngay trước khi ra mắt tính năng.

## Giả định

- Hiệu ứng áp dụng ở mọi nơi ứng dụng vốn đã hiển thị phản hồi đúng/sai tức thì; không thêm phản hồi đúng/sai mới ở nơi chưa có (bài kiểm tra trình độ giữ nguyên, không lộ đáp án).
- Danh mục thành tựu mặc định (có thể điều chỉnh về sau mà không đổi hành vi tính năng): chuỗi ngày học đạt 3, 7, 14, 30, 60, 100 ngày; tổng số mục đã học đạt 50, 100, 250, 500; tiến độ mục tiêu đạt 25%, 50%, 75%, 100%; cùng hai thành tựu một lần là "bài học đầu tiên" và "bài hoàn hảo đầu tiên".
- Chuỗi ngày, tổng số mục đã học và tiến độ mục tiêu dùng đúng cách tính đã có ở phần theo dõi tiến độ; tính năng này không đổi cách tính các số liệu đó.
- Âm thanh là một bộ nhỏ các tín hiệu ngắn (đúng, sai, thành tựu, hoàn thành ngày, chuỗi đúng) do đội dự án chuẩn bị hoặc có giấy phép sử dụng; nội dung âm thanh và đồ họa cụ thể thuộc phần thiết kế, không thuộc đặc tả này.
- Các tùy chọn mặc định đều bật, vì mục tiêu của tính năng là tạo hứng thú; người học tắt được bất cứ lúc nào.
- Ngoài phạm vi: bộ sưu tập hay màn hình xem lại các thành tựu đã đạt, bảng xếp hạng, so sánh giữa người học, điểm thưởng hay vật phẩm quy đổi, chia sẻ thành tựu ra mạng xã hội, thông báo nhắc học, rung trên thiết bị di động và hiển thị thành tựu cho giáo viên hoặc tổ chức.
- Tính năng chạy trên Web ở Giai đoạn 1; mọi hành vi riêng của nền tảng PHẢI nằm sau lớp trừu tượng để thêm Android/iOS sau này mà không xây lại (Nguyên tắc V).
- Học viên thuộc lớp của tổ chức (spec 004) nhận cùng hiệu ứng như người học cá nhân; thiết lập hiệu ứng là tùy chọn trải nghiệm, không thuộc nhóm lựa chọn lộ trình bị khóa khi thuộc lớp.
