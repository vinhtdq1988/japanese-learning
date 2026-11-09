# Đặc tả tính năng: Sửa lỗi ứng dụng web không hiển thị khi chạy môi trường local

**Nhánh tính năng**: `006-fixbugs` (tên thư mục; chưa tạo nhánh git)

**Ngày tạo**: 2026-11-09

**Trạng thái**: Bản nháp; sẵn sàng cho `/speckit-clarify` hoặc `/speckit-plan`

**Giai đoạn**: Giai đoạn 1 – MVP (sửa lỗi hạ tầng chạy thử cho client web; không thêm chức năng học tập). Ứng dụng chạy trên Web.

**Đầu vào**: Mô tả của người dùng: "fix bugs không hiển thị, danh sách lỗi như file specs\006-fixbugs\Capture.PNG"

**Tiêu chí thành công của hiến pháp được hỗ trợ**: không làm thay đổi tiêu chí nào; sửa lỗi này khôi phục khả năng chạy thử và kiểm tra mọi mô-đun hiện có trên môi trường phát triển. Giữ nguyên yêu cầu an toàn dữ liệu của FR-034 (spec 001) cho môi trường triển khai thật.

## Bối cảnh lỗi

Ảnh chụp bảng điều khiển trình duyệt (`specs/006-fixbugs/Capture.PNG`) ghi nhận, khi mở ứng dụng web ở môi trường chạy thử cục bộ (local), trình duyệt từ chối các thao tác sau và màn hình ứng dụng **không hiển thị** (trang trắng):

1. Không được kết nối để tải thành phần dựng giao diện (CanvasKit, dạng WebAssembly) từ máy chủ ngoài `www.gstatic.com` vì vi phạm chính sách bảo mật nội dung (CSP) của trang (chỉ cho phép kết nối cùng nguồn).
2. Không được nạp tập lệnh dựng giao diện tương ứng từ `www.gstatic.com` vì chính sách chỉ cho phép script cùng nguồn.
3. Việc tải bị lỗi dây chuyền: thông báo "Failed to fetch" / "Failed to fetch dynamically imported module", khiến bước khởi động ứng dụng dừng hẳn.
4. Một đoạn script nội tuyến do công cụ chạy thử chèn vào trang cũng bị chặn vì chính sách không cho phép script nội tuyến.

Nguyên nhân gốc đã xác định khi khảo sát: chính sách bảo mật chặt của trang web (đặt cho môi trường triển khai thật, nơi mọi tài nguyên được đóng gói và phục vụ cùng nguồn) cũng đang áp dụng khi chạy thử cục bộ, trong khi chế độ chạy thử cần tải thành phần dựng giao diện từ máy chủ ngoài và chèn script nội tuyến của công cụ phát triển. Bản phát hành (release) đã đóng gói sẵn các thành phần này nên không gặp lỗi tương tự.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Mở được ứng dụng ở môi trường local (Ưu tiên: P1)

Lập trình viên (hoặc người kiểm thử) chạy ứng dụng ở môi trường local bằng cách chuẩn của dự án (script `scripts/start-client.ps1` hoặc `scripts/start-all.ps1`, trình duyệt Chrome/Edge). Khi trình duyệt mở, họ thấy màn hình đầu tiên của ứng dụng (đăng nhập hoặc trang chủ) hiển thị đầy đủ, thay vì trang trắng và loạt lỗi trong bảng điều khiển.

**Vì sao ưu tiên này**: Không hiển thị được ứng dụng thì không thể chạy thử, nghiệm thu hay phát triển bất kỳ tính năng nào khác; đây là lỗi chặn toàn bộ công việc ở môi trường local.

**Kiểm thử độc lập**: Chạy ứng dụng ở môi trường local từ trạng thái sạch (chưa có bộ nhớ đệm trình duyệt), mở trang, quan sát màn hình và bảng điều khiển trình duyệt. Có thể kiểm thử hoàn toàn bằng một lần chạy này.

**Kịch bản chấp nhận**:

1. **Cho trước** backend và client local đã được khởi động bằng script chuẩn, **Khi** trình duyệt mở địa chỉ ứng dụng, **Thì** màn hình đầu tiên của ứng dụng hiển thị đầy đủ và tương tác được (không còn trang trắng).
2. **Cho trước** ứng dụng đang chạy ở môi trường local, **Khi** mở bảng điều khiển trình duyệt, **Thì** không còn lỗi nào do chính sách bảo mật nội dung chặn kết nối, script hoặc script nội tuyến (không còn các lỗi như trong ảnh chụp).
3. **Cho trước** ứng dụng đang chạy ở môi trường local, **Khi** người dùng đăng nhập và đi qua các màn hình chính (học bài, ôn tập, tiến độ), **Thì** mọi màn hình hiển thị bình thường và các lời gọi tới API local hoạt động như trước.
4. **Cho trước** lập trình viên sửa mã và dùng tải lại nóng (hot reload/restart) của môi trường local, **Khi** thay đổi được áp dụng, **Thì** giao diện cập nhật mà không phát sinh lại lỗi chặn nào.

---

### Câu chuyện người dùng 2 - Môi trường triển khai thật vẫn giữ chính sách bảo mật chặt (Ưu tiên: P1)

Quản trị hệ thống triển khai bản phát hành (release) phía sau máy chủ web chính thức. Sau khi sửa lỗi này, chính sách bảo mật của bản triển khai thật vẫn chặt như trước: chỉ cho phép tài nguyên cùng nguồn, không cho script nội tuyến, không cho kết nối tới máy chủ ngoài. Việc nới lỏng để chạy thử cục bộ không được lọt vào bản triển khai thật.

**Vì sao ưu tiên này**: Token đăng nhập của học viên lưu ở trình duyệt; chính sách chặt là lớp phòng thủ chính chống chèn mã độc (FR-034 của spec 001). Sửa lỗi hiển thị bằng cách nới lỏng chính sách cho mọi môi trường là đánh đổi không chấp nhận được.

**Kiểm thử độc lập**: Dựng bản release bằng quy trình chuẩn, kiểm tra chính sách bảo mật mà trang và máy chủ web gửi đi, rồi mở bản release trên trình duyệt và kiểm tra ứng dụng hiển thị đúng, bảng điều khiển không có lỗi chặn.

**Kịch bản chấp nhận**:

1. **Cho trước** bản release dựng bằng quy trình chuẩn của dự án, **Khi** kiểm tra chính sách bảo mật của trang và của máy chủ web, **Thì** chính sách vẫn chỉ cho phép tài nguyên cùng nguồn, không cho phép script nội tuyến, không cho phép nạp mã động từ chuỗi, không có nguồn bên ngoài nào được liệt kê, và vẫn cấm nhúng trang vào khung của site khác.
2. **Cho trước** bản release được phục vụ cùng nguồn với API, **Khi** người học mở ứng dụng, **Thì** ứng dụng hiển thị đầy đủ và bảng điều khiển không có lỗi chặn nào.
3. **Cho trước** bộ kiểm thử tự động về chính sách bảo mật hiện có của dự án, **Khi** chạy sau khi sửa lỗi, **Thì** các kiểm thử vẫn đạt (hoặc được cập nhật tương ứng mà vẫn khẳng định chính sách chặt cho môi trường triển khai thật).

---

### Câu chuyện người dùng 3 - Có biện pháp phát hiện sớm khi lỗi tái diễn (Ưu tiên: P2)

Khi sau này có người thay đổi chính sách bảo mật hoặc cách dựng giao diện, họ cần được cảnh báo sớm nếu thay đổi khiến một trong hai chế độ (local hoặc triển khai thật) không hiển thị lại được, thay vì phát hiện muộn qua trang trắng.

**Vì sao ưu tiên này**: Lỗi xuất phát từ việc một cấu hình dùng chung phục vụ hai chế độ có nhu cầu trái ngược; nếu không có kiểm tra, lỗi sẽ tái diễn khi ai đó sửa một phía mà quên phía còn lại.

**Kiểm thử độc lập**: Cố ý đưa vào một thay đổi làm sai lệch cấu hình (ví dụ nới chính sách cho bản release, hoặc siết lại làm chặn chế độ local) và xác nhận kiểm tra tự động hoặc hướng dẫn kiểm tra báo lỗi.

**Kịch bản chấp nhận**:

1. **Cho trước** có thay đổi làm bản release mất tính chặt của chính sách bảo mật, **Khi** chạy bộ kiểm thử, **Thì** kiểm thử báo lỗi và chỉ rõ phần vi phạm.
2. **Cho trước** tài liệu hướng dẫn chạy local và triển khai, **Khi** người mới đọc, **Thì** họ biết vì sao hai chế độ có chính sách bảo mật khác nhau và cách kiểm tra từng chế độ hiển thị đúng.

---

### Các trường hợp biên

- Chạy local bằng thiết bị `web-server` (tự mở trình duyệt riêng) thay vì Chrome/Edge do công cụ khởi chạy: ứng dụng vẫn phải hiển thị được.
- Trình duyệt còn giữ bộ nhớ đệm hoặc service worker cũ từ lần chạy lỗi trước: người dùng phải khôi phục được bằng thao tác tải lại cứng mà không cần xóa thủ công dữ liệu trình duyệt phức tạp (hướng dẫn nêu rõ trong tài liệu nếu cần).
- Máy phát triển không có kết nối Internet: nếu chế độ local vẫn phụ thuộc vào tài nguyên ngoài, phải nêu rõ yêu cầu này trong tài liệu hoặc loại bỏ phụ thuộc đó.
- Bản release vô tình được dựng không theo quy trình chuẩn (ví dụ không đóng gói sẵn thành phần dựng giao diện): lỗi tương tự phải được phát hiện và hướng dẫn rõ, không được khắc phục bằng cách nới chính sách cho bản triển khai thật.
- Dùng nhiều trình duyệt khác nhau (Chrome, Edge) cho môi trường local: cả hai đều hiển thị được.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

- **FR-001**: Khi chạy ở môi trường local bằng quy trình chuẩn của dự án (Chrome hoặc Edge), hệ thống PHẢI hiển thị màn hình đầu tiên của ứng dụng đầy đủ và tương tác được, không để trang trắng.
- **FR-002**: Ở môi trường local, bảng điều khiển trình duyệt KHÔNG ĐƯỢC còn lỗi do chính sách bảo mật nội dung chặn kết nối, tải script hoặc chạy script nội tuyến (các lỗi liệt kê trong `Capture.PNG`).
- **FR-003**: Mọi chức năng hiện có (đăng nhập, học bài, ôn tập, tiến độ, và các mô-đun khác) PHẢI hoạt động ở môi trường local như trước khi xảy ra lỗi, gồm cả lời gọi tới API local.
- **FR-004**: Chính sách bảo mật của bản triển khai thật PHẢI giữ nguyên mức chặt hiện tại: chỉ cùng nguồn, không script nội tuyến, không nạp mã động từ chuỗi, không nguồn bên ngoài, cấm nhúng khung (theo FR-034 của spec 001). Mọi điều chỉnh để chạy được ở môi trường local KHÔNG ĐƯỢC áp dụng cho bản triển khai thật.
- **FR-005**: Bản release dựng bằng quy trình chuẩn PHẢI hiển thị đầy đủ khi được phục vụ như môi trường thật, và bảng điều khiển trình duyệt KHÔNG ĐƯỢC có lỗi chặn do chính sách bảo mật.
- **FR-006**: Hệ thống PHẢI có kiểm tra tự động khẳng định chính sách bảo mật của môi trường triển khai thật vẫn chặt chẽ, và kiểm tra này PHẢI báo lỗi nếu chính sách bị nới lỏng hoặc không khớp giữa các nơi khai báo.
- **FR-007**: Tài liệu chạy local/triển khai (`backend/README.md` hoặc tài liệu liên quan) PHẢI giải thích sự khác biệt về chính sách bảo mật giữa hai chế độ, cách xác nhận từng chế độ hiển thị đúng, và cách khôi phục khi trình duyệt còn giữ bộ nhớ đệm lỗi.
- **FR-008**: Việc sửa lỗi KHÔNG ĐƯỢC làm thay đổi hành vi học tập, dữ liệu người học hay giao diện API; phạm vi giới hạn ở việc hiển thị ứng dụng và cấu hình bảo mật trang web.

### Thực thể chính

Tính năng này không đưa thêm dữ liệu nghiệp vụ. Hai khái niệm vận hành liên quan:

- **Chế độ chạy**: `local` (chạy thử cục bộ, có công cụ phát triển) và `triển khai thật` (bản release phục vụ qua máy chủ web); mỗi chế độ có nhu cầu tài nguyên và mức bảo mật riêng.
- **Chính sách bảo mật của trang**: tập quy tắc trình duyệt dùng để cho phép hoặc chặn nguồn script, kết nối, ảnh, phông; cần chặt ở triển khai thật và đủ rộng ở local để công cụ phát triển hoạt động.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: 100% lần chạy ứng dụng ở môi trường local bằng quy trình chuẩn (Chrome và Edge) hiển thị màn hình đầu tiên đầy đủ trong tối đa 60 giây kể từ khi trình duyệt mở (chưa tính thời gian biên dịch lần đầu của công cụ).
- **SC-002**: Số lỗi chặn do chính sách bảo mật nội dung trong bảng điều khiển trình duyệt ở môi trường local giảm từ 6 (theo `Capture.PNG`) xuống 0 sau khi mở trang và duyệt qua các màn hình chính.
- **SC-003**: 100% bản release dựng bằng quy trình chuẩn giữ chính sách bảo mật chặt (không có nguồn ngoài, không script nội tuyến, cấm nhúng khung) và hiển thị đầy đủ với 0 lỗi chặn trong bảng điều khiển.
- **SC-004**: Bộ kiểm thử tự động của dự án đạt toàn bộ phần liên quan đến chính sách bảo mật, và phát hiện được 100% các thay đổi làm bản triển khai thật mất tính chặt (kiểm chứng bằng cách thử cố ý nới lỏng).
- **SC-005**: Một người mới đọc tài liệu có thể dựng và xác nhận hiển thị đúng cả hai chế độ (local và triển khai thật) trong tối đa 30 phút mà không cần hỏi thêm.

## Giả định

- Lỗi chỉ xảy ra ở môi trường local (chạy thử) và không xảy ra ở bản release dựng bằng quy trình chuẩn, vì bản release đóng gói sẵn thành phần dựng giao diện và không dùng script nội tuyến của công cụ phát triển.
- Cách xử lý ưu tiên là giữ chính sách chặt cho triển khai thật và dùng cấu hình riêng (nới tối thiểu cần thiết) chỉ cho chế độ local; cách thực hiện cụ thể do giai đoạn lập kế hoạch quyết định.
- Môi trường local mặc định được chạy qua `scripts/start-client.ps1` / `scripts/start-all.ps1` với Chrome hoặc Edge; thiết bị `web-server` chỉ cần hiển thị được, không phải đường chính.
- Việc nới chính sách ở môi trường local chỉ áp dụng trên máy phát triển, không ảnh hưởng đến dữ liệu thật hay người học.
- Ảnh chụp `Capture.PNG` phản ánh đầy đủ các lỗi của lần chạy; nếu sau khi sửa còn lỗi khác (ví dụ lỗi khi gọi API) thì ghi nhận thành lỗi riêng.
- Mọi lỗi khác không liên quan đến việc hiển thị ứng dụng (ví dụ bug logic học tập, bug dữ liệu) nằm ngoài phạm vi tính năng này.
- Chưa có nhánh git riêng cho tính năng này; thư mục `specs/006-fixbugs` đã được tạo sẵn bởi người dùng nên được dùng làm thư mục tính năng.
