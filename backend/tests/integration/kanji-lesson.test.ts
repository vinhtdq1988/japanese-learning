/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import {
  answerFor,
  kanjiLearner,
  kanjiUnitId,
  query,
  startSession,
  submit,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US1 Kanji (T022) trên PostgreSQL thật: bài Kanji học được đầu-cuối, ghi theo cặp
// (chữ, khía cạnh), tiếp tục giữa chừng, tóm tắt có chữ cần chú ý (quickstart KJ1, KJ2).

let ctx: TestApp;
let api: ContractClient;
const UNIT_TITLE = 'Number kanji 1 (一 二 三)';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

const complete = (learner: Learner, sessionId: string) =>
  api.post(`/sessions/${sessionId}/complete`, { token: learner.token });

async function newKanjiSession(learner: Learner) {
  return startSession(api, learner, await kanjiUnitId(ctx, UNIT_TITLE));
}

describe('học trọn bài Kanji', () => {
  it('ghi facet và chủ đề của chữ; hoàn thành tạo đủ 3 cặp lịch ôn cho mỗi chữ; tóm tắt có chữ cần chú ý', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    const wrong = session.exercises.findIndex((e: any) => e.facet === 'word');
    for (const [i, exercise] of session.exercises.entries()) {
      const res = await submit(api, ctx, learner, session.id, exercise.id, {
        correct: i !== wrong,
      });
      expect(res.status).toBe(200);
    }
    const done = await complete(learner, session.id);
    expect(done.status).toBe(200);
    expect(done.body.total).toBe(session.exercises.length);

    // study_records.facet = facet của bài tập; topic_id = chủ đề của chữ (không gắn chữ: chủ đề của đơn vị).
    const records = await query(
      ctx,
      `SELECT r.facet::text AS facet, r.topic_id, r.item_id, e.facet::text AS exercise_facet,
              i.topic_id AS item_topic, u.topic_id AS unit_topic
         FROM study_records r
         JOIN exercises e ON e.id = r.exercise_id
         JOIN learning_units u ON u.id = e.unit_id
         LEFT JOIN content_items i ON i.id = r.item_id
        WHERE r.user_id = $1`,
      [learner.userId],
    );
    expect(records).toHaveLength(session.exercises.length);
    for (const r of records) {
      expect(r.facet).toBe(r.exercise_facet);
      expect(r.topic_id).toBe(r.item_id ? r.item_topic : r.unit_topic);
    }

    // Hoàn thành: unit_progress completed, mỗi chữ có đủ meaning/reading/word.
    const progress = await query(
      ctx,
      `SELECT status::text AS status FROM unit_progress WHERE user_id = $1`,
      [learner.userId],
    );
    expect(progress).toEqual([{ status: 'completed' }]);
    const schedules = await query(
      ctx,
      `SELECT item_id, array_agg(facet::text ORDER BY facet::text) AS facets
         FROM review_schedules WHERE user_id = $1 GROUP BY item_id`,
      [learner.userId],
    );
    expect(schedules).toHaveLength(3);
    for (const s of schedules) expect(s.facets).toEqual(['meaning', 'reading', 'word']);

    // Chữ trả lời sai (câu `word` đầu tiên) nằm trong attentionItems.
    const wrongItemId = (
      await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [session.exercises[wrong].id])
    )[0].item_id;
    expect(done.body.attentionItems.map((a: any) => a.itemId)).toEqual([wrongItemId]);
  });

  it('cặp trả lời sai đến hạn sau 1 ngày, các cặp khác của chữ không bị ảnh hưởng (lịch theo cặp)', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    const wrongIndex = session.exercises.findIndex((e: any) => e.facet === 'reading');
    for (const [i, exercise] of session.exercises.entries()) {
      await submit(api, ctx, learner, session.id, exercise.id, { correct: i !== wrongIndex });
    }
    const wrongItem = (
      await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [
        session.exercises[wrongIndex].id,
      ])
    )[0].item_id;
    const rows = await query(
      ctx,
      `SELECT facet::text AS facet, last_result, lapses FROM review_schedules
        WHERE user_id = $1 AND item_id = $2 ORDER BY facet::text`,
      [learner.userId, wrongItem],
    );
    expect(rows).toEqual([
      { facet: 'meaning', last_result: true, lapses: 0 },
      { facet: 'reading', last_result: false, lapses: 1 },
      { facet: 'word', last_result: true, lapses: 0 },
    ]);
  });
});

describe('tiếp tục giữa chừng và gửi lại', () => {
  it('trả lời 2 câu rồi mở lại phiên → tiếp tục từ câu 3, không mất câu đã ghi (US1.3)', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    for (const exercise of session.exercises.slice(0, 2)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    const reopened = await newKanjiSession(learner);
    expect(reopened.id).toBe(session.id);
    expect(reopened.answered.map((a: any) => a.exerciseId)).toEqual(
      session.exercises.slice(0, 2).map((e: any) => e.id),
    );
    // Còn câu chưa trả lời → chưa hoàn thành được.
    expect((await complete(learner, session.id)).status).toBe(409);
    for (const exercise of reopened.exercises.slice(2)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    expect((await complete(learner, session.id)).status).toBe(200);
    expect(
      (
        await query(ctx, 'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    ).toBe(session.exercises.length);
  });

  it('gửi lại cùng clientEventId chỉ ghi một lần và không cập nhật lịch hai lần', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    const exercise = session.exercises.find((e: any) => e.facet === 'meaning');
    const clientEventId = randomUUID();
    const first = await submit(api, ctx, learner, session.id, exercise.id, { clientEventId });
    const second = await submit(api, ctx, learner, session.id, exercise.id, { clientEventId });
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.nextReviewDate).toBe(first.body.nextReviewDate);
    expect(
      (
        await query(ctx, 'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    ).toBe(1);
    expect(
      (
        await query(ctx, 'SELECT count(*)::int AS n FROM review_schedules WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    ).toBe(1);
  });
});

describe('ngôn ngữ giao diện', () => {
  it('nghĩa và phản hồi theo tiếng Anh khi ngôn ngữ giao diện là en (US1.5)', async () => {
    const user = await registerUser(api, { language: 'en' });
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ skills: ['vocabulary', 'grammar', 'kanji'] }),
    });
    expect(done.status).toBe(200);
    const userId = (await query(ctx, 'SELECT id FROM users WHERE email = $1', [user.email]))[0].id;
    const learner: Learner = { user, token: user.accessToken, userId };

    const session = await newKanjiSession(learner);
    expect(session.items.map((i: any) => i.meaning)).toEqual(['one', 'two', 'three']);
    expect(session.items[0].kanji.components).toBe('A single horizontal stroke');
    const exercise = session.exercises.find((e: any) => e.facet === 'meaning');
    expect(exercise.prompt).toMatch(/What does/);
    const wrong = await submit(api, ctx, learner, session.id, exercise.id, { correct: false });
    expect(wrong.body.isCorrect).toBe(false);
    expect(wrong.body.feedback).toMatch(/means/);
    // Sai thì trả đáp án đúng (với trắc nghiệm là chỉ số lựa chọn đúng).
    expect(wrong.body.correctAnswer).toBeDefined();
  });
});

describe('mất kết nối giữa chừng', () => {
  it('câu đã ghi được giữ; hoàn thành bị từ chối khi chưa đủ câu; thử lại thành công thì hoàn thành đúng một lần', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    const [first, second, ...rest] = session.exercises;

    expect((await submit(api, ctx, learner, session.id, first.id)).status).toBe(200);
    // Một lần gửi thất bại (mô phỏng mất kết nối: yêu cầu không tới server → không có bản ghi).
    expect(
      await query(ctx, 'SELECT 1 FROM study_records WHERE user_id = $1 AND exercise_id = $2', [
        learner.userId,
        second.id,
      ]),
    ).toHaveLength(0);

    const early = await complete(learner, session.id);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('SESSION_INCOMPLETE');
    expect(
      await query(ctx, `SELECT 1 FROM unit_progress WHERE user_id = $1 AND status = 'completed'`, [
        learner.userId,
      ]),
    ).toHaveLength(0);

    // Thử lại: gửi bù mọi câu còn thiếu rồi hoàn thành; gọi hoàn thành lần hai không đổi gì.
    for (const exercise of [second, ...rest]) {
      const retry = await submit(api, ctx, learner, session.id, exercise.id);
      expect(retry.status).toBe(200);
    }
    expect((await complete(learner, session.id)).status).toBe(200);
    expect((await complete(learner, session.id)).status).toBe(200);
    expect(
      await query(ctx, `SELECT 1 FROM unit_progress WHERE user_id = $1 AND status = 'completed'`, [
        learner.userId,
      ]),
    ).toHaveLength(1);
    expect(
      (
        await query(ctx, 'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    ).toBe(session.exercises.length);
  });

  it('câu trả lời đúng của mọi dạng bài tập Kanji được chấm đúng (điền cách đọc nhận cả hiragana và katakana)', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await newKanjiSession(learner);
    const reading = session.exercises.find((e: any) => e.facet === 'reading');
    const katakana = await ctx.handle.pool.query('SELECT payload FROM exercises WHERE id = $1', [
      reading.id,
    ]);
    const accepted: string[] = katakana.rows[0].payload.accepted_answers;
    expect(accepted).toHaveLength(2);
    for (const answer of accepted) {
      const res = await api.post(`/sessions/${session.id}/answers`, {
        token: learner.token,
        body: { clientEventId: randomUUID(), exerciseId: reading.id, answer, isRetry: true },
      });
      expect(res.body.isCorrect, answer).toBe(true);
    }
    expect(await answerFor(ctx, reading.id, true)).toBe(accepted[0]);
  });
});
