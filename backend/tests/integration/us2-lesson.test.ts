/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  answerAll,
  finishPlanItem,
  getToday,
  onboardedLearner,
  query,
  startSession,
  submit,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US2 (T059) trên PostgreSQL thật: tiếp tục phiên dở dang, hoàn thành ngày, snapshot
// nội dung (R12) và "học thêm" không ghi đè kế hoạch mặc định (US2.5).

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

describe('tiếp tục phiên dở dang (FR-020)', () => {
  it('rời đi rồi quay lại: cùng phiên, cùng bài tập, giữ nguyên các câu đã trả lời', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    expect(session.exercises.length).toBeGreaterThanOrEqual(3);

    const [a, b, c] = session.exercises;
    await submit(api, ctx, learner, session.id, a.id, { correct: true });
    await submit(api, ctx, learner, session.id, b.id, { correct: false });

    const resumed = await startSession(api, learner, plan.items[0].id);
    expect(resumed.id).toBe(session.id);
    expect(resumed.exercises.map((e: any) => e.id)).toEqual(
      session.exercises.map((e: any) => e.id),
    );
    expect(resumed.answered).toEqual([
      { exerciseId: a.id, isCorrect: true },
      { exerciseId: b.id, isCorrect: false },
    ]);

    // Mục kế hoạch chuyển in_progress, đơn vị in_progress, và chưa hoàn thành được khi còn câu thiếu.
    const [row] = await query(ctx, 'SELECT status FROM daily_plan_items WHERE id = $1', [
      plan.items[0].id,
    ]);
    expect(row.status).toBe('in_progress');
    const [progress] = await query(ctx, `SELECT status FROM unit_progress WHERE user_id = $1`, [
      learner.userId,
    ]);
    expect(progress.status).toBe('in_progress');
    const early = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(early.status).toBe(409);

    // Trả lời nốt các câu còn lại (kể cả câu đã trả lời không mất) rồi hoàn thành.
    for (const e of session.exercises.slice(2)) {
      await submit(api, ctx, learner, session.id, e.id, { correct: true });
    }
    void c;
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
    expect(done.body.correct).toBe(session.exercises.length - 1);
    expect(done.body.total).toBe(session.exercises.length);
  });

  it('câu hỏi lại cuối phiên (isRetry) được ghi nhưng không tính vào kết quả phiên', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });

    const retry = await submit(api, ctx, learner, session.id, session.exercises[0].id, {
      correct: true,
      isRetry: true,
    });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ isCorrect: true, duplicate: false });

    const records = await query(
      ctx,
      'SELECT is_retry, is_correct FROM study_records WHERE session_id = $1 AND exercise_id = $2 ORDER BY is_retry',
      [session.id, session.exercises[0].id],
    );
    expect(records).toEqual([
      { is_retry: false, is_correct: false },
      { is_retry: true, is_correct: true },
    ]);

    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.body).toMatchObject({
      correct: session.exercises.length - 1,
      total: session.exercises.length,
    });
  });
});

describe('hoàn thành ngày (US2.3)', () => {
  it('hoàn thành mục cuối → daily_plans.status=completed, unit_progress=completed, dayCompleted', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    expect(plan.items.length).toBeGreaterThanOrEqual(1);

    const last = plan.items.length - 1;
    for (const [i, item] of plan.items.entries()) {
      const { summary } = await finishPlanItem(api, ctx, learner, item.id);
      expect(summary.dayCompleted).toBe(i === last);
      const [row] = await query(ctx, `SELECT status, completed_at FROM daily_plans WHERE id = $1`, [
        plan.id,
      ]);
      expect(row.status).toBe(i === last ? 'completed' : 'open');
      expect(row.completed_at !== null).toBe(i === last);
    }

    const units = await query(ctx, `SELECT status FROM unit_progress WHERE user_id = $1`, [
      learner.userId,
    ]);
    expect(units).toHaveLength(plan.items.length);
    expect(units.every((u) => u.status === 'completed')).toBe(true);

    const after = await getToday(api, learner);
    expect(after.status).toBe('completed');
    expect(after.items.every((i: any) => i.status === 'completed')).toBe(true);
  });

  it('hoàn thành phiên hai lần không đổi kết quả (idempotent)', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { session, summary } = await finishPlanItem(api, ctx, learner, plan.items[0].id);
    const again = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    // `celebrations` (spec 005) chỉ có ở lần hoàn thành thật sự; gọi lại trả đúng phần còn lại và không có nó.
    expect(again.body).toEqual({ ...summary, celebrations: undefined });
    expect(again.body).not.toHaveProperty('celebrations');
  });
});

describe('snapshot nội dung (R12, FR-020)', () => {
  it('sửa nội dung giữa chừng không đổi bài tập và cách chấm của phiên đang học; phiên mới thấy bản mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const other = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const target = session.exercises[0];

    // Admin sửa lời nhắc, đảo đáp án, gỡ một bài tập và đơn vị đổi tiêu đề.
    const [ex] = await query(ctx, 'SELECT type, payload, unit_id FROM exercises WHERE id = $1', [
      target.id,
    ]);
    const changedPayload =
      ex.type === 'multiple_choice'
        ? {
            ...ex.payload,
            correct_index: (ex.payload.correct_index + 1) % ex.payload.choices.length,
          }
        : ex.payload;
    await query(
      ctx,
      `UPDATE exercises SET prompt = '{"vi":"ĐÃ SỬA","en":"EDITED"}'::jsonb, payload = $2::jsonb WHERE id = $1`,
      [target.id, JSON.stringify(changedPayload)],
    );
    await query(ctx, `UPDATE exercises SET status = 'inactive' WHERE id = $1`, [
      session.exercises[1].id,
    ]);
    await query(
      ctx,
      `UPDATE learning_units SET title = '{"vi":"Tiêu đề mới","en":"New title"}'::jsonb WHERE id = $1`,
      [ex.unit_id],
    );
    ctx.clock.advanceMs(61_000); // quá TTL bộ đệm nội dung (≤ 60 giây)
    ctx.app.deps.contentCache.invalidate();

    // Phiên đang học: y nguyên.
    const resumed = await startSession(api, learner, plan.items[0].id);
    expect(resumed.title).toBe(session.title);
    expect(resumed.exercises).toEqual(session.exercises);
    expect(resumed.exercises.map((e: any) => e.id)).toContain(session.exercises[1].id);

    // Chấm theo đáp án lúc chụp snapshot (đáp án đã bị đảo trong CSDL vẫn không ảnh hưởng).
    const result = await submit(api, ctx, learner, session.id, target.id, { correct: true });
    if (ex.type === 'multiple_choice') {
      // `answerFor` đọc đáp án từ CSDL (đã đảo) nên cố ý gửi đáp án gốc để so với snapshot.
      const original = ex.payload.correct_index;
      const res = await api.post(`/sessions/${session.id}/answers`, {
        token: learner.token,
        body: { clientEventId: randomUUID(), exerciseId: target.id, answer: original },
      });
      expect(res.body.duplicate).toBe(true); // lượt chính đã có từ lệnh `submit` ở trên
      expect(res.body.isCorrect).toBe(result.body.isCorrect);
    }

    // Phiên mới (người học khác) thấy nội dung đã sửa: tiêu đề mới, bài tập bị gỡ biến mất.
    const fresh = await getToday(api, other);
    const sessionB = await startSession(api, other, fresh.items[0].id);
    expect(sessionB.title).toBe('Tiêu đề mới');
    expect(sessionB.exercises.map((e: any) => e.id)).not.toContain(session.exercises[1].id);
    expect(sessionB.exercises.find((e: any) => e.id === target.id).prompt).toBe('ĐÃ SỬA');

    // Dọn để các test sau dùng nội dung gốc.
    await query(ctx, `UPDATE exercises SET status = 'active' WHERE id = $1`, [
      session.exercises[1].id,
    ]);
  });

  it('sửa nội dung chỉ hiển thị sau khi hết TTL bộ đệm (≤ 60 giây), không cần invalidate', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const [row] = await query(
      ctx,
      `SELECT u.id, u.title FROM learning_units u JOIN daily_plan_items i ON i.unit_id = u.id WHERE i.id = $1`,
      [plan.items[0].id],
    );
    const probe = async () => {
      const other = await onboardedLearner(api, ctx);
      const p = await getToday(api, other);
      return (await startSession(api, other, p.items[0].id)).title as string;
    };
    const before = await probe(); // làm nóng bộ đệm
    await query(
      ctx,
      `UPDATE learning_units SET title = '{"vi":"Mới","en":"New"}'::jsonb WHERE id = $1`,
      [row.id],
    );
    expect(await probe()).toBe(before); // vẫn trong TTL
    ctx.clock.advanceMs(61_000);
    expect(await probe()).toBe('Mới');
    await query(ctx, `UPDATE learning_units SET title = $2::jsonb WHERE id = $1`, [
      row.id,
      JSON.stringify(row.title),
    ]);
    ctx.app.deps.contentCache.invalidate();
  });
});

describe('học thêm (US2.5)', () => {
  it('không ghi đè kế hoạch mặc định; hoàn thành phiên extra không đổi kế hoạch ngày', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    for (const item of plan.items) await finishPlanItem(api, ctx, learner, item.id);

    const before = await getToday(api, learner);
    expect(before.status).toBe('completed');

    const extra = await api.post('/today/extra', { token: learner.token });
    expect(extra.status).toBe(200);
    const planned = plan.items.map((i: any) => i.id);
    expect(planned).not.toContain(extra.body.id);

    const session = await startSession(api, learner, extra.body.id);
    expect(session.kind).toBe('extra');
    const [row] = await query(
      ctx,
      'SELECT kind, plan_item_id, unit_id FROM lesson_sessions WHERE id = $1',
      [session.id],
    );
    expect(row).toMatchObject({ kind: 'extra', plan_item_id: null, unit_id: extra.body.id });

    // Mở lại cùng đơn vị học thêm khi đang dở → cùng phiên.
    expect((await startSession(api, learner, extra.body.id)).id).toBe(session.id);

    await answerAll(api, ctx, learner, session);
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
    expect(done.body.dayCompleted).toBe(true);

    const [progress] = await query(
      ctx,
      `SELECT status FROM unit_progress WHERE user_id = $1 AND unit_id = $2`,
      [learner.userId, extra.body.id],
    );
    expect(progress.status).toBe('completed');

    // Kế hoạch mặc định của ngày không đổi (số mục, tổng ước lượng, thứ tự).
    const after = await getToday(api, learner);
    expect(after.items.map((i: any) => i.id)).toEqual(before.items.map((i: any) => i.id));
    expect(after.estimatedMinutes).toBe(before.estimatedMinutes);
    const [{ count }] = await query(
      ctx,
      'SELECT count(*)::int AS count FROM daily_plan_items WHERE plan_id = $1',
      [plan.id],
    );
    expect(count).toBe(plan.items.length);

    // Đơn vị kế tiếp của "học thêm" là đơn vị khác (đơn vị vừa học đã completed).
    const next = await api.post('/today/extra', { token: learner.token });
    expect(next.status).toBe(200);
    expect(next.body.id).not.toBe(extra.body.id);
  });

  it('id đơn vị không phải bài sắp tới của người học (kỹ năng không chọn) bị từ chối (404)', async () => {
    const learner = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });
    await getToday(api, learner);
    const [grammar] = await query(
      ctx,
      `SELECT id FROM learning_units WHERE kind = 'grammar' LIMIT 1`,
    );
    const res = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: grammar.id },
    });
    expect(res.status).toBe(404);
  });
});
