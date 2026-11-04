import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/engine/clock.js';
import {
  absentDays,
  GAP_NOTICE,
  GAP_THRESHOLD_DAYS,
  hasLearningGap,
  maxReviewItems,
  packReviewBatches,
  planDailyPlan,
  rankDueItems,
  type DueReviewItem,
  type PausePeriod,
} from '../../src/engine/daily-plan.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';

// Kiểm thử đơn vị xử lý khoảng nghỉ (T088a, FR-015, research R7) trên hồ sơ "quay lại sau khoảng nghỉ":
// vắng ≥ 2 ngày (không tính ngày tạm dừng) → kế hoạch vẫn ≤ 60% quỹ cho ôn, mục quá hạn dư được dời dần
// qua các ngày sau mà vẫn giữ `due_date` gốc làm thứ tự ưu tiên, thông báo `replanned_after_gap`,
// và không có trường "nợ".

const SECONDS_PER_ITEM = 30;

const fixture = loadLearnerProfile('returning-after-gap');
const gap = fixture.expected.gap as { absentDays: number; notice: string; hasDebtField: boolean };
const planExpectation = fixture.expected.dailyPlan as {
  budgetMinutes: number;
  maxReviewMinutes: number;
  keepsOriginalDueDateForUnscheduled: boolean;
};

/** Dựng các mục ôn tồn đọng của hồ sơ: mỗi nhóm `count` mục quá hạn `daysOverdue` ngày. */
function backlogOf(): DueReviewItem[] {
  const items: DueReviewItem[] = [];
  fixture.reviewBacklog.forEach((group, g) => {
    for (let i = 0; i < group.count; i++) {
      items.push({
        itemId: `g${g}-${String(i).padStart(2, '0')}`,
        dueDate: addDays(fixture.asOf, -group.daysOverdue),
        isHard: group.isHard,
      });
    }
  });
  return items;
}

describe('phát hiện khoảng nghỉ', () => {
  it('hồ sơ "quay lại sau khoảng nghỉ": vắng 5 ngày → có khoảng nghỉ', () => {
    expect(fixture.lastActiveDate).toBe('2026-01-05');
    expect(absentDays(fixture.lastActiveDate, fixture.asOf, fixture.pausePeriods)).toBe(
      gap.absentDays,
    );
    expect(hasLearningGap(fixture.lastActiveDate, fixture.asOf, fixture.pausePeriods)).toBe(true);
    expect(gap.notice).toBe(GAP_NOTICE);
    expect(GAP_NOTICE).toBe('replanned_after_gap');
  });

  it(`ngưỡng là ${GAP_THRESHOLD_DAYS} ngày vắng: học hôm qua → chưa phải khoảng nghỉ`, () => {
    const today = '2026-01-10';
    expect(absentDays('2026-01-10', today, [])).toBe(0);
    expect(absentDays('2026-01-09', today, [])).toBe(1);
    expect(hasLearningGap('2026-01-09', today, [])).toBe(false);
    expect(absentDays('2026-01-08', today, [])).toBe(2);
    expect(hasLearningGap('2026-01-08', today, [])).toBe(true);
  });

  it('chưa từng học thì không có gì để bỏ lỡ', () => {
    expect(absentDays(null, '2026-01-10', [])).toBe(0);
    expect(hasLearningGap(null, '2026-01-10', [])).toBe(false);
  });

  it('không tính ngày thuộc giai đoạn tạm dừng', () => {
    // Học 05/01, tạm dừng 06/01 → tiếp tục 10/01 (nửa khoảng [06, 10)): chỉ ngày 10/01 tính là vắng.
    const paused: PausePeriod[] = [{ startedOn: '2026-01-06', endedOn: '2026-01-10' }];
    expect(absentDays('2026-01-05', '2026-01-10', paused)).toBe(1);
    expect(hasLearningGap('2026-01-05', '2026-01-10', paused)).toBe(false);

    // Tạm dừng ngắn hơn khoảng vắng: ngày ngoài giai đoạn vẫn được tính.
    const short: PausePeriod[] = [{ startedOn: '2026-01-06', endedOn: '2026-01-08' }];
    expect(absentDays('2026-01-05', '2026-01-10', short)).toBe(3);
    expect(hasLearningGap('2026-01-05', '2026-01-10', short)).toBe(true);
  });

  it('nhiều giai đoạn tạm dừng đều được loại trừ', () => {
    const periods: PausePeriod[] = [
      { startedOn: '2026-01-06', endedOn: '2026-01-07' },
      { startedOn: '2026-01-08', endedOn: '2026-01-09' },
    ];
    expect(absentDays('2026-01-05', '2026-01-10', periods)).toBe(3);
  });
});

describe('kế hoạch sau khoảng nghỉ (hồ sơ quay lại sau khoảng nghỉ)', () => {
  const B = planExpectation.budgetMinutes;
  const newUnits = [
    { unitId: 'u1', estMinutes: 5 },
    { unitId: 'u2', estMinutes: 5 },
  ];

  const planFor = (due: readonly DueReviewItem[], previousKind: null | 'mixed' = null) => {
    const ids = rankDueItems(due, fixture.asOf).map((i) => i.itemId);
    return planDailyPlan({
      budgetMinutes: B,
      paused: false,
      newUnits,
      packReview: (minutes) => packReviewBatches(ids, minutes, SECONDS_PER_ITEM),
      previousKind,
    });
  };

  it('tổng ôn ≤ 60% quỹ và tổng kế hoạch ≤ quỹ dù tồn đọng rất lớn', () => {
    const backlog = backlogOf();
    expect(backlog.length).toBeGreaterThan(maxReviewItems(B, SECONDS_PER_ITEM));

    const plan = planFor(backlog)!;
    const reviewMinutes = plan.items
      .filter((i) => i.type === 'review_batch')
      .reduce((sum, i) => sum + i.estMinutes, 0);
    expect(reviewMinutes).toBeLessThanOrEqual(planExpectation.maxReviewMinutes);
    expect(reviewMinutes).toBeLessThanOrEqual(Math.floor(0.6 * B));
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(B);
    for (const item of plan.items) expect(item.estMinutes).toBeLessThanOrEqual(15);
  });

  it('không có trường "nợ" trong kết quả kế hoạch', () => {
    const plan = planFor(backlogOf())!;
    expect(gap.hasDebtField).toBe(false);
    const keys = [...Object.keys(plan), ...plan.items.flatMap((i) => Object.keys(i))].map((k) =>
      k.toLowerCase(),
    );
    expect(keys.filter((k) => /debt|backlog|overdue|owed|nợ/.test(k))).toEqual([]);
  });

  it('mục quá hạn dư được dời dần qua các ngày sau, giữ nguyên due_date gốc làm thứ tự ưu tiên', () => {
    const backlog = backlogOf();
    const original = new Map(backlog.map((i) => [i.itemId, i.dueDate]));
    let remaining = [...backlog];
    const perDay: string[][] = [];

    // Mô phỏng nhiều ngày liên tiếp: mục đã vào gói ôn được ôn xong (rời hàng đợi), mục còn lại KHÔNG bị sửa.
    for (let day = 0; day < 10 && remaining.length > 0; day++) {
      const plan = planFor(remaining, day === 0 ? null : 'mixed')!;
      const reviewed = plan.items.flatMap((i) => (i.type === 'review_batch' ? i.itemIds : []));
      expect(reviewed.length).toBeGreaterThan(0);
      expect(reviewed.length).toBeLessThanOrEqual(
        maxReviewItems(planExpectation.maxReviewMinutes, 30),
      );
      perDay.push(reviewed);

      const done = new Set(reviewed);
      remaining = remaining.filter((i) => !done.has(i.itemId));
      // Giữ nguyên due_date gốc của mọi mục chưa được xếp.
      for (const item of remaining) expect(item.dueDate).toBe(original.get(item.itemId));
    }
    expect(planExpectation.keepsOriginalDueDateForUnscheduled).toBe(true);

    // Dời dần: backlog được xả hết qua nhiều ngày, mỗi mục chỉ được xếp một lần.
    expect(remaining).toHaveLength(0);
    expect(perDay.length).toBeGreaterThan(1);
    const flat = perDay.flat();
    expect(new Set(flat).size).toBe(backlog.length);

    // Thứ tự ưu tiên: mục khó trước hết; sau đó nhóm quá hạn lâu nhất (5 ngày) trước nhóm 3 ngày.
    const hardIds = backlog.filter((i) => i.isHard).map((i) => i.itemId);
    expect(new Set(perDay[0]!.slice(0, hardIds.length))).toEqual(new Set(hardIds));
    const rankOf = (id: string) => flat.indexOf(id);
    const fiveDays = backlog.filter((i) => i.dueDate === addDays(fixture.asOf, -5));
    const threeDays = backlog.filter((i) => i.dueDate === addDays(fixture.asOf, -3));
    expect(Math.max(...fiveDays.map((i) => rankOf(i.itemId)))).toBeLessThan(
      Math.min(...threeDays.map((i) => rankOf(i.itemId))),
    );
  });

  it('không ôn nào bị mất: mục không vừa quỹ hôm nay vẫn còn trong hàng đợi với due_date gốc', () => {
    const backlog = backlogOf();
    const plan = planFor(backlog)!;
    const scheduled = new Set(
      plan.items.flatMap((i) => (i.type === 'review_batch' ? i.itemIds : [])),
    );
    const unscheduled = backlog.filter((i) => !scheduled.has(i.itemId));
    expect(unscheduled.length).toBeGreaterThan(0);
    // `rankDueItems` không sửa due_date nên những mục này lại xuất hiện (cùng due_date) ở ngày sau.
    const ranked = rankDueItems(unscheduled, fixture.asOf);
    expect(ranked).toHaveLength(unscheduled.length);
    for (const item of ranked) {
      expect(item.dueDate).toBe(backlog.find((b) => b.itemId === item.itemId)!.dueDate);
    }
  });
});
