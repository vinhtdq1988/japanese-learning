import { describe, expect, it } from 'vitest';
import type { RankedStatus } from '../../src/engine/path.js';
import { goalRatio } from '../../src/engine/progress.js';

// `goalRatio` là nguồn DUY NHẤT của tỷ lệ mục tiêu cho `GET /progress` và thành tựu `goal_*` (spec 005, T047).
// Từ spec 008 (T208, D12, C4) tỷ lệ tính theo TỔNG PHÚT: Σ `estMinutes` đã xong / Σ `estMinutes` trong phạm vi
// (làm tròn 3 chữ số, 0 khi không có đơn vị). Thư viện chỉ gồm đơn vị cùng thời lượng cho kết quả như đếm đơn vị.

interface Row {
  status: RankedStatus;
  unit: { estMinutes: number };
}

const legacy = (ranked: { status: RankedStatus }[]): number => {
  const done = ranked.filter((r) => r.status === 'completed' || r.status === 'mastered').length;
  return ranked.length > 0 ? Math.round((done / ranked.length) * 1000) / 1000 : 0;
};

const row = (status: RankedStatus, estMinutes: number): Row => ({ status, unit: { estMinutes } });
const make = (minutes: number, ...statuses: RankedStatus[]): Row[] =>
  statuses.map((s) => row(s, minutes));

describe('goalRatio theo phút', () => {
  it('danh sách rỗng → 0/0, tỷ lệ 0', () => {
    expect(goalRatio([])).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it('done/total là số PHÚT; completed và mastered là xong, pending/in_progress chưa xong', () => {
    const ranked = [
      row('completed', 10),
      row('mastered', 5),
      row('in_progress', 10),
      row('pending', 5),
    ];
    expect(goalRatio(ranked)).toEqual({ done: 15, total: 30, ratio: 0.5 });
  });

  it('làm tròn 3 chữ số và nằm trong [0, 1]', () => {
    const ranked = [row('completed', 5), row('pending', 10), row('pending', 10)];
    const { ratio } = goalRatio(ranked);
    expect(ratio).toBe(0.2); // 5 / 25
    const thirds = [row('completed', 5), row('pending', 5), row('pending', 5)];
    expect(goalRatio(thirds).ratio).toBe(0.333);
    for (const r of [goalRatio(ranked), goalRatio(thirds), goalRatio(make(5, 'pending'))]) {
      expect(r.ratio).toBeGreaterThanOrEqual(0);
      expect(r.ratio).toBeLessThanOrEqual(1);
    }
    expect(goalRatio(make(10, 'completed', 'completed')).ratio).toBe(1);
  });

  it('tăng khi hoàn thành thêm một đơn vị, đơn vị 10 phút tăng nhiều hơn đơn vị 5 phút', () => {
    const before = [row('pending', 5), row('pending', 10), row('completed', 5), row('pending', 10)];
    const base = goalRatio(before).ratio;
    const after5 = goalRatio(before.map((r, i) => (i === 0 ? row('completed', 5) : r))).ratio;
    const after10 = goalRatio(before.map((r, i) => (i === 1 ? row('completed', 10) : r))).ratio;
    expect(after5).toBeGreaterThan(base);
    expect(after10).toBeGreaterThan(after5);
  });

  it('nhất quán: Σ phút xong ≤ Σ phút phạm vi và tăng đơn điệu khi xong dần từng đơn vị', () => {
    const minutes = [5, 10, 5, 10, 10, 5, 5, 10];
    let previous = -1;
    for (let done = 0; done <= minutes.length; done += 1) {
      const ranked = minutes.map((m, i) => row(i < done ? 'completed' : 'pending', m));
      const g = goalRatio(ranked);
      expect(g.total).toBe(minutes.reduce((a, b) => a + b, 0));
      expect(g.done).toBeLessThanOrEqual(g.total);
      expect(g.ratio).toBeGreaterThanOrEqual(previous);
      previous = g.ratio;
    }
  });

  it('thư viện chỉ gồm đơn vị cùng thời lượng cho kết quả như đếm đơn vị (phép tính cũ)', () => {
    const cases: RankedStatus[][] = [
      ['pending'],
      ['completed'],
      ['completed', 'pending', 'pending'],
      ['mastered', 'completed', 'in_progress', 'pending', 'pending', 'pending', 'pending'],
      Array.from({ length: 37 }, (_, i): RankedStatus => (i % 3 === 0 ? 'completed' : 'pending')),
    ];
    for (const statuses of cases) {
      for (const minutes of [5, 10, 15]) {
        const ranked = make(minutes, ...statuses);
        expect(goalRatio(ranked).ratio).toBe(legacy(ranked));
      }
    }
  });

  it('khác phép đếm đơn vị khi thời lượng lệch nhau (từ vựng 5 phút xong hết, ngữ pháp 10 phút chưa)', () => {
    const ranked = [
      ...Array.from({ length: 6 }, () => row('completed', 5)),
      ...Array.from({ length: 4 }, () => row('pending', 10)),
    ];
    expect(legacy(ranked)).toBe(0.6);
    expect(goalRatio(ranked).ratio).toBe(0.429); // 30 / 70
  });
});
