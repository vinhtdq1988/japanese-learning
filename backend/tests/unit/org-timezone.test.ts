import { describe, expect, it } from 'vitest';
import { assignmentState } from '../../src/engine/class-path.js';
import { expectedRatio } from '../../src/engine/class-progress.js';
import { FakeClock, localToday, toLocalDate } from '../../src/engine/clock.js';
import { absentDays } from '../../src/engine/daily-plan.js';
import { isLicenseEffective, licenseStateOn } from '../../src/engine/seats.js';

// Ranh giới múi giờ và đồng hồ giả (spec 004, T132, FR-006, FR-019, FR-031; quy ước chung của tasks.md): ngày
// giấy phép tính theo `ORG_TIMEZONE`, còn ngày học / hạn bài giao / số ngày vắng tính theo múi giờ TỪNG học viên.

const HCM = 'Asia/Ho_Chi_Minh'; // UTC+7 (ORG_TIMEZONE mặc định)
const TOKYO = 'Asia/Tokyo'; // UTC+9
const LA = 'America/Los_Angeles'; // UTC-8 (mùa đông)

describe('ngày giấy phép theo ORG_TIMEZONE', () => {
  const license = { startsOn: '2026-01-01', endsOn: '2026-01-31', graceDays: 7, revokedAt: null };

  it('23:59 và 00:01 giờ Việt Nam rơi vào hai ngày khác nhau dù cùng khoảnh khắc UTC khác nhau 2 phút', () => {
    const before = new FakeClock('2026-01-31T16:59:00Z'); // 23:59 ngày 31/01 giờ Việt Nam
    const after = new FakeClock('2026-01-31T17:01:00Z'); // 00:01 ngày 01/02 giờ Việt Nam
    expect(localToday(before, HCM)).toBe('2026-01-31');
    expect(localToday(after, HCM)).toBe('2026-02-01');
    // Hết `ends_on` ngay khi sang ngày mới theo ORG_TIMEZONE (không phải theo UTC).
    expect(licenseStateOn(license, localToday(before, HCM), 14)).toBe('expiring');
    expect(licenseStateOn(license, localToday(after, HCM), 14)).toBe('in_grace');
  });

  it('ân hạn kết thúc đúng cuối ngày ends_on + grace_days theo múi giờ tổ chức', () => {
    const lastDay = new FakeClock('2026-02-07T16:59:00Z'); // 23:59 ngày 07/02 (31/01 + 7 ngày)
    const nextDay = new FakeClock('2026-02-07T17:01:00Z'); // 00:01 ngày 08/02
    expect(isLicenseEffective(license, localToday(lastDay, HCM))).toBe(true);
    expect(licenseStateOn(license, localToday(lastDay, HCM), 14)).toBe('in_grace');
    expect(isLicenseEffective(license, localToday(nextDay, HCM))).toBe(false);
    expect(licenseStateOn(license, localToday(nextDay, HCM), 14)).toBe('lapsed');
  });

  it('giấy phép bắt đầu theo ngày địa phương của tổ chức, không theo UTC', () => {
    const fresh = { ...license, startsOn: '2026-03-01', endsOn: '2026-03-31' };
    // 17:30 UTC ngày 28/02 = 00:30 ngày 01/03 giờ Việt Nam ⇒ đã có hiệu lực dù UTC vẫn là 28/02.
    const clock = new FakeClock('2026-02-28T17:30:00Z');
    expect(toLocalDate(clock.now(), 'UTC')).toBe('2026-02-28');
    expect(isLicenseEffective(fresh, localToday(clock, HCM))).toBe(true);
    expect(isLicenseEffective(fresh, toLocalDate(clock.now(), 'UTC'))).toBe(false);
  });
});

describe('ngày học theo múi giờ từng học viên', () => {
  it('cùng một khoảnh khắc là ba ngày khác nhau ở ba múi giờ', () => {
    const instant = new Date('2026-01-10T16:30:00Z');
    expect(toLocalDate(instant, LA)).toBe('2026-01-10'); // 08:30
    expect(toLocalDate(instant, HCM)).toBe('2026-01-10'); // 23:30
    expect(toLocalDate(instant, TOKYO)).toBe('2026-01-11'); // 01:30 hôm sau
  });

  it('hạn bài giao: hoàn thành 23:59 giờ địa phương ngày hạn là đúng hạn, 00:01 hôm sau là trễ', () => {
    const base = {
      dueOn: '2026-01-15',
      assignedAt: new Date('2026-01-01T00:00:00Z'),
      today: '2026-01-16',
    };
    // Học viên ở Việt Nam.
    expect(
      assignmentState({
        ...base,
        timezone: HCM,
        completedAt: new Date('2026-01-15T16:59:00Z'), // 23:59 ngày 15
      }),
    ).toBe('on_time');
    expect(
      assignmentState({
        ...base,
        timezone: HCM,
        completedAt: new Date('2026-01-15T17:01:00Z'), // 00:01 ngày 16
      }),
    ).toBe('late');
    // Cùng khoảnh khắc 17:01Z nhưng học viên ở Los Angeles (09:01 ngày 15) thì vẫn đúng hạn.
    expect(
      assignmentState({
        ...base,
        timezone: LA,
        completedAt: new Date('2026-01-15T17:01:00Z'),
      }),
    ).toBe('on_time');
  });

  it('chưa xong: quá hạn chỉ khi hôm nay (theo múi giờ học viên) sau ngày hạn', () => {
    const input = {
      dueOn: '2026-01-15',
      assignedAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: null,
      timezone: HCM,
    };
    expect(assignmentState({ ...input, today: '2026-01-15' })).toBe('pending');
    expect(assignmentState({ ...input, today: '2026-01-16' })).toBe('overdue');
  });

  it('số ngày vắng: ngày hôm nay theo múi giờ học viên quyết định có tính thêm một ngày vắng hay không', () => {
    const clock = new FakeClock('2026-01-10T16:30:00Z');
    const lastActive = '2026-01-07';
    const hcm = localToday(clock, HCM); // 2026-01-10
    const tokyo = localToday(clock, TOKYO); // 2026-01-11
    expect(absentDays(lastActive, hcm, [])).toBe(3);
    expect(absentDays(lastActive, tokyo, [])).toBe(4);
  });
});

describe('đổi múi giờ giữa kỳ', () => {
  it('ngày vào lớp tính lại theo múi giờ mới nhưng số ngày vắng/mong đợi vẫn nhất quán trên nhãn ngày địa phương', () => {
    // Học viên vào lớp lúc 20:00Z ngày 05/01: là 03:00 ngày 06/01 ở Việt Nam, nhưng 12:00 ngày 05/01 ở Los Angeles.
    const joinedAt = new Date('2026-01-05T20:00:00Z');
    expect(toLocalDate(joinedAt, HCM)).toBe('2026-01-06');
    expect(toLocalDate(joinedAt, LA)).toBe('2026-01-05');

    // Sau khi đổi sang múi giờ khác, "hôm nay" suy ra từ múi giờ HIỆN TẠI và số ngày vắng đo trên cùng một
    // nhãn ngày địa phương nên không bao giờ âm hay đảo chiều.
    const clock = new FakeClock('2026-01-12T03:00:00Z');
    const todayHcm = localToday(clock, HCM); // 2026-01-12
    const todayLa = localToday(clock, LA); // 2026-01-11
    expect(todayHcm).toBe('2026-01-12');
    expect(todayLa).toBe('2026-01-11');
    expect(absentDays('2026-01-09', todayLa, [])).toBe(2);
    expect(absentDays('2026-01-09', todayHcm, [])).toBe(3);
    // Học viên chuyển sang múi giờ "trễ hơn" mà lastActive vẫn là nhãn cũ: không âm.
    expect(absentDays('2026-01-12', todayLa, [])).toBeGreaterThanOrEqual(0);
  });

  it('tỷ lệ mong đợi chỉ phụ thuộc nhãn ngày địa phương hôm nay: đổi múi giờ làm hôm nay lùi/tiến đúng một ngày', () => {
    const input = { startsOn: '2026-01-05', endsOn: '2026-01-15', shiftDays: 0, pauses: [] };
    const clock = new FakeClock('2026-01-10T16:30:00Z');
    const hcm = expectedRatio({ ...input, today: localToday(clock, HCM) }); // 2026-01-10 ⇒ 5/10
    const tokyo = expectedRatio({ ...input, today: localToday(clock, TOKYO) }); // 2026-01-11 ⇒ 6/10
    const la = expectedRatio({ ...input, today: localToday(clock, LA) }); // 2026-01-10 ⇒ 5/10
    expect(hcm).toBeCloseTo(0.5);
    expect(tokyo).toBeCloseTo(0.6);
    expect(la).toBeCloseTo(0.5);
  });
});
