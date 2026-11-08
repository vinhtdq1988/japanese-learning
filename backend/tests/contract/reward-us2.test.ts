/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  advanceDays,
  answerAll,
  getToday,
  onboardedLearner,
  query,
  startSession,
  studyPlanItem,
  type Learner,
} from '../integration/lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  tokenFor,
} from '../integration/org-helpers.js';
import {
  celebratedCodes,
  celebratedDays,
  earnedRows,
  seedStreakEndingYesterday,
} from '../integration/reward-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng thưởng/thành tựu (spec 005, T040, contracts/api-changes.md §7): `SessionSummary.celebrations`
// của `POST /sessions/{id}/complete`. Mọi phản hồi được đối chiếu `openapi.yaml` 1.13.0 bởi ContractClient.

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

/** Học trọn mọi mục của kế hoạch hôm nay; mục `i` trong `wrongFirst` cố ý sai câu đầu (không hoàn hảo). */
async function finishWholePlan(learner: Learner, options: { imperfect?: boolean } = {}) {
  const plan = await getToday(api, learner);
  const summaries: any[] = [];
  for (const item of plan.items) {
    const { summary } = await studyPlanItem(api, ctx, learner, item.id, {
      ...(options.imperfect ? { wrongIndexes: [0] } : {}),
    });
    summaries.push(summary);
  }
  return summaries;
}

describe('POST /sessions/{id}/complete → celebrations', () => {
  it('bài học mới đầu tiên → celebrations.achievements = [first_lesson] đã bản địa hóa (vi), không có threshold', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(celebratedCodes(summary)).toEqual(['first_lesson']);
    const [first] = summary.celebrations.achievements;
    expect(first).toMatchObject({
      code: 'first_lesson',
      kind: 'first_lesson',
      name: 'Bài học đầu tiên',
    });
    expect(first.description).toEqual(expect.any(String));
    expect(first).not.toHaveProperty('threshold');
    expect((await earnedRows(ctx, learner.userId)).first_lesson).toBe('earned');
  });

  it('tên và mô tả theo profile.language (en)', async () => {
    const learner = await onboardedLearner(api, ctx);
    const patch = await api.patch('/me', { token: learner.token, body: { language: 'en' } });
    expect(patch.status).toBe(200);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(summary.celebrations.achievements[0]).toMatchObject({
      code: 'first_lesson',
      name: 'First lesson',
    });
  });

  it('bài hoàn hảo đầu tiên → [first_lesson, perfect_lesson] theo thứ tự trình bày', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id);
    expect(celebratedCodes(summary)).toEqual(['first_lesson', 'perfect_lesson']);
  });

  it('mốc chuỗi streak_7 đúng một lần (streak_3 đã vượt từ trước chỉ ghi âm thầm)', async () => {
    const learner = await onboardedLearner(api, ctx);
    await seedStreakEndingYesterday(ctx, learner, 6);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(celebratedCodes(summary)).toEqual(['first_lesson', 'streak_7']);
    const rows = await earnedRows(ctx, learner.userId);
    expect(rows.streak_7).toBe('earned');
    expect(rows.streak_3).toBe('silent');

    // Phiên "học thêm" cùng ngày không chúc mừng lại streak_7.
    const extra = await api.post('/today/extra', { token: learner.token });
    const session = await startSession(api, learner, extra.body.id);
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const again = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(celebratedCodes(again.body)).not.toContain('streak_7');
  });

  it('gọi lại complete trên phiên đã xong KHÔNG trả celebrations và không ghi thêm dòng', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { session, summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id);
    expect(summary.celebrations).toBeDefined();
    const before = await earnedRows(ctx, learner.userId);

    const again = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(again.status).toBe(200);
    expect(again.body).not.toHaveProperty('celebrations');
    expect(again.body).toMatchObject({ correct: summary.correct, total: summary.total });
    expect(await earnedRows(ctx, learner.userId)).toEqual(before);
  });

  it('hoàn thành mục cuối kế hoạch → dayCompleted: true một lần mỗi ngày, kể cả học thêm', async () => {
    const learner = await onboardedLearner(api, ctx);
    const summaries = await finishWholePlan(learner, { imperfect: true });
    const flags = summaries.map((s) => s.celebrations?.dayCompleted ?? false);
    expect(flags.slice(0, -1).every((f) => f === false)).toBe(true);
    expect(flags.at(-1)).toBe(true);
    expect(summaries.at(-1).dayCompleted).toBe(true);
    expect(await celebratedDays(ctx, learner.userId)).toHaveLength(1);

    const extra = await api.post('/today/extra', { token: learner.token });
    const session = await startSession(api, learner, extra.body.id);
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.body.celebrations?.dayCompleted ?? false).toBe(false);
    expect(await celebratedDays(ctx, learner.userId)).toHaveLength(1);
  });

  it('phiên ôn tập KHÔNG tạo perfect_lesson dù mọi câu đúng', async () => {
    const learner = await onboardedLearner(api, ctx);
    await finishWholePlan(learner, { imperfect: true });
    await advanceDays(api, ctx, learner, 1);
    const plan = await getToday(api, learner);
    const review = plan.items.find((i: any) => i.type === 'review_batch');
    expect(review, 'ngày 2 phải có gói ôn tập').toBeDefined();
    const { session, summary } = await studyPlanItem(api, ctx, learner, review.id);
    expect(celebratedCodes(summary)).not.toContain('perfect_lesson');
    expect(celebratedCodes(summary)).not.toContain('first_lesson');
    const rows = await query<{ kind: string }>(
      ctx,
      'SELECT kind FROM lesson_sessions WHERE id = $1',
      [session.id],
    );
    expect(rows[0]?.kind).toBe('review');
    expect((await earnedRows(ctx, learner.userId)).perfect_lesson).toBeUndefined();
  });

  it('các trường SessionSummary cũ không đổi; celebrations là trường duy nhất thêm vào', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    const allowed = new Set([
      'correct',
      'total',
      'minutesSpent',
      'dayCompleted',
      'attentionItems',
      'celebrations',
    ]);
    expect(Object.keys(summary).filter((k) => !allowed.has(k))).toEqual([]);
    expect(summary).toMatchObject({
      correct: expect.any(Number),
      total: expect.any(Number),
      minutesSpent: expect.any(Number),
      dayCompleted: expect.any(Boolean),
    });
  });
});

describe('học viên thuộc lớp', () => {
  it('nhận thành tựu như người học cá nhân; DTO /classes* và /org* KHÔNG chứa thành tựu', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, {
      teacherIds: [teacher.userId],
      dailyMinutes: 10,
    });
    const teacherToken = await tokenFor(ctx, teacher);

    const learner = await onboardedLearner(api, ctx);
    const invitation = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.user.email,
      classId,
    });
    const joined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: learner.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);

    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id);
    expect(celebratedCodes(summary)).toEqual(['first_lesson', 'perfect_lesson']);

    const leak =
      /achievement|celebration|earned|first_lesson|perfect_lesson|items_\d|goal_\d|streak_\d/i;
    const dashboard = await api.get(`/classes/${classId}/dashboard`, { token: teacherToken });
    expect(dashboard.status).toBe(200);
    expect(JSON.stringify(dashboard.body)).not.toMatch(leak);
    const detail = await api.get(`/classes/${classId}/members/${learner.userId}/detail`, {
      token: teacherToken,
    });
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(leak);
  });
});
