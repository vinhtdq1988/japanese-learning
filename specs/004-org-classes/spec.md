# Đặc tả tính năng: Tổ chức, Lớp học và Lộ trình lớp (B2B theo seat cho trung tâm tiếng Nhật)

**Nhánh tính năng**: `004-org-classes` (tên thư mục; chưa tạo nhánh git)

**Ngày tạo**: 2026-11-07

**Trạng thái**: Bản nháp đã làm rõ (điều kiện hiến pháp đã được đáp ứng bởi hiến pháp v1.2.0, xem mục "Điều kiện về hiến pháp"); sẵn sàng cho `/speckit-plan`

**Giai đoạn**: Giai đoạn 1.5 (thương mại hóa B2B) theo hiến pháp v1.2.0. Đây là mô-đun "Organization & Class Management" (Quản lý Tổ chức & Lớp học, B2B), đã được thêm vào danh sách mô-đun trong phạm vi của hiến pháp.

**Đầu vào**: Mô tả của người dùng: "Hướng cho giáo viên, công ty mua theo seat học; có chức năng hỗ trợ giáo viên/công ty thiết lập, kiểm tra lộ trình học theo từng nhóm/lớp". Khách hàng đầu tiên là **trung tâm tiếng Nhật**; học viên có **hai lựa chọn**: theo lộ trình lớp (thuộc lớp) hoặc theo lộ trình cá nhân (rời lớp, không thuộc lớp nào). Khi đang thuộc lớp thì bắt buộc theo lộ trình lớp.

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (1) học viên bắt đầu học mà không cần tự xây dựng kế hoạch (lộ trình do lớp cung cấp); (2) bài học hằng ngày vẫn vừa trong 5–15 phút và không vượt quỹ thời gian; (3) lộ trình phù hợp trình độ và mục tiêu (ở cấp lớp); (4) phát hiện điểm yếu (cấp học viên và cấp lớp); (5) theo dõi được tiến độ và mức đạt mục tiêu (cho giáo viên). Tiêu chí (6) (mở rộng sang Mobile) không bị ảnh hưởng.

## Điều kiện về hiến pháp

Hai điểm mà spec này từng cần sửa hiến pháp đã được giải quyết bởi **hiến pháp v1.2.0** (sửa đổi lần cuối 2026-11-07):

1. **Nguyên tắc III – Người học nắm quyền kiểm soát** yêu cầu người học PHẢI ghi đè được quyết định của hệ thống (đổi mục tiêu, thời gian mỗi ngày, tạm dừng, ưu tiên kỹ năng, bỏ qua nội dung đã thành thạo, dựng lại lộ trình). Khi học viên chọn theo lộ trình lớp, các quyền này tạm bị khóa. Mức xung đột được giảm vì học viên có hai lựa chọn: (a) học viên tự quyết định vào lớp hay không sau khi thấy rõ điều kiện, và có quyền từ chối lời mời (FR-016); (b) học viên chuyển sang lộ trình cá nhân (rời lớp) bất cứ lúc nào và nhận lại toàn bộ quyền kiểm soát (FR-037); (c) việc khóa chỉ áp dụng khi đang thuộc lớp; (d) quyền kiểm soát trong lớp chuyển sang giáo viên (miễn bài, dời mốc, tạm dừng). Đã giải quyết: Nguyên tắc III của v1.2.0 có đoạn làm rõ rằng người học tự chọn tham gia lớp của một tổ chức thì các lựa chọn cá nhân được tạm khóa trong thời gian thuộc lớp, với điều kiện đi kèm (thấy rõ điều kiện trước khi đồng ý, được từ chối lời mời, rời lớp bất cứ lúc nào, không ai bị ép vào lớp).
2. **Phân giai đoạn và danh sách mô-đun**: Đã giải quyết: v1.2.0 bổ sung mô-đun "Organization & Class Management" vào danh sách mô-đun trong phạm vi và thêm Giai đoạn 1.5 (thương mại hóa B2B).

Nguyên tắc II (không áp một lộ trình cố định cho mọi người dùng) vẫn được tôn trọng: lộ trình lớp chỉ áp dụng cho học viên thuộc lớp; kế hoạch hằng ngày của từng học viên trong lớp vẫn do Learning Engine sinh riêng (ôn tập, độ khó thích ứng, quỹ thời gian). Nguyên tắc I (không vượt quỹ thời gian) được giữ nguyên (FR-019).

## Làm rõ

### Phiên 2026-11-07

- Hỏi: Nhóm khách hàng đầu tiên là trung tâm tiếng Nhật hay công ty? → Đáp: Trung tâm tiếng Nhật (giáo viên là người dùng chính của phía tổ chức).
- Hỏi: Học viên trong lớp bắt buộc theo lộ trình lớp hay vẫn được tự điều chỉnh? → Đáp: Bắt buộc theo lộ trình lớp khi đang thuộc lớp; không có chế độ lai (vừa thuộc lớp vừa tự điều chỉnh).
- Hỏi (điều chỉnh cùng ngày): Học viên có bị ép vào lớp không? → Đáp: Không. Học viên có hai lựa chọn: theo lộ trình lớp, hoặc theo lộ trình cá nhân (rời lớp, không theo lớp nào). Chuyển sang lộ trình cá nhân đồng nghĩa với rời lớp.
- Hỏi: Giáo viên và chủ tổ chức có chiếm seat không, hay chỉ học viên mới tính seat? → Đáp: Giáo viên cũng chiếm seat (mỗi giáo viên một seat); chủ tổ chức không chiếm seat. Mỗi tài khoản chỉ giữ tối đa một seat trong tổ chức, dù có vai trò giáo viên, học viên hoặc cả hai.
- Hỏi: Một tài khoản có thể giữ vai trò giáo viên hoặc chủ tổ chức ở nhiều tổ chức cùng lúc không? → Đáp: Không. Mỗi tài khoản chỉ thuộc tối đa một tổ chức tại một thời điểm, với mọi vai trò (giáo viên dạy ở hai trung tâm phải dùng hai tài khoản riêng).
- Hỏi: Khi lớp chưa có lộ trình mà có học viên muốn vào thì xử lý ra sao? → Đáp: Không cho thêm học viên (lời mời, mã tham gia, CSV) vào lớp cho tới khi lớp có lộ trình; giáo viên được báo rõ lý do. Do đó không tồn tại trạng thái học viên thuộc lớp mà lớp chưa có lộ trình.
- Hỏi: Khi lớp bị lưu trữ thì học viên đang trong lớp ra sao? → Đáp: Lưu trữ lớp được coi là kết thúc khóa học: mọi học viên của lớp tự chuyển sang lộ trình cá nhân như khi rời lớp (FR-037); lớp lưu trữ chỉ còn xem cấu trúc và danh sách thành viên, không khôi phục được.
- Hỏi: Học viên chấp nhận lời mời đúng lúc hết seat ("chờ seat") thì xử lý ra sao? → Đáp: Không có trạng thái "chờ seat". Chỉ gửi được lời mời khi tổ chức còn seat trống (lời mời đang chờ giữ chỗ seat); nếu đến lúc chấp nhận hoặc nhập mã mà không còn seat thì bị từ chối kèm thông báo rõ, học viên tiếp tục theo lộ trình cá nhân.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Quản trị viên cấp tổ chức và seat, chủ tổ chức mời giáo viên (Ưu tiên: P1)

Quản trị viên hệ thống tạo một tổ chức (trung tâm tiếng Nhật), chỉ định chủ tổ chức bằng email, và cấp một số seat kèm kỳ hạn (chưa có thanh toán tự động). Chủ tổ chức nhận lời mời, vào hệ thống, mời giáo viên, và theo dõi số seat đã dùng/còn trống.

**Lý do ưu tiên**: Không có tổ chức, vai trò và seat thì không có gì để bán hay quản lý; đây là nền tảng cho mọi câu chuyện còn lại và cho phép bán thử thủ công cho khách đầu tiên.

**Kiểm thử độc lập**: Với tài khoản quản trị viên, tạo tổ chức, chỉ định chủ tổ chức, cấp 20 seat có kỳ hạn; đăng nhập bằng tài khoản chủ tổ chức, mời một giáo viên và xác minh giáo viên nhận được quyền; thử truy cập chéo tổ chức và xác minh bị từ chối.

**Kịch bản chấp nhận**:

1. **Với** quản trị viên hệ thống, **Khi** họ tạo tổ chức với tên, email chủ tổ chức, số seat và kỳ hạn, **Thì** chủ tổ chức nhận lời mời qua email và sau khi chấp nhận có quyền quản lý tổ chức đó; hành động của quản trị viên được ghi lại.
2. **Với** chủ tổ chức, **Khi** họ mời một người làm giáo viên bằng email, **Thì** người đó (sau khi đăng ký hoặc đăng nhập và chấp nhận) có vai trò giáo viên trong tổ chức, chiếm một seat và chỉ thấy các lớp mình phụ trách; **Khi** tổ chức đã hết seat, **Thì** lời mời giáo viên bị từ chối kèm thông báo rõ (chủ tổ chức không chiếm seat).
3. **Với** chủ tổ chức, **Khi** họ mở trang quản lý, **Thì** họ thấy số seat tổng, đã dùng (gồm seat của giáo viên và học viên), còn trống, kỳ hạn, danh sách giáo viên và danh sách mọi lớp trong tổ chức mình.
4. **Với** một tài khoản có vai trò trong tổ chức A, **Khi** nó cố xem hay sửa dữ liệu của tổ chức B (lớp, học viên, báo cáo), **Thì** bị từ chối và hệ thống không tiết lộ tổ chức B hoặc dữ liệu đó có tồn tại.
5. **Với** một giáo viên hay chủ tổ chức, **Khi** họ truy cập công cụ quản trị nội dung hệ thống, **Thì** bị từ chối (vai trò tổ chức không bao hàm quyền quản trị hệ thống).
6. **Với** số seat của tổ chức đã dùng hết, **Khi** có thêm học viên cố vào lớp, **Thì** yêu cầu bị từ chối kèm thông báo rõ và học viên không bị tính seat.
7. **Với** một giáo viên của tổ chức cũng là học viên ở lớp khác trong cùng tổ chức, **Khi** họ vào lớp đó, **Thì** họ vẫn chỉ chiếm một seat (không tính thêm seat).

---

### Câu chuyện người dùng 2 - Giáo viên tạo lớp và đưa học viên vào lớp (Ưu tiên: P1)

Giáo viên tạo một lớp, rồi đưa học viên vào bằng một trong ba cách: gửi lời mời qua email, chia sẻ mã tham gia (join code) của lớp, hoặc nhập danh sách từ file CSV. Học viên chấp nhận vào lớp sau khi thấy rõ giáo viên xem được gì và lộ trình do lớp quyết định.

**Lý do ưu tiên**: Lớp và danh sách học viên là đơn vị làm việc của giáo viên; không đưa học viên vào lớp được thì không có lộ trình lớp hay báo cáo nào.

**Kiểm thử độc lập**: Với tài khoản giáo viên có seat, tạo lớp; mời 3 học viên bằng email, cho 1 học viên vào bằng mã tham gia, nhập CSV 10 dòng (một số dòng lỗi); xác minh danh sách lớp, trạng thái từng người, số seat bị trừ khi học viên chấp nhận, và báo cáo kết quả theo từng dòng CSV.

**Kịch bản chấp nhận**:

1. **Với** giáo viên, **Khi** họ tạo lớp (tên, mô tả), **Thì** lớp được tạo với giáo viên đó là người phụ trách; chủ tổ chức có thể thêm hoặc đổi giáo viên phụ trách; mỗi lớp luôn có ít nhất một giáo viên phụ trách.
2. **Với** lời mời qua email, **Khi** người nhận chưa có tài khoản, **Thì** họ đăng ký rồi thấy lời mời để chấp nhận; **Khi** người nhận đã có tài khoản, **Thì** họ đăng nhập và thấy lời mời để chấp nhận; lời mời chỉ dùng một lần, hết hạn sau 14 ngày và giáo viên thu hồi được.
3. **Với** mã tham gia của lớp, **Khi** học viên đã đăng nhập nhập đúng mã, **Thì** họ thấy thông báo điều kiện vào lớp (FR-016) và sau khi xác nhận được thêm vào lớp; giáo viên bật/tắt hoặc đổi mã bất cứ lúc nào, mã cũ lập tức vô hiệu; nhập sai quá nhiều lần liên tiếp thì bị tạm khóa việc nhập mã.
4. **Với** file CSV có cột email (bắt buộc) và tên hiển thị (tùy chọn), **Khi** giáo viên nhập file, **Thì** hệ thống gửi lời mời cho các dòng hợp lệ và báo kết quả cho từng dòng (đã gửi, email không hợp lệ, trùng trong file, đã ở lớp khác, đã có lời mời chờ, hết seat), không dòng nào bị bỏ qua âm thầm.
5. **Với** giáo viên gửi lời mời (email hoặc CSV), **Khi** tổ chức còn seat trống sau khi trừ các lời mời đang chờ, **Thì** lời mời được gửi và giữ chỗ một seat cho tới khi được chấp nhận, hết hạn, bị thu hồi hoặc bị từ chối; **Khi** không còn seat trống, **Thì** lời mời (hoặc dòng CSV) bị từ chối kèm thông báo rõ và không tạo lời mời nào. Khi học viên chấp nhận lời mời và xác nhận vào lớp, họ được thêm vào lớp và seat được tính cho họ. Trong trường hợp hiếm seat đã mất trước khi học viên chấp nhận hoặc nhập mã (ví dụ kỳ hạn hết, seat bị thu hồi), họ nhận thông báo rõ, KHÔNG được thêm vào lớp, và tiếp tục theo lộ trình cá nhân; hệ thống không có trạng thái "chờ seat".
6. **Với** học viên đang thuộc một lớp đang hoạt động hoặc thuộc tổ chức khác, **Khi** họ được mời vào lớp mới, **Thì** hệ thống từ chối (một học viên chỉ thuộc một lớp tại một thời điểm); giáo viên có quyền ở cả hai lớp (hoặc chủ tổ chức) có thể chuyển học viên sang lớp khác trong cùng tổ chức mà không tốn thêm seat.
7. **Với** giáo viên, **Khi** họ gỡ một học viên khỏi lớp, **Thì** seat được giải phóng và áp dụng quy tắc rời lớp ở Câu chuyện 6.
8. **Với** giáo viên phụ trách hoặc chủ tổ chức, **Khi** họ lưu trữ một lớp đang có học viên, **Thì** hệ thống nêu rõ hậu quả và yêu cầu xác nhận; sau khi xác nhận, mọi học viên của lớp được xử lý như tự chuyển sang lộ trình cá nhân (Câu chuyện 6, kịch bản 4: seat được giải phóng, giáo viên và chủ tổ chức mất quyền xem dữ liệu học, lịch sử học được giữ nguyên cho học viên), mã tham gia và lời mời đang chờ của lớp bị vô hiệu, và lớp lưu trữ chỉ còn xem cấu trúc và danh sách thành viên.
9. **Với** lớp mới tạo chưa có lộ trình lớp, **Khi** giáo viên cố gửi lời mời, bật mã tham gia hoặc nhập CSV, **Thì** hệ thống từ chối kèm thông báo rõ rằng cần đặt lộ trình lớp trước (Câu chuyện 3); mã tham gia chưa dùng được và học viên nhập mã không vào được lớp.

---

### Câu chuyện người dùng 3 - Thiết lập lộ trình lớp theo mẫu và học viên học theo lớp (Ưu tiên: P1)

Giáo viên đặt lộ trình cho cả lớp bằng một mẫu đơn giản (trình độ xuất phát, trình độ đích, kỹ năng, mốc ngày bắt đầu/kết thúc, số phút mỗi ngày). Từ đó mọi học viên của lớp nhận kế hoạch hằng ngày bám theo lộ trình lớp thay vì tự khai báo; hệ thống vẫn sinh kế hoạch riêng cho từng người (ôn tập, độ khó thích ứng, quỹ thời gian).

**Lý do ưu tiên**: Đây là giá trị cốt lõi của bản B2B: giáo viên không phải theo dõi từng người học các nội dung khác nhau, học viên vào học ngay không cần onboarding mục tiêu.

**Kiểm thử độc lập**: Giáo viên đặt lộ trình mẫu (N5→N4, từ vựng + ngữ pháp, 10 phút/ngày, mốc 90 ngày) cho lớp có 3 học viên (người mới hoàn toàn, người đã có tiến độ cá nhân, người đã nghỉ vài ngày); xác minh kế hoạch hôm nay của từng người theo lớp, không vượt 10 phút, và học viên không đổi được mục tiêu hay lộ trình.

**Kịch bản chấp nhận**:

1. **Với** giáo viên, **Khi** họ lưu tham số mẫu cho lớp, **Thì** lộ trình lớp có hiệu lực cho mọi học viên hiện tại và học viên vào sau, và được tính động như lộ trình cá nhân (không sao chép lộ trình riêng cho từng học viên).
2. **Với** một học viên vừa vào lớp, **Khi** họ đăng nhập, **Thì** onboarding chỉ hỏi những thông tin không do lớp quyết định (tên hiển thị, ngôn ngữ giao diện, múi giờ), không hỏi mục tiêu, trình độ, thời gian mỗi ngày, kỹ năng; họ thấy ngay kế hoạch "Hôm nay" theo lộ trình lớp.
3. **Với** học viên thuộc lớp, **Khi** họ mở phần điều chỉnh kế hoạch, **Thì** các điều khiển đổi mục tiêu, thời gian mỗi ngày, kỹ năng, ưu tiên kỹ năng, tạm dừng, đánh dấu thành thạo, dựng lại lộ trình hiển thị ở dạng khóa kèm lý do "do lớp quyết định", và máy chủ từ chối các yêu cầu đó nếu bị gọi trực tiếp; cùng chỗ đó học viên thấy hướng dẫn rõ rằng muốn tự điều chỉnh thì chuyển sang lộ trình cá nhân (rời lớp).
4. **Với** học viên thuộc lớp, **Khi** hệ thống sinh kế hoạch hằng ngày, **Thì** bài của lớp (đã mở, đến hạn) được ưu tiên, ôn tập đến hạn vẫn được chèn theo lịch lặp lại ngắt quãng, độ khó vẫn thích ứng theo kết quả, và tổng thời lượng ước tính KHÔNG vượt số phút mỗi ngày của lớp.
5. **Với** học viên đã học cá nhân trước khi vào lớp, **Khi** họ vào lớp, **Thì** lộ trình cá nhân cũ được tạm ngưng (không xóa), tiến độ và lịch ôn đã có được giữ và tiếp tục; bài của lớp mà họ đã hoàn thành trước đó được ghi nhận là đã hoàn thành.
6. **Với** học viên trong lớp vắng mặt vài ngày, **Khi** họ quay lại, **Thì** kế hoạch được cân đối lại (không dồn khối lượng bù) giống học viên thường, đồng thời bảng điều khiển của giáo viên cho thấy họ đã vắng.
7. **Với** giáo viên đổi tham số lộ trình lớp giữa chừng, **Khi** học viên mở ứng dụng, **Thì** thay đổi có hiệu lực từ kế hoạch được sinh kế tiếp; tiến độ và lịch ôn của học viên được giữ nguyên; bài đã hoàn thành vẫn là đã hoàn thành.
8. **Với** học viên không thuộc lớp nào, **Khi** họ dùng ứng dụng, **Thì** hành vi không thay đổi so với trước khi có tính năng này.

---

### Câu chuyện người dùng 4 - Bảng điều khiển lớp và chi tiết từng học viên (Ưu tiên: P2)

Giáo viên mở bảng điều khiển của lớp để thấy ngay lớp đang học thế nào: ai đúng tiến độ, ai chậm, ai vắng; có thể bấm vào từng học viên để xem chi tiết.

**Lý do ưu tiên**: Giáo viên cần "kiểm tra lộ trình"; không có bảng này, việc đặt lộ trình lớp không cho giáo viên biết điều gì đang xảy ra. Cần cho lớp thử nghiệm đầu tiên, nhưng phụ thuộc vào Câu chuyện 2 và 3.

**Kiểm thử độc lập**: Với lớp 5 học viên có dữ liệu học đã biết (đúng tiến độ, chậm, vắng, tạm dừng, vừa vào lớp), mở bảng điều khiển và đối chiếu từng số liệu với hoạt động đã ghi; mở chi tiết một học viên.

**Kịch bản chấp nhận**:

1. **Với** giáo viên phụ trách lớp, **Khi** mở bảng điều khiển, **Thì** với mỗi học viên họ thấy: tỷ lệ hoàn thành lộ trình lớp, chuỗi ngày học, thời gian học (7 ngày gần nhất và tổng từ khi vào lớp), độ chính xác khi ôn, ngày học gần nhất, và trạng thái tiến độ so với mốc (đúng tiến độ, chậm, vượt, đang tạm dừng); cùng một dòng tổng hợp cho cả lớp.
2. **Với** bảng điều khiển, **Khi** giáo viên sắp xếp hoặc lọc (ví dụ chỉ hiện học viên chậm), **Thì** danh sách thay đổi tương ứng.
3. **Với** giáo viên chọn một học viên, **Khi** mở chi tiết, **Thì** họ thấy tiến độ theo từng đơn vị của lộ trình lớp, thời gian học theo ngày trong 30 ngày gần nhất, độ chính xác, các mảng yếu, tình trạng bài giao (đúng hạn/trễ hạn/chưa làm) và kết quả kiểm tra trình độ nếu có.
4. **Với** số liệu trên bảng điều khiển, **Khi** so với khối "tiến độ trong lớp" trên trang "Lớp của tôi" của chính học viên đó (cùng nguồn dữ liệu, cùng cửa sổ kể từ lúc vào lớp), **Thì** các số đếm và độ chính xác khớp nhau; với học viên chưa có hoạt động nào trước khi vào lớp, các số này cũng khớp màn hình tiến độ cá nhân.
5. **Với** học viên vừa vào lớp, **Khi** giáo viên xem, **Thì** chỉ hiện hoạt động từ lúc vào lớp; hoạt động trước đó của học viên không xuất hiện.
6. **Với** học viên chưa có hoạt động nào, **Khi** giáo viên xem, **Thì** hiển thị trạng thái "chưa bắt đầu" rõ ràng thay vì các số 0 gây hiểu nhầm là thất bại.
7. **Với** giáo viên không phụ trách lớp, **Khi** họ cố mở bảng điều khiển lớp đó, **Thì** bị từ chối; chủ tổ chức xem được mọi lớp trong tổ chức mình.

---

### Câu chuyện người dùng 5 - Tinh chỉnh lộ trình lớp: chọn bài, khóa/mở theo ngày, giao bài, ghi đè cá nhân (Ưu tiên: P2)

Ngoài mẫu đơn giản, giáo viên chọn và sắp xếp từng đơn vị học cho lớp, đặt ngày mở của từng đơn vị, giao bài cụ thể kèm hạn nộp, và điều chỉnh riêng cho từng học viên (miễn bài, điều chỉnh tốc độ).

**Lý do ưu tiên**: Giáo viên trung tâm thường dạy theo giáo trình có thứ tự và lịch trên lớp; chỉ có mẫu chung thì chưa bám sát buổi học thật. Có thể dùng thử bản mẫu (Câu chuyện 3) trước khi có phần này.

**Kiểm thử độc lập**: Giáo viên chọn 12 đơn vị theo thứ tự, đặt ngày mở khác nhau, giao một bài với hạn nộp, miễn một bài và dời mốc cho một học viên; xác minh kế hoạch của từng học viên phản ánh đúng, và cảnh báo khả thi xuất hiện khi hạn quá gần.

**Kịch bản chấp nhận**:

1. **Với** giáo viên, **Khi** họ chọn các đơn vị học đang hoạt động từ thư viện, thêm/bớt và sắp xếp thứ tự, **Thì** lộ trình lớp dùng đúng danh sách và thứ tự đó thay cho thứ tự sinh theo mẫu.
2. **Với** một đơn vị có ngày mở trong tương lai, **Khi** học viên xem kế hoạch hoặc yêu cầu học thêm, **Thì** đơn vị chưa mở không xuất hiện (khóa), và tự xuất hiện từ ngày mở.
3. **Với** giáo viên giao một đơn vị kèm hạn nộp, **Khi** học viên mở ứng dụng, **Thì** họ thấy bài giao và hạn trong kế hoạch; bài giao quá hạn mà chưa xong vẫn tiếp tục xuất hiện cho đến khi hoàn thành, và việc hoàn thành đúng hạn hay trễ hạn được ghi lại.
4. **Với** giáo viên đặt lộ trình hoặc giao bài, **Khi** khối lượng ước tính cần hoàn thành trước hạn vượt quỹ thời gian sẵn có (số ngày còn lại × số phút mỗi ngày), **Thì** hệ thống cảnh báo giáo viên (không chặn lưu) và kế hoạch hằng ngày của học viên vẫn không vượt quỹ thời gian.
5. **Với** giáo viên miễn một đơn vị cho một học viên, **Khi** hệ thống tính tiến độ, **Thì** đơn vị đó không xuất hiện trong kế hoạch của học viên và không tính vào mẫu số hoàn thành của họ.
6. **Với** giáo viên đặt số phút mỗi ngày riêng hoặc dời mốc ngày riêng cho một học viên, **Khi** hệ thống sinh kế hoạch và tính tiến độ so với mốc, **Thì** dùng giá trị riêng đó cho học viên ấy; học viên thấy rằng giáo viên đã điều chỉnh cho mình.
7. **Với** một đơn vị trong lộ trình lớp bị quản trị viên nội dung vô hiệu hóa, **Khi** học viên xem kế hoạch, **Thì** đơn vị biến mất khỏi kế hoạch và khỏi mẫu số hoàn thành, và giáo viên thấy thông báo về thay đổi này.
8. **Với** giáo viên tạm dừng một học viên hoặc cả lớp (nghỉ lễ, nghỉ phép), **Khi** khoảng tạm dừng diễn ra, **Thì** không có kế hoạch nào bị tính là bỏ lỡ, không phát sinh cảnh báo, và thời gian tạm dừng không bị tính vào chậm tiến độ; giáo viên có thể dời mốc ngày của lớp sau kỳ nghỉ.

---

### Câu chuyện người dùng 6 - Học viên chọn lộ trình lớp hoặc cá nhân, quyền riêng tư và vòng đời thành viên (Ưu tiên: P2)

Học viên có hai lựa chọn rõ ràng: theo lộ trình lớp (thuộc lớp) hoặc theo lộ trình cá nhân (rời lớp, không thuộc lớp nào), và có thể chuyển qua lại. Học viên biết rõ giáo viên xem được gì; khi chuyển sang lộ trình cá nhân hoặc hết seat thì giữ nguyên lịch sử học, còn tổ chức mất quyền xem ngay.

**Lý do ưu tiên**: Dữ liệu học tập của cá nhân đi vào tay bên thứ ba (trung tâm) nên cần minh bạch và có lối thoát; việc học viên được tự chọn cũng là biện pháp giảm thiểu cho việc khóa quyền kiểm soát khi thuộc lớp (xem mục Điều kiện về hiến pháp).

**Kiểm thử độc lập**: Cho một học viên nhận lời mời và thử cả hai lựa chọn (từ chối rồi đồng ý), học vài ngày trong lớp, rồi chuyển sang lộ trình cá nhân và chuyển lại; xác minh thông báo trước khi vào, trang "Lớp của tôi", tổ chức mất quyền xem ngay khi chuyển sang cá nhân, và lịch sử học còn nguyên.

**Kịch bản chấp nhận**:

1. **Với** học viên nhận lời mời hoặc nhập mã, **Khi** hệ thống hiển thị lựa chọn, **Thì** họ thấy hai lựa chọn ngang nhau: "Vào lớp và theo lộ trình lớp" hoặc "Tiếp tục theo lộ trình cá nhân"; kèm thông tin tổ chức, lớp, giáo viên; danh sách dữ liệu giáo viên và chủ tổ chức sẽ xem được; việc lộ trình do lớp quyết định và các quyền bị khóa khi thuộc lớp; việc họ có thể chuyển sang lộ trình cá nhân bất cứ lúc nào; và việc trung tâm có thể chuyển họ sang lớp khác trong cùng tổ chức. Chỉ khi chọn vào lớp và xác nhận họ mới được thêm vào lớp và bị tính seat.
2. **Với** học viên chọn "Tiếp tục theo lộ trình cá nhân" ở lời mời, **Khi** họ xác nhận, **Thì** lời mời được đóng, không tốn seat, lộ trình và quyền kiểm soát cá nhân không đổi, và giáo viên chỉ thấy trạng thái "học viên đã từ chối".
3. **Với** học viên đang trong lớp, **Khi** mở trang "Lớp của tôi", **Thì** họ thấy tên lớp, tổ chức, giáo viên, lộ trình lớp, bài giao và hạn, các điều chỉnh riêng của giáo viên cho mình, danh sách chính xác dữ liệu giáo viên xem được, và nút "Chuyển sang lộ trình cá nhân (rời lớp)" kèm giải thích hậu quả.
4. **Với** học viên chọn chuyển sang lộ trình cá nhân (rời lớp), **Khi** họ xác nhận, **Thì** seat được giải phóng, giáo viên và chủ tổ chức mất quyền xem dữ liệu của họ ngay lập tức (kể cả phiên làm việc đang mở), giáo viên thấy học viên đã chuyển sang lộ trình cá nhân (chỉ tên và ngày chuyển), và toàn bộ lịch sử học, lịch ôn, tiến độ của học viên được giữ nguyên cho chính họ.
5. **Với** học viên vừa chuyển sang lộ trình cá nhân, **Khi** họ đăng nhập lại, **Thì** nếu trước đó có lộ trình cá nhân (tạm ngưng) thì nó được khôi phục cùng mọi quyền kiểm soát; nếu họ chưa từng có hồ sơ cá nhân thì họ đi qua onboarding cá nhân như người dùng mới.
6. **Với** học viên đang theo lộ trình cá nhân sau khi rời lớp, **Khi** giáo viên mời lại hoặc họ nhập lại mã và còn seat, **Thì** họ có thể chọn vào lại lớp; các đơn vị đã hoàn thành trước đó (kể cả khi học cá nhân) được ghi nhận là đã hoàn thành trong lộ trình lớp và không phải học lại.
7. **Với** kỳ hạn seat của tổ chức đã hết và qua thời gian ân hạn, **Khi** thời điểm đó đến, **Thì** các học viên giữ seat được xử lý như tự chuyển sang lộ trình cá nhân (cùng kết quả như kịch bản 4); trong thời gian ân hạn, chủ tổ chức và giáo viên thấy cảnh báo sắp hết hạn.
8. **Với** học viên xóa tài khoản theo quy định xóa tài khoản hiện có, **Khi** họ yêu cầu xóa, **Thì** tổ chức mất quyền xem ngay và seat được giải phóng.
9. **Với** giáo viên bị chủ tổ chức gỡ vai trò, **Khi** việc gỡ có hiệu lực, **Thì** họ mất quyền với các lớp của mình ngay lập tức và seat của họ được giải phóng; lớp không còn giáo viên phụ trách được chủ tổ chức thấy cảnh báo; học viên vẫn học theo lộ trình lớp bình thường.

---

### Câu chuyện người dùng 7 - Cảnh báo, điểm yếu chung của lớp và xuất báo cáo CSV (Ưu tiên: P3)

Hệ thống chủ động chỉ ra học viên cần chú ý (vắng N ngày, tụt tiến độ, bài giao quá hạn), chỉ ra các chủ đề cả lớp đang yếu để giáo viên dạy lại trên lớp, và cho xuất báo cáo CSV.

**Lý do ưu tiên**: Làm giáo viên tiết kiệm thời gian rà soát, nhưng giáo viên vẫn dùng được bảng điều khiển (Câu chuyện 4) để tự phát hiện.

**Kiểm thử độc lập**: Với lớp có dữ liệu giả lập: một học viên vắng 4 ngày, một học viên chậm tiến độ, một chủ đề có độ chính xác gộp thấp; xác minh cảnh báo, danh sách chủ đề yếu, và nội dung file CSV.

**Kịch bản chấp nhận**:

1. **Với** lớp có học viên không học liên tiếp từ N ngày trở lên (mặc định 3, giáo viên chỉnh trong khoảng 1–14 ngày), **Khi** giáo viên mở bảng điều khiển, **Thì** học viên đó có cảnh báo "vắng N ngày"; học viên đang tạm dừng không bị cảnh báo.
2. **Với** học viên chậm tiến độ so với mốc hoặc có bài giao quá hạn, **Khi** giáo viên mở bảng điều khiển, **Thì** học viên có cảnh báo tương ứng; giáo viên lọc ra danh sách cần chú ý trong tối đa 2 lần nhấp.
3. **Với** các chủ đề nội dung mà độ chính xác gộp của cả lớp thấp (dưới 60% trên ít nhất 30 câu lượt chính của lớp), **Khi** giáo viên mở phần "Điểm yếu của lớp", **Thì** họ thấy danh sách chủ đề yếu xếp theo mức yếu, kèm số học viên bị gắn cờ yếu ở từng chủ đề và có thể xem tên các học viên đó.
4. **Với** giáo viên, **Khi** xuất báo cáo lớp, **Thì** nhận được file CSV mỗi học viên một dòng với đúng các số liệu của bảng điều khiển, và file CSV chi tiết một học viên; tiếng Việt và tiếng Nhật hiển thị đúng khi mở bằng bảng tính phổ biến.
5. **Với** một ô trong file CSV có giá trị bắt đầu bằng ký tự có thể bị bảng tính hiểu là công thức (ví dụ tên hiển thị `=...`), **Khi** xuất, **Thì** giá trị được vô hiệu hóa để không bị thực thi như công thức.
6. **Với** việc xuất báo cáo, **Khi** thực hiện, **Thì** hành động được ghi lại kèm ai thực hiện và khi nào.

---

### Câu chuyện người dùng 8 - Bài kiểm tra trình độ đầu vào cho cả lớp và chia nhóm (Ưu tiên: P3)

Giáo viên yêu cầu cả lớp làm bài kiểm tra trình độ đầu vào, xem kết quả của từng học viên và phân bố của lớp, rồi dùng kết quả đó để chia học viên vào các lớp phù hợp.

**Lý do ưu tiên**: Hữu ích khi trung tâm xếp lớp đầu khóa, nhưng trung tâm có thể xếp lớp bằng cách thủ công ở giai đoạn đầu.

**Kiểm thử độc lập**: Giáo viên yêu cầu bài kiểm tra cho lớp 6 học viên, các học viên làm bài, giáo viên xem phân bố và chuyển 2 học viên sang lớp khác.

**Kịch bản chấp nhận**:

1. **Với** giáo viên, **Khi** yêu cầu kiểm tra trình độ cho lớp, **Thì** mỗi học viên thấy yêu cầu trong ứng dụng và làm bộ câu hỏi kiểm tra trình độ hiện có (khoảng 20 câu, tối đa 10 phút).
2. **Với** các học viên đã làm bài, **Khi** giáo viên xem kết quả, **Thì** họ thấy kết quả từng học viên và phân bố trình độ ước tính của cả lớp; học viên chưa làm được đánh dấu rõ.
3. **Với** giáo viên có quyền ở lớp nguồn và lớp đích (hoặc chủ tổ chức), **Khi** mời học viên chuyển sang lớp khác, **Thì** học viên KHÔNG bị chuyển ngay mà nhận một lời mời chuyển lớp; chỉ khi họ đồng ý thì chuyển lớp mà không tốn thêm seat, tiến độ và lịch ôn được giữ, và họ bắt đầu theo lộ trình của lớp mới; nếu họ từ chối thì ở lại lớp hiện tại, và họ rời lớp được bất cứ lúc nào. *(Chủ dự án đã quyết định "bắt học viên đồng ý lại" — research "Điểm cần xác nhận" #1.)*
4. **Với** kết quả kiểm tra, **Khi** giáo viên xem, **Thì** kết quả KHÔNG tự động đổi lộ trình lớp; giáo viên quyết định.

---

### Các trường hợp biên

- Học viên bị mời vào lớp khi email của họ có tài khoản đang chờ xóa (30 ngày) → áp dụng quy tắc hiện có: không tạo tài khoản mới, hệ thống gợi ý khôi phục tài khoản cũ. Lời mời vẫn được tạo và giữ chỗ seat cho tới hạn dùng; chỉ chấp nhận được sau khi tài khoản đã được khôi phục (trạng thái hoạt động).
- Một tài khoản vừa là giáo viên vừa là học viên → được phép ở lớp khác trong cùng tổ chức, nhưng KHÔNG ĐƯỢC là học viên trong lớp mà mình đang phụ trách và không dùng giao diện giáo viên để xem tiến độ của chính mình. Quy tắc này áp dụng cho mọi đường vào lớp (lời mời, mã tham gia, CSV, chuyển lớp) và cho việc thêm giáo viên phụ trách: một học viên đang ở lớp KHÔNG ĐƯỢC được thêm làm giáo viên phụ trách chính lớp đó. Một tài khoản vừa là giáo viên vừa là học viên chỉ giải phóng seat khi mất cả hai vai trò (FR-004): rời lớp khi vẫn là giáo viên không làm mất seat, và bị gỡ vai trò giáo viên khi vẫn đang ở lớp không làm mất seat.
- Một người dạy ở nhiều trung tâm → mỗi trung tâm phải dùng một tài khoản riêng vì mỗi tài khoản chỉ thuộc một tổ chức; lời mời từ tổ chức thứ hai bị từ chối mà không tiết lộ tổ chức đầu.
- Một giáo viên phụ trách nhiều lớp → bảng điều khiển chỉ liệt kê lớp mình phụ trách; học viên chỉ thuộc một lớp tại một thời điểm.
- Giáo viên đổi tham số lộ trình lớp nhiều lần liên tiếp → mọi học viên luôn thấy phiên bản mới nhất; tiến độ không mất; không sinh ra lộ trình trùng lặp.
- Lớp chưa có lộ trình lớp mà có người cố vào (lời mời, mã, CSV) → bị từ chối kèm thông báo rõ cho giáo viên; học viên không bị tính seat và không rơi vào trạng thái thuộc lớp mà thiếu lộ trình.
- Thư viện nội dung chưa đủ bài cho trình độ/kỹ năng giáo viên chọn (ví dụ trình độ đích N2/N1 chỉ có nội dung đến N3) → áp dụng trần nội dung hiện có và hiển thị thông báo phạm vi cho giáo viên, như với lộ trình cá nhân.
- Học viên hoàn thành hết nội dung của lộ trình lớp trước hạn → thông báo rõ ràng cho học viên và hiển thị "đã hoàn thành lộ trình" cho giáo viên, thay vì kế hoạch trống.
- Gửi lời mời (học viên hoặc giáo viên) khi không còn seat trống sau khi trừ các lời mời đang chờ → bị từ chối kèm thông báo rõ; lời mời đang chờ giữ chỗ một seat cho tới khi được chấp nhận, hết hạn, bị thu hồi hoặc bị từ chối, nên số lời mời đang chờ không bao giờ vượt số seat trống.
- Học viên chấp nhận lời mời hoặc nhập mã nhưng seat đã mất (kỳ hạn hết, seat bị thu hồi, tổ chức bị vô hiệu hóa) → bị từ chối kèm thông báo rõ, không thêm vào lớp, tiếp tục theo lộ trình cá nhân; không có trạng thái "chờ seat".
- Giảm số seat của tổ chức xuống thấp hơn số đang dùng → bị từ chối cho tới khi chủ tổ chức hoặc quản trị viên giải phóng bớt seat.
- Seat bị thu hồi rồi gán lại vượt giới hạn số lần đổi → bị từ chối kèm lý do rõ, quản trị viên có thể nâng giới hạn.
- Nhập mã tham gia sai nhiều lần liên tiếp → tạm khóa việc nhập mã của tài khoản đó trong một khoảng thời gian ngắn; không tiết lộ mã nào đúng.
- File CSV quá lớn (trên 200 dòng), sai định dạng, hoặc có ký tự lạ → bị từ chối hoặc báo lỗi theo từng dòng với lý do rõ, không tạo lời mời sai.
- Học viên mở hai cửa sổ trình duyệt khi giáo viên đổi lộ trình → mỗi câu trả lời và khoảng thời gian học chỉ được ghi một lần như quy định chung; kế hoạch mới có hiệu lực ở lần sinh kế tiếp.
- Mất kết nối khi giáo viên lưu lộ trình lớp → thay đổi hoặc được lưu trọn vẹn hoặc không đổi gì; giáo viên không thấy trạng thái nửa vời.
- Giáo viên giao bài cho một đơn vị mà một số học viên đã hoàn thành trước đó → các học viên ấy được ghi nhận hoàn thành, không phải làm lại.
- Tổ chức bị quản trị viên hệ thống vô hiệu hóa → mọi học viên của tổ chức được xử lý như hết seat; giáo viên và chủ tổ chức mất quyền ngay.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Tổ chức, vai trò và seat**

- **FR-001**: Quản trị viên hệ thống PHẢI có thể tạo tổ chức, chỉ định chủ tổ chức bằng email, và cấp, điều chỉnh, thu hồi seat kèm kỳ hạn (ngày bắt đầu, ngày kết thúc) bằng công cụ quản trị. Giai đoạn này không có thanh toán tự động; việc cấp seat là thao tác thủ công của quản trị viên.
- **FR-002**: Hệ thống PHẢI có ba vai trò theo tổ chức: chủ tổ chức, giáo viên, học viên; các vai trò này tách biệt với vai trò quản trị viên hệ thống (FR-004 của spec 001). Mỗi tài khoản CHỈ thuộc tối đa một tổ chức tại một thời điểm, với mọi vai trò tổ chức; lời mời (làm giáo viên, chủ tổ chức hoặc vào lớp) gửi tới tài khoản đã thuộc tổ chức khác PHẢI bị từ chối mà KHÔNG tiết lộ tên hay dữ liệu của tổ chức kia. Có vai trò trong tổ chức KHÔNG ĐƯỢC cấp quyền quản trị hệ thống hay quyền dùng công cụ quản trị nội dung. Chức năng quản lý tổ chức của quản trị viên hệ thống CHỈ bao gồm tổ chức, người giữ vai trò và seat; KHÔNG bao gồm bảng điều khiển tiến độ chi tiết của học viên.
- **FR-003**: Chủ tổ chức PHẢI có thể mời người làm giáo viên qua email (giáo viên chiếm một seat khi chấp nhận lời mời), gỡ vai trò giáo viên, xem số seat tổng/đã dùng/còn trống và kỳ hạn, thu hồi seat của một học viên hoặc giáo viên, và xem mọi lớp trong tổ chức của mình. Chủ tổ chức KHÔNG chiếm seat.
- **FR-004**: Seat được chiếm bởi giáo viên và học viên (chủ tổ chức không chiếm seat). Mỗi seat tại một thời điểm CHỈ được gán cho tối đa một tài khoản, và mỗi tài khoản CHỈ giữ tối đa một seat đang hoạt động trong một tổ chức, dù có vai trò giáo viên, học viên hoặc cả hai. Seat của học viên được tính khi học viên vào lớp và được giải phóng khi học viên rời lớp, bị gỡ hoặc bị thu hồi; seat của giáo viên được tính khi giáo viên chấp nhận lời mời và được giải phóng khi bị gỡ vai trò hoặc bị thu hồi (một tài khoản vừa là giáo viên vừa là học viên chỉ giải phóng seat khi mất cả hai vai trò). Số lần một seat đổi người giữ trong một kỳ hạn PHẢI có giới hạn (mặc định 2 lần mỗi seat mỗi kỳ hạn, quản trị viên điều chỉnh được); vượt giới hạn bị từ chối kèm lý do. Chuyển học viên giữa các lớp trong cùng tổ chức KHÔNG tính là đổi seat; cùng một học viên rời lớp rồi vào lại khi seat chưa được gán cho người khác cũng KHÔNG tính là đổi seat.
- **FR-005**: Số tài khoản (giáo viên và học viên) đang giữ seat KHÔNG ĐƯỢC vượt số seat đã cấp. Mỗi lời mời đang chờ (học viên hoặc giáo viên) giữ chỗ một seat; chỉ được gửi lời mời khi số seat đang dùng cộng số lời mời đang chờ còn nhỏ hơn số seat đã cấp. Khi không còn seat trống, việc thêm học viên (lời mời, mã tham gia, CSV) hoặc mời giáo viên PHẢI bị từ chối kèm thông báo rõ; hệ thống KHÔNG ĐƯỢC có trạng thái "chờ seat". Việc giảm số seat xuống dưới tổng seat đang dùng và đang giữ chỗ PHẢI bị từ chối.
- **FR-006**: Khi kỳ hạn seat sắp hết và khi đã hết, hệ thống PHẢI cảnh báo chủ tổ chức và giáo viên. Sau kỳ hạn có thời gian ân hạn (mặc định 7 ngày, cấu hình được); hết ân hạn thì seat mất hiệu lực và áp dụng FR-038.
- **FR-007**: Dữ liệu giữa các tổ chức PHẢI được cô lập hoàn toàn. Giáo viên CHỈ được xem và sửa các lớp mình phụ trách; chủ tổ chức CHỈ được xem và sửa trong tổ chức của mình. Truy cập trái quyền PHẢI bị từ chối và KHÔNG ĐƯỢC tiết lộ sự tồn tại của dữ liệu bị cấm.
- **FR-008**: Hệ thống PHẢI ghi lại kèm ai thực hiện và khi nào các hành động: tạo/vô hiệu hóa tổ chức, cấp/điều chỉnh/thu hồi seat, mời hoặc gỡ giáo viên, gỡ hoặc chuyển học viên, đổi lộ trình lớp, giao bài, ghi đè cá nhân, tạm dừng, xuất báo cáo (cùng cơ chế nhật ký hành động quản trị FR-032 của spec 001).

**Lớp học và thành viên**

- **FR-009**: Giáo viên và chủ tổ chức PHẢI có thể tạo, đổi tên, lưu trữ lớp. Mỗi lớp PHẢI luôn có ít nhất một giáo viên phụ trách; chủ tổ chức PHẢI có thể thêm hoặc đổi giáo viên phụ trách. Lưu trữ lớp PHẢI yêu cầu xác nhận và được xử lý như kết thúc khóa học: mọi học viên của lớp được xử lý theo FR-037 (chuyển sang lộ trình cá nhân, giải phóng seat), mã tham gia và lời mời đang chờ bị vô hiệu; lớp đã lưu trữ chỉ còn xem cấu trúc và danh sách thành viên và KHÔNG khôi phục được (muốn dạy tiếp phải tạo lớp mới và mời học viên, học viên xác nhận lại theo FR-016).
- **FR-010**: Giáo viên (cho lớp mình phụ trách) và chủ tổ chức PHẢI có thể đưa học viên vào lớp bằng ba cách: lời mời qua email, mã tham gia của lớp, và nhập danh sách từ file CSV. Lớp CHỈ nhận học viên khi đã có lộ trình lớp (FR-017); lớp chưa có lộ trình PHẢI từ chối cả ba cách kèm thông báo rõ cho giáo viên, và mã tham gia chưa dùng được cho tới khi lớp có lộ trình.
- **FR-011**: Lời mời qua email PHẢI dùng một lần, hết hạn sau 14 ngày (cấu hình được), thu hồi được; người nhận chưa có tài khoản đăng ký rồi chấp nhận, người đã có tài khoản đăng nhập rồi chấp nhận. Email lời mời PHẢI có cả tiếng Việt và tiếng Anh.
- **FR-012**: Mỗi lớp PHẢI có mã tham gia có thể bật, tắt, đổi (mã cũ vô hiệu ngay) và đặt hạn dùng tùy chọn. Việc nhập mã PHẢI yêu cầu đã đăng nhập, bị giới hạn số lần nhập sai liên tiếp, và KHÔNG ĐƯỢC tiết lộ thông tin lớp cho người nhập sai mã.
- **FR-013**: Nhập CSV PHẢI chấp nhận cột email (bắt buộc) và tên hiển thị (tùy chọn), tối đa 200 dòng mỗi file, xử lý từng dòng độc lập và báo kết quả cho từng dòng (đã gửi lời mời, email không hợp lệ, trùng trong file, đã thuộc lớp khác, đã có lời mời chờ, hết seat). Hệ thống KHÔNG ĐƯỢC bỏ qua dòng nào mà không báo.
- **FR-014**: Mỗi học viên CHỈ thuộc tối đa một lớp đang hoạt động và một tổ chức tại một thời điểm (nguyên tắc một tài khoản một tổ chức của FR-002). Việc thêm học viên đang thuộc lớp khác PHẢI bị từ chối; chuyển lớp trong cùng tổ chức PHẢI do người có quyền ở cả hai lớp hoặc chủ tổ chức MỜI và học viên PHẢI đồng ý lại thì mới chuyển (FR-034).
- **FR-015**: Giáo viên PHẢI xem được danh sách học viên của lớp mình với trạng thái từng người (đã vào lớp, lời mời chờ, học viên đã từ chối, đã chuyển sang lộ trình cá nhân, bị gỡ), và có thể gỡ học viên khỏi lớp.
- **FR-016**: Học viên PHẢI có hai lựa chọn rõ ràng và ngang nhau khi nhận lời mời hoặc nhập mã: vào lớp (theo lộ trình lớp) hoặc tiếp tục theo lộ trình cá nhân. Trước khi vào lớp, học viên PHẢI thấy và xác nhận thông báo gồm: tổ chức, lớp, giáo viên; danh sách dữ liệu giáo viên và chủ tổ chức xem được (FR-035); việc lộ trình do lớp quyết định và các quyền bị khóa khi thuộc lớp; việc có thể chuyển sang lộ trình cá nhân (rời lớp) bất cứ lúc nào; việc giáo viên hoặc chủ tổ chức KHÔNG tự chuyển họ sang lớp khác mà chỉ có thể mời chuyển lớp và họ phải đồng ý lại (FR-034). Không có xác nhận hoặc khi học viên chọn lộ trình cá nhân thì học viên KHÔNG ĐƯỢC thêm vào lớp, KHÔNG ĐƯỢC tính seat, và lộ trình cá nhân KHÔNG bị thay đổi.

**Lộ trình lớp và việc học theo lớp**

- **FR-017**: Mỗi lớp PHẢI có thể có một lộ trình lớp gồm các tham số mẫu: trình độ xuất phát, trình độ đích, kỹ năng (từ vựng, ngữ pháp, Kanji), ngày bắt đầu và ngày kết thúc (mốc), số phút mỗi ngày (5/10/15/30). Lộ trình lớp PHẢI được tính động từ các tham số và đơn vị học đang hoạt động, giống nguyên tắc lộ trình cá nhân (R7 của spec 001), không sao chép lộ trình riêng cho từng học viên. Lớp đã có lộ trình thì KHÔNG ĐƯỢC xóa lộ trình về trạng thái chưa có (chỉ được sửa tham số).
- **FR-018**: Với học viên thuộc lớp, nguồn của lộ trình PHẢI là lộ trình lớp thay cho tham số tự khai báo. Học viên KHÔNG ĐƯỢC đổi mục tiêu, thời gian mỗi ngày, kỹ năng, ưu tiên kỹ năng, tự tạm dừng, đánh dấu thành thạo, dựng lại lộ trình hay tự làm lại bài kiểm tra trình độ trong thời gian thuộc lớp. Giao diện PHẢI hiển thị các điều khiển này ở dạng khóa kèm lý do, và máy chủ PHẢI từ chối khi bị gọi trực tiếp. Học viên vẫn PHẢI sửa được tên hiển thị, email, mật khẩu, ngôn ngữ, múi giờ, xóa tài khoản, và xem toàn bộ tiến độ của mình. Không có chế độ lai: học viên hoặc theo lộ trình lớp (thuộc lớp), hoặc theo lộ trình cá nhân (không thuộc lớp); muốn tự điều chỉnh thì PHẢI chuyển sang lộ trình cá nhân (FR-037).
- **FR-019**: Kế hoạch hằng ngày của học viên thuộc lớp PHẢI vẫn do hệ thống sinh riêng cho từng người: ưu tiên bài của lớp (đã mở, đến hạn), chèn ôn tập đến hạn theo lặp lại ngắt quãng, giữ độ khó thích ứng, chia gói ôn tối đa 15 phút, và tổng thời lượng ước tính mặc định KHÔNG ĐƯỢC vượt số phút mỗi ngày áp dụng cho học viên đó (của lớp hoặc ghi đè cá nhân).
- **FR-020**: Thay đổi lộ trình lớp PHẢI có hiệu lực từ kế hoạch được sinh kế tiếp, giữ nguyên tiến độ, lịch ôn và bài đã hoàn thành của học viên; đơn vị bị vô hiệu hóa PHẢI tự biến mất khỏi lộ trình lớp và giáo viên PHẢI được thông báo.
- **FR-021**: Onboarding của học viên vào lớp PHẢI được rút gọn (tên hiển thị, ngôn ngữ, múi giờ), không hỏi mục tiêu, trình độ, thời gian mỗi ngày, kỹ năng. Với học viên đã có hồ sơ và lộ trình cá nhân, lộ trình cá nhân PHẢI được tạm ngưng (không xóa) trong thời gian thuộc lớp; tiến độ và lịch ôn đã có PHẢI được giữ và tiếp tục.
- **FR-022**: Chỉ giáo viên phụ trách (hoặc chủ tổ chức) tạm dừng và tiếp tục được cho một học viên hoặc cả lớp. Khoảng tạm dừng KHÔNG ĐƯỢC tính là bỏ lỡ, chậm tiến độ hay phát sinh cảnh báo. Giáo viên PHẢI dời được mốc ngày của lớp. Sau khoảng nghỉ hoặc vắng, kế hoạch học viên PHẢI được cân đối lại để không dồn khối lượng bù (cùng nguyên tắc FR-015 của spec 001).
- **FR-023**: Giáo viên PHẢI có thể chọn các đơn vị học đang hoạt động từ thư viện, thêm, bớt, sắp xếp thứ tự và đặt ngày mở cho từng đơn vị. Đơn vị chưa đến ngày mở KHÔNG ĐƯỢC xuất hiện trong kế hoạch hay phần học thêm của học viên thuộc lớp.
- **FR-024**: Giáo viên PHẢI có thể giao một hoặc nhiều đơn vị học kèm hạn nộp. Học viên PHẢI thấy bài giao và hạn trong kế hoạch; bài giao quá hạn chưa hoàn thành PHẢI tiếp tục xuất hiện cho đến khi xong; hệ thống PHẢI ghi lại hoàn thành đúng hạn hay trễ hạn.
- **FR-025**: Khi giáo viên đặt lộ trình hoặc giao bài, hệ thống PHẢI cảnh báo nếu khối lượng ước tính cần hoàn thành trước mốc/hạn vượt quỹ thời gian sẵn có của học viên (số ngày còn lại × số phút mỗi ngày); cảnh báo KHÔNG chặn lưu và KHÔNG làm kế hoạch hằng ngày vượt quỹ thời gian.
- **FR-026**: Giáo viên PHẢI có thể ghi đè theo từng học viên: miễn một đơn vị (không vào kế hoạch, không tính vào mẫu số hoàn thành), đặt số phút mỗi ngày riêng, dời mốc ngày riêng. Học viên PHẢI thấy rằng giáo viên đã điều chỉnh cho mình.

**Bảng điều khiển, cảnh báo và báo cáo**

- **FR-027**: Bảng điều khiển lớp PHẢI hiển thị, cho mỗi học viên: tỷ lệ hoàn thành lộ trình lớp, chuỗi ngày học, thời gian học (7 ngày gần nhất và tổng từ khi vào lớp), độ chính xác khi ôn, ngày học gần nhất, trạng thái tiến độ so với mốc; kèm một dòng tổng hợp cả lớp; hỗ trợ sắp xếp và lọc.
- **FR-028**: Trạng thái tiến độ so với mốc PHẢI được tính bằng cách so tỷ lệ đơn vị bắt buộc thực tế đã hoàn thành với tỷ lệ mong đợi theo lộ trình lớp tại ngày hiện tại (loại trừ đơn vị được miễn và khoảng tạm dừng). Học viên "chậm" khi thấp hơn mong đợi quá 10 điểm phần trăm (cấu hình được) hoặc có bài giao quá hạn chưa hoàn thành; "vượt" khi cao hơn mong đợi quá 10 điểm phần trăm; còn lại là "đúng tiến độ". Học viên đang tạm dừng hiển thị "đang tạm dừng".
- **FR-029**: Chi tiết một học viên PHẢI gồm: tiến độ theo từng đơn vị của lộ trình lớp, thời gian học theo ngày trong 30 ngày gần nhất, độ chính xác, các mảng yếu (ngưỡng chung FR-029 của spec 001), tình trạng từng bài giao, và kết quả kiểm tra trình độ nếu có.
- **FR-030**: Số liệu trên bảng điều khiển PHẢI lấy từ cùng nguồn dữ liệu học tập đã ghi (bản ghi học tập, tiến độ đơn vị, thống kê chủ đề), nhất quán với số liệu học viên tự thấy (khối "tiến độ trong lớp" ở FR-036, cùng cửa sổ kể từ lúc vào lớp). Giáo viên CHỈ thấy hoạt động từ thời điểm học viên vào lớp.
- **FR-031**: Hệ thống PHẢI hiển thị cảnh báo trong ứng dụng cho: học viên không học liên tiếp từ N ngày (mặc định 3, giáo viên chỉnh trong khoảng 1–14), học viên chậm tiến độ, và học viên có bài giao quá hạn. Học viên đang tạm dừng KHÔNG bị cảnh báo. Gửi cảnh báo qua email hoặc thông báo đẩy nằm ngoài phạm vi.
- **FR-032**: Hệ thống PHẢI hiển thị danh sách chủ đề yếu của cả lớp: chủ đề có độ chính xác gộp của lớp dưới 60% trên ít nhất 30 câu lượt chính (cả trong bài học và ôn tập), kèm số học viên bị gắn cờ yếu ở chủ đề đó và danh sách các học viên ấy; xếp theo mức yếu giảm dần.
- **FR-033**: Giáo viên (cho lớp mình phụ trách) và chủ tổ chức PHẢI xuất được báo cáo CSV của lớp (mỗi học viên một dòng với số liệu của FR-027) và báo cáo chi tiết một học viên. Tiếng Việt và tiếng Nhật PHẢI hiển thị đúng khi mở bằng bảng tính phổ biến; giá trị ô bắt đầu bằng ký tự có thể bị hiểu là công thức PHẢI được vô hiệu hóa.
- **FR-034**: Giáo viên PHẢI có thể yêu cầu cả lớp làm bài kiểm tra trình độ đầu vào hiện có; xem kết quả từng học viên và phân bố trình độ ước tính của lớp; mời học viên chuyển sang lớp khác trong phạm vi quyền của mình, học viên đồng ý thì mới chuyển (FR-014). Kết quả kiểm tra KHÔNG ĐƯỢC tự động đổi lộ trình lớp.

**Quyền riêng tư và vòng đời thành viên**

- **FR-035**: Giáo viên phụ trách và chủ tổ chức CHỈ được xem về học viên trong lớp: tên hiển thị, email, tiến độ, thời gian học, độ chính xác tổng hợp, mảng yếu, chuỗi ngày học, trạng thái bài giao, kết quả kiểm tra trình độ. KHÔNG ĐƯỢC xem: mật khẩu hay phiên đăng nhập, hoạt động trước ngày vào lớp, dữ liệu hồ sơ cá nhân ngoài phạm vi trên, và từng câu trả lời riêng lẻ.
- **FR-036**: Học viên thuộc lớp PHẢI có trang "Lớp của tôi" hiển thị tên lớp, tổ chức, giáo viên, lộ trình lớp, bài giao và hạn, các điều chỉnh riêng của giáo viên cho mình, và danh sách chính xác dữ liệu mà giáo viên và chủ tổ chức xem được (FR-035).
- **FR-037**: Học viên PHẢI có thể tự chuyển sang lộ trình cá nhân (rời lớp) bất cứ lúc nào, và vào lại lớp khi được mời lại hoặc nhập lại mã (FR-016) và còn seat. Khi chuyển sang lộ trình cá nhân, bị gỡ, bị thu hồi seat hoặc lớp bị lưu trữ: seat được giải phóng; giáo viên và chủ tổ chức mất quyền xem dữ liệu học viên ngay lập tức, kể cả phiên đang mở; tài khoản trở về chế độ cá nhân với toàn bộ quyền kiểm soát (FR-016 của spec 001) được khôi phục; lịch sử học, lịch ôn, tiến độ của học viên PHẢI được giữ nguyên; lộ trình cá nhân đang tạm ngưng PHẢI được khôi phục, còn nếu học viên chưa có hồ sơ cá nhân thì họ đi qua onboarding cá nhân như người dùng mới.
- **FR-038**: Khi seat hết hiệu lực (hết kỳ hạn sau ân hạn, tổ chức bị vô hiệu hóa), các học viên giữ seat PHẢI được xử lý như FR-037. Chủ tổ chức và giáo viên vẫn xem được cấu trúc lớp và danh sách thành viên nhưng KHÔNG xem được dữ liệu học của người đã mất seat; giáo viên mất seat giữ nguyên vai trò nhưng chỉ xem được cấu trúc cho tới khi được cấp lại seat sau gia hạn; sau khi gia hạn, học viên PHẢI được mời lại và xác nhận lại (FR-016).
- **FR-039**: Khi học viên xóa tài khoản theo FR-003 của spec 001, tổ chức PHẢI mất quyền xem dữ liệu của họ ngay lập tức và seat PHẢI được giải phóng.
- **FR-040**: Khi giáo viên hoặc chủ tổ chức bị gỡ vai trò, họ PHẢI mất quyền tương ứng ngay lập tức. Lớp không còn giáo viên phụ trách PHẢI được cảnh báo cho chủ tổ chức; học viên của lớp vẫn học theo lộ trình lớp.

**Chất lượng, tương thích và ngôn ngữ**

- **FR-041**: Người học không thuộc lớp nào PHẢI tiếp tục nhận hành vi lộ trình, kế hoạch hằng ngày, ôn tập và tiến độ không đổi so với trước khi có tính năng này.
- **FR-042**: Toàn bộ màn hình, thông báo và email mới (tổ chức, lớp, bảng điều khiển, lời mời, "Lớp của tôi") PHẢI có tiếng Việt và tiếng Anh theo ngôn ngữ người dùng đã chọn (nhất quán với FR-019a của spec 001).
- **FR-043**: Hành vi lộ trình khi có lớp, phân quyền cô lập giữa tổ chức/lớp, vòng đời seat và các phép tính của bảng điều khiển PHẢI được xác minh bằng kiểm thử tự động trên các hồ sơ đại diện: học viên mới hoàn toàn trong lớp 10 phút, học viên có tiến độ cá nhân vào lớp giữa chừng, học viên vắng nhiều ngày, học viên bị miễn bài, bài giao quá hạn, giáo viên đổi lộ trình giữa chừng, tạm dừng cả lớp, và người học cá nhân không thuộc lớp (không đổi so với trước).

**Ngoài phạm vi tính năng này**: thanh toán và gia hạn seat tự động, hóa đơn VAT, nội dung học riêng của tổ chức (tải từ vựng, bài học riêng), thông báo đẩy và email cảnh báo cho giáo viên, đăng nhập một lần (SSO) và tích hợp hệ thống nhân sự, giao diện di động, giáo viên chấm bài viết hoặc hội thoại, học viên thuộc nhiều lớp cùng lúc, lộ trình khác nhau giữa các học viên trong cùng lớp ngoài các ghi đè ở FR-026, chế độ lai (vừa thuộc lớp vừa tự điều chỉnh lộ trình), phân quyền tổ chức nhiều cấp (chi nhánh, phòng ban).

### Thực thể chính

- **Tổ chức (Organization)**: Trung tâm tiếng Nhật hoặc đơn vị mua seat; có tên, trạng thái (hoạt động/vô hiệu hóa), chủ tổ chức, các giấy phép seat. Là ranh giới cô lập dữ liệu.
- **Thành viên tổ chức (Organization Member)**: Liên kết giữa một tài khoản và một tổ chức với vai trò (chủ tổ chức, giáo viên, học viên); mỗi tài khoản có tối đa một liên kết đang hoạt động.
- **Giấy phép seat (Seat License)**: Số seat được cấp cho tổ chức trong một kỳ hạn (ngày bắt đầu, ngày kết thúc, thời gian ân hạn), giới hạn số lần đổi người giữ mỗi seat.
- **Seat**: Một chỗ đang gán cho tối đa một tài khoản giáo viên hoặc học viên (chủ tổ chức không chiếm seat); ghi nhận số lần đã đổi người giữ trong kỳ hạn.
- **Lớp (Class)**: Nhóm học viên của một tổ chức; có tên, mô tả, trạng thái, một hoặc nhiều giáo viên phụ trách, mã tham gia và một lộ trình lớp.
- **Thành viên lớp (Class Member)**: Học viên trong lớp, kèm trạng thái (đã vào, lời mời chờ, học viên đã từ chối, đã chuyển sang lộ trình cá nhân, bị gỡ), thời điểm vào lớp (mốc bắt đầu hiển thị dữ liệu cho giáo viên).
- **Lời mời (Invitation)**: Lời mời một email vào lớp hoặc vào vai trò giáo viên; dùng một lần, có hạn dùng, có thể thu hồi.
- **Mã tham gia (Join Code)**: Mã của lớp để học viên tự vào; có thể bật/tắt/đổi, hạn dùng tùy chọn.
- **Lộ trình lớp (Class Path)**: Tham số mẫu của lớp (trình độ xuất phát/đích, kỹ năng, mốc ngày, số phút mỗi ngày) và danh sách đơn vị tùy chọn có thứ tự cùng ngày mở. Nguồn lộ trình của mọi học viên trong lớp; được tính động.
- **Bài giao (Assignment)**: Một hoặc nhiều đơn vị học giao cho lớp kèm hạn nộp; theo dõi hoàn thành đúng/trễ hạn theo học viên.
- **Ghi đè cá nhân (Learner Override)**: Điều chỉnh của giáo viên cho một học viên: đơn vị được miễn, số phút mỗi ngày riêng, độ dời mốc ngày.
- **Khoảng tạm dừng của lớp/học viên (Class Pause Period)**: Khoảng thời gian giáo viên tạm dừng cả lớp hoặc một học viên; không bị tính là bỏ lỡ.
- **Cảnh báo (Alert)**: Trạng thái cần chú ý của học viên (vắng N ngày, chậm tiến độ, bài giao quá hạn), tính từ dữ liệu học; không phải thông báo gửi đi.
- **Yêu cầu kiểm tra trình độ của lớp (Class Placement Request)**: Yêu cầu của giáo viên cho cả lớp làm bài kiểm tra trình độ; liên kết tới kết quả kiểm tra hiện có của từng học viên.
- **Hồ sơ học tập (Learning Profile)** *(đã có, mở rộng)*: học viên thuộc lớp lấy mục tiêu, trình độ, thời gian mỗi ngày, kỹ năng từ lớp; hồ sơ cá nhân cũ được giữ nguyên để khôi phục khi rời lớp.
- **Lộ trình học (Learning Path)** *(đã có, mở rộng)*: bổ sung khái niệm nguồn lộ trình (cá nhân hoặc lớp).
- **Nhật ký hành động quản trị (Admin Action Log)** *(đã có, mở rộng)*: ghi thêm hành động của chủ tổ chức và giáo viên.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: Quản trị viên tạo tổ chức, cấp seat và chỉ định chủ tổ chức trong tối đa 5 phút; chủ tổ chức từ lúc nhận lời mời đến lúc mời xong giáo viên đầu tiên trong tối đa 10 phút.
- **SC-002**: Giáo viên mới tạo lớp, đặt lộ trình theo mẫu và gửi lời mời cho 30 học viên bằng file CSV trong tối đa 10 phút, chỉ dùng giao diện (không cần nhân sự nhà cung cấp hỗ trợ); đo bằng phiên thử có bấm giờ.
- **SC-003**: 100% kế hoạch hằng ngày mặc định của học viên thuộc lớp (kiểm thử trên các hồ sơ ở mức 5/10/15/30 phút) bám đúng lộ trình lớp (đúng trình độ, kỹ năng, đơn vị đã mở) và có tổng thời lượng ước tính không vượt số phút mỗi ngày áp dụng cho học viên đó; không bài hay gói ôn nào ước tính quá 15 phút.
- **SC-004**: 100% truy cập trái quyền trong bộ kiểm thử phân quyền (chéo tổ chức, chéo lớp, giáo viên không phụ trách, học viên xem dữ liệu của người khác, vai trò tổ chức dùng công cụ quản trị hệ thống) bị từ chối, không có trường hợp rò rỉ dữ liệu hay tiết lộ sự tồn tại.
- **SC-005**: Sau khi giáo viên thay đổi lộ trình lớp, 100% học viên của lớp thấy thay đổi trong kế hoạch được sinh kế tiếp mà không mất tiến độ, lịch ôn hay bài đã hoàn thành.
- **SC-006**: Bảng điều khiển của lớp 50 học viên hiển thị đầy đủ trong tối đa 3 giây, và 100% số đếm và độ chính xác khớp với hoạt động đã ghi kể từ lúc vào lớp và với khối "tiến độ trong lớp" của từng học viên.
- **SC-007**: Giáo viên xác định được học viên cần chú ý (vắng, chậm, bài giao quá hạn) trong tối đa 2 lần nhấp từ bảng điều khiển; 100% học viên đúng điều kiện cảnh báo trong bộ dữ liệu kiểm thử có cảnh báo, và học viên đang tạm dừng không có cảnh báo.
- **SC-008**: 100% yêu cầu xem dữ liệu của một học viên đã rời lớp, bị gỡ, mất seat hoặc đã xóa tài khoản bị từ chối ngay sau thời điểm đó (kể cả phiên đang mở của giáo viên); 100% lịch sử học, lịch ôn, tiến độ của học viên vẫn nguyên vẹn cho chính họ.
- **SC-009**: 100% file CSV xuất ra khớp với số liệu bảng điều khiển; 0 ô trong bộ kiểm thử chứa giá trị công thức bị thực thi khi mở bằng bảng tính phổ biến; ký tự tiếng Việt và tiếng Nhật hiển thị đúng.
- **SC-010**: Trong lớp thử nghiệm đầu tiên, ít nhất 70% học viên học ít nhất 3 ngày trong tuần thứ 4 kể từ khi vào lớp (đo từ dữ liệu học tập đã ghi).
- **SC-011** *(chỉ số sau phát hành, đo bằng khảo sát, không có công việc xây dựng đi kèm)*: Trong khảo sát giáo viên của lớp thử nghiệm, ít nhất 80% giáo viên cho biết họ không còn cần bảng tính riêng để theo dõi tiến độ học tập của lớp.
- **SC-012**: 100% người học không thuộc lớp nào (gồm bộ hồ sơ đại diện hiện có) nhận kế hoạch, ôn tập và tiến độ giống kết quả trước khi có tính năng này.
- **SC-013**: 100% lời mời và lần nhập mã hiển thị đủ hai lựa chọn (vào lớp / tiếp tục lộ trình cá nhân) cùng thông báo dữ liệu chia sẻ trước khi học viên bị tính seat; học viên chuyển giữa lộ trình lớp và lộ trình cá nhân trong tối đa 3 lần nhấp (không tính bước xác nhận) và nhận kế hoạch đúng nguồn ở lần sinh kế tiếp.

## Giả định

- Hiến pháp v1.2.0 đã cho phép tính năng này (làm rõ Nguyên tắc III về lớp học, bổ sung mô-đun "Organization & Class Management" và gán Giai đoạn 1.5); kế hoạch triển khai vẫn PHẢI có mục Constitution Check đối chiếu Nguyên tắc I–VI.
- Khách đầu tiên là trung tâm tiếng Nhật ở Việt Nam; giáo viên là người dùng chính; giai đoạn này không thiết kế riêng cho công ty (quản lý nhân sự). Tính năng giữ cấu trúc đủ chung để mở rộng cho công ty về sau.
- Việc cấp, gia hạn, thu hồi seat là thao tác thủ công của quản trị viên hệ thống; giá và hợp đồng nằm ngoài hệ thống.
- Học viên chọn vào lớp bằng cách chấp nhận lời mời hoặc nhập mã (có xác nhận), nên sự đồng ý về chia sẻ dữ liệu được thể hiện ở thời điểm vào lớp; học viên rời lớp là cách rút lại sự đồng ý.
- Học viên có thể tự chuyển sang lộ trình cá nhân (rời lớp) bất cứ lúc nào, kể cả khi trung tâm muốn giữ họ; trung tâm chỉ kiểm soát được việc học viên có seat hay không, không kiểm soát được việc học viên rời đi. Trung tâm có thể mời lại học viên bất cứ lúc nào.
- Một lớp tối đa 100 học viên; một tổ chức có thể có nhiều lớp. Giới hạn này, hạn lời mời (14 ngày), thời gian ân hạn (7 ngày), giới hạn đổi seat (2 lần/kỳ hạn), ngưỡng vắng (3 ngày), biên độ chậm/vượt tiến độ (10 điểm phần trăm) và ngưỡng điểm yếu của lớp (60% trên 30 câu) là giá trị mặc định cấu hình được, có thể hiệu chỉnh sau khi chạy thử với khách đầu tiên.
- Các giá trị mặc định cấu hình được khác: khóa nhập mã tham gia sau 5 lần sai liên tiếp trong 15 phút, khóa 15 phút (theo tài khoản); tối đa 50 email mỗi lần gửi lời mời thủ công; file CSV tối đa 200 dòng và 256 KB.
- Phạm vi nội dung dùng đúng thư viện hiện có (từ vựng, ngữ pháp, Kanji; trình độ N5–N3); giáo viên không tạo nội dung riêng ở giai đoạn này.
- Học viên của lớp dùng ứng dụng web trên máy tính như người học thường; bảng điều khiển giáo viên được tối ưu cho trình duyệt máy tính.
- Dịch vụ gửi email giao dịch của spec 001 được tái sử dụng cho lời mời; việc đăng ký tài khoản không yêu cầu xác minh email vẫn giữ nguyên, nên lời mời đồng thời là cách xác nhận người nhận có quyền với email đó.
- Hệ thống lộ trình tính động, kế hoạch hằng ngày, ôn tập lặp lại ngắt quãng, theo dõi tiến độ, bài kiểm tra trình độ, nhật ký quản trị và quy tắc xóa tài khoản của spec `001-phase1-mvp`, cùng nội dung Kanji của spec `003-kanji-lessons`, đã hoàn tất và được tái sử dụng; spec này chỉ mở rộng chúng.
- Giáo viên chỉ thấy số liệu tổng hợp theo học viên, không thấy từng câu trả lời riêng lẻ, để giảm rủi ro quyền riêng tư; nếu sau này giáo viên cần xem từng câu trả lời, việc đó phải được thêm bằng một thay đổi spec riêng.
