/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  advanceDays,
  getToday,
  onboardedLearner,
  planItemOfKind,
  practiceLearner,
  query,
  type Learner,
} from './lesson-helpers.js';

// Quỹ thời gian và kỹ năng luyện (spec 007, T048, data-model §3.1, I4, I10, US2.7).

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

const patchMe = (learner: Learner, body: Record<string, unknown>) =>
  api.patch('/me', { token: learner.token, body, validateRequest: false });
const hasPractice = (plan: any) =>
  (plan.items as any[]).some((i) => i.kind === 'reading' || i.kind === 'writing');
const storedSkills = async (learner: Learner): Promise<string[]> =>
  (
    await query(ctx, 'SELECT skills::text[] AS skills FROM learning_profiles WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].skills;

describe('I4 — hạ phút không xóa skills đã lưu', () => {
  it('30 → 15: GET /me vẫn có reading/writing, kế hoạch không còn luyện; nâng lại 30 ⇒ có lại', async () => {
    const learner = await practiceLearner(api, ctx);
    expect(hasPractice(await getToday(api, learner))).toBe(true);

    expect((await patchMe(learner, { dailyMinutes: 15 })).status).toBe(200);
    const me = await api.get('/me', { token: learner.token });
    expect(me.body.profile.skills).toEqual(expect.arrayContaining(['reading', 'writing']));
    expect(await storedSkills(learner)).toEqual(expect.arrayContaining(['reading', 'writing']));
    await advanceDays(api, ctx, learner);
    expect(hasPractice(await getToday(api, learner))).toBe(false);

    expect((await patchMe(learner, { dailyMinutes: 30 })).status).toBe(200);
    await advanceDays(api, ctx, learner);
    expect(hasPractice(await getToday(api, learner))).toBe(true);
  });
});

describe('bảng chân trị data-model §3.1 cho PATCH /me', () => {
  it('hàng 1: có + 30 phút → cho phép (giữ/đổi kỹ năng)', async () => {
    const learner = await practiceLearner(api, ctx);
    const res = await patchMe(learner, { skills: ['vocabulary', 'reading', 'writing'] });
    expect(res.status).toBe(200);
  });

  it('hàng 2: có + 5/10/15 phút → đã lưu giữ nguyên; thêm MỚI bị từ chối 422', async () => {
    for (const minutes of [5, 10, 15]) {
      const learner = await practiceLearner(api, ctx, { skills: ['vocabulary', 'reading'] });
      expect((await patchMe(learner, { dailyMinutes: minutes })).status).toBe(200);
      // Giữ nguyên reading đã lưu (không thêm mới) thì được; thêm writing mới thì bị từ chối.
      expect((await patchMe(learner, { skills: ['vocabulary', 'reading'] })).status).toBe(200);
      const rejected = await patchMe(learner, { skills: ['vocabulary', 'reading', 'writing'] });
      expect(rejected.status, `${minutes} phút`).toBe(422);
      expect(rejected.body.fields.skills).toBeTruthy();
    }
  });

  it('hàng 3: không có + 30 phút (người học tắt) → bật lại được', async () => {
    const learner = await onboardedLearner(api, ctx, { dailyMinutes: 30 });
    expect((await patchMe(learner, { skills: ['vocabulary', 'grammar', 'writing'] })).status).toBe(
      200,
    );
  });

  it('hàng 4: không có + < 30 phút → thêm bị từ chối 422; đổi đồng thời phút và skills cũng vậy', async () => {
    const learner = await onboardedLearner(api, ctx, { dailyMinutes: 10 });
    const res = await patchMe(learner, { skills: ['vocabulary', 'reading'] });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.skills).toBeTruthy();

    const both = await patchMe(learner, { dailyMinutes: 15, skills: ['vocabulary', 'writing'] });
    expect(both.status).toBe(422);
  });
});

describe('onboarding từ chối THÊM reading/writing khi phút < 30', () => {
  it('PUT /onboarding nháp và POST /onboarding/complete → 422 fields.skills', async () => {
    const user = await registerUser(api);
    const draft = await api.put('/onboarding', {
      token: user.accessToken,
      body: { dailyMinutes: 15, skills: ['vocabulary', 'reading'] },
      validateRequest: false,
    });
    expect(draft.status).toBe(422);
    expect(draft.body.fields.skills).toBeTruthy();

    const complete = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ dailyMinutes: 10, skills: ['vocabulary', 'writing'] }),
      validateRequest: false,
    });
    expect(complete.status).toBe(422);
    expect(complete.body.fields.skills).toBeTruthy();
  });

  it('30 phút với reading/writing hoàn tất được', async () => {
    const learner = await practiceLearner(api, ctx);
    expect(await storedSkills(learner)).toEqual(expect.arrayContaining(['reading', 'writing']));
  });
});

describe('US2.7 — tắt luyện ở Hồ sơ (30 phút)', () => {
  it('kế hoạch ngày kế không còn hai mục; quỹ dùng cho nội dung khác', async () => {
    const learner = await practiceLearner(api, ctx);
    expect(planItemOfKind(await getToday(api, learner), 'reading')).toBeDefined();
    expect((await patchMe(learner, { skills: ['vocabulary', 'grammar', 'kanji'] })).status).toBe(
      200,
    );
    await advanceDays(api, ctx, learner);
    const plan = await getToday(api, learner);
    expect(hasPractice(plan)).toBe(false);
    expect(plan.items.length).toBeGreaterThan(0);
  });
});
