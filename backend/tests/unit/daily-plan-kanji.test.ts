import { describe, expect, it } from 'vitest';
import {
  applyKanjiSlot,
  type KanjiSlotInput,
  type NewUnitCandidate,
} from '../../src/engine/daily-plan.js';
import { DAILY_MINUTES } from '../../src/domain/types.js';
import {
  KANJI_PROFILE_IDS,
  loadKanjiProfile,
  loadKanjiProfiles,
  type LearnerProfileFixture,
} from '../fixtures/learner-profiles/index.js';
import {
  loadSimCatalog,
  simulatePlans,
  type CandidateTransform,
  type SimHistory,
} from '../fixtures/golden/simulate-plans.js';

// Kế hoạch ngày với Kanji (T041, research K5): `applyKanjiSlot` và mô phỏng 14 ngày trên hồ sơ Kanji.

const cand = (
  unitId: string,
  kind: NewUnitCandidate['kind'],
  estMinutes = 5,
): NewUnitCandidate => ({ unitId, kind, estMinutes });
const SKILLS_ALL = ['vocabulary', 'grammar', 'kanji'] as const;
const slot = (over: Partial<KanjiSlotInput> = {}): KanjiSlotInput => ({
  skills: SKILLS_ALL,
  prioritizedSkill: null,
  lastNewUnitPlanHadKanji: false,
  ...over,
});
const ids = (list: readonly NewUnitCandidate[]) => list.map((c) => c.unitId);

describe('applyKanjiSlot – hàm thuần', () => {
  const ranked = [
    cand('v1', 'vocabulary'),
    cand('g1', 'grammar'),
    cand('k1', 'kanji'),
    cand('k2', 'kanji'),
  ];

  it('no-op khi kanji ∉ skills (FR-009)', () => {
    expect(ids(applyKanjiSlot(ranked, slot({ skills: ['vocabulary', 'grammar'] })))).toEqual(
      ids(ranked),
    );
  });

  it('no-op khi không có ứng viên Kanji', () => {
    const noKanji = ranked.filter((c) => c.kind !== 'kanji');
    expect(ids(applyKanjiSlot(noKanji, slot()))).toEqual(ids(noKanji));
  });

  it('đưa ứng viên Kanji đầu tiên lên vị trí 0 khi kế hoạch gần nhất có bài mới không chứa Kanji; phần còn lại giữ thứ tự', () => {
    expect(ids(applyKanjiSlot(ranked, slot()))).toEqual(['k1', 'v1', 'g1', 'k2']);
  });

  it('chưa có kế hoạch nào có bài mới (null) → Kanji đứng đầu ngay ngày đầu', () => {
    expect(ids(applyKanjiSlot(ranked, slot({ lastNewUnitPlanHadKanji: null })))).toEqual([
      'k1',
      'v1',
      'g1',
      'k2',
    ]);
  });

  it('kế hoạch gần nhất đã có Kanji và không ưu tiên → giữ nguyên', () => {
    expect(ids(applyKanjiSlot(ranked, slot({ lastNewUnitPlanHadKanji: true })))).toEqual(
      ids(ranked),
    );
  });

  it('ưu tiên Kanji → luôn đưa Kanji lên đầu dù kế hoạch gần nhất đã có Kanji', () => {
    const input = slot({ prioritizedSkill: 'kanji', lastNewUnitPlanHadKanji: true });
    expect(ids(applyKanjiSlot(ranked, input))).toEqual(['k1', 'v1', 'g1', 'k2']);
  });

  it('Kanji đã ở đầu danh sách → giữ nguyên; không sửa danh sách đầu vào', () => {
    const already = [cand('k1', 'kanji'), cand('v1', 'vocabulary')];
    expect(ids(applyKanjiSlot(already, slot()))).toEqual(['k1', 'v1']);
    const copy = [...ranked];
    applyKanjiSlot(ranked, slot());
    expect(ranked).toEqual(copy);
  });

  it('chỉ chọn ứng viên Kanji vừa quỹ thời gian khi biết quỹ', () => {
    const list = [cand('v1', 'vocabulary'), cand('k10', 'kanji', 10), cand('k5', 'kanji', 5)];
    expect(ids(applyKanjiSlot(list, slot({ budgetMinutes: 5 })))).toEqual(['k5', 'v1', 'k10']);
    expect(ids(applyKanjiSlot(list, slot({ budgetMinutes: 10 })))).toEqual(['k10', 'v1', 'k5']);
    const tooLong = [cand('v1', 'vocabulary'), cand('k15', 'kanji', 15)];
    expect(ids(applyKanjiSlot(tooLong, slot({ budgetMinutes: 5 })))).toEqual(['v1', 'k15']);
  });
});

// --- Mô phỏng 14 ngày trên hồ sơ Kanji ---

const catalog = loadSimCatalog(true);

/** Cách dịch vụ áp suất Kanji (cùng cách dùng ở `services/daily-plan.ts`), có truyền quỹ thời gian. */
const kanjiSlotFor =
  (budgetMinutes: number): CandidateTransform =>
  (candidates, ctx) => {
    const withKind = candidates.map((c) => ({ ...c, kind: ctx.units.get(c.unitId)?.kind }));
    const last = ctx.previousNewUnitDayKinds.at(-1);
    return applyKanjiSlot(withKind, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanHadKanji: last === undefined ? null : last.includes('kanji'),
      budgetMinutes,
    }).map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
  };

const withBudget = (f: LearnerProfileFixture, dailyMinutes: number): LearnerProfileFixture => ({
  ...f,
  profile: {
    ...f.profile,
    dailyMinutes: dailyMinutes as LearnerProfileFixture['profile']['dailyMinutes'],
  },
});
const simulate = (f: LearnerProfileFixture): SimHistory =>
  simulatePlans(f, { catalog, transform: kanjiSlotFor(f.profile.dailyMinutes) });

const kindOfUnit = (unitId: string) => catalog.find((u) => u.id === unitId)?.kind;
type Day = NonNullable<SimHistory[number]>;
const newUnits = (day: Day) => day.items.flatMap((i) => (i.type === 'new_unit' ? [i] : []));
const newUnitDays = (history: SimHistory): Day[] =>
  history.flatMap((d) => (d && newUnits(d).length > 0 ? [d] : []));
const hasKanji = (day: Day) => newUnits(day).some((u) => kindOfUnit(u.unitId) === 'kanji');

describe('hồ sơ Kanji × {5,10,15,30} phút × 14 ngày (SC-001, SC-002, FR-008, FR-012)', () => {
  it('đủ bảy hồ sơ Kanji bắt buộc', () => {
    expect(loadKanjiProfiles().map((p) => p.id)).toEqual([...KANJI_PROFILE_IDS].sort());
  });

  const cases = loadKanjiProfiles().flatMap((f) => DAILY_MINUTES.map((b) => [f.id, b] as const));

  it.each(cases)('%s @ %i phút: tổng ≤ quỹ, mỗi mục 1–15 phút', (id, budget) => {
    const history = simulate(withBudget(loadKanjiProfile(id), budget));
    for (const day of history) {
      if (!day) continue;
      expect(day.estimatedMinutes).toBeLessThanOrEqual(budget);
      for (const item of day.items) {
        expect(item.estMinutes).toBeGreaterThanOrEqual(1);
        expect(item.estMinutes).toBeLessThanOrEqual(15);
      }
    }
  });

  const chosen = cases.filter(([id]) => id !== 'kanji-removed' && id !== 'kanji-exhausted-n5');
  it.each(chosen)('%s @ %i phút: ngày đầu có bài mới thì chứa bài Kanji', (id, budget) => {
    const history = simulate(withBudget(loadKanjiProfile(id), budget));
    const first = newUnitDays(history)[0];
    expect(first, 'phải có ngày có bài mới').toBeDefined();
    expect(hasKanji(first!)).toBe(true);
  });

  it('5 phút (trường hợp biên): Kanji xuất hiện nhưng không chiếm mọi ngày có bài mới khi không ưu tiên', () => {
    const history = simulate(loadKanjiProfile('kanji-newcomer-5min'));
    const days = newUnitDays(history);
    const withKanji = days.filter(hasKanji).length;
    expect(withKanji).toBeGreaterThanOrEqual(1);
    expect(withKanji).toBeLessThan(days.length);
  });

  it('không ưu tiên: sau một ngày có bài mới thiếu Kanji thì ngày có bài mới kế tiếp có Kanji (khi còn bài Kanji vừa quỹ)', () => {
    const f = loadKanjiProfile('kanji-newcomer-10min');
    const days = newUnitDays(simulate(f));
    const used = new Set<string>();
    for (const [i, day] of days.entries()) {
      for (const u of newUnits(day)) if (kindOfUnit(u.unitId) === 'kanji') used.add(u.unitId);
      const remaining = catalog.filter(
        (u) =>
          u.kind === 'kanji' &&
          u.level === 'N5' &&
          !used.has(u.id) &&
          u.estMinutes <= f.profile.dailyMinutes,
      );
      const next = days[i + 1];
      if (!hasKanji(day) && next && remaining.length > 0) expect(hasKanji(next)).toBe(true);
    }
  });

  it('ưu tiên Kanji: tỷ trọng Kanji trong phần bài mới lớn hơn cùng hồ sơ không ưu tiên (US2.5)', () => {
    const prioritized = loadKanjiProfile('kanji-prioritized-30min');
    const plain = { ...prioritized, profile: { ...prioritized.profile, prioritizedSkill: null } };
    // Cả hai hồ sơ cuối cùng đều học hết thư viện trong 14 ngày; ưu tiên thể hiện ở những ngày đầu.
    const share = (history: SimHistory) => {
      const all = history.slice(0, 3).flatMap((d) => (d ? newUnits(d) : []));
      const kanji = all
        .filter((u) => kindOfUnit(u.unitId) === 'kanji')
        .reduce((s, u) => s + u.estMinutes, 0);
      const total = all.reduce((s, u) => s + u.estMinutes, 0);
      return total === 0 ? 0 : kanji / total;
    };
    expect(share(simulate(prioritized))).toBeGreaterThan(share(simulate(plain)));
  });

  it('kanji-removed: không có bài Kanji mới nhưng cặp Kanji đến hạn vẫn vào gói ôn', () => {
    const history = simulate(loadKanjiProfile('kanji-removed'));
    for (const day of history) {
      if (day) expect(hasKanji(day)).toBe(false);
    }
    const reviewKeys = history.flatMap((d) =>
      (d?.items ?? []).flatMap((i) => (i.type === 'review_batch' ? i.itemIds : [])),
    );
    expect(reviewKeys.some((k) => /:(meaning|reading|word)$/.test(k))).toBe(true);
  });

  it('kanji-exhausted-n5: hết bài Kanji N5 → không có bài Kanji mới nhưng kế hoạch không trống', () => {
    const history = simulate(loadKanjiProfile('kanji-exhausted-n5'));
    expect(history[0]).not.toBeNull();
    expect(history[0]!.items.length).toBeGreaterThan(0);
    for (const day of history) {
      if (day) expect(hasKanji(day)).toBe(false);
    }
  });

  it('kanji-added-later giữ nguyên tồn đọng ôn của từ vựng/ngữ pháp và vẫn có bài Kanji', () => {
    const history = simulate(loadKanjiProfile('kanji-added-later'));
    expect(history[0]!.items.some((i) => i.type === 'review_batch')).toBe(true);
    expect(newUnitDays(history).some(hasKanji)).toBe(true);
  });
});
