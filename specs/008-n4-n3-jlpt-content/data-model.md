# Mô hình dữ liệu (Phase 1): Bổ sung nội dung học N4 → N3

**Nhánh**: `008-n4-n3-jlpt-content` | **Ngày**: 2026-11-14 | **Đặc tả**: [spec.md](spec.md) | **Nghiên cứu**: [research.md](research.md)

**Tóm tắt**: **KHÔNG có migration, bảng hay cột mới** trong PostgreSQL. Dữ liệu mới là **tệp nội dung** (danh mục phạm vi, hồ sơ đợt, siêu dữ liệu biên soạn) nằm cạnh `content/units/` hiện có, cộng các **đại lượng suy ra** (độ phủ, biên giới xếp hạng, tiến độ theo phút, thông báo). Đơn vị học, mục, bài tập, chủ đề vẫn dùng đúng các bảng hiện có (`learning_units`, `content_items`, `exercises`, `topics` — xem `backend/src/db/schema.ts`).

## 1. Tổng quan thực thể

```text
content/ (nguồn sự thật, trong git)                    PostgreSQL (runtime — KHÔNG đổi schema)
─────────────────────────────────────────              ──────────────────────────────────────
scope/*.json        Danh mục phạm vi  ──┐ (suy ra)
releases/*.json     Hồ sơ đợt + duyệt   │ độ phủ         topics            ← seed (chèn nếu chưa có)
units/*.json        Đơn vị ĐÃ DUYỆT ────┼──────────────► learning_units   ← seed (chèn nếu chưa có;
drafts/<đợt>/*.json Đơn vị chờ duyệt    │ (không nạp)                        khóa tự nhiên kind+level+title.en)
topics.json         Chủ đề mịn          │                content_items    ← seed (+ amendments: chỉ thêm)
schema/*.schema.json                    │                exercises        ← seed
                                        └─ Báo cáo mức phủ (CLI, không lưu)
```

| Thực thể (spec) | Biểu diễn | Lưu ở đâu | Mới/đổi |
|---|---|---|---|
| Danh mục phạm vi JLPT | Dòng trong `content/scope/*.json` | Git | **Mới** (§2) |
| Báo cáo mức phủ | Kết quả tính của `pnpm content:coverage` | Không lưu (suy ra) | **Mới** (§3) |
| Đơn vị học | `learning_units` + file `content/units/*.json` | DB + git | Dữ liệu tăng; thêm siêu dữ liệu file (§5) |
| Mục nội dung | `content_items` | DB + git | Không đổi cấu trúc; thêm `scopeRef` chỉ ở file (§5) |
| Chủ đề (mảng nội dung) | `topics` + `content/topics.json` | DB + git | Thêm dòng (§6) |
| Đợt phát hành nội dung | `content/releases/NNN-*.json` | Git | **Mới** (§4) |

## 2. Danh mục phạm vi (`content/scope/`)

Chi tiết cấu trúc file và quy tắc: [contracts/scope-catalog.md](contracts/scope-catalog.md). Tóm tắt trường:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | chuỗi ổn định | Dạng `k-n4-012` (Kanji), `v-n3-0450` (từ vựng), `g-n4-023` (ngữ pháp), `r-n3-form-notice` (đọc). **Không bao giờ đổi hay tái sử dụng** |
| `level` | `N4`/`N3` | Trình độ của dòng |
| `key` | chuỗi | Khóa khớp: Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp và đọc hiểu = tự do (`scopeRef` của mục khớp theo `id`) |
| `label` | `{vi, en}` (chỉ ngữ pháp, đọc) | Tên mẫu/dạng để người duyệt đọc; từ vựng/Kanji không cần |
| `sources[]` | mảng mã nguồn | Mã trỏ tới `sources` ở đầu file (tên nguồn + mô tả phần tham khảo; **không** dán nội dung) |
| `exclude` | `{reason}` tùy chọn | Có ⇒ trạng thái **loại trừ** (quá hiếm, cổ, hoặc thuộc N2); `reason` bắt buộc không rỗng |
| `minUnits` | số, chỉ dòng `reading` | Số đơn vị tối thiểu để coi là phủ (mặc định 1; dạng đọc hiểu thường 2–4) |

**Trạng thái phủ (suy ra, KHÔNG lưu)** của một dòng:

```text
exclude có                                   → excluded
số đơn vị chứa mục khớp ≥ minUnits (mặc định 1) → covered
còn lại                                      → uncovered
```

- Khớp: mục đơn vị `active` (file đã duyệt) có khóa tự nhiên bằng `key` (Kanji/từ vựng), hoặc `scopeRef = id` (ngữ pháp, đọc hiểu, hoặc ngoại lệ). Đơn vị baseline được gắn `scopeRef` hồi tố (T271/T272; siêu dữ liệu chỉ ở file) nên mẫu/dạng của baseline cũng tính là phủ.
- Bất biến: dòng `covered` thuộc **đúng một** đơn vị làm mục chính (trừ dòng `reading` có `minUnits > 1`); `scopeRef` mọi mục phải trỏ tới `id` tồn tại; mọi `exclude.reason` không rỗng.

## 3. Báo cáo mức phủ (kết quả suy ra)

```text
CoverageReport {
  byKindLevel: Array<{ kind, level, total, covered, excluded, uncovered, percent }>
              // percent = covered / (total − excluded)
  uncovered:   Array<{ id, key, level, kind }>
  excluded:    Array<{ id, key, reason }>
  violations:  Array<{ type: 'duplicate_primary'|'unknown_scope_ref'|'missing_reason', ... }>
}
```

Ngưỡng nghiệm thu (`--final`): ngữ pháp ≥ 95%, Kanji ≥ 95%, từ vựng ≥ 90% cho **từng** trình độ (FR-003); `uncovered = 0` (SC-001). Hàm tính thuần: `domain/content-scope.ts`.

## 4. Đợt phát hành và hồ sơ duyệt (`content/releases/`)

Chi tiết: [contracts/release-manifest.md](contracts/release-manifest.md).

```text
Release {
  id: string                       // '000-baseline', '001-grammar-n4', …
  date: 'YYYY-MM-DD'
  baseline?: true                  // chỉ 000: miễn các quy tắc mới (research D5, D8)
  sources: Array<{ name, note }>   // nguồn tham khảo của đợt (FR-016)
  units: Array<{ file, reviewer, reviewedOn, checklist: true }>  // đợt baseline chỉ bắt buộc `file`
  amendments?: Array<Amendment>    // bổ sung cho mục hiện có — §4.1
  notes?: string
}
```

**Bất biến**: mỗi file trong `content/units/` thuộc **đúng một** manifest; mọi `units[].file` tồn tại; với đợt KHÔNG phải baseline, `reviewer`/`reviewedOn` không rỗng và `checklist = true` (baseline là hồ sơ lịch sử của spec 001/003/007, được miễn) (người duyệt xác nhận đã đi hết checklist của loại đơn vị); hai manifest không cùng `id`. Vi phạm ⇒ validate nội dung thất bại ⇒ seed không chạy (đóng kín).

**Trạng thái đơn vị theo vòng đời** (không có cột mới; dùng `learning_units.status` hiện có):

```text
(file trong drafts/)  --người duyệt chuyển + thêm vào manifest-->  (file trong units/ + manifest)
        │ không nạp, không hiển thị                                        │ seed chèn status='active'
        ▼                                                                   ▼ hiển thị cho người học
   bị từ chối: giữ ở drafts/ hoặc xóa                      sự cố: Admin API đặt status='inactive'
                                                           (tiến độ/ôn tập người học còn nguyên)
```

### 4.1 Bổ sung (`Amendment`, chỉ Kanji)

```text
Amendment {
  unit: { kind: 'kanji', level, titleEn }      // khóa tự nhiên của đơn vị hiện có
  item: string                                  // ký tự Kanji
  add: {
    onReadings?: string[]   // katakana
    kunReadings?: string[]  // hiragana, '.' phân cách okurigana
    examples?: Example[]    // khớp theo `ja`
    exercises?: Exercise[]  // facet 'reading' | 'word'; khớp theo (item, facet, prompt.en)
  }
}
```

**Bất biến**: áp **idempotent và chỉ thêm** — phần tử đã có (theo khóa so khớp) được bỏ qua; KHÔNG xóa/đổi giá trị cũ; id mục/bài tập cũ giữ nguyên (lịch ôn không đổi). Sau khi gộp, đơn vị vẫn đạt quy tắc Kanji (đủ ba khía cạnh, quỹ thời lượng); nếu thêm bài tập làm vượt quỹ thì bài biên soạn phải nêu rõ phương án (đổi `estMinutes` qua Admin, ghi ở `notes`).

## 5. Đơn vị học: siêu dữ liệu biên soạn mới (schema `unit` 1.2.0 → 1.3.0)

Chỉ **thêm tùy chọn** (file cũ vẫn hợp lệ). Seed **bỏ qua** các trường này — chúng không vào DB.

| Vị trí | Trường | Kiểu | Dùng để |
|---|---|---|---|
| Đơn vị | `requires` | `string[]` (tên file đơn vị không đuôi) | Kiến thức nền; lint kiểm tồn tại, trình độ ≤, `(trình độ, sequence)` nhỏ hơn (research D10) |
| Mục | `scopeRef` | `string` (`id` dòng danh mục) | Khớp độ phủ cho ngữ pháp, đọc hiểu và ngoại lệ (D2) |
| Bài tập | `format` | enum, xem dưới | Kiểm phủ dạng đề thi (FR-008, D8) |

`format` theo loại đơn vị (chi tiết ánh xạ đề thi: [contracts/content-authoring.md](contracts/content-authoring.md) §3):

| Loại | Giá trị `format` |
|---|---|
| `vocabulary` | `kanji_reading`, `orthography`, `context_fill`, `synonym`, `usage` |
| `grammar` | `form_fill`, `sentence_correct`, `sentence_order_star`, `text_grammar`, `contrast` |
| `kanji` | (không dùng — đã có `facet`) |
| `reading` | `comprehension_short`, `comprehension_mid`, `info_search` |
| `writing` | (không dùng) |

**Quy tắc cấu trúc mới** (cho đơn vị **ngoài baseline**, áp trong `validateUnit`/`validateCatalog`): xem [contracts/content-authoring.md](contracts/content-authoring.md) §4. Điểm đáng chú ý của mô hình:

- Mục chính duy nhất theo khóa: Kanji = ký tự; từ vựng = `japanese|reading`; ngữ pháp = `scopeRef` (D4).
- `sequence` duy nhất trong **(trình độ × loại)** (D10).
- Mỗi mục từ vựng/ngữ pháp có ≥ 1 bài tập **gắn mục** (nếu không sẽ không bao giờ vào lịch ôn).

## 6. Chủ đề (`content/topics.json` → `topics`)

Thêm ≈ 150–180 dòng. Mỗi dòng giữ cấu trúc hiện có `{ key, skill, level, name: {vi, en} }`.

| Quy tắc | Giá trị |
|---|---|
| Khóa chủ đề hiện có | **Giữ nguyên** (danh tính, `topic_stats`, bộ placement) |
| Quy ước khóa mới | `vocab-n4-<chủ-đề>`, `grammar-n3-<chủ-đề>`, `kanji-n4-<chủ-đề>`, `reading-n4-<dạng|chủ-đề>`, `writing-n3-<chủ-đề>` |
| Duy nhất | `name.en` duy nhất trong (kỹ năng × trình độ) — vì seed khớp chủ đề theo `(skill, level, name.en)` |
| Kích thước tối thiểu | ≥ 2 đơn vị **và** ≥ 20 bài tập tổng (khớp `TOPIC_WINDOW = 20`, ngưỡng 8 câu) — cảnh báo, thành lỗi ở `--final` |

## 7. Thuật toán/đại lượng suy ra (thay đổi mã tối thiểu)

### 7.1 Biên giới xếp hạng (research D10) — `engine/path.ts`

Hằng số: `FRONTIER_SIZE = 3`, `GOAL_LOOKAHEAD = 12`, `GOAL_EXTRA = 3`, `W.beyondFrontier` (điểm gán cố định thấp hơn mọi điểm của biên giới).

```text
rankUnits(params, profile, units, progress, stats, options):
  eligible   = lọc như cũ (active, kỹ năng, khoảng trình độ, chưa mastered) ∪ ôn lùi (§7.2)
  với mỗi loại k:
    pendingK = eligibleK có trạng thái pending|in_progress,
               sắp theo (trình độ, sequence) tăng dần
    frontierK = 3 đơn vị đầu của pendingK  ∪  mọi đơn vị in_progress
               ∪ (chỉ khi goalType ∈ {work, daily_conversation}) tối đa GOAL_EXTRA đơn vị đầu có thẻ = goalType
                 trong GOAL_LOOKAHEAD đơn vị đầu của pendingK
  với mỗi đơn vị u:
    nếu u ∈ frontier:   score = công thức cũ (trình độ, thẻ mục tiêu, ưu tiên, mảng yếu, độ lệch độ khó, sequence)
    nếu u ∉ frontier và pending: score = BEYOND − 100·(idxTrìnhĐộ − idxXuấtPhát) − 0,01·sequence
    completed/mastered: nhóm sắp xếp như cũ (group 1/2)
```

Bất biến kiểm thử: (a) mỗi loại luôn được đề xuất theo đúng thứ tự `(trình độ, sequence)` — không đơn vị nào ngoài biên giới đứng trước đơn vị trong biên giới; (b) khi mỗi loại ≤ 3 đơn vị chưa học, kết quả **bằng** công thức cũ (golden baseline); (c) tất định (không phụ thuộc UUID, vì `sequence` duy nhất); (d) học viên `work`/`daily_conversation`: tối đa 3 đơn vị có thẻ trùng mục tiêu trong 12 đơn vị pending đầu của mỗi loại được đề bạt, đơn vị ngoài cửa sổ không bao giờ được đề bạt; học viên `jlpt` cho kết quả như (a)–(c).

### 7.2 Ôn lùi bị chặn (research D11) — `engine/path.ts`

```text
remedialPool = đơn vị active, level = bậc ngay dưới params.startLevel,
               kỹ năng ∈ skills, topicId ∈ params.weakTopics
remedial     = 3 đơn vị đầu của remedialPool theo sequence (mọi trạng thái)
điểm trình độ của remedial = 0   (không cộng +100 như idx < startIdx)
```

Rỗng khi: không có `weakTopics`, trình độ xuất phát là N4/N5, hoặc `foundationFirst`. Không đổi `levelRange` lưu trong lộ trình.

### 7.3 Tiến độ mục tiêu (research D12) — `engine/progress.ts`

```text
goalRatio(ranked): done = Σ unit.estMinutes (status ∈ {completed, mastered})
                   total = Σ unit.estMinutes (mọi đơn vị trong phạm vi)
                   ratio = total > 0 ? round3(done / total) : 0
```

`ranked` phải mang `unit.estMinutes` (đã có trong `CatalogUnit`). Một nguồn cho `GET /progress` và `goal_*` (thành tựu).

### 7.4 Thông báo suy ra lúc đọc (research D12) — `services/path.ts`, `services/progress.ts`

```text
notices = [ params.scopeNotice nếu có ]
        ++ [ 'listening_not_available' nếu profile.goalType = 'jlpt' ]
```

Không lưu vào `learning_paths.generated_from` (lộ trình cũ cũng có thông báo mới).

## 8. Tính chất bất biến tổng hợp (kiểm thử)

| Mã | Bất biến | Kiểm bằng |
|---|---|---|
| **I1** | Kế hoạch ngày ≤ quỹ thời gian; ôn ≤ 60% quỹ (không đổi `planDailyPlan`) | `runway.test.ts` mọi hồ sơ 5/10/15/30 phút |
| **I2** | Đợt phát hành **không đổi** `learning_units.id`, `content_items.id`, `exercises.id`, `unit_progress`, `review_schedules`, `study_records` hiện có | `seed-release-idempotent.test.ts` (seed 000 → học → seed 001 → so id/tiến độ) |
| **I3** | Seed chạy lại không đổi gì (`unitsInserted = 0`) | cùng test |
| **I4** | File trong `units/` không thuộc manifest ⇒ seed thất bại; đơn vị ở `drafts/` không bao giờ vào DB | `content-releases.test.ts` |
| **I5** | Mỗi mục chính thuộc đúng một đơn vị ở mọi loại (kể cả qua Admin) | `content-coverage.test.ts`, `admin-activation-duplicate.test.ts` |
| **I6** | Mức phủ đạt FR-003 và 0 "chưa phủ" khi nghiệm thu | `pnpm content:coverage --final` |
| **I7** | Thứ tự từng loại bám `(trình độ, sequence)`; tất định | `path-frontier.test.ts` |
| **I8** | Ôn lùi ≤ 3 đơn vị và chỉ khi có `weakTopics` | `path-remedial.test.ts` |
| **I9** | `GET /today` không chậm quá 10% so với baseline | QS5 |
| **I10** | `completionRatio` ∈ [0,1], tăng khi hoàn thành đơn vị, khớp giữa `/progress` và thành tựu | `goal-ratio.test.ts`, `reward-achievements.test.ts` |
