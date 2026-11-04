import { describe, expect, it } from 'vitest';
import {
  maxReviewItems,
  packReviewBatches,
  planDailyPlan,
  rankDueItems,
  reviewMinutesFor,
  type DueReviewItem,
  type NewUnitCandidate,
} from '../../src/engine/daily-plan.js';
import { addDays } from '../../src/engine/clock.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';

// Kiểm thử chọn và chia gói ôn (T074, T078, research R7, FR-017, FR-024, SC-002). Việc luân phiên
// chỉ-ôn/chỉ-bài-mới đã được kiểm thử ở `daily-plan.test.ts` (T036).

const TODAY = '2026-01-05';
const SECONDS = 30; // REVIEW_SECONDS_PER_ITEM mặc định

const ids = (n: number, prefix = 'i'): string[] =>
  Array.from({ length: n }, (_, k) => `${prefix}${String(k).padStart(4, '0')}`);

const due = (itemId: string, daysOverdue: number, isHard = false): DueReviewItem => ({
  itemId,
  dueDate: addDays(TODAY, -daysOverdue),
  isHard,
});

const newUnits: NewUnitCandidate[] = [
  { unitId: 'u1', estMinutes: 5 },
  { unitId: 'u2', estMinutes: 5 },
  { unitId: 'u3', estMinutes: 10 },
];

describe('rankDueItems – thứ tự ưu tiên', () => {
  it('mục khó trước, rồi quá hạn lâu nhất trước', () => {
    const ranked = rankDueItems(
      [due('a', 1), due('b', 6), due('c', 3, true), due('d', 2, true), due('e', 0)],
      TODAY,
    );
    expect(ranked.map((i) => i.itemId)).toEqual(['c', 'd', 'b', 'a', 'e']);
  });

  it('loại mục chưa đến hạn và không đổi due_date gốc', () => {
    const input = [due('late', 2), { itemId: 'future', dueDate: addDays(TODAY, 1), isHard: true }];
    const ranked = rankDueItems(input, TODAY);
    expect(ranked.map((i) => i.itemId)).toEqual(['late']);
    expect(ranked[0]!.dueDate).toBe(addDays(TODAY, -2));
  });

  it('cùng mức ưu tiên thì theo itemId (tất định)', () => {
    const ranked = rankDueItems([due('b', 1), due('a', 1)], TODAY);
    expect(ranked.map((i) => i.itemId)).toEqual(['a', 'b']);
  });
});

describe('ước lượng thời gian ôn theo REVIEW_SECONDS_PER_ITEM', () => {
  it('ceil(n × giây / 60) và số mục tối đa cho quỹ', () => {
    expect(reviewMinutesFor(18, 30)).toBe(9);
    expect(reviewMinutesFor(19, 30)).toBe(10);
    expect(reviewMinutesFor(1, 30)).toBe(1);
    expect(maxReviewItems(18, 30)).toBe(36);
    expect(maxReviewItems(5, 45)).toBe(6);
  });

  it('đổi REVIEW_SECONDS_PER_ITEM đổi số mục vừa quỹ', () => {
    const items = ids(100);
    const slow = packReviewBatches(items, 6, 60).flatMap((b) => b.itemIds);
    const fast = packReviewBatches(items, 6, 20).flatMap((b) => b.itemIds);
    expect(slow).toHaveLength(6);
    expect(fast).toHaveLength(18);
  });
});

describe('packReviewBatches – chia gói (R7, Nguyên tắc I)', () => {
  it('B=30 với 100 mục đến hạn → quỹ ôn 18 phút → 2 gói 9 phút, tổng ≤ 30', () => {
    const result = planDailyPlan({
      budgetMinutes: 30,
      paused: false,
      newUnits: [],
      packReview: (m) => packReviewBatches(ids(100), m, SECONDS),
      previousKind: null,
    })!;
    // Không có bài mới → toàn bộ quỹ cho ôn; kiểm tra phần ôn của kế hoạch có bài mới ở dưới.
    expect(result.estimatedMinutes).toBeLessThanOrEqual(30);

    const mixed = planDailyPlan({
      budgetMinutes: 30,
      paused: false,
      newUnits,
      packReview: (m) => packReviewBatches(ids(100), m, SECONDS),
      previousKind: null,
    })!;
    const review = mixed.items.filter((i) => i.type === 'review_batch');
    expect(review.map((b) => b.estMinutes)).toEqual([9, 9]);
    expect(mixed.estimatedMinutes).toBeLessThanOrEqual(30);
    expect(review.reduce((s, b) => s + b.estMinutes, 0)).toBeLessThanOrEqual(18);
  });

  it('B=30 chỉ-ôn (không có bài mới) → 2 gói 15 phút', () => {
    const result = planDailyPlan({
      budgetMinutes: 30,
      paused: false,
      newUnits: [],
      packReview: (m) => packReviewBatches(ids(100), m, SECONDS),
      previousKind: null,
    })!;
    expect(result.items.map((i) => i.estMinutes)).toEqual([15, 15]);
    expect(result.kind).toBe('review_only');
  });

  it('mọi gói có estMinutes ∈ [1, 15] với mọi quỹ, số mục và cấu hình', () => {
    for (const seconds of [15, 20, 30, 40, 45, 60]) {
      for (const minutes of [1, 2, 3, 5, 6, 9, 10, 15, 18, 25, 30]) {
        for (const n of [0, 1, 7, 29, 61, 150]) {
          const batches = packReviewBatches(ids(n), minutes, seconds);
          const total = batches.reduce((s, b) => s + b.estMinutes, 0);
          expect(total).toBeLessThanOrEqual(minutes);
          for (const b of batches) {
            expect(b.itemIds.length).toBeGreaterThan(0);
            expect(b.estMinutes).toBeGreaterThanOrEqual(1);
            expect(b.estMinutes).toBeLessThanOrEqual(15);
            expect(b.estMinutes).toBe(reviewMinutesFor(b.itemIds.length, seconds));
          }
        }
      }
    }
  });

  it('giữ thứ tự ưu tiên: mục đầu danh sách vào gói, mục cuối bị bỏ lại', () => {
    const ranked = ids(100);
    const picked = packReviewBatches(ranked, 18, SECONDS).flatMap((b) => b.itemIds);
    expect(picked).toEqual(ranked.slice(0, 36));
  });

  it('danh sách ít mục: không tạo gói rỗng, một gói nhỏ', () => {
    const batches = packReviewBatches(ids(5), 18, SECONDS);
    expect(batches).toEqual([{ itemIds: ids(5), estMinutes: 3 }]);
    expect(packReviewBatches([], 18, SECONDS)).toEqual([]);
    expect(packReviewBatches(ids(5), 0, SECONDS)).toEqual([]);
  });

  it('loại mục trùng id', () => {
    const batches = packReviewBatches(['a', 'a', 'b'], 5, SECONDS);
    expect(batches.flatMap((b) => b.itemIds)).toEqual(['a', 'b']);
  });
});

describe('hồ sơ five-minute-backlog – B=5 nhiều bài ôn tồn đọng (SC-002)', () => {
  const profile = loadLearnerProfile('five-minute-backlog');
  const backlog = profile.reviewBacklog.flatMap((entry, g) =>
    ids(entry.count, `g${g}-`).map((id) => due(id, entry.daysOverdue, entry.isHard)),
  );
  const ranked = rankDueItems(backlog, profile.asOf);
  const rankedIds = ranked.map((i) => i.itemId);

  it('kế hoạch vẫn ≤ 5 phút, mục ≤ 5 phút; mục không vừa giữ nguyên due_date', () => {
    const result = planDailyPlan({
      budgetMinutes: 5,
      paused: false,
      newUnits: [{ unitId: 'u5', estMinutes: 5 }],
      packReview: (m) => packReviewBatches(rankedIds, m, SECONDS),
      previousKind: null,
    })!;
    expect(result.estimatedMinutes).toBeLessThanOrEqual(5);
    for (const item of result.items) expect(item.estMinutes).toBeLessThanOrEqual(5);

    const scheduled = new Set(
      result.items.flatMap((i) => (i.type === 'review_batch' ? i.itemIds : [])),
    );
    // Mục khó (quá hạn nhiều nhất) được chọn trước; phần còn lại không bị sửa due_date.
    expect(scheduled.size).toBeLessThan(backlog.length);
    for (const item of backlog.filter((b) => !scheduled.has(b.itemId))) {
      expect(item.dueDate <= profile.asOf).toBe(true);
    }
    expect([...scheduled].every((id) => id.startsWith('g1-'))).toBe(true);
  });

  it('luân phiên theo ngày liền trước (T036) vẫn đúng khi gói ôn lấy từ danh sách tồn đọng', () => {
    const base = {
      budgetMinutes: 5,
      paused: false,
      newUnits: [{ unitId: 'u5', estMinutes: 5 }],
      packReview: (m: number) => packReviewBatches(rankedIds, m, SECONDS),
    };
    const afterMixed = planDailyPlan({ ...base, previousKind: 'new_only' })!;
    expect(afterMixed.kind).toBe('review_only');
    const afterReviewOnly = planDailyPlan({ ...base, previousKind: 'review_only' })!;
    expect(afterReviewOnly.kind).toBe('new_only');
  });
});

describe('mục inactive không được chọn', () => {
  it('chỉ danh sách đã lọc (mục active còn bài tập) được xếp và chia gói', () => {
    // Việc loại mục `inactive` / không còn bài tập `active` nằm ở truy vấn `listDueReviewItems`
    // (kiểm thử tích hợp T075); engine chỉ nhận danh sách đã lọc và không tự thêm mục nào.
    const eligible = [due('active-1', 3), due('active-2', 1)];
    const batches = packReviewBatches(
      rankDueItems(eligible, TODAY).map((i) => i.itemId),
      9,
      SECONDS,
    );
    expect(batches.flatMap((b) => b.itemIds).sort()).toEqual(['active-1', 'active-2']);
  });
});
