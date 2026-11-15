import { describe, expect, it } from 'vitest';
import {
  buildPathParams,
  rankUnits,
  upcomingUnits,
  type RankableUnit,
  type UnitProgressStatus,
} from '../../src/engine/path.js';
import type { ContentLevel, Skill } from '../../src/domain/types.js';

// Kiểm thử vi mô hiệu năng engine ở quy mô thư viện đầy đủ (spec 008, T014; SC-007, I9):
// `rankUnits` + biên giới trên 700 đơn vị tổng hợp, trung vị < 5 ms.

const KINDS: Skill[] = ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'];
const MEDIAN_BUDGET_MS = 5;

/** 700 đơn vị: 5 loại × 2 trình độ × 70 đơn vị. */
function library(): RankableUnit[] {
  const units: RankableUnit[] = [];
  let n = 0;
  for (const kind of KINDS) {
    for (const level of ['N4', 'N3'] as ContentLevel[]) {
      for (let i = 0; i < 70; i += 1) {
        n += 1;
        units.push({
          id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
          kind,
          level,
          tier: 'core',
          goalTags: i % 5 === 0 ? ['jlpt', 'work'] : ['jlpt'],
          topicId: `topic-${kind}-${level}-${Math.floor(i / 6)}`,
          difficulty: 1 + (i % 5),
          estMinutes: i % 3 === 0 ? 10 : 5,
          sequence: (Math.floor(i / 9) + 4) * 100 + ((i % 9) + 1) * 10,
        });
      }
    }
  }
  return units;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

describe('hiệu năng rankUnits với 700 đơn vị', () => {
  const units = library();
  const profile = {
    currentLevel: 'N4' as const,
    goalType: 'work' as const,
    targetLevel: 'N3' as const,
    targetDate: null,
    skills: KINDS,
    prioritizedSkill: 'grammar' as const,
  };
  const params = buildPathParams(profile);
  const progress = new Map<string, UnitProgressStatus>(
    units.slice(0, 150).map((u, i) => [u.id, i % 7 === 0 ? 'in_progress' : 'completed']),
  );
  const stats = Array.from({ length: 30 }, (_, i) => ({
    topicId: `topic-vocabulary-N4-${i % 12}`,
    isWeak: i % 3 === 0,
    difficultyBias: (i % 5) - 2,
  }));

  it('thư viện đủ lớn (700 đơn vị) và xếp hạng đủ mọi đơn vị trong phạm vi', () => {
    expect(units).toHaveLength(700);
    expect(rankUnits(params, profile, units, progress, stats)).toHaveLength(700);
  });

  it(`trung vị < ${MEDIAN_BUDGET_MS} ms cho rankUnits + upcomingUnits`, () => {
    for (let i = 0; i < 20; i += 1)
      upcomingUnits(rankUnits(params, profile, units, progress, stats));
    const times: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const t0 = performance.now();
      upcomingUnits(rankUnits(params, profile, units, progress, stats));
      times.push(performance.now() - t0);
    }
    expect(median(times)).toBeLessThan(MEDIAN_BUDGET_MS);
  });
});
