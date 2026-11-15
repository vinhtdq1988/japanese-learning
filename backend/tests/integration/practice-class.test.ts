/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner, practiceUnitId, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
} from './org-helpers.js';

// Luyện đọc/viết của học viên lớp (spec 007, T049, research P2): phút áp dụng =
// override.dailyMinutes ?? classPath.dailyMinutes; mẫu lớp có reading/writing chỉ có hiệu lực khi ≥ 30.

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

const query = async <T = Record<string, any>>(text: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(text, params)).rows as T[];

async function classWithPractice(dailyMinutes: 5 | 10 | 15 | 30) {
  const org = await createTestOrg(ctx, { seats: 8 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    teacherIds: [teacher.userId],
    dailyMinutes,
  });
  await query(
    "UPDATE class_paths SET skills = '{vocabulary,grammar,reading,writing}' WHERE class_id = $1",
    [classId],
  );
  return { orgId: org.orgId, classId };
}

async function joinClass(world: { orgId: string; classId: string }, learner: Learner) {
  const invitation = await createTestInvitation(ctx, world.orgId, {
    kind: 'student',
    email: learner.user.email,
    classId: world.classId,
  });
  const res = await api.post(`/invitations/${invitation.token}/respond`, {
    token: learner.token,
    body: { decision: 'join_class', confirmed: true },
  });
  expect(res.status).toBe(200);
}

const todayItems = async (learner: Learner): Promise<any[]> =>
  (await api.get('/today', { token: learner.token })).body.items;
const hasPractice = (items: any[]) =>
  items.some((i) => i.kind === 'reading' || i.kind === 'writing');

async function setOverride(classId: string, userId: string, dailyMinutes: number | null) {
  const [m] = await query<{ id: string }>(
    'SELECT id FROM class_memberships WHERE class_id = $1 AND user_id = $2 AND left_at IS NULL',
    [classId, userId],
  );
  await query(
    `INSERT INTO class_learner_overrides (membership_id, daily_minutes) VALUES ($1, $2)
     ON CONFLICT (membership_id) DO UPDATE SET daily_minutes = EXCLUDED.daily_minutes`,
    [m!.id, dailyMinutes],
  );
}

describe('học viên lớp có reading/writing trong mẫu', () => {
  it('lớp 30 phút → kế hoạch có luyện', async () => {
    const world = await classWithPractice(30);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    expect(hasPractice(await todayItems(learner))).toBe(true);
  });

  it('ghi đè của giáo viên hạ xuống 15 → bị khóa: kế hoạch không có luyện, POST /sessions 403 PRACTICE_LOCKED', async () => {
    const world = await classWithPractice(30);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    expect(hasPractice(await todayItems(learner))).toBe(true);

    await setOverride(world.classId, learner.userId, 15);
    await query('DELETE FROM daily_plans WHERE user_id = $1', [learner.userId]);
    expect(hasPractice(await todayItems(learner))).toBe(false);

    const res = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: await practiceUnitId(ctx, 'reading') },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PRACTICE_LOCKED');
  });

  it('lớp 15 phút nhưng ghi đè 30 → có luyện', async () => {
    const world = await classWithPractice(15);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    expect(hasPractice(await todayItems(learner))).toBe(false);
    await setOverride(world.classId, learner.userId, 30);
    await query('DELETE FROM daily_plans WHERE user_id = $1', [learner.userId]);
    expect(hasPractice(await todayItems(learner))).toBe(true);
  });

  it('PATCH /me với skills vẫn 409 CLASS_MANAGED', async () => {
    const world = await classWithPractice(30);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    const res = await api.patch('/me', {
      token: learner.token,
      body: { skills: ['vocabulary', 'reading'] },
      validateRequest: false,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_MANAGED');
  });
});
