# Đặc tả tính năng: Giai đoạn 1 – MVP (Ứng dụng web học tiếng Nhật cá nhân hóa)

**Nhánh tính năng**: `001-phase1-mvp` (không có git repository; chỉ là tên thư mục)

**Ngày tạo**: 2026-11-04

**Trạng thái**: Đã lập kế hoạch (đã có `plan.md` và `tasks.md`; chờ triển khai)

**Giai đoạn**: Giai đoạn 1 – MVP (theo hiến pháp dự án; các tính năng của Giai đoạn 2–4 nằm ngoài phạm vi)

**Đầu vào**: Mô tả của người dùng: "Phase 1 – MVP" (phạm vi được định nghĩa trong `requirement.txt` §7: Web App, tài khoản, đánh giá trình độ đầu vào, thiết lập mục tiêu, lộ trình cá nhân hóa, bài học ngắn, từ vựng, ngữ pháp, ôn tập và theo dõi tiến độ)

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (1) bắt đầu học mà không cần tự xây dựng kế hoạch; (2) bài học hằng ngày vừa trong 5–15 phút; (3) lộ trình phù hợp trình độ và mục tiêu; (5) theo dõi được tiến độ và mức đạt mục tiêu; (6) kiến trúc cho phép mở rộng từ Web sang Mobile (được giữ khả năng, không bàn giao). Tiêu chí (4), phát hiện điểm yếu kèm gợi ý cải thiện, ở giai đoạn này chỉ được hỗ trợ ở mức cơ bản (mục chưa nhớ được ôn thường xuyên hơn); phân tích điểm yếu nâng cao thuộc Giai đoạn 2.

## Làm rõ

### Phiên 2026-11-04

- Hỏi: Giao diện ứng dụng, nghĩa từ vựng và phần giải thích ngữ pháp nên viết bằng ngôn ngữ nào cho người học? → Đáp: Tiếng Việt và tiếng Anh ngay từ khi ra mắt, người học tự chọn ngôn ngữ giao diện.
- Hỏi: Câu trả lời trong bài tập và ôn tập được chấm thế nào và kết quả ghi nhớ được ghi nhận ra sao? → Đáp: Chỉ dùng bài tập khách quan tự động chấm (trắc nghiệm, ghép cặp, điền từ với tập đáp án cố định); đúng/sai là kết quả ghi nhớ.
- Hỏi: Dữ liệu của người học sẽ ra sao khi họ xóa tài khoản? → Đáp: Vô hiệu hóa ngay, sau đó xóa vĩnh viễn sau thời gian chờ 30 ngày, trong thời gian đó người học có thể khôi phục tài khoản.
- Hỏi: Bài kiểm tra trình độ đầu vào nên dài bao nhiêu và được xây dựng thế nào? → Đáp: Bộ câu hỏi cố định khoảng 20 câu (từ vựng và ngữ pháp, trải rộng N5–N3), tối đa 10 phút.
- Hỏi: Đặt lại mật khẩu khi quên được thực hiện thế nào? → Đáp: Liên kết đặt lại dùng một lần gửi qua email, hết hạn sau 1 giờ; đăng ký không yêu cầu xác minh email.
- Hỏi: Trong 30 ngày chờ xóa, email của tài khoản đang chờ xóa có được dùng để đăng ký tài khoản mới không? → Đáp: Không; hệ thống báo email đang chờ xóa và gợi ý đăng nhập để khôi phục tài khoản cũ.
- Hỏi: SC-003 đo "điểm xuất phát được chấp nhận" cho nhóm người học nào? → Đáp: Tất cả người học hoàn tất onboarding, báo cáo riêng hai nhóm (có và không làm bài kiểm tra trình độ), mỗi nhóm đạt ít nhất 80%.
- Hỏi: "Vô hiệu hóa ngay lập tức" khi xóa tài khoản có áp dụng cho các phiên khác đang mở không? → Đáp: Chặn đăng nhập/làm mới ngay; các phiên đang mở của chính chủ tài khoản mất quyền truy cập chậm nhất sau 15 phút (thời hạn access token).
- Hỏi: Gói ôn tập trong kế hoạch ngày được ước lượng thời gian và giới hạn thế nào? → Đáp: Mỗi mục ôn được ước lượng 30 giây (cấu hình `REVIEW_SECONDS_PER_ITEM`); mỗi gói ôn là một phiên học, tối đa 15 phút, phần ôn lớn hơn được chia thành nhiều gói.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Nhận kế hoạch cá nhân và bắt đầu học ngay (Ưu tiên: P1)

Một người đi làm biết ít hoặc biết một phần tiếng Nhật đăng ký tài khoản, cho biết trình độ hiện tại, mục tiêu và thời gian mỗi ngày, tùy chọn làm bài kiểm tra trình độ ngắn, và ngay lập tức nhận được lộ trình học cá nhân kèm bài học đầu tiên của hôm nay, mà không phải tự thiết kế kế hoạch.

**Lý do ưu tiên**: Đây là lời hứa cốt lõi của sản phẩm. Không có tạo tài khoản, thu thập hồ sơ/mục tiêu và lộ trình được sinh ra thì các phần còn lại không có ngữ cảnh để hoạt động.

**Kiểm thử độc lập**: Đăng ký tài khoản mới, hoàn tất onboarding (có và không làm bài kiểm tra trình độ), và xác minh lộ trình cùng "bài học hôm nay" được hiển thị và khớp với trình độ, mục tiêu và thời gian đã khai báo.

**Kịch bản chấp nhận**:

1. **Với** một khách chưa có tài khoản, **Khi** họ đăng ký với thông tin hợp lệ và đăng nhập, **Thì** họ vào onboarding và sau khi hoàn tất sẽ thấy lộ trình cá nhân và bài học hôm nay.
2. **Với** một người học đang trong onboarding, **Khi** họ chọn bỏ qua bài kiểm tra trình độ, **Thì** lộ trình được xây dựng từ trình độ và mục tiêu tự khai báo và họ có thể bắt đầu học.
3. **Với** một người học làm bài kiểm tra trình độ, **Khi** họ hoàn thành, **Thì** kết quả được hiển thị và lộ trình bắt đầu ở nội dung phù hợp với kết quả đó thay vì chỉ dựa vào trình độ tự khai báo.
4. **Với** một người học khai báo 10 phút mỗi ngày, **Khi** lộ trình được sinh ra, **Thì** kế hoạch của mỗi ngày được định cỡ để vừa trong 10 phút.
5. **Với** một người học chưa biết tiếng Nhật, **Khi** họ hoàn tất onboarding, **Thì** lộ trình bắt đầu bằng nền tảng cho người mới.
6. **Với** một người học đã có lộ trình, **Khi** họ chọn làm lại bài kiểm tra trình độ và hoàn thành, **Thì** kết quả mới được hiển thị và họ được hỏi có muốn xây dựng lại lộ trình theo kết quả mới hay giữ lộ trình hiện tại; lịch sử học và lịch ôn tập được giữ nguyên.

---

### Câu chuyện người dùng 2 - Hoàn thành bài học ngắn hằng ngày (Ưu tiên: P1)

Mỗi ngày người học mở ứng dụng, thấy hôm nay cần học và ôn gì cùng thời lượng dự kiến, và hoàn thành các bài học ngắn (từ vựng và ngữ pháp) có bài tập thực hành chứ không chỉ đọc.

**Lý do ưu tiên**: Bài học ngắn hằng ngày là giá trị chính được cung cấp; lộ trình vô ích nếu không có bài học để học.

**Kiểm thử độc lập**: Với một lộ trình đã sinh, mở kế hoạch hôm nay, hoàn thành từng mục, và xác minh phiên học kết thúc trong khoảng 5–15 phút, kết quả được ghi lại và ngày được đánh dấu hoàn thành.

**Kịch bản chấp nhận**:

1. **Với** một người học có lộ trình đang hoạt động, **Khi** họ mở ứng dụng, **Thì** họ thấy kế hoạch hôm nay (bài mới, bài ôn, tổng thời gian ước tính) mà không phải đưa ra lựa chọn nào.
2. **Với** một bài học từ vựng hoặc ngữ pháp, **Khi** người học học qua bài, **Thì** họ nhận được giải thích ngắn cùng bài tập thực hành với phản hồi đúng/sai tức thì.
3. **Với** một người học hoàn thành mọi mục trong kế hoạch hôm nay, **Khi** mục cuối cùng được hoàn thành, **Thì** ngày được đánh dấu hoàn thành và hiển thị tóm tắt kết quả.
4. **Với** một người học dừng giữa chừng bài học, **Khi** họ quay lại sau trong cùng ngày, **Thì** họ tiếp tục từ chỗ đã dừng mà không mất các câu trả lời đã ghi.
5. **Với** một người học đã hoàn thành kế hoạch hôm nay, **Khi** họ muốn học thêm, **Thì** họ có thể tùy chọn tiếp tục với nội dung bổ sung, nhưng kế hoạch mặc định hằng ngày không bao giờ vượt quá thời gian đã khai báo.

---

### Câu chuyện người dùng 3 - Ôn lại những gì sắp quên (Ưu tiên: P2)

Hệ thống lên lịch ôn lại từ vựng (và điểm ngữ pháp) đã học theo khoảng cách tăng dần dựa trên mức độ nhớ của người học với từng mục, và đưa các bài ôn đến hạn vào kế hoạch hằng ngày.

**Lý do ưu tiên**: Lặp lại ngắt quãng (spaced repetition) là phương pháp đã cam kết và thúc đẩy ghi nhớ lâu dài, nhưng phụ thuộc vào việc bài học đã tồn tại trước.

**Kiểm thử độc lập**: Học một tập mục, trả lời đúng một số và sai một số khi ôn, và xác minh ngày ôn kế tiếp khác nhau (muộn hơn cho câu đúng, sớm hơn cho câu sai) và các mục đến hạn xuất hiện trong kế hoạch hằng ngày.

**Kịch bản chấp nhận**:

1. **Với** các mục người học đã học, **Khi** chúng đến hạn, **Thì** chúng xuất hiện trong phần ôn tập của kế hoạch ngày đó.
2. **Với** một mục ôn trả lời đúng, **Khi** kết quả được ghi nhận, **Thì** lần ôn kế tiếp được lên lịch xa hơn khoảng cách trước đó.
3. **Với** một mục ôn trả lời sai, **Khi** kết quả được ghi nhận, **Thì** nó được lên lịch lại sớm hơn và xuất hiện thường xuyên hơn các mục nhớ tốt.
4. **Với** số bài ôn đến hạn nhiều hơn mức vừa trong quỹ thời gian hằng ngày, **Khi** kế hoạch được xây dựng, **Thì** các mục quá hạn lâu nhất được ưu tiên và phần còn lại chuyển sang ngày sau, không vượt quá quỹ thời gian.

---

### Câu chuyện người dùng 4 - Theo dõi tiến độ và mức đạt mục tiêu (Ưu tiên: P2)

Người học xem tiến độ của mình: thời gian đã học, kết quả, mức hoàn thành, chuỗi ngày học liên tiếp, và mức độ gần đạt mục tiêu.

**Lý do ưu tiên**: Tiến độ nhìn thấy được duy trì thói quen hằng ngày, và theo dõi là một mô-đun thuộc phạm vi MVP, nhưng chỉ có dữ liệu khi đã có bài học và bài ôn.

**Kiểm thử độc lập**: Sau vài ngày học, mở màn hình tiến độ và xác minh thời gian, độ chính xác, số bài đã hoàn thành, chuỗi ngày và tiến độ mục tiêu khớp với hoạt động đã ghi.

**Kịch bản chấp nhận**:

1. **Với** một người học có lịch sử học, **Khi** họ mở tiến độ, **Thì** họ thấy thời gian đã học, số bài đã hoàn thành, độ chính xác khi ôn và số ngày học liên tiếp.
2. **Với** một người học có mục tiêu và mốc thời gian đã nêu, **Khi** họ mở tiến độ, **Thì** họ thấy tỷ lệ nội dung của mục tiêu đã hoàn thành và việc họ có đang đúng tiến độ so với ngày mục tiêu hay không.
3. **Với** một người học mới chưa có lịch sử, **Khi** họ mở tiến độ, **Thì** họ thấy trạng thái trống rõ ràng thay vì lỗi hoặc các số 0 trông như thất bại.
4. **Với** một người học liên tục làm kém ở một mảng nội dung (ví dụ: một nhóm ngữ pháp), **Khi** họ mở tiến độ, **Thì** mảng đó được hiển thị là điểm yếu kèm chỉ báo cơ bản (độ chính xác thấp), và mảng không còn kém sau các lần ôn tốt hơn sẽ không còn bị đánh dấu.

---

### Câu chuyện người dùng 5 - Tự điều chỉnh kế hoạch (Ưu tiên: P2)

Người học có thể ghi đè hệ thống: đổi mục tiêu, đổi thời gian mỗi ngày, tạm dừng và tiếp tục lộ trình, ưu tiên một kỹ năng (từ vựng hoặc ngữ pháp trong MVP), đánh dấu nội dung đã thành thạo, và yêu cầu xây dựng lại toàn bộ lộ trình. Lộ trình cũng tự thích ứng theo kết quả và các khoảng nghỉ học.

**Lý do ưu tiên**: Hiến pháp yêu cầu người học kiểm soát, và việc thích ứng giữ lộ trình luôn phù hợp, nhưng luồng cốt lõi vẫn hoạt động khi thiếu phần này.

**Kiểm thử độc lập**: Lần lượt thay đổi từng thiết lập và xác minh lộ trình cùng kế hoạch ngày hôm sau phản ánh thay đổi; bỏ qua vài ngày và xác minh kế hoạch được cân đối lại khi quay lại.

**Kịch bản chấp nhận**:

1. **Với** một lộ trình đang hoạt động, **Khi** người học đổi thời gian mỗi ngày từ 10 lên 15 phút, **Thì** các kế hoạch hằng ngày tiếp theo dùng quỹ thời gian mới.
2. **Với** một lộ trình đang hoạt động, **Khi** người học đổi mục tiêu, **Thì** lộ trình được sinh lại để ưu tiên nội dung liên quan đến mục tiêu mới, đồng thời giữ nguyên lịch sử và lịch ôn tập.
3. **Với** một lộ trình đang hoạt động, **Khi** người học tạm dừng, **Thì** không có kế hoạch ngày nào được sinh ra hay tính là bị bỏ lỡ cho đến khi họ tiếp tục.
4. **Với** nội dung người học đã biết, **Khi** họ đánh dấu là đã thành thạo, **Thì** nó bị loại khỏi các bài học sắp tới.
5. **Với** một người học liên tục đạt điểm thấp (hoặc cao) ở một mảng nội dung, **Khi** kế hoạch được xây dựng lần tiếp theo, **Thì** độ khó của mảng đó được giảm (hoặc tăng).
6. **Với** một người học quay lại sau vài ngày vắng mặt, **Khi** họ mở ứng dụng, **Thì** kế hoạch được điều chỉnh (ví dụ: lượng ôn tồn đọng ở mức xử lý được thay vì khối lượng bù khổng lồ) thay vì hiển thị các ngày bỏ lỡ như một khoản nợ.
7. **Với** một người học yêu cầu xây dựng lại toàn bộ lộ trình, **Khi** họ xác nhận, **Thì** lộ trình được sinh lại từ hồ sơ và kết quả hiện tại của họ.

---

### Câu chuyện người dùng 6 - Quản trị nội dung và người dùng với vai trò quản trị viên (Ưu tiên: P3)

Quản trị viên quản lý tài khoản người học và nội dung học tập (từ vựng, bài ngữ pháp, bài tập, câu hỏi kiểm tra trình độ) mà không cần phát hành phiên bản mới của ứng dụng.

**Lý do ưu tiên**: Phải có nội dung thì mới vận hành được sản phẩm, nhưng có thể nạp một bộ dữ liệu mẫu tối thiểu trước; quản lý đầy đủ là thứ yếu so với trải nghiệm người học.

**Kiểm thử độc lập**: Với tư cách quản trị viên, thêm và sửa một mục từ vựng và một bài ngữ pháp, rồi xác minh người học thấy thay đổi; đồng thời xem và vô hiệu hóa một tài khoản người học.

**Kịch bản chấp nhận**:

1. **Với** một quản trị viên đã đăng nhập, **Khi** họ tạo hoặc sửa một đơn vị học, **Thì** thay đổi có sẵn cho người học mà không cần cập nhật client.
2. **Với** một quản trị viên, **Khi** họ tìm một tài khoản người học, **Thì** họ có thể xem trạng thái và vô hiệu hóa hoặc kích hoạt lại tài khoản đó.
3. **Với** một người học không phải quản trị viên, **Khi** họ cố truy cập chức năng quản trị, **Thì** truy cập bị từ chối.

---

### Câu chuyện người dùng 7 - Quản lý hồ sơ, ngôn ngữ và tài khoản (Ưu tiên: P3)

Người học xem và sửa hồ sơ, chọn ngôn ngữ giao diện (tiếng Việt hoặc tiếng Anh), và có thể xóa hoặc khôi phục tài khoản của mình.

**Lý do ưu tiên**: Cần cho quyền kiểm soát dữ liệu và trải nghiệm song ngữ, nhưng luồng học cốt lõi vẫn chạy được khi chưa có phần này.

**Kiểm thử độc lập**: Đổi ngôn ngữ và thông tin hồ sơ rồi xác minh được lưu; xóa tài khoản, xác minh bị chặn đăng nhập, khôi phục trong 30 ngày, và quá hạn thì dữ liệu bị xóa.

**Kịch bản chấp nhận**:

1. **Với** một người học đã đăng nhập, **Khi** họ sửa tên hiển thị, email, mật khẩu, thời gian mỗi ngày hoặc mục tiêu, **Thì** thay đổi được lưu và phản ánh ở các kế hoạch tiếp theo.
2. **Với** một người học, **Khi** họ đổi ngôn ngữ từ tiếng Việt sang tiếng Anh, **Thì** giao diện, nghĩa từ vựng, giải thích ngữ pháp và phản hồi bài tập chuyển sang tiếng Anh, trong khi chữ Nhật, cách đọc và câu ví dụ giữ nguyên; lựa chọn được lưu trong hồ sơ.
3. **Với** một người học mới đăng ký, **Khi** họ vào ứng dụng lần đầu, **Thì** ngôn ngữ mặc định là tiếng Việt.
4. **Với** một người học chọn xóa tài khoản, **Khi** họ xác nhận, **Thì** tài khoản bị chặn đăng nhập ngay, phiên hiện tại bị đăng xuất, và dữ liệu bị ẩn với mọi phiên khác chậm nhất sau 15 phút.
5. **Với** một tài khoản đang trong 30 ngày chờ xóa, **Khi** chủ tài khoản đăng nhập, **Thì** họ có thể khôi phục tài khoản cùng toàn bộ dữ liệu học tập.
6. **Với** một tài khoản quá 30 ngày chờ xóa, **Khi** thời hạn kết thúc, **Thì** tài khoản và dữ liệu học tập cá nhân bị xóa vĩnh viễn và không khôi phục được.

---

### Câu chuyện người dùng 8 - Dùng thử khi chưa đăng ký (Ưu tiên: P2)

Một khách chưa có tài khoản có thể trải nghiệm thử ứng dụng ngay từ trang đầu: học một bài mẫu ngắn (từ vựng và ngữ pháp) có bài tập và phản hồi tức thì, và tùy chọn làm bài kiểm tra trình độ, mà không phải đăng ký hay cung cấp thông tin cá nhân. Sau khi dùng thử, khách được mời đăng ký để nhận lộ trình cá nhân; kết quả dùng thử được mang sang để họ không phải làm lại.

**Lý do ưu tiên**: Giảm rào cản trước khi đăng ký và giúp khách thấy giá trị sản phẩm sớm, hỗ trợ mục tiêu chuyển đổi (SC-009, SC-011). Đây là phần bổ sung cho Câu chuyện 1 nên không chặn luồng cốt lõi.

**Kiểm thử độc lập**: Ở trạng thái chưa đăng nhập, hoàn thành bài học mẫu và bài kiểm tra trình độ, xác minh không có lộ trình hay kế hoạch hằng ngày nào được tạo; sau đó đăng ký và xác minh kết quả kiểm tra được mang sang onboarding.

**Kịch bản chấp nhận**:

1. **Với** một khách chưa đăng nhập ở trang đầu, **Khi** họ chọn "Dùng thử", **Thì** họ vào được bài học mẫu mà không phải nhập email, mật khẩu hay bất kỳ thông tin cá nhân nào.
2. **Với** một khách đang dùng thử, **Khi** họ học bài mẫu, **Thì** họ nhận được giải thích ngắn và bài tập thực hành với phản hồi đúng/sai tức thì như người học đã đăng ký, và hoàn thành trong khoảng 10 phút (hai đơn vị mẫu, mỗi đơn vị 5 phút).
3. **Với** một khách đang dùng thử, **Khi** họ chọn làm bài kiểm tra trình độ, **Thì** họ thấy kết quả (trình độ ước tính, mảng mạnh/yếu) nhưng không được tạo lộ trình hay kế hoạch hằng ngày.
4. **Với** một khách đã dùng thử, **Khi** họ cố truy cập tính năng chỉ dành cho người học đã đăng ký (lộ trình, kế hoạch hằng ngày, ôn tập, tiến độ, điều chỉnh kế hoạch), **Thì** họ được giải thích tính năng cần tài khoản và được mời đăng ký.
5. **Với** một khách đã hoàn thành bài kiểm tra trình độ khi dùng thử, **Khi** họ đăng ký và vào onboarding, **Thì** kết quả kiểm tra được dùng sẵn để sinh lộ trình mà họ không phải làm lại bài kiểm tra.
6. **Với** một khách đã dùng thử, **Khi** họ rời đi mà không đăng ký, **Thì** hệ thống không lưu bất kỳ dữ liệu nào có thể định danh họ.

---

### Các trường hợp biên

- Khách làm xong toàn bộ nội dung dùng thử và muốn học tiếp → hiển thị thông báo rõ ràng rằng nội dung dùng thử đã hết và mời đăng ký, thay vì để trống hoặc lặp lại.
- Khách đóng trình duyệt hoặc xóa dữ liệu trình duyệt giữa lúc dùng thử → kết quả dùng thử có thể mất; khách được phép dùng thử lại từ đầu mà không báo lỗi.
- Khách đăng ký bằng thiết bị/trình duyệt khác với nơi đã dùng thử → kết quả dùng thử không được mang sang; onboarding diễn ra bình thường như Câu chuyện 1.
- Lượng truy cập dùng thử ẩn danh tăng bất thường (lạm dụng) → hệ thống giới hạn tần suất để không ảnh hưởng người học đã đăng ký.
- Đăng ký bằng email đã được dùng, email sai định dạng hoặc mật khẩu yếu → báo lỗi rõ ràng, cụ thể mà không tiết lộ dữ liệu của người dùng khác.
- Đăng ký bằng email của tài khoản đang trong thời gian chờ xóa 30 ngày → bị từ chối kèm thông báo email đang chờ xóa và gợi ý đăng nhập để khôi phục tài khoản cũ.
- Quên mật khẩu → người học có thể đặt lại qua liên kết đặt lại gửi qua email; liên kết đã hết hạn hoặc đã dùng sẽ bị từ chối kèm gợi ý yêu cầu liên kết mới.
- Người học bỏ dở onboarding giữa chừng → tiến độ onboarding được giữ; khi quay lại họ có thể tiếp tục hoặc làm lại từ đầu.
- Bài kiểm tra trình độ bị bỏ dở hoặc trả lời ngẫu nhiên (toàn sai hoặc đoán mò) → người học có thể làm lại hoặc bỏ qua, và lộ trình vẫn bắt đầu ở mức an toàn, thân thiện với người mới.
- Thời gian khai báo rất ít (5 phút) trong khi có nhiều bài ôn đến hạn → kế hoạch vẫn nằm trong 5 phút; phần tồn đọng chuyển sang ngày sau. Vì một đơn vị mới tối thiểu 5 phút nên ngày 5 phút chỉ gồm HOẶC bài ôn HOẶC một đơn vị mới, luân phiên: ngay sau một ngày chỉ có bài ôn thì ngày kế tiếp ưu tiên đơn vị mới (nếu còn), để người học không bị kẹt chỉ ôn mãi.
- Người học học hết nội dung hiện có cho trình độ/mục tiêu của mình → hiển thị thông báo rõ ràng và gợi ý mảng nội dung tiếp theo thay vì một kế hoạch trống.
- Người học muốn cải thiện kỹ năng mà MVP chưa có (nghe, đọc, Kanji) → onboarding và màn hình điều chỉnh kế hoạch hiển thị các kỹ năng này dưới dạng tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này", để người học biết các kỹ năng nào có trong phiên bản này; chỉ từ vựng và ngữ pháp chọn được.
- Người học khai báo trình độ N2/N1 hoặc mục tiêu JLPT N2/N1 trong khi nội dung MVP chỉ có N5–N3 → người học được thông báo rõ phạm vi nội dung hiện có ngay khi onboarding; lộ trình dùng N3 làm trần và tiến độ mục tiêu được tính trên phần nội dung hiện có.
- Mất kết nối giữa chừng bài học → các câu trả lời đã ghi được giữ; người học có thể thử lại và không bị báo là đã hoàn thành bài khi chưa được lưu.
- Người học đánh dấu mọi thứ là đã thành thạo → hệ thống yêu cầu xác nhận trước khi đánh dấu đơn vị cuối cùng, sau đó gợi ý nâng trình độ hoặc làm lại bài kiểm tra trình độ; nếu đã ở trần nội dung N3 thì hiển thị thông báo hết nội dung như trường hợp học hết nội dung.
- Cùng một tài khoản dùng ở hai cửa sổ trình duyệt cùng lúc → tiến độ không bị tính trùng hay hỏng dữ liệu.
- Quản trị viên sửa nội dung khi người học đang học giữa chừng → phiên đang học của người học không bị gián đoạn.
- Múi giờ / ranh giới ngày → "hôm nay" dựa trên ngày theo giờ địa phương của người học; chuỗi ngày học không bị đứt khi di chuyển qua múi giờ.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Tài khoản và hồ sơ**

- **FR-001**: Khách PHẢI có thể đăng ký tài khoản bằng email và mật khẩu, đăng nhập, đăng xuất, và đặt lại mật khẩu đã quên qua liên kết đặt lại dùng một lần gửi qua email, hết hạn sau 1 giờ. Đăng ký không yêu cầu xác minh email. Do đó hệ thống phụ thuộc vào một dịch vụ gửi email giao dịch bên ngoài.
- **FR-002**: Người học PHẢI có thể xem và sửa hồ sơ của mình (tên hiển thị, email, mật khẩu, thời gian mỗi ngày, mục tiêu, ngôn ngữ).
- **FR-003**: Người học PHẢI có thể xóa tài khoản và dữ liệu học tập liên quan. Việc xóa vô hiệu hóa tài khoản ngay lập tức: chặn đăng nhập và làm mới phiên, phiên thực hiện xóa bị đăng xuất, mọi phiên mới chỉ được khôi phục tài khoản; các phiên khác đang mở của chính chủ tài khoản mất quyền truy cập dữ liệu chậm nhất sau 15 phút (khi access token hết hạn); người học có thể khôi phục trong thời gian chờ 30 ngày bằng cách đăng nhập; trong thời gian này email đó KHÔNG ĐƯỢC dùng để đăng ký tài khoản mới (hệ thống báo email đang chờ xóa và gợi ý khôi phục tài khoản cũ), sau đó tài khoản và toàn bộ dữ liệu học tập cá nhân bị xóa vĩnh viễn (chỉ có thể còn lại các thống kê tổng hợp đã ẩn danh).
- **FR-004**: Hệ thống PHẢI phân biệt vai trò người học và quản trị viên, và giới hạn các chức năng quản trị cho quản trị viên. Tài khoản quản trị viên KHÔNG ĐƯỢC tạo qua đăng ký công khai; chúng được tạo hoặc nâng quyền bằng công cụ vận hành nội bộ, và mỗi lần cấp quyền được ghi lại như FR-032.

**Dùng thử không cần đăng ký**

- **FR-036**: Hệ thống PHẢI cho phép khách chưa đăng ký dùng thử mà không yêu cầu email, mật khẩu hay thông tin cá nhân, gồm ít nhất một bài học mẫu (từ vựng và ngữ pháp) có bài tập tự chấm và phản hồi tức thì, cùng bài kiểm tra trình độ theo FR-007.
- **FR-037**: Nội dung dùng thử PHẢI là một tập đơn vị học mẫu cố định, có giới hạn, do quản trị viên chỉ định từ thư viện nội dung hiện có (FR-030); khách KHÔNG ĐƯỢC nhận lộ trình, kế hoạch hằng ngày, lịch ôn tập, theo dõi tiến độ hay các chức năng điều chỉnh kế hoạch. Giao diện dùng thử PHẢI hỗ trợ cả tiếng Việt và tiếng Anh như FR-019a.
- **FR-038**: Hệ thống CÓ THỂ lưu một lượng thông tin hạn chế về khách dùng thử trên máy chủ (ví dụ: bộ đếm theo ngày số lượt tải nội dung dùng thử, số lượt hoàn thành bài mẫu, số lượt hoàn thành bài kiểm tra trình độ và phân bố trình độ ước tính), với điều kiện thông tin đó KHÔNG ĐƯỢC chứa dữ liệu định danh hay nhạy cảm (email, tên, địa chỉ IP, mã định danh thiết bị/trình duyệt) và KHÔNG ĐƯỢC liên kết được tới một cá nhân cụ thể, để không ảnh hưởng đến bảo mật thông tin. Trạng thái chi tiết và câu trả lời dùng thử PHẢI chỉ được giữ tạm thời ở phía trình duyệt của khách.
- **FR-039**: Khi khách đăng ký sau khi dùng thử trên cùng trình duyệt, hệ thống PHẢI mang các câu trả lời bài kiểm tra trình độ (nếu có) sang onboarding để máy chủ chấm lại và dùng kết quả cho việc sinh lộ trình, và PHẢI cho phép người học bỏ kết quả đó để làm lại.
- **FR-040**: Hệ thống PHẢI giới hạn tần suất truy cập dùng thử ẩn danh để bảo vệ hiệu năng dành cho người học đã đăng ký.

**Onboarding, mục tiêu và đánh giá trình độ**

- **FR-005**: Trong onboarding hệ thống PHẢI thu thập: trình độ hiện tại (chưa biết gì, N5, N4, N3, N2, N1), mục tiêu (JLPT, giao tiếp hằng ngày, sử dụng trong công việc), thời gian rảnh mỗi ngày (chọn một trong 5, 10, 15 hoặc 30 phút), mốc thời gian mong muốn đạt mục tiêu, và các kỹ năng muốn cải thiện (từ vựng và ngữ pháp trong giai đoạn này).
- **FR-006**: Hệ thống PHẢI cung cấp bài kiểm tra trình độ và PHẢI cho phép người học bỏ qua bất cứ lúc nào mà không bị bất lợi.
- **FR-007**: Bài kiểm tra trình độ PHẢI là bộ 20 câu hỏi từ vựng và ngữ pháp cố định (8 câu N5, 6 câu N4, 6 câu N3), hoàn thành được trong tối đa 10 phút, và PHẢI cho ra kết quả (trình độ ước tính và các mảng mạnh/yếu) làm đầu vào cho việc sinh lộ trình.
- **FR-008**: Người học bỏ qua bài kiểm tra trình độ VẪN PHẢI nhận được lộ trình hoạt động được tạo từ hồ sơ khai báo.
- **FR-009**: Người học PHẢI có thể làm lại bài kiểm tra trình độ sau đó.

**Lộ trình cá nhân hóa và kế hoạch hằng ngày**

- **FR-010**: Hệ thống PHẢI sinh lộ trình học riêng cho từng người học từ trình độ, mục tiêu, thời gian mỗi ngày, mốc thời gian, kỹ năng mong muốn và kết quả kiểm tra trình độ; KHÔNG ĐƯỢC áp một lộ trình cố định cho mọi người học.
- **FR-011**: Nội dung học PHẢI được tổ chức thành các đơn vị học rời rạc mà lộ trình phân bổ riêng lẻ vào từng ngày.
- **FR-012**: Hệ thống PHẢI tạo kế hoạch hằng ngày nêu rõ cần học gì, ôn gì và thời lượng ước tính; kế hoạch mặc định KHÔNG ĐƯỢC vượt quá thời gian mỗi ngày mà người học đã khai báo.
- **FR-013**: Hệ thống PHẢI điều chỉnh độ khó dựa trên kết quả đã ghi (dễ hơn sau nhiều lần điểm thấp, khó hơn sau khi điểm liên tục cao).
- **FR-014**: Hệ thống PHẢI tăng tần suất ôn tập cho những mục người học chưa nhớ được.
- **FR-015**: Sau một khoảng nghỉ học, hệ thống PHẢI lập lại kế hoạch để người học quay lại nhận được kế hoạch xử lý được thay vì toàn bộ khối lượng tồn đọng.
- **FR-016**: Người học PHẢI có thể đổi mục tiêu, đổi thời gian mỗi ngày, tạm dừng và tiếp tục lộ trình, ưu tiên một kỹ năng, đánh dấu nội dung đã thành thạo, và yêu cầu xây dựng lại toàn bộ lộ trình; mỗi thay đổi PHẢI được phản ánh trong các kế hoạch tiếp theo.

**Bài học và nội dung**

- **FR-017**: Mỗi bài học PHẢI hoàn thành được trong 5–15 phút trong một lần ngồi học. Mỗi gói ôn tập trong kế hoạch hằng ngày cũng là một phiên học và KHÔNG ĐƯỢC ước tính quá 15 phút; phần ôn vượt mức này PHẢI được chia thành nhiều gói.
- **FR-018**: MVP PHẢI cung cấp bài học từ vựng và bài học ngữ pháp, mỗi bài kết hợp giải thích với bài tập thực hành (học bằng làm) và phản hồi tức thì cho câu trả lời.
- **FR-019**: Mục từ vựng PHẢI gồm dạng tiếng Nhật, cách đọc và nghĩa, và NÊN có câu ví dụ; điểm ngữ pháp PHẢI có giải thích và ít nhất một ví dụ.
- **FR-019a**: Giao diện và nội dung giải thích (nghĩa từ vựng, giải thích ngữ pháp, phản hồi bài tập) PHẢI có bằng tiếng Việt và tiếng Anh; người học PHẢI có thể chọn và đổi ngôn ngữ giao diện/nội dung (mặc định tiếng Việt), và lựa chọn này PHẢI được lưu trong Hồ sơ học tập. Dạng chữ tiếng Nhật, cách đọc và câu ví dụ giữ nguyên tiếng Nhật.
- **FR-020**: Người học PHẢI có thể rời bài học và tiếp tục mà không mất các câu trả lời đã ghi.
- **FR-021**: Nội dung PHẢI được gắn thẻ trình độ và mức liên quan đến mục tiêu để lộ trình có thể chọn.
- **FR-022**: Nội dung PHẢI được quản lý như dữ liệu độc lập với bản phát hành ứng dụng, để nội dung mới hoặc đã sửa có sẵn mà không cần cập nhật client.

**Ôn tập (lặp lại ngắt quãng)**

- **FR-023**: Hệ thống PHẢI lên lịch ôn các mục đã học bằng lặp lại ngắt quãng dựa trên kết quả ghi nhớ đã ghi.
- **FR-024**: Các bài ôn đến hạn PHẢI được đưa vào kế hoạch hằng ngày, ưu tiên theo mức quá hạn, trong quỹ thời gian.
- **FR-025**: Bài ôn và bài tập thực hành PHẢI chỉ dùng bài tập khách quan tự động chấm (trắc nghiệm, ghép cặp, điền từ với tập đáp án chấp nhận cố định); giai đoạn này không có câu trả lời gõ tự do hoặc tự đánh giá. Kết quả đúng/sai của mỗi câu trả lời là kết quả ghi nhớ và PHẢI cập nhật lần ôn kế tiếp của mục đó.

**Theo dõi tiến độ**

- **FR-026**: Hệ thống PHẢI ghi lại thời gian học, mức hoàn thành bài học và kết quả bài tập/ôn tập cho từng người học.
- **FR-027**: Người học PHẢI có thể xem thời gian đã học, số bài đã hoàn thành, độ chính xác khi ôn và chuỗi ngày học.
- **FR-028**: Người học PHẢI có thể xem tiến độ hướng tới mục tiêu và việc họ có đang đúng tiến độ so với mốc thời gian mục tiêu hay không.
- **FR-029**: Hệ thống PHẢI nhận diện các mảng nội dung người học làm kém và hiển thị cho người học (chỉ chỉ báo điểm yếu cơ bản; phân tích sâu hơn thuộc Giai đoạn 2).

**Quản trị**

- **FR-030**: Quản trị viên PHẢI có thể tạo, sửa, kích hoạt/vô hiệu hóa và sắp xếp các đơn vị học, mục từ vựng, điểm ngữ pháp, bài tập và câu hỏi kiểm tra trình độ.
- **FR-031**: Quản trị viên PHẢI có thể xem các tài khoản người học và vô hiệu hóa hoặc kích hoạt lại chúng.
- **FR-032**: Các thay đổi của quản trị viên PHẢI được ghi lại kèm ai thực hiện và khi nào.

**Nền tảng và chất lượng**

- **FR-033**: Ứng dụng PHẢI được cung cấp dưới dạng ứng dụng web dùng được trên các trình duyệt desktop hiện hành, với UX tối ưu cho desktop.
- **FR-034**: Hệ thống PHẢI giữ dữ liệu của người học riêng tư với chủ tài khoản và các quản trị viên có vai trò hợp lệ, và PHẢI giữ an toàn khi lưu trữ và truyền tải, cụ thể: mọi kết nối giữa trình duyệt và máy chủ chỉ qua HTTPS; mật khẩu chỉ lưu dưới dạng băm một chiều; CSDL và bản sao lưu được mã hóa khi lưu trữ (ở mức hạ tầng); người học không truy cập được dữ liệu của người học khác.
- **FR-041**: Khi cùng một tài khoản được dùng ở nhiều cửa sổ trình duyệt đồng thời, hệ thống PHẢI ghi mỗi câu trả lời và khoảng thời gian học đúng một lần (idempotent), không làm hỏng lịch ôn tập hay tiến độ.
- **FR-035**: Hành vi của công cụ học tập (sinh lộ trình, điều chỉnh độ khó, lên lịch ôn tập) PHẢI được xác minh bằng kiểm thử tự động trên các hồ sơ người học đại diện (ví dụ: người mới/10 phút, N3/30 phút, quay lại sau khoảng nghỉ).

**Ngoài phạm vi giai đoạn này** (hoãn sang các giai đoạn sau theo hiến pháp): luyện nghe và đọc, bài học Kanji, cá nhân hóa AI nâng cao và phân tích điểm yếu sâu, ứng dụng di động, đồng bộ đa thiết bị, thông báo đẩy/nhắc học, AI tutor, các tính năng hội thoại và phát âm.

### Thực thể chính

- **Tài khoản người học (Learner Account)**: Danh tính đăng nhập và vai trò của một người; sở hữu hồ sơ và toàn bộ dữ liệu học tập.
- **Hồ sơ học tập (Learning Profile)**: Trình độ hiện tại, mục tiêu, thời gian mỗi ngày, mốc thời gian, kỹ năng mong muốn, ngôn ngữ (tiếng Việt/tiếng Anh), tùy chọn và trạng thái tạm dừng.
- **Bài đánh giá / Kết quả đánh giá trình độ (Placement Assessment / Result)**: Một bộ câu hỏi, các câu trả lời của người học, và trình độ ước tính cùng các mảng yếu rút ra.
- **Đơn vị học (Learning Unit)**: Một phần nội dung ngắn, rời rạc (một tập từ vựng hoặc một điểm ngữ pháp kèm bài tập) có trình độ, thẻ mục tiêu, thời lượng ước tính và độ khó.
- **Mục từ vựng / Điểm ngữ pháp (Vocabulary Item / Grammar Point)**: Các đơn vị nội dung nhỏ nhất nằm trong đơn vị học, với cách đọc, nghĩa, giải thích và ví dụ.
- **Bài tập (Exercise)**: Một câu hỏi thực hành gắn với đơn vị hoặc mục, kèm đáp án đúng và phản hồi.
- **Lộ trình học (Learning Path)**: Việc phân bổ có thứ tự và điều chỉnh được các đơn vị học của người học hướng tới mục tiêu.
- **Kế hoạch hằng ngày (Daily Plan)**: Tập các bài học mới và bài ôn đến hạn của một ngày kèm thời lượng ước tính.
- **Bản ghi học tập / Kết quả (Study Record / Result)**: Bản ghi một lần làm bài tập hoặc bài học của người học (thời gian, đúng/sai, hoàn thành).
- **Lịch ôn tập (Review Schedule)**: Theo từng người học và từng mục: lịch sử ghi nhớ và ngày đến hạn kế tiếp.
- **Tóm tắt tiến độ (Progress Summary)**: Cái nhìn tổng hợp trên các bản ghi học tập: thời gian, mức hoàn thành, độ chính xác, chuỗi ngày, tiến độ mục tiêu và các mảng yếu.
- **Phiên dùng thử (Trial Session)**: Trạng thái tạm thời của khách chưa đăng ký ở phía trình duyệt (tiến độ bài mẫu, câu trả lời, kết quả kiểm tra trình độ); không gắn với tài khoản và có thể được mang sang onboarding khi đăng ký.
- **Nhật ký hành động quản trị (Administrator Action Log)**: Ai đã thay đổi nội dung hoặc tài khoản nào, và khi nào.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: Một khách mới có thể đăng ký, hoàn tất onboarding và bắt đầu bài học đầu tiên trong chưa đầy 5 phút (không tính bài kiểm tra trình độ tùy chọn), mà không phải tự xây dựng kế hoạch.
- **SC-002**: 100% kế hoạch hằng ngày mặc định có tổng thời lượng ước tính không vượt quá thời gian mỗi ngày mà người học đã khai báo, và không bài học hay gói ôn riêng lẻ nào được ước tính quá 15 phút. Thời gian ở đây là thời lượng ước tính của đơn vị học (`est_minutes`), khớp với ràng buộc cứng của FR-012; thời gian học thực tế được ghi nhận riêng để theo dõi tiến độ (FR-026).
- **SC-003**: Ít nhất 80% người học hoàn tất onboarding được đưa đến điểm xuất phát mà họ chấp nhận mà không phải thay đổi (đo bằng việc không có yêu cầu xây dựng lại lộ trình hay đổi trình độ trong tuần đầu). Báo cáo riêng hai nhóm, người làm và người bỏ qua bài kiểm tra trình độ; mỗi nhóm PHẢI đạt ít nhất 80%. Số liệu được trích xuất bằng truy vấn báo cáo từ dữ liệu đã ghi (kết quả placement, lộ trình, yêu cầu xây dựng lại).
- **SC-004**: Ít nhất 90% người học có thể hoàn thành bài học hằng ngày đầu tiên mà không cần trợ giúp hay hướng dẫn nào ngoài ứng dụng (đo bằng kiểm thử khả dụng thủ công với nhóm người dùng thử nghiệm).
- **SC-005**: Các mục trả lời sai được đưa lại vào ôn tập trung bình sớm hơn các mục trả lời đúng, được xác minh trên các hồ sơ kiểm thử đại diện.
- **SC-006**: 100% các thay đổi do người học ghi đè (mục tiêu, thời gian mỗi ngày, tạm dừng/tiếp tục, ưu tiên kỹ năng, nội dung đã thành thạo, xây dựng lại) có hiệu lực trong kế hoạch được sinh ra kế tiếp.
- **SC-007**: Người học xem được tiến độ hiện tại và trạng thái mục tiêu trong vòng 2 lần nhấp từ màn hình hằng ngày, và các số liệu khớp với hoạt động đã ghi.
- **SC-008**: Quản trị viên có thể thêm một bài học mới và bài học có sẵn cho người học mà không cần phát hành ứng dụng: trong vòng 5 phút, bài học xuất hiện trong lộ trình của người học phù hợp và chọn được qua "học thêm"; nó được đưa vào kế hoạch hằng ngày từ kế hoạch được sinh kế tiếp. Nội dung đã sửa hiển thị cho các phiên học mới trong vòng 5 phút.
- **SC-009**: Ít nhất 40% người học hoàn tất onboarding quay lại vào ngày thứ hai, và ít nhất 25% hoàn thành bài học trong 3 ngày trở lên trong hai tuần đầu.
- **SC-010**: Ứng dụng vẫn phản hồi tốt khi dùng thông thường: màn hình bài học và phản hồi câu trả lời xuất hiện trong vòng 1 giây (tính từ thao tác của người học đến khi hiển thị trên trình duyệt) cho 95% tương tác ở tải bình thường. "Tải bình thường" là tối đa 1.000 người học đồng thời đang học (mức trên của quy mô giai đoạn đầu ở mục Giả định).
- **SC-011**: Khách chưa đăng ký bắt đầu được bài học mẫu trong vòng 3 lần nhấp từ trang đầu mà không phải nhập thông tin nào, và ít nhất 20% khách hoàn thành bài mẫu chuyển sang đăng ký, đo bằng tỷ lệ giữa số tài khoản đăng ký kèm cờ `fromTrial` (đăng ký ngay sau khi dùng thử trên cùng trình duyệt) và bộ đếm ẩn danh số lượt hoàn thành bài mẫu (FR-038).
- **SC-012**: Trong kiểm thử dùng cùng một tài khoản ở hai cửa sổ trình duyệt đồng thời, 100% câu trả lời và thời gian học chỉ được tính một lần và không có dữ liệu bị hỏng.

## Giả định

- Người dùng chính là nhân viên văn phòng nói tiếng Việt (đặc tả gốc bằng tiếng Việt); ứng dụng và nội dung giải thích được cung cấp bằng cả tiếng Việt (mặc định) và tiếng Anh ngay từ khi ra mắt (xem mục Làm rõ).
- Đăng ký bằng email và mật khẩu là đủ cho MVP; không yêu cầu đăng nhập mạng xã hội/SSO.
- Thư viện nội dung ban đầu có giới hạn và tập trung vào từ vựng và ngữ pháp N5–N3, do đội dự án biên soạn; mở rộng nội dung vượt phạm vi đó là công việc tương lai.
- Dùng thử chỉ gồm nội dung mẫu cố định và bài kiểm tra trình độ, không lưu trên máy chủ; chỉ các câu trả lời bài kiểm tra trình độ được mang sang khi đăng ký để máy chủ chấm lại (không mang tiến độ bài mẫu). Các giá trị cụ thể (số đơn vị mẫu, ngưỡng giới hạn tần suất) được chốt ở giai đoạn lập kế hoạch.
- Việc học miễn phí trong MVP; thanh toán và gói đăng ký nằm ngoài phạm vi.
- "Cá nhân hóa" trong MVP dựa trên quy tắc và theo kết quả của người học; cá nhân hóa AI dựa trên machine learning thuộc Giai đoạn 2.
- Kanji, nghe và đọc không được bàn giao trong MVP (chúng nằm trong phạm vi mô-đun dài hạn nhưng không thuộc phạm vi Giai đoạn 1 trong `requirement.txt`).
- Web là mục tiêu phân phối duy nhất; mã nguồn được thiết kế đa nền tảng theo hiến pháp, nhưng không bàn giao bản build di động.
- Người dùng có trình duyệt desktop hiện đại và kết nối internet ổn định; dùng ngoại tuyến nằm ngoài phạm vi.
- Thông báo và nhắc học không có trong MVP (Giai đoạn 3); hỗ trợ thói quen hằng ngày trong MVP là kế hoạch, chuỗi ngày và hiển thị tiến độ.
- Lượng người học điển hình ở giai đoạn đầu ra mắt ở mức khiêm tốn (hàng trăm đến vài nghìn người học đồng thời).
- Việc quản trị do một đội nội bộ nhỏ, đáng tin cậy thực hiện.
