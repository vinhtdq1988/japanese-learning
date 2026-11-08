import { describe, expect, it } from 'vitest';
import {
  availableSeats,
  graceEndsOn,
  isLicenseEffective,
  licenseStateOn,
  pickSeatToAssign,
  type FreeSeat,
  type LicenseDates,
} from '../../src/engine/seats.js';

// Kiểm thử thuật toán seat (spec 004, T015, research O3, FR-004/FR-005).

const seat = (id: string, last: string | null, count: number): FreeSeat => ({
  id,
  lastHolderUserId: last,
  reassignmentCount: count,
});

describe('pickSeatToAssign', () => {
  it('ưu tiên seat người này từng giữ và KHÔNG tăng đếm đổi người (quay lại không tính đổi)', () => {
    const pick = pickSeatToAssign(
      [seat('s1', null, 0), seat('s2', 'u-other', 1), seat('s3', 'u-me', 2)],
      'u-me',
      2,
    );
    expect(pick).toEqual({ kind: 'assign', seatId: 's3', countsAsReassignment: false });
  });

  it('quay lại vẫn được dù seat đó đã hết lượt đổi', () => {
    const pick = pickSeatToAssign([seat('s1', 'u-me', 2)], 'u-me', 2);
    expect(pick).toEqual({ kind: 'assign', seatId: 's1', countsAsReassignment: false });
  });

  it('không có seat cũ: dùng seat chưa từng có người giữ, không tăng đếm', () => {
    const pick = pickSeatToAssign([seat('s1', 'u-other', 0), seat('s2', null, 0)], 'u-me', 2);
    expect(pick).toEqual({ kind: 'assign', seatId: 's2', countsAsReassignment: false });
  });

  it('chỉ còn seat của người khác: gán và tính là một lần đổi', () => {
    const pick = pickSeatToAssign([seat('s1', 'u-other', 1)], 'u-me', 2);
    expect(pick).toEqual({ kind: 'assign', seatId: 's1', countsAsReassignment: true });
  });

  it('nhiều seat của người khác: chọn seat đã đổi ít nhất để dàn đều', () => {
    const pick = pickSeatToAssign(
      [seat('s1', 'a', 2), seat('s2', 'b', 0), seat('s3', 'c', 1)],
      'u-me',
      3,
    );
    expect(pick).toEqual({ kind: 'assign', seatId: 's2', countsAsReassignment: true });
  });

  it('bỏ qua seat đã đạt giới hạn đổi, chọn seat còn lượt', () => {
    const pick = pickSeatToAssign([seat('s1', 'a', 2), seat('s2', 'b', 1)], 'u-me', 2);
    expect(pick).toEqual({ kind: 'assign', seatId: 's2', countsAsReassignment: true });
  });

  it('mọi seat trống đã hết lượt đổi: reassign_limit (khác với hết seat)', () => {
    expect(pickSeatToAssign([seat('s1', 'a', 2), seat('s2', 'b', 5)], 'u-me', 2)).toEqual({
      kind: 'reassign_limit',
    });
  });

  it('giới hạn đổi bằng 0: seat của người khác không gán được', () => {
    expect(pickSeatToAssign([seat('s1', 'a', 0)], 'u-me', 0)).toEqual({ kind: 'reassign_limit' });
    // Seat chưa từng có người giữ vẫn gán được.
    expect(pickSeatToAssign([seat('s1', null, 0)], 'u-me', 0)).toMatchObject({ kind: 'assign' });
  });

  it('không còn seat trống: no_free_seat', () => {
    expect(pickSeatToAssign([], 'u-me', 2)).toEqual({ kind: 'no_free_seat' });
  });

  it('kết quả ổn định theo thứ tự đầu vào khi hòa', () => {
    const pick = pickSeatToAssign([seat('s1', null, 0), seat('s2', null, 0)], 'u-me', 2);
    expect(pick).toMatchObject({ seatId: 's1' });
  });
});

describe('availableSeats', () => {
  it('trừ lời mời đang chờ khỏi seat có thể gán (giữ chỗ)', () => {
    expect(
      availableSeats({ totalSeats: 10, usedSeats: 4, assignableFree: 6, reservedInvitations: 2 }),
    ).toBe(4);
  });

  it('không âm khi giữ chỗ vượt seat trống', () => {
    expect(
      availableSeats({ totalSeats: 5, usedSeats: 4, assignableFree: 1, reservedInvitations: 3 }),
    ).toBe(0);
  });

  it('không vượt seat trống thực tế dù assignableFree lớn hơn', () => {
    expect(
      availableSeats({ totalSeats: 5, usedSeats: 4, assignableFree: 9, reservedInvitations: 0 }),
    ).toBe(1);
  });

  it('seat trống nhưng hết lượt đổi (assignableFree = 0): không còn chỗ', () => {
    expect(
      availableSeats({ totalSeats: 5, usedSeats: 3, assignableFree: 0, reservedInvitations: 0 }),
    ).toBe(0);
  });

  it('đầu vào âm hoặc bất thường vẫn cho kết quả không âm', () => {
    expect(
      availableSeats({ totalSeats: 0, usedSeats: 0, assignableFree: 0, reservedInvitations: 0 }),
    ).toBe(0);
    expect(
      availableSeats({ totalSeats: 3, usedSeats: 5, assignableFree: 2, reservedInvitations: 0 }),
    ).toBe(0);
    expect(
      availableSeats({ totalSeats: 3, usedSeats: 0, assignableFree: 3, reservedInvitations: -4 }),
    ).toBe(3);
  });
});

describe('hiệu lực và trạng thái giấy phép (FR-006, FR-038)', () => {
  const license: LicenseDates = {
    startsOn: '2026-01-01',
    endsOn: '2026-06-30',
    graceDays: 7,
    revokedAt: null,
  };

  it('graceEndsOn = ends_on + grace_days', () => {
    expect(graceEndsOn(license)).toBe('2026-07-07');
    expect(graceEndsOn({ ...license, graceDays: 0 })).toBe('2026-06-30');
  });

  it('còn hiệu lực từ ngày bắt đầu đến hết ân hạn, kể cả ngày biên', () => {
    expect(isLicenseEffective(license, '2025-12-31')).toBe(false);
    expect(isLicenseEffective(license, '2026-01-01')).toBe(true);
    expect(isLicenseEffective(license, '2026-06-30')).toBe(true);
    expect(isLicenseEffective(license, '2026-07-07')).toBe(true);
    expect(isLicenseEffective(license, '2026-07-08')).toBe(false);
  });

  it('giấy phép bị thu hồi không bao giờ hiệu lực và luôn lapsed', () => {
    const revoked = { ...license, revokedAt: new Date('2026-03-01T00:00:00Z') };
    expect(isLicenseEffective(revoked, '2026-03-02')).toBe(false);
    expect(licenseStateOn(revoked, '2026-03-02', 14)).toBe('lapsed');
  });

  it('trạng thái: ok → expiring (≤ 14 ngày) → in_grace → lapsed', () => {
    expect(licenseStateOn(license, '2026-03-01', 14)).toBe('ok');
    expect(licenseStateOn(license, '2026-06-15', 14)).toBe('ok'); // còn 15 ngày
    expect(licenseStateOn(license, '2026-06-16', 14)).toBe('expiring'); // còn đúng 14 ngày
    expect(licenseStateOn(license, '2026-06-30', 14)).toBe('expiring'); // đúng ngày hết hạn
    expect(licenseStateOn(license, '2026-07-01', 14)).toBe('in_grace');
    expect(licenseStateOn(license, '2026-07-07', 14)).toBe('in_grace');
    expect(licenseStateOn(license, '2026-07-08', 14)).toBe('lapsed');
  });

  it('ân hạn bằng 0: hết hạn là lapsed ngay ngày kế tiếp', () => {
    const noGrace = { ...license, graceDays: 0 };
    expect(licenseStateOn(noGrace, '2026-06-30', 14)).toBe('expiring');
    expect(licenseStateOn(noGrace, '2026-07-01', 14)).toBe('lapsed');
  });
});
