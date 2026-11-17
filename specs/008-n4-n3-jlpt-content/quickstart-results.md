# Kết quả kiểm chứng quickstart: Bổ sung nội dung học N4 → N3 đầy đủ để thi JLPT

Tài liệu này ghi số liệu đo và kết quả đối chiếu các kịch bản QS1–QS8 của [quickstart.md](quickstart.md). Mục "Baseline" được ghi TRƯỚC khi sửa mã (T002) để làm chuẩn so sánh cho SC-007 / bất biến I9; các mục sau được điền ở các phase nghiệm thu.

## Baseline

**Ngày đo**: 2026-11-14 | **Môi trường**: Windows 10, Node.js 26.13, PostgreSQL 17 nhúng (không Docker, cổng 5434, CSDL `jl_test2`), nhánh `master` tại `283b362` cộng các thay đổi chưa commit của spec trước | **Thư viện**: `CONTENT_RELEASES=000-baseline` — **33 đơn vị** `active` (N5: 13, N4: 10, N3: 10)

**Cách đo**: script `backend/tests/load/measure-today.ts` (không qua mạng, `app.inject`, không kiểm tra hợp đồng nên số đo là chi phí ứng dụng + CSDL). Tài khoản N4 → mục tiêu JLPT N3, 15 phút/ngày, kỹ năng từ vựng + ngữ pháp + Kanji; 200 lần gọi mỗi điểm đo sau 10 lần khởi động. Ba điểm đo:

- `today_generate`: mỗi lần gọi là một ngày mới (đồng hồ giả tiến 1 ngày) nên `GET /today` phải **sinh lại kế hoạch** (`rankUnits` + gói ôn + ghi kế hoạch) — đường đắt nhất, là điều SC-007 quan tâm;
- `today_cached`: `GET /today` cùng ngày, chỉ đọc kế hoạch đã sinh;
- `path`: `GET /path` không lọc.

**Lệnh**:

```bash
cd backend
LOAD_DATABASE_URL=postgres://postgres:pw@localhost:5434/jl_test2 \
CONTENT_RELEASES=000-baseline npx tsx tests/load/measure-today.ts --label baseline
```

Script XÓA SẠCH CSDL được trỏ tới rồi seed lại, và từ chối chạy nếu tên CSDL không chứa "test", "load" hoặc "golden".

**Kết quả ba lần chạy liên tiếp (ms)**:

| Điểm đo | Lần 1 p50 / p95 | Lần 2 p50 / p95 | Lần 3 p50 / p95 | **p95 trung vị** |
|---|---|---|---|---|
| `today_generate` | 23,6 / 33,3 | 22,1 / 30,4 | 20,9 / 27,7 | **30,4** |
| `today_cached` | 7,5 / 11,1 | 7,0 / 8,4 | 6,8 / 8,7 | **8,7** |
| `path` | 3,8 / 7,1 | 3,5 / 5,5 | 3,6 / 5,4 | **5,5** |

Seed 33 đơn vị: ≈ 0,7 giây (lần 1).

**Lưu ý khi so sánh (SC-007, I9)**: p95 `today_generate` dao động ±~3 ms giữa các lần chạy (≈ 10%) ở thư viện nhỏ này, nên khi so với thư viện đầy đủ PHẢI chạy lại ≥ 3 lần trên cùng máy và so **trung vị của p95** (30,4 ms), không so một lần đo đơn lẻ. Ngưỡng SC-007: `GET /today` p95 chậm hơn **không quá 10%** (≤ ≈ 33,4 ms theo baseline này); `GET /path` không lọc ≤ 300 ms ở thư viện đầy đủ.

Golden hồi quy trước khi sửa engine (T001): `backend/tests/fixtures/golden/plans-pre-008.json` — 29 hồ sơ cá nhân × 14 ngày trên 33 đơn vị, gồm kế hoạch ngày, thứ tự lộ trình và tiến độ.

## Phase 2 – So sánh golden bước 0 sau khi thêm biên giới (T036)

**Ngày**: 2026-11-14 | **Lệnh**: chạy lại `generate-plans-pre-008.ts` bằng engine MỚI (`CONTENT_RELEASES=000-baseline`) ra tệp tạm và so từng khóa với `plans-pre-008.json` (tệp chuẩn KHÔNG bị sửa).

**Kết quả**: phần tiến độ (`completionRatio`, `progress`) **giống hệt** (chưa đổi: D12 làm ở T214). Kế hoạch ngày giống hệt ở 27/29 hồ sơ. Khác biệt nằm hoàn toàn ở **phần ngoài biên giới của hồ sơ nhiều trình độ** — đúng loại thay đổi mà [research.md D10](research.md) dự báo — đã được rà soát có chủ đề như dưới đây, không có khác biệt âm thầm nào khác.

| Nhóm khác biệt | Hồ sơ | Biểu hiện | Rà soát |
|---|---|---|---|
| Thứ tự lộ trình (`path`) ở khối N3 | 17 hồ sơ: `newcomer-10min`, `kanji-newcomer-5min`, `five-minute-backlog`, `low-accuracy-topic`, `high-accuracy-topic`, `kanji-removed`, `competency-new`, `competency-recovering`, `recovered-weak-topic`, `returning-after-gap`, `reward-newcomer`, `reward-near-streak`, `reward-veteran`, `reward-perfect`, `reward-goal-jump`, `encouragement-in-progress`, `encouragement-day-completed` | `[ngữ pháp bị động, từ vựng xã hội, ngữ pháp điều kiện, từ vựng công sở]` → `[từ vựng công sở, ngữ pháp bị động, từ vựng xã hội, ngữ pháp điều kiện]` | Công thức cũ xen kẽ các loại theo điểm (thẻ mục tiêu +20 lệch khỏi `sequence`) nên đặt từ vựng xã hội (`sequence` 20) TRƯỚC từ vựng công sở (`sequence` 10). Nay mỗi loại đi đúng `(trình độ, sequence)`: đơn vị N3 đầu tiên của mỗi loại ở trong biên giới, đơn vị thứ hai ở ngoài. Đây chính là mục tiêu của D10 |
| Thứ tự lộ trình ở khối N4 có luyện đọc/viết | `practice-30min`, `competency-mixed` | đơn vị luyện đọc/viết N4 đầu tiên (trong biên giới) đứng trước các đơn vị từ vựng/ngữ pháp N4 thứ 4 trở đi (ngoài biên giới) | Cùng cơ chế: biên giới của mọi loại được xét trước phần ngoài biên giới. Nằm ở vị trí 13–21 của lộ trình nên không ảnh hưởng kế hoạch 14 ngày của hai hồ sơ này |
| Thứ tự lộ trình có Kanji ưu tiên | `kanji-prioritized-30min`, `kanji-n4-15min` | đơn vị Kanji đầu của mỗi trình độ (trong biên giới) đứng cùng nhóm biên giới thay vì xen giữa các đơn vị từ vựng/ngữ pháp ngoài biên giới | Hợp D10 (thích ứng chỉ hoán đổi trong biên giới) |
| Hoán đổi nhỏ giữa hai đơn vị cùng trình độ | `placement-guesser`, `encouragement-behind-target`, và khối N4 của `competency-recovering`, `recovered-weak-topic`, `returning-after-gap` | hai đơn vị khác loại đổi chỗ khi một trong hai là đơn vị thứ 4 trở đi của loại mình | Cùng cơ chế biên giới; không đổi tập đơn vị, chỉ đổi thứ tự |
| Kế hoạch ngày | `jlpt-n1-goal` (ngày 0 và 1), `kanji-newcomer-5min` (ngày 11 và 12) | hoán đổi hai đơn vị N3 mới: ngày 0 của `jlpt-n1-goal` chọn từ vựng N3 đầu tiên (`n3-vocabulary-work-office`) thay cho ngữ pháp N3 thứ hai (`n3-grammar-conditionals-reason`, ngoài biên giới) | Chấp nhận: đơn vị đầu của loại đứng trước đơn vị thứ hai (đúng thứ tự giáo trình) |

**Xử lý golden**: ba tệp golden của spec trước có hồ sơ `jlpt-n1-goal` — `plans-pre-kanji.json`, `plans-pre-org.json`, `plans-pre-practice.json` — được cập nhật CÓ CHỦ ĐÍCH đúng mục của hồ sơ này (ghi lý do ở khóa `approvedDeltas` của từng tệp; diff chỉ gồm hoán đổi hai đơn vị ngày 0 và ngày 1). `plans-pre-008.json` giữ nguyên làm chuẩn bước 0. Kiểm thử `class-path.test.ts` được sửa tương ứng: mảng yếu chỉ kéo lên đơn vị TRONG biên giới; đơn vị ngoài biên giới giữ thứ tự (kiểm thử mới nêu rõ). Các kiểm thử `path.test.ts`, `daily-plan*.test.ts`, `kanji-regression-golden`, `practice-regression-golden`, `org-regression-golden` đạt.

## Đợt 004-vocab-n4-a (T091–T092)

**Ngày**: 2026-11-15 | **Hồ sơ duyệt**: `content/releases/004-vocab-n4-a.json` (người duyệt tdq_vinh, ghi theo chỉ định trực tiếp trong phiên).

| Bước (T092) | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi, 0 cảnh báo; coverage thoát `0`; từ vựng N4 phủ 344/716 (48,0%; gồm 8 từ baseline) |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt. Toàn bộ project `unit`: 58 file, 1.100 test đạt (sau khi cô lập thư mục nội dung tạm ở `synthetic-content.ts` chỉ còn baseline và cho `content-files` nạp `releases: 'all'`) |
| (3) Seed + `seed-release-idempotent` | PostgreSQL nhúng: `seed-release-idempotent`, `seed-amendments`, `admin-activation-duplicate`, `seed` đạt (test `seed` đã sửa để lấy số chủ đề từ `topics.json`). Seed thật `CONTENT_RELEASES=all` lên CSDL trống: 66 đơn vị active (33 baseline + 33 mới), 365 mục từ vựng, chạy hai lần ≈ 4,5 giây mỗi lần, không nhân đôi |
| (4) `GET /today` p95 ≤ +10% so với baseline | **Đạt.** `measure-today.ts` trên PostgreSQL nhúng (cổng 5434, `jl_test2`), `CONTENT_RELEASES=all` (66 đơn vị active), 200 lần gọi/điểm đo, 3 lần liên tiếp. `today_generate` p95: 38,8 / 27,3 / 21,2 ms → **trung vị 27,3 ms** so với baseline 30,4 ms (ngưỡng ≤ 33,4 ms) — không chậm hơn. Lần 1 cao (38,8 ms, tối đa 82 ms) là lần chạy nguội đầu tiên sau thời gian máy rảnh; hai lần sau thấp hơn baseline. `today_cached` p95 trung vị 7,9 ms (baseline 8,7); `path` p95 trung vị 5,1 ms (baseline 5,5; ngưỡng 300 ms). Seed 66 đơn vị ≈ 0,8 giây |
| (5) Học thử đơn vị của đợt | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Một test tích hợp tạm (đã xóa, không đưa vào repo) dùng tài khoản N4 → N3, chỉ kỹ năng từ vựng, 30 phút/ngày, seed `releases: 'all'`, rồi học theo `GET /today` → `POST /sessions` → trả lời từng bài (đáp án đúng lấy từ CSDL) → `complete`. 33 đơn vị của đợt 004 (chủ đề `vocab-n4-*`) đều học trọn vẹn, mọi câu trả lời đúng được chấm đúng, phiên hoàn thành. Kích thước khớp CS3: đơn vị 5 phút có 9 bài (9 × 30 giây ≤ 300 giây), đơn vị 10 phút có 18 bài (18 × 30 giây ≤ 600 giây). Việc người thật học thử trên giao diện (cảm nhận độ khó, bố cục) vẫn nên làm khi có dịp, nhưng không chặn phát hành |
| (6) Ghi kết quả | Mục này |

## Đợt 001-grammar-n4, 002-grammar-n3, 005-vocab-n4-b (T058, T072, T108, T073)

**Ngày**: 2026-11-15 | **Hồ sơ duyệt**: `content/releases/001-grammar-n4.json` (28 đơn vị), `002-grammar-n3.json` (28), `005-vocab-n4-b.json` (33) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp trong phiên ("Duyệt 001, 005 và 002 ngay"). Ba đợt phát hành cùng lượt nên các bước kiểm chứng chạy một lần cho cả ba (thư viện 155 đơn vị `active`: 33 baseline + 33 đợt 004 + 89 đợt mới).

| Bước | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi; 80 cảnh báo, TOÀN BỘ là AU3 (mẫu ngữ pháp dạng nguyên thể có dấu 〜 còn ví dụ dùng dạng đã chia) — đã ghi lý do chấp nhận ở `notes` của manifest 001/002. Coverage thoát `0`: ngữ pháp N4 104/104 (100%), N3 106/106 (100%); từ vựng N4 680/716 (95,0%) |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt. Toàn bộ project `unit`: 58 file, 1.100 test đạt. Hai kỳ vọng cũ của `content-coverage.test.ts` (giai đoạn danh mục khung rỗng và "lint 0 cảnh báo") được cập nhật theo trạng thái thật: `--final` vẫn thoát 1 khi chưa đạt ngưỡng; lint thư viện thật 0 lỗi và chỉ chấp nhận cảnh báo AU3 |
| (3) Seed + `seed-release-idempotent` | PostgreSQL nhúng (5434, `jl_test2`): `seed-release-idempotent`, `seed-amendments`, `admin-activation-duplicate`, `seed` đạt (4 file, 30 test). Seed `CONTENT_RELEASES=all` lên CSDL trống: 155 đơn vị trong ≈ 1,6–1,8 giây |
| (4) `GET /today` p95 | **Chưa chứng minh đạt ngưỡng ≤ +10% (≤ 33,4 ms) trên máy nhiễu.** 6 lần chạy liên tiếp `measure-today.ts` (155 đơn vị, 200 lần gọi/điểm đo) cho `today_generate` p95 = 42,0 / 31,7 / 35,6 / 34,1 / 50,9 / 40,2 ms (trung vị ≈ 38 ms) nhưng p50 = 28,1 / 22,2 / 23,9 / 22,4 / 34,3 / 32,3 ms; hai lần chạy yên (22,2 và 22,4 ms) bằng baseline p50 (22,1 ms) và p95 31,7–34,1 ms. `today_cached` (đường không đụng engine) cũng dao động 8,9–13,7 ms nên phần lớn chênh lệch là nhiễu máy, không phải chi phí engine. Ngưỡng SC-007 sẽ đo lại ở thư viện cuối cùng (Phase 9) trên máy rảnh. `path` p95 5,8–8,6 ms (ngưỡng 300 ms) đạt |
| (5) Học thử đơn vị | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Test tích hợp tạm (đã xóa, không đưa vào repo): tài khoản N5 → N3, 30 phút/ngày, chỉ một kỹ năng; học theo `GET /today` → `POST /sessions` → trả lời mọi bài (đáp án đúng lấy từ CSDL) → `complete`, qua nhiều ngày cho tới khi mọi đơn vị `active` của loại đó đã học trọn. Cả ngữ pháp (kể cả 56 đơn vị mới) lẫn từ vựng (kể cả 33 đơn vị đợt 005) đều học trọn, phiên hoàn thành, mọi câu đúng được chấm đúng |
| (6) Ghi kết quả | Mục này |

**Nghiệm thu US1 (T073)**: độ phủ ngữ pháp N4 100% và N3 100% (≥ 95%, không còn dòng chưa phủ). Việc người thật học thử theo QS7 (cảm nhận bài `contrast`, bài ★, phản hồi khi làm sai) CHƯA làm; bước học thử tự động ở trên chỉ kiểm tra luồng và chấm điểm. Hai điểm người duyệt nên soát khi có dịp: hai đáp án cùng đúng ở các câu `contrast`/`form_fill` được nêu ở `GHI-CHU-RA-SOAT.md` (đã ghi trong `notes` manifest), và ví dụ N3 dùng 〜べき/〜とは限らない trước khi học tới mẫu đó.

## Đợt 008–011 từ vựng N3 (T122, T136, T150, T164, T165)

**Ngày**: 2026-11-15 | **Hồ sơ duyệt**: `content/releases/008-vocab-n3-a.json` (50 đơn vị, 534 từ), `009-vocab-n3-b.json` (50, 510), `010-vocab-n3-c.json` (50, 510), `011-vocab-n3-d.json` (50, 480) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp trong phiên ("Duyệt cho cả các đợt N3 sau này"). Bốn đợt được soạn, lint và phát hành liên tiếp nên các bước kiểm chứng chạy một lần cho cả bốn trên thư viện đầy đủ (lúc đo có 490 đơn vị `active`, gồm cả các đơn vị Kanji do phiên làm việc song song của Phase 5 phát hành).

| Bước | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi; cảnh báo còn lại chỉ là AU3 của ngữ pháp (đã chấp nhận ở manifest 001/002), không còn AU13: từ vựng N3 có 63/202 đơn vị 5 phút (31,2%, đạt ≥ 30%). Coverage thoát `0`: từ vựng N3 2.042/2.243 (**91,0%**, ≥ 90%), từ vựng N4 680/716 (95,0%) |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt. Toàn bộ project `unit`: 58 file, 1.100 test đạt |
| (3) Seed + `seed-release-idempotent` | PostgreSQL nhúng: `seed-release-idempotent`, `seed-amendments`, `admin-activation-duplicate` đạt. `seed.test.ts` có 1 test thất bại KHÔNG thuộc nội dung từ vựng: test "nạp 7 bài Kanji… 6 chủ đề Kanji" đếm `topics` kỹ năng Kanji (kỳ vọng 6, thực tế 29) vì phiên Phase 5 đã thêm chủ đề Kanji N4/N3 vào `topics.json`; cần cập nhật kỳ vọng khi hoàn tất Phase 5 (không sửa ở đây để tránh đụng việc của phiên kia). Seed `CONTENT_RELEASES=all` lên CSDL trống: 490 đơn vị trong ≈ 3,7–4,7 giây, chạy lại không đổi |
| (4) `GET /today` p95 ≤ +10% so với baseline | **Đạt.** `measure-today.ts` trên CSDL riêng `jl_test_vocab` (PostgreSQL nhúng cổng 5434, máy rảnh), 490 đơn vị `active`, 200 lần gọi/điểm đo, 3 lần liên tiếp: `today_generate` p95 = 27,9 / 28,9 / 32,4 ms → **trung vị 28,9 ms** so với baseline 30,4 ms (ngưỡng ≤ 33,4 ms); p50 24,9–25,5 ms. `today_cached` p95 trung vị 10,0 ms (baseline 8,7); `path` p95 trung vị 7,0 ms (baseline 5,5; ngưỡng 300 ms). Kết quả này thay cho các số đo nhiễu ghi ở mục đợt 001/002/005 (đo lúc máy bận) |
| (5) Học thử đơn vị | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Cùng test tích hợp tạm (đã xóa, không đưa vào repo) trên CSDL `jl_test_vocab`: tài khoản N5 → N3, 30 phút/ngày, chỉ kỹ năng từ vựng, học theo `GET /today` → `POST /sessions` → trả lời mọi bài → `complete` qua nhiều ngày cho tới khi MỌI đơn vị từ vựng `active` (gồm toàn bộ 200 đơn vị N3 mới) đã học trọn, phiên hoàn thành, đáp án đúng được chấm đúng (≈ 184 giây) |
| (6) Ghi kết quả | Mục này |

**Nghiệm thu US2 (T165)**: từ vựng N4 95,0% và N3 91,0% (≥ 90%); còn 36 từ N4 và 201 từ N3 chưa phủ để đợt 014 bù (`pnpm content:coverage --kind vocabulary --list-uncovered`). Mục tiêu "công việc": hành vi đề bạt đơn vị có thẻ `work` (tối đa 3 trong 12 đơn vị đầu của mỗi loại, `jlpt` giữ đúng thứ tự) đã được kiểm bằng `path-frontier.test.ts` (T013 d); đợt 008 gắn thẻ `work` cho 10 chủ đề công việc – kinh tế, các đợt 009–011 gắn `daily_conversation`. Người học thử theo QS7 trên giao diện thật CHƯA làm.

**Ghi chú chất lượng nội dung** (nêu ở `GHI-CHU-RA-SOAT.md` từng đợt): nhiều nhóm từ gần nghĩa (不況/不景気, 輸送/運送, 上昇/下落, 許可/承認, 続々/次々, các liên từ nối ý, phó từ tần suất) có thể làm câu `context_fill` có hơn một đáp án hợp lý; mọi đề đã kèm bản dịch câu và các từ gần nghĩa nhất được tách sang đơn vị khác, nhưng người duyệt nên soát lại. Bài tập của đơn vị chỉ gồm kana được sinh gồm `context_fill`, `orthography` (cách viết sai do máy sinh) và `usage` (câu sai do người soạn viết).

## Đợt 003-kanji-n4, 006-kanji-n3-a, 007-kanji-n3-b (T183, T193, T204, T205)

**Ngày**: 2026-11-15 | **Hồ sơ duyệt**: `content/releases/003-kanji-n4.json` (46 đơn vị, 162 chữ), `006-kanji-n3-a.json` (42, 165 chữ), `007-kanji-n3-b.json` (47, 187 chữ; `amendments` rỗng có chủ đích, xem `content/scope/kanji-amendment-candidates.md`) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp của chủ dự án ("duyệt T182, T192, T203"). Ba đợt phát hành cùng lượt nên các bước kiểm chứng chạy một lần cho cả ba, trên thư viện đầy đủ 490 đơn vị `active` (CSDL riêng `jl_test_kanji`, PostgreSQL nhúng cổng 5434).

| Bước | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi; 80 cảnh báo, TOÀN BỘ là AU3 của ngữ pháp (đã ghi lý do chấp nhận ở manifest 001/002), không có cảnh báo nào của ba đợt Kanji. Coverage thoát `0` (xem T205) |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt (3 file, 77 test đạt, 1 bỏ qua là ngưỡng `--final`). Toàn bộ project `unit`: 58 file, 1.100 test đạt |
| (3) Seed + `seed-release-idempotent` | `seed-release-idempotent`, `seed-amendments`, `admin-activation-duplicate`, `seed` đạt (4 file, 30 test). Test `seed.test.ts` "nạp 7 bài Kanji…" từng đỏ vì đếm cứng 6 chủ đề Kanji trong khi `topics.json` nay có 29: đã sửa để lấy số chủ đề Kanji từ `topics.json` (cùng cách với `TOPIC_COUNT`), baseline vẫn kiểm đúng 7 bài/27 chữ. Seed thật `CONTENT_RELEASES=all` lên CSDL trống: +133 mảng, +490 đơn vị trong ≈ 3,7–4,1 giây; chạy lại `+0 đơn vị (bỏ qua 490 đã có)` ≈ 3,8 giây |
| (4) `GET /today` p95 ≤ +10% so với baseline | **Chưa chứng minh đạt trên máy này; ghi nhận sát/ vượt ngưỡng nhẹ.** `measure-today.ts`, 490 đơn vị, 200 lần gọi/điểm đo. `today_generate` p95 qua 8 lần chạy: 28,6 / 42,8 / 33,3 / 36,0 / 34,4 / 49,6 / 32,5 / 31,2 ms → **trung vị 33,9 ms** so với baseline đã ghi 30,4 ms (ngưỡng ≤ 33,4 ms) = +11%. Đo lại baseline 33 đơn vị cùng phiên, cùng CSDL: p95 28,8 / 30,8 / 21,7 ms (trung vị 28,8; p50 18,7–24,0) so với p50 thư viện đầy đủ 24,4–29,3 ms, tức chênh p50 ≈ +4–5 ms (≈ +15–20%). Máy nhiễu (tối đa 40–134 ms, p95 dao động ±40%), nên chưa kết luận được là vượt hay đạt; kết quả đo 28,9 ms ở mục đợt 008–011 (cùng 490 đơn vị, máy rảnh) thì đạt. `today_cached` p95 8,2–12,4 ms (baseline 8,7); `path` p95 6,2–9,6 ms (baseline 5,5; ngưỡng 300 ms) đạt. Cần đo lại trên máy rảnh ở Phase 9 (đợt 014); nếu chênh p50 ≈ 4–5 ms là thật thì nguyên nhân khả dĩ là chi phí nạp/xếp hạng 490 đơn vị, xử lý ở D12/T214 |
| (5) Học thử đơn vị | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Test tích hợp tạm (đã xóa, không đưa vào repo), seed `releases: 'all'`, tài khoản N5, 30 phút/ngày, kỹ năng từ vựng + ngữ pháp + Kanji: học trọn **mọi 142 đơn vị Kanji `active`** (N4: 48, N3: 91, N5: 3, gồm cả ba đợt mới) qua `POST /sessions` → trả lời mọi bài (đáp án đúng lấy từ CSDL) → `complete`; mọi phiên hoàn thành 200, mọi câu đúng được chấm đúng. 541/541 chữ Kanji `active` có đủ ba khía cạnh `meaning`/`reading`/`word`; 0 đơn vị có số bài × 30 giây vượt `estMinutes × 60` (CS3) |
| (6) Ghi kết quả | Mục này |

**Nghiệm thu US3 (T205)**: `pnpm content:coverage --kind kanji` — Kanji N4 **170/170 (100%)**, N3 **359/359 (100%)**, không còn dòng chưa phủ (≥ 95% cả hai trình độ, không cần bù ở đợt 014). Mỗi chữ có đủ ba khía cạnh (541/541, kiểm ở bước 5). Glyph: mọi ký tự của các đơn vị mới (chữ chính, ví dụ, đáp án, lựa chọn, đề bài) có glyph trong `NotoSansJP.ttf` theo quy tắc AU14 của `content:lint` (0 lỗi). `amendments` rỗng nên không có chữ lặp: khóa chữ Kanji duy nhất trên toàn thư viện được `content-coverage.test.ts` kiểm (đạt).

**CHƯA làm (cần người)**: (a) kiểm tra thị giác "không ô vuông trên Chrome/Edge/Firefox" của QS7 trên bản đã seed đầy đủ — chỉ có bằng chứng tĩnh (AU14); (b) người học thử các đơn vị Kanji trên giao diện thật theo QS7; (c) đối chiếu từ điển cho `strokeCount` và cách đọc On/Kun/biến âm của từ ví dụ (do tác nhân soạn theo trí nhớ — nêu ở `GHI-CHU-RA-SOAT.md` từng đợt và ở `notes` manifest). Điểm người duyệt nên soát: cặp chữ gần nghĩa cùng đơn vị (ví dụ 研/究, 問/質, 保/守/防, 悲/苦/痛/疲, 笑/泣/怒) có thể làm câu `meaning` có hai đáp án hợp lý; từ ví dụ dùng chữ Hán ngoài danh mục N4/N3 (có `reading` kana đầy đủ); tên chủ đề `kanji-n4-nature-weather` thực chứa mùa và động vật.

## Phase 6 – Câu chuyện 4: lộ trình liền mạch N4 → N3 (T206–T228)

**Ngày**: 2026-11-16 | **Môi trường**: PostgreSQL nhúng 17 (cổng 5434), CSDL riêng `jl_test_p6` (kiểm thử) và `jl_load_p6` (đo tải); thư viện đang phát hành: **490 đơn vị `active`** (chưa có luyện đọc/viết — Phase 7/8).

### Golden bước 0 sau T213 (ôn lùi) và T214 (tiến độ theo phút)

- **T213 – ôn lùi có chặn (D11)**: chạy `generate-plans-pre-008.ts` bằng engine TRƯỚC và SAU khi thêm ôn lùi (`CONTENT_RELEASES=000-baseline`, ra tệp tạm): **giống hệt từng byte** (29 hồ sơ × 14 ngày: kế hoạch ngày + thứ tự lộ trình + tiến độ). Không hồ sơ cũ nào có placement xếp N3 kèm mảng yếu N4 nên ôn lùi không kích hoạt.
- **T214 – `goalRatio` theo phút (D12.1)**: phần (a) (`plans` + `path`) của 29 hồ sơ **giống hệt** kết quả sau T213. Phần (b) `progress` đã được cập nhật có chủ đích trong `plans-pre-008.json`: khóa `done`/`total` nay là **phút** (trước là số đơn vị); `completionRatio` (`ratio`) chỉ đổi ở **2 hồ sơ** có đơn vị đã học sẵn, còn lại vẫn 0.

#### Đổi cách tính tiến độ

| Hồ sơ | `done/total` cũ (đơn vị) → mới (phút) | `completionRatio` cũ → mới | Lý do |
|---|---|---|---|
| `kanji-added-later` | 3/15 → 15/100 | 0,200 → **0,150** | 3 đơn vị đã xong đều là đơn vị 5 phút, phần còn lại gồm nhiều đơn vị 10 phút |
| `kanji-exhausted-n5` | 3/9 → 25/60 | 0,333 → **0,417** | 3 đơn vị đã xong gồm đơn vị 10 phút nặng hơn trung bình |
| 27 hồ sơ còn lại | `0/N` → `0/(5N…)` (chỉ đổi đơn vị) | 0 → 0 | chưa học đơn vị nào |

Kiểm thử đã sửa theo cách tính mới: `goal-ratio.test.ts` (mở rộng, T208), `us4-progress.test.ts` (3 test "tiến độ mục tiêu" đổi mẫu số sang tổng phút; so bằng `round3` thay vì sai số), `reward-achievements.test.ts` đạt không đổi (`delta` của thành tựu `goal_*` nay là `estMinutes` của đơn vị vừa xong, cùng đơn vị với `goalDone`/`goalTotal`).

### QS3 – đường băng, thứ tự học, ôn lùi (`runway.test.ts`, `path-frontier.test.ts`, `path-remedial.test.ts`, `goal-ratio.test.ts`)

Toàn bộ project `unit`: **60 file, 1.126 test đạt** (11 bỏ qua gồm các test `RUNWAY_REAL=1` và ngưỡng `--final`). `runway.test.ts` chạy trên thư viện TỔNG HỢP đúng kích thước CS3 (ngữ pháp 28+28, từ vựng 66+200, Kanji 46+80, đọc 30+30, viết 20+20; ≥ 30% đơn vị 5 phút mỗi nhóm); chế độ `RUNWAY_REAL=1` (nội dung thật) chỉ bật ở nghiệm thu Phase 9.

| Hồ sơ | Kết quả đo |
|---|---|
| `n4-15min-jlpt-n3` | **200/200 ngày có bài mới** (0 ngày hết nội dung trong 180 ngày), 100% kế hoạch ≤ 15 phút, không đơn vị nào lặp lại như bài mới; thư viện còn dư (335/448 đơn vị dùng hết sau 200 ngày) |
| `n4-5min-runway` (từ vựng + ngữ pháp + Kanji) | ≥ 90 ngày liên tục có đơn vị 5 phút, 100% kế hoạch ≤ 5 phút (≈ 138 đơn vị 5 phút) |
| `n4-10min-jlpt-n3`, `n3-30min-all-skills` | Quỹ đúng ở 5/10/15/30; luyện đọc/viết **chỉ** ở hồ sơ 30 phút, kể cả hồ sơ 10 phút CHỌN đủ năm kỹ năng (kỹ năng hiệu lực) |
| `n3-skip-n4-weak` | Thấy N3 và đúng 3 (`REMEDIAL_MAX_UNITS`) đơn vị N4 thuộc mảng yếu (`transport-places`, `health-body`); học xong cả 3 vẫn không có bài thứ 4; điểm trình độ bằng 0, không chiếm chỗ biên giới N3 |
| `mastered-some-units` | Đơn vị đã thành thạo không còn trong `upcomingUnits` và không bao giờ vào kế hoạch |
| `completed-all-n3` | `upcomingUnits` rỗng; có tồn đọng ôn thì kế hoạch là `review_only`, không có thì `empty` (gợi ý `content_exhausted` vì đã chạm trần N3) |
| `n2-goal` | Dừng ở N3 (`levelRange = [N3, N3]`) kèm `scopeNotice = content_ceiling_n3` |
| `n4-10min-work-goal` | Tỷ lệ đơn vị `work` trong 30 ngày đầu cao hơn rõ rệt so với `n4-10min-jlpt-n3`; trong danh sách xếp hạng của mọi ngày không đơn vị nào đứng trước tiên quyết cùng loại |
| Bài xếp lớp N4 / N3 | Kế hoạch ngày 0 bắt đầu ở đơn vị đầu của đúng trình độ (trong 3 đơn vị đầu của loại) |

#### Phát hiện cần chủ dự án biết (không sửa trong phạm vi Phase 6)

1. **Kế hoạch ngày "điền phần dư" đảo cấp độ**: `planDailyPlan` chọn đơn vị theo first-fit nên khi còn dư 5 phút mà đơn vị 10 phút kế tiếp của N4 không vừa, nó lấy đơn vị 5 phút gần nhất trong danh sách xếp hạng — có thể là đơn vị 5 phút của N3 (hoặc đơn vị phụ thuộc đứng sau một tiên quyết 10 phút). Ở thư viện tổng hợp, bài N3 đầu tiên xuất hiện từ ngày ≈ 40 khi mới học 54% từ vựng, 57% ngữ pháp, 65% Kanji của N4. **Danh sách xếp hạng (`rankUnits`) luôn đúng thứ tự** (kiểm ở từng ngày: không đơn vị N4 nào đứng sau đơn vị N3 cùng loại; tiên quyết luôn đứng trước), nên bất biến D10/I7 giữ nguyên; chỉ phần lấp quỹ thời gian là "vượt" thứ tự. Không sửa vì chặn cứng sẽ làm hồ sơ 5 phút (chỉ dùng được đơn vị 5 phút) mất đường băng. Nếu cần, thiết kế riêng (ví dụ ưu tiên đơn vị 5 phút CÙNG trình độ trước khi lấp bằng trình độ sau).
2. **Mục tiêu "mỗi loại ≥ 15% mọi cửa sổ 30 ngày" (D17) không đạt được cho ngữ pháp**: ngữ pháp chỉ chiếm ≈ 12,6% số đơn vị/phút của thư viện nên có mặt ở ≈ 22% số ngày nhưng cửa sổ 30 ngày xấu nhất ≈ 13%, và cửa sổ 60 ngày xấu nhất chỉ ≈ 7% vì ngữ pháp hết sớm hơn từ vựng/Kanji. Kiểm thử dùng ngưỡng **≥ 10% số ngày trong mọi cửa sổ 30 ngày của 120 ngày đầu** (chứng minh không loại nào bị bỏ đói khi cả ba còn nội dung); nếu muốn đúng 15% thì phải tăng khối lượng ngữ pháp hoặc đổi cách xếp xen.
3. **Hồ sơ 5 phút chỉ từ vựng (gợi ý mặc định) có đường băng ≈ 81 ngày < 90**: 30% của 266 đơn vị từ vựng = 81 đơn vị 5 phút. Mục tiêu bổ sung ≥ 90 ngày của D17 chỉ đạt khi chọn thêm ngữ pháp/Kanji (như hồ sơ `n4-5min-runway`, ≈ 138 đơn vị 5 phút). Nên nâng tỷ lệ đơn vị 5 phút của từ vựng lên ≥ 35% nếu muốn gợi ý mặc định đủ 90 ngày.

### T220 – rà soát màn chọn đơn vị của giáo viên và danh sách Admin (D15)

| Màn hình | Kết luận ở ≈ 600 đơn vị | Xử lý |
|---|---|---|
| Admin → Đơn vị (`admin_units_screen.dart`, `GET /admin/units`) | Đã có bộ lọc trạng thái/trình độ/loại phía máy chủ; danh sách dựng lười (`ListView.separated`), phản hồi không kèm `items`/`exercises` nên nhẹ | Không đổi |
| Giáo viên → Tinh chỉnh lộ trình lớp (`class_path_units_section.dart`) | Thư viện bài lấy từ `ClassPath.units` (một lần), nhưng "Thêm bài…" là một `DropdownButton` liệt kê TẤT CẢ bài và thẻ giao bài là `Wrap` của mọi `FilterChip` (≈ 600 widget, không lười) | Bổ sung tối thiểu: bộ lọc **loại** và **trình độ** dùng chung cho danh sách thêm bài và giao bài; chip giao bài cắt ở 60 (`assignChipLimit`, bài đã chọn luôn hiển thị) kèm gợi ý "đang hiển thị x/y". Không đổi API (lọc phía client trên danh sách đã có) |

### QS5 – hiệu năng ở thư viện lớn (T228, SC-007, I9)

`measure-today.ts` (200 lần/điểm đo, khởi động 10, tài khoản N4/15 phút, 3 lần chạy liên tiếp, **trung vị của p95**) trên cùng máy; baseline = 33 đơn vị, đầy đủ = 490 đơn vị.

| Chế độ bộ đệm danh mục | `today_generate` p95: baseline → đầy đủ | Chênh lệch | `today_cached` p95 | `path` (không lọc) p95 |
|---|---|---|---|---|
| **Ấm** (`--warm-cache`: đồng hồ thật, TTL 60 giây — hành vi ổn định của production) | 22,3 → **23,2 ms** (lần chạy: 26,6/22,3/21,0 → 23,7/23,2/23,2) | **+4,0%** — đạt ≤ +10% | 7,5–9,2 → 8,3–10,7 ms | 4,3 → 5,9–6,7 ms |
| Nguội mỗi lần gọi (mặc định của script: đồng hồ giả tiến 1 ngày nên bộ đệm luôn quá hạn, đọc lại cả danh mục `active` mỗi lần) | 27,0 → 38,8 ms (32,8/27,0/21,3 → 38,8/47,0/29,4) | +44% (trường hợp xấu nhất, chỉ xảy ra ≤ 1 lần/60 giây ở production) | 7,6–9,8 → 8,2–10,0 ms | 4,3–5,9 → 6,7–6,9 ms |

**Kết luận**: ở trạng thái ổn định (bộ đệm danh mục ấm) `GET /today` p95 chậm hơn **+4%** nên **đạt SC-007**; chi phí thêm ở chế độ nguội ≈ +9–12 ms mỗi lần đọc lại danh mục (tỉ lệ số đơn vị) — các đợt trước ghi "sát/vượt ngưỡng nhẹ" là do chế độ nguội này (đồng hồ giả) chứ không phải chi phí xếp hạng. `GET /path` không lọc ≈ 6–7 ms (≪ 300 ms) ở 490 đơn vị; chưa đo riêng `GET /path?kind=grammar&limit=20` (không có nhu cầu: đã nhanh) nhưng test hợp đồng `path-filter` kiểm đúng thứ tự/`itemsTotal`. Rủi ro còn lại: đo lại ở thư viện ≈ 600 đơn vị khi có Phase 7/8 (Phase 9). Script có thêm cờ `--warm-cache`.

### QS6 – API, thông báo nghe hiểu, client (T219, T221–T227)

- **Backend**: `tests/contract` (toàn bộ) + `reward-achievements`, `org-regression-api`, `us4-progress`, `us5-overrides`, `class-learning-context` đạt trên PostgreSQL nhúng, gồm ba file mới `path-filter` (kind/level/status/limit/offset, 422, lớp, `kind` ngoài kỹ năng), `scope-notices` (JLPT / không JLPT / lộ trình cũ không có khóa / N2, N1 / thứ tự) và `goal-ratio-minutes`. 4 test thất bại còn lại KHÔNG thuộc Phase 6: `kanji-us5` "GET /admin/topics?skill=kanji trả đúng 6 chủ đề" (`content/topics.json` tại HEAD đã có 29 chủ đề Kanji do Phase 5 thêm; assertion cứng 6 đã lỗi thời, không đổi bởi Phase 6 — cùng nhóm test spec 003 đỏ sẵn).
- **OpenAPI 1.15.0**: `GET /path` thêm 5 tham số + 422, `PathDetail.itemsTotal`, `PathSummary.notices`, `ProgressSummary.goal.notices`, `ScopeNoticeCode`, mô tả `completionRatio` theo phút, `422` của hai route cập nhật đơn vị Admin; không thêm route nên `authz-matrix.json` chỉ rà soát (không đổi); `api-snapshot.ts` bỏ qua `notices`/`itemsTotal` như trường tùy chọn mới.
- **Client**: sinh lại API client từ 1.15.0 (`flutter analyze` sạch; `generated_api_test.dart`, `l10n_keys_test.dart` đạt); banner `ScopeNoticeBanner` nhận danh sách `notices` (lùi về `scopeNotice` khi máy chủ cũ) và hiển thị ở Tiến độ, Lộ trình, Hồ sơ (phần kế hoạch/mục tiêu) và hộp thoại sau onboarding; màn Lộ trình dùng `SliverList` dựng lười, nạp trang kế bằng `limit`/`offset` khi cuộn gần cuối và lọc `kind`/`level`; `PassagePanel` giữ ký tự xuống dòng và cuộn trong khung ≤ 40% chiều cao màn hình cho đoạn tới 700 ký tự. Test mới: `path/path_filter_test.dart`, `progress/scope_notice_test.dart`, `onboarding/scope_notice_onboarding_test.dart`, `lesson/passage_panel_newline_test.dart`.

## Đợt 012-reading (T245–T246)

**Ngày**: 2026-11-17 | **Hồ sơ duyệt**: `content/releases/012-reading.json` (60 đơn vị mới + gắn `scopeRef` hồi tố cho 4 đơn vị baseline) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp của chủ dự án trong phiên 2026-11-17 (chỉ áp cho đợt 012). Thư viện sau đợt: 550 đơn vị `active`. Kiểm chứng chạy trên CSDL riêng (`jl_test_reading`, `jl_load_p6`; PostgreSQL nhúng cổng 5434).

| Bước | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi; 80 cảnh báo, TOÀN BỘ là AU3 của ngữ pháp (đã ghi lý do ở manifest 001/002), không có cảnh báo nào của đợt đọc. Coverage thoát `0`: reading N4 **14/14**, N3 **13/13** dòng danh mục có đủ `minUnits` |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt: 3 file, 77 test đạt, 1 bỏ qua (ngưỡng `--final`) |
| (3) Seed + `seed-release-idempotent` | `seed-release-idempotent`, `seed-amendments`, `seed`, `admin-activation-duplicate` đạt (4 file, 30 test). Seed thật `CONTENT_RELEASES=all` lên CSDL trống: +550 đơn vị trong ≈ 6,7 giây; chạy lại `src/seed/index.ts`: `+0 mảng, +0 đơn vị (bỏ qua 550 đã có)` |
| (4) `GET /today` p95 ≤ +10% so với baseline | **Chưa kết luận chắc chắn; số đo nhiễu, nằm sát ngưỡng.** `measure-today.ts --warm-cache`, baseline 33 đơn vị so với đầy đủ 550, 3 lần chạy xen kẽ mỗi cấu hình. 200 lần gọi/điểm: `today_generate` p95 baseline 36,1 / 37,0 / 36,2 ms (trung vị 36,2) so với đầy đủ 39,4 / 45,3 / 59,5 ms (trung vị 45,3) = **+25%** (lần 3 có đỉnh nhiễu 59,5 ms, p50 chỉ 28,2). 600 lần gọi/điểm (p95 ổn định hơn): baseline 39,9 / 31,6 / 48,8 (trung vị 39,9) so với đầy đủ 42,5 / 43,3 / 53,1 (trung vị 43,3) = **+8,5%** (p50: 30,0 → 31,2 ms = +4%). `today_cached` p95 12–15 ms cả hai bên. Kết luận thận trọng: p50 tăng ≈ +4–8%, p95 dao động ±30% giữa các lần chạy trên cùng cấu hình nên không chứng minh được "đạt" hay "vượt" chỉ bằng máy này; cần đo lại trên máy rảnh trước khi nghiệm thu SC-007 (T268) |
| (5) Học thử đơn vị | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Test tích hợp tạm (đã xóa, không đưa vào repo), seed `releases: 'all'`, học viên N4 → mục tiêu N3, 30 phút/ngày, kỹ năng luyện đọc: học trọn **mọi 64 đơn vị luyện đọc N4 + N3** (32 + 32) qua `POST /sessions` → trả lời → `complete`; mọi phiên 200, mọi câu đúng được chấm đúng; 6 phiên đầu cố ý trả lời sai câu đầu → `isCorrect=false` kèm `feedback` ≥ 10 ký tự; 45 đơn vị có đoạn nhiều dòng (`\n`); 0 đơn vị có số bài × 30 giây vượt `estMinutes` × 60 |
| (6) Ghi kết quả | Mục này |

**Nghiệm thu US5 (T246)**: `content:stats` — luyện đọc **N4: 32 đơn vị (17 bài 5 phút, 15 bài 10 phút), 9 chủ đề; N3: 32 đơn vị (9 bài 5 phút, 23 bài 10 phút), 8 chủ đề** → đạt ≥ 30 đơn vị và ≥ 8 chủ đề (SC-006); N4 có 4 dạng văn bản (thông báo, thư/email, bài viết ngắn, tra cứu), N3 có 5 (thông báo, email công việc, cột báo, đoạn vừa, tra cứu) → ≥ 4 dạng; gồm cả đoạn vừa N3 (`comprehension_mid`, 74 câu) lẫn bài tra cứu nhiều dòng (`info_search`). Học viên dưới 30 phút KHÔNG thấy luyện đọc: kiểm tự động (học viên 15 phút, đủ ba kỹ năng, kế hoạch hôm nay không có mục `reading`/`writing`) đạt.

**CHƯA làm (cần người)**: (a) người học thử trên giao diện thật (Chrome/Edge/Firefox) để xem đoạn nhiều dòng và đoạn dài ≈ 370 ký tự hiển thị đúng ở `PassagePanel` — chỉ có bằng chứng tự động (`passage_panel_newline_test.dart`, T226) — gộp vào T267; (b) đo lại `GET /today` trên máy rảnh (bước 4); (c) người duyệt rà các điểm nêu ở `content/drafts/012-reading/GHI-CHU-RA-SOAT.md` (cách đọc kana số/ngày, tính tiền ở bài tra cứu, văn phong email N3).

## Đợt 013-writing (T259–T261)

**Ngày**: 2026-11-17 | **Hồ sơ duyệt**: `content/releases/013-writing.json` (40 đơn vị mới: 10 chủ đề × 4) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp của chủ dự án trong phiên 2026-11-17 (chọn "Có, ủy quyền G1 cho đợt 013"; chỉ áp cho đợt 013). Thư viện sau đợt: 590 đơn vị `active`. Ghi chú rà soát: `content/drafts/013-writing/GHI-CHU-RA-SOAT.md`.

| Bước | Kết quả |
|---|---|
| (1) `content:lint`, `content:coverage` | Lint 0 lỗi; 80 cảnh báo, TOÀN BỘ là AU3 của ngữ pháp cũ, không có cảnh báo nào của đợt viết (bản nháp trước khi phát hành: 0 lỗi, 0 cảnh báo). Coverage thoát `0` (bảng ngưỡng giữ nguyên; `--final` còn đỏ ở từ vựng, xem T262) |
| (2) `content-files`, `content-releases`, `content-coverage` | Đạt: 3 file, 78 test đạt, 1 bỏ qua (ngưỡng `--final`). Phải sửa 1 test cũ: `content-coverage.test.ts` "`--final` báo AU18" giả định thư viện thật còn thiếu bài đọc/viết nên đỏ khi đủ; nay dựng tình huống thiếu bằng bản sao chỉ có đợt cơ sở (`copyContentDir`) và thêm test "thư viện thật không còn lỗi AU18". Một lần chạy lại bộ ba file có 1 test đỏ thoáng qua (nghi quá hạn thời gian khi máy bận), hai lần chạy liền sau đều xanh |
| (3) Seed + `seed-release-idempotent` | `seed-release-idempotent`, `seed-amendments`, `seed`, `admin-activation-duplicate`, `practice-gate`, `practice-records`, `practice-admin` đạt (7 file, 45 test). Seed thật trên CSDL đang có 550 đơn vị: `+0 mảng, +40 đơn vị (bỏ qua 550 đã có)` — id/hàng cũ giữ nguyên; chạy lại: `+0 đơn vị (bỏ qua 590 đã có)` |
| (4) `GET /today` p95 ≤ +10% so với baseline | **Chưa kết luận chắc chắn; số đo nhiễu, nằm sát/vượt ngưỡng nhẹ.** `measure-today.ts --warm-cache --calls 600`, baseline 33 so với đầy đủ 590 đơn vị, 3 lần chạy xen kẽ: `today_generate` p95 baseline 40,1 / 36,7 / 28,4 ms (trung vị 36,7) so với đầy đủ 43,4 / 39,5 / 42,1 ms (trung vị 42,1) = **+15%**; p50 baseline 27,4 / 26,7 / 22,8 (26,7) so với đầy đủ 29,1 / 29,6 / 27,8 (29,1) = **+9%**; `today_cached` p95 10,5–13,0 ms cả hai bên. Cùng cấu hình nhưng p95 baseline dao động 28–40 ms giữa các lần (±25%) nên không phân biệt được "+10%" với nhiễu; xu hướng thật là tăng nhẹ theo số đơn vị (+4% ở 490, +9% p50 ở 590). Cần đo lại trên máy rảnh trước khi nghiệm thu SC-007 (T268) |
| (5) Học thử đơn vị | **Đạt (tự động qua API thật, KHÔNG phải người học thử trên ứng dụng).** Test tích hợp tạm (đã xóa), seed `releases: 'all'`, học viên N4 → mục tiêu N3, 30 phút/ngày, kỹ năng luyện viết: học trọn **mọi 44 đơn vị luyện viết N4 + N3** (22 + 22; gồm 4 bài baseline). Mỗi đơn vị: câu đầu trả lời sai nghĩa (`まったくちがう`) → `isCorrect=false`, `correctAnswer` = dạng tham chiếu, rồi `isRetry` đúng → đúng; các câu còn lại luân phiên các dạng chấp nhận → **198 câu đều được chấm đúng (77 câu gõ dạng Kanji, 121 câu dạng kana)**, 44 câu sai nghĩa bị từ chối; 0 đơn vị có số bài × 45 giây vượt `estMinutes` × 60 |
| (6) Ghi kết quả | Mục này |

**Nghiệm thu US6 (T261)**: `content:stats` — luyện viết **N4: 22 đơn vị (11 bài 5 phút, 11 bài 10 phút), 6 chủ đề; N3: 22 đơn vị (11 + 11), 6 chủ đề** → ≥ 20 đơn vị mỗi trình độ (FR-010, SC-006); mỗi (loại × trình độ) có bài 5 phút. QS7 mục luyện viết: mỗi trình độ ≥ 3 bài — gõ dạng hiragana (đúng), gõ dạng Kanji (đúng), gõ sai nghĩa (bị từ chối) — kiểm tự động trên toàn bộ 44 đơn vị (xem bước 5).

**CHƯA làm (cần người)**: (a) người học thử trên giao diện thật (gõ bằng IME, hiển thị gợi ý `よみ:`) trên Chrome/Edge/Firefox — gộp vào T267; (b) đo lại `GET /today` trên máy rảnh (bước 4); (c) người duyệt rà các điểm ở `GHI-CHU-RA-SOAT.md` (cặp từ gần nghĩa, katakana/Hán + katakana chỉ chấp nhận katakana, độ khít chủ đề, thời lượng chưa đo thật).

## Đợt 014-final và nghiệm thu chung (T262–T266, T270)

**Ngày**: 2026-11-17 | **Hồ sơ duyệt**: `content/releases/014-final.json` (39 đơn vị từ vựng: N4 6, N3 33) — người duyệt tdq_vinh, ghi theo chỉ định trực tiếp của chủ dự án trong phiên 2026-11-17 (chọn "Có, ủy quyền G1 cho đợt 014-final"; chỉ áp cho đợt 014-final). Ghi chú rà soát: `content/drafts/014-final/GHI-CHU-RA-SOAT.md`. Thư viện sau đợt: **629 đơn vị** `active` (15 manifest).

### T262 – Bù phần chưa phủ (SC-001, SC-002)

Trước đợt: `content:coverage --final` còn **36 dòng từ vựng N4 và 201 dòng từ vựng N3 chưa phủ** (kanji, ngữ pháp, đọc hiểu đã 100%). Đợt 014-final soạn đúng 237 từ này (N4: 6 đơn vị × 6 từ; N3: 30 đơn vị × 6 từ + 3 đơn vị × 7 từ), mỗi đơn vị 5 phút, 8–10 bài tập (`context_fill` cho mỗi từ + `kanji_reading`/`orthography`), thêm vào các chủ đề từ vựng đã có (không tạo chủ đề mới). Không cần `exclude`: mọi dòng đều được soạn bài, không có dòng nào bị loại. Sau đợt: `content:coverage --final` **thoát 0 — "Đạt nghiệm thu --final (FR-003, SC-001)"**: từ vựng N4 716/716, N3 2.243/2.243; Kanji N4 170/170, N3 359/359; ngữ pháp N4 104/104, N3 106/106; đọc hiểu N4 14/14, N3 13/13.

| Bước kiểm chứng đợt 014 | Kết quả |
|---|---|
| Lint bản nháp / thư viện | Bản nháp: 0 lỗi, 0 cảnh báo (cách đọc 237 câu ví dụ đối chiếu pykakasi: 41 khác biệt, tất cả do pykakasi đọc sai — liệt kê ở ghi chú rà soát). Thư viện: `content:lint` 0 lỗi (80 cảnh báo AU3 ngữ pháp cũ), `content:lint --final` 0 lỗi |
| Seed | `jl_test_reading`/`jl_load_p6`: seed `CONTENT_RELEASES=all` +39 đơn vị trên CSDL đã có 590 đơn vị, chạy lại +0 |
| Học thử tự động | Test tích hợp tạm (đã xóa): học viên 30 phút, kỹ năng từ vựng, N5 → mục tiêu N3: **39/39 đơn vị 014 được kích hoạt (`active`) và học trọn qua API** (tổng 312 đơn vị từ vựng, 312 phiên, mọi phiên 200, mọi câu đúng được chấm đúng) |

### T263 – Thống kê thư viện (`content:stats`)

| Loại | N4 (đơn vị / phút / chủ đề) | N3 |
|---|---|---|
| Từ vựng | 74 / 600 / 26 | 235 / 1.870 / 42 |
| Ngữ pháp | 30 / 245 / 12 | 30 / 245 / 12 |
| Chữ Hán | 48 / 360 / 13 | 91 / 735 / 14 |
| Luyện đọc | **32** / 235 / 9 | **32** / 275 / 8 |
| Luyện viết | **22** / 165 / 6 | **22** / 165 / 6 |

Mọi (loại × trình độ) đều có đơn vị 5 phút (từ vựng 28 + 96, ngữ pháp 11 + 11, Kanji 24 + 35, đọc 17 + 9, viết 11 + 11). Tổng phút từ vựng + ngữ pháp + Kanji N4 + N3 = **4.055** (SC-003 yêu cầu ≥ 2.700). `content:lint --final` 0 lỗi nên AU12/AU13/AU18 đạt (mỗi chủ đề từ vựng/ngữ pháp/Kanji ≥ 2 đơn vị và ≥ 20 bài tập).

### T264 – Mẫu SC-005 (CHỜ người có chuyên môn rà)

Hạt giống ngẫu nhiên `20261117` (`random.Random(20261117).sample` trên danh sách 629 tên file đơn vị đã sắp theo thứ tự chữ cái), **32 đơn vị (≈ 5%), 188 mục**: n3-grammar-nominalization-quote-emphasis-01, n3-grammar-reason-cause-01, n3-kanji-economy-money-02, n3-reading-business-email-01, n3-reading-column-05, n3-reading-info-search-05, n3-reading-notice-04, n3-vocabulary-adverbs-degree-04, n3-vocabulary-adverbs-manner-05, n3-vocabulary-discourse-03, n3-vocabulary-education-research-04, n3-vocabulary-education-research-05, n3-vocabulary-family-life-stages-05, n3-vocabulary-feelings-personality-01, n3-vocabulary-leisure-sports-04, n3-vocabulary-management-02, n3-vocabulary-manufacturing-03, n3-vocabulary-manufacturing-04, n3-vocabulary-society-media-05, n3-vocabulary-society-media-06, n3-vocabulary-thoughts-decisions-05, n3-writing-workplace-1, n4-kanji-school-learning-06, n4-kanji-transport-travel-02, n4-reading-email-letter-06, n4-vocabulary-adjectives-02, n4-vocabulary-feelings-personality-01, n4-vocabulary-food-cooking-01, n4-vocabulary-position-shape-03, n4-writing-daily-life-01, n4-writing-daily-life-04, n5-vocabulary-food-drink.

Việc còn lại (cần người, KHÔNG tự điền kết quả): rà lại 32 đơn vị trên về đáp án sai, hai đáp án cùng đúng, cách đọc sai, bản dịch sai nghĩa; ngưỡng đạt ≤ 1 lỗi/100 mục (≈ ≤ 1–2 lỗi trên 188 mục). Lỗi tìm được xử lý bằng `status = inactive` + đơn vị thay thế (tiêu đề mới) hoặc `amendments`.

### T265 – Xác nhận SC-008 (CHỜ người có chuyên môn)

CHƯA thực hiện: cần người có chuyên môn tiếng Nhật đối chiếu danh mục `content/scope/` với tài liệu thi tham khảo chuẩn và ghi xác nhận bằng văn bản ở `content/scope/REVIEW.md`, mục "Xác nhận SC-008". Đây là cổng G1, chưa được ủy quyền cho tác nhân.

### T266 – Đường băng trên nội dung thật (SC-003)

`RUNWAY_REAL=1 vitest run --project unit tests/unit/runway.test.ts`: **20 test đạt, 1 bỏ qua** (bỏ qua có chủ đích: `n4-10min-work-goal`, chỉ chạy trên thư viện tổng hợp). Trong khối "đường băng trên content/ thật": hồ sơ `n4-15min-jlpt-n3` ≥ 180 ngày liên tục có bài mới, 0 thông báo hết nội dung, 100% kế hoạch ≤ quỹ; `n4-5min-runway` ≥ 90 ngày không hết đơn vị 5 phút; quỹ 5/10/15/30 phút 100% kế hoạch ≤ quỹ, luyện đọc/viết chỉ ở hồ sơ 30 phút; N4 trước N3, không lặp bài mới; `completed-all-n3` và `n2-goal` cho đúng thông báo hết nội dung/trần N3; placement N4/N3 bắt đầu đúng trình độ.

### T270 – Tài liệu

Đã cập nhật `content/README.md` (mục "Thư viện sau đợt 014-final" và "Ghi chú phát hành dành cho người học": `completionRatio` nay tính theo phút và có thể giảm đột ngột khi phạm vi tăng, thành tựu `goal_*` đã đạt không bị thu hồi) và `content/schema/CHANGELOG.md` (không đổi schema; thêm chủ đề luyện viết). `backend/src/reports/README.md` KHÔNG đổi: các chỉ số báo cáo không đổi định nghĩa. Kênh thông báo trong ứng dụng/email cho người học nằm ngoài kho mã: người phụ trách phát hành cần đăng nội dung ghi chú khi triển khai lên môi trường thật.

### T269 – Chạy toàn bộ kiểm thử (2026-11-17)

| Hạng mục | Kết quả |
|---|---|
| `tsc --noEmit` (backend) | Sạch. Có sẵn 1 lỗi ở HEAD (`tests/fixtures/synthetic-content.ts`, `rel[1]` có thể `undefined`) đã sửa (`?? ''`) |
| `eslint .` (backend) | Sạch |
| `prettier --check .` (backend) | Còn **25 file lệch định dạng, TẤT CẢ có sẵn tại HEAD hoặc của spec khác** (README, `src/engine/encouragement.ts`, `src/services/daily-plan.ts`, test spec 003/004/…); chưa định dạng lại để tránh nhiễu diff ngoài phạm vi. Đã định dạng các file của spec này (fixture hồ sơ học viên, `plans-pre-008.json`, test đã sửa) |
| `vitest run` (unit + db, PostgreSQL nhúng `jl_test_reading`) | 2.937 test: sau khi sửa bên dưới chỉ còn **5 test đỏ có sẵn tại HEAD** (`kanji-admin` 4 test, `kanji-us5` "đúng 6 chủ đề Kanji") — cùng nhóm đã ghi nhận ở spec 003, không phải hồi quy của spec này |
| `flutter analyze` / `flutter test` | Không có vấn đề / **527 test đạt** |

Test cũ đã lỗi thời vì thư viện hoàn tất và được cập nhật trong lượt này: (1) `content-coverage.test.ts` "`--final` thoát 1 khi chưa đạt ngưỡng" và "`--final` báo AU18" — nay dựng tình huống thiếu bằng `copyContentDir` (chỉ đợt cơ sở) + `CONTENT_DIR`; thêm test "thư viện thật không còn lỗi AU18"; (2) `kanji-progress.test.ts` "tính bài Kanji khi kanji ∈ skills" — kỳ vọng `completionRatio` đổi từ 1/số đơn vị sang Σ phút (D12 của spec này). Đã xóa test tạm `tmp-reading-learn.test.ts` (tạo trước phiên này, đỏ vì giả định thư viện cũ).

## Bảng nghiệm thu QS8 (T268)

| SC | Cách kiểm | Kết quả | Người xác nhận |
|---|---|---|---|
| SC-001 | `content:coverage --final` | **Đạt**: thoát 0, 0 dòng chưa phủ (từ vựng 716/716 + 2.243/2.243, Kanji 170 + 359, ngữ pháp 104 + 106, đọc 14 + 13) | Kỹ thuật |
| SC-002 | Cùng lệnh | **Đạt**: ngữ pháp, Kanji, từ vựng đều 100% ở cả N4 và N3 (≥ 95/95/90%) | Kỹ thuật |
| SC-003 | `RUNWAY_REAL=1 runway.test.ts` | **Đạt**: ≥ 180 ngày không hết nội dung với hồ sơ 15 phút; 100% kế hoạch ≤ quỹ 5/10/15/30 phút; tổng 4.055 phút ≥ 2.700 | Kỹ thuật |
| SC-004 | `content-releases.test.ts` + seed đóng kín | **Đạt**: 15 manifest, 629 đơn vị đều có hồ sơ duyệt (baseline miễn), seed không nạp `drafts/`. Lưu ý: hồ sơ G1 các đợt 001–014 do LLM ghi theo chỉ định trực tiếp của chủ dự án (xem từng mục đợt) | Kỹ thuật + người duyệt |
| SC-005 | Mẫu 5% (32 đơn vị, hạt giống 20261117) rà lại | **CHƯA**: đã bốc mẫu (xem T264), chờ người có chuyên môn rà | Người có chuyên môn tiếng Nhật |
| SC-006 | `content:stats` | **Đạt**: đọc 32 + 32 (≥ 8 chủ đề, ≥ 4 dạng), viết 22 + 22; mọi (loại × trình độ) có đơn vị 5 phút | Kỹ thuật |
| SC-007 | QS4 + QS5 sau mỗi đợt | **Một phần**: 0 mất/đổi dữ liệu người học (test seed idempotent mọi đợt, đạt). `GET /today` p95 **chưa chứng minh ≤ +10%**: 590 đơn vị đo +15% p95 / +9% p50 trên máy nhiễu (xem 012/013); chưa đo lại ở 629 đơn vị | Kỹ thuật |
| SC-008 | Văn bản xác nhận ở `content/scope/REVIEW.md` | **CHƯA** (T265) | Người có chuyên môn tiếng Nhật |

**Việc còn lại cho người**: T264 (rà mẫu SC-005), T265 (xác nhận SC-008), T267 (học thử thủ công trên Chrome/Edge/Firefox, gồm hiển thị đoạn nhiều dòng, gõ IME, học viên 5 phút), đo lại `GET /today` trên máy rảnh ở thư viện 629 đơn vị rồi hoàn tất T268.
