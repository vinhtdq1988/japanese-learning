import { describe, expect, it } from 'vitest';
import { unionDurationSeconds } from '../../src/domain/intervals.js';
import { currentStreakDays, isOnTrack } from '../../src/engine/progress.js';
import type { PausePeriod } from '../../src/engine/daily-plan.js';

// Kiểm thử đơn vị tính toán tiến độ (T085, R11, FR-027, FR-028): chuỗi ngày học, tổng thời gian là hợp
// các khoảng, và đánh giá "đúng tiến độ" so với mốc mục tiêu.

const days = (...list: string[]) => new Set(list);

describe('chuỗi ngày học (R11)', () => {
  it('chưa có hoạt động nào → 0', () => {
    expect(currentStreakDays(days(), '2026-01-10', [])).toBe(0);
  });

  it('đếm các ngày liên tiếp kết thúc hôm nay', () => {
    expect(
      currentStreakDays(days('2026-01-08', '2026-01-09', '2026-01-10'), '2026-01-10', []),
    ).toBe(3);
  });

  it('hôm nay chưa học thì chuỗi chưa đứt: đếm từ hôm qua', () => {
    expect(currentStreakDays(days('2026-01-08', '2026-01-09'), '2026-01-10', [])).toBe(2);
  });

  it('vắng cả hôm qua lẫn hôm nay → chuỗi đứt (0)', () => {
    expect(currentStreakDays(days('2026-01-07', '2026-01-08'), '2026-01-10', [])).toBe(0);
  });

  it('một ngày trống giữa chừng cắt chuỗi: chỉ tính đoạn gần nhất', () => {
    expect(
      currentStreakDays(
        days('2026-01-05', '2026-01-06', '2026-01-09', '2026-01-10'),
        '2026-01-10',
        [],
      ),
    ).toBe(2);
  });

  it('bỏ qua ngày tạm dừng: không cộng vào chuỗi và không làm đứt chuỗi', () => {
    // Học 01–02/01, tạm dừng [03, 06), học lại 06/01 → chuỗi = 3 ngày (01, 02, 06).
    const paused: PausePeriod[] = [{ startedOn: '2026-01-03', endedOn: '2026-01-06' }];
    expect(
      currentStreakDays(days('2026-01-01', '2026-01-02', '2026-01-06'), '2026-01-06', paused),
    ).toBe(3);
  });

  it('đúng cả khi tạm dừng rồi tiếp tục nhiều lần', () => {
    const paused: PausePeriod[] = [
      { startedOn: '2026-01-03', endedOn: '2026-01-05' },
      { startedOn: '2026-01-07', endedOn: '2026-01-09' },
    ];
    const active = days('2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-09');
    expect(currentStreakDays(active, '2026-01-09', paused)).toBe(5);
  });

  it('đang tạm dừng (giai đoạn mở) không làm đứt chuỗi', () => {
    const paused: PausePeriod[] = [{ startedOn: '2026-01-04', endedOn: null }];
    expect(currentStreakDays(days('2026-01-02', '2026-01-03'), '2026-01-10', paused)).toBe(2);
  });

  it('tạm dừng không "vá" một ngày vắng nằm ngoài giai đoạn', () => {
    const paused: PausePeriod[] = [{ startedOn: '2026-01-05', endedOn: '2026-01-07' }];
    // 04/01 vắng (ngoài giai đoạn) → đứt tại đó.
    expect(
      currentStreakDays(days('2026-01-03', '2026-01-07', '2026-01-08'), '2026-01-08', paused),
    ).toBe(2);
  });

  it('không đứt khi đổi múi giờ làm "hôm nay" lùi trước ngày học gần nhất đã lưu', () => {
    // Đã học 04/01 và 05/01 (ngày địa phương lưu lúc xảy ra); múi giờ mới khiến hôm nay là 04/01.
    expect(currentStreakDays(days('2026-01-04', '2026-01-05'), '2026-01-04', [])).toBe(2);
  });
});

describe('tổng thời gian học là hợp các khoảng', () => {
  const at = (iso: string) => new Date(iso);

  it('khoảng chồng nhau từ hai cửa sổ chỉ tính một lần', () => {
    const seconds = unionDurationSeconds([
      { startedAt: at('2026-01-05T08:00:00Z'), durationSeconds: 600 },
      { startedAt: at('2026-01-05T08:05:00Z'), durationSeconds: 600 },
    ]);
    expect(seconds).toBe(900);
  });

  it('khoảng rời nhau được cộng lại', () => {
    const seconds = unionDurationSeconds([
      { startedAt: at('2026-01-05T08:00:00Z'), durationSeconds: 300 },
      { startedAt: at('2026-01-06T08:00:00Z'), durationSeconds: 120 },
    ]);
    expect(seconds).toBe(420);
  });
});

describe('đúng tiến độ so với mốc (FR-028)', () => {
  const base = { dailyMinutes: 10, today: '2026-01-05' };

  it('không có mốc → null', () => {
    expect(isOnTrack({ ...base, remainingMinutes: 30, targetDate: null })).toBeNull();
  });

  it('không còn nội dung → đúng tiến độ (kể cả mốc đã qua)', () => {
    expect(isOnTrack({ ...base, remainingMinutes: 0, targetDate: '2026-01-01' })).toBe(true);
  });

  it('còn nội dung mà mốc đã đến/qua → chậm tiến độ', () => {
    expect(isOnTrack({ ...base, remainingMinutes: 5, targetDate: '2026-01-05' })).toBe(false);
    expect(isOnTrack({ ...base, remainingMinutes: 5, targetDate: '2026-01-02' })).toBe(false);
  });

  it('so ngày cần có (40% quỹ cho bài mới) với số ngày còn lại', () => {
    // 10 phút/ngày → 4 phút bài mới/ngày. 35 phút cần ceil(35/4) = 9 ngày.
    expect(isOnTrack({ ...base, remainingMinutes: 35, targetDate: '2026-01-14' })).toBe(true); // 9 ngày
    expect(isOnTrack({ ...base, remainingMinutes: 35, targetDate: '2026-01-13' })).toBe(false); // 8 ngày
  });

  it('thời gian mỗi ngày nhiều hơn thì kịp mốc gấp hơn', () => {
    const input = { remainingMinutes: 35, today: '2026-01-05', targetDate: '2026-01-10' };
    expect(isOnTrack({ ...input, dailyMinutes: 10 })).toBe(false);
    expect(isOnTrack({ ...input, dailyMinutes: 30 })).toBe(true); // 12 phút/ngày → 3 ngày
  });
});
