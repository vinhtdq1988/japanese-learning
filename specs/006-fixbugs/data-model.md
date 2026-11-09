# Mô hình dữ liệu: Sửa lỗi ứng dụng web không hiển thị khi chạy local

**Tính năng**: `006-fixbugs` | **Spec**: [spec.md](spec.md)

## Dữ liệu nghiệp vụ

**Không có thay đổi.** Tính năng không thêm, sửa hay xóa bảng, cột, migration, hợp đồng OpenAPI hay nội dung học
(FR-008). Dữ liệu người học và API giữ nguyên.

## Khái niệm cấu hình vận hành

Hai khái niệm trong spec được cụ thể hóa thành cấu hình tệp (không phải dữ liệu lưu trong CSDL).

### Chế độ chạy

| Chế độ | Cách chạy | Nguồn phục vụ trang | CanvasKit/phông | CSP áp dụng |
| --- | --- | --- | --- | --- |
| `local` | `scripts/start-client.ps1` (`flutter run`, Chrome/Edge/`web-server`) | Dev server của Flutter (DDC/DWDS, chèn script nội tuyến) | Cùng nguồn (`--no-web-resources-cdn`) | Không có (đã bỏ meta; dev server không gửi header) |
| `prod` (triển khai thật) | `flutter build web --release --no-web-resources-cdn` rồi nginx (`client/Dockerfile`, `client/nginx.conf`) | nginx, cùng nguồn với `/api` | Đóng gói sẵn trong `build/web` | Header của nginx (chặt), nguồn duy nhất |

### Chính sách bảo mật của trang (CSP release)

Một bản khai báo duy nhất, trong `client/nginx.conf` (mức `server`, `always`). Giá trị **không đổi** so với trước:

| Directive | Giá trị | Ghi chú |
| --- | --- | --- |
| `default-src` | `'self'` | |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Không `'unsafe-inline'`, không `'unsafe-eval'` |
| `style-src` | `'self' 'unsafe-inline'` | Flutter chèn thẻ style khi khởi động |
| `img-src` | `'self' data: blob:` | |
| `font-src` | `'self' data:` | |
| `connect-src` | `'self'` | API cùng origin qua proxy `/api` |
| `worker-src` | `'self' blob:` | |
| `manifest-src` | `'self'` | |
| `object-src` | `'none'` | |
| `base-uri` | `'self'` | |
| `form-action` | `'self'` | |
| `frame-ancestors` | `'none'` | Chỉ đặt được qua header (không qua meta) |

Ràng buộc kiểm chứng bằng test (xem [contracts/security-config.md](contracts/security-config.md)): không có nguồn
`http(s):`/`*`; không có `add_header` trong `location`; `index.html` không có meta CSP.

## Chuyển trạng thái

Không có máy trạng thái. Quan hệ duy nhất cần giữ: `prod` ⇒ CSP chặt (header nginx) **và** build có
`--no-web-resources-cdn`; `local` ⇒ không CSP trong mẫu `index.html`.
