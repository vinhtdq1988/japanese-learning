/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeDeletedAccounts } from '../../src/jobs/purge-deleted-accounts.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner, query, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  tokenFor,
  type TestUser,
} from './org-helpers.js';

// Xóa tài khoản của người thuộc tổ chức (spec 004, T104, FR-039, research O15): học viên mất tư cách thành
// viên ngay (tổ chức mất quyền xem), tư cách KHÔNG được khôi phục cùng tài khoản, job xóa cứng không để lại
// dòng trỏ tới người đã xóa và không xóa nhầm dữ liệu của tổ chức; giáo viên xóa tài khoản → nhả seat/lớp.

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

const sql = <T = any>(text: string, params: unknown[] = []) => query<T>(ctx, text, params);

interface World {
  orgId: string;
  classId: string;
  owner: TestUser;
  teacher: TestUser;
  ownerToken: string;
  teacherToken: string;
  learner: Learner;
}

async function world(): Promise<World> {
  ctx.clock.set('2026-01-05T08:00:00Z');
  const org = await createTestOrg(ctx, { seats: 5 });
  const owner = await createTestUser(ctx);
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
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
  return {
    orgId: org.orgId,
    classId,
    owner,
    teacher,
    ownerToken: await tokenFor(ctx, owner),
    teacherToken: await tokenFor(ctx, teacher),
    learner,
  };
}

const deleteAccount = (learner: Learner) =>
  api.post('/account/delete', {
    token: learner.token,
    body: { password: learner.user.password },
  });

describe('học viên thuộc lớp yêu cầu xóa tài khoản (FR-039)', () => {
  it('đóng thành viên account_deleted, giải phóng seat, tổ chức mất quyền xem ngay (cùng token)', async () => {
    const w = await world();
    const detail = `/classes/${w.classId}/members/${w.learner.userId}/detail`;
    for (const token of [w.teacherToken, w.ownerToken]) {
      expect((await api.raw('GET', detail, { token })).status).toBe(200);
    }
    expect((await api.get('/org', { token: w.ownerToken })).body.seats).toMatchObject({ used: 2 });

    expect((await deleteAccount(w.learner)).status).toBe(200);

    for (const token of [w.teacherToken, w.ownerToken]) {
      expect((await api.raw('GET', detail, { token })).status).toBe(404);
      const dash = JSON.parse(
        (await api.raw('GET', `/classes/${w.classId}/dashboard`, { token })).text,
      );
      expect(dash.learners.map((r: any) => r.userId)).not.toContain(w.learner.userId);
    }
    const [membership] = await sql(
      'SELECT end_reason, seat_id, left_at FROM class_memberships WHERE user_id = $1',
      [w.learner.userId],
    );
    expect(membership).toMatchObject({ end_reason: 'account_deleted', seat_id: null });
    expect(membership.left_at).not.toBeNull();
    expect((await api.get('/org', { token: w.ownerToken })).body.seats).toMatchObject({ used: 1 });
    expect(
      await sql('SELECT 1 FROM organization_members WHERE user_id = $1', [w.learner.userId]),
    ).toHaveLength(0);
    const [log] = await sql(
      `SELECT diff FROM admin_action_logs
        WHERE organization_id = $1 AND diff->>'reason' = 'account_deleted'`,
      [w.orgId],
    );
    expect(log.diff).toMatchObject({ learnerEnded: true });
  });

  it('khôi phục tài khoản trong 30 ngày KHÔNG khôi phục tư cách thành viên: phải được mời lại', async () => {
    const w = await world();
    await deleteAccount(w.learner);
    const restored = await api.post('/account/restore', { token: w.learner.token });
    expect(restored.status).toBe(200);
    expect(restored.body.learningSource).toBe('personal');
    expect((await api.raw('GET', '/me/class', { token: w.learner.token })).status).toBe(404);
    expect(
      await sql('SELECT 1 FROM class_memberships WHERE user_id = $1 AND left_at IS NULL', [
        w.learner.userId,
      ]),
    ).toHaveLength(0);
    const dash = JSON.parse(
      (await api.raw('GET', `/classes/${w.classId}/dashboard`, { token: w.teacherToken })).text,
    );
    expect(dash.learners).toHaveLength(0);

    // Được mời lại và xác nhận lại thì vào lớp bình thường (dòng thành viên mới).
    const invitation = await createTestInvitation(ctx, w.orgId, {
      kind: 'student',
      email: w.learner.user.email,
      classId: w.classId,
    });
    const rejoined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: w.learner.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(rejoined.status).toBe(200);
    expect(
      await sql('SELECT 1 FROM class_memberships WHERE user_id = $1', [w.learner.userId]),
    ).toHaveLength(2);
  });

  it('job xóa cứng không để lại dòng trỏ tới học viên và không xóa nhầm dữ liệu của tổ chức', async () => {
    const w = await world();
    const orgCounts = async () => ({
      organizations: (await sql('SELECT 1 FROM organizations WHERE id = $1', [w.orgId])).length,
      classes: (await sql('SELECT 1 FROM classes WHERE organization_id = $1', [w.orgId])).length,
      classPaths: (await sql('SELECT 1 FROM class_paths WHERE class_id = $1', [w.classId])).length,
      seats: (
        await sql(
          `SELECT 1 FROM seats s JOIN seat_licenses l ON l.id = s.license_id
            WHERE l.organization_id = $1`,
          [w.orgId],
        )
      ).length,
      teachers: (await sql('SELECT 1 FROM class_teachers WHERE class_id = $1', [w.classId])).length,
      invitations: (await sql('SELECT 1 FROM invitations WHERE organization_id = $1', [w.orgId]))
        .length,
    });
    const before = await orgCounts();
    const [accepted] = await sql(
      `SELECT accepted_by FROM invitations WHERE organization_id = $1 AND status = 'accepted'`,
      [w.orgId],
    );
    expect(accepted.accepted_by).toBe(w.learner.userId);

    await deleteAccount(w.learner);
    const logsBefore = (
      await sql<{ n: number }>(
        'SELECT count(*)::int AS n FROM admin_action_logs WHERE organization_id = $1',
        [w.orgId],
      )
    )[0]!.n;
    ctx.clock.advanceDays(31);
    expect(
      await purgeDeletedAccounts({ db: ctx.handle.db, clock: ctx.clock }),
    ).toBeGreaterThanOrEqual(1);

    expect(await sql('SELECT 1 FROM users WHERE id = $1', [w.learner.userId])).toHaveLength(0);
    for (const table of [
      'class_memberships',
      'organization_members',
      'learning_profiles',
      'unit_progress',
      'study_records',
      'daily_plans',
    ]) {
      expect(
        await sql(`SELECT 1 FROM ${table} WHERE user_id = $1`, [w.learner.userId]),
        table,
      ).toHaveLength(0);
    }
    expect(
      await sql('SELECT 1 FROM seats WHERE holder_user_id = $1', [w.learner.userId]),
    ).toHaveLength(0);
    // Dữ liệu của tổ chức còn nguyên; cột "ai làm" chuyển thành NULL thay vì xóa dòng.
    expect(await orgCounts()).toEqual(before);
    const [after] = await sql(
      `SELECT accepted_by FROM invitations WHERE organization_id = $1 AND status = 'accepted'`,
      [w.orgId],
    );
    expect(after.accepted_by).toBeNull();
    expect(
      (
        await sql<{ n: number }>(
          'SELECT count(*)::int AS n FROM admin_action_logs WHERE organization_id = $1',
          [w.orgId],
        )
      )[0]!.n,
    ).toBe(logsBefore);
    expect(
      await sql(`SELECT 1 FROM admin_action_logs WHERE organization_id = $1 AND actor_id = $2`, [
        w.orgId,
        w.learner.userId,
      ]),
    ).toHaveLength(0);
  });
});

describe('giáo viên xóa tài khoản', () => {
  it('giải phóng seat và gỡ khỏi class_teachers; lớp thành teacherless; xóa cứng dọn dòng thành viên', async () => {
    ctx.clock.set('2026-01-05T08:00:00Z');
    const org = await createTestOrg(ctx, { seats: 4 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const ownerToken = await tokenFor(ctx, owner);
    // Giáo viên đăng ký thật để có mật khẩu gọi POST /account/delete.
    const teacher = await onboardedLearner(api, ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    expect((await api.get('/org', { token: ownerToken })).body.seats).toMatchObject({ used: 1 });

    expect((await deleteAccount(teacher)).status).toBe(200);

    expect(
      await sql('SELECT 1 FROM seats WHERE holder_user_id = $1', [teacher.userId]),
    ).toHaveLength(0);
    expect(
      await sql('SELECT 1 FROM class_teachers WHERE user_id = $1', [teacher.userId]),
    ).toHaveLength(0);
    const overview = (await api.get('/org', { token: ownerToken })).body;
    expect(overview.seats).toMatchObject({ used: 0 });
    expect(overview.classes.find((c: any) => c.id === classId)).toMatchObject({
      teacherless: true,
    });
    expect(overview.teachers.map((t: any) => t.userId)).not.toContain(teacher.userId);

    ctx.clock.advanceDays(31);
    await purgeDeletedAccounts({ db: ctx.handle.db, clock: ctx.clock });
    expect(
      await sql('SELECT 1 FROM organization_members WHERE user_id = $1', [teacher.userId]),
    ).toHaveLength(0);
    expect(await sql('SELECT 1 FROM classes WHERE id = $1', [classId])).toHaveLength(1);
  });
});
