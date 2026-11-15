/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { SKILLS } from '../../src/domain/types.js';
import { loadCompetencyProfiles } from '../fixtures/learner-profiles/index.js';
import {
  competencyLearner,
  expectedCompetency,
  progressTopicLevels,
  topicKeysById,
  unitTopicKeys,
} from '../integration/competency-helpers.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { getToday } from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US3 của spec 007 (T106): màu năng lực ở `GET /progress`, `GET /today`, `GET /path` khớp bảng
// `expected.competency` của ba hồ sơ `competency-*` (FR-014…FR-018, I5). Phản hồi đối chiếu `openapi.yaml` 1.14.0.

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

describe.each(loadCompetencyProfiles())('hồ sơ $id', (fx) => {
  const expected = expectedCompetency(fx);

  it('GET /progress: competency.skills/topics khớp bảng; weakTopics ⊆ needs_improvement', async () => {
    const learner = await competencyLearner(api, ctx, fx);
    const res = await api.get('/progress', { token: learner.token });
    expect(res.status).toBe(200);

    const skills = res.body.competency.skills as { skill: string; level: string }[];
    expect(Object.fromEntries(skills.map((s) => [s.skill, s.level]))).toEqual(expected.skills);
    // Thứ tự theo SKILLS (vocabulary, grammar, kanji, reading, writing).
    const order = skills.map((s) => SKILLS.indexOf(s.skill as (typeof SKILLS)[number]));
    expect(order).toEqual([...order].sort((a, b) => a - b));

    const keys = await topicKeysById(ctx);
    expect(progressTopicLevels(res.body, keys)).toEqual(expected.topics);

    const levels = new Map(
      (res.body.competency.topics as any[]).map((t) => [t.topicId as string, t.level as string]),
    );
    const weak = res.body.weakTopics as { topicId: string }[];
    expect(weak.map((w) => keys.get(w.topicId)).sort()).toEqual([...expected.weakTopics].sort());
    for (const w of weak) expect(levels.get(w.topicId)).toBe('needs_improvement');
  });

  it('GET /today: new_unit mang mức của kỹ năng, review_batch là null', async () => {
    const learner = await competencyLearner(api, ctx, fx);
    const today = await getToday(api, learner);
    const items = today.items as any[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      if (item.type === 'review_batch') {
        expect(item.competency ?? null).toBeNull();
      } else {
        expect(item.competency).toBe(expected.skills[item.kind]);
      }
    }
  });

  it('GET /path: items[].competency = mức chủ đề, chưa có dữ liệu ⇒ insufficient', async () => {
    const learner = await competencyLearner(api, ctx, fx);
    const res = await api.get('/path', { token: learner.token });
    expect(res.status).toBe(200);
    const unitKeys = await unitTopicKeys(ctx);
    const items = res.body.items as { unitId: string; competency: string }[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const key = unitKeys.get(item.unitId);
      expect(item.competency).toBe((key && expected.topics[key]) ?? 'insufficient');
    }
  });
});
