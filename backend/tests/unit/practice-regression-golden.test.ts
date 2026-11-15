import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyKanjiSlot,
  applyPracticeSlot,
  type NewUnitCandidate,
} from '../../src/engine/daily-plan.js';
import { loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';
import {
  loadSimCatalog,
  SIMULATION_DAYS,
  simulatePlans,
  type CandidateTransform,
  type SimHistory,
} from '../fixtures/golden/simulate-plans.js';

// Hồi quy I2 / SC-006 mở rộng (T044, spec 007): kế hoạch 14 ngày của mọi hồ sơ CŨ (không chọn luyện đọc/viết)
// qua `rankUnits` + `applyPracticeSlot` + `applyKanjiSlot` + `planDailyPlan` PHẢI giống hệt ảnh chụp sinh từ mã
// trước khi thêm luyện đọc/viết (`plans-pre-practice.json`, T003). Mọi khác biệt là lỗi.

const GOLDEN = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixtures/golden/plans-pre-practice.json',
    ),
    'utf8',
  ),
) as { days: number; profiles: Record<string, SimHistory> };

/** Cách dịch vụ áp suất luyện rồi suất Kanji lên ứng viên đã xếp hạng (cùng cách dùng ở `services/daily-plan.ts`). */
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
    }).map(({ unitId, estMinutes }) => ({ unitId, estMinutes }));
  };

describe('hồi quy golden: người học không chọn luyện đọc/viết không đổi gì (I2)', () => {
  const profiles = loadLearnerProfiles();

  it('ảnh chụp golden phủ đúng tập hồ sơ cũ và số ngày mô phỏng', () => {
    expect(GOLDEN.days).toBe(SIMULATION_DAYS);
    expect(Object.keys(GOLDEN.profiles).sort()).toEqual(profiles.map((p) => p.id).sort());
  });

  it.each(profiles.map((p) => [p.id, p] as const))(
    '%s: kế hoạch 14 ngày giống hệt ảnh chụp trước thay đổi (danh mục có cả bài luyện)',
    (id, fixture) => {
      // Danh mục ĐẦY ĐỦ gồm bài luyện đọc/viết: người học không chọn luyện vẫn không bao giờ thấy chúng.
      const catalog = loadSimCatalog(true);
      expect(catalog.some((u) => u.kind === 'reading')).toBe(true);
      expect(catalog.some((u) => u.kind === 'writing')).toBe(true);
      const actual = simulatePlans(fixture, {
        catalog,
        transform: practiceThenKanji(fixture.profile.dailyMinutes),
      });
      expect(actual).toEqual(GOLDEN.profiles[id]);
    },
  );

  it.each(profiles.map((p) => [p.id, p] as const))(
    '%s: không có bài luyện đọc/viết nào trong kế hoạch',
    (_id, fixture) => {
      const catalog = loadSimCatalog(true);
      const practiceIds = new Set(
        catalog.filter((u) => u.kind === 'reading' || u.kind === 'writing').map((u) => u.id),
      );
      const actual = simulatePlans(fixture, {
        catalog,
        transform: practiceThenKanji(fixture.profile.dailyMinutes),
      });
      for (const day of actual) {
        for (const item of day?.items ?? []) {
          if (item.type === 'new_unit') expect(practiceIds.has(item.unitId)).toBe(false);
        }
      }
    },
  );
});
