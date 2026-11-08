import { describe, expect, it } from 'vitest';
import { evaluate, type EvaluateInput } from '../../src/engine/achievements.js';
import { loadRewardProfiles } from '../fixtures/learner-profiles/index.js';

// Kiểm thử đơn vị engine thành tựu (spec 005, data-model §3.2): so sánh chỉ số trước/sau, mốc âm thầm và hồ sơ
// đại diện của FR-035.

// Nền cô lập: hai thành tựu một lần đã đạt nên từng test chỉ xét loại mình kiểm.
const ONCE = ['first_lesson', 'perfect_lesson'];
const base: EvaluateInput = {
  earned: new Set(ONCE),
  isNewLesson: true,
  streakBefore: 0,
  streakAfter: 0,
  itemsBefore: 0,
  itemsAfter: 0,
  goalDone: 0,
  goalTotal: 0,
  delta: 0,
  hasEarlierLesson: true,
  isPerfect: false,
  hadEarlierPerfect: true,
};
const run = (patch: Partial<EvaluateInput>) => evaluate({ ...base, ...patch });

describe('streak / items_learned', () => {
  it('chuỗi: T ≤ before → silent; before < T ≤ after → celebrate; T > after → không có gì', () => {
    const r = run({ streakBefore: 3, streakAfter: 7 });
    expect(r.silent).toEqual(['streak_3']);
    expect(r.celebrate).toEqual(['streak_7']);
  });

  it('chuỗi không tăng (before = after) → không chúc mừng mốc nào', () => {
    expect(run({ streakBefore: 7, streakAfter: 7 }).celebrate).toEqual([]);
  });

  it('items: ngưỡng bằng đúng before → silent; vượt nhờ phiên này → celebrate', () => {
    const r = run({ itemsBefore: 49, itemsAfter: 52 });
    expect(r.celebrate).toEqual(['items_50']);
    expect(run({ itemsBefore: 50, itemsAfter: 55 }).silent).toEqual(['items_50']);
  });

  it('vượt nhiều cấp cùng lúc → chúc mừng tất cả mốc trong (before, after]', () => {
    const r = run({ streakBefore: 2, streakAfter: 14 });
    expect(r.celebrate).toEqual(['streak_3', 'streak_7', 'streak_14']);
  });
});

describe('goal_progress', () => {
  it('so bằng số nguyên: 100% không sai số thực', () => {
    const r = run({ goalDone: 3, goalTotal: 3, delta: 1 });
    // 2/3 → 3/3: 25% và 50% đã đạt trước phiên này (silent); 75% và 100% do chính phiên này.
    expect(r.celebrate).toEqual(['goal_75', 'goal_100']);
    expect(r.silent).toEqual(['goal_25', 'goal_50']);
  });

  it('chính phiên này đưa tỷ lệ qua 25% → celebrate', () => {
    const r = run({ goalDone: 10, goalTotal: 40, delta: 1 });
    expect(r.celebrate).toEqual(['goal_25']);
  });

  it('delta = 0 (phiên không đổi trạng thái đơn vị) → mốc đã qua chỉ ghi âm thầm', () => {
    const r = run({ goalDone: 10, goalTotal: 40, delta: 0 });
    expect(r.celebrate).toEqual([]);
    expect(r.silent).toEqual(['goal_25']);
  });

  it('goalTotal = 0 → bỏ qua mọi mốc mục tiêu', () => {
    const r = run({ goalDone: 0, goalTotal: 0, delta: 0 });
    expect([...r.celebrate, ...r.silent]).toEqual([]);
  });
});

describe('first_lesson / perfect_lesson', () => {
  it('bài học mới đầu tiên → first_lesson', () => {
    expect(run({ earned: new Set(), hasEarlierLesson: false }).celebrate).toEqual(['first_lesson']);
  });

  it('đã có bài học mới trước đó → first_lesson ghi âm thầm', () => {
    expect(run({ earned: new Set(), hasEarlierLesson: true }).silent).toContain('first_lesson');
  });

  it('phiên ôn tập KHÔNG bao giờ chúc mừng first_lesson/perfect_lesson', () => {
    const r = run({
      earned: new Set(),
      isNewLesson: false,
      hasEarlierLesson: false,
      isPerfect: true,
      hadEarlierPerfect: false,
    });
    expect(r.celebrate).not.toContain('first_lesson');
    expect(r.celebrate).not.toContain('perfect_lesson');
  });

  it('bài hoàn hảo đầu tiên → perfect_lesson; đã có bài hoàn hảo trước → âm thầm', () => {
    const open = new Set(['first_lesson']);
    expect(run({ earned: open, isPerfect: true, hadEarlierPerfect: false }).celebrate).toEqual([
      'perfect_lesson',
    ]);
    expect(run({ earned: open, isPerfect: true, hadEarlierPerfect: true }).silent).toContain(
      'perfect_lesson',
    );
  });

  it('bài mới đầu tiên đồng thời hoàn hảo → first_lesson rồi perfect_lesson (thứ tự trình bày)', () => {
    const r = run({
      earned: new Set(),
      hasEarlierLesson: false,
      isPerfect: true,
      hadEarlierPerfect: false,
    });
    expect(r.celebrate).toEqual(['first_lesson', 'perfect_lesson']);
  });
});

describe('bất biến', () => {
  it('mốc đã trong earned bị bỏ qua hoàn toàn', () => {
    const r = run({
      earned: new Set([...ONCE, 'streak_3', 'streak_7']),
      streakBefore: 0,
      streakAfter: 7,
    });
    expect([...r.celebrate, ...r.silent]).toEqual([]);
  });

  it('một mốc không đồng thời silent và celebrate; kết quả theo thứ tự trình bày', () => {
    const r = run({
      earned: new Set(),
      hasEarlierLesson: false,
      isPerfect: true,
      hadEarlierPerfect: false,
      streakBefore: 2,
      streakAfter: 3,
      itemsBefore: 45,
      itemsAfter: 55,
      goalDone: 25,
      goalTotal: 100,
      delta: 1,
    });
    expect(r.celebrate).toEqual([
      'first_lesson',
      'perfect_lesson',
      'streak_3',
      'items_50',
      'goal_25',
    ]);
    expect(r.celebrate.filter((c) => r.silent.includes(c))).toEqual([]);
  });
});

describe('hồ sơ đại diện thưởng (FR-035)', () => {
  const profiles = loadRewardProfiles();

  it('có đủ năm hồ sơ bắt buộc', () => {
    expect(profiles.map((p) => p.id)).toEqual([
      'reward-goal-jump',
      'reward-near-streak',
      'reward-newcomer',
      'reward-perfect',
      'reward-veteran',
    ]);
  });

  for (const p of profiles) {
    it(`${p.id}: ${p.description}`, () => {
      const { input, expected } = p.reward;
      const r = evaluate({ ...input, earned: new Set(input.earned) });
      expect(r).toEqual(expected);
    });
  }
});
