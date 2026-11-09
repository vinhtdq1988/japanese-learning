# Hợp đồng cấu hình: bảo mật trang web theo chế độ chạy

**Tính năng**: `006-fixbugs` | **Spec**: [../spec.md](../spec.md) | **Mô hình**: [../data-model.md](../data-model.md)

Tính năng không đổi API HTTP của backend (không có hợp đồng OpenAPI mới). Giao diện cần ghi lại ở đây là các
**điều kiện bất biến của cấu hình** mà test tự động và người vận hành dựa vào. Mỗi điều kiện có mã `C-xx` để tham chiếu
từ `tasks.md`.

## Điều kiện bất biến

| Mã | Điều kiện | Đối tượng kiểm tra | Yêu cầu |
| --- | --- | --- | --- |
| C-01 | `client/web/index.html` KHÔNG chứa thẻ `<meta http-equiv="Content-Security-Policy">` | `web-csp.test.ts` | FR-001, FR-002 |
| C-02 | `client/web/index.html` không tham chiếu tài nguyên ngoài (`src`/`href` dạng `http(s)://`) ngoài `$FLUTTER_BASE_HREF` | `web-csp.test.ts` | FR-004 |
| C-03 | `client/nginx.conf` gửi đúng một header `Content-Security-Policy` ở mức `server` với `always` | `web-csp.test.ts` | FR-004, FR-006 |
| C-04 | CSP nginx: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'` (không `'unsafe-inline'`, không `'unsafe-eval'`); `connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`; không giá trị `http(s):` hoặc `*` | `web-csp.test.ts` | FR-004, SC-003, SC-004 |
| C-05 | `client/nginx.conf` có HSTS và KHÔNG có `add_header` trong bất kỳ khối `location` nào | `web-csp.test.ts` | FR-004, FR-006 |
| C-06 | Build release luôn có `--no-web-resources-cdn`: `client/Dockerfile` và nhánh `prod` của `scripts/start-client.ps1` | `web-csp.test.ts` | FR-005, FR-006 |
| C-07 | Nhánh `local` của `scripts/start-client.ps1` chạy `flutter run` với `--no-web-resources-cdn` | `web-csp.test.ts` | FR-001, FR-002 |
| C-08 | CSP của API (`security-headers.ts`) giữ nguyên | `app-foundation.test.ts`, `security.test.ts` (sẵn có) | FR-008 |

## Giao diện quan sát được (kiểm tra thủ công, xem `quickstart.md`)

| Chế độ | Quan sát | Kết quả mong đợi |
| --- | --- | --- |
| `local` | Phản hồi của trang `index.html` | Không có header/meta CSP; ứng dụng hiển thị; bảng điều khiển 0 lỗi CSP |
| `local` | Mạng (Network) | Không có yêu cầu tới `www.gstatic.com` cho CanvasKit |
| `prod` | `curl -sI https://<host>/` | Có `Content-Security-Policy` khớp C-04 kèm `Strict-Transport-Security` |
| `prod` | Bảng điều khiển trình duyệt | Ứng dụng hiển thị; 0 lỗi CSP |

## Quy tắc thay đổi

Mọi thay đổi chính sách release PHẢI sửa `client/nginx.conf` **và** `web-csp.test.ts` trong cùng một thay đổi, kèm lý do
ghi vào `backend/README.md`. KHÔNG ĐƯỢC nới `nginx.conf` để khắc phục lỗi hiển thị ở local.
