// Engine kế hoạch ngày thuần hàm (research R7, FR-012, Nguyên tắc I). Nhận quỹ thời gian `B` và danh
// sách ứng viên đã được dịch vụ chuẩn bị; không phụ thuộc HTTP/CSDL/đồng hồ.

import type { LocalDate, Skill } from '../domain/types.js';
import { addDays, diffDays } from './clock.js';

/** Tỷ lệ tối đa của quỹ thời gian dành cho ôn tập. */
export const MAX_REVIEW_SHARE = 0.6;
/** Đơn vị học mới nhỏ nhất (phút): phần dư nhỏ hơn mức này không đủ chỗ cho bài mới. */
export const MIN_NEW_UNIT_MINUTES = 5;
/** Thời lượng tối đa của một mục kế hoạch (Nguyên tắc I). */
export const MAX_ITEM_MINUTES = 15;

/** Gói ôn đã chia sẵn: `estMinutes` ∈ [1, 15]. */
export interface ReviewBatch {
  itemIds: string[];
  estMinutes: number;
}

/**
 * Nguồn gói ôn: nhận số phút ôn tối đa `minutes` và trả các gói ôn (đã chọn theo mức ưu tiên, đã chia
 * gói ≤ 15 phút) có tổng không vượt `minutes`. Dịch vụ dựng nguồn này từ `rankDueItems` +
 * `packReviewBatches`; engine vẫn chặn cứng tổng ≤ `minutes` phòng nguồn trả thừa.
 */
export type ReviewPacker = (minutes: number) => ReviewBatch[];

/** Mục ôn đến hạn (từ `review_schedules`) làm đầu vào chọn gói ôn. */
export interface DueReviewItem {
  itemId: string;
  /** Ngày đến hạn gốc (ngày địa phương); chỉ dùng để xếp mức quá hạn. */
  dueDate: LocalDate;
  /** Cờ "mục khó" (R6, FR-014). */
  isHard: boolean;
}

/**
 * Sắp mục đến hạn theo mức ưu tiên (R7): mục khó trước, rồi quá hạn lâu nhất trước (`dueDate` nhỏ hơn),
 * cuối cùng theo `itemId` để kết quả tất định. Chỉ giữ mục đã đến hạn (`dueDate ≤ today`); không sửa
 * `dueDate` nên mục không vừa quỹ hôm nay được ưu tiên tiếp ở ngày sau.
 */
export function rankDueItems(items: readonly DueReviewItem[], today: LocalDate): DueReviewItem[] {
  return items
    .filter((i) => i.dueDate <= today)
    .sort(
      (a, b) =>
        Number(b.isHard) - Number(a.isHard) ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.itemId.localeCompare(b.itemId),
    );
}

/** Số phút ước lượng của gói ôn gồm `n` mục: `ceil(n × secondsPerItem / 60)`. */
export function reviewMinutesFor(n: number, secondsPerItem: number): number {
  return Math.ceil((n * secondsPerItem) / 60);
}

/** Số mục ôn tối đa cho quỹ `minutes`: `floor(minutes × 60 / secondsPerItem)`. */
export function maxReviewItems(minutes: number, secondsPerItem: number): number {
  return Math.floor((minutes * 60) / secondsPerItem);
}

/** Chia `ids` thành `k` gói kích thước chênh lệch tối đa 1, giữ thứ tự ưu tiên (gói đầu lớn nhất). */
function splitEvenly(ids: readonly string[], k: number): string[][] {
  const base = Math.floor(ids.length / k);
  const extra = ids.length % k;
  const out: string[][] = [];
  let at = 0;
  for (let i = 0; i < k; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(ids.slice(at, at + size));
    at += size;
  }
  return out;
}

/**
 * Chọn và chia gói ôn (R7, Nguyên tắc I): lấy tối đa `floor(minutes × 60 / secondsPerItem)` mục đầu
 * danh sách `rankedItemIds` (đã sắp ưu tiên), chia đều thành `k = ceil(tổng phút / 15)` gói, mỗi gói
 * 1–15 phút, tổng phút KHÔNG vượt `minutes`. Mục không vừa bị bỏ lại (giữ nguyên `due_date`).
 */
export function packReviewBatches(
  rankedItemIds: readonly string[],
  minutes: number,
  secondsPerItem: number,
): ReviewBatch[] {
  const unique = [...new Set(rankedItemIds)];
  let n = Math.min(unique.length, maxReviewItems(minutes, secondsPerItem));
  while (n > 0) {
    const ids = unique.slice(0, n);
    let k = Math.max(1, Math.ceil(reviewMinutesFor(n, secondsPerItem) / MAX_ITEM_MINUTES));
    // Cộng dồn làm tròn lên có thể đẩy một gói vượt 15 phút: tăng số gói cho tới khi hợp lệ.
    for (; k <= n; k++) {
      const batches = splitEvenly(ids, k).map((itemIds) => ({
        itemIds,
        estMinutes: reviewMinutesFor(itemIds.length, secondsPerItem),
      }));
      const total = batches.reduce((s, b) => s + b.estMinutes, 0);
      if (batches.every((b) => b.estMinutes <= MAX_ITEM_MINUTES)) {
        if (total <= minutes) return batches;
        break; // vượt quỹ do làm tròn: bỏ bớt mục cuối ưu tiên thấp nhất
      }
    }
    n--;
  }
  return [];
}

export interface NewUnitCandidate {
  unitId: string;
  /** ∈ {5, 10, 15}. */
  estMinutes: number;
  /** Kỹ năng của đơn vị; chỉ `applyKanjiSlot` dùng, `planDailyPlan` bỏ qua. */
  kind?: Skill;
}

/** Loại kế hoạch của một ngày, dùng để luân phiên ngày kế tiếp. */
export type PlanDayKind = 'mixed' | 'review_only' | 'new_only' | 'empty';

export type PlannedItem =
  | { type: 'new_unit'; unitId: string; estMinutes: number }
  | { type: 'review_batch'; itemIds: string[]; estMinutes: number };

export interface DailyPlanInput {
  /** Quỹ thời gian khai báo `B` ∈ {5, 10, 15, 30}. */
  budgetMinutes: number;
  /** Đang tạm dừng lộ trình → không sinh kế hoạch. */
  paused: boolean;
  /** Đơn vị mới ứng viên, đã sắp theo thứ tự ưu tiên (từ `rankUnits`). */
  newUnits: readonly NewUnitCandidate[];
  packReview: ReviewPacker;
  /** Loại kế hoạch ngày liền trước (null nếu chưa có). */
  previousKind: PlanDayKind | null;
}

export interface DailyPlanResult {
  items: PlannedItem[];
  estimatedMinutes: number;
  kind: PlanDayKind;
}

/** Chọn lần lượt (first-fit) các đơn vị mới vừa trong `minutes`; giữ thứ tự ưu tiên. */
function pickNewUnits(
  units: readonly NewUnitCandidate[],
  minutes: number,
): Extract<PlannedItem, { type: 'new_unit' }>[] {
  const picked: Extract<PlannedItem, { type: 'new_unit' }>[] = [];
  let remaining = minutes;
  for (const u of units) {
    if (u.estMinutes <= remaining) {
      picked.push({ type: 'new_unit', unitId: u.unitId, estMinutes: u.estMinutes });
      remaining -= u.estMinutes;
    }
  }
  return picked;
}

/** Gói ôn hợp lệ trong `minutes`: bỏ gói rỗng/ngoài [1, 15] và cắt khi vượt tổng. */
function takeReview(
  packer: ReviewPacker,
  minutes: number,
): Extract<PlannedItem, { type: 'review_batch' }>[] {
  if (minutes < 1) return [];
  const batches: Extract<PlannedItem, { type: 'review_batch' }>[] = [];
  let used = 0;
  for (const b of packer(minutes)) {
    if (b.itemIds.length === 0 || b.estMinutes < 1 || b.estMinutes > MAX_ITEM_MINUTES) continue;
    if (used + b.estMinutes > minutes) continue;
    batches.push({ type: 'review_batch', itemIds: b.itemIds, estMinutes: b.estMinutes });
    used += b.estMinutes;
  }
  return batches;
}

const sumMinutes = (items: readonly PlannedItem[]): number =>
  items.reduce((s, i) => s + i.estMinutes, 0);

function finish(review: PlannedItem[], created: PlannedItem[]): DailyPlanResult {
  const items = [...review, ...created];
  const kind: PlanDayKind =
    items.length === 0
      ? 'empty'
      : review.length === 0
        ? 'new_only'
        : created.length === 0
          ? 'review_only'
          : 'mixed';
  return { items, estimatedMinutes: sumMinutes(items), kind };
}

/**
 * Sinh kế hoạch ngày. Trả null khi đang tạm dừng (không sinh kế hoạch, không có "ngày bỏ lỡ").
 *
 * Quy tắc (R7):
 * - Tổng `estMinutes` KHÔNG BAO GIỜ vượt `B`; mỗi mục 1–15 phút.
 * - Ôn tập chiếm tối đa 60% `B`; phần còn lại cho đơn vị mới có `estMinutes ≤` phần còn lại.
 * - Không có bài ôn → toàn bộ quỹ cho bài mới; không có bài mới phù hợp → toàn bộ quỹ cho ôn.
 * - Khi phần dư sau ôn < 5 phút (không đủ cho đơn vị mới nhỏ nhất) mà cả hai loại đều có, ngày là
 *   chỉ-ôn hoặc chỉ-bài-mới và luân phiên: ngay sau ngày chỉ-ôn thì ưu tiên bài mới.
 * - Ôn đứng trước bài mới trong danh sách mục.
 */
export function planDailyPlan(input: DailyPlanInput): DailyPlanResult | null {
  if (input.paused) return null;
  const { budgetMinutes: B, newUnits, packReview, previousKind } = input;

  const fitsAny = newUnits.some((u) => u.estMinutes <= B);
  const reviewCap = Math.floor(MAX_REVIEW_SHARE * B);
  const mixedReview = takeReview(packReview, reviewCap);

  // Không có bài ôn đến hạn: toàn bộ quỹ cho bài mới.
  if (mixedReview.length === 0 && takeReview(packReview, B).length === 0) {
    return finish([], pickNewUnits(newUnits, B));
  }
  // Có bài ôn nhưng không có bài mới phù hợp: toàn bộ quỹ cho ôn.
  if (!fitsAny) return finish(takeReview(packReview, B), []);

  const leftover = B - sumMinutes(mixedReview);
  if (mixedReview.length > 0 && leftover >= MIN_NEW_UNIT_MINUTES) {
    const created = pickNewUnits(newUnits, leftover);
    if (created.length > 0) return finish(mixedReview, created);
  }

  // Phần dư không đủ cho bài mới: luân phiên chỉ-ôn / chỉ-bài-mới.
  if (previousKind === 'review_only') return finish([], pickNewUnits(newUnits, B));
  return finish(takeReview(packReview, B), []);
}

// --- Giai đoạn tạm dừng và khoảng nghỉ (T092, FR-015) ---

/** Giai đoạn tạm dừng theo ngày địa phương: nửa khoảng `[startedOn, endedOn)`; `endedOn = null` là đang mở. */
export interface PausePeriod {
  startedOn: LocalDate;
  endedOn: LocalDate | null;
}

/** Ngày `day` có thuộc một giai đoạn tạm dừng không (giai đoạn mở kéo dài vô hạn). */
export function isPausedOn(day: LocalDate, periods: readonly PausePeriod[]): boolean {
  return periods.some((p) => day >= p.startedOn && (p.endedOn === null || day < p.endedOn));
}

/** Số ngày vắng tối thiểu để coi là khoảng nghỉ cần lập lại kế hoạch (FR-015). */
export const GAP_THRESHOLD_DAYS = 2;
/** Mã thông báo gắn vào `DailyPlan.notice` sau khoảng nghỉ. */
export const GAP_NOTICE = 'replanned_after_gap';

/**
 * Số ngày vắng tính từ ngày học gần nhất đến hôm nay: số ngày trong `(lastActive, today]` không thuộc giai
 * đoạn tạm dừng. 0 khi chưa từng học (chưa có gì để "bỏ lỡ").
 */
export function absentDays(
  lastActive: LocalDate | null,
  today: LocalDate,
  pausePeriods: readonly PausePeriod[],
): number {
  if (!lastActive) return 0;
  const span = diffDays(lastActive, today);
  let absent = 0;
  for (let i = 1; i <= span; i++) {
    if (!isPausedOn(addDays(lastActive, i), pausePeriods)) absent += 1;
  }
  return absent;
}

/** Vắng ≥ `GAP_THRESHOLD_DAYS` ngày (không tính ngày tạm dừng) → cần lập lại kế hoạch (FR-015). */
export function hasLearningGap(
  lastActive: LocalDate | null,
  today: LocalDate,
  pausePeriods: readonly PausePeriod[],
): boolean {
  return absentDays(lastActive, today, pausePeriods) >= GAP_THRESHOLD_DAYS;
}

// --- Suất Kanji trong kế hoạch ngày (spec 003, research K5) ---

export interface KanjiSlotInput {
  /** Kỹ năng người học đã chọn; không có `kanji` thì hàm là no-op (FR-009, SC-006). */
  skills: readonly Skill[];
  prioritizedSkill: Skill | null;
  /**
   * Kế hoạch gần nhất CÓ bài mới (trước hôm nay) có chứa bài Kanji không. `null` = chưa có kế hoạch nào
   * có bài mới (ngày đầu sau khi chọn Kanji) → coi như chưa có Kanji để Kanji được đứng đầu ngay.
   */
  lastNewUnitPlanHadKanji: boolean | null;
  /**
   * Quỹ thời gian ngày (phút). Nếu có, chỉ ứng viên Kanji vừa quỹ mới được đưa lên đầu, tránh bài Kanji
   * quá dài che khuất bài Kanji ngắn hơn phía sau; không truyền thì lấy ứng viên Kanji đầu tiên.
   */
  budgetMinutes?: number;
}

/**
 * Áp "suất Kanji" lên danh sách ứng viên bài mới đã xếp hạng, TRƯỚC `planDailyPlan` (hàm thuần).
 *
 * - `'kanji' ∉ skills` hoặc không có ứng viên Kanji (vừa quỹ) → giữ nguyên danh sách.
 * - `prioritizedSkill = 'kanji'` HOẶC kế hoạch gần nhất có bài mới không chứa bài Kanji → đưa ứng viên
 *   Kanji đầu tiên lên vị trí 0, phần còn lại giữ thứ tự → Kanji có ngày đầu và tối thiểu cách một ngày có
 *   bài mới, nhưng không chiếm hết khi không ưu tiên.
 * - Còn lại → giữ nguyên.
 *
 * Không đổi quỹ thời gian, giới hạn 60% ôn tập hay quy tắc luân phiên của `planDailyPlan` (R7).
 */
export function applyKanjiSlot<U extends NewUnitCandidate>(
  candidates: readonly U[],
  input: KanjiSlotInput,
): U[] {
  const unchanged = [...candidates];
  if (!input.skills.includes('kanji')) return unchanged;
  const first = candidates.findIndex(
    (c) =>
      c.kind === 'kanji' &&
      (input.budgetMinutes === undefined || c.estMinutes <= input.budgetMinutes),
  );
  if (first < 0) return unchanged;
  const promote = input.prioritizedSkill === 'kanji' || input.lastNewUnitPlanHadKanji !== true;
  if (!promote || first === 0) return unchanged;
  return [candidates[first]!, ...candidates.filter((_, i) => i !== first)];
}
