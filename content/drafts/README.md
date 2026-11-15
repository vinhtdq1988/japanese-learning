# Bản nháp nội dung (`content/drafts/`)

Thư mục này chứa **bản nháp** đơn vị học đang soạn, chờ người duyệt (cổng G1).

> **File trong `content/drafts/` KHÔNG bao giờ được nạp hay hiển thị cho người học.** Trình nạp nội dung (`loadContent`) bỏ qua hoàn toàn thư mục này; seed không đọc nó; chỉ `pnpm content:lint --drafts` mới đọc để kiểm tra.

## Quy ước

- Nháp đặt ở `content/drafts/<mã-đợt>/<trình-độ>-<loại>-<chủ-đề>-<NN>.json` (NN 2 chữ số, ví dụ `001-grammar-n4/n4-grammar-te-form-02.json`). Tên file (không đuôi) là giá trị dùng trong `requires`.
- Khi người duyệt (G1) chấp thuận, file được **chuyển** sang `content/units/` và được liệt kê trong manifest `content/releases/<mã-đợt>.json` cùng người duyệt, ngày duyệt và `checklist: true`. Không có manifest thì file ở `content/units/` bị coi là mồ côi và làm seed thất bại (seed đóng kín).
- Chỉ người duyệt thật mới được điền `reviewer`/`reviewedOn`/`checklist` trong manifest; công cụ/LLM chỉ soạn nháp và chạy lint.
- Viết MỚI theo phạm vi danh mục (`content/scope/`); KHÔNG chép nguyên văn từ giáo trình hay trang web có bản quyền.

Quy trình đầy đủ: [specs/008-n4-n3-jlpt-content/contracts/content-authoring.md](../../specs/008-n4-n3-jlpt-content/contracts/content-authoring.md) và [contracts/release-manifest.md](../../specs/008-n4-n3-jlpt-content/contracts/release-manifest.md).
