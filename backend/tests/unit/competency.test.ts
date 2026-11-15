import { describe, expect, it } from 'vitest';
import {
  COMPETENCY_GOOD_AT,
  COMPETENCY_MIN_ANSWERS,
  classifyCompetency,
  skillCompetencies,
  topicCompetencies,
  type TopicWindow,
} from '../../src/engine/competency.js';
import {
  EMPTY_TOPIC_STATS,
  RECOVER_AT,
  WEAK_MIN_ANSWERS,
  recordAnswer,
  type TopicStatState,
} from '../../src/engine/difficulty.js';
import { loadCompetencyProfiles } from '../fixtures/learner-profiles/index.js';
import { topicByKey } from '../fixtures/topic-catalog.js';

// Kiểm thử đơn vị engine năng lực (spec 007, T105, FR-014…FR-018, I5, I6): quy tắc phân loại, hằng số dùng chung
// với cờ "mảng yếu", cách gộp theo kỹ năng và tính nhất quán trên các hồ sơ đại diện `competency-*`.

describe('classifyCompetency: bảng biên (competency-rules.md §1)', () => {
  const cases: [number, number, string][] = [
    [0, 0, 'insufficient'],
    [7, 7, 'insufficient'],
    [8, 5, 'needs_improvement'],
    [10, 7, 'good'],
    [20, 13, 'needs_improvement'],
    [20, 11, 'needs_improvement'],
    [16, 15, 'good'],
  ];
  it.each(cases)('answered=%i correct=%i → %s', (answered, correct, level) => {
    expect(classifyCompetency({ answered, correct })).toBe(level);
  });

  it('đúng 8 câu là đủ dữ liệu, 0.70 thuộc good (một mức duy nhất cho mỗi đầu mục)', () => {
    expect(classifyCompetency({ answered: 8, correct: 8 })).toBe('good');
    expect(classifyCompetency({ answered: 10, correct: 7 })).toBe('good');
    expect(classifyCompetency({ answered: 10, correct: 6 })).toBe('needs_improvement');
  });
});

describe('hằng số dùng chung với cờ mảng yếu', () => {
  it('COMPETENCY_MIN_ANSWERS === WEAK_MIN_ANSWERS và COMPETENCY_GOOD_AT === RECOVER_AT', () => {
    expect(COMPETENCY_MIN_ANSWERS).toBe(WEAK_MIN_ANSWERS);
    expect(COMPETENCY_GOOD_AT).toBe(RECOVER_AT);
  });
});

describe('gộp theo chủ đề và kỹ năng', () => {
  const windows: TopicWindow[] = [
    { topicId: 't1', skill: 'vocabulary', recentResults: [1, 1, 1, 1, 1, 1] },
    { topicId: 't2', skill: 'vocabulary', recentResults: [1, 0, 1, 1, 1, 1] },
    { topicId: 't3', skill: 'kanji', recentResults: [] },
    { topicId: 't4', skill: 'grammar', recentResults: [0, 0, 0, 0, 0, 0, 0, 0] },
  ];

  it('mức chủ đề dựa trên cửa sổ riêng của chủ đề (answered = độ dài, correct = tổng)', () => {
    const topics = topicCompetencies(windows);
    const byId = new Map(topics.map((t) => [t.topicId, t]));
    expect(byId.get('t1')).toMatchObject({ level: 'insufficient', answered: 6, accuracy: 1 });
    expect(byId.get('t4')).toMatchObject({ level: 'needs_improvement', answered: 8, accuracy: 0 });
  });

  it('chủ đề không có kết quả nào không xuất hiện (chỉ chủ đề có dữ liệu)', () => {
    expect(topicCompetencies(windows).map((t) => t.topicId)).not.toContain('t3');
  });

  it('mức kỹ năng = cộng answered/correct của các chủ đề cùng kỹ năng rồi phân loại', () => {
    // t1 + t2 = 12 câu, 11 đúng → 0.9167 → good dù từng chủ đề riêng lẻ chưa đủ 8 câu.
    const skills = skillCompetencies(windows, ['vocabulary', 'grammar', 'kanji']);
    const vocab = skills.find((s) => s.skill === 'vocabulary')!;
    expect(vocab).toMatchObject({ level: 'good', answered: 12 });
    expect(vocab.accuracy).toBeCloseTo(11 / 12, 3);
  });

  it('kỹ năng đang bật nhưng chưa có dữ liệu → insufficient, accuracy null; theo thứ tự SKILLS', () => {
    const skills = skillCompetencies(windows, ['kanji', 'writing']);
    expect(skills.map((s) => s.skill)).toEqual(['vocabulary', 'grammar', 'kanji', 'writing']);
    expect(skills.find((s) => s.skill === 'kanji')).toMatchObject({
      level: 'insufficient',
      answered: 0,
      accuracy: null,
    });
    expect(skills.find((s) => s.skill === 'writing')).toMatchObject({ level: 'insufficient' });
  });

  it('không sửa đầu vào', () => {
    const copy = JSON.parse(JSON.stringify(windows)) as TopicWindow[];
    topicCompetencies(windows);
    skillCompetencies(windows, ['vocabulary']);
    expect(windows).toEqual(copy);
  });
});

// --- Hồ sơ đại diện: I5, I6 ---

interface ExpectedCompetency {
  skills: Record<string, string>;
  topics: Record<string, string>;
  weakTopics: string[];
}

/** Phát lại lịch sử của hồ sơ qua `recordAnswer` (đúng đường ghi của phiên học) theo từng chủ đề. */
function replayHistory(
  history: { topic: string; results: (0 | 1)[] }[],
): Map<string, TopicStatState> {
  const states = new Map<string, TopicStatState>();
  for (const session of history) {
    let state = states.get(session.topic) ?? { ...EMPTY_TOPIC_STATS, recentResults: [] };
    for (const r of session.results) state = recordAnswer(state, r === 1);
    states.set(session.topic, state);
  }
  return states;
}

describe.each(loadCompetencyProfiles())('hồ sơ đại diện $id', (fx) => {
  const expected = fx.expected.competency as unknown as ExpectedCompetency;
  const states = replayHistory(fx.history);
  const windows: TopicWindow[] = [...states].map(([key, s]) => ({
    topicId: key,
    skill: topicByKey(key).skill,
    recentResults: s.recentResults,
  }));

  it('bảng expected.competency khớp: mức theo kỹ năng và theo chủ đề', () => {
    const skills = skillCompetencies(windows, fx.profile.skills);
    expect(Object.fromEntries(skills.map((s) => [s.skill, s.level]))).toEqual(expected.skills);
    const topics = topicCompetencies(windows);
    expect(Object.fromEntries(topics.map((t) => [t.topicId, t.level]))).toEqual(expected.topics);
  });

  it('I5: is_weak ⇒ needs_improvement; chủ đề good không bao giờ is_weak; weakTopics khớp bảng', () => {
    const levels = new Map(topicCompetencies(windows).map((t) => [t.topicId, t.level]));
    const weakKeys: string[] = [];
    for (const [key, state] of states) {
      if (state.isWeak) {
        weakKeys.push(key);
        expect(levels.get(key)).toBe('needs_improvement');
      }
      if (levels.get(key) === 'good') expect(state.isWeak).toBe(false);
    }
    expect(weakKeys.sort()).toEqual([...expected.weakTopics].sort());
  });

  it('I6: câu hỏi lại (is_retry) không đổi mức', () => {
    for (const [, state] of states) {
      const level = classifyCompetency({
        answered: state.recentResults.length,
        correct: state.recentResults.reduce<number>((a, b) => a + b, 0),
      });
      let after = state;
      for (let i = 0; i < 25; i++) after = recordAnswer(after, i % 2 === 0, true);
      expect(after.recentResults).toEqual(state.recentResults);
      expect(
        classifyCompetency({
          answered: after.recentResults.length,
          correct: after.recentResults.reduce<number>((a, b) => a + b, 0),
        }),
      ).toBe(level);
    }
  });
});
