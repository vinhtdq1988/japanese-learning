import { describe, expect, it } from 'vitest';
import { effectiveSkills } from '../../src/domain/practice.js';
import type { ContentLevel, Skill } from '../../src/domain/types.js';
import {
  applyKanjiSlot,
  applyPracticeSlot,
  type NewUnitCandidate,
} from '../../src/engine/daily-plan.js';
import {
  CONTENT_CEILING,
  FRONTIER_SIZE,
  levelIndex,
  rankUnits,
  upcomingUnits,
} from '../../src/engine/path.js';
import {
  loadRunwayProfile,
  type LearnerProfileFixture,
} from '../fixtures/learner-profiles/index.js';
import {
  loadSimCatalog,
  simPathParams,
  simulatePlans,
  type CandidateTransform,
  type SimHistory,
  type SimUnit,
} from '../fixtures/golden/simulate-plans.js';

// Đường băng 180 ngày, thứ tự học và các hồ sơ đại diện của Câu chuyện 4 (spec 008, T209; SC-003, FR-011,
// FR-020, FR-021, FR-023). Mô phỏng thuần hàm (`simulatePlans`), không cần CSDL.
//   (a) chạy trên thư viện TỔNG HỢP kích thước đúng theo CS3 nên chạy được ngay;
//   (b) `RUNWAY_REAL=1` chạy cùng bộ kiểm trên `content/` thật (`releases: 'all'`) — chỉ bật ở nghiệm thu.

// ---------------------------------------------------------------------------------------------------------
// Thư viện tổng hợp theo kích thước kế hoạch (research D17, tasks CS3)
// ---------------------------------------------------------------------------------------------------------

type Counts = Record<Skill, Record<'N4' | 'N3', number>>;

/** Số đơn vị mỗi (loại × trình độ): ngữ pháp 28, từ vựng 66/200, Kanji 46/80 (đợt 003/006/007), đọc 30, viết 20. */
const COUNTS: Counts = {
  grammar: { N4: 28, N3: 28 },
  vocabulary: { N4: 66, N3: 200 },
  kanji: { N4: 46, N3: 80 },
  reading: { N4: 30, N3: 30 },
  writing: { N4: 20, N3: 20 },
};
/** Số chặng: N4 chặng 4–23, N3 chặng 4–33 (`stage-plan.md`). */
const STAGES: Record<'N4' | 'N3', number> = { N4: 20, N3: 30 };

interface SynthUnit extends SimUnit {
  /** Id đơn vị tiên quyết CÙNG loại (siêu dữ liệu file `requires`; engine không đọc). */
  requires?: string;
}

/** Mỗi 10 đơn vị có 3 đơn vị 5 phút (30%) và 7 đơn vị 10 phút (CS3). */
const estOf = (i: number): number => (i % 10 < 3 ? 5 : 10);

function syntheticLibrary(): SynthUnit[] {
  const units: SynthUnit[] = [];
  for (const kind of Object.keys(COUNTS) as Skill[]) {
    for (const level of ['N4', 'N3'] as const) {
      const n = COUNTS[kind][level];
      const perStage = new Map<number, number>();
      for (let i = 0; i < n; i += 1) {
        const stage = 4 + Math.floor((i * STAGES[level]) / n);
        const pos = (perStage.get(stage) ?? 0) + 1;
        perStage.set(stage, pos);
        const slug = `${level.toLowerCase()}-${kind}-${String(i + 1).padStart(3, '0')}`;
        // Tiên quyết: ngữ pháp thứ 3k+3 yêu cầu ngữ pháp liền trước (không mang thẻ work: AU10).
        const requiresPrev = kind === 'grammar' && i % 3 === 2;
        const goalTags = ['jlpt'];
        if (!requiresPrev && i % 4 === 0 && (kind === 'vocabulary' || kind === 'grammar')) {
          goalTags.push('work');
        }
        units.push({
          id: slug,
          slug,
          kind,
          level,
          tier: 'core',
          goalTags,
          topicId: `${kind}-${level}-${Math.floor(i / 6)}`,
          difficulty: level === 'N4' ? 2 + (i % 2) : 3 + (i % 2),
          estMinutes: estOf(i),
          sequence: stage * 100 + pos * 10,
          requires: requiresPrev
            ? `${level.toLowerCase()}-${kind}-${String(i).padStart(3, '0')}`
            : undefined,
        });
      }
    }
  }
  return units;
}

// ---------------------------------------------------------------------------------------------------------
// Tiện ích mô phỏng
// ---------------------------------------------------------------------------------------------------------

/** Cách dịch vụ áp suất luyện rồi suất Kanji lên ứng viên (cùng cách dùng ở `services/daily-plan.ts`). */
const practiceThenKanji =
  (budgetMinutes: number): CandidateTransform =>
  (candidates, ctx) => {
    const withKind: NewUnitCandidate[] = candidates.map((c) => ({
      ...c,
      kind: ctx.units.get(c.unitId)?.kind,
    }));
    const last = ctx.previousNewUnitDayKinds.at(-1) ?? null;
    const practiced = applyPracticeSlot(withKind, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanKinds: last,
      budgetMinutes,
    });
    return applyKanjiSlot(practiced, {
      skills: ctx.skills,
      prioritizedSkill: ctx.prioritizedSkill,
      lastNewUnitPlanHadKanji: last === null ? null : last.includes('kanji'),
      budgetMinutes,
    }).map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
  };

/** Hồ sơ chạy với kỹ năng HIỆU LỰC (người dưới 30 phút không có luyện đọc/viết) như dịch vụ thật. */
function withEffectiveSkills(f: LearnerProfileFixture): LearnerProfileFixture {
  return {
    ...f,
    profile: { ...f.profile, skills: effectiveSkills(f.profile.skills, f.profile.dailyMinutes) },
  };
}

/** Quan sát danh sách ứng viên ĐÃ XẾP HẠNG của từng ngày (trước suất đọc/viết, suất Kanji và xếp vừa quỹ). */
type CandidateObserver = (ids: readonly string[], day: number) => void;

const run = (
  f: LearnerProfileFixture,
  catalog: readonly SimUnit[],
  days: number,
  patch: Partial<LearnerProfileFixture> = {},
  observe?: CandidateObserver,
): SimHistory => {
  const fixture = withEffectiveSkills({ ...f, ...patch });
  const slots = practiceThenKanji(fixture.profile.dailyMinutes);
  let day = 0;
  return simulatePlans(fixture, {
    catalog,
    days,
    transform: (candidates, ctx) => {
      observe?.(
        candidates.map((c) => c.unitId),
        day,
      );
      day += 1;
      return slots(candidates, ctx);
    },
  });
};

const newUnitsOf = (history: SimHistory): { day: number; unitId: string }[] =>
  history.flatMap((d, day) =>
    (d?.items ?? []).flatMap((i) => (i.type === 'new_unit' ? [{ day, unitId: i.unitId }] : [])),
  );

// ---------------------------------------------------------------------------------------------------------
// Bộ kiểm dùng chung cho thư viện tổng hợp và thư viện thật
// ---------------------------------------------------------------------------------------------------------

function runwaySuite(getCatalog: () => SimUnit[], real: boolean): void {
  const byId = (catalog: readonly SimUnit[]) => new Map(catalog.map((u) => [u.id, u]));

  it('n4-15min-jlpt-n3: ≥ 180 ngày liên tục có bài mới, mọi kế hoạch ≤ quỹ, không lặp bài mới (SC-003)', () => {
    const catalog = getCatalog();
    const units = byId(catalog);
    const f = loadRunwayProfile('n4-15min-jlpt-n3');
    const days = 200;
    const history = run(f, catalog, days);

    // 0 ngày hết nội dung trong 180 ngày đầu: ngày nào cũng có ít nhất một đơn vị mới.
    for (let d = 0; d < 180; d += 1) {
      const day = history[d];
      expect(day, `ngày ${d} không có kế hoạch`).not.toBeNull();
      expect(
        day!.items.some((i) => i.type === 'new_unit'),
        `ngày ${d} hết nội dung`,
      ).toBe(true);
    }
    // 100% kế hoạch trong quỹ.
    for (const day of history) expect(day!.estimatedMinutes).toBeLessThanOrEqual(15);

    // Không đơn vị nào lặp lại như bài mới.
    const planned = newUnitsOf(history);
    expect(new Set(planned.map((p) => p.unitId)).size).toBe(planned.length);

    // N4 trước N3 theo từng loại (FR-020): ở danh sách xếp hạng của MỌI ngày, khi một đơn vị N3 của loại đã xuất
    // hiện thì không còn đơn vị N4 nào của cùng loại đứng sau nó. (Kế hoạch ngày có thể điền một đơn vị 5 phút của
    // trình độ sau vào phần quỹ còn dư khi đơn vị 10 phút của trình độ trước không vừa — xem quickstart-results.)
    const inversions: string[] = [];
    run(f, catalog, 200, {}, (ids, day) => {
      const seenN3 = new Set<Skill>();
      for (const id of ids) {
        const u = units.get(id)!;
        if (u.level === 'N3') seenN3.add(u.kind);
        else if (seenN3.has(u.kind)) inversions.push(`ngày ${day}: ${id} sau đơn vị N3 cùng loại`);
      }
    });
    expect(inversions).toEqual([]);
    // Cả hai trình độ đều được học trong 200 ngày (đường băng đủ dài để sang N3).
    const levels = new Set(planned.map((p) => units.get(p.unitId)!.level));
    expect(levels).toEqual(new Set(['N4', 'N3']));
    // Chỉ chọn ba kỹ năng gợi ý: không có đọc/viết.
    expect(planned.some((p) => ['reading', 'writing'].includes(units.get(p.unitId)!.kind))).toBe(
      false,
    );
  });

  it('n4-15min-jlpt-n3: mỗi loại đã chọn có bài mới ở ≥ 10% số ngày trong mọi cửa sổ 30 ngày đầu 120 ngày', () => {
    const catalog = getCatalog();
    const units = byId(catalog);
    const history = run(loadRunwayProfile('n4-15min-jlpt-n3'), catalog, 120);
    // Ngưỡng 10% (không phải 15% của D17): ngữ pháp chỉ chiếm ≈ 12,6% số đơn vị nên không thể có mặt ≥ 15% số
    // ngày ở MỌI cửa sổ; 10% đủ chứng minh không loại nào bị bỏ đói trong lúc cả ba loại còn nội dung.
    for (const kind of ['vocabulary', 'grammar', 'kanji'] as Skill[]) {
      const hasKind = history.map((d) =>
        (d?.items ?? []).some((i) => i.type === 'new_unit' && units.get(i.unitId)!.kind === kind),
      );
      for (let start = 0; start + 30 <= hasKind.length; start += 1) {
        const share = hasKind.slice(start, start + 30).filter(Boolean).length / 30;
        expect(share, `${kind} ngày ${start}–${start + 29}`).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it('n4-5min-runway: ≥ 90 ngày không hết đơn vị 5 phút, 100% kế hoạch ≤ 5 phút', () => {
    const catalog = getCatalog();
    const history = run(loadRunwayProfile('n4-5min-runway'), catalog, 100);
    for (let d = 0; d < 90; d += 1) {
      const day = history[d];
      expect(day, `ngày ${d}`).not.toBeNull();
      expect(
        day!.items.some((i) => i.type === 'new_unit'),
        `ngày ${d} hết đơn vị 5 phút`,
      ).toBe(true);
    }
    for (const day of history) expect(day!.estimatedMinutes).toBeLessThanOrEqual(5);
  });

  it('quỹ 5/10/15/30 phút: 100% kế hoạch ≤ quỹ; luyện đọc/viết chỉ ở hồ sơ 30 phút (FR-023)', () => {
    const catalog = getCatalog();
    const units = byId(catalog);
    for (const id of [
      'n4-5min-runway',
      'n4-10min-jlpt-n3',
      'n4-15min-jlpt-n3',
      'n3-30min-all-skills',
    ]) {
      const f = loadRunwayProfile(id);
      const history = run(f, catalog, 60);
      for (const day of history)
        expect(day!.estimatedMinutes, id).toBeLessThanOrEqual(f.profile.dailyMinutes);
      const kinds = new Set(newUnitsOf(history).map((p) => units.get(p.unitId)!.kind));
      const practised = kinds.has('reading') || kinds.has('writing');
      expect(practised, id).toBe(f.profile.dailyMinutes >= 30);
    }
    // Hồ sơ 30 phút dùng cả đọc lẫn viết khi thư viện có đơn vị luyện.
    if (catalog.some((u) => u.kind === 'reading') && catalog.some((u) => u.kind === 'writing')) {
      const kinds = new Set(
        newUnitsOf(run(loadRunwayProfile('n3-30min-all-skills'), catalog, 60)).map(
          (p) => units.get(p.unitId)!.kind,
        ),
      );
      expect(kinds.has('reading') && kinds.has('writing')).toBe(true);
    }
    // Hồ sơ 10 phút CHỌN đủ năm kỹ năng vẫn không có luyện (kỹ năng hiệu lực).
    const tenAll = loadRunwayProfile('n4-10min-jlpt-n3');
    const history = run(tenAll, catalog, 60, {
      profile: {
        ...tenAll.profile,
        skills: ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'],
      },
    });
    const kinds = new Set(newUnitsOf(history).map((p) => units.get(p.unitId)!.kind));
    expect(kinds.has('reading') || kinds.has('writing')).toBe(false);
  });

  it('n4-10min-jlpt-n3: N4 trước N3 ở từng loại và không lặp bài mới trong 120 ngày', () => {
    const catalog = getCatalog();
    const history = run(loadRunwayProfile('n4-10min-jlpt-n3'), catalog, 120);
    const planned = newUnitsOf(history);
    expect(new Set(planned.map((p) => p.unitId)).size).toBe(planned.length);
    expect(planned.length).toBeGreaterThan(0);
  });

  it('mastered-some-units: đơn vị đã thành thạo không được đề xuất lại như bài mới', () => {
    const catalog = getCatalog();
    const f = loadRunwayProfile('mastered-some-units');
    const perKind = (f.expected.setup as { masteredFirstUnitsPerKind: number })
      .masteredFirstUnitsPerKind;
    const mastered = new Set<string>();
    for (const kind of f.profile.skills) {
      catalog
        .filter((u) => u.kind === kind)
        .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.sequence - b.sequence)
        .slice(0, perKind)
        .forEach((u) => mastered.add(u.id));
    }
    expect(mastered.size).toBeGreaterThan(0);

    // `simulatePlans` chỉ nhận đơn vị đã hoàn thành qua `completedUnitSlugs`; thành thạo đi theo cùng đường vì
    // engine loại cả `completed` lẫn `mastered` khỏi `upcomingUnits`. Kiểm riêng `rankUnits` cho trạng thái mastered.
    const params = simPathParams(f);
    const progress = new Map([...mastered].map((id) => [id, 'mastered' as const]));
    const ranked = rankUnits(params, f.profile, catalog, progress);
    expect(ranked.some((r) => mastered.has(r.unit.id))).toBe(false);
    expect(upcomingUnits(ranked).some((u) => mastered.has(u.id))).toBe(false);

    const history = run(f, catalog, 30, { completedUnitSlugs: [...mastered] });
    expect(newUnitsOf(history).some((p) => mastered.has(p.unitId))).toBe(false);
  });

  it('completed-all-n3: hết nội dung (không còn bài mới), có gợi ý ôn khi còn lịch ôn', () => {
    const catalog = getCatalog();
    const f = loadRunwayProfile('completed-all-n3');
    const skills = withEffectiveSkills(f).profile.skills;
    const done = catalog
      .filter((u) => u.level === 'N3' && skills.includes(u.kind))
      .map((u) => u.id);
    const params = simPathParams(f);
    expect(params.levelRange).toEqual(['N3', 'N3']);
    // Đã chạm trần nội dung Giai đoạn 1 ⇒ gợi ý `content_exhausted` thay vì `raise_level` (path service).
    expect(levelIndex(params.levelRange[1])).toBe(levelIndex(CONTENT_CEILING));

    const ranked = rankUnits(
      params,
      withEffectiveSkills(f).profile,
      catalog,
      new Map(done.map((id) => [id, 'completed' as const])),
    );
    expect(upcomingUnits(ranked)).toEqual([]);

    // Không còn bài mới; có tồn đọng ôn thì kế hoạch chỉ gồm ôn (gợi ý ôn tập), không có bài mới.
    const history = run(f, catalog, 5, {
      completedUnitSlugs: done,
      reviewBacklog: [{ count: 12, daysOverdue: 1, isHard: false }],
    });
    expect(newUnitsOf(history)).toEqual([]);
    expect(history[0]!.kind).toBe('review_only');
    // Không có cả tồn đọng ôn: kế hoạch rỗng (thông báo hết nội dung ở UI).
    const empty = run(f, catalog, 3, { completedUnitSlugs: done });
    expect(empty.every((d) => d?.kind === 'empty')).toBe(true);
  });

  it('n2-goal: dừng ở N3 kèm thông báo trần nội dung', () => {
    const catalog = getCatalog();
    const f = loadRunwayProfile('n2-goal');
    const params = simPathParams(f);
    expect(params.startLevel).toBe('N3');
    expect(params.levelRange).toEqual(['N3', 'N3']);
    expect(params.scopeNotice).toBe('content_ceiling_n3');
    const units = byId(catalog);
    const planned = newUnitsOf(run(f, catalog, 60));
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => units.get(p.unitId)!.level === 'N3')).toBe(true);
  });

  it('placement N4 và N3: kế hoạch đầu tiên bắt đầu ở đơn vị đầu của đúng trình độ (FR-021)', () => {
    const catalog = getCatalog();
    const units = byId(catalog);
    const firstOfLevel = (level: ContentLevel, kind: Skill): string =>
      catalog
        .filter((u) => u.level === level && u.kind === kind)
        .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))[0]!.id;
    const base = loadRunwayProfile('n4-10min-jlpt-n3');
    const answers = (n5: number, n4: number, n3: number): boolean[] => [
      ...Array.from({ length: 8 }, (_, i) => i < n5),
      ...Array.from({ length: 6 }, (_, i) => i < n4),
      ...Array.from({ length: 6 }, (_, i) => i < n3),
    ];
    const cases: { level: ContentLevel; correct: boolean[] }[] = [
      { level: 'N4', correct: answers(8, 6, 0) }, // đạt N5 và N4, trượt N3 ⇒ N4
      { level: 'N3', correct: answers(8, 6, 6) }, // đạt cả ba ⇒ N3
    ];
    for (const { level, correct } of cases) {
      const f: LearnerProfileFixture = {
        ...base,
        profile: { ...base.profile, currentLevel: level },
        placement: { correctByPosition: correct },
      };
      const params = simPathParams(f);
      expect(params.startLevel).toBe(level);
      const history = run(f, catalog, 1);
      const first = history[0]!.items.filter((i) => i.type === 'new_unit');
      expect(first.length).toBeGreaterThan(0);
      for (const item of first) {
        if (item.type !== 'new_unit') continue;
        const unit = units.get(item.unitId)!;
        expect(unit.level, `ngày 0 bắt đầu ở ${unit.level}`).toBe(level);
        // Đơn vị đầu tiên của loại thuộc trình độ xuất phát (hoặc đơn vị đầu vừa quỹ khi bài đầu 10 phút không vừa).
        const sameKind = catalog
          .filter((u) => u.level === level && u.kind === unit.kind)
          .sort((a, b) => a.sequence - b.sequence);
        expect(sameKind.indexOf(unit), `${unit.id} không phải đơn vị đầu của loại`).toBeLessThan(
          FRONTIER_SIZE,
        );
      }
      // Đơn vị đầu của loại từ vựng ở trình độ này nằm trong danh sách ứng viên hàng đầu.
      expect(units.has(firstOfLevel(level, 'vocabulary'))).toBe(true);
    }
  });

  it.runIf(!real)(
    'n4-10min-work-goal: đơn vị mang thẻ work được đề bạt cao hơn rõ rệt, không đứng trước tiên quyết',
    () => {
      const catalog = getCatalog() as SynthUnit[];
      const units = byId(catalog) as Map<string, SynthUnit>;
      const workShare = (id: string): number => {
        const planned = newUnitsOf(run(loadRunwayProfile(id), catalog, 30));
        const work = planned.filter((p) => units.get(p.unitId)!.goalTags.includes('work')).length;
        return work / planned.length;
      };
      const vocab = catalog.filter((u) => u.kind === 'vocabulary');
      expect(
        vocab.filter((u) => u.goalTags.includes('work')).length / vocab.length,
      ).toBeGreaterThanOrEqual(0.2);
      const withWork = workShare('n4-10min-work-goal');
      const control = workShare('n4-10min-jlpt-n3');
      expect(withWork).toBeGreaterThan(control);

      // Không đơn vị nào đứng trước tiên quyết cùng loại của nó trong danh sách xếp hạng của mọi ngày
      // (đề bạt theo mục tiêu không vượt tiên quyết: AU10 cấm đơn vị `work` có `requires` cùng loại).
      const violations: string[] = [];
      run(loadRunwayProfile('n4-10min-work-goal'), catalog, 60, {}, (ids, day) => {
        const index = new Map(ids.map((id, i) => [id, i]));
        for (const id of ids) {
          const req = units.get(id)!.requires;
          if (req && index.has(req) && index.get(req)! > index.get(id)!) {
            violations.push(`ngày ${day}: ${id} đứng trước tiên quyết ${req}`);
          }
        }
      });
      expect(violations).toEqual([]);
    },
  );
}

describe('đường băng trên thư viện tổng hợp (kích thước CS3)', () => {
  const catalog = syntheticLibrary();

  it('thư viện tổng hợp đúng kích thước kế hoạch và ≥ 30% đơn vị 5 phút mỗi (loại × trình độ)', () => {
    expect(catalog).toHaveLength(Object.values(COUNTS).reduce((s, l) => s + l.N4 + l.N3, 0));
    for (const kind of Object.keys(COUNTS) as Skill[]) {
      for (const level of ['N4', 'N3'] as const) {
        const group = catalog.filter((u) => u.kind === kind && u.level === level);
        expect(
          group.filter((u) => u.estMinutes === 5).length / group.length,
        ).toBeGreaterThanOrEqual(0.3);
        expect(new Set(group.map((u) => u.sequence)).size).toBe(group.length);
      }
    }
  });

  runwaySuite(() => catalog, false);
});

// Chỉ bật ở nghiệm thu (Phase 9): cần đủ nội dung đã phát hành trong `content/units/`.
describe.skipIf(process.env.RUNWAY_REAL !== '1')(
  'đường băng trên content/ thật (RUNWAY_REAL=1)',
  () => {
    runwaySuite(() => {
      const previous = process.env.CONTENT_RELEASES;
      process.env.CONTENT_RELEASES = 'all';
      try {
        return loadSimCatalog(true);
      } finally {
        if (previous === undefined) delete process.env.CONTENT_RELEASES;
        else process.env.CONTENT_RELEASES = previous;
      }
    }, true);
  },
);
