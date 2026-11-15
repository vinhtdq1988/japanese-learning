import { describe, expect, it } from 'vitest';
import { ENCOURAGEMENT_CATALOG, type EncouragementState } from '../../src/domain/encouragement.js';
import { addDays } from '../../src/engine/clock.js';
import { hasLearningGap } from '../../src/engine/daily-plan.js';
import {
  pickEncouragementState,
  pickVariant,
  type EncouragementSignals,
} from '../../src/engine/encouragement.js';
import {
  loadEncouragementProfiles,
  loadLearnerProfile,
  loadRewardProfiles,
} from '../fixtures/learner-profiles/index.js';

// Kiểm thử engine chọn lời khích lệ (spec 007, T132, FR-026…FR-031, SC-008): thứ tự ưu tiên trạng thái, chọn
// biến thể tất định theo (userId, trạng thái, ngày), thay `{n}` và rơi về `vi` khi thiếu bản dịch.

const base: EncouragementSignals = {
  planStatus: 'open',
  planItemsTotal: 3,
  planItemsDone: 0,
  streakDays: 0,
  afterGap: false,
  onTrack: null,
};
const pick = (patch: Partial<EncouragementSignals>) =>
  pickEncouragementState({ ...base, ...patch });

describe('pickEncouragementState: thứ tự ưu tiên', () => {
  it('mặc định là not_started', () => {
    expect(pick({})).toBe('not_started');
  });

  it('day_completed thắng mọi trạng thái khác', () => {
    expect(
      pick({
        planStatus: 'completed',
        planItemsDone: 3,
        afterGap: true,
        streakDays: 9,
        onTrack: false,
      }),
    ).toBe('day_completed');
  });

  it('welcome_back khi vắng ≥ 2 ngày và chưa xong mục nào; thắng streak/behind_target', () => {
    expect(pick({ afterGap: true })).toBe('welcome_back');
    expect(pick({ afterGap: true, streakDays: 5, onTrack: false })).toBe('welcome_back');
  });

  it('đã xong 1 mục sau khoảng nghỉ thì chuyển sang in_progress', () => {
    expect(pick({ afterGap: true, planItemsDone: 1 })).toBe('in_progress');
  });

  it('in_progress khi 0 < đã xong < tổng; thắng streak và behind_target', () => {
    expect(pick({ planItemsDone: 1 })).toBe('in_progress');
    expect(pick({ planItemsDone: 2, streakDays: 7, onTrack: false })).toBe('in_progress');
  });

  it('xong hết mục nhưng kế hoạch chưa đóng không phải in_progress', () => {
    expect(pick({ planItemsDone: 3 })).toBe('not_started');
  });

  it('streak chỉ từ 3 ngày; thắng behind_target', () => {
    expect(pick({ streakDays: 2 })).toBe('not_started');
    expect(pick({ streakDays: 3 })).toBe('streak');
    expect(pick({ streakDays: 3, onTrack: false })).toBe('streak');
  });

  it('behind_target chỉ khi onTrack === false (null/true không tính)', () => {
    expect(pick({ onTrack: false })).toBe('behind_target');
    expect(pick({ onTrack: true })).toBe('not_started');
    expect(pick({ onTrack: null })).toBe('not_started');
  });

  it('kế hoạch rỗng (0 mục) không bao giờ là in_progress', () => {
    expect(pick({ planItemsTotal: 0 })).toBe('not_started');
  });
});

describe('hồ sơ đại diện → trạng thái (FR-031)', () => {
  it('newcomer-10min → not_started', () => {
    expect(loadLearnerProfile('newcomer-10min').lastActiveDate).toBeNull();
    expect(pick({})).toBe('not_started');
  });

  it('returning-after-gap → welcome_back (afterGap lấy từ hasLearningGap)', () => {
    const fx = loadLearnerProfile('returning-after-gap');
    const afterGap = hasLearningGap(fx.lastActiveDate, fx.asOf, fx.pausePeriods);
    expect(afterGap).toBe(true);
    expect(pick({ afterGap })).toBe('welcome_back');
  });

  it('hồ sơ reward-veteran / reward-near-streak → streak', () => {
    const streaks = loadRewardProfiles()
      .filter((p) => ['reward-veteran', 'reward-near-streak'].includes(p.id))
      .map((p) => p.reward.setup.streakDaysBeforeToday);
    expect(streaks.length).toBe(2);
    for (const streakDays of streaks) expect(pick({ streakDays })).toBe('streak');
  });

  describe.each(loadEncouragementProfiles())('hồ sơ $id', (fx) => {
    const exp = fx.expected.encouragement as unknown as {
      state: EncouragementState;
      signals: EncouragementSignals;
    };
    it('tín hiệu của hồ sơ cho đúng trạng thái mong đợi', () => {
      expect(pickEncouragementState(exp.signals)).toBe(exp.state);
    });
  });
});

describe('pickVariant', () => {
  const input = {
    userId: '5b6c1f6e-0000-4000-8000-000000000001',
    state: 'not_started' as EncouragementState,
    language: 'vi' as const,
    localDate: '2026-01-05',
    streakDays: 0,
  };

  it('tất định: cùng đầu vào, cùng câu', () => {
    expect(pickVariant(input)).toBe(pickVariant({ ...input }));
  });

  it('câu thuộc danh mục của đúng trạng thái và ngôn ngữ', () => {
    const vi = ENCOURAGEMENT_CATALOG.not_started.map((v) => v.vi);
    const en = ENCOURAGEMENT_CATALOG.not_started.map((v) => v.en);
    expect(vi).toContain(pickVariant(input));
    expect(en).toContain(pickVariant({ ...input, language: 'en' }));
  });

  it('hai ngày liền kề cùng trạng thái cho hai câu khác nhau (mọi trạng thái, nhiều người dùng)', () => {
    for (const state of Object.keys(ENCOURAGEMENT_CATALOG) as EncouragementState[]) {
      for (const userId of ['u1', 'u2', 'u3', 'a-long-user-id-0123456789']) {
        for (let d = 0; d < 20; d++) {
          const today = addDays('2026-01-05', d);
          const a = pickVariant({ ...input, userId, state, localDate: today, streakDays: 5 });
          const b = pickVariant({
            ...input,
            userId,
            state,
            localDate: addDays(today, 1),
            streakDays: 5,
          });
          expect(a, `${state}/${userId}/${today}`).not.toBe(b);
        }
      }
    }
  });

  it('5 ngày liên tiếp cùng trạng thái thấy ≥ 2 câu khác nhau (SC-008)', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 5; d++) {
      seen.add(pickVariant({ ...input, localDate: addDays('2026-01-05', d) }));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('{n} được thay bằng số ngày của chuỗi, ở cả vi và en', () => {
    for (const language of ['vi', 'en'] as const) {
      const text = pickVariant({ ...input, state: 'streak', language, streakDays: 12 });
      expect(text).toContain('12');
      expect(text).not.toContain('{n}');
    }
  });

  it('ngôn ngữ thiếu bản dịch rơi về vi', () => {
    const catalog = {
      ...ENCOURAGEMENT_CATALOG,
      not_started: [
        { vi: 'Chỉ có tiếng Việt A', en: '' },
        { vi: 'Chỉ có tiếng Việt B', en: '' },
        { vi: 'Chỉ có tiếng Việt C', en: '' },
      ],
    };
    expect(pickVariant({ ...input, language: 'en' }, catalog)).toMatch(/^Chỉ có tiếng Việt/);
  });
});
