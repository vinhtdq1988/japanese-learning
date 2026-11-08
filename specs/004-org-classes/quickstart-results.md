# Kết quả kiểm chứng quickstart: Tổ chức, Lớp học và Lộ trình lớp

**Ngày chạy**: 2026-11-08 | **Môi trường**: PostgreSQL 17 nhúng (không Docker), Vitest + `flutter test` | **Hợp đồng**: OpenAPI 1.12.0

Tài liệu này ghi kết quả đối chiếu các kịch bản OG1–OG8 của [quickstart.md](quickstart.md) với kiểm thử tự động, và nêu rõ phần **chưa kiểm chứng** vì cần người thật / trình duyệt / Mailpit.

## 1. Kết quả chạy toàn bộ (T135)

| Lệnh | Kết quả |
|---|---|
| `eslint .` / `tsc --noEmit` / `prettier --check .` (backend) | sạch |
| `vitest run` (backend, unit + db) | **2300 xanh / 5 đỏ**. 5 test đỏ là `kanji-admin.test.ts` (4) và `kanji-us5.test.ts` (1) của **spec 003**, đã đỏ y hệt tại commit `bfb7ca5` — không phải hồi quy spec 004 |
| `org-authz-matrix.test.ts` | xanh, 900 test; mọi route mới có dòng trong ma trận |
| `org-regression-golden.test.ts`, `org-regression-api.test.ts` | xanh (SC-012) |
| `flutter test` (client) | **316 xanh** |
| `flutter analyze`, `dart run tool/check_l10n.dart` | sạch; 910 khóa vi = en |

## 2. Đối chiếu OG1–OG8 với kiểm thử tự động

| Kịch bản | Bằng chứng tự động | Trạng thái |
|---|---|---|
| OG1 tổ chức, seat, mời giáo viên, cô lập | `org-us1`, `org-seats`, `org-concurrency`, `org-lapse`, `org-teacher-removal`, ma trận quyền (404 trùng byte) | đạt |
| OG2 tạo lớp, mời, mã, CSV, hết seat | `org-us2`, `org-invitations`, `join-code`, `class-csv-import`, `class-archive` | đạt |
| OG3 lộ trình lớp, khóa, rời lớp, hồi quy | `org-us3`, `class-managed-lock`, `class-learning-context`, `class-lifecycle`, golden | đạt |
| OG4 bảng điều khiển, hiệu năng | `class-dashboard`, `org-us4`; 100 học viên × 120 ngày: 269–288 ms (research O11) | đạt |
| OG5 chọn bài, bài giao, ghi đè, tạm dừng | `class-adjustments`, `org-us5`, `class-path`, `class-feasibility` | đạt |
| OG6 hai lựa chọn, vòng đời | `org-us6`, `org-lapse`, `class-account-deletion`, `invite_choice_test`, `leave_flow_test` | đạt |
| OG7 cảnh báo, chủ đề yếu, CSV | `class-weak-topics`, `class-csv-export`, `org-us7`, `class_alerts_test` | đạt |
| OG8 kiểm tra trình độ lớp, chuyển lớp | `class-placement`, `class-move`, `class_placement_test`. Theo quyết định của chủ dự án, chuyển lớp là **mời, học viên đồng ý lại** | đạt |

## 3. CHƯA kiểm chứng (cần người thật / môi trường thật)

- Chạy đầu-cuối qua **trình duyệt thật + Mailpit** (xem thư mời song ngữ hiển thị trong hộp thư). Máy này không có Docker/Mailpit.
- **SC-002**: nhập 30 học viên bằng CSV trong ≤ 10 phút — cần phiên thử có bấm giờ với giáo viên thật; chưa ghi thời gian thực.
- **SC-013**: đếm số lần nhấp chuyển nguồn học trên giao diện thật (widget test chỉ xác nhận có đủ hai lựa chọn và một bước xác nhận).
- **SC-001**, `pnpm report:metrics` trên lớp thử nghiệm thật; **SC-010/SC-011** là chỉ số sau phát hành (truy vấn SC-010 đã có và có test).

Vì các mục trên chưa làm, T136 **chưa** được đánh dấu hoàn thành.
