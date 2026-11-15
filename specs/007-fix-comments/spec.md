# Đặc tả tính năng: Hoàn thiện trải nghiệm học theo góp ý (xem mật khẩu, luyện đọc/viết, màu năng lực, mặc định theo thời gian, lời khích lệ)

**Nhánh tính năng**: `007-fix-comments` (tên thư mục; chưa tạo nhánh git)

**Ngày tạo**: 2026-11-12

**Trạng thái**: Bản nháp; đã làm rõ (xem mục "Làm rõ"); sẵn sàng cho `/speckit-clarify` hoặc `/speckit-plan`

**Giai đoạn**: Giai đoạn 1 – MVP (cải tiến trải nghiệm trên ứng dụng Web). Riêng việc thêm **luyện đọc** và **luyện viết** chạm tới phạm vi của Giai đoạn 2 (hiến pháp xếp "luyện nghe và đọc" vào Giai đoạn 2; luyện viết ở đây là gõ bàn phím, không phải luyện viết tay Kanji vốn nằm ngoài Giai đoạn 1) – xem mục "Phụ thuộc và điều kiện về hiến pháp".

**Đầu vào**: Mô tả của người dùng: "Thêm spec để implement `specs\007-fix-comments\comment.txt`". Nội dung file góp ý gồm 5 điểm:

1. Khi đăng nhập, cho phép tùy chọn xem mật khẩu đã nhập.
2. Bổ sung 2 tính năng luyện đọc và luyện viết, chỉ dành cho người có thời gian từ 30 phút mỗi ngày trở lên.
3. Bố cục lại màu sắc cho các đầu mục học tập theo năng lực cá nhân: xanh lục = năng lực tốt; vàng nhạt = năng lực cần/ưu tiên cải thiện.
4. Dựa vào thời gian dành được mỗi ngày, đưa ra tùy chọn mặc định cho người học.
5. Thêm câu khích lệ, khuyến khích người học ở màn hình "Hôm nay" tùy theo tiến độ học tập, mang thông điệp tích cực.

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (1) người học bắt đầu học được mà không cần tự xây dựng kế hoạch – điểm 4; (2) bài học hằng ngày vừa trong quỹ thời gian đã khai báo – điểm 2 và 4; (4) phát hiện điểm yếu và gợi ý cải thiện – điểm 3; (5) theo dõi được tiến độ và mức đạt mục tiêu – điểm 3 và 5.

## Ánh xạ góp ý → câu chuyện người dùng

| Điểm góp ý | Câu chuyện người dùng |
| ---------- | --------------------- |
| 1. Xem mật khẩu khi đăng nhập | US5 |
| 2. Luyện đọc và luyện viết cho người học ≥ 30 phút/ngày | US2 |
| 3. Màu sắc đầu mục học tập theo năng lực | US3 |
| 4. Tùy chọn mặc định theo thời gian mỗi ngày | US1 |
| 5. Câu khích lệ ở màn hình "Hôm nay" | US4 |

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Tùy chọn mặc định theo thời gian học mỗi ngày (Ưu tiên: P1)

Người học vừa khai báo "tôi có N phút mỗi ngày" (5, 10, 15 hoặc 30). Thay vì bắt họ tự cân nhắc từng lựa chọn còn lại, hệ thống tự đề xuất sẵn một bộ lựa chọn mặc định phù hợp với quỹ thời gian đó (ví dụ: những kỹ năng nên học, có bật luyện đọc/luyện viết hay không). Người học thấy rõ đây là gợi ý, nhận ngay và bắt đầu học, hoặc đổi từng lựa chọn nếu muốn.

**Vì sao ưu tiên này**: Người dùng mục tiêu là nhân viên văn phòng ít thời gian; bắt họ tự dựng cấu hình là rào cản vào học. Mặc định đúng làm tiêu chí "bắt đầu học mà không cần tự xây dựng kế hoạch" thành hiện thực, đồng thời là nền cho US2 (chỉ bật luyện đọc/viết khi đủ thời gian).

**Kiểm thử độc lập**: Đi qua luồng thiết lập ban đầu với từng mức thời gian (5, 10, 15, 30 phút), quan sát bộ lựa chọn mặc định xuất hiện, hoàn tất mà không đổi gì, rồi mở lại bằng cách đổi sang một mức thời gian khác.

**Kịch bản chấp nhận**:

1. **Cho trước** người học đang ở bước thiết lập ban đầu, **Khi** chọn một mức thời gian mỗi ngày, **Thì** các lựa chọn liên quan (kỹ năng muốn học và luyện đọc/luyện viết) được điền sẵn theo mức thời gian đó và có nhãn nêu rõ đây là "gợi ý theo thời gian bạn có".
2. **Cho trước** các lựa chọn mặc định đã được điền sẵn, **Khi** người học đổi bất kỳ lựa chọn nào hoặc bỏ chọn, **Thì** hệ thống giữ đúng lựa chọn của người học và không tự ghi đè lại khi họ tiếp tục.
3. **Cho trước** người học chọn mức thời gian dưới 30 phút, **Khi** xem bộ mặc định, **Thì** luyện đọc/luyện viết không được đề xuất bật (và không xuất hiện như lựa chọn dùng được – xem US2).
4. **Cho trước** người học đã có lộ trình và đổi quỹ thời gian mỗi ngày trong hồ sơ, **Khi** lưu mức thời gian mới, **Thì** hệ thống đề xuất bộ mặc định mới tương ứng nhưng KHÔNG tự thay đổi lựa chọn đã lưu cho tới khi người học đồng ý.
5. **Cho trước** mức thời gian càng lớn, **Khi** so sánh các bộ mặc định, **Thì** bộ mặc định không bao giờ yêu cầu khối lượng học vượt quỹ thời gian đã chọn.

---

### Câu chuyện người dùng 2 - Luyện đọc và luyện viết cho người học từ 30 phút mỗi ngày (Ưu tiên: P1)

Người học có quỹ thời gian từ 30 phút mỗi ngày trở lên có thêm hai kiểu luyện tập: **luyện đọc** (đọc đoạn văn ngắn tiếng Nhật và trả lời câu hỏi kiểm tra mức hiểu) và **luyện viết** (gõ bàn phím để viết lại từ, chữ Kanji hoặc câu tiếng Nhật theo gợi ý và được chấm kết quả; không gồm viết tay hay nhận dạng nét). Hai kiểu luyện tập này nằm trong **kế hoạch hằng ngày** của người học và được tính vào quỹ 30 phút của họ. Người học có thời gian ngắn hơn không có hai mục này trong kế hoạch, nhưng biết vì sao và cần làm gì để có (tăng thời gian mỗi ngày).

**Vì sao ưu tiên này**: Đây là phần mở rộng nội dung lớn nhất trong góp ý, khai thác trọn quỹ 30 phút (Nguyên tắc IV: học qua thực hành – đọc, viết). Giới hạn theo thời gian giữ cho người ít thời gian không bị quá tải (Nguyên tắc I).

**Kiểm thử độc lập**: Tạo hai học viên – một khai báo 15 phút, một khai báo 30 phút – và kiểm tra mục luyện đọc/viết hiển thị, mở được và chấm được ở người thứ hai, bị khóa kèm lời giải thích ở người thứ nhất; rồi đổi quỹ thời gian của người thứ nhất lên 30 phút.

**Kịch bản chấp nhận**:

1. **Cho trước** học viên có quỹ thời gian mỗi ngày là 30 phút và đã bật luyện đọc/viết, **Khi** mở màn hình "Hôm nay", **Thì** kế hoạch ngày có các mục "Luyện đọc" và "Luyện viết" xen cùng bài khác, mở được từng mục, và tổng thời lượng ước tính không vượt 30 phút.
2. **Cho trước** học viên có quỹ thời gian dưới 30 phút (5, 10 hoặc 15), **Khi** xem kế hoạch ngày và nơi bật/tắt luyện đọc/viết, **Thì** kế hoạch không chứa hai mục này; mục bật/tắt bị khóa kèm thông báo rõ ràng "dành cho người học từ 30 phút mỗi ngày" và cách đổi thời gian trong hồ sơ.
3. **Cho trước** học viên mở một phiên luyện đọc, **Khi** đọc xong đoạn văn và trả lời các câu hỏi, **Thì** thấy kết quả đúng/sai từng câu cùng giải thích, và kết quả được ghi vào tiến độ học tập.
4. **Cho trước** học viên mở một phiên luyện viết, **Khi** nộp phần viết của mình, **Thì** nhận được kết quả đúng/sai cùng đáp án tham chiếu, và kết quả được ghi vào tiến độ học tập.
5. **Cho trước** học viên 30 phút đổi quỹ thời gian xuống dưới 30, **Khi** kế hoạch ngày được lập lại, **Thì** luyện đọc/viết không còn trong kế hoạch và bị khóa, nhưng lịch sử kết quả đã có vẫn xem được trong tiến độ.
6. **Cho trước** mỗi phiên luyện đọc/viết, **Khi** hoàn thành, **Thì** thời lượng phiên nằm trong khoảng 5–15 phút (Nguyên tắc I).
7. **Cho trước** học viên 30 phút tắt luyện đọc/viết trong lựa chọn của mình, **Khi** kế hoạch ngày được lập, **Thì** kế hoạch không chứa hai mục này và dùng đủ quỹ thời gian cho nội dung khác.

---

### Câu chuyện người dùng 3 - Màu sắc đầu mục học tập theo năng lực cá nhân (Ưu tiên: P2)

Các đầu mục học tập (từ vựng, ngữ pháp, Kanji và – với người đủ điều kiện – đọc, viết) được tô màu theo năng lực của chính người học: **xanh lục** cho mảng đang tốt, **vàng nhạt** cho mảng cần/ưu tiên cải thiện. Chỉ nhìn lướt, người học biết nên tập trung vào đâu.

**Vì sao ưu tiên này**: Hỗ trợ tiêu chí "phát hiện điểm yếu và gợi ý cải thiện". Màu là tín hiệu nhận biết tức thì, bổ sung cho danh sách "mảng làm kém" dạng chữ hiện có.

**Kiểm thử độc lập**: Dùng các hồ sơ học viên có kết quả khác nhau (mạnh từ vựng – yếu Kanji, và ngược lại, và người chưa có dữ liệu) rồi kiểm tra màu của từng đầu mục khớp với năng lực.

**Kịch bản chấp nhận**:

1. **Cho trước** học viên có kết quả tốt ở một đầu mục, **Khi** xem các màn hình có đầu mục đó (Hôm nay, lộ trình, tiến độ), **Thì** đầu mục hiển thị màu xanh lục.
2. **Cho trước** học viên có kết quả chưa tốt ở một đầu mục (cần/ưu tiên cải thiện), **Khi** xem cùng các màn hình đó, **Thì** đầu mục hiển thị màu vàng nhạt.
3. **Cho trước** học viên chưa có đủ dữ liệu cho một đầu mục, **Khi** xem đầu mục đó, **Thì** hiển thị màu trung tính (không xanh, không vàng) kèm chú thích "chưa đủ dữ liệu", không đánh giá oan.
4. **Cho trước** năng lực của học viên thay đổi sau khi học/ôn tập, **Khi** quay lại màn hình, **Thì** màu của đầu mục cập nhật tương ứng.
5. **Cho trước** người dùng không phân biệt được màu, **Khi** xem đầu mục, **Thì** vẫn nhận biết được mức năng lực nhờ nhãn chữ hoặc biểu tượng đi kèm; màu không phải kênh duy nhất truyền thông tin.
6. **Cho trước** học viên có mảng ưu tiên cải thiện, **Khi** xem màn hình có màu năng lực, **Thì** có chú giải ngắn giải thích ý nghĩa của từng màu.

---

### Câu chuyện người dùng 4 - Lời khích lệ ở màn hình "Hôm nay" (Ưu tiên: P2)

Ở màn hình "Hôm nay", người học thấy một câu khích lệ tích cực phù hợp với tiến độ lúc đó: chưa bắt đầu, đang học dở, đã hoàn thành ngày, đang giữ chuỗi ngày, hay quay lại sau vài ngày nghỉ. Mục đích là tạo cảm giác được ghi nhận và muốn học tiếp, không tạo áp lực hay cảm giác có lỗi.

**Vì sao ưu tiên này**: Hỗ trợ thói quen học mỗi ngày (Nguyên tắc IV) và duy trì động lực của người ít thời gian.

**Kiểm thử độc lập**: Dùng các hồ sơ học viên ở những trạng thái tiến độ khác nhau, mở màn hình "Hôm nay" và kiểm tra thông điệp hiển thị đúng ngữ cảnh và luôn mang sắc thái tích cực.

**Kịch bản chấp nhận**:

1. **Cho trước** học viên chưa học mục nào trong ngày, **Khi** mở "Hôm nay", **Thì** thấy câu mời bắt đầu nhẹ nhàng, khích lệ.
2. **Cho trước** học viên đã hoàn thành một phần kế hoạch ngày, **Khi** mở "Hôm nay", **Thì** thấy câu ghi nhận phần đã làm và khuyến khích hoàn thành phần còn lại.
3. **Cho trước** học viên đã hoàn thành kế hoạch ngày, **Khi** mở "Hôm nay", **Thì** thấy câu chúc mừng, ghi nhận nỗ lực.
4. **Cho trước** học viên đang có chuỗi ngày học liên tiếp, **Khi** mở "Hôm nay", **Thì** thông điệp nhắc tới chuỗi ngày theo hướng ghi nhận.
5. **Cho trước** học viên quay lại sau một thời gian gián đoạn, **Khi** mở "Hôm nay", **Thì** thông điệp chào đón quay lại, không nhắc tới việc đã bỏ lỡ hay bị chậm theo cách trách móc.
6. **Cho trước** học viên đang chậm so với mốc mục tiêu, **Khi** mở "Hôm nay", **Thì** thông điệp vẫn tích cực và tập trung vào bước tiếp theo, không dùng từ ngữ tiêu cực hay so sánh với người khác.
7. **Cho trước** ngôn ngữ giao diện của người học (tiếng Việt hoặc tiếng Anh), **Khi** hiển thị thông điệp, **Thì** thông điệp dùng đúng ngôn ngữ đó.
8. **Cho trước** học viên mở "Hôm nay" nhiều lần trong nhiều ngày ở cùng một trạng thái tiến độ, **Khi** so sánh các thông điệp, **Thì** có sự đa dạng, không lặp lại cùng một câu mọi lần.

---

### Câu chuyện người dùng 5 - Xem mật khẩu đã nhập khi đăng nhập (Ưu tiên: P3)

Trên màn hình đăng nhập, người dùng có thể bật/tắt hiển thị mật khẩu đang gõ để kiểm tra không gõ nhầm. Mặc định mật khẩu luôn được che.

**Vì sao ưu tiên này**: Giảm lỗi đăng nhập do gõ sai, đặc biệt với mật khẩu dài. Việc nhỏ, độc lập, rủi ro thấp.

**Kiểm thử độc lập**: Mở màn hình đăng nhập, gõ mật khẩu, bật rồi tắt tùy chọn xem và quan sát.

**Kịch bản chấp nhận**:

1. **Cho trước** màn hình đăng nhập vừa mở, **Khi** người dùng gõ mật khẩu, **Thì** mật khẩu được che theo mặc định.
2. **Cho trước** đã gõ mật khẩu, **Khi** người dùng bật tùy chọn xem mật khẩu, **Thì** nội dung đã gõ hiển thị rõ; **Khi** tắt tùy chọn, **Thì** mật khẩu được che lại và nội dung đã gõ không bị mất.
3. **Cho trước** người dùng chuyển sang màn hình khác rồi quay lại đăng nhập, **Khi** màn hình hiện lại, **Thì** mật khẩu trở về trạng thái che.
4. **Cho trước** người dùng dùng bàn phím hoặc trình đọc màn hình, **Khi** thao tác với tùy chọn xem mật khẩu, **Thì** điều khiển có thể thao tác bằng bàn phím và có nhãn mô tả rõ trạng thái hiện tại ("hiện mật khẩu" / "ẩn mật khẩu").

---

### Các tình huống biên

- Học viên khai báo 30 phút nhưng thuộc lớp của tổ chức: quỹ thời gian dùng để xét điều kiện luyện đọc/viết là quỹ thời gian đang áp dụng cho học viên đó (kể cả khi giáo viên đã điều chỉnh), và các lựa chọn bị khóa theo lớp vẫn bị khóa.
- Học viên vừa tăng quỹ thời gian lên 30 phút: luyện đọc/viết được đề xuất bật (US1), vào kế hoạch từ lần lập kế hoạch kế tiếp, chưa có lịch sử; màu năng lực ở hai mục này là trung tính "chưa đủ dữ liệu" cho tới khi có kết quả.
- Học viên học thử (chưa có tài khoản) và học viên chưa hoàn tất thiết lập: không thấy luyện đọc/viết, không bị gợi ý mặc định cho tới khi khai báo thời gian.
- Chưa có đủ nội dung đọc/viết phù hợp trình độ của học viên: hiển thị thông báo thân thiện, không để màn hình trống hoặc lỗi.
- Một đầu mục có đúng ngưỡng giữa "tốt" và "cần cải thiện": quy tắc phân loại phải xác định (không đồng thời hai màu).
- Học viên chọn tắt hiệu ứng/âm thanh (spec 005) hoặc dùng ngôn ngữ khác: lời khích lệ vẫn hiển thị, chỉ thay đổi ngôn ngữ.
- Đăng nhập sai mật khẩu khi đang bật chế độ xem: thông báo lỗi không chứa mật khẩu; mật khẩu hiển thị chỉ trong ô nhập.
- Màn hình hẹp (cửa sổ trình duyệt thu nhỏ): tùy chọn xem mật khẩu, màu năng lực và lời khích lệ vẫn đọc được, không che mất nội dung khác.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Xem mật khẩu khi đăng nhập (US5)**

- **FR-001**: Màn hình đăng nhập PHẢI có điều khiển cho phép người dùng chọn hiện hoặc ẩn mật khẩu đang nhập.
- **FR-002**: Mật khẩu PHẢI được che theo mặc định mỗi lần màn hình đăng nhập được mở.
- **FR-003**: Việc bật/tắt hiển thị KHÔNG ĐƯỢC làm mất hoặc đổi nội dung đã nhập, và KHÔNG ĐƯỢC lưu trạng thái "đang hiện" sang lần mở sau.
- **FR-004**: Điều khiển hiện/ẩn mật khẩu PHẢI thao tác được bằng bàn phím và có nhãn mô tả trạng thái cho công nghệ hỗ trợ.

**Luyện đọc và luyện viết (US2)**

- **FR-005**: Hệ thống PHẢI cung cấp hai loại bài mới, "Luyện đọc" và "Luyện viết", mỗi loại có phiên riêng, thời lượng mỗi phiên 5–15 phút.
- **FR-006**: Luyện đọc/viết CHỈ được dùng bởi học viên có quỹ thời gian mỗi ngày đang áp dụng từ 30 phút trở lên; điều kiện PHẢI được kiểm tra ở phía máy chủ chứ không chỉ ẩn trên giao diện.
- **FR-007**: Với học viên chưa đủ điều kiện, hệ thống PHẢI hiển thị mục bị khóa kèm lý do ("dành cho người học từ 30 phút mỗi ngày") và hướng dẫn cách thay đổi quỹ thời gian.
- **FR-008**: Mỗi phiên luyện đọc PHẢI trình bày nội dung tiếng Nhật phù hợp trình độ học viên và chấm các câu hỏi kiểm tra mức hiểu, trả về kết quả đúng/sai kèm giải thích.
- **FR-009**: Mỗi phiên luyện viết PHẢI yêu cầu học viên gõ bàn phím nội dung tiếng Nhật (từ, chữ Kanji hoặc câu) theo gợi ý như nghĩa hoặc cách đọc, và chấm đúng/sai kèm đáp án tham chiếu. Viết tay, nhận dạng nét và thứ tự nét KHÔNG thuộc phạm vi.
- **FR-010**: Kết quả luyện đọc/viết PHẢI được ghi vào tiến độ học tập (thời gian, số câu đúng/sai) để dùng cho màu năng lực (FR-017) và theo dõi tiến độ.
- **FR-011**: Khi học viên không còn đủ điều kiện, hệ thống PHẢI khóa lại luyện đọc/viết nhưng PHẢI giữ lịch sử kết quả đã ghi.
- **FR-012**: Nội dung luyện đọc/viết PHẢI là dữ liệu nội dung quản lý được độc lập với mã ứng dụng, thuộc diện quản trị nội dung hiện có (Nguyên tắc VI).
- **FR-013**: Với học viên đủ điều kiện và đang bật, luyện đọc/viết PHẢI được Learning Engine đưa vào kế hoạch hằng ngày và được tính vào quỹ thời gian đã khai báo; kế hoạch KHÔNG ĐƯỢC vượt quỹ đó (Nguyên tắc I). Học viên PHẢI tắt/bật lại được hai mục này (Nguyên tắc III).

**Màu sắc đầu mục theo năng lực (US3)**

- **FR-014**: Mỗi đầu mục học tập (từ vựng, ngữ pháp, Kanji và – khi đủ điều kiện – đọc, viết) PHẢI hiển thị màu **xanh lục** khi năng lực của học viên ở đầu mục đó được đánh giá là tốt.
- **FR-015**: Đầu mục có năng lực cần/ưu tiên cải thiện PHẢI hiển thị màu **vàng nhạt**.
- **FR-016**: Đầu mục chưa đủ dữ liệu để đánh giá PHẢI hiển thị màu trung tính kèm chú thích "chưa đủ dữ liệu"; KHÔNG ĐƯỢC gán xanh hoặc vàng.
- **FR-017**: Năng lực của từng đầu mục PHẢI được xác định từ kết quả học tập đã ghi của chính học viên (độ chính xác khi học và ôn, bao gồm kết quả luyện đọc/viết), theo một quy tắc phân loại thống nhất, xác định và có thể kiểm thử với hồ sơ mẫu.
- **FR-018**: Màu PHẢI nhất quán ở mọi màn hình có hiển thị đầu mục học tập (tối thiểu: Hôm nay, lộ trình, tiến độ) và PHẢI cập nhật khi năng lực thay đổi.
- **FR-019**: Màu KHÔNG ĐƯỢC là kênh duy nhất truyền thông tin: mỗi đầu mục PHẢI có nhãn chữ hoặc biểu tượng đi kèm; độ tương phản giữa chữ và nền màu PHẢI đủ đọc ở cả hai màu.
- **FR-020**: Hệ thống PHẢI có chú giải ngắn nêu ý nghĩa của màu xanh lục, vàng nhạt và trung tính ở nơi màu được dùng.

**Tùy chọn mặc định theo thời gian mỗi ngày (US1)**

- **FR-021**: Khi học viên chọn hoặc đổi quỹ thời gian mỗi ngày, hệ thống PHẢI đề xuất sẵn một bộ lựa chọn mặc định (tối thiểu: kỹ năng nên học; bật hay không luyện đọc/viết) tương ứng quỹ thời gian đó.
- **FR-022**: Bộ mặc định PHẢI tăng dần theo quỹ thời gian và không bao giờ đòi hỏi khối lượng vượt quỹ đã chọn; luyện đọc/viết CHỈ nằm trong bộ mặc định của mức 30 phút (xem Giả định về bảng gợi ý).
- **FR-023**: Hệ thống PHẢI ghi rõ cho người học đây là gợi ý theo thời gian họ có, và học viên PHẢI đổi hoặc bỏ được từng lựa chọn (Nguyên tắc III).
- **FR-024**: Khi học viên đã có lựa chọn riêng, việc đổi quỹ thời gian sau này KHÔNG ĐƯỢC âm thầm ghi đè lựa chọn đã lưu; hệ thống chỉ đề xuất bộ mặc định mới và chờ người học đồng ý.
- **FR-025**: Với học viên thuộc lớp của tổ chức, các lựa chọn bị lớp khóa KHÔNG ĐƯỢC bị bộ mặc định thay đổi.

**Lời khích lệ ở màn hình "Hôm nay" (US4)**

- **FR-026**: Màn hình "Hôm nay" PHẢI hiển thị một câu khích lệ phù hợp với tiến độ hiện tại, tối thiểu phân biệt các trạng thái: chưa bắt đầu trong ngày, đang học dở, đã hoàn thành ngày, đang có chuỗi ngày học liên tiếp, quay lại sau gián đoạn, và đang chậm so với mốc mục tiêu.
- **FR-027**: Mọi câu khích lệ PHẢI mang sắc thái tích cực; KHÔNG ĐƯỢC chứa từ ngữ đổ lỗi, đe dọa mất chuỗi, so sánh với người học khác hoặc nhấn mạnh thất bại.
- **FR-028**: Câu khích lệ PHẢI dùng ngôn ngữ giao diện của học viên (tiếng Việt hoặc tiếng Anh).
- **FR-029**: Với mỗi trạng thái, hệ thống PHẢI có nhiều biến thể câu để hạn chế lặp lại cùng một câu ở các lần xem liên tiếp.
- **FR-030**: Câu khích lệ KHÔNG ĐƯỢC che hoặc thay thế thông tin chính của màn hình "Hôm nay" (danh sách bài, tổng thời lượng) và KHÔNG ĐƯỢC nhân đôi nội dung với hiệu ứng chúc mừng đã có (spec 005).
- **FR-031**: Việc chọn câu theo tiến độ PHẢI dựa trên dữ liệu tiến độ đã ghi của học viên và có thể kiểm thử với hồ sơ mẫu.

### Thực thể chính *(thêm khi tính năng liên quan dữ liệu)*

- **Quỹ thời gian mỗi ngày**: mức thời gian học viên dành mỗi ngày (5/10/15/30 phút); là điều kiện mở luyện đọc/viết và là cơ sở chọn bộ mặc định.
- **Bộ lựa chọn mặc định (gợi ý)**: tập lựa chọn đề xuất tương ứng với từng mức thời gian; không phải lựa chọn đã lưu của học viên cho tới khi họ chấp nhận.
- **Phiên luyện đọc**: một lượt đọc đoạn văn và trả lời câu hỏi; có thời lượng, kết quả từng câu, trình độ.
- **Phiên luyện viết**: một lượt người học gõ nội dung tiếng Nhật theo gợi ý; có thời lượng, nội dung nộp, kết quả chấm.
- **Nội dung luyện đọc/viết**: đoạn văn, câu hỏi, gợi ý và đáp án tham chiếu; thuộc kho nội dung, gắn trình độ.
- **Mức năng lực đầu mục**: kết quả phân loại (tốt / cần cải thiện / chưa đủ dữ liệu) của từng đầu mục học tập đối với một học viên; suy ra từ kết quả học tập đã ghi.
- **Thông điệp khích lệ**: câu theo trạng thái tiến độ và ngôn ngữ, có nhiều biến thể cho mỗi trạng thái.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo được

- **SC-001**: 100% học viên chọn mức thời gian khi thiết lập thấy bộ lựa chọn mặc định phù hợp xuất hiện ngay, và ít nhất 90% học viên mới hoàn tất thiết lập mà không cần đổi lựa chọn mặc định nào ngoài mức thời gian.
- **SC-002**: Học viên mới đi từ lúc khai báo thời gian đến lúc thấy kế hoạch học đầu tiên trong dưới 3 phút khi chấp nhận toàn bộ lựa chọn mặc định.
- **SC-003**: 100% học viên có quỹ thời gian dưới 30 phút KHÔNG thể mở hoặc nộp kết quả luyện đọc/viết (kể cả khi thao tác trực tiếp qua giao diện lập trình), và 100% học viên từ 30 phút trở lên mở được cả hai mục.
- **SC-004**: Học viên đủ điều kiện hoàn thành một phiên luyện đọc hoặc luyện viết trong 5–15 phút và thấy kết quả chấm ngay khi nộp; 100% kế hoạch ngày của học viên 30 phút có luyện đọc/viết không vượt 30 phút.
- **SC-005**: Với bộ hồ sơ học viên mẫu bao phủ ba mức năng lực, 100% đầu mục được tô đúng màu (xanh lục / vàng nhạt / trung tính) theo quy tắc phân loại, và màu giống nhau ở mọi màn hình.
- **SC-006**: Trong kiểm tra khả dụng, ít nhất 90% người tham gia nêu đúng mảng nào cần ưu tiên cải thiện chỉ sau một lần nhìn màn hình trong 10 giây, kể cả người không phân biệt được màu nhờ nhãn đi kèm.
- **SC-007**: 100% thông điệp khích lệ trong bộ nội dung vượt qua rà soát "sắc thái tích cực" (không đổ lỗi, đe dọa, so sánh); mỗi trạng thái tiến độ có ít nhất 3 biến thể.
- **SC-008**: Trong 5 lần mở "Hôm nay" liên tiếp ở cùng một trạng thái tiến độ, người học thấy ít nhất 2 câu khích lệ khác nhau.
- **SC-009**: Tỷ lệ đăng nhập thất bại do gõ sai mật khẩu giảm so với trước khi có tùy chọn xem mật khẩu; 100% người dùng tìm và bật được tùy chọn xem mật khẩu trong một thao tác.

## Giả định

- Ứng dụng Web hiện có (đăng nhập, thiết lập ban đầu, "Hôm nay", lộ trình, tiến độ, hồ sơ, lớp học) được giữ nguyên và chỉ được mở rộng; danh sách mức thời gian 5/10/15/30 phút không đổi.
- "Từ 30 phút mỗi ngày trở lên" nghĩa là quỹ thời gian đang áp dụng ≥ 30 phút; hiện mức cao nhất là 30 phút nên điều kiện tương đương đúng mức 30 phút.
- "Đầu mục học tập" là các kỹ năng/mảng học mà hệ thống đã có (từ vựng, ngữ pháp, Kanji) cộng hai mảng mới (đọc, viết); màu cũng áp dụng cho chủ đề (topic) khi chúng được hiển thị dưới dạng đầu mục.
- Bảng gợi ý mặc định theo thời gian (có thể tinh chỉnh khi lập kế hoạch): 5 phút → 1 kỹ năng (từ vựng); 10 phút → từ vựng và ngữ pháp; 15 phút → từ vựng, ngữ pháp và Kanji; 30 phút → từ vựng, ngữ pháp, Kanji và bật luyện đọc, luyện viết. Học viên luôn đổi được.
- Quy tắc phân loại năng lực dựa trên độ chính xác ghi nhận được với một lượng dữ liệu tối thiểu; ngưỡng cụ thể được chọn khi lập kế hoạch, thống nhất với tiêu chí "mảng làm kém" hiện có để màu vàng và danh sách mảng yếu không mâu thuẫn nhau.
- Đây là các cải tiến ở phía học viên; luồng quản trị nội dung chỉ cần thêm khả năng nhập nội dung đọc/viết, không thay đổi quyền của các vai trò khác.
- Lời khích lệ là nội dung biên soạn sẵn, đa dạng, chọn theo trạng thái tiến độ; chưa sinh bằng AI (AI Tutor thuộc Giai đoạn 4).
- Màn hình đăng nhập chỉ cần điều khiển xem mật khẩu; đăng ký và đặt lại mật khẩu NÊN dùng cùng điều khiển cho nhất quán nhưng không bắt buộc ở bản này.
- Hiệu ứng chúc mừng và phản hồi đúng/sai của spec 005 được giữ nguyên; lời khích lệ ở "Hôm nay" bổ sung chứ không thay thế.

## Phụ thuộc và điều kiện về hiến pháp

- **Phạm vi giai đoạn (Hiến pháp, mục "Ràng buộc công nghệ & phạm vi")**: "luyện nghe và đọc" nằm ở Giai đoạn 2; luyện viết bằng gõ bàn phím không phải "luyện viết tay Kanji" nên không vi phạm điều loại trừ của Giai đoạn 1, nhưng việc đưa luyện viết nói chung vào phạm vi hiện tại cũng cần biện minh; tính năng giai đoạn sau KHÔNG ĐƯỢC xây sớm trừ khi sửa hiến pháp hoặc kế hoạch ghi lại lý do biện minh rõ ràng. Góp ý này do chủ dự án yêu cầu, nên NÊN: (a) lập đề xuất sửa hiến pháp kéo luyện đọc/viết (luyện viết bằng gõ bàn phím) vào phạm vi hiện tại, hoặc (b) ghi lý do biện minh trong mục theo dõi độ phức tạp của kế hoạch. Phải xử lý trước khi hoàn tất `/speckit-plan`.
- **Nguyên tắc I (học vi mô)**: mọi phiên luyện đọc/viết 5–15 phút và kế hoạch ngày không vượt quỹ thời gian đã khai báo.
- **Nguyên tắc III (người học nắm quyền kiểm soát)**: mặc định chỉ là gợi ý; học viên đổi được. Học viên thuộc lớp chịu các khóa của lớp.
- **Nguyên tắc VI (kiến trúc tách biệt)**: nội dung đọc/viết là dữ liệu độc lập với mã ứng dụng; điều kiện ≥ 30 phút kiểm ở máy chủ; thay đổi hợp đồng API được ghi thành tài liệu và không làm hỏng client hiện có.
- Phụ thuộc vào spec 001 (thiết lập, lộ trình, tiến độ), spec 003 (Kanji), spec 004 (lớp học – các lựa chọn bị khóa) và spec 005 (hiệu ứng chúc mừng).
- Cần có nội dung luyện đọc và luyện viết được biên soạn cho các trình độ đang hỗ trợ; số lượng tối thiểu để ra mắt do chủ dự án xác nhận.

## Làm rõ

### Phiên 2026-11-12

- Q: "Luyện viết" là hình thức nào? → A: Gõ bàn phím – gõ lại từ, chữ Kanji hoặc câu tiếng Nhật theo gợi ý và so khớp đáp án; không viết tay, không nhận dạng nét (FR-009).
- Q: Luyện đọc/viết nằm ở đâu trong ngày học của người từ 30 phút trở lên? → A: Nằm trong kế hoạch hằng ngày do Learning Engine sinh, tính vào quỹ 30 phút (FR-013); học viên tắt/bật được.
