/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unionDurationSeconds } from '../../src/domain/intervals.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  answerFor,
  getToday,
  onboardedLearner,
  query,
  startSession,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử đồng thời hai cửa sổ (T060, FR-041, SC-012, quickstart K10) cho phần thuộc US2. Các yêu cầu
// được bắn song song (Promise.all) vào cùng ứng dụng/CSDL để kích hoạt thật các ràng buộc unique.

let ctx: TestApp;
let api: ContractClient;
let learner: Learner;
let session: any;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

async function freshSession() {
  learner = await onboardedLearner(api, ctx);
  const plan = await getToday(api, learner);
  session = await startSession(api, learner, plan.items[0].id);
}

const post = (url: string, body: unknown, token = learner.token) =>
  api.post(url, { token, body, validateRequest: false });

describe('(a) trùng client_event_id → một bản ghi', () => {
  it('cùng clientEventId gửi đồng thời từ nhiều cửa sổ: một study_records, chỉ một lần duplicate=false', async () => {
    await freshSession();
    const exercise = session.exercises[0];
    const clientEventId = randomUUID();
    const answer = await answerFor(ctx, exercise.id, true);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(`/sessions/${session.id}/answers`, { clientEventId, exerciseId: exercise.id, answer }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.duplicate === false)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.isCorrect)).size).toBe(1);

    const rows = await query(
      ctx,
      'SELECT 1 FROM study_records WHERE user_id = $1 AND client_event_id = $2',
      [learner.userId, clientEventId],
    );
    expect(rows).toHaveLength(1);
  });

  it('cùng clientEventId cho khoảng thời gian gửi đồng thời: một study_intervals', async () => {
    await freshSession();
    const body = {
      clientEventId: randomUUID(),
      startedAt: '2026-01-05T08:00:00Z',
      durationSeconds: 120,
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => post(`/sessions/${session.id}/intervals`, body)),
    );
    expect(results.every((r) => r.status === 204)).toBe(true);
    const rows = await query(ctx, 'SELECT 1 FROM study_intervals WHERE user_id = $1', [
      learner.userId,
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('(b) cùng phiên, cùng bài tập, client_event_id khác → một lượt chính', () => {
  it('hai cửa sổ trả lời cùng một bài tập: một bản ghi lượt chính, các lần sau duplicate=true', async () => {
    await freshSession();
    const exercise = session.exercises[0];
    const answer = await answerFor(ctx, exercise.id, true);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        post(`/sessions/${session.id}/answers`, {
          clientEventId: randomUUID(),
          exerciseId: exercise.id,
          answer,
        }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.duplicate === false)).toHaveLength(1);
    expect(results.filter((r) => r.body.duplicate === true)).toHaveLength(5);

    const rows = await query(
      ctx,
      'SELECT 1 FROM study_records WHERE session_id = $1 AND exercise_id = $2 AND is_retry = false',
      [session.id, exercise.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('hai cửa sổ trả lời khác nhau (đúng/sai) cho cùng bài tập: kết quả thống nhất theo bản ghi đầu tiên', async () => {
    await freshSession();
    const exercise = session.exercises[0];
    const [right, wrong] = [
      await answerFor(ctx, exercise.id, true),
      await answerFor(ctx, exercise.id, false),
    ];
    const results = await Promise.all(
      [right, wrong, right, wrong].map((answer) =>
        post(`/sessions/${session.id}/answers`, {
          clientEventId: randomUUID(),
          exerciseId: exercise.id,
          answer,
        }),
      ),
    );
    expect(new Set(results.map((r) => r.body.isCorrect)).size).toBe(1);
    const [row] = await query(
      ctx,
      'SELECT is_correct FROM study_records WHERE session_id = $1 AND exercise_id = $2 AND is_retry = false',
      [session.id, exercise.id],
    );
    expect(row.is_correct).toBe(results[0]!.body.isCorrect);
  });

  it('hai cửa sổ cùng mở một mục kế hoạch chỉ tạo một phiên', async () => {
    learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const sessions = await Promise.all(
      Array.from({ length: 5 }, () =>
        api.post('/sessions', { token: learner.token, body: { planItemId: plan.items[0].id } }),
      ),
    );
    expect(sessions.every((s) => s.status === 200)).toBe(true);
    expect(new Set(sessions.map((s) => s.body.id)).size).toBe(1);
    const rows = await query(ctx, 'SELECT 1 FROM lesson_sessions WHERE user_id = $1', [
      learner.userId,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('hai cửa sổ cùng hoàn thành phiên: chỉ cập nhật một lần, kết quả như nhau', async () => {
    await freshSession();
    for (const e of session.exercises) {
      await post(`/sessions/${session.id}/answers`, {
        clientEventId: randomUUID(),
        exerciseId: e.id,
        answer: await answerFor(ctx, e.id, true),
      });
    }
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        api.post(`/sessions/${session.id}/complete`, { token: learner.token }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => JSON.stringify(r.body))).size).toBe(1);
  });
});

describe('(c) khoảng thời gian chồng nhau từ hai cửa sổ → tổng = độ dài hợp', () => {
  it('hai cửa sổ cùng đo giờ: tổng thời gian là hợp [0,60) ∪ [30,90) = 90 giây, không phải 120', async () => {
    await freshSession();
    const results = await Promise.all([
      post(`/sessions/${session.id}/intervals`, {
        clientEventId: randomUUID(),
        startedAt: '2026-01-05T08:00:00Z',
        durationSeconds: 60,
      }),
      post(`/sessions/${session.id}/intervals`, {
        clientEventId: randomUUID(),
        startedAt: '2026-01-05T08:00:30Z',
        durationSeconds: 60,
      }),
    ]);
    expect(results.every((r) => r.status === 204)).toBe(true);

    const rows = await query(
      ctx,
      'SELECT started_at, duration_seconds FROM study_intervals WHERE user_id = $1',
      [learner.userId],
    );
    expect(rows).toHaveLength(2);
    const union = unionDurationSeconds(
      rows.map((r) => ({ startedAt: r.started_at, durationSeconds: r.duration_seconds })),
    );
    expect(union).toBe(90);

    // Tóm tắt phiên báo đúng 1,5 phút (hợp), không phải 2 phút (tổng cộng dồn).
    for (const e of session.exercises) {
      await post(`/sessions/${session.id}/answers`, {
        clientEventId: randomUUID(),
        exerciseId: e.id,
        answer: await answerFor(ctx, e.id, true),
      });
    }
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.body.minutesSpent).toBe(1.5);
  });
});
