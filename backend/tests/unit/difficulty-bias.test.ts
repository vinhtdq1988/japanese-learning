import { describe, expect, it } from 'vitest';
import {
  applySessionAccuracy,
  BIAS_LIMIT,
  EMPTY_TOPIC_STATS,
  MIN_SESSION_ANSWERS,
  recordAnswer,
  sessionAccuracyByTopic,
  type TopicStatState,
} from '../../src/engine/difficulty.js';
import {
  buildPathParams,
  rankUnits,
  type RankableUnit,
  type TopicStatInput,
} from '../../src/engine/path.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';

// Kiểm thử đơn vị độ khó thích ứng (T088, FR-013, research R7): < 60% liên tiếp 2 phiên → bias −1
// (giới hạn −2), > 90% liên tiếp 2 phiên → +1 (giới hạn +2), và `rankUnits` chọn đơn vị kế tiếp
// dễ hơn/khó hơn tương ứng. Dùng hồ sơ "liên tục < 60%" và "liên tục > 90%" của T024.

const fresh = (): TopicStatState => ({ ...EMPTY_TOPIC_STATS, recentResults: [] });

/** Mô phỏng các phiên của một mảng: ghi từng câu rồi áp độ chính xác phiên khi hoàn thành. */
function runSessions(state: TopicStatState, sessions: readonly (readonly number[])[]) {
  return sessions.reduce((s, results) => {
    const answered = results.reduce((acc, r) => recordAnswer(acc, r === 1), s);
    const accuracy = results.filter((r) => r === 1).length / results.length;
    return applySessionAccuracy(answered, accuracy, results.length);
  }, state);
}

describe('điều chỉnh bias theo phiên', () => {
  it('một phiên thấp chưa đổi bias, chỉ đếm chuỗi', () => {
    const state = applySessionAccuracy(fresh(), 0.4, 10);
    expect(state).toMatchObject({ consecutiveLow: 1, consecutiveHigh: 0, difficultyBias: 0 });
  });

  it('< 60% liên tiếp 2 phiên → bias −1; thêm phiên thấp nữa → −2 và dừng ở giới hạn −2', () => {
    let state = fresh();
    state = applySessionAccuracy(state, 0.5, 10);
    state = applySessionAccuracy(state, 0.5, 10);
    expect(state).toMatchObject({ consecutiveLow: 2, difficultyBias: -1 });
    state = applySessionAccuracy(state, 0.3, 10);
    expect(state.difficultyBias).toBe(-BIAS_LIMIT);
    state = applySessionAccuracy(state, 0.1, 10);
    expect(state.difficultyBias).toBe(-BIAS_LIMIT);
    expect(state.consecutiveLow).toBe(4);
  });

  it('> 90% liên tiếp 2 phiên → bias +1; thêm → +2 và dừng ở giới hạn +2', () => {
    let state = fresh();
    state = applySessionAccuracy(state, 1, 10);
    state = applySessionAccuracy(state, 0.95, 10);
    expect(state).toMatchObject({ consecutiveHigh: 2, difficultyBias: 1 });
    state = applySessionAccuracy(state, 1, 10);
    state = applySessionAccuracy(state, 1, 10);
    expect(state.difficultyBias).toBe(BIAS_LIMIT);
  });

  it('đúng 60% và đúng 90% không phải phiên thấp/cao (ngưỡng là "< 60%" và "> 90%")', () => {
    expect(applySessionAccuracy(fresh(), 0.6, 10)).toMatchObject({
      consecutiveLow: 0,
      consecutiveHigh: 0,
    });
    expect(applySessionAccuracy(fresh(), 0.9, 10)).toMatchObject({
      consecutiveLow: 0,
      consecutiveHigh: 0,
    });
  });

  it('phiên ở giữa hoặc ngược chiều cắt chuỗi', () => {
    let state = applySessionAccuracy(fresh(), 0.4, 10);
    state = applySessionAccuracy(state, 0.75, 10); // ở giữa → cắt
    state = applySessionAccuracy(state, 0.4, 10);
    expect(state).toMatchObject({ consecutiveLow: 1, difficultyBias: 0 });

    state = applySessionAccuracy(state, 0.95, 10); // ngược chiều → cắt chuỗi thấp
    expect(state).toMatchObject({ consecutiveLow: 0, consecutiveHigh: 1, difficultyBias: 0 });
  });

  it('bias đã lệch được giữ nguyên khi chuỗi bị cắt (chỉ đổi thêm khi lại có chuỗi)', () => {
    let state = runSessions(fresh(), [Array(10).fill(0), Array(10).fill(0)]);
    expect(state.difficultyBias).toBe(-1);
    state = applySessionAccuracy(state, 0.75, 10);
    expect(state.difficultyBias).toBe(-1);
  });

  it(`phiên có dưới ${MIN_SESSION_ANSWERS} câu của mảng bị bỏ qua (không đủ căn cứ)`, () => {
    const state = fresh();
    expect(applySessionAccuracy(state, 0, MIN_SESSION_ANSWERS - 1)).toBe(state);
    expect(applySessionAccuracy(state, 1, MIN_SESSION_ANSWERS - 1)).toBe(state);
  });

  it('gom kết quả phiên theo mảng', () => {
    const byTopic = sessionAccuracyByTopic([
      { topicId: 'a', isCorrect: true },
      { topicId: 'a', isCorrect: false },
      { topicId: 'b', isCorrect: true },
      { topicId: 'a', isCorrect: true },
    ]);
    expect(byTopic.get('a')).toEqual({ accuracy: 2 / 3, answered: 3 });
    expect(byTopic.get('b')).toEqual({ accuracy: 1, answered: 1 });
  });
});

describe('hồ sơ đại diện', () => {
  it('"liên tục < 60%": 2 phiên 40% → consecutiveLow 2, bias −1, cờ yếu', () => {
    const fx = loadLearnerProfile('low-accuracy-topic');
    const expected = fx.expected.difficulty as {
      sessionAccuracies: number[];
      consecutiveLow: number;
      difficultyBias: number;
      isWeak: boolean;
    };
    const sessions = fx.history.map((h) => h.results);
    sessions.forEach((results, i) => {
      expect(results.filter((r) => r === 1).length / results.length).toBeCloseTo(
        expected.sessionAccuracies[i]!,
        5,
      );
    });

    const state = runSessions(fresh(), sessions);
    expect(state.consecutiveLow).toBe(expected.consecutiveLow);
    expect(state.difficultyBias).toBe(expected.difficultyBias);
    expect(state.isWeak).toBe(expected.isWeak);
  });

  it('"liên tục > 90%": 2 phiên 100% → consecutiveHigh 2, bias +1, không yếu', () => {
    const fx = loadLearnerProfile('high-accuracy-topic');
    const expected = fx.expected.difficulty as {
      consecutiveHigh: number;
      difficultyBias: number;
      isWeak: boolean;
    };
    const state = runSessions(
      fresh(),
      fx.history.map((h) => h.results),
    );
    expect(state.consecutiveHigh).toBe(expected.consecutiveHigh);
    expect(state.difficultyBias).toBe(expected.difficultyBias);
    expect(state.isWeak).toBe(expected.isWeak);
  });
});

// --- Đơn vị kế tiếp do rankUnits chọn ---

const TOPIC = 'topic-particles';
const OTHER_TOPIC = 'topic-greetings';

function unit(overrides: Partial<RankableUnit> & { id: string }): RankableUnit {
  return {
    kind: 'grammar',
    level: 'N5',
    tier: 'core',
    goalTags: [],
    topicId: TOPIC,
    difficulty: 3,
    estMinutes: 5,
    sequence: 1,
    status: 'active',
    ...overrides,
  };
}

const params = buildPathParams({
  currentLevel: 'N5',
  goalType: 'daily_conversation',
  targetLevel: null,
  targetDate: null,
  skills: ['vocabulary', 'grammar'],
});
const profile = {
  skills: ['vocabulary', 'grammar'] as const,
  goalType: null,
  prioritizedSkill: null,
};

const stat = (topicId: string, state: TopicStatState): TopicStatInput => ({
  topicId,
  isWeak: state.isWeak,
  difficultyBias: state.difficultyBias,
});

const firstOf = (units: RankableUnit[], stats: TopicStatInput[]) =>
  rankUnits(params, { ...profile, skills: [...profile.skills] }, units, new Map(), stats)[0]!.unit
    .id;

describe('đơn vị kế tiếp theo bias (rankUnits)', () => {
  it('"liên tục < 60%" → đơn vị kế tiếp của mảng đó dễ hơn', () => {
    const fx = loadLearnerProfile('low-accuracy-topic');
    expect((fx.expected.difficulty as { nextUnitDifficulty: string }).nextUnitDifficulty).toBe(
      'easier',
    );
    const state = runSessions(
      fresh(),
      fx.history.map((h) => h.results),
    );
    // Mặc định (bias 0) đơn vị khó đứng trước vì `sequence` nhỏ hơn; bias −1 phải đảo lại.
    const units = [
      unit({ id: 'hard', difficulty: 4, sequence: 1 }),
      unit({ id: 'easy', difficulty: 2, sequence: 2 }),
    ];
    expect(firstOf(units, [])).toBe('hard');
    expect(firstOf(units, [stat(TOPIC, state)])).toBe('easy');
  });

  it('"liên tục > 90%" → đơn vị kế tiếp của mảng đó khó hơn', () => {
    const fx = loadLearnerProfile('high-accuracy-topic');
    expect((fx.expected.difficulty as { nextUnitDifficulty: string }).nextUnitDifficulty).toBe(
      'harder',
    );
    const state = runSessions(
      fresh(),
      fx.history.map((h) => h.results),
    );
    const units = [
      unit({ id: 'easy', difficulty: 2, sequence: 1 }),
      unit({ id: 'hard', difficulty: 4, sequence: 2 }),
    ];
    expect(firstOf(units, [])).toBe('easy');
    expect(firstOf(units, [stat(TOPIC, state)])).toBe('hard');
  });

  it('bias chỉ tác động lên đơn vị của chính mảng đó', () => {
    const struggling = runSessions(fresh(), [Array(10).fill(0), Array(10).fill(0)]);
    const units = [
      unit({ id: 'other-hard', topicId: OTHER_TOPIC, difficulty: 5, sequence: 1 }),
      unit({ id: 'other-easy', topicId: OTHER_TOPIC, difficulty: 1, sequence: 2 }),
    ];
    // Bias của mảng khác không đổi thứ tự hai đơn vị này.
    expect(firstOf(units, [stat(TOPIC, struggling)])).toBe('other-hard');
  });

  it('bias −2 mạnh hơn bias −1 trong việc đẩy đơn vị khó xuống', () => {
    const rank = (bias: number) =>
      rankUnits(
        params,
        { ...profile, skills: [...profile.skills] },
        [unit({ id: 'hard', difficulty: 5 }), unit({ id: 'easy', difficulty: 1 })],
        new Map(),
        [{ topicId: TOPIC, isWeak: false, difficultyBias: bias }],
      );
    const gap = (bias: number) => {
      const [a, b] = rank(bias);
      return a!.score - b!.score;
    };
    expect(gap(-2)).toBeGreaterThan(gap(-1));
    expect(gap(-1)).toBeGreaterThan(0);
  });

  it('mảng yếu được củng cố: đơn vị của mảng yếu đứng trước đơn vị tương đương của mảng khác', () => {
    const weak = runSessions(fresh(), [Array(10).fill(0)]);
    expect(weak.isWeak).toBe(true);
    const units = [
      unit({ id: 'strong-topic', topicId: OTHER_TOPIC, sequence: 1 }),
      unit({ id: 'weak-topic', topicId: TOPIC, sequence: 2 }),
    ];
    expect(firstOf(units, [])).toBe('strong-topic');
    expect(firstOf(units, [stat(TOPIC, weak)])).toBe('weak-topic');
  });

  it('mảng hết yếu thì không còn được ưu tiên củng cố', () => {
    let state = runSessions(fresh(), [Array(10).fill(0)]);
    state = [...Array(20).fill(1)].reduce<TopicStatState>(
      (s, r) => recordAnswer(s, r === 1),
      state,
    );
    expect(state.isWeak).toBe(false);
    const units = [
      unit({ id: 'strong-topic', topicId: OTHER_TOPIC, sequence: 1 }),
      unit({ id: 'recovered-topic', topicId: TOPIC, sequence: 2 }),
    ];
    expect(firstOf(units, [stat(TOPIC, state)])).toBe('strong-topic');
  });
});
