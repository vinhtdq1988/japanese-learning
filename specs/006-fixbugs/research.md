# Nghiên cứu Phase 0: Sửa lỗi ứng dụng web không hiển thị khi chạy local

**Tính năng**: `006-fixbugs` | **Ngày**: 2026-11-09 | **Spec**: [spec.md](spec.md)

Không còn mục `NEEDS CLARIFICATION` trong Technical Context; tài liệu này ghi lại các quyết định thiết kế và lý do.

## Hiện trạng đã khảo sát

- `client/web/index.html` khai báo CSP chặt bằng thẻ `<meta http-equiv="Content-Security-Policy">`
  (`script-src 'self' 'wasm-unsafe-eval'`, `connect-src 'self'`, ...). Tệp này là mẫu dùng chung cho cả
  `flutter run` (local) lẫn `flutter build web` (release), nên chính sách của release bị áp lên cả chế độ local.
- `client/nginx.conf` gửi sẵn cùng CSP đó dưới dạng header HTTP, thêm `frame-ancestors 'none'` và HSTS.
  Header được khai báo ở mức `server` (không có `add_header` trong `location`) nên áp cho mọi phản hồi.
- `scripts/start-client.ps1`: local chạy `flutter run -d <chrome|edge|web-server>` (mặc định dùng CanvasKit từ CDN
  `www.gstatic.com`); prod chạy `flutter build web --release --no-web-resources-cdn`. `client/Dockerfile` cũng build
  với `--no-web-resources-cdn`.
- `backend/tests/unit/web-csp.test.ts` kiểm tra CSP của `index.html` **và** của `nginx.conf` đều chặt.
- Theo `Capture.PNG`, `flutter run` gây 4 nhóm lỗi: (1) `connect-src` chặn tải `canvaskit.wasm` từ gstatic,
  (2) `script-src` chặn `canvaskit.js` từ gstatic, (3) lỗi dây chuyền "Failed to fetch (dynamically imported module)",
  (4) `script-src` chặn script nội tuyến của công cụ chạy thử (`client.js` của DWDS/DDC, dùng cho hot reload/debug).
  Hai nhóm đầu có thể tránh bằng cờ build; nhóm thứ tư thì KHÔNG: script nội tuyến do dev server chèn, không thể
  băm (hash) hay gắn nonce trước vì nội dung thay đổi theo phiên.

## Quyết định

### R1. Cách tách chính sách theo chế độ: bỏ thẻ meta CSP khỏi `web/index.html`, giữ header nginx làm nguồn duy nhất cho release

- **Quyết định**: Xóa thẻ `<meta http-equiv="Content-Security-Policy">` khỏi `client/web/index.html` (giữ chú thích
  giải thích). CSP của triển khai thật chỉ còn một nơi khai báo: header `Content-Security-Policy` trong
  `client/nginx.conf`, nguyên văn như hiện tại (không đổi một ký tự nào của chính sách). Môi trường local không có CSP
  nào ngoài chính sách mặc định của trình duyệt.
- **Lý do**:
  - Trình duyệt áp dụng **giao** của mọi chính sách (header và meta). Vì vậy không thể "nới" ở local bằng header
    của dev server khi meta chặt vẫn còn trong trang; muốn local chạy được thì meta phải biến mất khỏi mẫu dùng chung.
  - Mẫu `index.html` chỉ có một bản; Flutter chỉ thay `$FLUTTER_BASE_HREF`, không hỗ trợ biến theo chế độ. Bỏ meta
    là cách đơn giản nhất, không thêm bước build, không thêm công cụ.
  - Header nginx là cơ chế đúng hơn cho release: hỗ trợ `frame-ancestors` (meta không hỗ trợ), áp lên cả phản hồi lỗi
    và tài nguyên phụ. Một nơi khai báo duy nhất loại bỏ rủi ro lệch pha giữa meta và header (FR-006).
  - Chính sách release không đổi (FR-004): cùng chuỗi CSP, vẫn gắn lên mọi phản hồi của `web`.
- **Phương án đã cân nhắc**:
  - *Giữ meta và nới meta cho mọi môi trường* (thêm `https://www.gstatic.com`, `'unsafe-inline'`): bị loại, vi phạm
    FR-004/FR-034 spec 001 (token lưu ở trình duyệt, CSP chặt là phòng tuyến chính chống XSS).
  - *Tiêm meta lúc build release* (`sed` trong Dockerfile + bước tương đương trong `start-client.ps1`, hoặc
    script Dart dùng chung): giữ được "phòng thủ chiều sâu" khi host không phải nginx, nhưng thêm công cụ và hai đường
    build phải đồng bộ (đúng loại lỗi đã gây ra sự cố này). Bị loại theo Hiến pháp (độ phức tạp phải biện minh);
    triển khai chuẩn của dự án luôn qua nginx (`backend/README.md` mục "Triển khai"). Nếu sau này có nhu cầu host
    tĩnh khác, có thể mở lại.
  - *Header CSP nới cho dev server qua `flutter run --web-header`*: cờ này không có trong `flutter run -h` của
    Flutter 3.47.9 đang dùng, và dù có thì meta chặt vẫn giao với nó. Bị loại.
  - *Dùng thiết bị `web-server` thay Chrome để tránh script nội tuyến*: không giải quyết nhóm lỗi 4 (DDC loader
    vẫn chèn script), bị loại.

### R2. Local dùng `--no-web-resources-cdn`

- **Quyết định**: `scripts/start-client.ps1` (nhánh local) thêm `--no-web-resources-cdn` vào `flutter run` để
  CanvasKit được phục vụ từ chính dev server (`localhost`) thay vì `www.gstatic.com`.
- **Lý do**: Khi không còn CSP chặn, tải từ gstatic vẫn chạy, nhưng như vậy local phụ thuộc Internet (trường hợp biên
  trong spec: máy phát triển không có mạng) và hành vi khác bản release (đã dùng cờ này). Dùng cùng cờ cho cả hai
  chế độ giữ CanvasKit cùng nguồn, nên sau này nếu có ai bật lại một CSP chặt cho local thì nhóm lỗi 1–3 không tái diễn.
  `flutter run -h` (Flutter 3.47.9) xác nhận cờ `--[no-]web-resources-cdn` tồn tại cho `run`.
- **Phương án đã cân nhắc**: để mặc định (CDN) và ghi chú "cần Internet": đơn giản hơn nhưng giữ phụ thuộc ngoài
  không cần thiết. Nếu cờ gây lỗi khi chạy thật (xem `quickstart.md`, bước kiểm chứng local), phương án dự phòng là
  quay lại CDN và ghi yêu cầu Internet vào tài liệu.

### R3. Kiểm thử chống tái diễn mở rộng `web-csp.test.ts` (không thêm công cụ)

- **Quyết định**: Sửa `backend/tests/unit/web-csp.test.ts` (vitest, đã chạy trong `pnpm test:unit`):
  1. `index.html` KHÔNG ĐƯỢC chứa thẻ meta CSP (bảo vệ chế độ local) và không chứa URL ngoài (`http(s)://` trong
     `<script>`/`<link>`).
  2. `nginx.conf` vẫn gửi CSP chặt: giữ nguyên toàn bộ khẳng định hiện có (`default-src`, `script-src`,
     `connect-src`, `object-src`, `base-uri`, không `http(s):`/`*`) và bổ sung: không `'unsafe-inline'` trong
     `script-src`/`default-src`, `frame-ancestors 'none'`, HSTS.
  3. Không có `add_header` nào trong khối `location` của `nginx.conf` (nginx sẽ bỏ header ở mức `server`, làm mất CSP
     âm thầm; đây là kiểu "không khớp giữa các nơi khai báo" của FR-006).
  4. Release phải build với `--no-web-resources-cdn`: kiểm tra chuỗi cờ trong `client/Dockerfile` và nhánh `prod` của
     `scripts/start-client.ps1`; local cũng có cờ này (R2).
- **Lý do**: Test hiện có đọc tệp nguồn, nhanh, không cần CSDL hay trình duyệt; mở rộng cùng tệp giữ các
  khẳng định ở một chỗ. Đảo chiều khẳng định #1 là điểm mấu chốt: test cũ *bắt buộc* có meta, chính nó sẽ làm người sau
  "sửa" nhầm bằng cách thêm lại meta.
- **Phương án đã cân nhắc**: kiểm thử E2E bằng trình duyệt headless (Playwright) đo console. Giá trị cao nhưng thêm
  phụ thuộc lớn và cần Flutter build trong CI; hoãn, thay bằng quy trình kiểm tra thủ công có hướng dẫn trong
  `quickstart.md` (SC-001..SC-003). Có thể làm sau nếu lỗi tái diễn.

### R4. Tài liệu

- **Quyết định**: Cập nhật `backend/README.md` (đã có thay đổi chưa commit ở tệp này; chỉ thêm, không ghi đè): mục
  "Script chạy theo môi trường" sửa lệnh build prod cho đúng (`--no-web-resources-cdn`), thêm mục ngắn
  "Chính sách bảo mật theo môi trường" gồm: vì sao local không có CSP còn release có CSP qua nginx, cách xác nhận từng
  chế độ, cách khôi phục khi trình duyệt còn bộ nhớ đệm/service worker cũ (tải lại cứng `Ctrl+Shift+R`, hoặc DevTools >
  Application > Clear site data), và cảnh báo KHÔNG nới `nginx.conf` để "chữa" lỗi hiển thị. Cập nhật chú thích đầu
  `client/web/index.html`, `client/nginx.conf` (bỏ câu "khớp thẻ meta") và `scripts/start-client.ps1`.
- **Lý do**: FR-007, SC-005. Dùng lại README sẵn có thay vì tạo tài liệu mới.

### R5. Phạm vi không đụng tới

- Không đổi hành vi học tập, schema, API (FR-008); CSP của API (`backend/src/api/middleware/security-headers.ts`)
  giữ nguyên vì API chỉ trả JSON và không liên quan lỗi này.
- Không đổi `--disable-web-security` của local (đó là cách xử lý CORS đã có, ngoài phạm vi).

## Rủi ro còn lại

| Rủi ro | Giảm thiểu |
| --- | --- |
| Host khác nginx phục vụ bản build sẽ không còn CSP dự phòng bằng meta | Tài liệu nêu rõ nginx là cấu hình chuẩn và CSP nằm ở header; ghi vào README. Mở lại phương án tiêm meta nếu có nhu cầu. |
| `flutter run --no-web-resources-cdn` không phục vụ CanvasKit cùng nguồn như mong đợi | Đã thử: `flutter run -d web-server --no-web-resources-cdn` biên dịch và khởi chạy không lỗi (cờ được chấp nhận); chưa kiểm chứng trên trình duyệt thật. Kiểm chứng ở `quickstart.md` kịch bản 2 bước 3; phương án dự phòng là bỏ cờ ở local (R2). Dù cờ có hiệu lực hay không, lỗi chính được chữa bởi R1 (bỏ meta). |
| Trình duyệt giữ `index.html` cũ có meta chặt trong cache | Hướng dẫn tải lại cứng (R4); `index.html` đã phục vụ với `expires -1` ở nginx. |
