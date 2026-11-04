# Đặc tả tính năng: Kiểm chứng hiệu năng dưới tải bình thường

**Nhánh tính năng**: `002-performance` (tên thư mục)

**Ngày tạo**: 2026-11-04

**Trạng thái**: Bản nháp (tách từ `001-phase1-mvp`; chưa lập kế hoạch)

**Đầu vào**: Các phần liên quan hiệu năng được chuyển từ `specs/001-phase1-mvp`: tiêu chí SC-010, task T115 và T115a, kịch bản kiểm chứng K11 và phần đo lường của R17.

## Bối cảnh

Spec `001-phase1-mvp` đã cài đặt sẵn các biện pháp thiết kế phục vụ hiệu năng (chỉ mục `(user_id, due_date)`, `(user_id, local_date)`, `(unit_id)`; lưu kế hoạch ngày sau lần tính đầu tiên; bộ đệm nội dung TTL ngắn; chấm bài trả ngay trong một giao dịch ngắn). Việc **đo và kiểm chứng** hiệu năng dưới tải được tách sang spec này để spec 001 không bị chặn bởi hạ tầng đo tải.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện 1 – Người học vẫn học mượt khi hệ thống đông người dùng (Ưu tiên: P1)

Khi có tối đa 1.000 người học đồng thời đang học, màn hình bài học và phản hồi câu trả lời vẫn xuất hiện nhanh, không làm gián đoạn nhịp học.

**Vì sao ưu tiên này**: Phản hồi chậm làm người học bỏ giữa chừng; đây là mức trên của quy mô giai đoạn đầu theo mục Giả định của spec 001.

**Kiểm thử độc lập**: Chạy kịch bản tải với 1.000 người dùng đồng thời gọi các điểm cuối chính; trong lúc tải chạy, đo thời gian đầu-cuối trên trình duyệt thật.

**Kịch bản chấp nhận**:

1. **Cho** 1.000 người học đồng thời đang học, **Khi** họ mở "Hôm nay", bắt đầu phiên, gửi câu trả lời và xem tiến độ, **Thì** p95 thời gian xử lý phía server của `/today`, `/sessions`, `/sessions/{id}/answers`, `/progress` nhỏ hơn 500 ms.
2. **Cho** cùng mức tải đó, **Khi** một người học thao tác trên trình duyệt Chrome, **Thì** màn hình bài học và phản hồi câu trả lời xuất hiện trong vòng 1 giây (tính từ thao tác đến khi hiển thị) cho 95% tương tác.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

- **FR-001**: Hệ thống PHẢI có kịch bản kiểm thử tải mô phỏng 1.000 người học đồng thời cho `/today`, `/sessions`, `/sessions/*/answers` và `/progress`, chạy lặp lại được và báo cáo p95 của từng điểm cuối.
- **FR-002**: Hệ thống PHẢI có phép đo thời gian đầu-cuối phía client trên Chrome (từ thao tác đến khi hiển thị màn hình bài học và phản hồi câu trả lời), chạy trong lúc kiểm thử tải đang tạo tải và khẳng định p95 < 1 giây.
- **FR-003**: Kết quả đo PHẢI được ghi lại (số liệu, môi trường, ngày đo) để so sánh giữa các lần chạy.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001** (trước đây là SC-010 của spec 001): Màn hình bài học và phản hồi câu trả lời xuất hiện trong vòng 1 giây (tính từ thao tác của người học đến khi hiển thị trên trình duyệt) cho 95% tương tác ở tải bình thường. "Tải bình thường" là tối đa 1.000 người học đồng thời đang học.
- **SC-002**: p95 thời gian xử lý phía server của bốn điểm cuối nêu ở FR-001 nhỏ hơn 500 ms ở tải bình thường, để dành ngân sách cho mạng và render.

## Công việc chuyển từ spec 001

| Mã cũ | Nội dung | Tệp dự kiến |
|-------|----------|-------------|
| T115 | Kiểm thử tải k6 với 1.000 người dùng đồng thời cho `/today`, `/sessions`, `/sessions/*/answers`, `/progress` (p95 < 500 ms phía server) | `backend/tests/load/today-answers.js` |
| T115a | `integration_test` trên Chrome đo thời gian đầu-cuối của màn hình bài học và phản hồi câu trả lời, chạy trong lúc T115 tạo tải, khẳng định p95 < 1 giây | `client/integration_test/perf_lesson_test.dart` |
| K11 | Kịch bản kiểm chứng: chạy bộ k6, đồng thời chạy `flutter test integration_test/perf_lesson_test.dart -d chrome` | (thêm vào quickstart của spec này) |

**Ghi chú thiết kế (từ R17 của spec 001)**: thời gian đầu-cuối PHẢI được đo ở client bằng `integration_test` trên Chrome trong lúc chạy tải k6, không chỉ dựa vào số liệu phía server.

## Giả định

- Spec `001-phase1-mvp` đã hoàn tất các endpoint và cơ chế đệm/chỉ mục cần đo.
- Dữ liệu và tài khoản kiểm thử cho 1.000 người học được tạo bằng script seed trong môi trường đo, không dùng dữ liệu thật.
- Công cụ đo tải là k6 (đã chốt ở `plan.md` của spec 001); cần xác nhận lại khi lập kế hoạch cho spec này.
- Ngoài phạm vi: tối ưu hiệu năng cụ thể nếu số đo không đạt (sẽ là công việc bổ sung sau khi có số liệu).
