import { describe, expect, it } from 'vitest';
import {
  applyKanjiSlot,
  applyPracticeSlot,
  MAX_REVIEW_SHARE,
  PRACTICE_EVERY_N_PLANS,
  type NewUnitCandidate,
  type PracticeSlotInput,
} from '../../src/engine/daily-plan.js';
import { DAILY_MINUTES } from '../../src/domain/types.js';
import {
  loadLearnerProfile,
  loadLearnerProfiles,
  loadPracticeProfiles,
  type LearnerProfileFixture,
} from '../fixtures/learner-profiles/index.js';
import {
  loadSimCatalog,
  simulatePlans,
  type CandidateTransform,
  type SimHistory,
} from '../fixtures/golden/simulate-plans.js';

// Kế hoạch ngày với luyện đọc/viết (T043, data-model §3.2): `applyPracticeSlot` và mô phỏng 14 ngày.

const cand = (
  unitId: string,
  kind: NewUnitCandidate['kind'],
  estMinutes = 5,
): NewUnitCandidate => ({ unitId, kind, estMinutes });
const ALL = ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'] as const;
const slot = (over: Partial<PracticeSlotInput> = {}): PracticeSlotInput => ({
  skills: ALL,
  prioritizedSkill: null,
  lastNewUnitPlanKinds: ['vocabulary'],
  budgetMinutes: 30,
  ...over,
});
const ids = (list: readonly NewUnitCandidate[]) => list.map((c) => c.unitId);

describe('applyPracticeSlot – hàm thuần', () => {
  const ranked = [
    cand('v1', 'vocabulary'),
    cand('g1', 'grammar'),
    cand('r1', 'reading'),
    cand('w1', 'writing'),
    cand('r2', 'reading', 10),
  ];

  it('chu kỳ luyện là 2 kế hoạch có bài mới', () => {
    expect(PRACTICE_EVERY_N_PLANS).toBe(2);
  });

  it('no-op khi skills không chứa reading/writing (I2)', () => {
    const input = slot({ skills: ['vocabulary', 'grammar', 'kanji'] });
    expect(ids(applyPracticeSlot(ranked, input))).toEqual(ids(ranked));
  });

  it('no-op khi không có ứng viên luyện nào', () => {
    const none = ranked.filter((c) => c.kind !== 'reading' && c.kind !== 'writing');
    expect(ids(applyPracticeSlot(none, slot()))).toEqual(ids(none));
  });

  it('no-op khi mọi ứng viên luyện đều dài hơn quỹ', () => {
    const list = [cand('v1', 'vocabulary'), cand('r10', 'reading', 10), cand('w15', 'writing', 15)];
    expect(ids(applyPracticeSlot(list, slot({ budgetMinutes: 5 })))).toEqual(ids(list));
  });

  it('ngày đầu (lastNewUnitPlanKinds = null) đưa ứng viên luyện lên vị trí 0, bắt đầu bằng reading', () => {
    expect(ids(applyPracticeSlot(ranked, slot({ lastNewUnitPlanKinds: null })))).toEqual([
      'r1',
      'v1',
      'g1',
      'w1',
      'r2',
    ]);
  });

  it('đưa lên khi kế hoạch có bài mới gần nhất KHÔNG chứa luyện; phần còn lại giữ thứ tự', () => {
    const out = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['vocabulary', 'grammar'] }),
    );
    expect(ids(out)).toEqual(['r1', 'v1', 'g1', 'w1', 'r2']);
  });

  it('kế hoạch gần nhất đã có luyện và không ưu tiên → giữ nguyên', () => {
    const out = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['vocabulary', 'reading'] }),
    );
    expect(ids(out)).toEqual(ids(ranked));
  });

  it('luân phiên: lần luyện gần nhất là reading thì lần này là writing, và ngược lại', () => {
    const afterReading = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['grammar'], lastPracticeKind: 'reading' }),
    );
    expect(afterReading[0]!.kind).toBe('writing');
    const afterWriting = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['grammar'], lastPracticeKind: 'writing' }),
    );
    expect(afterWriting[0]!.kind).toBe('reading');
  });

  it('không có lastPracticeKind thì suy từ kế hoạch gần nhất khi ưu tiên luyện', () => {
    const forced = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['writing', 'vocabulary'], prioritizedSkill: 'reading' }),
    );
    expect(forced[0]!.kind).toBe('reading');
    const forcedAfterReading = applyPracticeSlot(
      ranked,
      slot({ lastNewUnitPlanKinds: ['reading'], prioritizedSkill: 'writing' }),
    );
    expect(forcedAfterReading[0]!.kind).toBe('writing');
  });

  it('hết loại đối lập thì lấy loại còn lại', () => {
    const onlyReading = [cand('v1', 'vocabulary'), cand('r1', 'reading')];
    const out = applyPracticeSlot(
      onlyReading,
      slot({ lastNewUnitPlanKinds: ['reading'], prioritizedSkill: 'reading' }),
    );
    expect(ids(out)).toEqual(['r1', 'v1']);
  });

  it('prioritizedSkill ∈ {reading, writing} → lên mỗi ngày dù kế hoạch gần nhất đã có luyện', () => {
    const out = applyPracticeSlot(
      ranked,
      slot({ prioritizedSkill: 'writing', lastNewUnitPlanKinds: ['reading'] }),
    );
    expect(out[0]!.kind).toBe('writing');
  });

  it('chỉ chọn ứng viên luyện vừa quỹ thời gian', () => {
    const list = [cand('v1', 'vocabulary'), cand('r10', 'reading', 10), cand('w5', 'writing', 5)];
    // Quỹ 5: reading 10 phút không vừa → dù "muốn" reading vẫn lấy writing vừa quỹ.
    expect(
      ids(applyPracticeSlot(list, slot({ budgetMinutes: 5, lastNewUnitPlanKinds: null }))),
    ).toEqual(['w5', 'v1', 'r10']);
    expect(
      ids(applyPracticeSlot(list, slot({ budgetMinutes: 10, lastNewUnitPlanKinds: null }))),
    ).toEqual(['r10', 'v1', 'w5']);
  });

  it('ứng viên luyện đã ở vị trí 0 → giữ nguyên; không sửa danh sách đầu vào', () => {
    const already = [cand('r1', 'reading'), cand('v1', 'vocabulary')];
    expect(ids(applyPracticeSlot(already, slot({ lastNewUnitPlanKinds: null })))).toEqual([
      'r1',
      'v1',
    ]);
    const copy = [...ranked];
    applyPracticeSlot(ranked, slot({ lastNewUnitPlanKinds: null }));
    expect(ranked).toEqual(copy);
  });

  it('skills chỉ chứa writing → chỉ đưa writing lên', () => {
    const out = applyPracticeSlot(
      ranked,
      slot({ skills: ['vocabulary', 'writing'], lastNewUnitPlanKinds: null }),
    );
    expect(out[0]!.kind).toBe('writing');
  });
});

// --- Mô phỏng 14 ngày ---

const catalog = loadSimCatalog(true);

/** Cách dịch vụ áp suất luyện rồi suất Kanji (cùng cách dùng ở `services/daily-plan.ts`). */
const practiceThenKanji =
  (budgetMinutes: number): CandidateTransform =>
  (candidates, ctx) => {
    const withKind = candidates.map((c) => ({ ...c, kind: ctx.units.get(c.unitId)?.kind }));
    const lastKinds = ctx.previousNewUnitDayKinds.at(-1) ?? null;
    const lastPracticeKind =
      ctx.previousNewUnitDayKinds
        .flat()
        .filter((k): k is 'reading' | 'writing' => k === 'reading' || k === 'writing')
        .at(-1) ?? null;
    const practiced = applyPracticeSlot(withKind, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanKinds: lastKinds,
      lastPracticeKind,
      budgetMinutes,
    });
    return applyKanjiSlot(practiced, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanHadKanji: lastKinds === null ? null : lastKinds.includes('kanji'),
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
  simulatePlans(f, { catalog, transform: practiceThenKanji(f.profile.dailyMinutes) });

const kindOfUnit = (unitId: string) => catalog.find((u) => u.id === unitId)?.kind;
type Day = NonNullable<SimHistory[number]>;
const newUnits = (day: Day) => day.items.flatMap((i) => (i.type === 'new_unit' ? [i] : []));
const practiceKinds = (day: Day) =>
  newUnits(day).flatMap((u) => {
    const k = kindOfUnit(u.unitId);
    return k === 'reading' || k === 'writing' ? [k] : [];
  });
const days = (history: SimHistory): Day[] => history.flatMap((d) => (d ? [d] : []));

describe('hồ sơ practice-30min × 14 ngày', () => {
  it('có hồ sơ practice-30min', () => {
    expect(loadPracticeProfiles().map((p) => p.id)).toContain('practice-30min');
  });

  it('danh mục mô phỏng có đủ đơn vị luyện đọc và luyện viết', () => {
    for (const kind of ['reading', 'writing'] as const) {
      expect(
        catalog.filter((u) => u.kind === kind && u.level === 'N5').length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('ngày đầu có reading; lần luyện kế tiếp là writing; tổng ≤ 30', () => {
    const history = simulate(loadLearnerProfile('practice-30min'));
    const first = days(history)[0]!;
    expect(practiceKinds(first)).toContain('reading');
    const sequence = days(history).flatMap(practiceKinds);
    expect(sequence.length).toBeGreaterThanOrEqual(2);
    expect(sequence[0]).toBe('reading');
    expect(sequence).toContain('writing');
    for (const day of days(history)) expect(day.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('không có bài luyện nào khi hồ sơ bỏ reading/writing khỏi skills (I2)', () => {
    const f = loadLearnerProfile('practice-30min');
    const without = {
      ...f,
      profile: {
        ...f.profile,
        skills: ['vocabulary', 'grammar', 'kanji'] as typeof f.profile.skills,
      },
    };
    for (const day of days(simulate(without))) expect(practiceKinds(day)).toEqual([]);
  });
});

describe('I1 — quỹ thời gian với luyện đọc/viết × {5,10,15,30} phút × 14 ngày', () => {
  const base = loadLearnerProfile('practice-30min');
  const cases = DAILY_MINUTES.map((b) => [b] as const);

  it.each(cases)('quỹ %i phút: tổng ≤ quỹ, ôn ≤ 60%, mỗi mục 1–15 phút', (budget) => {
    const history = simulate(withBudget(base, budget));
    for (const day of days(history)) {
      expect(day.estimatedMinutes).toBeLessThanOrEqual(budget);
      const review = day.items.reduce(
        (s, i) => s + (i.type === 'review_batch' ? i.estMinutes : 0),
        0,
      );
      expect(review).toBeLessThanOrEqual(Math.floor(MAX_REVIEW_SHARE * budget));
      for (const item of day.items) {
        expect(item.estMinutes).toBeGreaterThanOrEqual(1);
        expect(item.estMinutes).toBeLessThanOrEqual(15);
      }
    }
  });

  it.each(cases)('quỹ %i phút với tồn đọng ôn: vẫn không vượt quỹ', (budget) => {
    const withBacklog: LearnerProfileFixture = {
      ...withBudget(base, budget),
      reviewBacklog: [{ count: 40, daysOverdue: 3, isHard: false }],
    };
    for (const day of days(simulate(withBacklog)))
      expect(day.estimatedMinutes).toBeLessThanOrEqual(budget);
  });
});

describe('I2 — skills không chứa luyện ⇒ đầu ra y hệt đầu vào', () => {
  it.each(loadLearnerProfiles().map((p) => [p.id, p] as const))(
    '%s: kế hoạch có và không có applyPracticeSlot giống hệt nhau',
    (_id, fixture) => {
      const plain = simulatePlans(fixture, {
        catalog,
        transform: (candidates, ctx) => {
          const withKind = candidates.map((c) => ({ ...c, kind: ctx.units.get(c.unitId)?.kind }));
          const last = ctx.previousNewUnitDayKinds.at(-1);
          return applyKanjiSlot(withKind, {
            skills: ctx.skills,
            prioritizedSkill: ctx.prioritizedSkill,
            lastNewUnitPlanHadKanji: last === undefined ? null : last.includes('kanji'),
            budgetMinutes: fixture.profile.dailyMinutes,
          }).map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
        },
      });
      expect(simulate(fixture)).toEqual(plain);
    },
  );
});
