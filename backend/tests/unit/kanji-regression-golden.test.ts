import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyKanjiSlot, type NewUnitCandidate } from '../../src/engine/daily-plan.js';
import { loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';
import {
  loadSimCatalog,
  SIMULATION_DAYS,
  simulatePlans,
  type CandidateTransform,
  type SimHistory,
} from '../fixtures/golden/simulate-plans.js';

// Hồi quy SC-006 / FR-009 (T040): kế hoạch 14 ngày của mọi hồ sơ CŨ (không chọn Kanji) qua
// `rankUnits` + `applyKanjiSlot` + `planDailyPlan` PHẢI giống hệt ảnh chụp sinh từ mã trước khi thêm Kanji
// (`plans-pre-kanji.json`, T001). Mọi khác biệt là lỗi.

const GOLDEN = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixtures/golden/plans-pre-kanji.json',
    ),
    'utf8',
  ),
) as { days: number; profiles: Record<string, SimHistory> };

/** Cách dịch vụ áp suất Kanji lên ứng viên đã xếp hạng (cùng cách dùng ở `services/daily-plan.ts`). */
const kanjiSlot: CandidateTransform = (candidates, ctx) => {
  const withKind: NewUnitCandidate[] = candidates.map((c) => ({
    ...c,
    kind: ctx.units.get(c.unitId)?.kind,
  }));
  const last = ctx.previousNewUnitDayKinds.at(-1);
  const slotted = applyKanjiSlot(withKind, {
    skills: ctx.skills,
    prioritizedSkill: ctx.prioritizedSkill,
    lastNewUnitPlanHadKanji: last === undefined ? null : last.includes('kanji'),
  });
  return slotted.map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
};

describe('hồi quy golden: người học không chọn Kanji không đổi gì (SC-006, FR-009)', () => {
  const profiles = loadLearnerProfiles();

  it('ảnh chụp golden phủ đúng tập hồ sơ cũ và số ngày mô phỏng', () => {
    expect(GOLDEN.days).toBe(SIMULATION_DAYS);
    expect(Object.keys(GOLDEN.profiles).sort()).toEqual(profiles.map((p) => p.id).sort());
  });

  it.each(profiles.map((p) => [p.id, p] as const))(
    '%s: kế hoạch 14 ngày giống hệt ảnh chụp trước thay đổi (danh mục có cả bài Kanji)',
    (id, fixture) => {
      // Danh mục ĐẦY ĐỦ gồm bài Kanji: người học không chọn Kanji vẫn không bao giờ thấy chúng.
      const catalog = loadSimCatalog(true);
      expect(catalog.some((u) => u.kind === 'kanji')).toBe(true);
      const actual = simulatePlans(fixture, { catalog, transform: kanjiSlot });
      expect(actual).toEqual(GOLDEN.profiles[id]);
    },
  );

  it.each(profiles.map((p) => [p.id, p] as const))(
    '%s: không có bài Kanji nào trong kế hoạch',
    (_id, fixture) => {
      const catalog = loadSimCatalog(true);
      const kanjiIds = new Set(catalog.filter((u) => u.kind === 'kanji').map((u) => u.id));
      const actual = simulatePlans(fixture, { catalog, transform: kanjiSlot });
      for (const day of actual) {
        for (const item of day?.items ?? []) {
          if (item.type === 'new_unit') expect(kanjiIds.has(item.unitId)).toBe(false);
        }
      }
    },
  );
});
