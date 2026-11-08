/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner, startSession, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  tokenFor,
} from './org-helpers.js';

// Ngữ cảnh học hiệu lực (spec 004, T065, research O6, FR-017, FR-019, FR-021, FR-037, US3, SC-005, SC-013):
// vào lớp → kế hoạch theo lộ trình lớp mà hồ sơ/lộ trình CÁ NHÂN không đổi; rời lớp → mọi thứ cá nhân nguyên
// vẹn; nguồn đổi giữa ngày xóa kế hoạch chưa học và giữ kế hoạch đã học; giáo viên đổi lộ trình giữa chừng
// không xóa kế hoạch đã sinh.

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

interface World {
  orgId: string;
  classId: string;
  teacherToken: string;
}

/** Tổ chức + giáo viên + lớp có lộ trình (N5 → N4, từ vựng + ngữ pháp) với số phút/ngày cho trước. */
async function classWorld(dailyMinutes: 5 | 10 | 15 | 30): Promise<World> {
  const org = await createTestOrg(ctx, { seats: 8 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    teacherIds: [teacher.userId],
    dailyMinutes,
  });
  return { orgId: org.orgId, classId, teacherToken: await tokenFor(ctx, teacher) };
}

async function joinClass(world: World, learner: Learner): Promise<void> {
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

const today = (learner: Learner) => api.get('/today', { token: learner.token });

describe('vào lớp / rời lớp', () => {
  it('vào lớp: GET /today theo lộ trình lớp, hồ sơ/lộ trình/tạm dừng cá nhân KHÔNG đổi; rời lớp khôi phục nguyên trạng', async () => {
    const world = await classWorld(5);
    const learner = await onboardedLearner(api, ctx); // cá nhân 10 phút/ngày
    const personal = await today(learner);
    expect(personal.body.budgetMinutes).toBe(10);
    const before = {
      profile: await query('SELECT * FROM learning_profiles WHERE user_id = $1', [learner.userId]),
      paths: await query(
        'SELECT id, status, generated_from FROM learning_paths WHERE user_id = $1',
        [learner.userId],
      ),
      pauses: await query('SELECT * FROM pause_periods WHERE user_id = $1', [learner.userId]),
    };

    await joinClass(world, learner);
    const inClass = await today(learner);
    expect(inClass.status).toBe(200);
    // Kế hoạch hôm nay chưa học gì ⇒ bị xóa và sinh lại theo lớp (5 phút/ngày).
    expect(inClass.body.budgetMinutes).toBe(5);
    expect(inClass.body.id).not.toBe(personal.body.id);
    expect(inClass.body.estimatedMinutes).toBeLessThanOrEqual(5);
    for (const item of inClass.body.items) expect(item.estMinutes).toBeLessThanOrEqual(15);

    const path = await api.get('/path', { token: learner.token });
    expect(path.body.source).toBe('class');
    const me = await api.get('/me', { token: learner.token });
    expect(me.body.learningSource).toBe('class');
    expect(me.body.classSummary).toMatchObject({ classId: world.classId });
    expect(me.body.classSummary.lockedFields).toContain('dailyMinutes');
    // `profile` của GET /me là hồ sơ CÁ NHÂN thật (không phải bản hiệu lực trong bộ nhớ).
    expect(me.body.profile.dailyMinutes).toBe(10);

    // Hồ sơ, lộ trình và tạm dừng cá nhân không đổi một byte.
    expect(
      await query('SELECT * FROM learning_profiles WHERE user_id = $1', [learner.userId]),
    ).toEqual(before.profile);
    expect(
      await query('SELECT id, status, generated_from FROM learning_paths WHERE user_id = $1', [
        learner.userId,
      ]),
    ).toEqual(before.paths);
    expect(await query('SELECT * FROM pause_periods WHERE user_id = $1', [learner.userId])).toEqual(
      before.pauses,
    );

    // Rời lớp: quay lại lộ trình cá nhân nguyên trạng, kế hoạch hôm nay (chưa học) sinh lại theo cá nhân.
    expect(
      (await api.post('/me/class/leave', { token: learner.token, body: { confirm: true } })).status,
    ).toBe(204);
    const back = await today(learner);
    expect(back.body.budgetMinutes).toBe(10);
    expect((await api.get('/path', { token: learner.token })).body.source).toBe('personal');
    const me2 = await api.get('/me', { token: learner.token });
    expect(me2.body.learningSource).toBe('personal');
    expect(me2.body.classSummary).toBeUndefined();
    expect(
      await query('SELECT id, status, generated_from FROM learning_paths WHERE user_id = $1', [
        learner.userId,
      ]),
    ).toEqual(before.paths);
  });

  it('người chưa từng onboarding: học theo lớp được; rời lớp thì đi qua onboarding cá nhân (FR-037)', async () => {
    const world = await classWorld(10);
    const user = await registerUser(api);
    const userId = (await query('SELECT id FROM users WHERE email = $1', [user.email]))[0]!.id;
    const learner: Learner = { user, token: user.accessToken, userId };
    expect((await today(learner)).status).toBe(404); // chưa có lộ trình nào

    await joinClass(world, learner);
    const inClass = await today(learner);
    expect(inClass.status).toBe(200);
    expect(inClass.body.budgetMinutes).toBe(10);
    expect((await api.get('/progress', { token: learner.token })).body.isEmpty).toBe(true);
    const profile = await query(
      'SELECT onboarding_state FROM learning_profiles WHERE user_id = $1',
      [userId],
    );
    expect(profile[0]!.onboarding_state).toBe('not_started');

    await api.post('/me/class/leave', { token: learner.token, body: { confirm: true } });
    expect((await today(learner)).status).toBe(404);
    expect((await api.get('/path', { token: learner.token, validateResponse: false })).status).toBe(
      404,
    );
  });
});

describe('nguồn đổi giữa ngày (research O6)', () => {
  it('kế hoạch đã có mục in_progress được GIỮ khi rời lớp; sang ngày sau nguồn mới có hiệu lực', async () => {
    const world = await classWorld(5);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    const plan = (await today(learner)).body;
    const newUnit = plan.items.find((i: any) => i.type === 'new_unit')!;
    expect(newUnit).toBeDefined();
    await startSession(api, learner, newUnit.id); // mục chuyển sang in_progress

    await api.post('/me/class/leave', { token: learner.token, body: { confirm: true } });
    const same = await today(learner);
    expect(same.body.id).toBe(plan.id);
    expect(same.body.budgetMinutes).toBe(5);

    ctx.clock.advanceDays(1);
    const refreshed = await api.get('/today', {
      token: (await tokenFor(ctx, { userId: learner.userId, role: 'learner' })) as string,
    });
    expect(refreshed.body.budgetMinutes).toBe(10);
    ctx.clock.advanceDays(-1);
  });
});

describe('giáo viên đổi lộ trình lớp giữa chừng (US3.7, SC-005)', () => {
  it('KHÔNG xóa kế hoạch đã sinh; tiến độ và lịch ôn giữ nguyên; kế hoạch kế tiếp theo tham số mới', async () => {
    const world = await classWorld(5);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    const plan = (await today(learner)).body;
    expect(plan.budgetMinutes).toBe(5);
    const progressBefore = await query(
      'SELECT * FROM unit_progress WHERE user_id = $1 ORDER BY unit_id',
      [learner.userId],
    );

    const put = await api.put(`/classes/${world.classId}/path`, {
      token: world.teacherToken,
      body: {
        startLevel: 'N5',
        targetLevel: 'N4',
        skills: ['vocabulary', 'grammar', 'kanji'],
        startsOn: '2026-01-05',
        endsOn: '2026-06-30',
        dailyMinutes: 15,
      },
    });
    expect(put.status).toBe(200);

    const same = (await today(learner)).body;
    expect(same.id).toBe(plan.id);
    expect(same.budgetMinutes).toBe(5);
    expect(
      await query('SELECT * FROM unit_progress WHERE user_id = $1 ORDER BY unit_id', [
        learner.userId,
      ]),
    ).toEqual(progressBefore);

    ctx.clock.advanceDays(1);
    const next = await api.get('/today', {
      token: await tokenFor(ctx, { userId: learner.userId, role: 'learner' }),
    });
    expect(next.body.budgetMinutes).toBe(15);
    ctx.clock.advanceDays(-1);
  });
});

describe('GET /path và hết nội dung', () => {
  it('GET /path của học viên lớp là lộ trình lớp: chỉ kỹ năng/trình độ của lớp, bài đã học tính hoàn thành', async () => {
    const world = await classWorld(10);
    const learner = await onboardedLearner(api, ctx);
    await joinClass(world, learner);
    const path = (await api.get('/path', { token: learner.token })).body;
    expect(path.source).toBe('class');
    expect(path.id).toBe(world.classId);
    expect(path.items.length).toBeGreaterThan(0);
    for (const item of path.items) {
      expect(['vocabulary', 'grammar']).toContain(item.kind);
      expect(['N5', 'N4']).toContain(item.level);
    }
    expect(path.totalUnits).toBe(path.items.length);
  });

  it('hết nội dung của lớp → POST /today/extra trả 404 CONTENT_EXHAUSTED', async () => {
    const org = await createTestOrg(ctx, { seats: 3 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    // Lộ trình hẹp: chỉ ngữ pháp N5.
    await ctx.handle.pool.query(
      "UPDATE class_paths SET skills = '{grammar}', target_level = 'N5' WHERE class_id = $1",
      [classId],
    );
    const world: World = { orgId: org.orgId, classId, teacherToken: await tokenFor(ctx, teacher) };
    const learner = await onboardedLearner(api, ctx);
    await ctx.handle.pool.query(
      `INSERT INTO unit_progress (user_id, unit_id, status)
       SELECT $1, id, 'completed' FROM learning_units
        WHERE status = 'active' AND kind = 'grammar' AND level = 'N5'
       ON CONFLICT DO NOTHING`,
      [learner.userId],
    );
    await joinClass(world, learner);
    const extra = await api.post('/today/extra', { token: learner.token, validateResponse: false });
    expect(extra.status).toBe(404);
    expect(extra.body.code).toBe('CONTENT_EXHAUSTED');
  });
});
