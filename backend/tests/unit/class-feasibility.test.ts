import { describe, expect, it } from 'vitest';
import { computeFeasibility } from '../../src/engine/class-path.js';

// Cảnh báo khả thi của lộ trình lớp (spec 004, T061, FR-025, research O7): sức chứa = số ngày còn lại không
// tạm dừng × phút/ngày; vượt sức chứa chỉ là cảnh báo, không chặn lưu.

const base = {
  today: '2026-01-05',
  startsOn: '2026-01-05',
  endsOn: '2026-01-14', // 10 ngày (cả hai đầu)
  dailyMinutes: 10,
};

describe('computeFeasibility', () => {
  it('sức chứa = số ngày còn lại × phút/ngày; đủ sức chứa thì overBy = 0', () => {
    const f = computeFeasibility({ ...base, remainingMinutes: 80 });
    expect(f).toEqual({ requiredMinutes: 80, capacityMinutes: 100, overBy: 0 });
  });

  it('vượt sức chứa ⇒ overBy dương', () => {
    const f = computeFeasibility({ ...base, remainingMinutes: 130 });
    expect(f).toEqual({ requiredMinutes: 130, capacityMinutes: 100, overBy: 30 });
  });

  it('ngày tạm dừng không tính vào sức chứa (nửa khoảng [startedOn, endedOn))', () => {
    const f = computeFeasibility({
      ...base,
      remainingMinutes: 50,
      pauses: [{ startedOn: '2026-01-07', endedOn: '2026-01-10' }], // 3 ngày
    });
    expect(f.capacityMinutes).toBe(70);
    const open = computeFeasibility({
      ...base,
      remainingMinutes: 50,
      pauses: [{ startedOn: '2026-01-12', endedOn: null }], // 12, 13, 14
    });
    expect(open.capacityMinutes).toBe(70);
  });

  it('chỉ tính từ hôm nay khi lớp đã bắt đầu; chưa bắt đầu thì tính từ ngày bắt đầu', () => {
    const midway = computeFeasibility({ ...base, today: '2026-01-10', remainingMinutes: 10 });
    expect(midway.capacityMinutes).toBe(50); // 10..14
    const future = computeFeasibility({ ...base, today: '2025-12-20', remainingMinutes: 10 });
    expect(future.capacityMinutes).toBe(100);
  });

  it('quá mốc kết thúc ⇒ sức chứa 0, mọi khối lượng còn lại đều vượt', () => {
    const f = computeFeasibility({ ...base, today: '2026-02-01', remainingMinutes: 25 });
    expect(f).toEqual({ requiredMinutes: 25, capacityMinutes: 0, overBy: 25 });
  });

  it('khối lượng bằng đúng sức chứa không bị cảnh báo', () => {
    expect(computeFeasibility({ ...base, remainingMinutes: 100 }).overBy).toBe(0);
  });
});
