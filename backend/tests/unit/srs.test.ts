import { describe, expect, it } from 'vitest';
import {
  accuracyOf,
  dueDateAfter,
  HARD_EASE_CAP,
  INITIAL_EASE,
  MAX_EASE,
  MIN_EASE,
  nextSrsState,
  type SrsState,
} from '../../src/engine/srs.js';
import { loadLearnerProfiles } from '../fixtures/learner-profiles/index.js';

// Kiểm thử engine SRS (T073, T076, research R6, FR-023, SC-005): công thức SM-2 biến thể cho kết quả
// nhị phân, mục khó và thứ tự ôn "sai sớm hơn đúng" trên các hồ sơ đại diện.

const state = (over: Partial<SrsState> = {}): SrsState => ({
  intervalDays: 3,
  ease: 2.3,
  repetitions: 2,
  lapses: 0,
  isHard: false,
  ...over,
});

describe('nextSrsState – lần đầu', () => {
  it('lần đầu trả lời đúng: interval=1, ease=2.3, repetitions=1', () => {
    expect(nextSrsState(null, true, 1)).toEqual({
      intervalDays: 1,
      ease: INITIAL_EASE,
      repetitions: 1,
      lapses: 0,
      isHard: false,
    });
  });

  it('lần đầu trả lời sai: lapses=1, repetitions=0, interval=1, ease giảm 0.2', () => {
    expect(nextSrsState(null, false, 0)).toEqual({
      intervalDays: 1,
      ease: 2.1,
      repetitions: 0,
      lapses: 1,
      isHard: false,
    });
  });
});

describe('nextSrsState – trả lời đúng', () => {
  it('lần đúng thứ hai (repetitions → 2) luôn là 3 ngày', () => {
    const first = nextSrsState(null, true, 1);
    const second = nextSrsState(first, true, 1);
    expect(second.repetitions).toBe(2);
    expect(second.intervalDays).toBe(3);
    expect(second.ease).toBe(2.35);
  });

  it('từ lần thứ ba: interval = round(interval × ease) dùng ease trước khi tăng', () => {
    const next = nextSrsState(state({ intervalDays: 3, ease: 2.35, repetitions: 2 }), true, 1);
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(Math.round(3 * 2.35)); // 7
    expect(next.ease).toBe(2.4);
  });

  it('ease không vượt 2.8', () => {
    let s: SrsState | null = null;
    for (let i = 0; i < 30; i++) s = nextSrsState(s, true, 1);
    expect(s!.ease).toBe(MAX_EASE);
  });

  it('interval tăng dần theo chuỗi đúng liên tiếp', () => {
    let s: SrsState | null = null;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = nextSrsState(s, true, 1);
      intervals.push(s.intervalDays);
    }
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(intervals[0]).toBe(1);
    expect(intervals[1]).toBe(3);
    expect(intervals[5]).toBeGreaterThan(intervals[2]!);
  });

  it('không giữ cờ mục khó khi không còn thỏa điều kiện', () => {
    const hard = state({ lapses: 3, isHard: true, ease: 1.9, repetitions: 1, intervalDays: 1 });
    expect(nextSrsState(hard, true, 0.9).isHard).toBe(false);
  });
});

describe('nextSrsState – trả lời sai', () => {
  it('lapses+1, repetitions=0, interval=1, ease giảm 0.2', () => {
    const next = nextSrsState(state({ intervalDays: 14, ease: 2.5, repetitions: 4 }), false, 0.5);
    expect(next).toMatchObject({ lapses: 1, repetitions: 0, intervalDays: 1, ease: 2.3 });
  });

  it('ease không thấp hơn 1.3', () => {
    let s = state({ ease: 1.4 });
    for (let i = 0; i < 5; i++) s = nextSrsState(s, false, 1);
    expect(s.ease).toBe(MIN_EASE);
  });
});

describe('mục khó (R6, FR-014)', () => {
  it('lapses ≥ 3 và độ chính xác gần đây < 60% → isHard và ease ≤ 2.0', () => {
    const next = nextSrsState(state({ lapses: 2, ease: 2.6 }), false, 0.4);
    expect(next.lapses).toBe(3);
    expect(next.isHard).toBe(true);
    expect(next.ease).toBeLessThanOrEqual(HARD_EASE_CAP);
  });

  it('mục khó đúng lại vẫn bị chặn ease ≤ 2.0 khi độ chính xác còn thấp', () => {
    const next = nextSrsState(state({ lapses: 4, ease: 1.95, repetitions: 1 }), true, 0.5);
    expect(next.isHard).toBe(true);
    expect(next.ease).toBeLessThanOrEqual(HARD_EASE_CAP);
  });

  it('lapses ≥ 3 nhưng độ chính xác gần đây ≥ 60% → không phải mục khó', () => {
    const next = nextSrsState(state({ lapses: 3, ease: 2.6 }), true, 0.6);
    expect(next.isHard).toBe(false);
    expect(next.ease).toBeGreaterThan(HARD_EASE_CAP);
  });

  it('lapses < 3 thì không phải mục khó dù độ chính xác thấp', () => {
    expect(nextSrsState(state({ lapses: 1 }), false, 0.1).isHard).toBe(false);
  });

  it('chưa có dữ liệu độ chính xác (null) thì không phải mục khó', () => {
    expect(nextSrsState(state({ lapses: 5 }), false, null).isHard).toBe(false);
  });
});

describe('ngày đến hạn và độ chính xác', () => {
  it('due_date = ngày địa phương + interval', () => {
    expect(dueDateAfter('2026-01-30', 3)).toBe('2026-02-02');
    expect(dueDateAfter('2026-12-30', 1)).toBe('2026-12-31');
  });

  it('accuracyOf', () => {
    expect(accuracyOf([])).toBeNull();
    expect(accuracyOf([true, false, true, true])).toBe(0.75);
  });
});

describe('SC-005 – mục sai ôn lại sớm hơn mục đúng', () => {
  /** Dựng trạng thái sau `k` lần đúng liên tiếp (người học đã quen mục). */
  function afterCorrect(k: number): SrsState {
    let s: SrsState | null = null;
    for (let i = 0; i < k; i++) s = nextSrsState(s, true, 1);
    return s!;
  }

  it.each([2, 3, 4, 5, 6])('sau %i lần đúng: trả lời sai → ôn sớm hơn trả lời đúng', (k) => {
    const prior = afterCorrect(k);
    const wrong = nextSrsState(prior, false, 0.7);
    const right = nextSrsState(prior, true, 0.7);
    expect(wrong.intervalDays).toBeLessThan(right.intervalDays);
    expect(
      dueDateAfter('2026-01-05', wrong.intervalDays) <
        dueDateAfter('2026-01-05', right.intervalDays),
    ).toBe(true);
  });

  it('mục sai luôn quay lại sau đúng 1 ngày, mục đúng không bao giờ sớm hơn', () => {
    for (const prior of [null, afterCorrect(1), afterCorrect(4)]) {
      expect(nextSrsState(prior, false, 0.5).intervalDays).toBe(1);
      expect(nextSrsState(prior, true, 0.5).intervalDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('trên các hồ sơ đại diện có ôn tồn đọng: mục khó vẫn ôn sớm khi sai và bị chặn ease', () => {
    const withBacklog = loadLearnerProfiles().filter((p) => p.reviewBacklog.length > 0);
    expect(withBacklog.length).toBeGreaterThan(0);
    for (const profile of withBacklog) {
      for (const entry of profile.reviewBacklog) {
        // Mục tồn đọng đã học vài lần; mục khó có 3 lần quên.
        const prior = entry.isHard
          ? state({ lapses: 3, isHard: true, ease: 1.8, repetitions: 1, intervalDays: 1 })
          : afterCorrect(3);
        const wrong = nextSrsState(prior, false, entry.isHard ? 0.4 : 0.8);
        const right = nextSrsState(prior, true, entry.isHard ? 0.4 : 0.8);
        expect(wrong.intervalDays).toBeLessThanOrEqual(right.intervalDays);
        expect(wrong.intervalDays).toBe(1);
        if (entry.isHard) {
          expect(wrong.isHard).toBe(true);
          expect(wrong.ease).toBeLessThanOrEqual(HARD_EASE_CAP);
        }
      }
    }
  });
});
