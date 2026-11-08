/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createLicense } from '../../src/services/org-admin.js';
import { loadOrgContext } from '../../src/services/org-access.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner, query, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
  type TestUser,
} from './org-helpers.js';

// Gỡ giáo viên, giáo viên mất seat, chủ tổ chức cuối xóa tài khoản và gia hạn sau khi hết hạn (spec 004, T103,
// FR-038, FR-040, research O15): quyền mất NGAY bằng cùng access token; học viên của lớp không bị bỏ rơi.

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
  licenseId: string;
  classId: string;
  owner: TestUser;
  teacher: TestUser;
  ownerToken: string;
  teacherToken: string;
  learner: Learner;
}

/** Tổ chức có chủ, một giáo viên giữ seat phụ trách lớp, một học viên trong lớp. */
async function world(): Promise<World> {
  ctx.clock.set('2026-01-05T08:00:00Z');
  const org = await createTestOrg(ctx, { seats: 5 });
  const owner = await createTestUser(ctx);
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const learner = await onboardedLearner(api, ctx);
  await enrollLearner(ctx, org.orgId, classId, learner.userId);
  return {
    orgId: org.orgId,
    licenseId: org.licenseId!,
    classId,
    owner,
    teacher,
    ownerToken: await tokenFor(ctx, owner),
    teacherToken: await tokenFor(ctx, teacher),
    learner,
  };
}

describe('chủ tổ chức gỡ giáo viên (FR-040)', () => {
  it('giáo viên mất quyền với lớp ngay bằng cùng token, seat giải phóng, lớp thành teacherless; học viên vẫn học theo lớp', async () => {
    const w = await world();
    const classUrl = `/classes/${w.classId}`;
    expect((await api.raw('GET', classUrl, { token: w.teacherToken })).status).toBe(200);
    expect((await api.get('/org', { token: w.ownerToken })).body.seats).toMatchObject({ used: 2 });

    const removed = await api.delete(`/org/teachers/${w.teacher.userId}`, { token: w.ownerToken });
    expect(removed.status).toBe(204);

    // Cùng access token: tài khoản không còn vai trò tổ chức nào ⇒ 403 ngay ở request kế tiếp (sai vai trò,
    // không lộ đối tượng – permissions-matrix §2).
    expect((await api.raw('GET', classUrl, { token: w.teacherToken })).status).toBe(403);
    expect((await api.raw('GET', `${classUrl}/dashboard`, { token: w.teacherToken })).status).toBe(
      403,
    );

    const org = (await api.get('/org', { token: w.ownerToken })).body;
    expect(org.seats).toMatchObject({ used: 1 });
    expect(org.teachers.find((t: any) => t.userId === w.teacher.userId)).toBeUndefined();
    expect(org.classes.find((c: any) => c.id === w.classId)).toMatchObject({
      teacherless: true,
      teachers: [],
      memberCount: 1,
    });
    const dashboard = (await api.get(`${classUrl}/dashboard`, { token: w.ownerToken })).body;
    expect(dashboard.teacherlessWarning).toBe(true);

    // Học viên vẫn học theo lộ trình lớp, vẫn thấy "Lớp của tôi".
    expect((await api.get('/me/class', { token: w.learner.token })).status).toBe(200);
    expect((await api.get('/path', { token: w.learner.token })).body.source).toBe('class');
    expect((await api.get('/today', { token: w.learner.token })).status).toBe(200);
  });
});

describe('giáo viên mất seat do hết hạn (TCH0, FR-038)', () => {
  it('giữ vai trò nhưng chỉ xem cấu trúc: dữ liệu học viên → 403, cấu trúc và danh sách → 2xx', async () => {
    const w = await world();
    const teacherCtx = await loadOrgContext(ctx.app.deps, w.teacher.userId);
    expect(teacherCtx).toMatchObject({ isTeacher: true, hasSeat: true, dataAccess: true });
    expect(
      (await api.raw('GET', `/classes/${w.classId}/dashboard`, { token: w.teacherToken })).status,
    ).toBe(200);

    // Giấy phép quá ân hạn mà không tiến đồng hồ để giữ nguyên access token đang mở.
    await sql(`UPDATE seat_licenses SET ends_on = '2026-01-02', grace_days = 0 WHERE id = $1`, [
      w.licenseId,
    ]);

    const detail = `/classes/${w.classId}/members/${w.learner.userId}/detail`;
    expect((await api.raw('GET', detail, { token: w.teacherToken })).status).toBe(403);
    expect(
      (await api.raw('GET', `/classes/${w.classId}/dashboard`, { token: w.teacherToken })).status,
    ).toBe(403);
    // Cấu trúc lớp và danh sách thành viên vẫn xem được (học viên đã bị đóng nên chỉ còn tên + lý do).
    expect((await api.raw('GET', `/classes/${w.classId}`, { token: w.teacherToken })).status).toBe(
      200,
    );
    const roster = await api.raw('GET', `/classes/${w.classId}/roster`, { token: w.teacherToken });
    expect(roster.status).toBe(200);
    expect(JSON.parse(roster.text)).toEqual([expect.objectContaining({ status: 'other_ended' })]);

    const after = (await loadOrgContext(ctx.app.deps, w.teacher.userId))!;
    expect(after).toMatchObject({ isTeacher: true, hasSeat: false, dataAccess: false });
    const me = (await api.get('/me', { token: w.teacherToken })).body;
    expect(me.organization).toMatchObject({ dataAccess: false });
    expect(me.organization.roles).toContain('teacher');
    expect(me.organization.license.state).toBe('lapsed');
  });
});

describe('chủ tổ chức cuối xóa tài khoản (FR-040, O15)', () => {
  it('quản trị viên thấy cảnh báo noOwner; khôi phục tài khoản thì cảnh báo biến mất', async () => {
    ctx.clock.set('2026-01-05T08:00:00Z');
    const org = await createTestOrg(ctx, { seats: 3 });
    // Tài khoản đăng ký thật (có mật khẩu) để gọi được POST /account/delete.
    const owner = await onboardedLearner(api, ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const admin = await createTestUser(ctx, { role: 'admin' });
    const adminToken = await tokenFor(ctx, admin);
    const warningsOf = async (): Promise<string[]> => {
      const list = (await api.get('/admin/organizations', { token: adminToken })).body;
      return list.items.find((o: any) => o.id === org.orgId).warnings;
    };
    expect(await warningsOf()).not.toContain('noOwner');

    const res = await api.post('/account/delete', {
      token: owner.token,
      body: { password: owner.user.password },
    });
    expect(res.status).toBe(200);
    expect(await warningsOf()).toContain('noOwner');

    const restored = await api.post('/account/restore', { token: owner.token });
    expect(restored.status).toBe(200);
    expect(await warningsOf()).not.toContain('noOwner');
  });
});

describe('gia hạn sau khi hết hạn (FR-038)', () => {
  it('học viên PHẢI được mời lại và xác nhận lại; tư cách cũ không tự khôi phục', async () => {
    const w = await world();
    await sql(`UPDATE seat_licenses SET ends_on = '2026-01-02', grace_days = 0 WHERE id = $1`, [
      w.licenseId,
    ]);
    await loadOrgContext(ctx.app.deps, w.owner.userId); // xử lý lười: đóng thành viên, giải phóng seat
    const [ended] = await sql(
      'SELECT end_reason, consent_at FROM class_memberships WHERE user_id = $1',
      [w.learner.userId],
    );
    expect(ended.end_reason).toBe('seat_expired');

    await createLicense(ctx.app.deps, null, w.orgId, {
      seats: 3,
      startsOn: '2026-01-03',
      endsOn: '2026-12-31',
    });
    // Giấy phép mới có seat nhưng học viên KHÔNG tự được đưa lại vào lớp.
    expect((await api.raw('GET', '/me/class', { token: w.learner.token })).status).toBe(404);
    expect(
      await sql('SELECT 1 FROM class_memberships WHERE user_id = $1 AND left_at IS NULL', [
        w.learner.userId,
      ]),
    ).toHaveLength(0);

    ctx.clock.advanceMinutes(5);
    const invitation = await createTestInvitation(ctx, w.orgId, {
      kind: 'student',
      email: w.learner.user.email,
      classId: w.classId,
    });
    const preview = await api.get(`/invitations/${invitation.token}`, { token: w.learner.token });
    expect(preview.body.disclosure).toBeDefined(); // hai lựa chọn + thông báo dữ liệu chia sẻ hiển thị lại
    const joined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: w.learner.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);
    const memberships = await sql(
      'SELECT consent_at FROM class_memberships WHERE user_id = $1 ORDER BY joined_at',
      [w.learner.userId],
    );
    expect(memberships).toHaveLength(2);
    expect(new Date(memberships[1].consent_at).getTime()).toBeGreaterThan(
      new Date(memberships[0].consent_at).getTime(),
    );
  });
});
