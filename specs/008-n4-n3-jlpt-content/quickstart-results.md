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
