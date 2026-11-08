import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { kanjiSlot } from '../fixtures/golden/kanji-slot.js';
import {
  loadSimCatalog,
  SIMULATION_DAYS,
  simulatePlans,
  type SimHistory,
} from '../fixtures/golden/simulate-plans.js';
import { loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';
import { loadClassProfiles } from '../fixtures/learner-profiles/class-index.js';

// Hồi quy SC-012 / FR-041 (spec 004, T063): kế hoạch 14 ngày của mọi hồ sơ CŨ (không thuộc lớp) qua engine
// `rankUnits` + `applyKanjiSlot` + `planDailyPlan` PHẢI giống hệt ảnh chụp sinh từ mã trước khi thêm tổ chức/lớp
// (`plans-pre-org.json`, T001). Engine không đổi chữ ký sau US3 nên mọi khác biệt là lỗi. Phần phản hồi dịch vụ
// (`GET /path|/progress|/today`) được so ở `tests/integration/org-regression-api.test.ts`.

const GOLDEN = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixtures/golden/plans-pre-org.json',
    ),
    'utf8',
  ),
) as { days: number; profiles: Record<string, SimHistory> };

describe('hồi quy golden: người học không thuộc lớp không đổi gì (SC-012, FR-041)', () => {
  const profiles = loadLearnerProfiles();

  it('ảnh chụp golden phủ đúng tập hồ sơ cũ (không gồm hồ sơ class-*) và số ngày mô phỏng', () => {
    expect(GOLDEN.days).toBe(SIMULATION_DAYS);
    expect(Object.keys(GOLDEN.profiles).sort()).toEqual(profiles.map((p) => p.id).sort());
    expect(Object.keys(GOLDEN.profiles).some((id) => id.startsWith('class-'))).toBe(false);
    expect(loadClassProfiles().length).toBeGreaterThan(0);
  });

  it.each(profiles.map((p) => [p.id, p] as const))(
    '%s: kế hoạch 14 ngày giống hệt ảnh chụp trước khi thêm tổ chức/lớp',
    (id, fixture) => {
      const actual = simulatePlans(fixture, {
        catalog: loadSimCatalog(true),
        transform: kanjiSlot,
      });
      expect(actual).toEqual(GOLDEN.profiles[id]);
    },
  );
});
