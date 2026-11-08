import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classMemberships, invitations, organizationMembers, seats } from '../../src/db/schema.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử lưu trữ lớp (spec 004, T048, FR-009): cần confirm, đóng mọi thành viên (class_archived), giải
// phóng seat, vô hiệu mã + lời mời chờ, lịch sử học nguyên vẹn, lớp lưu trữ chỉ còn đọc.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

describe('lưu trữ lớp', () => {
  it('thiếu confirm → 422 và không đổi gì', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    const token = await tokenFor(ctx, teacher);
    const res = await api.raw('POST', `/classes/${classId}/archive`, { token, body: {} });
    expect(res.status).toBe(422);
    const detail = await api.get(`/classes/${classId}`, { token });
    expect(detail.body.status).toBe('active');
  });

  it('đóng mọi học viên, giải phóng seat, vô hiệu mã và lời mời chờ; giáo viên giữ seat', async () => {
    const org = await createTestOrg(ctx, { seats: 5 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    const token = await tokenFor(ctx, teacher);
    const ownerToken = await tokenFor(ctx, owner);

    const learners = [await createTestUser(ctx), await createTestUser(ctx)];
    for (const l of learners) await enrollLearner(ctx, org.orgId, classId, l.userId);
    const code = (
      await api.put(`/classes/${classId}/join-code`, { token, body: { enabled: true } })
    ).body.code as string;
    await api.post(`/classes/${classId}/invitations`, {
      token,
      body: { invitees: [{ email: 'cho-ngay@example.com' }] },
    });
    expect((await api.get('/org', { token: ownerToken })).body.seats).toMatchObject({
      used: 3,
      reserved: 1,
    });

    const res = await api.post(`/classes/${classId}/archive`, { token, body: { confirm: true } });
    expect(res.body).toEqual({ learnersMoved: 2 });

    // Thành viên đóng với lý do class_archived; lịch sử (dòng thành viên) còn nguyên.
    const memberships = await ctx.handle.db
      .select()
      .from(classMemberships)
      .where(eq(classMemberships.classId, classId));
    expect(memberships).toHaveLength(2);
    for (const m of memberships) {
      expect(m.endReason).toBe('class_archived');
      expect(m.leftAt).not.toBeNull();
      expect(m.seatId).toBeNull();
    }
    // Seat giải phóng (chỉ còn giáo viên), chỗ giữ của lời mời chờ được trả.
    expect((await api.get('/org', { token: ownerToken })).body.seats).toMatchObject({
      used: 1,
      reserved: 0,
      available: 4,
    });
    const held = await ctx.handle.db
      .select()
      .from(seats)
      .where(eq(seats.licenseId, org.licenseId!));
    expect(held.filter((s) => s.holderUserId !== null)).toHaveLength(1);
    const [inv] = await ctx.handle.db
      .select()
      .from(invitations)
      .where(eq(invitations.email, 'cho-ngay@example.com'));
    expect(inv!.status).toBe('revoked');
    // Học viên không còn dòng organization_members (không vai trò, không lớp).
    const stillMembers = await ctx.handle.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, learners[0]!.userId));
    expect(stillMembers).toHaveLength(0);

    // Mã tham gia bị vô hiệu.
    const stranger = await createTestUser(ctx);
    const join = await api.raw('POST', '/me/class/join', {
      token: await tokenFor(ctx, stranger),
      body: { code },
    });
    expect(join.status).toBe(404);
  });

  it('lớp lưu trữ: xem được cấu trúc + danh sách thành viên, mọi thao tác ghi → 409 CLASS_ARCHIVED, không khôi phục', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    const token = await tokenFor(ctx, teacher);
    const learner = await createTestUser(ctx, { displayName: 'Học viên cũ' });
    await enrollLearner(ctx, org.orgId, classId, learner.userId);
    await api.post(`/classes/${classId}/archive`, { token, body: { confirm: true } });

    expect((await api.get(`/classes/${classId}`, { token })).body.status).toBe('archived');
    const roster = await api.get(`/classes/${classId}/roster`, { token });
    expect(roster.body).toEqual([
      expect.objectContaining({ status: 'other_ended', displayName: 'Học viên cũ' }),
    ]);

    const writes = [
      api.patch(`/classes/${classId}`, { token, body: { name: 'X' } }),
      api.post(`/classes/${classId}/invitations`, {
        token,
        body: { invitees: [{ email: 'a@example.com' }] },
      }),
      api.put(`/classes/${classId}/join-code`, { token, body: { enabled: true } }),
      api.post(`/classes/${classId}/join-code/rotate`, { token }),
      api.call('delete', `/classes/${classId}/members/${learner.userId}`, { token }),
      api.post(`/classes/${classId}/archive`, { token, body: { confirm: true } }),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CLASS_ARCHIVED');
    }
    const csv = await api.raw('POST', `/classes/${classId}/invitations/import`, {
      token,
      headers: { 'content-type': 'text/csv' },
      body: 'email\r\na@example.com\r\n',
    });
    expect(csv.status).toBe(409);
  });
});
