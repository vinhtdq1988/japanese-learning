# Backend – Ứng dụng web học tiếng Nhật cá nhân hóa

REST API (Node.js 22, TypeScript, Fastify, PostgreSQL 16). Hợp đồng nằm ở
[`specs/001-phase1-mvp/contracts/openapi.yaml`](../specs/001-phase1-mvp/contracts/openapi.yaml); cách chạy thử toàn bộ
hệ thống ở [`quickstart.md`](../specs/001-phase1-mvp/quickstart.md).

## Phát triển

```bash
docker compose up -d db mailpit      # PostgreSQL + hộp thư thử nghiệm (http://localhost:8025)
cd backend
cp .env.example .env                 # chỉnh giá trị nếu cần
pnpm install
pnpm db:migrate                      # áp dụng migration SQL
pnpm seed                            # nạp nội dung từ ../content, tạo admin dev (chỉ khi NODE_ENV != production)
pnpm dev                             # http://localhost:3000
```

### Script chạy theo môi trường (Windows PowerShell)

Các script ở [`../scripts/`](../scripts) làm trọn các bước trên cho từng môi trường; cấu hình nằm ở file env riêng
(tự tạo từ mẫu ở lần chạy đầu, đều bị `.gitignore`; biến đã đặt sẵn trong shell được ưu tiên hơn giá trị trong file):

| Môi trường | File cấu hình                                                  | Cách chạy                                                        |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `local`    | `backend/.env.local` (mẫu `.env.example`), `client/.env.local` | `.\scripts\start-all.ps1` (hoặc `start-backend.ps1`/`start-client.ps1`) |
| `prod`     | `backend/.env.prod` (mẫu `.env.prod.example`), `client/.env.prod` | `.\scripts\start-all.ps1 -Env prod [-Seed]`                      |

- `local`: tự dựng CSDL (đã chạy sẵn → Docker → PostgreSQL nhúng), migrate, seed, `pnpm dev` và
  `flutter run --no-web-resources-cdn` (không có CSP, CanvasKit phục vụ cùng nguồn nên không cần Internet).
- `prod`: KHÔNG dựng CSDL; từ chối chạy khi còn giá trị mẫu `CHANGE_ME` (`JWT_SECRET` được sinh ngẫu nhiên khi tạo
  file lần đầu, cần tự điền `DATABASE_URL`, `SMTP_URL`, `APP_BASE_URL`). Backend được build (`tsc`), migrate rồi chạy
  `node dist/src/server.js` với `NODE_ENV=production` từ bố cục tạm `.dev-data/prod`; client được build
  `flutter build web --release --no-web-resources-cdn` ra `client/build/web` (triển khai thật vẫn qua nginx/Docker như mục "Triển khai").
  `-Seed` nạp nội dung lần đầu (không tạo admin dev; dùng `pnpm admin:create`).

| Lệnh                                                 | Tác dụng                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm test`                                          | Toàn bộ kiểm thử (đơn vị + hợp đồng + tích hợp). Dự án `db` cần Docker (Testcontainers) hoặc `TEST_DATABASE_URL` trỏ vào một CSDL **dành riêng** cho kiểm thử (bị xóa sạch giữa các test). |
| `pnpm test:unit`                                     | Chỉ kiểm thử đơn vị, không cần CSDL.                                                                                                                                                       |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | ESLint, Prettier, TypeScript.                                                                                                                                                              |
| `pnpm admin:create --email <email>`                  | Tạo hoặc nâng quyền admin (xem bên dưới).                                                                                                                                                  |
| `pnpm job:purge`                                     | Chạy tay job xóa cứng tài khoản quá 30 ngày chờ.                                                                                                                                           |
| `pnpm report:metrics`                                | Báo cáo SC-003/SC-009/SC-011 và Kanji SC-001/SC-008, xem [`src/reports/README.md`](src/reports/README.md).                                                                                 |

## Triển khai

Thành phần: `db` (PostgreSQL), `api` (image từ [`Dockerfile`](Dockerfile)) và `web` (nginx phục vụ bản build
`flutter build web`, proxy `/api` tới `api`, chấm dứt TLS; xem [`../client/nginx.conf`](../client/nginx.conf)).

```bash
# Chứng chỉ TLS cho nginx: đặt fullchain.pem và privkey.pem vào ./certs (thư mục này bị .gitignore).
# Thử nghiệm cục bộ có thể dùng chứng chỉ tự ký:
mkdir -p certs && openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout certs/privkey.pem -out certs/fullchain.pem -subj "/CN=localhost"

export JWT_SECRET="$(openssl rand -base64 48)"      # bắt buộc, ≥ 32 ký tự
export APP_BASE_URL="https://học.example.com"       # dùng dựng liên kết đặt lại mật khẩu
export SMTP_URL="smtp://user:pass@smtp.example.com:587"
docker compose --profile app up -d --build
```

Khi khởi động, `api` tự chạy migration (có khóa advisory nên chạy song song vẫn an toàn) rồi mới nhận yêu cầu.
Nạp nội dung lần đầu và tạo admin (chạy trong container `api`):

```bash
docker compose exec api node dist/src/seed/index.js                       # nạp nội dung; KHÔNG tạo admin dev ở production
docker compose exec api node dist/src/seed/create-admin.js --email admin@example.com
#   Mật khẩu: đặt qua biến ADMIN_PASSWORD, hoặc bỏ trống để sinh ngẫu nhiên (in một lần duy nhất).
```

Container `web` gửi CSP chặt (`default-src 'self'`) bằng header HTTP của nginx (nguồn duy nhất; `index.html` không có
meta CSP), HSTS và các header phòng thủ; `api` cũng gửi CSP/`nosniff`/`no-store` cho mọi phản hồi và bật HSTS khi
`NODE_ENV=production` (mặc định trong image).

### Chính sách bảo mật theo môi trường

Client web chạy ở hai chế độ có chính sách bảo mật (CSP) khác nhau, và sự khác nhau này là chủ ý:

| Chế độ  | Cách chạy                                                                                       | Nguồn phục vụ trang                                      | CanvasKit                                     | CSP áp dụng                                              |
| ------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `local` | `.\scripts\start-client.ps1` (`flutter run --no-web-resources-cdn`; Chrome, Edge hoặc `web-server`) | Dev server của Flutter (chèn script nội tuyến cho hot reload/debug) | Cùng nguồn (`localhost`), không cần Internet | Không có (`index.html` không có meta, dev server không gửi header) |
| `prod`  | `flutter build web --release --no-web-resources-cdn` rồi nginx (`client/Dockerfile`, `client/nginx.conf`) | nginx, cùng origin với `/api`                            | Đóng gói sẵn trong `build/web`                | Header của nginx (chặt), nguồn duy nhất                  |

**Vì sao khác nhau.** Dev server của Flutter chèn script nội tuyến có nội dung thay đổi theo phiên nên không thể băm
hay gắn nonce, còn trình duyệt áp dụng **giao** của mọi chính sách (header và meta). Vì vậy một thẻ meta CSP chặt trong
`client/web/index.html` (mẫu dùng chung cho `flutter run` và `flutter build web`) làm trang trắng ở local. CSP của bản
thật chỉ khai báo ở header nginx, nơi có thêm `frame-ancestors 'none'` (meta không hỗ trợ).

**Cách xác nhận từng chế độ**

- Cấu hình (cả hai chế độ): `pnpm test:unit -- web-csp` (`backend/tests/unit/web-csp.test.ts`).
- `local`: chạy `.\scripts\start-client.ps1`, mở DevTools. Tab Console không có lỗi "Content Security Policy"; tab
  Network không có yêu cầu tới `www.gstatic.com` (CanvasKit tải từ `localhost`).
- `prod`: `curl.exe -skI https://localhost/` phải có `Content-Security-Policy` (kèm `frame-ancestors 'none'`, không nguồn
  ngoài) và `Strict-Transport-Security`; mở `https://localhost/` thấy ứng dụng hiển thị, Console không có lỗi chặn.

**Khôi phục khi trình duyệt còn bộ nhớ đệm hoặc service worker lỗi** (trang vẫn trắng sau khi đã sửa cấu hình): tải lại
cứng bằng `Ctrl+Shift+R`; nếu chưa hết, mở DevTools > Application > Storage > Clear site data, và Application >
Service Workers > Unregister, rồi tải lại.

**Quy tắc khi thay đổi**

- KHÔNG ĐƯỢC nới `client/nginx.conf` (thêm `https://www.gstatic.com`, `'unsafe-inline'`, ...) để chữa lỗi hiển thị ở
  local: token đăng nhập lưu ở trình duyệt nên CSP chặt là phòng tuyến chính chống XSS (FR-034).
- KHÔNG ĐƯỢC thêm lại thẻ meta CSP vào `client/web/index.html`; test `web-csp.test.ts` sẽ báo lỗi.
- Muốn đổi chính sách của bản thật, PHẢI sửa `client/nginx.conf` **và** `backend/tests/unit/web-csp.test.ts` trong cùng
  một thay đổi, kèm lý do ghi vào mục này.
- Nginx là cấu hình chuẩn duy nhất mang CSP: nếu phục vụ `build/web` bằng một host tĩnh khác (không nginx) thì bản
  phục vụ đó KHÔNG có CSP trừ khi host đó tự cấu hình header tương đương.
- Bản build release PHẢI dùng `--no-web-resources-cdn` (đã có ở `client/Dockerfile` và `scripts/start-client.ps1`);
  thiếu cờ này CanvasKit tải từ gstatic và bị CSP của nginx chặn.

### Yêu cầu vận hành cho FR-034 (bảo mật và quyền riêng tư dữ liệu)

Phần mã đã làm (mật khẩu argon2id, lọc theo `user_id` từ token, kiểm tra vai trò ở server, header bảo mật, xóa vĩnh
viễn sau 30 ngày) **không thay thế** các yêu cầu hạ tầng sau; người vận hành PHẢI đảm bảo:

1. **TLS bắt buộc** ở mọi đường vào: chỉ công bố cổng 443 (cổng 80 chỉ để chuyển hướng sang HTTPS). Không công bố
   cổng `api` (3000) và `db` (5432) ra Internet — `docker-compose.yml` mặc định không công bố cổng `api`; nếu dùng
   file compose cho production, hãy bỏ ánh xạ cổng `5432` của `db` hoặc giới hạn bằng tường lửa.
2. **Mã hóa dữ liệu lúc lưu trữ**: volume dữ liệu PostgreSQL (`db_data`) PHẢI nằm trên đĩa/volume được mã hóa
   (LUKS, EBS/Persistent Disk có mã hóa hoặc tương đương).
3. **Mã hóa bản sao lưu**: bản sao lưu CSDL (`pg_dump`/snapshot) PHẢI được mã hóa trước khi rời máy chủ (ví dụ
   `pg_dump | age -r <khóa công khai> > backup.sql.age`) và khóa giải mã lưu tách khỏi bản sao lưu. Bản sao lưu cũ vẫn
   chứa dữ liệu của tài khoản đã bị xóa cứng; đặt thời hạn lưu giữ và xoay vòng hợp lý.
4. **Quản lý `JWT_SECRET`**: sinh ngẫu nhiên ≥ 32 ký tự, lưu trong kho bí mật (không commit, không ghi vào image hay
   log). Đổi khóa sẽ vô hiệu mọi access token đang hiệu lực (tối đa 15 phút); refresh token không bị ảnh hưởng. Compose
   từ chối khởi động nếu thiếu `JWT_SECRET`.
5. **Tạo tài khoản admin** bằng `admin:create` như trên (không dùng tài khoản dev `admin@japanese-learning.local`);
   dùng mật khẩu mạnh và nhớ rằng việc vô hiệu hóa tài khoản có hiệu lực với access token đã cấp chậm tối đa 15 phút.
6. **Giới hạn tần suất theo IP** dựa vào `X-Forwarded-For` do nginx đặt (`trustProxy` bật ở production). Nếu đặt thêm
   một lớp proxy/CDN phía trước, cấu hình lại để IP thật của người dùng vẫn đến được `api`.
7. **Sao lưu và khôi phục**: kiểm tra định kỳ việc khôi phục từ bản sao lưu; job `purge-deleted-accounts` (03:17 UTC
   hằng ngày) chạy trong tiến trình `api`, cần giữ `api` luôn chạy.
8. **Vòng đời giấy phép tổ chức** (spec 004): hết hạn/ân hạn/vô hiệu hóa được xử lý ngay khi có người truy cập (xử
   lý lười trong `loadOrgContext`) và bởi job `org-lifecycle` (phút 07 mỗi giờ, cũng chạy trong tiến trình `api`) để
   dọn seat, thành viên lớp và lời mời của tổ chức không ai dùng. **Gia hạn nên bằng cách kéo dài `ends_on`** của
   giấy phép hiện có (`PATCH /admin/organizations/{orgId}/licenses/{licenseId}`): giữ nguyên người giữ seat. Giấy phép
   liền kề mới không tự chuyển seat từ giấy phép cũ; chỉ giáo viên chưa có seat mới được cấp lại theo thứ tự vào
   tổ chức khi giấy phép mới đã hiệu lực lúc tạo.

### Cấu hình tổ chức, lớp học và seat (spec 004)

Các biến môi trường sau có mặc định hợp lý (xem `.env.example`, research O16); chỉ đặt khi cần hiệu chỉnh:

| Biến                                                 | Mặc định           | Ý nghĩa                                                                          |
| ---------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `INVITATION_TTL_DAYS`                                | 14                 | Số ngày lời mời còn hiệu lực                                                     |
| `SEAT_GRACE_DAYS`                                    | 7                  | Ân hạn mặc định sau khi hết hạn giấy phép (0–60; chỉnh được theo từng giấy phép) |
| `SEAT_MAX_REASSIGNMENTS`                             | 2                  | Số lần đổi người giữ tối đa của mỗi seat (mặc định cho giấy phép mới)            |
| `SEAT_EXPIRY_WARNING_DAYS`                           | 14                 | Cảnh báo "sắp hết hạn" khi còn ≤ số ngày này                                     |
| `CLASS_MAX_MEMBERS`                                  | 100                | Số thành viên đang hoạt động tối đa của một lớp                                  |
| `CSV_IMPORT_MAX_ROWS` / `CSV_IMPORT_MAX_BYTES`       | 200 / 262144       | Giới hạn file CSV nhập học viên                                                  |
| `JOIN_CODE_MAX_FAILURES` / `JOIN_CODE_LOCK_MINUTES`  | 5 / 15             | Chống dò mã tham gia (theo tài khoản)                                            |
| `CLASS_ABSENCE_DEFAULT_DAYS`                         | 3                  | Ngưỡng vắng mặc định của lớp mới (1–14)                                          |
| `CLASS_PROGRESS_MARGIN_PCT`                          | 10                 | Biên (%) chậm/vượt tiến độ so với mốc                                            |
| `CLASS_WEAK_ACCURACY_PCT` / `CLASS_WEAK_MIN_ANSWERS` | 60 / 30            | Ngưỡng điểm yếu chung của lớp                                                    |
| `ORG_TIMEZONE`                                       | `Asia/Ho_Chi_Minh` | Múi giờ tính ngày giấy phép (ngày học vẫn theo múi giờ từng học viên)            |

Migration `0004_org_classes.sql` cần extension PostgreSQL `btree_gist` (đi kèm bản phân phối chuẩn, "trusted" từ PG 13).

**Ghi chú phát hành (OpenAPI 1.12.0)**: backend và client web PHẢI được phát hành cùng lúc — client 1.11.0 không hiển
thị khóa điều khiển cho học viên thuộc lớp (máy chủ vẫn từ chối bằng `409 CLASS_MANAGED`). Chuyển lớp chỉ là **lời mời**
(`POST /classes/{id}/members/{userId}/move` → 202); học viên phải đồng ý lại thì mới chuyển. Chỉ số lớp thử nghiệm SC-010
chạy bằng `pnpm report:metrics sc010_class_week4_active_days` (xem `src/reports/README.md`).

## Cấu trúc

Xem [`plan.md`](../specs/001-phase1-mvp/plan.md) mục "Cấu trúc dự án": `src/api` (route Fastify), `src/engine` (Learning
Engine thuần hàm), `src/domain`, `src/db` (schema Drizzle, migration SQL, repository), `src/services`, `src/jobs`
(pg-boss), `src/reports` (truy vấn báo cáo), `src/seed` (nạp nội dung, tạo admin).
