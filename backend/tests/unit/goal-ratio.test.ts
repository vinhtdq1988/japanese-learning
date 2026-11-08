import { describe, expect, it } from 'vitest';
import type { RankedStatus } from '../../src/engine/path.js';
import { goalRatio } from '../../src/engine/progress.js';

// `goalRatio` là nguồn DUY NHẤT của tỷ lệ mục tiêu cho `GET /progress` và thành tựu `goal_*` (spec 005, T047):
// phải trùng phép tính cũ của `getProgress` (done / ranked.length làm tròn 3 chữ số, 0 khi không có đơn vị).

const legacy = (ranked: { status: RankedStatus }[]): number => {
  const done = ranked.filter((r) => r.status === 'completed' || r.status === 'mastered').length;
  return ranked.length > 0 ? Math.round((done / ranked.length) * 1000) / 1000 : 0;
};

const make = (...statuses: RankedStatus[]) => statuses.map((status) => ({ status }));

describe('goalRatio', () => {
  it('danh sách rỗng → 0/0, tỷ lệ 0', () => {
    expect(goalRatio([])).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it('đếm completed và mastered là xong; pending/in_progress chưa xong', () => {
    const ranked = make('completed', 'mastered', 'in_progress', 'pending');
    expect(goalRatio(ranked)).toEqual({ done: 2, total: 4, ratio: 0.5 });
  });

  it('trùng phép tính cũ của getProgress trên nhiều cấu hình', () => {
    const cases: RankedStatus[][] = [
      ['pending'],
      ['completed'],
      ['completed', 'pending', 'pending'],
      ['mastered', 'completed', 'in_progress', 'pending', 'pending', 'pending', 'pending'],
      Array.from({ length: 37 }, (_, i): RankedStatus => (i % 3 === 0 ? 'completed' : 'pending')),
    ];
    for (const statuses of cases) {
      const ranked = make(...statuses);
      expect(goalRatio(ranked).ratio).toBe(legacy(ranked));
    }
  });
});
