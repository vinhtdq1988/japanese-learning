/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  answerAll,
  getToday,
  kanjiLearner,
  kanjiUnitId,
  startSession,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US1 Kanji (T021): phản hồi khớp OpenAPI 1.11.0 (ContentItem.kanji/topicId,
// Exercise.facet, SessionSummary.attentionItems).

let ctx: TestApp;
let api: ContractClient;
let learner: Learner;
const UNIT_TITLE = 'Number kanji 1 (一 二 三)';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  learner = await kanjiLearner(api, ctx);
});
afterAll(async () => {
  await ctx.close();
});

describe('POST /sessions với bài Kanji', () => {
  it('200 LessonSession: mục có kanji, topicId, reading = null, kanjiReading; bài tập có facet', async () => {
    const session = await startSession(api, learner, await kanjiUnitId(ctx, UNIT_TITLE));
    expect(session.kind).toBe('extra');
    expect(session.items).toHaveLength(3);
    for (const item of session.items) {
      expect(item.kind).toBe('kanji');
      expect(item.reading).toBeNull();
      expect(item.topicId).toMatch(/^[0-9a-f-]{36}$/);
      expect(item.kanji.strokeCount).toBeGreaterThan(0);
      expect(item.kanji.onReadings.length + item.kanji.kunReadings.length).toBeGreaterThan(0);
      expect(item.examples.length).toBeGreaterThanOrEqual(2);
      expect(item.examples.some((e: any) => typeof e.kanjiReading === 'string')).toBe(true);
    }
    const facets = new Set(session.exercises.map((e: any) => e.facet));
    expect([...facets].sort()).toEqual(['item', 'meaning', 'reading', 'word']);
    // Không lộ đáp án.
    const raw = JSON.stringify(session.exercises);
    expect(raw).not.toContain('correct_index');
    expect(raw).not.toContain('accepted_answers');
  });
});

describe('POST /sessions/{id}/complete với bài Kanji', () => {
  it('SessionSummary có attentionItems theo chữ trả lời sai; phiên từ vựng không có attentionItems', async () => {
    const session = await startSession(api, learner, await kanjiUnitId(ctx, UNIT_TITLE));
    const firstItemExercise = session.exercises.findIndex((e: any) => e.facet === 'meaning');
    await answerAll(api, ctx, learner, session, { wrongIndexes: [firstItemExercise] });
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
    expect(done.body.attentionItems).toEqual([
      expect.objectContaining({ japanese: '一', itemId: session.items[0].id }),
    ]);

    // Phiên từ vựng/ngữ pháp trong kế hoạch hôm nay.
    const plan = await getToday(api, learner);
    const vocabItem = plan.items.find((i: any) => i.type === 'new_unit' && i.kind !== 'kanji');
    const vocab = await startSession(api, learner, vocabItem.id);
    expect(vocab.items.every((i: any) => i.kind !== 'kanji')).toBe(true);
    expect(vocab.items.every((i: any) => !('kanji' in i) && !('topicId' in i))).toBe(true);
    await answerAll(api, ctx, learner, vocab);
    const vocabDone = await api.post(`/sessions/${vocab.id}/complete`, { token: learner.token });
    expect(vocabDone.status).toBe(200);
    expect(vocabDone.body).not.toHaveProperty('attentionItems');
  });
});
