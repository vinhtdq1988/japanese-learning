/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { allocateKanjiSeconds } from '../../src/engine/progress.js';
import { ContractClient } from '../contract/client.js';
import { secondsToMinutes } from '../../src/services/lesson-session.js';
import {
  advanceDays,
  answerAll,
  getToday,
  kanjiLearner,
  kanjiUnitId,
  onboardedLearner,
  query,
  startSession,
  studyPlanItem,
  submit,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US4 Kanji (T069) trên PostgreSQL thật: tiến độ Kanji khớp dữ liệu đã ghi (quickstart
// KJ3, KJ6). Phút của phiên ôn hỗn hợp là ước lượng nên so với công thức phân bổ, không với đồng hồ thực.

let ctx: TestApp;
let api: ContractClient;
const START = '2026-01-05T08:00:00Z';
const NUMBERS_1 = 'Number kanji 1 (一 二 三)';
const TIME_UNIT = 'Time kanji (日 月 年 時)';

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

const progressOf = async (learner: Learner) => {
  const res = await api.get('/progress', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body;
};

const complete = (learner: Learner, sessionId: string) =>
  api.post(`/sessions/${sessionId}/complete`, { token: learner.token });

const postInterval = (
  learner: Learner,
  sessionId: string,
  startedAt: string,
  durationSeconds: number,
) =>
  api.post(`/sessions/${sessionId}/intervals`, {
    token: learner.token,
    body: { clientEventId: crypto.randomUUID(), startedAt, durationSeconds },
  });

/** Học trọn một bài Kanji qua "Học thêm" kèm một khoảng thời gian học; `wrongIndexes` cố ý sai. */
async function learnKanjiUnit(
  learner: Learner,
  title: string,
  options: { wrongIndexes?: number[]; startedAt?: string; seconds?: number } = {},
) {
  const session = await startSession(api, learner, await kanjiUnitId(ctx, title));
  await answerAll(
    api,
    ctx,
    learner,
    session,
    options.wrongIndexes ? { wrongIndexes: options.wrongIndexes } : {},
  );
  if (options.seconds) {
    expect(
      (await postInterval(learner, session.id, options.startedAt ?? START, options.seconds)).status,
    ).toBe(204);
  }
  expect((await complete(learner, session.id)).status).toBe(200);
  return session;
}

describe('số liệu Kanji sau bài và ôn (US4.1, US4.2)', () => {
  it('charactersLearned, lessonsCompleted, minutes (bài + phần phân bổ của phiên ôn hỗn hợp), reviewAccuracy', async () => {
    const learner = await kanjiLearner(api, ctx);
    const lesson = await learnKanjiUnit(learner, NUMBERS_1, {
      seconds: 600,
      startedAt: '2026-01-05T08:00:00Z',
    });
    expect(lesson.exercises.length).toBeGreaterThanOrEqual(9);

    // Thêm một mục từ vựng đến hạn để phiên ôn là hỗn hợp (Kanji + từ vựng).
    const [vocab] = await query<{ id: string }>(
      ctx,
      `SELECT ci.id FROM content_items ci
         JOIN exercises e ON e.item_id = ci.id AND e.status = 'active'
        WHERE ci.kind = 'vocabulary' AND ci.status = 'active' LIMIT 1`,
    );
    await query(
      ctx,
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date)
       VALUES ($1, $2, 1, 2.50, '2026-01-05')`,
      [learner.userId, vocab!.id],
    );

    await advanceDays(api, ctx, learner);
    const review = (await getToday(api, learner)).items.find((i: any) => i.type === 'review_batch');
    const session = await startSession(api, learner, review.id);
    // Sai câu Kanji đầu tiên và câu từ vựng (nếu có) giữ đúng.
    const kinds = await Promise.all(
      session.exercises.map(
        async (e: any) =>
          (
            await query(
              ctx,
              `SELECT ci.kind::text AS kind FROM exercises e JOIN content_items ci ON ci.id = e.item_id WHERE e.id = $1`,
              [e.id],
            )
          )[0].kind as string,
      ),
    );
    expect(kinds).toContain('vocabulary');
    const kanjiCount = kinds.filter((k) => k === 'kanji').length;
    expect(kanjiCount).toBeGreaterThanOrEqual(2);
    const wrongKanji = kinds.findIndex((k) => k === 'kanji');
    for (const [i, exercise] of session.exercises.entries()) {
      await submit(api, ctx, learner, session.id, exercise.id, { correct: i !== wrongKanji });
    }
    expect((await postInterval(learner, session.id, '2026-01-06T08:00:00Z', 600)).status).toBe(204);
    expect((await complete(learner, session.id)).status).toBe(200);

    const progress = await progressOf(learner);
    const expectedSeconds = 600 + allocateKanjiSeconds(600, kanjiCount, kinds.length);
    expect(progress.kanji).toEqual({
      charactersLearned: 3,
      lessonsCompleted: 1,
      minutes: secondsToMinutes(expectedSeconds),
      reviewAccuracy: Math.round(((kanjiCount - 1) / kanjiCount) * 1000) / 1000,
    });

    // Các trường tổng bao gồm Kanji: thời gian = 20 phút (hai phiên), bài hoàn thành, độ chính xác ôn gộp.
    expect(progress.totalMinutes).toBe(20);
    expect(progress.lessonsCompleted).toBe(1);
    expect(progress.reviewAccuracy).toBe(
      Math.round(((kinds.length - 1) / kinds.length) * 1000) / 1000,
    );
    expect(progress.currentStreakDays).toBeGreaterThanOrEqual(1);
  });

  it('chữ trong bài dở dang KHÔNG tính vào charactersLearned; bài chưa hoàn thành không tính vào lessonsCompleted', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await startSession(api, learner, await kanjiUnitId(ctx, NUMBERS_1));
    for (const exercise of session.exercises.slice(0, 4)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    expect(
      (
        await query(ctx, 'SELECT count(*)::int AS n FROM review_schedules WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].n,
    ).toBeGreaterThan(0);
    expect((await progressOf(learner)).kanji).toMatchObject({
      charactersLearned: 0,
      lessonsCompleted: 0,
    });

    for (const exercise of session.exercises.slice(4)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    expect((await complete(learner, session.id)).status).toBe(200);
    expect((await progressOf(learner)).kanji).toMatchObject({
      charactersLearned: 3,
      lessonsCompleted: 1,
    });
  });

  it('chữ đã thành thạo hoặc bài đã ngừng vẫn tính vào số chữ đã học; lịch sử vẫn tính (FR-022)', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await learnKanjiUnit(learner, NUMBERS_1, {
      seconds: 300,
      startedAt: '2026-01-05T08:00:00Z',
    });
    const unitId = await kanjiUnitId(ctx, NUMBERS_1);
    const itemId = (
      await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [session.exercises[0].id])
    )[0].item_id;
    expect(
      (
        await api.put(`/path/items/${itemId}/master`, {
          token: learner.token,
          body: { mastered: true },
        })
      ).status,
    ).toBe(200);
    expect((await progressOf(learner)).kanji).toMatchObject({ charactersLearned: 3 });

    // Bài bị admin ngừng: rời khỏi tiến độ mục tiêu nhưng lịch sử (số chữ, bài, phút) vẫn còn.
    const before = await progressOf(learner);
    await query(ctx, `UPDATE learning_units SET status = 'inactive' WHERE id = $1`, [unitId]);
    try {
      const after = await progressOf(learner);
      expect(after.kanji).toEqual(before.kanji);
      expect(after.totalMinutes).toBe(before.totalMinutes);
      expect(after.goal.completionRatio).toBeLessThan(before.goal.completionRatio + 1e-9);
    } finally {
      await query(ctx, `UPDATE learning_units SET status = 'active' WHERE id = $1`, [unitId]);
    }
  });
});

describe('mảng yếu theo chủ đề của chữ (US4.3)', () => {
  it('≥ 8 câu sai, độ chính xác < 60% ở chủ đề kanji-n5-time → có trong weakTopics với skill = kanji', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await startSession(api, learner, await kanjiUnitId(ctx, TIME_UNIT));
    const all = session.exercises.map((_: unknown, i: number) => i);
    expect(all.length).toBeGreaterThanOrEqual(8);
    await answerAll(api, ctx, learner, session, { wrongIndexes: all });
    expect((await complete(learner, session.id)).status).toBe(200);

    const progress = await progressOf(learner);
    const topic = (
      await query(ctx, `SELECT id FROM topics WHERE skill = 'kanji' AND name->>'en' = 'Time'`)
    )[0];
    const weak = progress.weakTopics.find((t: any) => t.topicId === topic.id);
    expect(weak).toBeTruthy();
    expect(weak).toMatchObject({ skill: 'kanji', name: 'Thời gian' });
    expect(weak.accuracy).toBeLessThan(0.6);
  });
});

describe('tiến độ mục tiêu (FR-019)', () => {
  const unitsCount = async (kinds: string[]): Promise<number> =>
    (
      await query(
        ctx,
        `SELECT count(*)::int AS n FROM learning_units WHERE status = 'active' AND kind::text = ANY($1)`,
        [kinds],
      )
    )[0].n;

  it('tính bài Kanji khi kanji ∈ skills; không đổi khi không chọn Kanji', async () => {
    const base = await unitsCount(['vocabulary', 'grammar']);
    const kanji = await unitsCount(['kanji']);
    expect(kanji).toBeGreaterThan(0);

    const withKanji = await kanjiLearner(api, ctx);
    const without = await onboardedLearner(api, ctx);
    await learnKanjiUnit(withKanji, NUMBERS_1);
    const plan = await getToday(api, without);
    await studyPlanItem(api, ctx, without, plan.items[0].id);

    const a = await progressOf(withKanji);
    const b = await progressOf(without);
    expect(a.goal.completionRatio).toBeCloseTo(1 / (base + kanji), 3);
    expect(b.goal.completionRatio).toBeCloseTo(1 / base, 3);
    expect(b.kanji).toBeNull();
  });
});
