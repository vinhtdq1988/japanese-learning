import { describe, expect, it } from 'vitest';
import type { CatalogUnit } from '../../src/services/content-cache.js';
import { pickTrialUnits, TRIAL_MAX_MINUTES } from '../../src/services/trial.js';

// Chọn tập dùng thử mặc định (R9): mỗi kỹ năng một đơn vị `is_trial`, tổng ≤ 10 phút.

function unit(id: string, overrides: Partial<CatalogUnit> = {}): CatalogUnit {
  return {
    id,
    kind: 'vocabulary',
    level: 'N5',
    tier: 'foundation',
    goalTags: [],
    topicId: 't',
    difficulty: 1,
    estMinutes: 5,
    sequence: 1,
    status: 'active',
    title: { vi: id, en: id },
    isTrial: true,
    ...overrides,
  } as CatalogUnit;
}

describe('pickTrialUnits', () => {
  it('chọn 1 từ vựng + 1 ngữ pháp trong các đơn vị is_trial', () => {
    const picked = pickTrialUnits([
      unit('v1'),
      unit('g1', { kind: 'grammar' }),
      unit('khong-thu', { isTrial: false, sequence: 0 }),
    ]);
    expect(picked.map((u) => u.id)).toEqual(['v1', 'g1']);
  });

  it('ưu tiên đơn vị ngắn hơn rồi theo sequence', () => {
    const picked = pickTrialUnits([
      unit('v-dai', { estMinutes: 10, sequence: 1 }),
      unit('v-ngan-2', { estMinutes: 5, sequence: 2 }),
      unit('v-ngan-1', { estMinutes: 5, sequence: 1 }),
    ]);
    expect(picked.map((u) => u.id)).toEqual(['v-ngan-1']);
  });

  it('bỏ đơn vị làm tổng vượt giới hạn thời lượng', () => {
    const picked = pickTrialUnits([
      unit('v', { estMinutes: 10 }),
      unit('g', { kind: 'grammar', estMinutes: 10 }),
    ]);
    expect(picked.map((u) => u.id)).toEqual(['v']);
    expect(picked.reduce((s, u) => s + u.estMinutes, 0)).toBeLessThanOrEqual(TRIAL_MAX_MINUTES);
  });

  it('không có đơn vị dùng thử → rỗng', () => {
    expect(pickTrialUnits([unit('v', { isTrial: false })])).toEqual([]);
  });
});
