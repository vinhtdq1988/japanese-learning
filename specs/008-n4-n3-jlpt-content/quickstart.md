# Quickstart kiểm chứng: Bổ sung nội dung học N4 → N3

**Nhánh**: `008-n4-n3-jlpt-content` | **Đặc tả**: [spec.md](spec.md) | **Kế hoạch**: [plan.md](plan.md)

Hướng dẫn chạy và kiểm chứng. Chi tiết dữ liệu ở [data-model.md](data-model.md), quy ước nội dung ở [contracts/content-authoring.md](contracts/content-authoring.md), danh mục ở [contracts/scope-catalog.md](contracts/scope-catalog.md), đợt phát hành ở [contracts/release-manifest.md](contracts/release-manifest.md), API ở [contracts/api-changes.md](contracts/api-changes.md). Tài liệu này KHÔNG chứa mã hiện thực; mã và kiểm thử cụ thể nằm ở `tasks.md`.

## Điều kiện tiên quyết

- Node.js ≥ 22 và `pnpm`; PostgreSQL 16 cho các kiểm thử `--project db` (xem `backend/README.md`; có thể dùng PostgreSQL nhúng không cần Docker).
- Flutter stable (web) cho phần client của QS6–QS7.
- Đã đọc [research.md](research.md): đặc biệt D5 (đợt/duyệt), D7 (tách kiểm thử khỏi nội dung thật), D10 (thứ tự học).

```bash
cd backend
pnpm install
```

## QS1. Danh mục phạm vi và mức phủ (FR-001 → FR-003, SC-001, SC-002)

Kiểm các bất biến mỗi PR, rồi nghiệm thu khi hoàn tất.

```bash
pnpm content:coverage                 # bất biến: scopeRef hợp lệ, mục chính duy nhất, exclude có lý do
pnpm content:coverage --kind grammar --level N4 --list-uncovered   # việc còn lại của một ô
pnpm content:coverage --final         # nghiệm thu: ngưỡng FR-003 và 0 "chưa phủ"
```

**Kỳ vọng**: lệnh đầu thoát `0` ở mọi đợt; bảng loại × trình độ hiển thị tổng/phủ/loại trừ/chưa phủ/% theo [scope-catalog.md §4](contracts/scope-catalog.md). `--final` chỉ thoát `0` khi ngữ pháp ≥ 95%, Kanji ≥ 95%, từ vựng ≥ 90% cho **cả N4 và N3** và không còn dòng "chưa phủ". Thử cố ý: thêm `scopeRef` trỏ dòng không tồn tại, hoặc đặt cùng một từ làm mục chính ở hai đơn vị → thoát `1` kèm thông báo chỉ rõ.

## QS2. Kiểm tra tự động và hồ sơ duyệt (FR-017, SC-004)

```bash
pnpm content:lint                     # toàn bộ content/units/ + manifest + quy tắc AU1…AU18 ngoài baseline
pnpm content:lint --drafts            # kiểm bản nháp content/drafts/ trước khi đưa người duyệt
pnpm exec vitest run --project unit tests/unit/content-files.test.ts tests/unit/content-releases.test.ts tests/unit/content-lint-authoring.test.ts tests/unit/content-scope.test.ts tests/unit/content-coverage.test.ts
```

**Kỳ vọng**:

- Thêm một file vào `content/units/` mà không có trong manifest nào → kiểm tra thất bại (M1); `pnpm seed` **không chạy** (đóng kín).
- Đặt file ở `content/drafts/…` → `pnpm seed` không nạp (test M7: 0 đơn vị từ bản nháp).
- Manifest thiếu `reviewer`/`reviewedOn` → lỗi (M3). Lỗi AU1 (ví dụ thiếu `reading` kana), AU4 (mục không có bài tập), AU7 (mục trùng), AU9 (`sequence` trùng), AU14 (chữ thiếu glyph) đều báo đúng đường dẫn.
- Baseline (`000-baseline`) vẫn qua kiểm tra với 33 đơn vị hiện có (được miễn quy tắc mới).

## QS3. Đường băng 180 ngày, thứ tự học và ôn lùi (Câu chuyện 4, SC-003, FR-011, FR-020)

Mô phỏng thuần hàm (không cần DB), dùng toàn bộ nội dung đã phát hành (`releases: 'all'`).

```bash
pnpm exec vitest run --project unit tests/unit/runway.test.ts tests/unit/path-frontier.test.ts tests/unit/path-remedial.test.ts tests/unit/goal-ratio.test.ts
pnpm content:stats                    # số đơn vị/phút theo loại × trình độ × thời lượng (so với bảng ở research D17)
```

**Kỳ vọng** (hồ sơ đại diện mới ở `backend/tests/fixtures/learner-profiles/`):

| Hồ sơ | Kiểm |
|---|---|
| `n4-15min-jlpt-n3` (từ vựng + ngữ pháp + Kanji, ≥ 180 ngày học liên tục) | **0** ngày có thông báo hết nội dung; 100% ngày ≤ 15 phút; N4 trước N3; không đơn vị nào lặp lại như bài mới (SC-003) |
| `n4-5min-runway` | ≥ 90 ngày không hết đơn vị 5 phút; 100% ngày ≤ 5 phút |
| `n4-10min-jlpt-n3`, `n3-30min-all-skills` | Quỹ thời gian đúng; luyện đọc/viết chỉ xuất hiện ở hồ sơ 30 phút (FR-023) |
| `n3-skip-n4-weak` (placement N3, mảng N4 yếu) | Thấy N3; có **≤ 3** đơn vị N4 ôn lùi thuộc mảng yếu, không hơn (D11) |
| `mastered-some-units` | Đơn vị đã đánh dấu thành thạo không xuất hiện như bài mới (kịch bản 3) |
| `completed-all-n3` | Thông báo hết nội dung + gợi ý ôn tập như hành vi hiện có (kịch bản 4) |
| `n2-goal` | Vẫn dừng ở N3 + thông báo phạm vi (Trường hợp biên) |
| `n4-10min-work-goal` (mục tiêu `work`) | Chủ đề công việc được ưu tiên trong 12 đơn vị đầu mỗi loại (tối đa 3 đơn vị đề bạt), không đứng trước tiên quyết cùng loại (Câu chuyện 2 kịch bản 4, D10) |

Kiểm thứ tự: với mỗi loại, đơn vị được đề xuất luôn theo `(trình độ, sequence)` kể cả khi một mảng bị đánh dấu yếu hoặc độ lệch độ khó dương (bất biến I7); cho `requires` thật (ngữ pháp bị động sau thể ない) thì kiến thức nền luôn đứng trước (Câu chuyện 1 kịch bản 4). Golden của thư viện baseline **không đổi** (D10, tương thích).

## QS4. Phát hành theo đợt không ảnh hưởng người học (FR-018, SC-007, I2, I3)

```bash
pnpm exec vitest run --project db tests/integration/seed-release-idempotent.test.ts tests/integration/seed-amendments.test.ts tests/integration/admin-activation-duplicate.test.ts
```

**Kỳ vọng**: (1) seed `000-baseline` → học một bài, trả lời, có lịch ôn → seed thêm đợt mới → `learning_units.id`, `content_items.id`, `exercises.id` cũ, `unit_progress`, `review_schedules`, `study_records` **giữ nguyên từng dòng**; (2) chạy `pnpm seed` lần nữa → `unitsInserted = 0`; (3) đợt có `amendments`: âm/ví dụ/bài tập mới xuất hiện ở mục hiện có, chạy lại không nhân đôi, lịch ôn của chữ đó không đổi; (4) kích hoạt qua Admin một đơn vị từ vựng/ngữ pháp có mục trùng đơn vị `active` khác → `422`.

Thủ công: `pnpm seed` trên CSDL dev đã có dữ liệu người học, mở `GET /today` ở tài khoản dùng thử trước/sau — kế hoạch hôm nay đã sinh **không đổi** (kế hoạch ngày lưu cố định).

## QS5. Hiệu năng ở thư viện lớn (SC-007, Trường hợp biên cuối)

```bash
pnpm exec vitest run --project unit tests/unit/perf-large-catalog.test.ts      # rankUnits + biên giới với 700 đơn vị tổng hợp: trung vị < 5 ms
cd backend && time pnpm seed                                                  # seed đầy đủ ≤ 120 s; chạy lại không đổi gì ≤ 15 s
```

Đo `GET /today` và `GET /path` p95 (script tải ở `backend/tests/load/`, 200 lần, tài khoản N4/15 phút) trên **cùng máy** hai lần: CSDL chỉ có `000-baseline` rồi CSDL có toàn bộ nội dung. **Kỳ vọng**: `GET /today` p95 chậm hơn **không quá 10%**; `GET /path` không lọc ≤ 300 ms ở thư viện đầy đủ, `GET /path?kind=grammar&limit=20` nhanh hơn rõ rệt. Ghi kết quả vào `quickstart-results.md` (cùng khuôn spec 004).

## QS6. API, thông báo nghe hiểu và client (FR-022, FR-023)

Đặt `TOKEN` của một học viên mục tiêu JLPT N3, đã onboarding.

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API/path?kind=grammar&level=N4&limit=20" | jq '{itemsTotal, n: (.items|length), notices}'
curl -s -H "Authorization: Bearer $TOKEN" "$API/progress" | jq '.goal | {completionRatio, scopeNotice, notices}'
```

**Kỳ vọng**: `notices` chứa `listening_not_available` (và **không** chứa khi mục tiêu không phải JLPT); `itemsTotal` ≥ số `items` khi có `limit`; `completionRatio` tăng khi hoàn thành thêm đơn vị (trọng số theo phút, D12); `GET /path?status=xyz` → `422`. Học viên N2/N1 nhận cả `content_ceiling_n3` và `listening_not_available`.

Client (thủ công trên Chrome): kết thúc onboarding với mục tiêu JLPT → banner "chưa có phần nghe hiểu" (vi/en); cùng banner ở Hồ sơ, Lộ trình, Tiến độ; màn Lộ trình cuộn mượt với ≈ 600 đơn vị, lọc theo loại/trình độ hoạt động; học viên không chọn JLPT không thấy banner nghe hiểu.

```bash
cd client && flutter test test/path test/progress test/onboarding
```

## QS7. Học thử đầu–cuối trên nội dung thật (Câu chuyện 1, 2, 3, 5, 6; FR-004 → FR-015)

Thủ công, một người có chuyên môn tiếng Nhật hoặc người duyệt, trên bản đã seed đầy đủ; ghi lại ở `quickstart-results.md`.

- [ ] **Ngữ pháp N4 và N3** (ít nhất 3 đơn vị mỗi trình độ, trong đó có một đơn vị có mẫu dễ nhầm): thấy ý nghĩa vi/en, cách chia/kết hợp, ví dụ có kana + dịch; có bài phân biệt (`contrast`); bài sắp xếp ★ làm được bằng trắc nghiệm; làm sai → phản hồi giải thích **vì sao** đúng (kịch bản 1.2, 1.3, 1.5).
- [ ] **Từ vựng N4 và N3** (ít nhất 3 đơn vị mỗi trình độ): chữ viết, kana, nghĩa vi/en, ví dụ; đề có dạng chọn cách đọc, chọn chữ Hán, điền theo ngữ cảnh, gần nghĩa; hoàn tất rồi các từ vào lịch ôn (kịch bản 2.2, 2.3). Với mục tiêu "công việc", chủ đề công việc được ưu tiên nhưng vẫn gặp đủ danh mục JLPT khi mục tiêu là JLPT (kịch bản 2.4).
- [ ] **Chữ Hán N4 và N3** (ít nhất 2 bài mỗi trình độ): ba khía cạnh bài tập; câu `reading` chữ nhiều âm nêu từ ngữ cảnh nên chỉ có một đáp án; **không ô vuông** ở chữ chính và ví dụ trên Chrome/Edge/Firefox (FR-015). Chữ có thêm cách đọc ở N3 → cách đọc mới nằm ở mục hiện có (amendment), không có chữ lặp (kịch bản 3.3).
- [ ] **Luyện đọc** (học viên 30 phút; ≥ 5 bài mỗi trình độ ở các chủ đề/dạng khác nhau, gồm một đoạn vừa N3 và một bài tra cứu thông tin có nhiều dòng): đoạn hiển thị đủ, xuống dòng đúng; từ vượt phạm vi có chú giải; trả lời sai → phản hồi chỉ ra phần đoạn dẫn tới đáp án (kịch bản 5.2, 5.3). Học viên dưới 30 phút **không** thấy luyện đọc/viết (kịch bản 5.4).
- [ ] **Luyện viết** (≥ 3 bài mỗi trình độ): gõ hiragana, gõ Kanji, gõ sai nghĩa → hai dạng đúng được chấp nhận, dạng sai nghĩa bị từ chối (kịch bản 6.2).
- [ ] **Người học 5 phút**: kế hoạch có đơn vị 5 phút ở cả N4 và N3 cho mọi kỹ năng được chọn, không rỗng (Trường hợp biên).

## QS8. Nghiệm thu (đối chiếu tiêu chí thành công)

| SC | Cách kiểm | Người xác nhận |
|---|---|---|
| SC-001 | `pnpm content:coverage --final` thoát `0`, bảng 0 "chưa phủ" | Kỹ thuật |
| SC-002 | Cùng lệnh: ngữ pháp ≥ 95%, Kanji ≥ 95%, từ vựng ≥ 90% (N4 và N3) | Kỹ thuật |
| SC-003 | `runway.test.ts` (QS3): 0 thông báo hết nội dung trong ≥ 180 ngày với hồ sơ 15 phút; 100% kế hoạch ≤ quỹ ở 5/10/15/30 | Kỹ thuật |
| SC-004 | `content-releases.test.ts` + `pnpm seed` đóng kín: 100% đơn vị trong `units/` có hồ sơ duyệt; 0 từ `drafts/` | Kỹ thuật + người duyệt |
| SC-005 | Lấy mẫu ngẫu nhiên 5% đơn vị đã kích hoạt, rà lại: ≤ 1 lỗi nội dung/100 mục | Người có chuyên môn tiếng Nhật |
| SC-006 | `content:stats`: mỗi trình độ ≥ 30 `reading` (≥ 8 chủ đề), ≥ 20 `writing`; mỗi (loại × trình độ) ≥ 1 đơn vị 5 phút | Kỹ thuật |
| SC-007 | QS4 (0 mất/đổi dữ liệu người học) + QS5 (`GET /today` ≤ +10%) sau **mỗi** đợt | Kỹ thuật |
| SC-008 | Văn bản xác nhận ở `content/scope/REVIEW.md`: không thiếu mảng kiến thức chính của chữ – từ vựng, ngữ pháp, đọc hiểu ở N4 và N3 | Người có chuyên môn tiếng Nhật |

Danh sách kiểm sau mỗi đợt (rút gọn): [ ] `content:lint` sạch · [ ] `content:coverage` sạch · [ ] manifest đủ hồ sơ duyệt · [ ] seed trên bản sao dữ liệu thật, không đổi id/tiến độ cũ · [ ] `GET /today` p95 ≤ +10% · [ ] thử học 3 đơn vị ngẫu nhiên của đợt · [ ] ghi nhận nguồn tham khảo của đợt.
