import { describe, expect, it } from 'vitest';
import {
  FakeClock,
  addDays,
  daysInRange,
  diffDays,
  isValidTimezone,
  localToday,
  toLocalDate,
} from '../../src/engine/clock.js';

describe('ngày địa phương theo múi giờ IANA (R11)', () => {
  it('cùng một thời điểm UTC cho ngày địa phương khác nhau theo múi giờ', () => {
    const instant = new Date('2026-01-05T20:30:00Z');
    expect(toLocalDate(instant, 'UTC')).toBe('2026-01-05');
    // UTC+7: đã sang ngày 06
    expect(toLocalDate(instant, 'Asia/Ho_Chi_Minh')).toBe('2026-01-06');
    // UTC-5: vẫn ngày 05
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-01-05');
  });

  it('localToday dùng Clock được tiêm và theo kịp khi tiến thời gian', () => {
    const clock = new FakeClock('2026-03-01T16:59:00Z'); // 23:59 giờ Việt Nam
    expect(localToday(clock, 'Asia/Ho_Chi_Minh')).toBe('2026-03-01');
    clock.advanceMinutes(2);
    expect(localToday(clock, 'Asia/Ho_Chi_Minh')).toBe('2026-03-02');
    clock.advanceDays(30);
    expect(localToday(clock, 'Asia/Ho_Chi_Minh')).toBe('2026-04-01');
  });

  it('nhận biết múi giờ hợp lệ/không hợp lệ', () => {
    expect(isValidTimezone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});

describe('phép tính trên ngày địa phương', () => {
  it('addDays xử lý qua tháng/năm/năm nhuận', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays đếm số ngày giữa hai ngày', () => {
    expect(diffDays('2026-01-05', '2026-01-10')).toBe(5);
    expect(diffDays('2026-01-10', '2026-01-05')).toBe(-5);
    expect(diffDays('2026-01-05', '2026-01-05')).toBe(0);
  });

  it('daysInRange là nửa khoảng [from, to)', () => {
    expect(daysInRange('2026-01-01', '2026-01-04')).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(daysInRange('2026-01-04', '2026-01-04')).toEqual([]);
    expect(daysInRange('2026-01-05', '2026-01-01')).toEqual([]);
  });

  it('từ chối ngày không hợp lệ', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
    expect(() => addDays('hôm nay', 1)).toThrow();
  });
});
