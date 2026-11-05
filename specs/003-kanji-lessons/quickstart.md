# Hướng dẫn kiểm chứng: Bài học Kanji

**Nhánh**: `003-kanji-lessons` | **Kế hoạch**: [plan.md](plan.md) | **Hợp đồng**: [contracts/api-changes.md](contracts/api-changes.md)

Tài liệu này mô tả các kịch bản chạy được để chứng minh tính năng hoạt động đầu-cuối. Cài đặt môi trường, biến môi trường và lệnh chung xem [quickstart 001](../001-phase1-mvp/quickstart.md); ở đây chỉ nêu phần khác.

## 1. Chuẩn bị

```bash
docker compose up -d db mailpit
cd backend
pnpm install
pnpm db:migrate     # chạy thêm 0002_kanji_skill.sql, 0003_kanji.sql
pnpm seed           # nạp thêm 7 bài Kanji + chủ đề Kanji; kiểm tra JSON Schema 1.1.0, quy tắc K10 và phủ glyph
pnpm dev

cd ../client
# sinh lại API client từ OpenAPI 1.11.0: làm đúng các bước trong client/lib/data/api/README.md
# (openapi-generator-cli dart-dio → build_runner trong generated/ → dart run tool/patch_generated_api.dart)
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

**Kết quả mong đợi**: seed in số bài Kanji đã nạp (7) và không có lỗi kiểm tra; `GET /api/v1/admin/topics?skill=kanji` (tài khoản admin dev) trả 6 chủ đề.

Kiểm tra migration trên dữ liệu cũ: chạy `pnpm db:migrate` trên một CSDL đã có người học 001 với lịch ôn → mọi dòng `review_schedules` cũ có `facet='item'`, kế hoạch hôm nay của họ không đổi.

## 2. Kiểm thử tự động

```bash
cd backend && pnpm test                 # đơn vị engine + hợp đồng 1.11.0 + tích hợp
cd backend && pnpm lint && pnpm typecheck && pnpm format:check
cd client  && flutter test && flutter analyze && dart run tool/check_l10n.dart
```

Các nhóm kiểm thử chính (vị trí đề xuất):

| Nhóm | File | Chứng minh |
|---|---|---|
| Hồi quy không-Kanji | `backend/tests/unit/kanji-regression-golden.test.ts` | SC-006, FR-009: kế hoạch 14 ngày của mọi hồ sơ cũ trùng ảnh chụp `tests/fixtures/golden/plans-pre-kanji.json` |
| Suất Kanji + quỹ thời gian | `backend/tests/unit/daily-plan-kanji.test.ts` | SC-001, SC-002, FR-008, FR-012: hồ sơ Kanji × {5,10,15,30} phút; có bài Kanji ở ngày đầu có bài mới; tổng ≤ quỹ, mỗi mục ≤ 15 phút |
| SRS theo cặp | `backend/tests/unit/srs-kanji-facets.test.ts` | SC-005, US3.3–3.5 |
| Quy tắc nội dung | `backend/tests/unit/content-validation-kanji.test.ts`, `content-files.test.ts` | SC-003, SC-004, FR-021, phủ glyph (FR-006) |
| Hợp đồng | `backend/tests/contract/kanji.test.ts` | OpenAPI 1.11.0 |
| Tích hợp | `backend/tests/integration/kanji-*.test.ts` | US1–US5 với PostgreSQL thật |
| Widget | `client/test/presentation/lesson/kanji_card_test.dart` | hiển thị chữ lớn, chỉ hiện nhóm cách đọc có dữ liệu, song ngữ |

## 3. Kịch bản thủ công

Mỗi kịch bản liệt kê bước và kết quả mong đợi; tất cả đều có kiểm thử tự động tương ứng ở mục 2.

### KJ1 – Chọn Kanji khi onboarding và học bài đầu tiên (US1, US2; SC-001)

1. Đăng ký tài khoản mới, onboarding: trình độ "chưa biết gì", mục tiêu JLPT N5, 10 phút/ngày, chọn kỹ năng Từ vựng + **Kanji** (Nghe, Đọc vẫn hiển thị khóa "chưa có trong phiên bản này"). Bỏ qua placement.
2. Mở "Hôm nay".
3. Nhấp mục bài Kanji → bài mở (≤ 2 lần nhấp).
4. Học qua từng chữ, làm hết bài tập, trả lời sai cố ý một câu.

**Mong đợi**: kế hoạch có một mục bài mới nhãn Kanji, tổng ≤ 10 phút. Mỗi chữ hiển thị cỡ lớn, nghĩa tiếng Việt, âm On (katakana) và/hoặc âm Kun (hiragana) – chỉ nhóm có dữ liệu, số nét, ≥ 1 từ ví dụ có kana và nghĩa, cách đọc của chữ trong từ được nêu rõ. Mỗi câu có phản hồi tức thì. Tóm tắt cuối bài có số câu đúng và mục "Chữ cần chú ý" chứa chữ đã sai.

### KJ2 – Tiếp tục bài dở và mất kết nối (US1.3; FR-005)

1. Mở bài Kanji, trả lời 2 câu, đóng tab.
2. Mở lại "Hôm nay" → tiếp tục bài.
3. Tắt mạng (DevTools → Offline), trả lời 1 câu, nhấn hoàn thành; bật mạng lại.

**Mong đợi**: bài tiếp tục từ câu thứ 3, 2 câu đã trả lời còn nguyên. Khi offline không báo hoàn thành; sau khi có mạng câu trả lời được gửi một lần (`clientEventId`) và bài hoàn thành.

### KJ3 – Người học không chọn Kanji không bị ảnh hưởng (US2.3; SC-006)

1. Đăng nhập một tài khoản 001 có sẵn (chỉ Từ vựng + Ngữ pháp).
2. So sánh `GET /api/v1/today` và `GET /api/v1/progress` trước/sau khi triển khai.

**Mong đợi**: không có mục Kanji, `kanjiNotice` vắng mặt, `progress.kanji = null`, các số liệu khác không đổi.

### KJ4 – Thêm Kanji cho người học đang dùng; ưu tiên Kanji (US2.4, US2.5; FR-010)

1. Tài khoản ở KJ3 → "Điều chỉnh kế hoạch" → bật Kanji. Kế hoạch hôm nay không đổi.
2. Giả lập sang ngày hôm sau (đổi đồng hồ kiểm thử, hoặc chờ qua ngày địa phương) → mở "Hôm nay".
3. Đặt kỹ năng ưu tiên = Kanji; sang ngày kế tiếp.

**Mong đợi**: bước 2 có bài Kanji; `unit_progress`, lịch ôn từ vựng/ngữ pháp còn nguyên. Bước 3: bài Kanji đứng đầu phần bài mới mỗi ngày, tổng vẫn ≤ quỹ.

### KJ5 – Ôn Kanji theo khía cạnh (US3; SC-005)

1. Sau KJ1, giả lập +1 ngày → mở gói ôn.
2. Với chữ X: trả lời đúng câu nghĩa, sai câu cách đọc.
3. Kiểm tra `review_schedules` của X (hoặc `nextReviewDate` trong `AnswerResult`).

**Mong đợi**: gói ôn chứa các cặp (chữ, khía cạnh) đến hạn, nằm trong quỹ ôn chung với từ vựng. Cặp (X, reading) đến hạn sau 1 ngày; (X, meaning) đến hạn muộn hơn; (X, word) không đổi lịch.

### KJ6 – Tiến độ Kanji và mảng yếu (US4; SC-007)

1. Từ "Hôm nay" mở "Tiến độ" (≤ 2 lần nhấp).
2. (Dữ liệu kiểm thử) sai liên tục ≥ 8 câu ở các chữ chủ đề "Thời gian".

**Mong đợi**: khối Kanji hiển thị số chữ đã học, số bài Kanji hoàn thành, thời gian Kanji, độ chính xác ôn Kanji; tổng thời gian và chuỗi ngày vẫn gồm Kanji. "Thời gian" xuất hiện trong mảng yếu kèm nhãn Kanji.

### KJ7 – Bỏ chọn Kanji và đánh dấu chữ thành thạo (trường hợp biên; FR-010)

1. Bỏ Kanji khỏi kỹ năng; sang ngày kế tiếp.
2. Đánh dấu một chữ đã thành thạo (`PUT /path/items/{itemId}/master`).

**Mong đợi**: bước 1 không còn bài Kanji mới, nhưng các cặp Kanji đến hạn vẫn vào gói ôn; tiến độ Kanji vẫn hiển thị lịch sử. Bước 2: chữ đó không còn trong gói ôn; bỏ đánh dấu thì quay lại.

### KJ8 – Hết bài Kanji ở trình độ (US2.6; FR-013)

Dùng hồ sơ kiểm thử `kanji-exhausted-n5` (mục tiêu N5, đã hoàn thành mọi bài Kanji N5).

**Mong đợi**: `GET /today` có `kanjiNotice = {code: kanji_exhausted, suggestion: raise_level}`; UI hiển thị thông báo và gợi ý; kế hoạch vẫn có từ vựng/ôn tập, không trống.

### KJ9 – Quản trị nội dung Kanji (US5; SC-009)

1. Đăng nhập admin → Nội dung → tạo bài `kind=Kanji`, N4, 5 phút, chỉ 2 chữ, chữ thứ hai không có chủ đề → Kích hoạt.
2. Sửa cho đủ 3 chữ, mỗi chữ đủ nghĩa vi/en, cách đọc, số nét, chủ đề, từ ví dụ và bài tập cho ba khía cạnh → Kích hoạt.
3. Với tài khoản người học N4 đã chọn Kanji: dùng "Học thêm" sau ≤ 5 phút.
4. Admin sửa một chữ mà người học đã có lịch ôn (đổi nghĩa) và ngừng một bài tập.
5. Mở nhật ký quản trị.

**Mong đợi**: bước 1 bị từ chối 422 liệt kê "3–5 chữ" và "thiếu thẻ chủ đề" (cùng mọi lỗi khác). Bước 2 thành công. Bước 3 thấy bài mới (không phát hành client). Bước 4: lịch ôn, lịch sử của người học còn nguyên; bài tập đã ngừng không còn xuất hiện trong phiên mới. Bước 5: có `unit.create`, `unit.update`, `unit.status` kèm người thực hiện và thời gian.

### KJ10 – Hiển thị phông (FR-006)

Build `flutter build web --release --no-web-resources-cdn`, mở các bài Kanji trên Chrome, Edge, Firefox, Safari desktop.

**Mong đợi**: mọi chữ Kanji và từ ví dụ hiển thị đúng bằng Noto Sans JP, không ô vuông; nét đủ rõ ở cỡ chữ chính. (Phủ glyph cũng được khẳng định tự động ở seed và `content-files.test.ts`.)

## 4. Chỉ số sản phẩm

```bash
cd backend && pnpm report:metrics     # thêm SC-001 (kế hoạch đầu tiên sau khi chọn Kanji có bài Kanji) và SC-008
```

**Mong đợi**: báo cáo có hai dòng mới `kanji_first_plan_has_kanji_ratio` và `kanji_completed_within_3_days_ratio`, tính từ `learning_profiles.kanji_selected_at` (xem [research K15](research.md#k15-đo-chỉ-số-sản-phẩm)).
