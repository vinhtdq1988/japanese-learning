import { describe, expect, it } from 'vitest';
import { unionDurationSeconds } from '../../src/domain/intervals.js';

const at = (iso: string, durationSeconds: number) => ({
  startedAt: new Date(iso),
  durationSeconds,
});

describe('unionDurationSeconds (tổng thời gian học = độ dài hợp các khoảng)', () => {
  it('không có khoảng nào → 0', () => {
    expect(unionDurationSeconds([])).toBe(0);
  });

  it('các khoảng rời nhau được cộng dồn', () => {
    expect(
      unionDurationSeconds([at('2026-01-05T08:00:00Z', 60), at('2026-01-05T09:00:00Z', 120)]),
    ).toBe(180);
  });

  it('khoảng chồng nhau từ hai cửa sổ chỉ tính một lần', () => {
    // [0, 60) và [30, 90) → hợp [0, 90) = 90 giây, không phải 120.
    expect(
      unionDurationSeconds([at('2026-01-05T08:00:00Z', 60), at('2026-01-05T08:00:30Z', 60)]),
    ).toBe(90);
  });

  it('khoảng nằm trọn trong khoảng khác không làm tăng tổng', () => {
    expect(
      unionDurationSeconds([at('2026-01-05T08:00:00Z', 300), at('2026-01-05T08:01:00Z', 30)]),
    ).toBe(300);
  });

  it('khoảng liền kề (kết thúc đúng lúc khoảng sau bắt đầu) cộng lại, không đếm trùng', () => {
    expect(
      unionDurationSeconds([at('2026-01-05T08:01:00Z', 60), at('2026-01-05T08:00:00Z', 60)]),
    ).toBe(120);
  });

  it('thứ tự đầu vào không ảnh hưởng và trùng hoàn toàn chỉ tính một lần', () => {
    const a = at('2026-01-05T08:00:00Z', 45);
    expect(unionDurationSeconds([a, a, a])).toBe(45);
    expect(
      unionDurationSeconds([
        at('2026-01-05T10:00:00Z', 10),
        at('2026-01-05T08:00:00Z', 20),
        at('2026-01-05T08:00:10Z', 20),
      ]),
    ).toBe(40);
  });
});
