/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  advanceDays,
  finishPlanItem,
  getToday,
  onboardedLearner,
  planItemOfKind,
  practiceLearner,
  practiceUnitId,
  startSession,
  submit,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US2 spec 007 (T046): cổng luyện đọc/viết ≥ 30 phút/ngày khớp OpenAPI 1.14.0
// (`Skill` thêm reading/writing, `PRACTICE_LOCKED` 403 kèm `fields.minimumDailyMinutes`, SC-003).

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

const patchMe = (learner: Learner, body: Record<string, unknown>, validateRequest = true) =>
  api.patch('/me', { token: learner.token, body, validateRequest });

/** Học viên 15 phút/ngày có đủ ba kỹ năng gốc (không chọn luyện). */
const learner15 = () =>
  onboardedLearner(api, ctx, { dailyMinutes: 15, skills: ['vocabulary', 'grammar', 'kanji'] });

describe('GET /today – người học 30 phút có luyện đọc/viết', () => {
  it('qua vài ngày giả lập có mục kind = reading/writing và mỗi ngày ≤ 30 phút', async () => {
    const learner = await practiceLearner(api, ctx);
    const kinds = new Set<string>();
    for (let day = 0; day < 6; day++) {
      const plan = await getToday(api, learner);
      expect(plan.estimatedMinutes).toBeLessThanOrEqual(30);
      for (const item of plan.items as any[]) if (item.kind) kinds.add(item.kind);
      for (const item of plan.items as any[]) {
        if (item.type === 'new_unit') await finishPlanItem(api, ctx, learner, item.id);
      }
      await advanceDays(api, ctx, learner);
    }
    expect(kinds.has('reading')).toBe(true);
    expect(kinds.has('writing')).toBe(true);
  });

  it('ngày đầu có mục luyện đọc', async () => {
    const learner = await practiceLearner(api, ctx);
    expect(planItemOfKind(await getToday(api, learner), 'reading')).toBeDefined();
  });
});

describe('người học 15 phút – không thấy luyện đọc/viết', () => {
  it('GET /today, GET /path và POST /today/extra không có reading/writing', async () => {
    const learner = await learner15();
    const plan = await getToday(api, learner);
    expect((plan.items as any[]).some((i) => i.kind === 'reading' || i.kind === 'writing')).toBe(
      false,
    );

    const path = await api.get('/path', { token: learner.token });
    expect(path.status).toBe(200);
    expect(
      (path.body.items as any[]).some((i) => i.kind === 'reading' || i.kind === 'writing'),
    ).toBe(false);

    const extra = await api.post('/today/extra', { token: learner.token });
    expect(extra.status).toBe(200);
    expect(['reading', 'writing']).not.toContain(extra.body.kind);
  });

  it('POST /sessions với id đơn vị luyện → 403 PRACTICE_LOCKED kèm fields.minimumDailyMinutes = "30" (SC-003)', async () => {
    const learner = await learner15();
    for (const kind of ['reading', 'writing'] as const) {
      const res = await api.post('/sessions', {
        token: learner.token,
        body: { planItemId: await practiceUnitId(ctx, kind) },
      });
      expect(res.status, kind).toBe(403);
      expect(res.body.code).toBe('PRACTICE_LOCKED');
      expect(res.body.fields.minimumDailyMinutes).toBe('30');
    }
  });

  it('PATCH /me thêm reading khi phút 15 → 422 VALIDATION_FAILED fields.skills', async () => {
    const learner = await learner15();
    const res = await patchMe(learner, { skills: ['vocabulary', 'reading'] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.skills).toBeTruthy();
  });
});

describe('hạ phút xuống 15 giữa chừng (I3, I4, I10)', () => {
  it('GET /me trả skills ĐÃ LƯU; answers, intervals, complete đều 403 PRACTICE_LOCKED', async () => {
    const learner = await practiceLearner(api, ctx);
    const item = planItemOfKind(await getToday(api, learner), 'reading')!;
    const session = await startSession(api, learner, item.id);

    const lowered = await patchMe(learner, { dailyMinutes: 15 });
    expect(lowered.status).toBe(200);
    const me = await api.get('/me', { token: learner.token });
    expect(me.body.profile.skills).toEqual(expect.arrayContaining(['reading', 'writing']));

    const answer = await submit(api, ctx, learner, session.id, session.exercises[0].id);
    expect(answer.status).toBe(403);
    expect(answer.body.code).toBe('PRACTICE_LOCKED');

    const interval = await api.post(`/sessions/${session.id}/intervals`, {
      token: learner.token,
      body: {
        clientEventId: crypto.randomUUID(),
        startedAt: ctx.clock.now().toISOString(),
        durationSeconds: 30,
      },
      validateRequest: false,
    });
    expect(interval.status).toBe(403);
    expect(interval.body.code).toBe('PRACTICE_LOCKED');

    const complete = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(complete.status).toBe(403);
    expect(complete.body.code).toBe('PRACTICE_LOCKED');
  });
});
