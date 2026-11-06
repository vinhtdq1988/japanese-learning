/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
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
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US3 Kanji (T059) trên PostgreSQL thật: ôn theo cặp (chữ, khía cạnh), gói ôn có
// `review_facets` song song, đánh dấu chữ thành thạo, bài dở dang (quickstart KJ5, KJ7). Thay thế
// `kanji-review-guard.test.ts` của bộ lọc tạm T090.

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

interface Pair {
  itemId: string;
  facet: string;
}

const itemOf = async (exerciseId: string): Promise<string> =>
  (await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [exerciseId]))[0].item_id;

/** Người học Kanji đã học trọn bài số đếm 1 qua "Học thêm" (ngày hôm nay, mọi câu đúng). */
async function learnedKanjiLearner() {
  const learner = await kanjiLearner(api, ctx);
  const unitId = await kanjiUnitId(ctx, UNIT_TITLE);
  const session = await startSession(api, learner, unitId);
  await answerAll(api, ctx, learner, session);
  const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
  expect(done.status).toBe(200);
  return { learner, session, unitId };
}

/** Sinh lại kế hoạch hôm nay (xóa kế hoạch đã lưu rồi gọi `GET /today`). */
async function regeneratePlan(learner: Learner) {
  await query(ctx, 'DELETE FROM daily_plans WHERE user_id = $1', [learner.userId]);
  return getToday(api, learner);
}

/** Các cặp trong mọi gói ôn đã lưu của người học (`review_facets` NULL → `item`). */
async function storedPairs(learner: Learner): Promise<{ pairs: Pair[]; facetsNull: boolean[] }> {
  const rows = await query<{ ids: string[] | null; facets: string[] | null }>(
    ctx,
    `SELECT dpi.review_item_ids AS ids, dpi.review_facets::text[] AS facets
       FROM daily_plan_items dpi JOIN daily_plans dp ON dp.id = dpi.plan_id
      WHERE dp.user_id = $1 AND dpi.type = 'review_batch' ORDER BY dpi.position`,
    [learner.userId],
  );
  const pairs: Pair[] = [];
  for (const row of rows) {
    (row.ids ?? []).forEach((itemId, i) =>
      pairs.push({ itemId, facet: row.facets?.[i] ?? 'item' }),
    );
  }
  return { pairs, facetsNull: rows.map((r) => r.facets === null) };
}

const scheduleRows = (learner: Learner, itemId?: string) =>
  query(
    ctx,
    `SELECT item_id, facet::text AS facet, due_date::text AS due_date, repetitions, lapses,
            interval_days, mastered_at, last_result
       FROM review_schedules WHERE user_id = $1 ${itemId ? 'AND item_id = $2' : ''}
      ORDER BY item_id, facet::text`,
    itemId ? [learner.userId, itemId] : [learner.userId],
  );

const keyOf = (p: Pair) => `${p.itemId}:${p.facet}`;

describe('gói ôn theo cặp (US3.1, US3.2)', () => {
  it('review_item_ids và review_facets song song; chỉ cặp đến hạn; chung quỹ với ôn từ vựng', async () => {
    const { learner } = await learnedKanjiLearner();
    const kanjiRows = await scheduleRows(learner);
    expect(kanjiRows).toHaveLength(9); // 3 chữ × 3 khía cạnh

    // Một cặp chưa đến hạn (dời xa) và một mục từ vựng đến hạn cùng ngày.
    const notDue = kanjiRows.find((r) => r.facet === 'word')!;
    await query(
      ctx,
      `UPDATE review_schedules SET due_date = '2026-02-01' WHERE user_id = $1 AND item_id = $2 AND facet = 'word'`,
      [learner.userId, notDue.item_id],
    );
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
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();
    expect(today.estimatedMinutes).toBeLessThanOrEqual(today.budgetMinutes);

    const [stored] = await query(
      ctx,
      `SELECT review_item_ids, review_facets::text[] AS review_facets FROM daily_plan_items WHERE id = $1`,
      [review.id],
    );
    expect(stored.review_facets).not.toBeNull();
    expect(stored.review_facets).toHaveLength(stored.review_item_ids.length);
    expect(review.itemCount).toBe(stored.review_item_ids.length);

    const { pairs } = await storedPairs(learner);
    const keys = pairs.map(keyOf);
    expect(new Set(keys).size).toBe(keys.length); // không có cặp (chữ, khía cạnh) trùng lặp
    expect(keys).not.toContain(`${notDue.item_id}:word`);
    expect(pairs).toContainEqual({ itemId: vocab!.id, facet: 'item' });
    expect(pairs.filter((p) => p.facet !== 'item')).toHaveLength(8);
  });

  it('gói ôn không có Kanji có review_facets NULL', async () => {
    const learner = await onboardedLearner(api, ctx);
    const [vocab] = await query<{ id: string }>(
      ctx,
      `SELECT ci.id FROM content_items ci
         JOIN exercises e ON e.item_id = ci.id AND e.status = 'active'
        WHERE ci.kind = 'vocabulary' AND ci.status = 'active' LIMIT 1`,
    );
    await query(
      ctx,
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date)
       VALUES ($1, $2, 1, 2.50, '2026-01-04')`,
      [learner.userId, vocab!.id],
    );
    await regeneratePlan(learner);
    const { pairs, facetsNull } = await storedPairs(learner);
    expect(pairs).toContainEqual({ itemId: vocab!.id, facet: 'item' });
    expect(facetsNull.length).toBeGreaterThan(0);
    expect(facetsNull.every(Boolean)).toBe(true);
  });
});

describe('ôn theo cặp: lịch độc lập (US3.3)', () => {
  it('đúng (X, meaning), sai (X, reading): reading đến hạn sau 1 ngày, meaning muộn hơn, word không đổi', async () => {
    const { learner } = await learnedKanjiLearner();
    await advanceDays(api, ctx, learner); // 2026-01-06
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    const session = await startSession(api, learner, review.id);
    expect(session.kind).toBe('review');
    expect(session.exercises).toHaveLength(review.itemCount);

    // Mỗi cặp đúng một câu; X = chữ của câu đầu tiên.
    const rows = await Promise.all(
      session.exercises.map(async (e: any) => ({
        id: e.id,
        facet: e.facet,
        itemId: await itemOf(e.id),
      })),
    );
    expect(new Set(rows.map((r: any) => `${r.itemId}:${r.facet}`)).size).toBe(rows.length);
    const x = rows[0]!.itemId;
    for (const r of rows) {
      const wrong = r.itemId === x && r.facet === 'reading';
      const res = await submit(api, ctx, learner, session.id, r.id, { correct: !wrong });
      expect(res.status).toBe(200);
    }

    const after = Object.fromEntries((await scheduleRows(learner, x)).map((r) => [r.facet, r]));
    expect(after.reading).toMatchObject({ due_date: '2026-01-07', repetitions: 0, lapses: 1 });
    expect(after.meaning).toMatchObject({ due_date: '2026-01-09', repetitions: 2, lapses: 0 });
    expect(after.word).toMatchObject({ due_date: '2026-01-09', repetitions: 2, lapses: 0 });
    expect(after.reading.due_date < after.meaning.due_date).toBe(true);
  });

  it('hai cửa sổ trả lời cùng câu ôn trong ngày → lịch của cặp chỉ cập nhật một lần', async () => {
    const { learner } = await learnedKanjiLearner();
    await advanceDays(api, ctx, learner);
    const review = (await getToday(api, learner)).items.find((i: any) => i.type === 'review_batch');
    const sessionA = await startSession(api, learner, review.id);
    const [copy] = await query(
      ctx,
      `INSERT INTO lesson_sessions (user_id, kind, snapshot, status)
       SELECT user_id, 'review', snapshot, 'in_progress' FROM lesson_sessions WHERE id = $1
       RETURNING id`,
      [sessionA.id],
    );
    const exercise = sessionA.exercises[0];
    const itemId = await itemOf(exercise.id);
    const [a, b] = await Promise.all([
      submit(api, ctx, learner, sessionA.id, exercise.id, { correct: true }),
      submit(api, ctx, learner, copy.id, exercise.id, { correct: false }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const rows = (await scheduleRows(learner, itemId)).filter((r) => r.facet === exercise.facet);
    expect(rows).toHaveLength(1);
    // Học lần đầu: repetitions=1. Chỉ MỘT trong hai lần trả lời của hôm nay được áp: đúng → 2, sai → 0 (lapses 1).
    expect(rows[0]!.repetitions + rows[0]!.lapses * 10).toSatisfy(
      (v: number) => v === 2 || v === 10,
    );
  });
});

describe('đánh dấu chữ thành thạo (US3, research K7)', () => {
  it('đánh dấu → mọi cặp có mastered_at và không vào gói ôn; bỏ đánh dấu → quay lại từ due_date đã lưu', async () => {
    const { learner, session } = await learnedKanjiLearner();
    const x = await itemOf(session.exercises[0].id);
    await advanceDays(api, ctx, learner);

    const marked = await api.put(`/path/items/${x}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(marked.status).toBe(200);
    const rows = await scheduleRows(learner, x);
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.mastered_at).not.toBeNull();

    await regeneratePlan(learner);
    expect((await storedPairs(learner)).pairs.some((p) => p.itemId === x)).toBe(false);
    expect((await storedPairs(learner)).pairs.length).toBeGreaterThan(0); // các chữ khác vẫn được ôn

    const dueBefore = rows.map((r) => r.due_date);
    const unmarked = await api.put(`/path/items/${x}/master`, {
      token: learner.token,
      body: { mastered: false },
    });
    expect(unmarked.status).toBe(200);
    const back = await scheduleRows(learner, x);
    for (const r of back) expect(r.mastered_at).toBeNull();
    expect(back.map((r) => r.due_date)).toEqual(dueBefore);
    await regeneratePlan(learner);
    expect(
      (await storedPairs(learner)).pairs
        .filter((p) => p.itemId === x)
        .map((p) => p.facet)
        .sort(),
    ).toEqual(['meaning', 'reading', 'word']);
  });

  it('đánh dấu thành thạo cả bài không loại lịch ôn các chữ của bài khỏi gói ôn', async () => {
    const { learner, unitId } = await learnedKanjiLearner();
    await advanceDays(api, ctx, learner);
    const res = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(res.status).toBe(200);
    expect(
      (
        await query(
          ctx,
          `SELECT status::text AS s FROM unit_progress WHERE user_id = $1 AND unit_id = $2`,
          [learner.userId, unitId],
        )
      )[0].s,
    ).toBe('mastered');

    await regeneratePlan(learner);
    const { pairs } = await storedPairs(learner);
    expect(pairs.length).toBe(9);
    for (const r of await scheduleRows(learner)) expect(r.mastered_at).toBeNull();
  });
});

describe('bài tập ngừng và bài dở dang', () => {
  it('ngừng bài tập duy nhất của một cặp → cặp bị bỏ qua, lịch giữ nguyên (FR-022)', async () => {
    const { learner, session } = await learnedKanjiLearner();
    const x = await itemOf(session.exercises[0].id);
    const before = await scheduleRows(learner, x);
    await query(
      ctx,
      `UPDATE exercises SET status = 'inactive' WHERE item_id = $1 AND facet = 'word'`,
      [x],
    );
    try {
      await advanceDays(api, ctx, learner);
      await regeneratePlan(learner);
      const { pairs } = await storedPairs(learner);
      expect(pairs).not.toContainEqual({ itemId: x, facet: 'word' });
      expect(pairs).toContainEqual({ itemId: x, facet: 'meaning' });
      expect(await scheduleRows(learner, x)).toEqual(before);
    } finally {
      await query(
        ctx,
        `UPDATE exercises SET status = 'active' WHERE item_id = $1 AND facet = 'word'`,
        [x],
      );
    }
  });

  it('bài Kanji dở dang: chữ đã trả lời có dòng lịch nhưng KHÔNG vào gói ôn; vào gói ôn sau khi hoàn thành', async () => {
    const learner = await kanjiLearner(api, ctx);
    const session = await startSession(api, learner, await kanjiUnitId(ctx, UNIT_TITLE));
    for (const exercise of session.exercises.slice(0, 4)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    const partial = await scheduleRows(learner);
    expect(partial.length).toBeGreaterThan(0);
    // Dòng lịch của bài dở dang quá hạn từ hôm qua nhưng chưa được coi là "đã học".
    await query(ctx, `UPDATE review_schedules SET due_date = '2026-01-04' WHERE user_id = $1`, [
      learner.userId,
    ]);
    await regeneratePlan(learner);
    expect((await storedPairs(learner)).pairs).toEqual([]);

    for (const exercise of session.exercises.slice(4)) {
      await submit(api, ctx, learner, session.id, exercise.id);
    }
    expect(
      (await api.post(`/sessions/${session.id}/complete`, { token: learner.token })).status,
    ).toBe(200);
    await query(ctx, `UPDATE review_schedules SET due_date = '2026-01-04' WHERE user_id = $1`, [
      learner.userId,
    ]);
    await regeneratePlan(learner);
    const { pairs } = await storedPairs(learner);
    expect(pairs).toHaveLength(9);
  });
});
