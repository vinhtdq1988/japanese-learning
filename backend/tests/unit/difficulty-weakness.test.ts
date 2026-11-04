import { describe, expect, it } from 'vitest';
import {
  EMPTY_TOPIC_STATS,
  recordAnswer,
  TOPIC_WINDOW,
  WEAK_MIN_ANSWERS,
  type TopicStatState,
} from '../../src/engine/difficulty.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';

// Kiểm thử đơn vị thống kê mảng (T081, FR-029, research R7): cửa sổ trượt 20 câu, cờ điểm yếu
// (< 60% với ≥ 8 câu, bỏ cờ khi ≥ 70%) và loại trừ câu hỏi lại cuối phiên. Dùng hồ sơ đại diện
// "liên tục < 60%" và "mảng yếu đã hồi phục" của T024.

const fresh = (): TopicStatState => ({ ...EMPTY_TOPIC_STATS, recentResults: [] });

/** Áp dụng lần lượt các kết quả 1/0 (đúng/sai) của một phiên. */
function replay(state: TopicStatState, results: readonly number[]): TopicStatState {
  return results.reduce((s, r) => recordAnswer(s, r === 1), state);
}

describe('cửa sổ trượt 20 câu', () => {
  it('giữ tối đa 20 kết quả gần nhất, cũ → mới', () => {
    const results = Array.from({ length: 25 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    const state = replay(fresh(), results);
    expect(state.recentResults).toHaveLength(TOPIC_WINDOW);
    expect(state.recentResults).toEqual(results.slice(-TOPIC_WINDOW));
  });

  it('độ chính xác tính trên cửa sổ, null khi chưa có câu nào', () => {
    expect(fresh().accuracy).toBeNull();
    expect(replay(fresh(), [1, 1, 0, 0]).accuracy).toBe(0.5);
    // 20 câu sai rồi 20 câu đúng: cửa sổ chỉ còn 20 câu đúng.
    const state = replay(fresh(), [...Array(20).fill(0), ...Array(20).fill(1)]);
    expect(state.accuracy).toBe(1);
  });
});

describe('cờ điểm yếu (FR-029)', () => {
  it(`chưa gắn cờ khi dưới ${WEAK_MIN_ANSWERS} câu dù sai hết`, () => {
    const state = replay(fresh(), Array(WEAK_MIN_ANSWERS - 1).fill(0));
    expect(state.accuracy).toBe(0);
    expect(state.isWeak).toBe(false);
  });

  it(`gắn cờ khi đủ ${WEAK_MIN_ANSWERS} câu và độ chính xác < 60%`, () => {
    const state = replay(fresh(), Array(WEAK_MIN_ANSWERS).fill(0));
    expect(state.isWeak).toBe(true);
  });

  it('đúng 60% chưa bị gắn cờ (ngưỡng là "< 60%")', () => {
    // 6/10 = 0,6; độ chính xác chạy không lúc nào dưới 60% khi đã có ≥ 8 câu.
    const state = replay(fresh(), [1, 1, 1, 1, 1, 1, 0, 0, 0, 0]);
    expect(state.accuracy).toBe(0.6);
    expect(state.isWeak).toBe(false);
  });

  it('có độ trễ: đã yếu thì chỉ bỏ cờ khi đạt ≥ 70%, ở giữa [60%, 70%) giữ nguyên cờ', () => {
    let state = replay(fresh(), Array(10).fill(0)); // 0% → yếu
    expect(state.isWeak).toBe(true);
    // Thêm 10 câu đúng: cửa sổ 20 câu = 10 sai + 10 đúng = 50% → vẫn yếu.
    state = replay(state, Array(10).fill(1));
    expect(state.accuracy).toBe(0.5);
    expect(state.isWeak).toBe(true);
    // Thêm 3 câu đúng: cửa sổ = 7 sai + 13 đúng = 65% → ở giữa, vẫn yếu.
    state = replay(state, [1, 1, 1]);
    expect(state.accuracy).toBe(0.65);
    expect(state.isWeak).toBe(true);
    // Thêm 1 câu đúng: 6 sai + 14 đúng = 70% → bỏ cờ.
    state = replay(state, [1]);
    expect(state.accuracy).toBe(0.7);
    expect(state.isWeak).toBe(false);
  });

  it('mảng đang không yếu không bị gắn cờ khi độ chính xác nằm trong [60%, 70%)', () => {
    // 13/20 = 65% từ đầu (không từng < 60%).
    const state = replay(fresh(), [...Array(13).fill(1), ...Array(7).fill(0)]);
    expect(state.accuracy).toBe(0.65);
    expect(state.isWeak).toBe(false);
  });
});

describe('câu hỏi lại cuối phiên (is_retry) không được tính', () => {
  it('trả lại đúng trạng thái cũ, không đổi cửa sổ, độ chính xác hay cờ', () => {
    const before = replay(fresh(), [1, 1, 0, 1]);
    expect(recordAnswer(before, false, true)).toBe(before);
    expect(recordAnswer(before, true, true)).toBe(before);
  });

  it('mảng yếu không bị "gỡ cờ" nhờ câu hỏi lại đúng', () => {
    const weak = replay(fresh(), Array(10).fill(0));
    let state = weak;
    for (let i = 0; i < 30; i++) state = recordAnswer(state, true, true);
    expect(state).toEqual(weak);
    expect(state.isWeak).toBe(true);
  });
});

describe('hồ sơ đại diện', () => {
  it('"liên tục < 60%": độ chính xác gần đây 40% và gắn cờ yếu sau 2 phiên', () => {
    const fx = loadLearnerProfile('low-accuracy-topic');
    const expected = fx.expected.difficulty as { recentAccuracy: number; isWeak: boolean };

    const state = fx.history.reduce((s, session) => replay(s, session.results), fresh());
    expect(state.recentResults).toHaveLength(20);
    expect(state.accuracy).toBeCloseTo(expected.recentAccuracy, 5);
    expect(state.isWeak).toBe(expected.isWeak);
  });

  it('"mảng yếu đã hồi phục": yếu sau phiên 1–2, hết yếu khi đạt ≥ 70% ở phiên 3', () => {
    const fx = loadLearnerProfile('recovered-weak-topic');
    const { checkpoints } = fx.expected.difficulty as {
      checkpoints: { afterSession: number; recentAccuracy: number; isWeak: boolean }[];
    };
    expect(checkpoints).toHaveLength(fx.history.length);

    let state = fresh();
    fx.history.forEach((session, i) => {
      state = replay(state, session.results);
      const checkpoint = checkpoints[i]!;
      expect(checkpoint.afterSession).toBe(i + 1);
      expect(state.accuracy).toBeCloseTo(checkpoint.recentAccuracy, 5);
      expect(state.isWeak).toBe(checkpoint.isWeak);
    });
  });

  it('câu hỏi lại xen giữa lịch sử không làm đổi kết quả hồ sơ', () => {
    const fx = loadLearnerProfile('low-accuracy-topic');
    let state = fresh();
    for (const session of fx.history) {
      for (const r of session.results) {
        state = recordAnswer(state, r === 1);
        state = recordAnswer(state, true, true); // câu hỏi lại cuối phiên: bị bỏ qua
      }
    }
    expect(state.accuracy).toBeCloseTo(0.4, 5);
    expect(state.isWeak).toBe(true);
  });
});
