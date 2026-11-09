# Quickstart kiểm chứng: Sửa lỗi ứng dụng web không hiển thị khi chạy local

**Tính năng**: `006-fixbugs` | **Spec**: [spec.md](spec.md) | **Hợp đồng**: [contracts/security-config.md](contracts/security-config.md)

Hướng dẫn kiểm chứng đầu-cuối cho từng câu chuyện người dùng. Việc triển khai chi tiết nằm trong `tasks.md`.

## Điều kiện tiên quyết

- Windows PowerShell, Flutter (đã kiểm với 3.47.9), Node + pnpm, Chrome và/hoặc Edge.
- Docker (chỉ cần cho kịch bản 3, phục vụ bản release qua nginx như thật).
- Xóa trạng thái trình duyệt cũ: lần đầu mở bằng hồ sơ trình duyệt mới (script local dùng hồ sơ tạm của Flutter), hoặc
  tải lại cứng `Ctrl+Shift+R` / DevTools > Application > Clear site data nếu từng mở bản lỗi.

## Kịch bản 1: Kiểm thử tự động bảo vệ cấu hình (US2, US3 – SC-004)

```powershell
cd backend
pnpm test:unit -- web-csp
```

Mong đợi: tất cả đạt (điều kiện C-01..C-07). Kiểm tra khả năng phát hiện (SC-004), thử rồi hoàn tác từng lần:

1. Thêm lại thẻ meta CSP vào `client/web/index.html` → test C-01 báo lỗi.
2. Thêm `https://www.gstatic.com` vào `connect-src` hoặc `'unsafe-inline'` vào `script-src` trong `client/nginx.conf` →
   test C-04 báo lỗi.
3. Thêm `add_header` vào một khối `location` của `nginx.conf` → test C-05 báo lỗi.
4. Bỏ `--no-web-resources-cdn` khỏi `client/Dockerfile` → test C-06 báo lỗi.

## Kịch bản 2: Chạy local hiển thị được (US1 – SC-001, SC-002)

```powershell
.\scripts\start-all.ps1          # backend + client; hoặc .\scripts\start-client.ps1 [-Device edge|chrome|web-server]
```

Kiểm tra (lần lượt với Chrome và Edge):

1. Trình duyệt mở `http://localhost:8080`; màn hình đăng nhập/trang chủ hiển thị trong ≤ 60 giây sau khi mở trang
   (chưa tính thời gian biên dịch lần đầu).
2. DevTools > Console: 0 lỗi "Content Security Policy" (trước đây 6 lỗi theo `Capture.PNG`).
3. DevTools > Network: không có yêu cầu tới `www.gstatic.com`; `canvaskit.js`/`canvaskit.wasm` tải từ `localhost`.
   *Nếu bước này thất bại (cờ `--no-web-resources-cdn` không áp dụng cho `flutter run`), dùng phương án dự phòng R2 trong
   [research.md](research.md): bỏ cờ ở local và ghi yêu cầu Internet vào README.*
4. Đăng nhập (tài khoản dev do seed tạo, xem `backend/README.md`), đi qua học bài, ôn tập, tiến độ: chữ Nhật hiển thị (không thành ô vuông),
   lời gọi tới API `http://localhost:3000` thành công.
5. Sửa một dòng chữ trong mã, nhấn `r` ở cửa sổ client: giao diện cập nhật, không phát sinh lỗi chặn mới.
6. Lặp lại với `-Device web-server`, mở `http://localhost:8080` bằng trình duyệt đã tắt web security: ứng dụng hiển thị.

## Kịch bản 3: Bản release vẫn chặt và hiển thị đúng (US2 – SC-003)

```powershell
.\scripts\start-client.ps1 -Env prod              # build ra client\build\web
# Phục vụ như thật (cần certs tự ký, xem backend/README.md mục "Triển khai"):
docker compose --profile app up -d --build web api db
curl.exe -skI https://localhost/ | findstr /i "content-security-policy strict-transport"
```

Mong đợi:

1. Header `Content-Security-Policy` khớp C-04 (có `frame-ancestors 'none'`, không nguồn ngoài) và có HSTS.
2. Mở `https://localhost/` (chấp nhận chứng chỉ tự ký): ứng dụng hiển thị đầy đủ; Console 0 lỗi chặn do CSP.
3. `client\build\web\index.html` không chứa thẻ meta CSP; `client\build\web\canvaskit\` có đủ tệp (đóng gói sẵn).

## Kịch bản 4: Tài liệu (US3 – SC-005)

Người mới đọc `backend/README.md` mục "Chính sách bảo mật theo môi trường" và làm theo kịch bản 2–3 mà không cần hỏi
thêm; mục này nêu: vì sao hai chế độ khác nhau, cách xác nhận từng chế độ, cách khôi phục khi còn bộ nhớ đệm lỗi.

## Hồi quy

```powershell
cd backend
pnpm lint; pnpm typecheck; pnpm test:unit
```

Lưu ý: 5 test spec 003 (kanji-admin/kanji-us5) đã đỏ sẵn từ HEAD (không liên quan tính năng này, xem bộ nhớ dự án);
các test ngoài danh sách đó PHẢI đạt.
