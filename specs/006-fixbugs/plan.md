# Kế hoạch triển khai: Sửa lỗi ứng dụng web không hiển thị khi chạy local

**Nhánh**: `006-fixbugs` (chưa tạo nhánh git) | **Ngày**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Đầu vào**: Đặc tả tính năng tại `/specs/006-fixbugs/spec.md`

## Tóm tắt

Khi chạy local (`flutter run`), trang trắng vì thẻ meta CSP chặt trong `client/web/index.html` (đặt cho triển khai thật)
chặn CanvasKit tải từ `www.gstatic.com` và script nội tuyến của dev server (`Capture.PNG`). Cách sửa:

1. **Bỏ thẻ meta CSP khỏi `client/web/index.html`** (mẫu dùng chung cho local và release). CSP của triển khai thật chỉ
   còn một nơi khai báo: header trong `client/nginx.conf`, giữ nguyên chuỗi chính sách, nên release vẫn chặt như cũ
   (FR-004). Script nội tuyến của dev server không thể băm/nonce nên không thể "cho phép tối thiểu" bằng meta; bỏ meta
   là cách đơn giản và đúng nhất (xem [research.md](research.md) R1).
2. **Local chạy với `--no-web-resources-cdn`** để CanvasKit phục vụ cùng nguồn, không phụ thuộc Internet (R2).
3. **Mở rộng `backend/tests/unit/web-csp.test.ts`** để khẳng định: `index.html` không có meta CSP, nginx giữ CSP chặt,
   không có `add_header` trong `location`, cờ `--no-web-resources-cdn` có ở build release và local (R3).
4. **Cập nhật tài liệu** `backend/README.md` và các chú thích liên quan (R4).

Không đổi dữ liệu, API hay hành vi học tập (FR-008).

## Technical Context

**Language/Version**: Dart 3.13 / Flutter 3.47 (client web); TypeScript 5 + Node (backend, chỉ phần test); PowerShell 5.1 (script chạy local); cấu hình nginx 1.27.

**Primary Dependencies**: Flutter web (CanvasKit), nginx, vitest. Không thêm phụ thuộc mới.

**Storage**: N/A (không đổi dữ liệu).

**Testing**: vitest, dự án `unit` (`pnpm test:unit`) trong `backend/`; kiểm tra thủ công có hướng dẫn ở [quickstart.md](quickstart.md) cho hiển thị trên Chrome/Edge và bản release qua nginx.

**Target Platform**: Trình duyệt web máy tính (Chrome, Edge); môi trường local Windows; triển khai thật bằng Docker (nginx).

**Project Type**: Ứng dụng web (client Flutter + backend REST) theo monorepo `backend/` + `client/` + `scripts/`.

**Performance Goals**: Màn hình đầu tiên hiển thị ≤ 60 giây sau khi mở trang ở local, không tính biên dịch lần đầu (SC-001). Không đổi hiệu năng release.

**Constraints**: CSP release giữ nguyên mức chặt (FR-004); không thêm công cụ build; không đổi giao diện API.

**Scale/Scope**: 6 tệp sửa (`web/index.html`, `nginx.conf`, `start-client.ps1`, `web-csp.test.ts`, `backend/README.md`, chú thích `Dockerfile` nếu cần); 0 tệp mã học tập.

## Constitution Check

*Cổng: phải đạt trước Phase 0; kiểm lại sau Phase 1.* Đối chiếu Hiến pháp v1.2.0.

| Nguyên tắc / Quy tắc | Đánh giá | Ghi chú |
| --- | --- | --- |
| I. Học vi mô | Đạt (không liên quan) | Không đổi nội dung hay kế hoạch học. |
| II. Learning Engine | Đạt (không liên quan) | Không đổi logic cá nhân hóa. |
| III. Người học kiểm soát | Đạt (không liên quan) | Không đổi quyền ghi đè của người học. |
| IV. Phương pháp dựa trên bằng chứng | Đạt (không liên quan) | Không đổi ôn tập/tiến độ. |
| V. Đa nền tảng, ưu tiên Web | Đạt | Chỉ sửa hạ tầng client web; không thêm mã riêng nền tảng. |
| VI. Kiến trúc tách biệt | Đạt | Không đổi hợp đồng giữa frontend/backend; CSP của API giữ nguyên. |
| Giai đoạn | Đạt | Giai đoạn 1 (MVP), sửa lỗi hạ tầng; không xây tính năng giai đoạn sau. |
| Tiêu chí thành công hỗ trợ | Đạt | Không đổi tiêu chí nào; khôi phục khả năng chạy thử mọi mô-đun (đúng như spec). |
| Hợp đồng API/schema | Đạt | Không thay đổi; cấu hình bảo mật được ghi thành [hợp đồng](contracts/security-config.md). |
| Độ phức tạp thêm vào | Đạt | Không thêm dịch vụ/lớp/thư viện; đã loại phương án tiêm meta lúc build vì phức tạp hơn (R1). |
| Bảo mật FR-034 (spec 001) | Đạt | CSP release không đổi chuỗi; còn một nơi khai báo nên không thể lệch pha. Đổi lại mất lớp meta dự phòng khi host không phải nginx: rủi ro được ghi và chấp nhận ở research. |

**Kết quả cổng đầu**: ĐẠT, không vi phạm cần biện minh.

**Kiểm lại sau thiết kế (Phase 1)**: ĐẠT. Thiết kế chỉ sửa cấu hình/test/tài liệu; hợp đồng C-01..C-08 phủ FR-004, FR-006; không phát sinh vi phạm mới.

## Cấu trúc dự án

### Tài liệu (tính năng này)

```text
specs/006-fixbugs/
├── plan.md              # Tệp này
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── security-config.md   # Phase 1: điều kiện bất biến cấu hình bảo mật
└── tasks.md             # Phase 2 (/speckit-tasks, chưa tạo)
```

### Mã nguồn (gốc kho)

Ứng dụng web: client Flutter + backend Node, kèm script chạy local. Các tệp bị tác động:

```text
client/
├── web/index.html          # SỬA: bỏ meta CSP, cập nhật chú thích
├── nginx.conf              # SỬA chú thích (bỏ "khớp thẻ meta"); chuỗi CSP KHÔNG đổi
└── Dockerfile              # (giữ nguyên; đã có --no-web-resources-cdn, chỉ test đọc)
scripts/
└── start-client.ps1        # SỬA: local thêm --no-web-resources-cdn; cập nhật chú thích
backend/
├── tests/unit/web-csp.test.ts   # SỬA: đảo khẳng định meta, thêm C-02..C-07
└── README.md                    # SỬA: mục "Chính sách bảo mật theo môi trường", sửa lệnh build prod
```

**Quyết định cấu trúc**: Giữ nguyên bố cục monorepo hiện có; không thêm thư mục hay dự án mới. Test cấu hình đặt ở
`backend/tests/unit/` cạnh `web-csp.test.ts` vì đó là nơi dự án đã kiểm thử CSP của client.

## Theo dõi độ phức tạp

Không có vi phạm Constitution Check cần biện minh.
