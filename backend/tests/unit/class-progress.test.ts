import { describe, expect, it } from 'vitest';
import {
  completionRatio,
  computeAlerts,
  expectedRatio,
  hasStarted,
  pathCompleted,
  progressStatus,
} from '../../src/engine/class-progress.js';
import { isPausedOn } from '../../src/engine/daily-plan.js';
import { loadClassProfile } from '../fixtures/learner-profiles/class-index.js';

// Engine tiến độ lớp (spec 004, T079, research O10, FR-027/FR-028): tỷ lệ hoàn thành, tỷ lệ mong đợi theo
// ngày làm việc, trạng thái so với mốc, cảnh báo (`computeAlerts`, US7, T112). Thuần hàm, không CSDL/đồng hồ.

describe('completionRatio', () => {
  it('null khi tập đơn vị bắt buộc rỗng (không chia cho 0)', () => {
    expect(completionRatio([], new Set(['a']))).toBeNull();
  });

  it('đếm đơn vị bắt buộc đã hoàn thành/thành thạo trên tổng đơn vị bắt buộc', () => {
    expect(completionRatio(['a', 'b', 'c', 'd'], new Set(['a', 'c']))).toBe(0.5);
    expect(completionRatio(['a', 'b'], new Set())).toBe(0);
    expect(completionRatio(['a', 'b'], new Set(['a', 'b']))).toBe(1);
  });

  it('bỏ qua đơn vị hoàn thành nằm ngoài tập bắt buộc (đã miễn/không còn active)', () => {
    expect(completionRatio(['a', 'b'], new Set(['a', 'x', 'y']))).toBe(0.5);
  });
});

describe('expectedRatio (ngày làm việc, loại khoảng tạm dừng, dời mốc)', () => {
  // Mốc 10 ngày: 05..14/01 (nửa khoảng [startsOn, endsOn)); ngày làm việc đã qua = ngày trọn vẹn trước hôm nay.
  const base = { startsOn: '2026-01-05', endsOn: '2026-01-15', shiftDays: 0, pauses: [] };

  it('E = 0 trước và đúng ngày bắt đầu', () => {
    expect(expectedRatio({ ...base, today: '2026-01-01' })).toBe(0);
    expect(expectedRatio({ ...base, today: '2026-01-05' })).toBe(0);
  });

  it('E = 1 từ ngày kết thúc trở đi', () => {
    expect(expectedRatio({ ...base, today: '2026-01-15' })).toBe(1);
    expect(expectedRatio({ ...base, today: '2026-03-01' })).toBe(1);
  });

  it('tuyến tính theo số ngày đã qua khi không tạm dừng', () => {
    expect(expectedRatio({ ...base, today: '2026-01-10' })).toBeCloseTo(0.5, 10);
    expect(expectedRatio({ ...base, today: '2026-01-06' })).toBeCloseTo(0.1, 10);
  });

  it('ngày tạm dừng không tính vào cả tử lẫn mẫu', () => {
    const pauses = [{ startedOn: '2026-01-07', endedOn: '2026-01-09' }]; // 07, 08 nghỉ ⇒ 8 ngày làm việc
    // Đã qua trước 10/01: 05, 06, 09 = 3 ngày ⇒ 3/8.
    expect(expectedRatio({ ...base, pauses, today: '2026-01-10' })).toBeCloseTo(3 / 8, 10);
    // Hôm nay nằm trong kỳ nghỉ: không tiến thêm so với ngày làm việc cuối.
    expect(expectedRatio({ ...base, pauses, today: '2026-01-08' })).toBeCloseTo(2 / 8, 10);
  });

  it('khoảng tạm dừng mở (endedOn null) chỉ loại các ngày từ startedOn trở đi', () => {
    const pauses = [{ startedOn: '2026-01-10', endedOn: null }];
    // Làm việc: 05..09 (5 ngày); đã qua trước 12/01 = 5 ⇒ 5/5.
    expect(expectedRatio({ ...base, pauses, today: '2026-01-12' })).toBe(1);
  });

  it('shiftDays dời cả hai mốc của riêng học viên (dương = muộn hơn, âm = sớm hơn)', () => {
    // Mốc dời +2: 07..16/01 (10 ngày); trước 10/01 đã qua 07, 08, 09 = 3.
    expect(expectedRatio({ ...base, shiftDays: 2, today: '2026-01-10' })).toBeCloseTo(0.3, 10);
    expect(expectedRatio({ ...base, shiftDays: 2, today: '2026-01-07' })).toBe(0);
    // Mốc dời -2: 03..12/01; trước 10/01 đã qua 7 ngày.
    expect(expectedRatio({ ...base, shiftDays: -2, today: '2026-01-10' })).toBeCloseTo(0.7, 10);
    expect(expectedRatio({ ...base, shiftDays: -2, today: '2026-01-13' })).toBe(1);
  });

  it('mọi ngày trong mốc đều tạm dừng: không chia cho 0 (0 trước ngày kết thúc, 1 từ đó)', () => {
    const pauses = [{ startedOn: '2026-01-01', endedOn: '2026-02-01' }];
    expect(expectedRatio({ ...base, pauses, today: '2026-01-10' })).toBe(0);
    expect(expectedRatio({ ...base, pauses, today: '2026-01-15' })).toBe(1);
  });

  it('luôn nằm trong [0, 1]', () => {
    for (const today of ['2025-12-01', '2026-01-05', '2026-01-09', '2026-01-14', '2027-01-01']) {
      const e = expectedRatio({ ...base, today });
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });
});

describe('progressStatus', () => {
  const input = {
    completionRatio: 0.5 as number | null,
    expectedRatio: 0.5,
    margin: 0.1,
    paused: false,
    hasOverdueAssignment: false,
  };

  it('on_track khi trong biên ±margin (kể cả đúng biên)', () => {
    expect(progressStatus(input)).toBe('on_track');
    expect(progressStatus({ ...input, completionRatio: 0.45 })).toBe('on_track');
    expect(progressStatus({ ...input, completionRatio: 0.4 + 1e-9 })).toBe('on_track');
    expect(progressStatus({ ...input, completionRatio: 0.55 })).toBe('on_track');
  });

  it('behind khi thấp hơn mong đợi quá margin', () => {
    expect(progressStatus({ ...input, completionRatio: 0.3 })).toBe('behind');
    expect(progressStatus({ ...input, completionRatio: 0 })).toBe('behind');
  });

  it('ahead khi cao hơn mong đợi quá margin', () => {
    expect(progressStatus({ ...input, completionRatio: 0.7 })).toBe('ahead');
    expect(progressStatus({ ...input, completionRatio: 1 })).toBe('ahead');
  });

  it('có bài giao quá hạn ⇒ behind dù tỷ lệ hoàn thành tốt', () => {
    expect(progressStatus({ ...input, completionRatio: 0.9, hasOverdueAssignment: true })).toBe(
      'behind',
    );
  });

  it('paused ưu tiên trên mọi trạng thái khác (kể cả bài giao quá hạn)', () => {
    expect(
      progressStatus({ ...input, completionRatio: 0, paused: true, hasOverdueAssignment: true }),
    ).toBe('paused');
  });

  it('lớp không có đơn vị bắt buộc (ratio null) ⇒ on_track, trừ khi có bài giao quá hạn', () => {
    expect(progressStatus({ ...input, completionRatio: null })).toBe('on_track');
    expect(progressStatus({ ...input, completionRatio: null, hasOverdueAssignment: true })).toBe(
      'behind',
    );
  });

  it('margin = 0 ⇒ lệch dù nhỏ cũng tính', () => {
    expect(progressStatus({ ...input, margin: 0, completionRatio: 0.49 })).toBe('behind');
    expect(progressStatus({ ...input, margin: 0, completionRatio: 0.51 })).toBe('ahead');
  });
});

describe('hasStarted / pathCompleted', () => {
  it('hasStarted: chưa có bản ghi học nào kể từ khi vào lớp ⇒ false ("chưa bắt đầu", không số 0)', () => {
    expect(hasStarted(0)).toBe(false);
    expect(hasStarted(1)).toBe(true);
    expect(hasStarted(250)).toBe(true);
  });

  it('pathCompleted chỉ khi hoàn thành 100% đơn vị bắt buộc (null ⇒ false)', () => {
    expect(pathCompleted(1)).toBe(true);
    expect(pathCompleted(0.999)).toBe(false);
    expect(pathCompleted(0)).toBe(false);
    expect(pathCompleted(null)).toBe(false);
  });
});

describe('trên hồ sơ lớp class-*', () => {
  it('class-paused-whole-class: hôm nay thuộc kỳ nghỉ cả lớp ⇒ paused', () => {
    const p = loadClassProfile('class-paused-whole-class');
    expect(isPausedOn(p.asOf, p.class.classPauses)).toBe(true);
    const status = progressStatus({
      completionRatio: 0,
      expectedRatio: expectedRatio({
        startsOn: p.class.startsOn,
        endsOn: p.class.endsOn,
        shiftDays: 0,
        pauses: p.class.classPauses,
        today: p.asOf,
      }),
      margin: 0.1,
      paused: isPausedOn(p.asOf, p.class.classPauses),
      hasOverdueAssignment: false,
    });
    expect(status).toBe(p.expected.progress?.status);
    expect(status).toBe('paused');
  });

  it('class-overdue-assignment: bài giao quá hạn chưa xong ⇒ behind', () => {
    const p = loadClassProfile('class-overdue-assignment');
    const dueOn = p.class.assignments[0]!.dueOn;
    expect(dueOn < p.asOf).toBe(true);
    const status = progressStatus({
      completionRatio: 0,
      expectedRatio: expectedRatio({
        startsOn: p.class.startsOn,
        endsOn: p.class.endsOn,
        shiftDays: 0,
        pauses: [],
        today: p.asOf,
      }),
      margin: 0.1,
      paused: false,
      hasOverdueAssignment: true,
    });
    expect(status).toBe(p.expected.progress?.status);
    expect(status).toBe('behind');
  });

  it('class-newcomer-10min: học viên mới vào lớp, chưa có hoạt động ⇒ chưa bắt đầu, E = 0 đúng ngày đầu', () => {
    const p = loadClassProfile('class-newcomer-10min');
    expect(hasStarted(0)).toBe(false);
    expect(
      expectedRatio({
        startsOn: p.class.startsOn,
        endsOn: p.class.endsOn,
        shiftDays: 0,
        pauses: [],
        today: p.class.joinedOn,
      }),
    ).toBe(0);
  });
});

// --- US5 (T090): miễn bài, dời mốc riêng và tạm dừng ảnh hưởng tiến độ ---

describe('tiến độ với miễn bài và dời mốc riêng', () => {
  it('miễn bài loại khỏi mẫu số: hoàn thành tính trên tập đã trừ phần miễn', () => {
    const required = ['a', 'b', 'c', 'd'];
    const exempt = new Set(['d']);
    const effective = required.filter((id) => !exempt.has(id));
    expect(completionRatio(effective, new Set(['a', 'b', 'c']))).toBe(1);
    expect(completionRatio(required, new Set(['a', 'b', 'c']))).toBe(0.75);
  });

  it('dời mốc +N ngày làm học viên "chậm" thành "đúng tiến độ"', () => {
    const base = { startsOn: '2026-01-05', endsOn: '2026-01-15', pauses: [], today: '2026-01-10' };
    const normal = expectedRatio({ ...base, shiftDays: 0 });
    const shifted = expectedRatio({ ...base, shiftDays: 3 });
    expect(shifted).toBeLessThan(normal);
    const status = (e: number) =>
      progressStatus({
        completionRatio: 0.2,
        expectedRatio: e,
        margin: 0.1,
        paused: false,
        hasOverdueAssignment: false,
      });
    expect(status(normal)).toBe('behind');
    expect(status(shifted)).toBe('on_track');
  });

  it('ngày tạm dừng của lớp không tính vào tỷ lệ mong đợi', () => {
    const base = {
      startsOn: '2026-01-05',
      endsOn: '2026-01-15',
      shiftDays: 0,
      today: '2026-01-12',
    };
    const pauses = [{ startedOn: '2026-01-09', endedOn: '2026-01-12' }];
    expect(expectedRatio({ ...base, pauses })).toBeLessThan(expectedRatio({ ...base, pauses: [] }));
  });
});

describe('computeAlerts (US7, FR-031)', () => {
  const quiet = {
    progressStatus: 'on_track' as const,
    absentDays: 0,
    threshold: 3,
    hasOverdueAssignment: false,
    paused: false,
  };

  it('không cảnh báo khi đúng tiến độ, mới vắng ít ngày và không có bài quá hạn', () => {
    expect(computeAlerts({ ...quiet, absentDays: 2 })).toEqual([]);
  });

  it('absent khi số ngày vắng đạt đúng ngưỡng N (biên: N-1 không, N có)', () => {
    expect(computeAlerts({ ...quiet, absentDays: 2, threshold: 3 })).toEqual([]);
    expect(computeAlerts({ ...quiet, absentDays: 3, threshold: 3 })).toEqual(['absent']);
    expect(computeAlerts({ ...quiet, absentDays: 1, threshold: 1 })).toEqual(['absent']);
    expect(computeAlerts({ ...quiet, absentDays: 13, threshold: 14 })).toEqual([]);
    expect(computeAlerts({ ...quiet, absentDays: 14, threshold: 14 })).toEqual(['absent']);
  });

  it('behind khi trạng thái tiến độ là behind', () => {
    expect(computeAlerts({ ...quiet, progressStatus: 'behind' })).toEqual(['behind']);
  });

  it('overdue_assignment khi có bài giao quá hạn chưa xong', () => {
    expect(computeAlerts({ ...quiet, hasOverdueAssignment: true })).toEqual(['overdue_assignment']);
  });

  it('nhiều cảnh báo cùng lúc theo thứ tự cố định absent → behind → overdue_assignment', () => {
    expect(
      computeAlerts({
        progressStatus: 'behind',
        absentDays: 5,
        threshold: 3,
        hasOverdueAssignment: true,
        paused: false,
      }),
    ).toEqual(['absent', 'behind', 'overdue_assignment']);
  });

  it('học viên đang tạm dừng KHÔNG có cảnh báo dù vắng lâu hay có bài quá hạn', () => {
    expect(
      computeAlerts({
        progressStatus: 'paused',
        absentDays: 20,
        threshold: 3,
        hasOverdueAssignment: true,
        paused: true,
      }),
    ).toEqual([]);
  });

  it('needAttention = alerts.length > 0 trên hồ sơ vắng nhiều ngày', () => {
    const profile = loadClassProfile('class-absent-many-days');
    expect(profile).toBeDefined();
    const alerts = computeAlerts({ ...quiet, absentDays: 4, threshold: 3 });
    expect(alerts.length > 0).toBe(true);
  });
});
