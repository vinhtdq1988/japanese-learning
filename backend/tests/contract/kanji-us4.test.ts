/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  answerAll,
  kanjiLearner,
  kanjiUnitId,
  onboardedLearner,
  query,
  startSession,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US4 Kanji (T068): `GET /progress` có khối `kanji` và `weakTopics[].skill` khớp OpenAPI
// 1.11.0 (ContractClient tự đối chiếu thân phản hồi với schema `ProgressSummary`).

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

describe('GET /progress – khối kanji', () => {
  it('người không chọn Kanji và chưa có dữ liệu Kanji → kanji = null', async () => {
    const learner = await onboardedLearner(api, ctx);
    const res = await api.get('/progress', { token: learner.token });
    expect(res.status).toBe(200);
    expect(res.body.kanji).toBeNull();
  });

  it('người đã chọn Kanji nhưng chưa học → bốn số liệu bằng 0 / null và khớp schema', async () => {
    const learner = await kanjiLearner(api, ctx);
    const res = await api.get('/progress', { token: learner.token });
    expect(res.status).toBe(200);
    expect(res.body.kanji).toEqual({
      charactersLearned: 0,
      lessonsCompleted: 0,
      minutes: 0,
      reviewAccuracy: null,
    });
  });

  it('sau khi học một bài Kanji → số chữ, số bài; reviewAccuracy null khi chưa ôn; weakTopics có skill', async () => {
    const learner = await kanjiLearner(api, ctx);
    const unitId = await kanjiUnitId(ctx, 'Number kanji 1 (一 二 三)');
    const session = await startSession(api, learner, unitId);
    await answerAll(api, ctx, learner, session, {
      wrongIndexes: session.exercises.map((_: unknown, i: number) => i),
    });
    expect(
      (await api.post(`/sessions/${session.id}/complete`, { token: learner.token })).status,
    ).toBe(200);

    const res = await api.get('/progress', { token: learner.token });
    expect(res.status).toBe(200);
    expect(res.body.kanji).toMatchObject({
      charactersLearned: 3,
      lessonsCompleted: 1,
      reviewAccuracy: null,
    });
    expect(typeof res.body.kanji.minutes).toBe('number');
    expect(res.body.lessonsCompleted).toBeGreaterThanOrEqual(1);

    // Mọi phần tử mảng yếu có `skill` ∈ Skill (chủ đề Kanji → kanji).
    expect(res.body.weakTopics.length).toBeGreaterThan(0);
    for (const t of res.body.weakTopics)
      expect(['vocabulary', 'grammar', 'kanji']).toContain(t.skill);
    const topicId = (
      await query(ctx, `SELECT topic_id FROM learning_units WHERE id = $1`, [unitId])
    )[0].topic_id;
    const weak = res.body.weakTopics.find((t: any) => t.topicId === topicId);
    expect(weak).toBeTruthy();
    expect(weak.skill).toBe('kanji');
  });
});
