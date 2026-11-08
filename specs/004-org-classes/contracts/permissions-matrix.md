# Ma trận phân quyền: Tổ chức, Lớp học và Lộ trình lớp

**Nhánh**: `004-org-classes` | **Hợp đồng**: [api-changes.md](api-changes.md) | **Nghiên cứu**: [research.md §O2](../research.md)

Đây là **nguồn dữ liệu duy nhất** cho (a) bộ kiểm thử ma trận quyền `backend/tests/contract/org-authz-matrix.test.ts` (đọc `backend/tests/fixtures/authz-matrix.json` sinh/đối chiếu từ bảng này) và (b) rà soát SC-004. Mọi route mới PHẢI có dòng ở đây; kiểm thử thất bại nếu một route đăng ký mà thiếu dòng.

## 1. Vai trò thử nghiệm

| Ký hiệu | Chủ thể | Đặc điểm |
|---|---|---|
| `ANON` | Không đăng nhập | không có Bearer |
| `USR` | Người học cá nhân | không thuộc tổ chức nào |
| `LRN` | Học viên của lớp C (tổ chức A) | có `class_memberships` hiệu lực |
| `TCH` | Giáo viên phụ trách lớp C (A), có seat | `dataAccess = true` |
| `TCH0` | Giáo viên phụ trách lớp C (A), **mất seat** | giữ vai trò, `dataAccess = false` (FR-038) |
| `TCHx` | Giáo viên của A **không** phụ trách C | |
| `OWN` | Chủ tổ chức A | không chiếm seat |
| `ADM` | Quản trị viên hệ thống | `role=admin`, không thuộc tổ chức |
| `OWNb` / `TCHb` | Chủ tổ chức / giáo viên của tổ chức B | để thử truy cập chéo tổ chức |

Kết quả: **2xx** được phép; **401** chưa xác thực; **403** sai vai trò (không lộ đối tượng); **404** đối tượng ngoài phạm vi hoặc không tồn tại — thân phản hồi **giống hệt nhau** (`{"code":"NOT_FOUND","message":"Không tìm thấy tài nguyên"}`); **409** cho `CLASS_MANAGED`.

## 2. Ma trận theo nhóm route

Cột đối tượng `C` = lớp của A; `L` = học viên đang thuộc C.

| Nhóm route | ANON | USR | LRN | TCH | TCH0 | TCHx | OWN | ADM | OWNb/TCHb |
|---|---|---|---|---|---|---|---|---|---|
| `/admin/organizations*`, `GET /admin/action-logs?organizationId` | 401 | 403 | 403 | 403 | 403 | 403 | 403 | 2xx | 403 |
| `GET /org`, `/org/*` (OWN) | 401 | 403 | 403 | 403 | 403 | 403 | 2xx | 403 | 403 (chỉ thấy tổ chức mình, không thấy A) |
| `GET /classes` | 401 | 403 | 403 | 2xx (lớp mình) | 2xx (lớp mình) | 2xx (lớp mình) | 2xx (mọi lớp A) | 403 | 2xx (chỉ lớp của B) |
| `POST /classes` | 401 | 403 | 403 | 2xx | 2xx | 2xx | 2xx | 403 | 2xx (trong B) |
| `GET /classes/{C}`, `/roster`, `/join-code`, `/path`, `/pauses` (cấu trúc) | 401 | 403 | 403 | 2xx | 2xx | **404** | 2xx | 403 | **404** |
| Ghi cấu trúc lớp C: `PATCH`, `archive`, `invitations`, `import`, `join-code`, `path`, `path/units`, `assignments`, `override`, `exemptions`, `pauses`, `move*`, `DELETE members/{L}` | 401 | 403 | 403 | 2xx | 2xx (gỡ/đổi cấu trúc được; **mời mới cần seat còn trống của tổ chức**, không cần seat của chính mình) | **404** | 2xx | 403 | **404** |
| `PUT /classes/{C}/teachers` | 401 | 403 | 403 | 403 | 403 | 403 | 2xx | 403 | 403/404 |
| **Dữ liệu học viên**: `dashboard`, `members/{L}/detail`, `weak-topics`, `export.csv`, `members/{L}/export.csv`, `placement-requests/current` | 401 | 403 | 403 | 2xx | **403** | **404** | 2xx | 403 | **404** |
| Dữ liệu học viên khi `L` đã rời/bị gỡ/mất seat/xóa tài khoản | — | — | — | **404** ngay | 404 | 404 | **404** ngay | — | 404 |
| Mọi route lớp khi C lưu trữ (ghi) | — | — | — | 409 `CLASS_ARCHIVED` | 409 | 404 | 409 | — | 404 |
| `GET /invitations/{token}`, `POST …/respond` | 401 | 2xx nếu email khớp, 404 nếu không | tương tự | tương tự | tương tự | tương tự | tương tự | tương tự | tương tự |
| `POST /me/class/join` (mã đúng của lớp C) | 401 | 2xx | 409 `ALREADY_IN_CLASS` | 409 `INVITEE_UNAVAILABLE` (không được là học viên lớp mình phụ trách); mã của lớp khác cùng tổ chức: 2xx, vẫn một seat | 409 `INVITEE_UNAVAILABLE` (như `TCH`) | 2xx (lớp khác C) | 2xx (chiếm một seat như học viên) | 2xx | 409 `INVITEE_UNAVAILABLE` (mã thuộc tổ chức khác; thông điệp chung, không nêu tên tổ chức) |
| `GET /me/class`, `POST /me/class/leave` | 401 | 404 | 2xx | 404 | 404 | 404 | 404 | 404 | 404 (trừ khi cũng là học viên) |
| Thao tác bị khóa (`PATCH /me` trường lộ trình, `/onboarding*`, `/path/pause|resume|rebuild`, `/path/*/master`, `/placement/submit` không `classRequestId`) | 401 | 2xx | **409 `CLASS_MANAGED`** | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx |
| Thao tác được phép khi thuộc lớp (`PATCH /me` `displayName|language|timezone|email`, mật khẩu, `POST /account/delete`, `GET /progress`, `GET /today`, `POST /today/extra`) | 401 | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx | 2xx |
| `/admin/*` công cụ nội dung/người dùng hiện có | 401 | 403 | 403 | **403** | **403** | **403** | **403** | 2xx | **403** |

## 3. Quy tắc bất biến cần kiểm thử

1. **Không lộ sự tồn tại** (FR-007): với cùng một người gọi, phản hồi cho `GET /classes/{id-lớp-của-B}` và `GET /classes/{id-ngẫu-nhiên}` phải **trùng từng byte** (trừ `Date`/header động); tương tự lời mời, thành viên, bài giao, khoảng tạm dừng.
2. **Hiệu lực tức thì** (FR-037, SC-008): dùng *cùng một access token* của `TCH`/`OWN`; ngay sau khi `L` rời lớp / bị gỡ / mất seat / xóa tài khoản / lớp lưu trữ / giấy phép quá ân hạn / tổ chức bị vô hiệu hóa / giáo viên bị gỡ vai trò, request kế tiếp → 404 (hoặc 403 cho `TCH0`) — không chờ token hết hạn.
3. **Một tài khoản một tổ chức** (FR-002): lời mời (giáo viên/chủ/học viên) tới tài khoản của tổ chức khác → `INVITEE_UNAVAILABLE`, thân phản hồi **không chứa tên tổ chức kia**; chấp nhận lời mời khi đã vào tổ chức khác (đua) → từ chối như vậy.
4. **Giáo viên ≠ admin** (FR-002): `OWN`/`TCH` gọi `/admin/*` (kể cả `/admin/organizations*`) → 403; `ADM` không có route nào trả dữ liệu học viên của lớp (chỉ cấu trúc + người giữ seat).
5. **Giáo viên không tự xem mình qua giao diện giáo viên** (trường hợp biên): `TCH` đồng thời là học viên lớp D (khác C): `GET /classes/{D}/…` nếu không phụ trách D → 404; một tài khoản KHÔNG ĐƯỢC là học viên của lớp mình phụ trách (`POST …/respond` hoặc `POST /me/class/join` vào chính lớp đó → 409 `INVITEE_UNAVAILABLE`; lời mời học viên cho email của giáo viên phụ trách lớp đó bị từ chối ngay lúc gửi với `outcome=unavailable`).
6. **Học viên đã đóng thành viên** không lộ chi tiết: `GET /classes/{C}/members/{L}/detail` → 404; `roster` chỉ có tên + ngày + lý do.
7. **Danh sách trắng DTO**: snapshot khóa JSON của `ClassLearnerRow`/`ClassLearnerDetail` khớp đúng FR-035 (thêm khóa mới làm test đỏ).
8. **Nhập mã**: mã đúng/sai/tắt/hết hạn/lớp lưu trữ/lớp chưa lộ trình cho cùng một phản hồi 404; sai ≥ 5 lần liên tiếp → 429 cho tài khoản đó (kể cả với mã đúng trong thời gian khóa).
