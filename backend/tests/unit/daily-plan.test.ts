import { describe, expect, it } from 'vitest';
import {
  planDailyPlan,
  type DailyPlanInput,
  type DailyPlanResult,
  type NewUnitCandidate,
  type PlanDayKind,
  type ReviewBatch,
  type ReviewPacker,
} from '../../src/engine/daily-plan.js';
import { loadLearnerProfile, loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';

// Kiểm thử engine kế hoạch ngày (T036, T041, research R7) – phần không gồm chọn/chia gói ôn (T078):
// danh sách gói ôn được truyền vào làm tham số.

/** Nguồn gói ôn giả: lấy lần lượt các gói còn vừa `minutes`, giữ thứ tự ưu tiên. */
function packerOf(batches: ReviewBatch[]): ReviewPacker {
  return (minutes) => {
    const out: ReviewBatch[] = [];
    let used = 0;
    for (const b of batches) {
      if (used + b.estMinutes <= minutes) {
        out.push(b);
        used += b.estMinutes;
      }
    }
    return out;
  };
}

const noReview: ReviewPacker = () => [];

function batch(estMinutes: number, tag = 'r'): ReviewBatch {
  return { itemIds: [`${tag}-${estMinutes}-a`, `${tag}-${estMinutes}-b`], estMinutes };
}

function units(...minutes: number[]): NewUnitCandidate[] {
  return minutes.map((estMinutes, i) => ({ unitId: `unit-${i + 1}`, estMinutes }));
}

function plan(over: Partial<DailyPlanInput> & Pick<DailyPlanInput, 'budgetMinutes'>) {
  return planDailyPlan({
    paused: false,
    newUnits: units(5, 5, 5, 10, 15),
    packReview: noReview,
    previousKind: null,
    ...over,
  });
}

const minutesOf = (items: { type: string; estMinutes: number }[], type: string): number =>
  items.filter((i) => i.type === type).reduce((s, i) => s + i.estMinutes, 0);

describe('planDailyPlan – quỹ thời gian (FR-012, SC-002)', () => {
  it.each([5, 10, 15, 30])('B=%i: tổng ước tính không vượt quỹ, mọi mục 1–15 phút', (B) => {
    const result = plan({
      budgetMinutes: B,
      packReview: packerOf([batch(9), batch(9), batch(7), batch(15)]),
    })!;
    expect(result.estimatedMinutes).toBeLessThanOrEqual(B);
    for (const item of result.items) {
      expect(item.estMinutes).toBeGreaterThanOrEqual(1);
      expect(item.estMinutes).toBeLessThanOrEqual(15);
    }
  });

  it('B=5 chỉ chứa mục ≤ 5 phút (bỏ qua đơn vị 10/15 phút)', () => {
    const result = plan({ budgetMinutes: 5, newUnits: units(10, 15, 5) })!;
    expect(result.items).toEqual([{ type: 'new_unit', unitId: 'unit-3', estMinutes: 5 }]);
  });

  it('đơn vị mới được chọn lần lượt theo thứ tự ưu tiên và vừa quỹ', () => {
    const result = plan({ budgetMinutes: 10, newUnits: units(5, 5, 5) })!;
    expect(result.items.map((i) => (i.type === 'new_unit' ? i.unitId : ''))).toEqual([
      'unit-1',
      'unit-2',
    ]);
    expect(result.estimatedMinutes).toBe(10);
  });

  it('đơn vị lớn đứng trước nhưng không vừa thì bỏ qua để dùng đơn vị nhỏ phía sau', () => {
    const result = plan({ budgetMinutes: 10, newUnits: units(15, 5, 5) })!;
    expect(result.items.map((i) => i.estMinutes)).toEqual([5, 5]);
  });
});

describe('planDailyPlan – chia quỹ giữa ôn và bài mới', () => {
  it('danh sách ôn rỗng → toàn bộ quỹ cho bài mới', () => {
    const result = plan({ budgetMinutes: 30, newUnits: units(15, 15, 5) })!;
    expect(minutesOf(result.items, 'review_batch')).toBe(0);
    expect(result.estimatedMinutes).toBe(30);
    expect(result.kind).toBe('new_only');
  });

  it('có danh sách ôn → phần ôn ≤ 60% B và phần còn lại cho bài mới', () => {
    const result = plan({
      budgetMinutes: 30,
      packReview: packerOf([batch(9), batch(9), batch(9)]),
      newUnits: units(5, 5, 10, 15),
    })!;
    expect(minutesOf(result.items, 'review_batch')).toBe(18);
    expect(minutesOf(result.items, 'new_unit')).toBeLessThanOrEqual(12);
    expect(result.estimatedMinutes).toBeLessThanOrEqual(30);
    expect(result.kind).toBe('mixed');
  });

  it('ôn đứng trước bài mới trong danh sách mục', () => {
    const result = plan({ budgetMinutes: 30, packReview: packerOf([batch(9)]) })!;
    expect(result.items[0]!.type).toBe('review_batch');
    expect(result.items.at(-1)!.type).toBe('new_unit');
  });

  it('engine chặn nguồn ôn trả thừa: không vượt 60% B', () => {
    const greedy: ReviewPacker = () => [batch(15), batch(15), batch(15)];
    const result = plan({ budgetMinutes: 30, packReview: greedy })!;
    expect(minutesOf(result.items, 'review_batch')).toBeLessThanOrEqual(18);
    expect(result.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('không có bài mới phù hợp → toàn bộ quỹ cho ôn', () => {
    const result = plan({
      budgetMinutes: 30,
      newUnits: [],
      packReview: packerOf([batch(15), batch(15)]),
    })!;
    expect(minutesOf(result.items, 'review_batch')).toBe(30);
    expect(result.kind).toBe('review_only');
  });

  it('bài mới có nhưng không vừa quỹ (B=5, chỉ có đơn vị 10/15 phút) → toàn bộ quỹ cho ôn', () => {
    const result = plan({
      budgetMinutes: 5,
      newUnits: units(10, 15),
      packReview: packerOf([batch(5)]),
    })!;
    expect(result.kind).toBe('review_only');
    expect(result.estimatedMinutes).toBe(5);
  });

  it('không có gì để học → kế hoạch rỗng', () => {
    const result = plan({ budgetMinutes: 10, newUnits: [] })!;
    expect(result.items).toEqual([]);
    expect(result.kind).toBe('empty');
    expect(result.estimatedMinutes).toBe(0);
  });
});

describe('planDailyPlan – luân phiên khi phần dư < 5 phút', () => {
  // B=5: 60% = 3 phút ôn, phần dư 2 phút không đủ cho đơn vị mới nhỏ nhất (5 phút).
  const backlog = packerOf([batch(3), batch(5), batch(2)]);

  it('ngày liền trước không phải chỉ-ôn → ưu tiên ôn (chỉ-ôn, ≤ 5 phút)', () => {
    for (const previousKind of [null, 'mixed', 'new_only', 'empty'] as (PlanDayKind | null)[]) {
      const result = plan({ budgetMinutes: 5, packReview: backlog, previousKind })!;
      expect(result.kind).toBe('review_only');
      expect(result.estimatedMinutes).toBeLessThanOrEqual(5);
    }
  });

  it('sau ngày chỉ-ôn → ưu tiên bài mới', () => {
    const result = plan({ budgetMinutes: 5, packReview: backlog, previousKind: 'review_only' })!;
    expect(result.kind).toBe('new_only');
    expect(result.items).toEqual([{ type: 'new_unit', unitId: 'unit-1', estMinutes: 5 }]);
  });

  it('luân phiên qua nhiều ngày liên tiếp: ôn → mới → ôn → mới', () => {
    let previous: PlanDayKind | null = null;
    const kinds: PlanDayKind[] = [];
    for (let day = 0; day < 4; day++) {
      const result: DailyPlanResult = plan({
        budgetMinutes: 5,
        packReview: backlog,
        previousKind: previous,
      })!;
      kinds.push(result.kind);
      previous = result.kind;
    }
    expect(kinds).toEqual(['review_only', 'new_only', 'review_only', 'new_only']);
  });

  it('quy tắc áp dụng cho mọi B: B=10 với phần ôn 6 phút → dư 4 < 5 nên luân phiên', () => {
    const result = plan({
      budgetMinutes: 10,
      packReview: packerOf([batch(6), batch(4)]),
      previousKind: 'review_only',
    })!;
    expect(result.kind).toBe('new_only');
    expect(result.estimatedMinutes).toBeLessThanOrEqual(10);
  });

  it('B=10 mà bài ôn đến hạn ít (4 phút) → dư 6 ≥ 5 nên vẫn gộp ôn + bài mới', () => {
    const result = plan({ budgetMinutes: 10, packReview: packerOf([batch(4)]) })!;
    expect(result.kind).toBe('mixed');
    expect(result.estimatedMinutes).toBe(9);
  });
});

describe('planDailyPlan – tạm dừng', () => {
  it('paused → không sinh kế hoạch', () => {
    expect(plan({ budgetMinutes: 30, paused: true })).toBeNull();
  });
});

describe('planDailyPlan – hồ sơ đại diện', () => {
  it('người mới 10 phút/ngày không có bài ôn: toàn bộ quỹ cho bài mới, ≤ 10 phút', () => {
    const f = loadLearnerProfile('newcomer-10min');
    const expected = f.expected.dailyPlan!;
    const result = plan({
      budgetMinutes: f.profile.dailyMinutes,
      newUnits: units(5, 5, 5, 10),
    })!;
    expect(result.estimatedMinutes).toBeLessThanOrEqual(expected.budgetMinutes as number);
    expect(minutesOf(result.items, 'review_batch')).toBe(0);
    expect(expected.allMinutesForNewUnits).toBe(true);
    expect(result.estimatedMinutes).toBe(10);
  });

  it('N3 / 30 phút có tồn đọng ôn: phần ôn ≤ 18, mỗi mục ≤ 15, vẫn có bài mới', () => {
    const f = loadLearnerProfile('n3-30min');
    const expected = f.expected.dailyPlan!;
    const result = plan({
      budgetMinutes: f.profile.dailyMinutes,
      packReview: packerOf([batch(9), batch(9), batch(9)]),
      newUnits: units(10, 15),
    })!;
    expect(minutesOf(result.items, 'review_batch')).toBeLessThanOrEqual(
      expected.maxReviewMinutes as number,
    );
    expect(Math.max(...result.items.map((i) => i.estMinutes))).toBeLessThanOrEqual(
      expected.maxItemMinutes as number,
    );
    expect(result.items.some((i) => i.type === 'new_unit')).toBe(expected.hasNewUnit);
  });

  it('5 phút với nhiều bài ôn tồn đọng: ≤ 5 phút, luân phiên sau ngày chỉ-ôn', () => {
    const f = loadLearnerProfile('five-minute-backlog');
    const expected = f.expected.dailyPlan!;
    const backlog = packerOf([batch(5), batch(5), batch(5)]);
    const reviewDay = plan({ budgetMinutes: f.profile.dailyMinutes, packReview: backlog })!;
    expect(reviewDay.estimatedMinutes).toBeLessThanOrEqual(expected.maxTotalMinutes as number);
    expect(reviewDay.kind).toBe('review_only');

    const nextDay = plan({
      budgetMinutes: f.profile.dailyMinutes,
      packReview: backlog,
      previousKind: reviewDay.kind,
    })!;
    expect(expected.alternation).toBe('after-review-only-day-prefer-new-unit');
    expect(nextDay.kind).toBe('new_only');
    expect(Math.max(...nextDay.items.map((i) => i.estMinutes))).toBeLessThanOrEqual(
      expected.maxItemMinutes as number,
    );
  });

  it('mọi hồ sơ đại diện: tổng ước tính không bao giờ vượt quỹ', () => {
    for (const f of loadLearnerProfiles()) {
      const result = planDailyPlan({
        budgetMinutes: f.profile.dailyMinutes,
        paused: f.profile.paused,
        newUnits: units(5, 10, 15, 5),
        packReview: packerOf([batch(15), batch(15), batch(9)]),
        previousKind: null,
      });
      if (result) expect(result.estimatedMinutes).toBeLessThanOrEqual(f.profile.dailyMinutes);
    }
  });
});
