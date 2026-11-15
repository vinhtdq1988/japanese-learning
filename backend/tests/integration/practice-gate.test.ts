/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  answerAll,
  getToday,
  planItemOfKind,
  practiceLearner,
  query,
  startSession,
  submit,
  type Learner,
} from './lesson-helpers.js';

// Cổng luyện đọc/viết ≥ 30 phút (spec 007, T047, FR-005…FR-007, I3): phiên luyện học trọn được; hạ phút giữa
// chừng thì phiên bị chặn nhưng không mất dữ liệu và tiếp tục được sau khi nâng lại 30.

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

const setMinutes = (learner: Learner, dailyMinutes: number) =>
  api.patch('/me', { token: learner.token, body: { dailyMinutes } });

describe('học trọn một phiên luyện', () => {
  it.each([['reading' as const], ['writing' as const]])(
    'phiên luyện %s: đúng/sai từng câu có giải thích hoặc đáp án tham chiếu, thời lượng 5–15 phút',
    async (kind) => {
      const learner = await practiceLearner(api, ctx, { skills: ['vocabulary', kind] });
      const plan = await getToday(api, learner);
      const item = planItemOfKind(plan, kind);
      expect(item, `kế hoạch phải có mục ${kind}`).toBeDefined();
      expect(item.estMinutes).toBeGreaterThanOrEqual(5);
      expect(item.estMinutes).toBeLessThanOrEqual(15);

      const session = await startSession(api, learner, item.id);
      expect(session.exercises.length).toBeGreaterThanOrEqual(2);
      if (kind === 'reading') {
        expect((session.items as any[]).some((i) => i.kind === 'reading')).toBe(true);
      }

      // Câu đầu trả lời sai: phải có phản hồi giải thích và (với viết) đáp án tham chiếu.
      const wrong = await submit(api, ctx, learner, session.id, session.exercises[0].id, {
        correct: false,
      });
      expect(wrong.status).toBe(200);
      expect(wrong.body.isCorrect).toBe(false);
      expect(wrong.body.feedback).toBeTruthy();
      if (kind === 'writing') expect(typeof wrong.body.correctAnswer).toBe('string');

      const rest = { ...session, exercises: session.exercises.slice(1) };
      const results = await answerAll(api, ctx, learner, rest);
      expect(results.every((r: any) => r.isCorrect)).toBe(true);

      const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
      expect(done.status).toBe(200);
      expect(done.body.total).toBe(session.exercises.length);
    },
  );
});

describe('hạ phút giữa chừng', () => {
  it('phiên in_progress bị 403 PRACTICE_LOCKED ở bước kế, vẫn in_progress, tiếp tục được sau khi nâng lại 30', async () => {
    const learner = await practiceLearner(api, ctx, { skills: ['vocabulary', 'reading'] });
    const item = planItemOfKind(await getToday(api, learner), 'reading')!;
    const session = await startSession(api, learner, item.id);
    const first = await submit(api, ctx, learner, session.id, session.exercises[0].id);
    expect(first.status).toBe(200);

    expect((await setMinutes(learner, 15)).status).toBe(200);
    const blocked = await submit(api, ctx, learner, session.id, session.exercises[1].id);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PRACTICE_LOCKED');
    const [row] = await query(
      ctx,
      'SELECT status::text AS status FROM lesson_sessions WHERE id = $1',
      [session.id],
    );
    expect(row.status).toBe('in_progress');
    const [{ count }] = await query(
      ctx,
      'SELECT count(*)::int AS count FROM study_records WHERE session_id = $1',
      [session.id],
    );
    expect(count).toBe(1);

    expect((await setMinutes(learner, 30)).status).toBe(200);
    const resumed = await startSession(api, learner, item.id);
    expect(resumed.id).toBe(session.id);
    for (const exercise of session.exercises.slice(1)) {
      const res = await submit(api, ctx, learner, session.id, exercise.id);
      expect(res.status).toBe(200);
    }
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
  });

  it('POST /today/extra không trả đơn vị luyện khi phút < 30', async () => {
    const learner = await practiceLearner(api, ctx, { skills: ['reading', 'writing'] });
    expect((await setMinutes(learner, 15)).status).toBe(200);
    for (let i = 0; i < 4; i++) {
      const res = await api.post('/today/extra', { token: learner.token });
      if (res.status !== 200 || !res.body.kind) break;
      expect(['reading', 'writing']).not.toContain(res.body.kind);
    }
  });
});
