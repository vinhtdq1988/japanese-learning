/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  advanceDays,
  answerAll,
  getToday,
  kanjiLearner,
  kanjiUnitId,
  onboardedLearner,
  query,
  startSession,
  submit,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US3 Kanji (T058): `PUT /path/items/{itemId}/master` và `AnswerResult.nextReviewDate`
// của câu ôn Kanji khớp OpenAPI 1.11.0 (mọi request/response được đối chiếu hợp đồng).

let ctx: TestApp;
let api: ContractClient;
const START = '2026-01-05T08:00:00Z';
const UNIT_TITLE = 'Number kanji 1 (一 二 三)';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterEach(() => {
  ctx.clock.set(START);
});
afterAll(async () => {
  await ctx.close();
});

/** Người học Kanji đã học xong bài số đếm 1 (mọi chữ có lịch ôn); trả về phiên đã học. */
async function learnedKanjiLearner() {
  const learner = await kanjiLearner(api, ctx);
  const session = await startSession(api, learner, await kanjiUnitId(ctx, UNIT_TITLE));
  await answerAll(api, ctx, learner, session);
  const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
  expect(done.status).toBe(200);
  return { learner, session };
}

const setMastered = (learner: Learner, itemId: string, body: unknown, validateRequest = true) =>
  api.put(`/path/items/${itemId}/master`, { token: learner.token, body, validateRequest });

const firstKanjiItem = async (): Promise<string> =>
  (
    await query<{ id: string }>(ctx, `SELECT id FROM content_items WHERE kind = 'kanji' LIMIT 1`)
  )[0]!.id;

describe('PUT /path/items/{itemId}/master', () => {
  it('200 {itemId, mastered}: đánh dấu rồi bỏ đánh dấu; gửi lại cùng giá trị là idempotent', async () => {
    const { learner, session } = await learnedKanjiLearner();
    const itemId = (
      await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [session.exercises[0].id])
    )[0].item_id;

    const marked = await setMastered(learner, itemId, { mastered: true });
    expect(marked.status).toBe(200);
    expect(marked.body).toEqual({ itemId, mastered: true });
    const again = await setMastered(learner, itemId, { mastered: true });
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ itemId, mastered: true });

    const unmarked = await setMastered(learner, itemId, { mastered: false });
    expect(unmarked.status).toBe(200);
    expect(unmarked.body).toEqual({ itemId, mastered: false });
  });

  it('404 khi người học chưa học chữ (không có lịch ôn)', async () => {
    const learner = await kanjiLearner(api, ctx);
    const res = await setMastered(learner, await firstKanjiItem(), { mastered: true });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('404 khi chữ không tồn tại hoặc chưa hoàn tất onboarding', async () => {
    const learner = await kanjiLearner(api, ctx);
    expect((await setMastered(learner, randomUUID(), { mastered: true })).status).toBe(404);

    const fresh = await registerUser(api);
    const res = await api.put(`/path/items/${await firstKanjiItem()}/master`, {
      token: fresh.accessToken,
      body: { mastered: true },
    });
    expect(res.status).toBe(404);
  });

  it('422 khi mục không phải Kanji', async () => {
    const learner = await onboardedLearner(api, ctx);
    const [vocab] = await query<{ id: string }>(
      ctx,
      `SELECT id FROM content_items WHERE kind = 'vocabulary' AND status = 'active' LIMIT 1`,
    );
    const res = await setMastered(learner, vocab!.id, { mastered: true });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('422 khi thân yêu cầu sai và khi itemId không phải UUID', async () => {
    const { learner, session } = await learnedKanjiLearner();
    const itemId = (
      await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [session.exercises[0].id])
    )[0].item_id;
    const bad = await setMastered(learner, itemId, { mastered: 'yes' }, false);
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    const notUuid = await setMastered(learner, 'khong-phai-uuid', { mastered: true }, false);
    expect(notUuid.status).toBe(422);
  });

  it('401 khi không có token', async () => {
    const res = await api.put(`/path/items/${randomUUID()}/master`, {
      body: { mastered: true },
      validateRequest: false,
      validateResponse: false,
    });
    expect(res.status).toBe(401);
  });
});

describe('AnswerResult.nextReviewDate cho câu ôn Kanji', () => {
  it('có mặt và là ngày đến hạn của cặp vừa trả lời; GET /today có review_facets song song', async () => {
    const { learner } = await learnedKanjiLearner();
    await advanceDays(api, ctx, learner);
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();

    const session = await startSession(api, learner, review.id);
    expect(session.kind).toBe('review');
    const exercise = session.exercises[0];
    expect(['meaning', 'reading', 'word']).toContain(exercise.facet);
    const res = await submit(api, ctx, learner, session.id, exercise.id, { correct: true });
    expect(res.status).toBe(200);
    expect(res.body.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.nextReviewDate > '2026-01-06').toBe(true);
  });
});
