/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  answerAll,
  answerFor,
  getToday,
  onboardedLearner,
  query,
  startSession,
  submit,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US2 (T058): mọi request/response đối chiếu `contracts/openapi.yaml`.
// Phạm vi: POST /today/extra, /sessions, /sessions/{id}/answers, /intervals, /complete.

let ctx: TestApp;
let api: ContractClient;
let learner: Learner;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  learner = await onboardedLearner(api, ctx);
});
afterAll(async () => {
  await ctx.close();
});

describe('POST /sessions', () => {
  it('200 LessonSession cho mục kế hoạch: có kind, title, bài tập KHÔNG kèm đáp án', async () => {
    const plan = await getToday(api, learner);
    const item = plan.items[0];
    const { status, body } = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: item.id },
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'in_progress', kind: 'new_unit', answered: [] });
    expect(body.title).toBe(item.title);
    expect(body.exercises.length).toBeGreaterThan(0);
    const raw = JSON.stringify(body.exercises);
    expect(raw).not.toContain('correct_index');
    expect(raw).not.toContain('accepted_answers');
    expect(raw).not.toContain('"pairs"');
  });

  it('gọi lại cho cùng mục trả lại đúng phiên đó (tiếp tục)', async () => {
    const plan = await getToday(api, learner);
    const first = await startSession(api, learner, plan.items[0].id);
    const again = await startSession(api, learner, plan.items[0].id);
    expect(again.id).toBe(first.id);
  });

  it('422 khi planItemId không phải UUID; 404 khi không thuộc người học; 401 khi thiếu token', async () => {
    const bad = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: 'khong-phai-uuid' },
      validateRequest: false,
    });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.planItemId).toBeTruthy();

    const missing = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: randomUUID() },
    });
    expect(missing.status).toBe(404);

    // Mục kế hoạch của người học khác bị coi như không tồn tại (R16).
    const other = await onboardedLearner(api, ctx);
    const theirs = (await getToday(api, other)).items[0].id;
    const forbidden = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: theirs },
    });
    expect(forbidden.status).toBe(404);

    const anon = await api.post('/sessions', {
      body: { planItemId: randomUUID() },
      validateResponse: false,
    });
    expect(anon.status).toBe(401);
  });
});

describe('POST /sessions/{sessionId}/answers', () => {
  it('200 AnswerResult: đúng không có correctAnswer, sai có correctAnswer và phản hồi', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const [first, second] = session.exercises;

    const right = await submit(api, ctx, learner, session.id, first.id, { correct: true });
    expect(right.status).toBe(200);
    expect(right.body).toMatchObject({ isCorrect: true, duplicate: false });
    expect(right.body.feedback).toBeTruthy();
    expect(right.body).not.toHaveProperty('correctAnswer');

    const wrong = await submit(api, ctx, learner, session.id, second.id, { correct: false });
    expect(wrong.status).toBe(200);
    expect(wrong.body).toMatchObject({ isCorrect: false, duplicate: false });
    expect(wrong.body.correctAnswer).toBeDefined();
  });

  it('trùng clientEventId trả lại kết quả cũ với duplicate=true', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const exercise = session.exercises[2] ?? session.exercises[0];
    const clientEventId = randomUUID();
    const first = await submit(api, ctx, learner, session.id, exercise.id, { clientEventId });
    const second = await submit(api, ctx, learner, session.id, exercise.id, { clientEventId });
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.isCorrect).toBe(first.body.isCorrect);
  });

  it('422 khi thiếu câu trả lời hoặc bài tập không thuộc phiên; 404 phiên lạ; 401 thiếu token', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);

    const noAnswer = await api.post(`/sessions/${session.id}/answers`, {
      token: learner.token,
      body: { clientEventId: randomUUID(), exerciseId: session.exercises[0].id },
      validateRequest: false,
    });
    expect(noAnswer.status).toBe(422);
    expect(noAnswer.body.fields.answer).toBeTruthy();

    const foreign = await api.post(`/sessions/${session.id}/answers`, {
      token: learner.token,
      body: { clientEventId: randomUUID(), exerciseId: randomUUID(), answer: 0 },
    });
    expect(foreign.status).toBe(422);
    expect(foreign.body.fields.exerciseId).toBeTruthy();

    const unknown = await api.post(`/sessions/${randomUUID()}/answers`, {
      token: learner.token,
      body: { clientEventId: randomUUID(), exerciseId: randomUUID(), answer: 0 },
    });
    expect(unknown.status).toBe(404);

    const anon = await api.post(`/sessions/${session.id}/answers`, {
      body: { clientEventId: randomUUID(), exerciseId: randomUUID(), answer: 0 },
      validateResponse: false,
    });
    expect(anon.status).toBe(401);
  });

  it('người học khác không ghi được vào phiên của người này (404)', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const intruder = await onboardedLearner(api, ctx);
    const res = await api.post(`/sessions/${session.id}/answers`, {
      token: intruder.token,
      body: { clientEventId: randomUUID(), exerciseId: session.exercises[0].id, answer: 0 },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /sessions/{sessionId}/intervals', () => {
  it('204 khi ghi hợp lệ và khi gửi lại; 422 khi thời lượng vượt 1800 giây', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const body = {
      clientEventId: randomUUID(),
      startedAt: '2026-01-05T08:00:00Z',
      durationSeconds: 90,
    };
    const first = await api.post(`/sessions/${session.id}/intervals`, {
      token: learner.token,
      body,
    });
    expect(first.status).toBe(204);
    const again = await api.post(`/sessions/${session.id}/intervals`, {
      token: learner.token,
      body,
    });
    expect(again.status).toBe(204);
    const rows = await query(ctx, 'SELECT 1 FROM study_intervals WHERE client_event_id = $1', [
      body.clientEventId,
    ]);
    expect(rows).toHaveLength(1);

    for (const durationSeconds of [1801, 0]) {
      const bad = await api.post(`/sessions/${session.id}/intervals`, {
        token: learner.token,
        body: { ...body, clientEventId: randomUUID(), durationSeconds },
        validateRequest: false,
      });
      expect(bad.status).toBe(422);
      expect(bad.body.fields.durationSeconds).toBeTruthy();
    }
  });

  it('404 với phiên không tồn tại', async () => {
    const res = await api.post(`/sessions/${randomUUID()}/intervals`, {
      token: learner.token,
      body: { clientEventId: randomUUID(), startedAt: '2026-01-05T08:00:00Z', durationSeconds: 10 },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /sessions/{sessionId}/complete', () => {
  it('409 SESSION_INCOMPLETE khi còn câu chưa trả lời, rồi 200 SessionSummary khi đủ', async () => {
    const fresh = await onboardedLearner(api, ctx);
    const plan = await getToday(api, fresh);
    const session = await startSession(api, fresh, plan.items[0].id);

    const early = await api.post(`/sessions/${session.id}/complete`, { token: fresh.token });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('SESSION_INCOMPLETE');

    await answerAll(api, ctx, fresh, session, { wrongIndexes: [0] });
    const done = await api.post(`/sessions/${session.id}/complete`, { token: fresh.token });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({
      correct: session.exercises.length - 1,
      total: session.exercises.length,
    });
    expect(typeof done.body.minutesSpent).toBe('number');
    expect(typeof done.body.dayCompleted).toBe('boolean');

    // Hoàn thành lại là idempotent.
    const again = await api.post(`/sessions/${session.id}/complete`, { token: fresh.token });
    expect(again.status).toBe(200);
    expect(again.body.correct).toBe(done.body.correct);

    // Phiên đã xong không nhận câu trả lời mới (409), nhưng gửi lại sự kiện cũ vẫn 200.
    const late = await api.post(`/sessions/${session.id}/answers`, {
      token: fresh.token,
      body: {
        clientEventId: randomUUID(),
        exerciseId: session.exercises[0].id,
        answer: await answerFor(ctx, session.exercises[0].id, true),
      },
    });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('SESSION_COMPLETED');
  });

  it('404 với phiên không tồn tại', async () => {
    const res = await api.post(`/sessions/${randomUUID()}/complete`, { token: learner.token });
    expect(res.status).toBe(404);
  });
});

describe('GET /today sau khi hoàn thành ngày', () => {
  it('kế hoạch completed kèm summary khớp SessionSummary', async () => {
    const fresh = await onboardedLearner(api, ctx);
    const plan = await getToday(api, fresh);
    expect(plan.status).toBe('open');
    expect(plan.summary).toBeUndefined();

    for (const item of plan.items) {
      const session = await startSession(api, fresh, item.id);
      await answerAll(api, ctx, fresh, session);
      await api.post(`/sessions/${session.id}/complete`, { token: fresh.token });
    }
    const done = await getToday(api, fresh);
    expect(done.status).toBe('completed');
    expect(done.summary).toMatchObject({ dayCompleted: true });
    expect(done.summary.total).toBeGreaterThan(0);
    expect(done.summary.correct).toBe(done.summary.total);
    expect(done.items.every((i: any) => i.status === 'completed')).toBe(true);
  });
});

describe('POST /today/extra', () => {
  it('200 PlanItem là đơn vị ngoài kế hoạch hôm nay; bắt đầu bằng POST /sessions → kind extra', async () => {
    const fresh = await onboardedLearner(api, ctx);
    const plan = await getToday(api, fresh);
    const extra = await api.post('/today/extra', { token: fresh.token });
    expect(extra.status).toBe(200);
    expect(extra.body).toMatchObject({ type: 'new_unit', status: 'pending' });
    const planned = await query(ctx, 'SELECT unit_id FROM daily_plan_items WHERE plan_id = $1', [
      plan.id,
    ]);
    expect(planned.map((r) => r.unit_id)).not.toContain(extra.body.id);

    const session = await startSession(api, fresh, extra.body.id);
    expect(session.kind).toBe('extra');
    expect(session.title).toBe(extra.body.title);
  });

  it('404 CONTENT_EXHAUSTED kèm gợi ý khi hết đơn vị phù hợp; 401 khi thiếu token', async () => {
    const fresh = await onboardedLearner(api, ctx);
    await query(ctx, `UPDATE learning_units SET status = 'inactive'`);
    ctx.app.deps.contentCache.invalidate();
    try {
      const res = await api.post('/today/extra', { token: fresh.token });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CONTENT_EXHAUSTED');
      expect(['raise_level', 'add_skill', 'content_exhausted']).toContain(
        res.body.fields.suggestion,
      );
    } finally {
      await query(ctx, `UPDATE learning_units SET status = 'active'`);
      ctx.app.deps.contentCache.invalidate();
    }
    const anon = await api.post('/today/extra', { validateResponse: false });
    expect(anon.status).toBe(401);
  });

  it('404 khi chưa hoàn tất onboarding', async () => {
    const { registerUser } = await import('./client.js');
    const user = await registerUser(api);
    const res = await api.post('/today/extra', { token: user.accessToken });
    expect(res.status).toBe(404);
  });
});
