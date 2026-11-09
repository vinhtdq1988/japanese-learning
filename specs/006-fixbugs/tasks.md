---

description: "Danh sách tác vụ: Sửa lỗi ứng dụng web không hiển thị khi chạy local"
---

# Tác vụ: Sửa lỗi ứng dụng web không hiển thị khi chạy local

**Đầu vào**: Tài liệu thiết kế tại `/specs/006-fixbugs/`

**Điều kiện tiên quyết**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/security-config.md](contracts/security-config.md), [quickstart.md](quickstart.md)

**Kiểm thử**: Spec yêu cầu kiểm tra tự động chống tái diễn (FR-006, SC-004) nên các tác vụ kiểm thử được đưa vào. Đây là kiểm thử đọc tệp cấu hình (vitest, dự án `unit`, không cần CSDL/trình duyệt) nên đặt chung một tệp `backend/tests/unit/web-csp.test.ts`. Kiểm tra hiển thị trên trình duyệt thật làm thủ công theo `quickstart.md`.

**Tổ chức**: Tác vụ gom theo câu chuyện người dùng (US1, US2, US3). Trong mỗi câu chuyện, viết test trước và xác nhận test **đỏ** rồi mới sửa cấu hình để test **xanh**.

## Định dạng: `[ID] [P?] [Story] Mô tả`

- **[P]**: Chạy song song được (khác tệp, không phụ thuộc tác vụ chưa xong)
- **[Story]**: Câu chuyện người dùng của tác vụ (US1, US2, US3)
- Mọi đường dẫn tính từ gốc kho `d:\my_owner_workspace\japanese-learning`; lệnh `pnpm` chạy trong `backend/`

## Quy ước đường dẫn

- Client web: `client/web/index.html`, `client/nginx.conf`, `client/Dockerfile`
- Script chạy local: `scripts/start-client.ps1`
- Test cấu hình: `backend/tests/unit/web-csp.test.ts`
- Tài liệu vận hành: `backend/README.md` (đã có sửa đổi chưa commit: chỉ thêm/sửa đúng chỗ cần, KHÔNG ghi đè cả tệp)

**Lưu ý chung**: Các tệp `client/web/index.html`, `client/nginx.conf`, `scripts/start-client.ps1` sẽ có sửa đổi chưa commit của tính năng này (và `scripts/` đang là thư mục chưa theo dõi). KHÔNG dùng `git checkout`/`git stash` để hoàn tác thử nghiệm; sao lưu tệp trước rồi chép lại.

---

## Phase 1: Chuẩn bị (Setup)

**Mục đích**: Xác nhận hiện trạng trước khi sửa.

- [x] T001 Chạy `pnpm test:unit -- web-csp` trong `backend/` và xác nhận 2 test hiện có của `backend/tests/unit/web-csp.test.ts` đang đạt (đường cơ sở trước khi sửa)
- [x] T002 [P] Xác nhận công cụ: `flutter --version` (kỳ vọng 3.47.x), `flutter run -h` có cờ `--[no-]web-resources-cdn`, `pnpm -v`; ghi nhận Chrome và Edge đều có trên máy kiểm thử

---

## Phase 2: Nền tảng (Foundational)

**Mục đích**: Chuẩn bị chung cho các test ở mọi câu chuyện (cùng sửa một tệp test).

**⚠️ QUAN TRỌNG**: Hoàn tất trước khi viết test của US1/US2.

- [x] T003 Trong `backend/tests/unit/web-csp.test.ts` (giữ nguyên `directives()` và `expectStrict()`): thêm hằng `startClientPs1 = readFileSync(path.join(root, 'scripts/start-client.ps1'), 'utf8')` và `dockerfile = readFileSync(path.join(root, 'client/Dockerfile'), 'utf8')` cạnh `indexHtml`/`nginxConf`; thêm hàm tiện ích `psBranches(script)` tách nội dung `start-client.ps1` thành `{ prod, local }` bằng cách cắt quanh `if ($Environment -eq 'prod') {` và `} else {` (prod = giữa hai mốc, local = từ `} else {` đến `} finally`); chú thích bằng tiếng Việt, mã định danh tiếng Anh

**Điểm kiểm tra**: Test hiện có vẫn đạt (`pnpm test:unit -- web-csp`) sau khi thêm hằng/hàm tiện ích.

---

## Phase 3: Câu chuyện người dùng 1 - Mở được ứng dụng ở môi trường local (Ưu tiên: P1) 🎯 MVP

**Mục tiêu**: `scripts/start-client.ps1` / `start-all.ps1` chạy ứng dụng ở local và hiển thị màn hình đầu tiên đầy đủ, không còn lỗi CSP trong bảng điều khiển (FR-001, FR-002, FR-003).

**Kiểm thử độc lập**: Theo [quickstart.md](quickstart.md) Kịch bản 2: chạy từ trạng thái sạch trên Chrome và Edge, trang hiển thị ≤ 60 giây, Console 0 lỗi CSP, Network không gọi `www.gstatic.com`.

### Kiểm thử cho US1 (viết trước, phải ĐỎ trước khi sửa)

- [x] T004 [US1] Trong `backend/tests/unit/web-csp.test.ts`, thay `it('thẻ meta trong index.html chặt chẽ ...')` bằng test C-01: `indexHtml` KHÔNG ĐƯỢC khớp `/http-equiv\s*=\s*["']?Content-Security-Policy/i` (thông báo lỗi nêu rõ: meta CSP chặn công cụ chạy thử ở local, CSP release chỉ khai báo ở `client/nginx.conf`). Chạy `pnpm test:unit -- web-csp` và xác nhận test này ĐỎ (vì `index.html` còn meta)
- [x] T005 [US1] Trong `backend/tests/unit/web-csp.test.ts`, thêm test C-07: nhánh `local` của `psBranches(startClientPs1)` chứa `flutter` với `run` và `--no-web-resources-cdn` (có thể kiểm bằng cách mảng `$flutterArgs` của nhánh local chứa chuỗi `--no-web-resources-cdn`). Chạy lại và xác nhận test ĐỎ

### Triển khai cho US1

- [x] T006 [P] [US1] Sửa `client/web/index.html`: XÓA dòng 19 (thẻ `<meta http-equiv="Content-Security-Policy" ...>`); thay khối chú thích dòng 12-18 bằng chú thích tiếng Việt nêu: (a) trang không khai báo CSP vì mẫu này dùng chung cho `flutter run` và `flutter build web`, dev server chèn script nội tuyến không thể băm/nonce, và trình duyệt áp dụng giao của mọi chính sách; (b) CSP của triển khai thật nằm ở header trong `client/nginx.conf` (nguồn duy nhất, kèm `frame-ancestors 'none'`); (c) release phải build với `--no-web-resources-cdn`; (d) KHÔNG thêm lại meta CSP (test `web-csp.test.ts` sẽ báo lỗi). GIỮ NGUYÊN `<base href="$FLUTTER_BASE_HREF">`, `<meta name="referrer" content="no-referrer">`, `manifest`, `<script src="flutter_bootstrap.js" async>`
- [x] T007 [P] [US1] Sửa `scripts/start-client.ps1`: ở nhánh local (dòng 57) thêm `'--no-web-resources-cdn'` vào mảng `$flutterArgs` (sau `"--dart-define=API_BASE_URL=$ApiUrl"`, trước khối `if ($Device -ne 'web-server')`); cập nhật khối `.DESCRIPTION` (dòng 9-13): dòng `local` ghi thêm "không có CSP (index.html không có meta), CanvasKit phục vụ cùng nguồn nhờ `--no-web-resources-cdn` nên không cần Internet"; dòng `prod` giữ `--no-web-resources-cdn` và ghi "CSP chặt do header nginx cấp". Không đổi logic khác (kể cả `--web-browser-flag=--disable-web-security`)
- [x] T008 [US1] Chạy `pnpm test:unit -- web-csp` trong `backend/`: T004, T005 và các test cũ phải XANH
- [ ] T009 [US1] Kiểm chứng thủ công theo [quickstart.md](quickstart.md) Kịch bản 2 (bước 1-6) với `.\scripts\start-all.ps1` trên Chrome, rồi `.\scripts\start-client.ps1 -Device edge`, rồi `-Device web-server`: màn hình đăng nhập/trang chủ hiển thị, Console 0 lỗi "Content Security Policy" (trước đây 6 lỗi), Network không có yêu cầu tới `www.gstatic.com` (CanvasKit tải từ `localhost`), đăng nhập và đi qua học bài/ôn tập/tiến độ, hot reload (`r`) không phát sinh lỗi mới. **Phương án dự phòng (research R2)**: nếu bước 3 thất bại vì `flutter run --no-web-resources-cdn` không áp dụng, bỏ cờ khỏi nhánh local của `scripts/start-client.ps1`, sửa test C-07 (T005) thành khẳng định ngược cho local và ghi yêu cầu Internet vào README ở T019; lỗi chính vẫn được chữa bởi việc bỏ meta (T006)
  - **Đã kiểm (2026-11-09, tự động bằng Chrome/Edge headless, thiết bị `web-server`, `flutter run --no-web-resources-cdn`)**: `index.html` phục vụ không có meta CSP; ứng dụng khởi động tới `main` (màn "Đang tải…" của ứng dụng); Console 0 lỗi "Content Security Policy" (trước đây 6); net-log chỉ thấy `canvaskit.js`/`canvaskit.wasm` tải từ `localhost`, không có yêu cầu của ứng dụng tới `www.gstatic.com`; Chrome và Edge đều đạt. Phương án dự phòng R2 KHÔNG cần dùng (cờ có hiệu lực).
  - **Còn lại (cần người dùng làm trên trình duyệt có giao diện, backend đang chạy)**: bước 4-5 của Kịch bản 2 (đăng nhập, đi qua học bài/ôn tập/tiến độ, hot reload `r`) và chạy qua `.\scripts\start-all.ps1`.

**Điểm kiểm tra**: US1 hoạt động độc lập: local hiển thị được, test C-01/C-07 xanh.

---

## Phase 4: Câu chuyện người dùng 2 - Triển khai thật vẫn giữ chính sách bảo mật chặt (Ưu tiên: P1)

**Mục tiêu**: Sau khi bỏ meta, CSP release chỉ còn một nơi khai báo (header nginx), nguyên văn như cũ, và được test khóa chặt (FR-004, FR-005, FR-006).

**Kiểm thử độc lập**: Theo [quickstart.md](quickstart.md) Kịch bản 3: dựng release, `curl` header khớp C-04, mở `https://localhost/` hiển thị đầy đủ với Console 0 lỗi chặn.

### Kiểm thử cho US2

- [x] T010 [P] [US2] Sửa chú thích `client/nginx.conf` dòng 31-32: bỏ câu "CSP khớp thẻ meta trong client/web/index.html"; ghi rằng đây là NGUỒN DUY NHẤT khai báo CSP của release (`client/web/index.html` không có meta CSP để chế độ local chạy được), thêm `frame-ancestors` vì chỉ đặt được qua header, kèm tham chiếu `backend/tests/unit/web-csp.test.ts` và cảnh báo "KHÔNG nới chính sách này để chữa lỗi hiển thị ở local". **KHÔNG ĐƯỢC đổi một ký tự nào của chuỗi CSP ở dòng 33 và các `add_header` khác**
- [x] T011 [US2] Trong `backend/tests/unit/web-csp.test.ts`, mở rộng test nginx thành C-03/C-04: (a) `nginxConf.matchAll(/add_header\s+Content-Security-Policy\s+"([^"]+)"([^;]*);/g)` cho đúng 1 kết quả và phần đuôi chứa `always`; (b) giữ `expectStrict(policy)`; (c) `policy.get('frame-ancestors')` bằng `["'none'"]`; (d) `policy.get('script-src')` và `policy.get('default-src')` không chứa `'unsafe-inline'`; (e) không giá trị nào chứa `http(s):` hoặc `*` (đã có trong `expectStrict`)
- [x] T012 [US2] Trong `backend/tests/unit/web-csp.test.ts`, thêm test C-05: `nginxConf` có header `Strict-Transport-Security` kèm `always`; và không khối `location` nào chứa `add_header` (lấy các khối bằng `/location[^{]*\{([^}]*)\}/g`, mỗi thân khối `not.toMatch(/add_header/)`), thông báo lỗi giải thích nginx sẽ bỏ header cấp `server` khi `location` có `add_header`
- [x] T013 [US2] Trong `backend/tests/unit/web-csp.test.ts`, thêm test C-02: `indexHtml` không có thuộc tính `src`/`href` trỏ tới `http(s)://` (regex `/(?:src|href)\s*=\s*["']https?:\/\//i` không khớp); `$FLUTTER_BASE_HREF` được phép
- [x] T014 [US2] Trong `backend/tests/unit/web-csp.test.ts`, thêm test C-06: dòng `flutter build web` trong `dockerfile` và nhánh `prod` của `psBranches(startClientPs1)` đều chứa `--no-web-resources-cdn` (thông báo lỗi: thiếu cờ này thì CanvasKit tải từ gstatic và bị CSP chặn, cấm khắc phục bằng cách nới `nginx.conf`)

### Triển khai / kiểm chứng cho US2

- [x] T015 [US2] Chạy `pnpm test:unit -- web-csp` trong `backend/`: toàn bộ test C-01..C-07 XANH (nginx.conf chưa đổi chuỗi CSP nên các test US2 phải xanh ngay)
- [x] T016 [US2] Kiểm chứng thủ công theo [quickstart.md](quickstart.md) Kịch bản 3: `.\scripts\start-client.ps1 -Env prod`; phục vụ bản release qua nginx (tạo chứng chỉ tự ký theo `backend/README.md` mục "Triển khai", `docker compose --profile app up -d --build web api db`); `curl.exe -skI https://localhost/ | findstr /i "content-security-policy strict-transport"` có CSP khớp C-04 (có `frame-ancestors 'none'`, không nguồn ngoài) và HSTS; mở `https://localhost/` hiển thị đầy đủ, Console 0 lỗi chặn; `client\build\web\index.html` không chứa meta CSP và `client\build\web\canvaskit\` có đủ tệp. Nếu không có Docker, ghi rõ trong báo cáo hoàn thành rằng chỉ kiểm được bước build và kiểm tra tĩnh
  - **Ghi chú**: máy này KHÔNG có Docker nên chỉ kiểm được bước build và kiểm tra tĩnh: `.\scripts\start-client.ps1 -Env prod` build thành công (88,5 s); `client\build\web\index.html` không có meta CSP; `client\build\web\canvaskit\` có đủ tệp. Thay cho nginx, dùng server Node nhỏ phát đúng chuỗi CSP trích từ `client/nginx.conf`: Chrome headless hiển thị đầy đủ màn hình chào, 0 lỗi CSP. Chưa kiểm `curl -skI https://localhost/` (header thật của nginx, HSTS) và `docker compose --profile app`; cần chạy ở máy có Docker.

**Điểm kiểm tra**: US1 và US2 đều hoạt động; CSP release không đổi và được test khóa.

---

## Phase 5: Câu chuyện người dùng 3 - Biện pháp phát hiện sớm khi lỗi tái diễn (Ưu tiên: P2)

**Mục tiêu**: Chứng minh test phát hiện được thay đổi làm lệch cấu hình, và tài liệu giải thích hai chế độ (FR-006, FR-007).

**Kiểm thử độc lập**: Theo [quickstart.md](quickstart.md) Kịch bản 1 (thử cố ý nới lỏng) và Kịch bản 4 (người mới đọc tài liệu).

- [x] T017 [US3] Kiểm tra khả năng phát hiện (SC-004) theo [quickstart.md](quickstart.md) Kịch bản 1: SAO LƯU 3 tệp (`client/web/index.html`, `client/nginx.conf`, `client/Dockerfile`) vào thư mục tạm, lần lượt thử rồi chép lại bản sao lưu sau mỗi lần: (1) thêm lại meta CSP vào `index.html` → C-01 đỏ; (2) thêm `https://www.gstatic.com` vào `connect-src` hoặc `'unsafe-inline'` vào `script-src` của `nginx.conf` → C-04 đỏ; (3) thêm `add_header X-Test "1";` vào một khối `location` → C-05 đỏ; (4) bỏ `--no-web-resources-cdn` khỏi `Dockerfile` → C-06 đỏ. Sau cùng chạy `pnpm test:unit -- web-csp` phải xanh và `git diff --stat` xác nhận các tệp đúng bằng bản đã sửa ở T006/T010
- [x] T018 [US3] Sửa các câu cũ trong `backend/README.md` (đọc tệp trước, chỉ sửa đúng câu, giữ các thay đổi chưa commit): dòng 33 đổi `flutter build web --release` thành `flutter build web --release --no-web-resources-cdn`; dòng 29 (`local`) thêm "chạy `flutter run --no-web-resources-cdn`, không có CSP"; dòng 71 đổi thành "Container `web` gửi CSP chặt (`default-src 'self'`) bằng header HTTP của nginx (nguồn duy nhất; `index.html` không có meta CSP), HSTS và các header phòng thủ" giữ nguyên phần về `api`
- [x] T019 [US3] Thêm mục `### Chính sách bảo mật theo môi trường` vào `backend/README.md` ngay trước `### Yêu cầu vận hành cho FR-034 ...`, viết bằng tiếng Việt, gồm: (1) bảng hai chế độ `local`/`prod` (nguồn phục vụ trang, CanvasKit, CSP) theo [data-model.md](data-model.md); (2) lý do khác nhau: dev server chèn script nội tuyến không thể băm/nonce và trình duyệt áp dụng giao của mọi chính sách nên meta chặt làm trang trắng ở local; (3) cách xác nhận từng chế độ (lệnh `pnpm test:unit -- web-csp`, kiểm tra Console/Network ở local, `curl.exe -skI https://localhost/` ở prod); (4) cách khôi phục khi trình duyệt còn bộ nhớ đệm/service worker lỗi: `Ctrl+Shift+R`, hoặc DevTools > Application > Clear site data / Unregister service worker; (5) cảnh báo KHÔNG nới `client/nginx.conf` để chữa lỗi hiển thị ở local và quy tắc đổi chính sách release phải sửa `client/nginx.conf` **và** `backend/tests/unit/web-csp.test.ts` cùng lúc kèm lý do ghi ở mục này; (6) lưu ý nginx là cấu hình chuẩn duy nhất mang CSP, host tĩnh khác sẽ không có CSP; (7) nếu T009 phải dùng phương án dự phòng, ghi rõ local cần Internet để tải CanvasKit

**Điểm kiểm tra**: Cả ba câu chuyện hoàn tất; test phát hiện được lệch cấu hình; tài liệu đầy đủ.

---

## Phase 6: Hoàn thiện và hồi quy (Polish)

**Mục đích**: Kiểm tra toàn cục trước khi kết thúc.

- [x] T020 Chạy hồi quy trong `backend/`: `pnpm lint; pnpm typecheck; pnpm test:unit` và `pnpm exec prettier --check tests/unit/web-csp.test.ts`. Mọi test PHẢI đạt, ngoại lệ duy nhất: 5 test spec 003 (kanji-admin/kanji-us5) đã đỏ sẵn từ HEAD, không liên quan tính năng này (xem bộ nhớ dự án)
- [x] T021 Xác nhận C-08 và FR-008: `git diff --stat` chỉ gồm `client/web/index.html`, `client/nginx.conf` (chỉ dòng chú thích), `scripts/start-client.ps1`, `backend/tests/unit/web-csp.test.ts`, `backend/README.md` và `specs/006-fixbugs/**`; `backend/src/api/middleware/security-headers.ts`, schema, migration, OpenAPI, nội dung học KHÔNG thay đổi; chuỗi CSP ở `client/nginx.conf` không đổi (so sánh với `git show HEAD:client/nginx.conf`)
- [x] T022 Chạy [quickstart.md](quickstart.md) Kịch bản 4 (SC-005): đọc mục "Chính sách bảo mật theo môi trường" như người mới, làm theo Kịch bản 2-3 không cần tra cứu thêm; sửa README nếu có bước thiếu hoặc mơ hồ

---

## Phụ thuộc và thứ tự thực hiện

### Phụ thuộc giữa các phase

- **Phase 1 (Setup)**: Không phụ thuộc, bắt đầu ngay
- **Phase 2 (Foundational)**: Sau Phase 1; CHẶN các test của US1/US2 (T003 cần cho T004, T005, T011-T014)
- **US1 (Phase 3)**: Sau Phase 2; không phụ thuộc US2/US3
- **US2 (Phase 4)**: Sau Phase 2; về mặt nội dung độc lập với US1, nhưng T015 yêu cầu `index.html` đã sửa (T006) để toàn bộ test xanh, và các test cùng tệp với US1 nên làm sau US1
- **US3 (Phase 5)**: Sau US1 và US2 (T017 cần mọi test và cấu hình đã hoàn tất; T019 cần kết quả T009 để biết có dùng phương án dự phòng không)
- **Polish (Phase 6)**: Sau tất cả câu chuyện

### Phụ thuộc giữa các tác vụ

- T003 → T004 → T005 (cùng tệp test) → T006/T007 (làm test xanh) → T008 → T009
- T011 → T012 → T013 → T014 (cùng tệp test, làm tuần tự) → T015 → T016
- T010 (nginx.conf) độc lập với các test, chạy song song được
- T017 → (phục hồi tệp) → T018 → T019 (cùng `backend/README.md`, tuần tự)
- T020 → T021 → T022

### Cơ hội chạy song song

- T001 song song T002
- T006 (`client/web/index.html`) song song T007 (`scripts/start-client.ps1`) sau khi T004, T005 đã đỏ
- T010 (`client/nginx.conf`) song song với T011-T014 (khác tệp)
- Mọi tác vụ sửa `backend/tests/unit/web-csp.test.ts` và `backend/README.md` KHÔNG song song (cùng tệp)

---

## Ví dụ song song: US1

```text
# Sau khi T004 và T005 đã làm test đỏ, sửa hai tệp khác nhau cùng lúc:
Tác vụ: "T006 Bỏ meta CSP và cập nhật chú thích trong client/web/index.html"
Tác vụ: "T007 Thêm --no-web-resources-cdn vào nhánh local của scripts/start-client.ps1"
```

---

## Chiến lược triển khai

### MVP trước (chỉ US1)

1. Hoàn tất Phase 1 và Phase 2
2. Hoàn tất Phase 3 (US1): test đỏ → sửa `index.html` và `start-client.ps1` → test xanh
3. **DỪNG VÀ KIỂM CHỨNG**: chạy T009 để thấy ứng dụng hiển thị ở local
4. Vì US2 là bảo vệ bắt buộc (CSP release không được yếu đi), KHÔNG phát hành bản chỉ có US1 mà chưa chạy T015-T016

### Giao tăng dần

1. Setup + Foundational → sẵn sàng viết test
2. US1 → local hiển thị được (MVP)
3. US2 → khóa chặt CSP release bằng test + kiểm chứng release
4. US3 → chứng minh khả năng phát hiện + tài liệu
5. Polish → hồi quy và đối chiếu phạm vi

---

## Ghi chú

- [P] = khác tệp, không phụ thuộc
- Nhãn [Story] giúp truy vết tác vụ về câu chuyện người dùng
- Điều kiện bất biến `C-01..C-08` định nghĩa tại [contracts/security-config.md](contracts/security-config.md)
- Rủi ro đã biết (research): `flutter run --no-web-resources-cdn` có thể không phục vụ CanvasKit cùng nguồn như mong đợi; phương án dự phòng nằm ở T009
- Commit sau mỗi tác vụ hoặc nhóm hợp lý; chưa có nhánh git cho tính năng (xem spec)
- Tránh: nới `client/nginx.conf` để chữa lỗi local, tác vụ mơ hồ, xung đột cùng tệp
