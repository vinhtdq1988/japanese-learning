import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  getToday,
  onboardedLearner,
  studyPlanItem,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US4 (T082): mọi request/response của `GET /progress` đối chiếu `contracts/openapi.yaml`
// (ContractClient tự validate mã trạng thái và thân phản hồi theo schema `ProgressSummary`).

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

describe('GET /progress', () => {
  it('200 ProgressSummary ở trạng thái trống cho người học mới', async () => {
    const { status, body } = await api.get('/progress', { token: learner.token });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      isEmpty: true,
      totalMinutes: 0,
      lessonsCompleted: 0,
      reviewAccuracy: null,
      currentStreakDays: 0,
      weakTopics: [],
    });
    expect(body.goal.completionRatio).toBe(0);
  });

  it('200 ProgressSummary đúng schema sau khi học (có điểm yếu)', async () => {
    const plan = await getToday(api, learner);
    for (const item of plan.items) {
      await studyPlanItem(api, ctx, learner, item.id, { allWrong: true });
    }
    const { status, body } = await api.get('/progress', { token: learner.token });
    expect(status).toBe(200);
    expect(body.isEmpty).toBe(false);
    expect(body.lessonsCompleted).toBe(plan.items.length);
    expect(body.currentStreakDays).toBe(1);
    expect(body.goal.completionRatio).toBeGreaterThan(0);
    expect(body.goal.completionRatio).toBeLessThanOrEqual(1);
    for (const t of body.weakTopics) {
      expect(t).toEqual({
        topicId: expect.any(String),
        name: expect.any(String),
        skill: expect.stringMatching(/^(vocabulary|grammar|kanji)$/),
        accuracy: expect.any(Number),
      });
    }
  });

  it('200 trạng thái trống (không lỗi) với tài khoản chưa onboarding', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.get('/progress', { token: user.accessToken });
    expect(status).toBe(200);
    expect(body.isEmpty).toBe(true);
  });

  it('401 khi thiếu token hoặc token sai', async () => {
    const anon = await api.get('/progress', { validateResponse: false });
    expect(anon.status).toBe(401);
    const bad = await api.get('/progress', { token: 'khong-hop-le', validateResponse: false });
    expect(bad.status).toBe(401);
  });

  it('chỉ trả dữ liệu của người gọi (user_id lấy từ token, R16)', async () => {
    const other = await onboardedLearner(api, ctx);
    const { body } = await api.get('/progress', { token: other.token });
    expect(body.isEmpty).toBe(true);
    expect(body.lessonsCompleted).toBe(0);
  });
});
