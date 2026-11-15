# Checklist chất lượng đặc tả: Bổ sung nội dung học N4 → N3 đầy đủ để thi JLPT

**Mục đích**: Kiểm tra độ đầy đủ và chất lượng của đặc tả trước khi chuyển sang lập kế hoạch
**Ngày tạo**: 2026-11-14
**Tính năng**: [spec.md](../spec.md)

## Chất lượng nội dung

- [x] Không có chi tiết triển khai (ngôn ngữ, framework, API)
- [x] Tập trung vào giá trị người dùng và nhu cầu nghiệp vụ
- [x] Viết cho các bên liên quan không chuyên kỹ thuật
- [x] Đã hoàn thành mọi mục bắt buộc

## Độ đầy đủ của yêu cầu

- [x] Không còn marker [NEEDS CLARIFICATION]
- [x] Yêu cầu kiểm thử được và không mơ hồ
- [x] Tiêu chí thành công đo được
- [x] Tiêu chí thành công không phụ thuộc công nghệ
- [x] Đã xác định mọi kịch bản chấp nhận
- [x] Đã xác định các trường hợp biên
- [x] Phạm vi được giới hạn rõ (mục "Ngoài phạm vi")
- [x] Đã xác định phụ thuộc và giả định

## Mức sẵn sàng của tính năng

- [x] Mọi yêu cầu chức năng có tiêu chí chấp nhận rõ ràng
- [x] Các câu chuyện người dùng bao phủ luồng chính
- [x] Tính năng đáp ứng các kết quả đo được trong Tiêu chí thành công
- [x] Không có chi tiết triển khai lọt vào đặc tả

## Ghi chú

- Các quyết định dùng mặc định hợp lý (không đánh marker), người dùng có thể đổi bằng `/speckit-clarify`:
  1. Phạm vi trình độ = **cả N4 và N3** đầy đủ; N5 ngoài phạm vi.
  2. "Đầy đủ để thi" = chữ – từ vựng, ngữ pháp, đọc hiểu; **nghe hiểu** ngoài phạm vi vì hiến pháp xếp vào Giai đoạn 2.
  3. **Thi thử mô phỏng nguyên đề** là tính năng riêng, ngoài phạm vi.
  4. Ngưỡng độ phủ (≥ 95% ngữ pháp/Kanji, ≥ 90% từ vựng) và số bài luyện đọc (≥ 30)/viết (≥ 20) mỗi trình độ là mức đề xuất; con số mục chính thức chốt khi lập danh mục phạm vi.
- Điểm chạm kỹ thuật được giao cho giai đoạn lập kế hoạch (FR-019): dạng bài sắp xếp câu (★) và đoạn đọc dài hơn giới hạn hiện có có thể cần mở rộng hợp đồng nội dung.
- Mục chưa hoàn thành cần cập nhật spec trước khi chạy `/speckit-clarify` hoặc `/speckit-plan`: không có.
