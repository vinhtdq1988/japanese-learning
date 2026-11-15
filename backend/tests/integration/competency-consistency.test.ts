/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { recordAnswer } from '../../src/engine/difficulty.js';
import { ContractClient } from '../contract/client.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';
import {
  competencyLearner,
  progressTopicLevels,
  replayHistory,
  topicIdOf,
  topicKeysById,
  unitTopicKeys,
  writeTopicStats,
} from './competency-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import { getToday } from './lesson-helpers.js';

// Nhất quán màu năng lực giữa ba màn (spec 007, T107, I5, SC-005): cùng thời điểm, cùng đầu mục ⇒ cùng mức ở
// `GET /today`, `GET /path`, `GET /progress` (cùng truy vấn `topic_stats`, cùng hàm phân loại).

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

/** Mức của kỹ năng/chủ đề theo từng endpoint tại cùng một thời điểm. */
async function snapshot(learner: Awaited<ReturnType<typeof competencyLearner>>) {
  const [progress, today, path] = await Promise.all([
    api.get('/progress', { token: learner.token }),
    getToday(api, learner),
    api.get('/path', { token: learner.token }),
  ]);
  expect(progress.status).toBe(200);
  expect(path.status).toBe(200);
  const keys = await topicKeysById(ctx);
  const unitKeys = await unitTopicKeys(ctx);
  return {
    progress: progress.body,
    today,
    path: path.body,
    skillLevels: Object.fromEntries(
      (progress.body.competency.skills as any[]).map((s) => [s.skill, s.level]),
    ) as Record<string, string>,
    topicLevels: progressTopicLevels(progress.body, keys),
    unitKeys,
  };
}

/** Khẳng định mọi đầu mục của `today` và `path` mang đúng mức mà `progress` báo cho cùng đầu mục. */
function expectConsistent(s: Awaited<ReturnType<typeof snapshot>>) {
  for (const item of s.today.items as any[]) {
    if (item.type === 'new_unit') expect(item.competency).toBe(s.skillLevels[item.kind]);
  }
  for (const item of s.path.items as any[]) {
    const key = s.unitKeys.get(item.unitId);
    expect(item.competency).toBe((key && s.topicLevels[key]) ?? 'insufficient');
  }
}

describe('ba endpoint cùng mức (I5, SC-005)', () => {
  it('competency-mixed: today, path và progress khớp nhau', async () => {
    const learner = await competencyLearner(api, ctx, loadLearnerProfile('competency-mixed'));
    const s = await snapshot(learner);
    expect(s.skillLevels).toMatchObject({ vocabulary: 'good', kanji: 'needs_improvement' });
    expectConsistent(s);
  });

  it('US3.4: học thêm để mảng yếu lên ≥ 70% ⇒ lần gọi sau cả ba endpoint đổi sang good', async () => {
    const fx = loadLearnerProfile('competency-mixed');
    const learner = await competencyLearner(api, ctx, fx);

    const before = await snapshot(learner);
    expect(before.topicLevels['kanji-n5-numbers']).toBe('needs_improvement');
    expect(before.progress.weakTopics).toHaveLength(1);
    expect(before.path.items.some((i: any) => i.competency === 'needs_improvement')).toBe(true);

    // Học thêm 12 câu đúng liên tiếp vào mảng Kanji yếu qua đúng đường ghi của phiên (`recordAnswer`):
    // cửa sổ 20 câu còn 8 câu cũ (4 đúng) + 12 câu mới = 16/20 = 80%, cờ yếu tự bỏ.
    let state = replayHistory(fx).get('kanji-n5-numbers')!;
    for (let i = 0; i < 12; i++) state = recordAnswer(state, true);
    expect(state.isWeak).toBe(false);
    await writeTopicStats(ctx, learner.userId, 'kanji-n5-numbers', state);

    const after = await snapshot(learner);
    expect(after.topicLevels['kanji-n5-numbers']).toBe('good');
    expect(after.skillLevels.kanji).toBe('good');
    expect(after.progress.weakTopics).toEqual([]);
    expect(after.path.items.some((i: any) => i.competency === 'needs_improvement')).toBe(false);
    for (const item of after.today.items as any[]) {
      if (item.type === 'new_unit' && item.kind === 'kanji') expect(item.competency).toBe('good');
    }
    expectConsistent(after);
    expect(await topicIdOf(ctx, 'kanji-n5-numbers')).toBeTruthy();
  });

  it('competency-new: mọi mức insufficient, weakTopics rỗng', async () => {
    const learner = await competencyLearner(api, ctx, loadLearnerProfile('competency-new'));
    const s = await snapshot(learner);
    expect(Object.values(s.skillLevels).every((l) => l === 'insufficient')).toBe(true);
    expect(s.progress.competency.topics).toEqual([]);
    expect(s.progress.weakTopics).toEqual([]);
    expect((s.path.items as any[]).every((i) => i.competency === 'insufficient')).toBe(true);
    for (const item of s.today.items as any[]) {
      if (item.type === 'new_unit') expect(item.competency).toBe('insufficient');
    }
  });
});
