/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  answerAll,
  answerFor,
  getToday,
  onboardedLearner,
  query,
  startSession,
  submit,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US3 (T075) trên PostgreSQL thật: cập nhật `review_schedules` cùng giao dịch với
// `study_records`, mục đến hạn vào `/today`, phiên ôn tập, đồng thời (FR-041, SC-012, quickstart K10).

let ctx: TestApp;
let api: ContractClient;
const START = '2026-01-05T08:00:00Z';

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

/** Sang ngày địa phương kế tiếp: access token cũ hết hạn (15 phút) nên đăng nhập lại. */
async function nextDay(learner: Learner, days = 1): Promise<void> {
  ctx.clock.advanceDays(days);
  const login = await api.post('/auth/login', {
    body: { email: learner.user.email, password: learner.user.password },
  });
  learner.token = login.body.accessToken;
}

const schedulesOf = (learner: Learner) =>
  query(
    ctx,
    `SELECT item_id, interval_days, ease::float AS ease, repetitions, lapses,
            due_date::text AS due_date, last_result, last_reviewed_local_date::text AS reviewed_on,
            is_hard
       FROM review_schedules WHERE user_id = $1 ORDER BY item_id`,
    [learner.userId],
  );

const itemOf = async (exerciseId: string): Promise<string | null> =>
  (await query(ctx, 'SELECT item_id FROM exercises WHERE id = $1', [exerciseId]))[0].item_id;

/** Học một đơn vị mới ngày hiện tại; trả phiên và item của từng bài tập. */
async function learnFirstUnit(learner: Learner, options: { wrongIndexes?: number[] } = {}) {
  const plan = await getToday(api, learner);
  const session = await startSession(api, learner, plan.items[0].id);
  const itemIds = await Promise.all(session.exercises.map((e: any) => itemOf(e.id)));
  const results = await answerAll(api, ctx, learner, session, options);
  const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
  expect(done.status).toBe(200);
  return { plan, session, itemIds, results };
}

describe('cập nhật lịch ôn khi trả lời (R6, FR-023)', () => {
  it('trả lời đúng/sai tạo lịch theo R6 và trả ngày ôn kế tiếp; mục đến hạn xuất hiện trong /today', async () => {
    const learner = await onboardedLearner(api, ctx);
    const { session, itemIds, results } = await learnFirstUnit(learner, { wrongIndexes: [0] });

    // Mọi câu có item đều trả ngày ôn kế tiếp = ngày mai (cả đúng lẫn sai: lần đầu → 1 ngày).
    results.forEach((r: any, i: number) => {
      expect(r.nextReviewDate).toBe(itemIds[i] ? '2026-01-06' : null);
    });

    const rows = await schedulesOf(learner);
    const distinctItems = new Set(itemIds.filter(Boolean));
    expect(rows).toHaveLength(distinctItems.size);
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Câu đầu trả lời sai: lapses=1, repetitions=0, ease 2.1; các mục khác đúng: reps=1, ease 2.3.
    const wrongItem = rows.find((r) => r.item_id === itemOf0(itemIds));
    expect(wrongItem).toMatchObject({
      lapses: 1,
      repetitions: 0,
      interval_days: 1,
      ease: 2.1,
      last_result: false,
      due_date: '2026-01-06',
      reviewed_on: '2026-01-05',
    });
    const rightItems = rows.filter((r) => r.item_id !== itemOf0(itemIds));
    expect(rightItems.length).toBeGreaterThan(0);
    for (const r of rightItems) {
      expect(r).toMatchObject({ lapses: 0, repetitions: 1, interval_days: 1, ease: 2.3 });
      expect(r.last_result).toBe(true);
    }

    // Mỗi study_record chính đều có lịch tương ứng (cùng giao dịch).
    const records = await query(
      ctx,
      `SELECT count(*)::int AS n FROM study_records WHERE session_id = $1 AND is_retry = false`,
      [session.id],
    );
    expect(records[0].n).toBe(session.exercises.length);

    // Ngày mai: mục đến hạn nằm trong gói ôn của /today, ≤ 60% quỹ, tổng ≤ quỹ.
    await nextDay(learner);
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();
    expect(review.itemCount).toBe(rows.length);
    expect(review.title).toBe('Ôn tập');
    expect(review.estMinutes).toBeLessThanOrEqual(6);
    expect(today.estimatedMinutes).toBeLessThanOrEqual(today.budgetMinutes);
    const [stored] = await query(
      ctx,
      `SELECT review_item_ids FROM daily_plan_items WHERE id = $1`,
      [review.id],
    );
    expect([...stored.review_item_ids].sort()).toEqual(rows.map((r) => r.item_id).sort());
  });

  it('phiên ôn tập: snapshot một bài mỗi mục, đúng → xa hơn, sai → ngày mai, hoàn thành mục kế hoạch', async () => {
    const learner = await onboardedLearner(api, ctx);
    await learnFirstUnit(learner, { wrongIndexes: [0] });
    const before = new Map((await schedulesOf(learner)).map((r) => [r.item_id, r]));

    await nextDay(learner);
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    const session = await startSession(api, learner, review.id);
    expect(session.kind).toBe('review');
    expect(session.title).toBe('Ôn tập');
    expect(session.exercises).toHaveLength(review.itemCount);
    // Không lộ đáp án (R16).
    expect(JSON.stringify(session.exercises)).not.toMatch(/correct_index|accepted_answers/);

    // Tiếp tục phiên: cùng phiên.
    expect((await startSession(api, learner, review.id)).id).toBe(session.id);

    const itemIds: string[] = await Promise.all(session.exercises.map((e: any) => itemOf(e.id)));
    expect(new Set(itemIds).size).toBe(itemIds.length); // mỗi mục đúng một bài
    // Sai mục đầu tiên, đúng các mục còn lại.
    const results = await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const after = new Map((await schedulesOf(learner)).map((r) => [r.item_id, r]));

    const wrongId = itemIds[0]!;
    expect(after.get(wrongId)).toMatchObject({
      interval_days: 1,
      repetitions: 0,
      due_date: '2026-01-07',
      reviewed_on: '2026-01-06',
    });
    expect(after.get(wrongId)!.lapses).toBe(before.get(wrongId)!.lapses + 1);
    expect(results[0].nextReviewDate).toBe('2026-01-07');

    for (const id of itemIds.slice(1)) {
      const prev = before.get(id)!;
      const next = after.get(id)!;
      expect(next.last_result).toBe(true);
      expect(next.reviewed_on).toBe('2026-01-06');
      if (prev.repetitions === 1) {
        // Lần đúng thứ hai: 3 ngày (R6).
        expect(next).toMatchObject({ repetitions: 2, interval_days: 3, due_date: '2026-01-09' });
      } else {
        // Mục đã sai hôm trước (repetitions=0): đúng lại → xa hơn sai.
        expect(next.interval_days).toBeGreaterThanOrEqual(1);
      }
      expect(next.due_date > '2026-01-07').toBe(true);
    }

    // Ghi nhận context 'review' và hoàn thành mục kế hoạch.
    const ctxRows = await query(
      ctx,
      `SELECT DISTINCT context FROM study_records WHERE session_id = $1`,
      [session.id],
    );
    expect(ctxRows).toEqual([{ context: 'review' }]);
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
    const [item] = await query(ctx, 'SELECT status FROM daily_plan_items WHERE id = $1', [
      review.id,
    ]);
    expect(item.status).toBe('completed');
    const [unitProgressCount] = await query(
      ctx,
      `SELECT count(*)::int AS n FROM unit_progress WHERE user_id = $1`,
      [learner.userId],
    );
    expect(unitProgressCount.n).toBe(1); // phiên ôn không tạo/đổi tiến độ đơn vị
  });
});

/** Item của bài tập đầu tiên (mục bị trả lời sai trong `wrongIndexes: [0]`). */
function itemOf0(itemIds: (string | null)[]): string {
  return itemIds[0]!;
}

describe('đồng thời và câu hỏi lại (FR-041, SC-012, quickstart K10)', () => {
  it('câu isRetry và gửi lại cùng clientEventId không đổi lịch ôn', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const first = session.exercises[0];
    const clientEventId = randomUUID();
    const res = await submit(api, ctx, learner, session.id, first.id, {
      correct: false,
      clientEventId,
    });
    expect(res.status).toBe(200);
    const snapshotRow = (await schedulesOf(learner)).find(
      (r) => r.item_id === null || r.last_result === false,
    )!;
    expect(snapshotRow).toMatchObject({ lapses: 1, repetitions: 0, due_date: '2026-01-06' });

    // Câu hỏi lại cuối phiên (đúng): không đổi lịch, vẫn trả ngày ôn hiện có.
    const retry = await submit(api, ctx, learner, session.id, first.id, {
      correct: true,
      isRetry: true,
    });
    expect(retry.status).toBe(200);
    expect(retry.body.isCorrect).toBe(true);
    expect(retry.body.nextReviewDate).toBe('2026-01-06');
    expect((await schedulesOf(learner)).find((r) => r.item_id === snapshotRow.item_id)).toEqual(
      snapshotRow,
    );

    // Gửi lại cùng clientEventId (mất kết nối, thử lại): duplicate, lịch không đổi.
    const replay = await api.post(`/sessions/${session.id}/answers`, {
      token: learner.token,
      body: { clientEventId, exerciseId: first.id, answer: await answerFor(ctx, first.id, false) },
    });
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
    expect(replay.body.nextReviewDate).toBe('2026-01-06');
    expect((await schedulesOf(learner)).find((r) => r.item_id === snapshotRow.item_id)).toEqual(
      snapshotRow,
    );
  });

  it('hai phiên khác nhau cùng ôn một mục trong ngày → lịch chỉ cập nhật một lần', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const sessionA = await startSession(api, learner, plan.items[0].id);

    // Tìm hai bài tập thuộc hai mục khác nhau.
    const itemIds: (string | null)[] = await Promise.all(
      sessionA.exercises.map((e: any) => itemOf(e.id)),
    );
    const firstIdx = itemIds.findIndex((i) => i !== null);
    const otherIdx = itemIds.findIndex((i) => i !== null && i !== itemIds[firstIdx]);
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(otherIdx).toBeGreaterThan(firstIdx);

    // Phiên B: bản sao snapshot của A (cửa sổ khác cùng ôn các mục này trong ngày).
    const [copy] = await query(
      ctx,
      `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot, status)
       SELECT user_id, 'extra', unit_id, snapshot, 'in_progress' FROM lesson_sessions WHERE id = $1
       RETURNING id`,
      [sessionA.id],
    );
    const sessionBId: string = copy.id;

    // Hai cửa sổ trả lời cùng bài tập đồng thời với clientEventId khác nhau.
    const exerciseId = sessionA.exercises[firstIdx].id;
    const [a, b] = await Promise.all([
      submit(api, ctx, learner, sessionA.id, exerciseId, { correct: true }),
      submit(api, ctx, learner, sessionBId, exerciseId, { correct: false }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const rows = (await schedulesOf(learner)).filter((r) => r.item_id === itemIds[firstIdx]);
    expect(rows).toHaveLength(1);
    // Chỉ MỘT trong hai lần trả lời cập nhật lịch: hoặc đúng (repetitions=1, lapses=0) hoặc sai (lapses=1).
    expect(rows[0]!.repetitions + rows[0]!.lapses).toBe(1);
    expect(rows[0]!.reviewed_on).toBe('2026-01-05');
    // Cả hai câu trả lời vẫn được ghi (mỗi phiên một lượt chính).
    const records = await query(
      ctx,
      `SELECT count(*)::int AS n FROM study_records
        WHERE user_id = $1 AND exercise_id = $2 AND is_retry = false`,
      [learner.userId, exerciseId],
    );
    expect(records[0].n).toBe(2);

    // Lần trả lời thứ hai trong ngày (phiên B) cho mục khác cũng không ghi đè lịch đã cập nhật hôm nay.
    const otherExercise = sessionA.exercises[otherIdx].id;
    const first = await submit(api, ctx, learner, sessionA.id, otherExercise, { correct: true });
    expect(first.body.nextReviewDate).toBe('2026-01-06');
    const second = await submit(api, ctx, learner, sessionBId, otherExercise, { correct: false });
    expect(second.body.nextReviewDate).toBe('2026-01-06');
    const other = (await schedulesOf(learner)).find((r) => r.item_id === itemIds[otherIdx])!;
    expect(other).toMatchObject({ repetitions: 1, lapses: 0, last_result: true });
  });

  it('nhiều yêu cầu đồng thời cho cùng một mục chưa có lịch chỉ tạo một dòng lịch', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const idx = (await Promise.all(session.exercises.map((e: any) => itemOf(e.id)))).findIndex(
      (i) => i !== null,
    );
    const ids: string[] = [];
    for (let k = 0; k < 4; k++) {
      const [copy] = await query(
        ctx,
        `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot, status)
         SELECT user_id, 'extra', unit_id, snapshot, 'in_progress' FROM lesson_sessions WHERE id = $1
         RETURNING id`,
        [session.id],
      );
      ids.push(copy.id);
    }
    const exerciseId = session.exercises[idx].id;
    const results = await Promise.all(
      ids.map((id) => submit(api, ctx, learner, id, exerciseId, { correct: true })),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const itemId = await itemOf(exerciseId);
    const rows = (await schedulesOf(learner)).filter((r) => r.item_id === itemId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ repetitions: 1, interval_days: 1 });
  });
});

describe('mục bị admin chuyển inactive (data-model §2.16)', () => {
  it('không vào gói ôn nhưng dòng review_schedules vẫn còn', async () => {
    const learner = await onboardedLearner(api, ctx);
    await learnFirstUnit(learner);
    const rows = await schedulesOf(learner);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const [inactiveItem, noExerciseItem, ...rest] = rows.map((r) => r.item_id as string);

    await query(ctx, `UPDATE content_items SET status = 'inactive' WHERE id = $1`, [inactiveItem]);
    await query(ctx, `UPDATE exercises SET status = 'inactive' WHERE item_id = $1`, [
      noExerciseItem,
    ]);

    await nextDay(learner);
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    expect(review.itemCount).toBe(rest.length);
    const [stored] = await query(
      ctx,
      `SELECT review_item_ids FROM daily_plan_items WHERE id = $1`,
      [review.id],
    );
    expect([...stored.review_item_ids].sort()).toEqual([...rest].sort());

    // Dòng lịch của hai mục bị loại vẫn còn nguyên (lịch tiếp tục khi mục được kích hoạt lại).
    const after = await schedulesOf(learner);
    expect(after.map((r) => r.item_id).sort()).toEqual(rows.map((r) => r.item_id).sort());
    for (const id of [inactiveItem, noExerciseItem]) {
      expect(after.find((r) => r.item_id === id)).toEqual(rows.find((r) => r.item_id === id));
    }

    // Phiên ôn không chứa bài tập của các mục bị loại.
    const session = await startSession(api, learner, review.id);
    const sessionItems = await Promise.all(session.exercises.map((e: any) => itemOf(e.id)));
    expect(sessionItems.sort()).toEqual([...rest].sort());
  });

  it('mục ngoài ngày đến hạn không vào gói ôn của hôm nay', async () => {
    const learner = await onboardedLearner(api, ctx);
    await learnFirstUnit(learner);
    // Đẩy mọi lịch sang 10 ngày sau: hôm sau không có gì đến hạn.
    await query(
      ctx,
      `UPDATE review_schedules SET due_date = date '2026-01-15' WHERE user_id = $1`,
      [learner.userId],
    );
    await nextDay(learner);
    const today = await getToday(api, learner);
    expect(today.items.some((i: any) => i.type === 'review_batch')).toBe(false);
    expect(today.items.length).toBeGreaterThan(0);
  });
});
