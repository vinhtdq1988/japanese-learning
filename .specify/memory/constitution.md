<!--
Báo cáo tác động đồng bộ (tạm thời; xóa trước khi commit)
- Thay đổi phiên bản: 1.0.0 → 1.1.0 (MINOR – mở rộng phạm vi Giai đoạn 1)
- Nguyên tắc được sửa:
  - IV. Phương pháp học dựa trên bằng chứng: lặp lại ngắt quãng áp dụng cho cả Kanji
    (trước đây chỉ nêu từ vựng).
- Mục được sửa:
  - Ràng buộc công nghệ & phạm vi: Giai đoạn 1 (MVP) bổ sung "Kanji (N5–N3, nhận diện
    nghĩa/cách đọc, không luyện viết)"; luyện viết tay Kanji ghi rõ là ngoài phạm vi Giai đoạn 1.
- Mục thêm mới: không. Mục bị xóa: không.
- Thay đổi không mang tính ngữ nghĩa: toàn bộ văn bản dịch sang tiếng Việt theo CLAUDE.md
  (tên nguyên tắc dịch, nội dung quy tắc giữ nguyên).
- Ghi chú di trú:
  - `specs/001-phase1-mvp`: giữ nguyên (đã hoãn Kanji); không trở thành vi phạm vì Kanji
    được giao cho spec `003-kanji-lessons`.
  - `specs/003-kanji-lessons/plan.md`: sai lệch "Phạm vi theo giai đoạn" không còn cần biện
    minh; NÊN cập nhật Constitution Check sang v1.1.0 và đánh dấu đề xuất sửa hiến pháp là đã
    áp dụng; `spec.md` (dòng Giai đoạn, mục Giả định) NÊN cập nhật tương ứng.
- TODO hoãn lại: không.
-->
# Hiến pháp Nền tảng Học tiếng Nhật

## Nguyên tắc cốt lõi

### I. Ưu tiên học vi mô (Micro-Learning First)
Mỗi phiên học hằng ngày PHẢI hoàn thành được trong 5–15 phút. Nội dung PHẢI được biên soạn
thành các đơn vị học ngắn, học xong trong một lần ngồi, và kế hoạch hằng ngày KHÔNG ĐƯỢC
vượt quỹ thời gian người học đã khai báo (ví dụ 5, 10, 15 hoặc 30 phút).
Lý do: người dùng mục tiêu là nhân viên văn phòng ít thời gian học cố định; phiên học không
vừa với ngày của họ là phiên học không diễn ra.

### II. Bộ máy học tập cá nhân hóa (Personalized Learning Engine)
Lộ trình học PHẢI được sinh riêng cho từng người học từ trình độ, mục tiêu, thời gian mỗi
ngày, mốc thời gian mục tiêu, kỹ năng mong muốn và kết quả đánh giá. Hệ thống KHÔNG ĐƯỢC áp
một lộ trình cố định duy nhất (như N5 → N4 → N3) cho mọi người dùng. Nội dung PHẢI được mô
hình hóa thành các đơn vị học rời rạc để Learning Engine phân bổ linh hoạt, điều chỉnh độ khó
theo kết quả quan sát được, tăng tần suất ôn cho mục chưa nhớ và lập lại kế hoạch sau khi
người học bị gián đoạn. Bộ máy PHẢI quyết định và trình bày mỗi ngày học gì, ôn gì và trong
bao lâu.
Lý do: cá nhân hóa là điểm khác biệt cốt lõi của sản phẩm và là nền tảng cho các giai đoạn
AI Tutor về sau.

### III. Người học nắm quyền kiểm soát (Learner Control)
Người học PHẢI bắt đầu học được ngay mà không cần tự xây dựng kế hoạch, và cũng PHẢI ghi đè
được quyết định của hệ thống. Tối thiểu người học có thể: đổi mục tiêu, điều chỉnh thời gian
mỗi ngày, tạm dừng và tiếp tục lộ trình, ưu tiên một kỹ năng, bỏ qua nội dung đã thành thạo,
bỏ qua bài đánh giá xếp lớp và yêu cầu dựng lại toàn bộ lộ trình. Tự động hóa KHÔNG ĐƯỢC loại
bỏ các lựa chọn này.
Lý do: tự động hóa thích ứng chỉ được tin tưởng khi người dùng luôn có thể sửa nó.

### IV. Phương pháp học dựa trên bằng chứng (Evidence-Based Learning Methods)
Tính năng PHẢI dựa trên các phương pháp sản phẩm cam kết: học vi mô, spaced repetition (lặp
lại ngắt quãng) để ôn từ vựng và Kanji, học qua thực hành (đọc, nghe, viết và luyện tập thay
vì tiếp nhận nội dung thụ động), học thích ứng và xây dựng thói quen hằng ngày. Lịch ôn PHẢI
được điều khiển bởi kết quả ghi nhớ đã ghi lại. Tiến độ (thời gian học, kết quả, mức hoàn
thành, điểm yếu, mức đạt mục tiêu) PHẢI được theo dõi và hiển thị cho người học.
Lý do: các phương pháp này là lời hứa của sản phẩm; tính năng đi vòng qua chúng làm loãng lời
hứa đó.

### V. Đa nền tảng, ưu tiên Web (Cross-Platform, Web-First)
Client PHẢI được xây dựng bằng Flutter. Giai đoạn 1 nhắm tới trình duyệt web trên máy tính,
và các quyết định UX/UI được tối ưu cho môi trường này. Tuy vậy, mọi mã nguồn PHẢI được viết
theo hướng đa nền tảng: hành vi riêng của nền tảng PHẢI được cô lập sau các lớp trừu tượng để
có thể thêm Android/iOS từ cùng codebase. Việc phát hành mobile nằm ngoài phạm vi cho tới
Giai đoạn 3.
Lý do: mở rộng từ Web sang Mobile KHÔNG ĐƯỢC đòi hỏi xây lại hệ thống.

### VI. Kiến trúc tách biệt (Separated Architecture)
Frontend, Backend và Nội dung học PHẢI là các phần tách biệt với hợp đồng rõ ràng giữa
chúng. Backend cung cấp REST API (hoặc tương đương) và sở hữu việc lưu trữ tài khoản, hồ sơ
học tập, nội dung và tiến độ. Nội dung học PHẢI là dữ liệu được quản lý độc lập với mã client,
để có thể thêm hoặc sửa mà không cần phát hành client.
Lý do: sự tách biệt giúp hệ thống dễ mở rộng cho loại nội dung mới, client mới và các tính
năng AI nâng cao.

## Ràng buộc công nghệ & phạm vi

- **Framework**: Flutter cho mọi ứng dụng client.
- **Backend**: REST API hoặc tương đương; stack cụ thể được quyết định trong kế hoạch triển
  khai và PHẢI tuân thủ Nguyên tắc VI.
- **Dữ liệu**: một cơ sở dữ liệu lưu tài khoản, hồ sơ học tập, nội dung và tiến độ.
- **Xác thực**: bắt buộc có đăng ký, đăng nhập và quản lý tài khoản.
- **Các mô-đun trong phạm vi**: User Management, Learning Assessment, Learning Goal,
  Personalized Learning, Learning Content (từ vựng, Kanji, ngữ pháp, nghe, đọc), Daily
  Learning, Review System, Progress Tracking, Notification, Admin Management.
- **Phân giai đoạn**: công việc PHẢI được giới hạn trong giai đoạn đang thực hiện.
  - Giai đoạn 1 (MVP): ứng dụng Web, tài khoản, đánh giá xếp lớp, đặt mục tiêu, lộ trình cá
    nhân hóa, bài học ngắn, từ vựng, ngữ pháp, Kanji (N5–N3, nhận diện nghĩa/cách đọc, không
    luyện viết), ôn tập, theo dõi tiến độ. Luyện viết tay Kanji (thứ tự nét, nhận dạng chữ
    viết) nằm ngoài phạm vi Giai đoạn 1.
  - Giai đoạn 2: cá nhân hóa AI nâng cao, luyện nghe và đọc, phân tích điểm yếu, gợi ý điều
    chỉnh lộ trình.
  - Giai đoạn 3: ứng dụng Android/iOS, đồng bộ đa thiết bị, thông báo nhắc học.
  - Giai đoạn 4: AI Tutor, luyện hội thoại, đánh giá phát âm, luyện nói theo tình huống công
    việc.
- Tính năng của giai đoạn sau KHÔNG ĐƯỢC xây sớm trừ khi hiến pháp được sửa đổi hoặc kế hoạch
  ghi lại lý do biện minh rõ ràng.

## Quy trình phát triển & cổng chất lượng

- Mỗi đặc tả tính năng PHẢI nêu rõ thuộc giai đoạn nào và hỗ trợ tiêu chí thành công nào:
  1. người học bắt đầu học được mà không cần tự xây dựng kế hoạch;
  2. bài học hằng ngày vừa trong 5–15 phút;
  3. lộ trình phù hợp với trình độ và mục tiêu của người học;
  4. phát hiện điểm yếu và gợi ý cải thiện;
  5. theo dõi được tiến độ và mức đạt mục tiêu;
  6. Web mở rộng được sang Mobile mà không cần xây lại.
- Kế hoạch triển khai PHẢI có mục Constitution Check đối chiếu với Nguyên tắc I–VI trước khi
  bắt đầu thiết kế và một lần nữa sau khi thiết kế xong.
- Hành vi của Learning Engine (sinh lộ trình, điều chỉnh độ khó, lập lịch ôn) PHẢI có kiểm
  thử tự động với các hồ sơ người học tiêu biểu.
- Thay đổi hợp đồng API hoặc schema nội dung PHẢI được ghi lại thành tài liệu và KHÔNG ĐƯỢC âm
  thầm làm hỏng client hoặc nội dung đã lưu.
- Độ phức tạp thêm vào (dịch vụ, lớp trừu tượng, thư viện phụ thuộc) PHẢI được biện minh
  trong kế hoạch so với phương án đơn giản hơn.

## Quản trị

Hiến pháp này có hiệu lực cao hơn mọi quy ước khác của dự án. Đề xuất sửa đổi PHẢI được lập
thành văn bản, nêu lý do và các nguyên tắc bị ảnh hưởng, kèm ghi chú di trú cho các spec, kế
hoạch hoặc mã nguồn hiện có trở nên không tuân thủ. Sửa đổi có hiệu lực khi chủ dự án phê
duyệt và file này được cập nhật.

Đánh phiên bản theo semantic versioning:
- MAJOR: loại bỏ hoặc định nghĩa lại một nguyên tắc hay quy tắc quản trị theo cách không
  tương thích ngược.
- MINOR: thêm nguyên tắc hoặc mục mới, hoặc mở rộng đáng kể hướng dẫn.
- PATCH: làm rõ, sửa câu chữ hoặc lỗi chính tả mà không đổi ngữ nghĩa.

Rà soát tuân thủ: mọi spec, kế hoạch và pull request PHẢI được đối chiếu với hiến pháp này.
Vi phạm PHẢI được sửa hoặc được biện minh rõ ràng trong mục theo dõi độ phức tạp của kế hoạch;
vi phạm không được biện minh sẽ chặn việc phê duyệt. Bản tổng quan gốc trong `requirement.txt`
là tài liệu tham chiếu cho ý định sản phẩm.

**Phiên bản**: 1.1.0 | **Phê chuẩn**: 2026-11-04 | **Sửa đổi lần cuối**: 2026-11-05
