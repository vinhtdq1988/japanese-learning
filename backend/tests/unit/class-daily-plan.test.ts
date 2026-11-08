import { describe, expect, it } from 'vitest';
import { encodeReviewKey } from '../../src/domain/review-key.js';
import { classPathParams, rankClassUnits } from '../../src/engine/class-path.js';
import { addDays } from '../../src/engine/clock.js';
import {
  hasLearningGap,
  packReviewBatches,
  planDailyPlan,
  rankDueItems,
  type DueReviewItem,
  type PlanDayKind,
} from '../../src/engine/daily-plan.js';
import { upcomingUnits, type UnitProgressStatus } from '../../src/engine/path.js';
import { loadSimCatalog } from '../fixtures/golden/simulate-plans.js';
import {
  CLASS_PROFILE_IDS,
  loadClassProfile,
  type ClassProfileFixture,
} from '../fixtures/learner-profiles/class-index.js';

// Kế hoạch hằng ngày của học viên trong lớp (spec 004, T062, SC-003, FR-019): qua `rankClassUnits` +
// `planDailyPlan`, tổng thời lượng ≤ quỹ phút, không mục nào > 15 phút, ôn đến hạn vẫn được chèn, sau vắng
// ≥ 2 ngày kế hoạch cân đối (không dồn khối lượng bù).

const catalog = loadSimCatalog(true);
const MINUTES = [5, 10, 15, 30] as const;
const MAX_ITEM_MINUTES = 15;

function backlogOf(f: ClassProfileFixture): DueReviewItem[] {
  return f.reviewBacklog.flatMap((g, gi) =>
    Array.from({ length: g.count }, (_, i) => ({
      itemId: encodeReviewKey(`b${gi}-${String(i).padStart(3, '0')}`, g.facet ?? 'item'),
      dueDate: addDays(f.asOf, -g.daysOverdue),
      isHard: g.isHard,
    })),
  );
}

/** Kế hoạch của một ngày cho hồ sơ lớp ở mức `minutes` phút/ngày. */
function planFor(f: ClassProfileFixture, minutes: number, extraProgress: string[] = []) {
  const progress = new Map<string, UnitProgressStatus>(
    [...(f.completedUnitSlugs ?? []), ...extraProgress].map((s) => [s, 'completed' as const]),
  );
  const { ranked } = rankClassUnits({
    template: { ...f.class, dailyMinutes: minutes },
    units: catalog,
    unitProgress: progress,
    topicStats: [],
    exemptions: new Set(f.class.exemptions),
  });
  const rankedIds = rankDueItems(backlogOf(f), f.asOf).map((i) => i.itemId);
  const result = planDailyPlan({
    budgetMinutes: minutes,
    paused: false,
    newUnits: upcomingUnits(ranked).map((u) => ({ unitId: u.id, estMinutes: u.estMinutes })),
    packReview: (m) => packReviewBatches(rankedIds, m, 30),
    previousKind: null as PlanDayKind | null,
  });
  return { result, ranked };
}

describe.each(CLASS_PROFILE_IDS.map((id) => [id] as const))('hồ sơ lớp %s', (id) => {
  const fixture = loadClassProfile(id);

  it.each(MINUTES.map((m) => [m] as const))(
    'ở %i phút/ngày: tổng ≤ quỹ, không mục nào > 15 phút',
    (minutes) => {
      const { result } = planFor(fixture, minutes);
      expect(result).not.toBeNull();
      expect(result!.estimatedMinutes).toBeLessThanOrEqual(minutes);
      for (const item of result!.items) {
        expect(item.estMinutes).toBeLessThanOrEqual(MAX_ITEM_MINUTES);
        expect(item.estMinutes).toBeGreaterThan(0);
      }
      const sum = result!.items.reduce((s, i) => s + i.estMinutes, 0);
      expect(sum).toBeLessThanOrEqual(minutes);
    },
  );

  it('tham số lộ trình lớp khớp mong đợi của hồ sơ (nếu có)', () => {
    const expected = (fixture.expected as { classPath?: Record<string, unknown> }).classPath;
    if (!expected) return;
    const p = classPathParams(fixture.class);
    if ('startLevel' in expected) expect(p.startLevel).toBe(expected.startLevel);
    if ('foundationFirst' in expected) expect(p.foundationFirst).toBe(expected.foundationFirst);
    if ('scopeNotice' in expected) expect(p.scopeNotice).toBe(expected.scopeNotice);
  });
});

describe('ôn tập và khoảng nghỉ trong lớp', () => {
  it('ôn đến hạn vẫn được chèn: ngày hỗn hợp ôn ≤ 60% quỹ, hoặc ngày chỉ-ôn dùng trọn quỹ (SRS giữ nguyên trong lớp)', () => {
    const f = loadClassProfile('class-absent-many-days');
    const { result } = planFor(f, 10);
    const review = result!.items.filter((i) => i.type === 'review_batch');
    expect(review.length).toBeGreaterThan(0);
    const reviewMinutes = review.reduce((s, i) => s + i.estMinutes, 0);
    if (result!.kind === 'review_only') {
      expect(reviewMinutes).toBeLessThanOrEqual(10);
    } else {
      expect(reviewMinutes).toBeLessThanOrEqual(Math.floor(0.6 * 10));
    }
  });

  it('sau vắng ≥ 2 ngày: nhận ra khoảng nghỉ và kế hoạch vẫn cân đối, không dồn bù', () => {
    const f = loadClassProfile('class-absent-many-days');
    expect(hasLearningGap(f.lastActiveDate, f.asOf, f.class.classPauses)).toBe(true);
    const totalBacklog = f.reviewBacklog.reduce((n, g) => n + g.count, 0);
    for (const minutes of MINUTES) {
      const { result } = planFor(f, minutes);
      // Gói ôn bị chặn theo quỹ phút (30 giây/câu); phần dư giữ nguyên hạn gốc cho các ngày sau.
      expect(result!.estimatedMinutes).toBeLessThanOrEqual(minutes);
      const packed = result!.items
        .filter((i) => i.type === 'review_batch')
        .flatMap((i) => (i.type === 'review_batch' ? i.itemIds : []));
      expect(packed.length).toBeLessThanOrEqual((minutes * 60) / 30);
      if (minutes <= 10) expect(packed.length).toBeLessThan(totalBacklog);
    }
  });

  it('lớp tạm dừng: ngày thuộc khoảng tạm dừng không có kế hoạch, sau đó có', () => {
    const f = loadClassProfile('class-paused-whole-class');
    const [pause] = f.class.classPauses;
    expect(pause).toBeDefined();
    const inPause = planDailyPlan({
      budgetMinutes: 10,
      paused: true,
      newUnits: [],
      packReview: () => [],
      previousKind: null,
    });
    expect(inPause).toBeNull();
    const after = planFor(f, 10).result;
    expect(after).not.toBeNull();
  });

  it('đơn vị đã hoàn thành trước khi vào lớp không xuất hiện trong kế hoạch', () => {
    const f = loadClassProfile('class-midway-personal-progress');
    const { result } = planFor(f, 15);
    const units = result!.items.flatMap((i) => (i.type === 'new_unit' ? [i.unitId] : []));
    for (const done of f.completedUnitSlugs ?? []) expect(units).not.toContain(done);
  });

  it('đơn vị được miễn không xuất hiện trong kế hoạch', () => {
    const f = loadClassProfile('class-exempt-unit');
    for (const minutes of MINUTES) {
      const { result } = planFor(f, minutes);
      const units = result!.items.flatMap((i) => (i.type === 'new_unit' ? [i.unitId] : []));
      for (const ex of f.class.exemptions) expect(units).not.toContain(ex);
    }
  });
});
