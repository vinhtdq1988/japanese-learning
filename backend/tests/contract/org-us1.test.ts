/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUEUES } from '../../src/jobs/boss.js';
import { adminActionLogs } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  addOrgRole,
  createTestOrg,
  createTestUser,
  tokenFor,
  type TestUser,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US1 (spec 004, T026, quickstart OG1): quản trị viên cấp tổ chức/giấy phép/seat, chủ tổ
// chức mời giáo viên, cô lập tổ chức và lời mời owner/teacher. Phản hồi được đối chiếu với OpenAPI 1.12.0.

let ctx: TestApp;
let api: ContractClient;
let admin: TestUser;
let adminToken: string;

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
  admin = await createTestUser(ctx, { role: 'admin', displayName: 'Quản trị' });
  adminToken = await tokenFor(ctx, admin);
});
afterAll(async () => {
  await ctx.close();
});

/** Token lời mời lấy từ email đã đưa vào hàng đợi (CSDL chỉ giữ băm). */
function tokenFromEmail(to: string): string {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => j.name === QUEUES.sendEmail && (j.data as any).to === to);
  const match = /#\/invite\/([A-Za-z0-9_-]+)/.exec((job?.data as any)?.text ?? '');
  if (!match) throw new Error(`Không có email lời mời gửi tới ${to}`);
  return match[1]!;
}

const del = (url: string, token: string) => api.call('delete', url, { token });

describe('POST /admin/organizations', () => {
  it('201: tạo tổ chức, mời chủ tổ chức (thư song ngữ), cấp 20 seat và ghi nhật ký', async () => {
    const res = await api.post('/admin/organizations', {
      token: adminToken,
      body: {
        name: 'Trung tâm Sakura',
        ownerEmail: 'owner-sakura@example.com',
        license: { seats: 20, startsOn: '2026-01-01', endsOn: '2026-12-31' },
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Trung tâm Sakura');
    expect(res.body.seats).toMatchObject({ total: 20, used: 0, reserved: 0 });
    expect(res.body.owners).toEqual([{ email: 'owner-sakura@example.com', status: 'pending' }]);
    expect(res.body.license.state).toBe('ok');

    const mail = ctx.jobQueue.jobs.find(
      (j) => j.name === QUEUES.sendEmail && (j.data as any).to === 'owner-sakura@example.com',
    )!.data as any;
    expect(mail.subject).toContain(' / ');
    expect(mail.text).toContain('Trung tâm Sakura');
    expect(mail.text).toMatch(/invited you to own/);

    const logs = await ctx.handle.db
      .select()
      .from(adminActionLogs)
      .where(eq(adminActionLogs.organizationId, res.body.id));
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['org.create', 'license.create']),
    );
  });

  it('422 khi thiếu tên; 403 với người học thường; 401 khi chưa đăng nhập', async () => {
    const bad = await api.post('/admin/organizations', {
      token: adminToken,
      body: { ownerEmail: 'x@example.com' },
      validateRequest: false,
    });
    expect(bad.status).toBe(422);
    const learner = await createTestUser(ctx);
    const forbidden = await api.post('/admin/organizations', {
      token: await tokenFor(ctx, learner),
      body: { name: 'A', ownerEmail: 'a@example.com' },
    });
    expect(forbidden.status).toBe(403);
    const anon = await api.post('/admin/organizations', {
      body: { name: 'A', ownerEmail: 'a@example.com' },
      validateResponse: false,
    });
    expect(anon.status).toBe(401);
  });

  it('409 khi owner là tài khoản của tổ chức khác, thân không nêu tên tổ chức kia', async () => {
    const other = await createTestOrg(ctx, { name: 'Tổ chức Bí Mật', seats: 2 });
    const taken = await createTestUser(ctx);
    await addOrgRole(ctx, other.orgId, taken.userId, { owner: true });
    const res = await api.post('/admin/organizations', {
      token: adminToken,
      body: { name: 'Tổ chức mới', ownerEmail: taken.email },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('Bí Mật');
  });
});

describe('GET /admin/organizations', () => {
  it('danh sách và chi tiết không chứa dữ liệu học viên; cảnh báo noOwner', async () => {
    const org = await createTestOrg(ctx, { name: 'Tổ chức không chủ', seats: 3 });
    const list = await api.get('/admin/organizations?q=không%20chủ', { token: adminToken });
    expect(list.status).toBe(200);
    const row = list.body.items.find((i: any) => i.id === org.orgId);
    expect(row.warnings).toContain('noOwner');
    expect(row.seats).toMatchObject({ total: 3, used: 0 });

    const detail = await api.get(`/admin/organizations/${org.orgId}`, { token: adminToken });
    expect(detail.status).toBe(200);
    expect(detail.body.licenses).toHaveLength(1);
    expect(detail.body.classCount).toBe(0);
    // Chi tiết quản trị chỉ có cấu trúc: không có khóa liên quan tiến độ/kết quả học.
    expect(JSON.stringify(detail.body)).not.toMatch(/progress|accuracy|weak|streak/i);
  });
});

describe('giấy phép', () => {
  it('409 khi kỳ hạn chồng ngày, 201 khi liền kề', async () => {
    const org = await createTestOrg(ctx, {
      seats: 2,
      startsOn: '2026-01-01',
      endsOn: '2026-06-30',
    });
    const overlap = await api.post(`/admin/organizations/${org.orgId}/licenses`, {
      token: adminToken,
      body: { seats: 2, startsOn: '2026-06-30', endsOn: '2026-12-31' },
    });
    expect(overlap.status).toBe(409);
    const next = await api.post(`/admin/organizations/${org.orgId}/licenses`, {
      token: adminToken,
      body: { seats: 2, startsOn: '2026-07-01', endsOn: '2026-12-31' },
    });
    expect(next.status).toBe(201);
    expect(next.body.seats.total).toBe(2);
  });

  it('PATCH 422 SEAT_BELOW_USAGE khi giảm dưới số đang dùng', async () => {
    const org = await createTestOrg(ctx, { seats: 3 });
    for (let i = 0; i < 2; i++) {
      const t = await createTestUser(ctx);
      await addOrgRole(ctx, org.orgId, t.userId, { teacher: true });
    }
    const res = await api.patch(`/admin/organizations/${org.orgId}/licenses/${org.licenseId}`, {
      token: adminToken,
      body: { seats: 1 },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SEAT_BELOW_USAGE');
    const ok = await api.patch(`/admin/organizations/${org.orgId}/licenses/${org.licenseId}`, {
      token: adminToken,
      body: { seats: 2, maxReassignments: 5 },
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ maxReassignments: 5, seats: { total: 2, used: 2 } });
  });
});

describe('chủ tổ chức mời giáo viên (quickstart OG1)', () => {
  it('luồng đầy đủ: chủ nhận lời mời → mời giáo viên → chấp nhận → gỡ', async () => {
    const created = await api.post('/admin/organizations', {
      token: adminToken,
      body: {
        name: 'Trung tâm Tanaka',
        ownerEmail: 'owner-tanaka@example.com',
        license: { seats: 2, startsOn: '2026-01-01', endsOn: '2026-12-31' },
      },
    });
    const owner = await createTestUser(ctx, { email: 'owner-tanaka@example.com' });
    const ownerToken = await tokenFor(ctx, owner);

    // Trước khi chấp nhận, chủ chưa vào được /org.
    expect((await api.get('/org', { token: ownerToken })).status).toBe(403);
    const ownerInvite = tokenFromEmail('owner-tanaka@example.com');
    const preview = await api.get(`/invitations/${ownerInvite}`, { token: ownerToken });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ kind: 'owner', organizationName: 'Trung tâm Tanaka' });
    expect(preview.body.disclosure ?? null).toBeNull();
    const accepted = await api.post(`/invitations/${ownerInvite}/respond`, {
      token: ownerToken,
      body: { decision: 'accept' },
    });
    expect(accepted.body.status).toBe('accepted');
    // Dùng một lần: nhận lại → 404 chung.
    const again = await api.get(`/invitations/${ownerInvite}`, { token: ownerToken });
    expect(again.status).toBe(404);

    const overview = await api.get('/org', { token: ownerToken });
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({
      id: created.body.id,
      seats: { total: 2, used: 0, reserved: 0, available: 2 },
      teachers: [],
    });

    // Mời giáo viên: giữ chỗ một seat.
    const teacher = await createTestUser(ctx, { displayName: 'Cô Hana' });
    const invited = await api.post('/org/teachers/invitations', {
      token: ownerToken,
      body: { email: teacher.email },
    });
    expect(invited.status).toBe(201);
    expect(invited.body).toMatchObject({
      kind: 'teacher',
      status: 'pending',
      email: teacher.email,
    });
    expect((await api.get('/org', { token: ownerToken })).body.seats.reserved).toBe(1);

    const teacherToken = await tokenFor(ctx, teacher);
    const teacherInvite = tokenFromEmail(teacher.email);
    await api.post(`/invitations/${teacherInvite}/respond`, {
      token: teacherToken,
      body: { decision: 'accept' },
    });
    const after = await api.get('/org', { token: ownerToken });
    expect(after.body.seats).toMatchObject({ used: 1, reserved: 0, available: 1 });
    expect(after.body.teachers).toEqual([
      expect.objectContaining({ userId: teacher.userId, hasSeat: true, displayName: 'Cô Hana' }),
    ]);

    // GET /me của giáo viên mang vai trò tổ chức (T039).
    const me = await api.get('/me', { token: teacherToken });
    expect(me.body.learningSource).toBe('personal');
    expect(me.body.organization).toMatchObject({
      name: 'Trung tâm Tanaka',
      roles: ['teacher'],
      dataAccess: true,
    });
    expect(me.body.organization.license.state).toBe('ok');

    // Gỡ giáo viên: mất quyền NGAY với cùng token, seat được giải phóng.
    expect((await del(`/org/teachers/${teacher.userId}`, ownerToken)).status).toBe(204);
    expect((await api.get('/org', { token: teacherToken })).status).toBe(403);
    expect((await api.get('/org', { token: ownerToken })).body.seats.used).toBe(0);
    const meAfter = await api.get('/me', { token: teacherToken });
    expect(meAfter.body.organization).toBeUndefined();
  });

  it('409 SEAT_UNAVAILABLE khi hết chỗ (tính cả lời mời đang chờ)', async () => {
    const org = await createTestOrg(ctx, { seats: 1 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const token = await tokenFor(ctx, owner);
    const first = await api.post('/org/teachers/invitations', {
      token,
      body: { email: 'gv-1@example.com' },
    });
    expect(first.status).toBe(201);
    const second = await api.post('/org/teachers/invitations', {
      token,
      body: { email: 'gv-2@example.com' },
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SEAT_UNAVAILABLE');
  });

  it('409 INVITEE_UNAVAILABLE khi email thuộc tổ chức khác, không lộ tên tổ chức', async () => {
    const orgA = await createTestOrg(ctx, { name: 'Tổ chức Alpha', seats: 3 });
    const orgB = await createTestOrg(ctx, { name: 'Tổ chức Beta-Kín', seats: 3 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, orgA.orgId, owner.userId, { owner: true });
    const outsider = await createTestUser(ctx);
    await addOrgRole(ctx, orgB.orgId, outsider.userId, { teacher: true });
    const res = await api.post('/org/teachers/invitations', {
      token: await tokenFor(ctx, owner),
      body: { email: outsider.email },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
    expect(res.body.message).not.toContain('Beta');
    expect(JSON.stringify(res.body)).not.toContain('Beta');
  });

  it('gỡ giáo viên của tổ chức khác → 404 chung; cấp/thu hồi seat theo OpenAPI', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const ownerToken = await tokenFor(ctx, owner);
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });

    expect(
      (await api.post(`/org/seats/${teacher.userId}/revoke`, { token: ownerToken })).status,
    ).toBe(204);
    const lost = await api.get('/org', { token: ownerToken });
    expect(lost.body.teachers[0]).toMatchObject({ userId: teacher.userId, hasSeat: false });
    expect(
      (await api.post(`/org/seats/${teacher.userId}/grant`, { token: ownerToken })).status,
    ).toBe(204);

    const foreign = await createTestUser(ctx);
    const other = await createTestOrg(ctx, { seats: 1 });
    await addOrgRole(ctx, other.orgId, foreign.userId, { teacher: true });
    const res = await del(`/org/teachers/${foreign.userId}`, ownerToken);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' });
  });
});

describe('lời mời: bảo mật', () => {
  it('token sai, email không khớp và token không tồn tại cho cùng một 404 từng byte', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const invitee = await createTestUser(ctx);
    await api.post('/org/teachers/invitations', {
      token: await tokenFor(ctx, owner),
      body: { email: invitee.email },
    });
    const token = tokenFromEmail(invitee.email);
    const stranger = await createTestUser(ctx);
    const strangerToken = await tokenFor(ctx, stranger);

    const wrongEmail = await api.raw('GET', `/invitations/${token}`, { token: strangerToken });
    const unknown = await api.raw('GET', '/invitations/khong-ton-tai', { token: strangerToken });
    expect(wrongEmail.status).toBe(404);
    expect(wrongEmail.text).toBe(unknown.text);
    // Người lạ không chấp nhận được lời mời của người khác.
    const respond = await api.raw('POST', `/invitations/${token}/respond`, {
      token: strangerToken,
      body: { decision: 'accept' },
    });
    expect(respond.status).toBe(404);
    expect(respond.text).toBe(unknown.text);
  });

  it('thu hồi lời mời trả lại chỗ giữ; từ chối đóng lời mời không tốn seat', async () => {
    const org = await createTestOrg(ctx, { seats: 1 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const ownerToken = await tokenFor(ctx, owner);
    const invitee = await createTestUser(ctx);
    const row = await api.post('/org/teachers/invitations', {
      token: ownerToken,
      body: { email: invitee.email },
    });
    expect((await api.get('/org', { token: ownerToken })).body.seats.reserved).toBe(1);
    expect((await del(`/invitations/${row.body.id}`, ownerToken)).status).toBe(204);
    expect((await api.get('/org', { token: ownerToken })).body.seats).toMatchObject({
      reserved: 0,
      available: 1,
    });

    const again = await api.post('/org/teachers/invitations', {
      token: ownerToken,
      body: { email: invitee.email },
    });
    const decline = await api.post(`/invitations/${tokenFromEmail(invitee.email)}/respond`, {
      token: await tokenFor(ctx, invitee),
      body: { decision: 'decline' },
    });
    expect(again.status).toBe(201);
    expect(decline.body.status).toBe('declined');
    expect((await api.get('/org', { token: ownerToken })).body.seats).toMatchObject({
      used: 0,
      reserved: 0,
    });
  });
});

describe('GET /admin/action-logs?organizationId', () => {
  it('lọc nhật ký theo tổ chức', async () => {
    const created = await api.post('/admin/organizations', {
      token: adminToken,
      body: { name: 'Tổ chức nhật ký', ownerEmail: 'owner-log@example.com' },
    });
    const logs = await api.get(`/admin/action-logs?organizationId=${created.body.id}`, {
      token: adminToken,
    });
    expect(logs.status).toBe(200);
    expect(logs.body.length).toBeGreaterThan(0);
    expect(logs.body.every((l: any) => l.targetId !== undefined)).toBe(true);
    expect(logs.body.some((l: any) => l.action === 'org.create')).toBe(true);
  });
});
