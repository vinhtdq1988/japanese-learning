# Hướng dẫn cho Claude

## Ngôn ngữ tài liệu

- Mọi tài liệu do Spec Kit sinh ra hoặc cập nhật (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `contracts/*`, `checklists/*`, các mục Clarifications, báo cáo phân tích, v.v.) PHẢI được viết bằng **tiếng Việt**.
- Nội dung hội thoại, câu hỏi làm rõ (`/speckit-clarify`) và báo cáo hoàn thành cũng dùng tiếng Việt.
- Giữ nguyên bằng tiếng Anh những thứ sau để công cụ và việc tham chiếu không bị hỏng:
  - Mã định danh: `FR-001`, `SC-001`, `US1`, `T001`, `P1`, tên nhánh/thư mục (`001-phase1-mvp`).
  - Tên file, đường dẫn, lệnh, đoạn mã, tên trường dữ liệu, tên API.
  - Thuật ngữ kỹ thuật phổ biến chưa có từ tiếng Việt thông dụng (ví dụ: spaced repetition có thể kèm chú thích "lặp lại ngắt quãng").
  - Nội dung tiếng Nhật (từ vựng, ngữ pháp, ví dụ) giữ nguyên tiếng Nhật.
- Từ khóa mức độ bắt buộc dịch thống nhất: MUST → PHẢI, MUST NOT → KHÔNG ĐƯỢC, SHOULD → NÊN, MAY → CÓ THỂ.
- Mã nguồn: tên biến/hàm/lớp dùng tiếng Anh; comment và tài liệu đi kèm dùng tiếng Việt.
- Tài liệu có sẵn bằng tiếng Anh được dịch sang tiếng Việt khi được chỉnh sửa; không để một file trộn lẫn hai ngôn ngữ (trừ các ngoại lệ ở trên).
