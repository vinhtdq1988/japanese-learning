/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { markPendingDeletion } from '../../src/db/repositories/users.js';
import { invitations, organizationMembers, seats } from '../../src/db/schema.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử tích hợp lời mời học viên (spec 004, T045, FR-002, FR-004, FR-005, FR-014, FR-016): dùng một lần,
// hết hạn, một lời mời chờ mỗi (tổ chức, email), giữ chỗ và chỉ tính seat khi xác nhận vào lớp, chấp nhận khi
// mất seat, các điều kiện từ chối vào lớp.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp({}, { CLASS_MAX_MEMBERS: '3' });
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

let counter = 0;
const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${counter++}@example.com`;

/** Tổ chức có chủ, một giáo viên (chiếm 1 seat) phụ trách một lớp ĐÃ có lộ trình. */
async function setup(seatCount = 6) {
  const org = await createTestOrg(ctx, { seats: seatCount });
  const owner = await createTestUser(ctx, { displayName: 'Chủ' });
  const teacher = await createTestUser(ctx, { displayName: 'Giáo viên' });
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  return {
    org,
    owner,
    teacher,
    classId,
    ownerToken: await tokenFor(ctx, owner),
    teacherToken: await tokenFor(ctx, teacher),
  };
}

const invite = (classId: string, token: string, emails: string[]) =>
  api.post(`/classes/${classId}/invitations`, {
    token,
    body: { invitees: emails.map((email) => ({ email })) },
  });

const respond = (token: string, bearer: string, body: Record<string, unknown>) =>
  api.post(`/invitations/${token}/respond`, { token: bearer, body, validateRequest: false });

const joinBody = { decision: 'join_class', confirmed: true };

/** Token thô của lời mời học viên đã tạo bằng API (CSDL chỉ giữ băm ⇒ lấy từ email trong hàng đợi). */
function tokenFromEmail(to: string): string {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => (j.data as any).to === to && (j.data as any).kind === 'org_invitation');
  const match = /#\/invite\/([A-Za-z0-9_-]+)/.exec((job?.data as any)?.text ?? '');
  if (!match) throw new Error(`Không có email lời mời gửi tới ${to}`);
  return match[1]!;
}

describe('vòng đời lời mời', () => {
  it('dùng một lần: sau khi vào lớp, liên kết cũ → 404 chung', async () => {
    const { org, classId } = await setup();
    const learner = await createTestUser(ctx);
    const inv = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.email,
      classId,
    });
    const bearer = await tokenFor(ctx, learner);
    expect((await respond(inv.token, bearer, joinBody)).status).toBe(200);
    expect((await api.get(`/invitations/${inv.token}`, { token: bearer })).status).toBe(404);
    const again = await respond(inv.token, bearer, { decision: 'stay_personal' });
    expect(again.status).toBe(404);
  });

  it('hết hạn sau 14 ngày → 404 chung, kể cả khi xem trước', async () => {
    const { classId, teacherToken } = await setup();
    const learner = await createTestUser(ctx);
    await invite(classId, teacherToken, [learner.email]);
    const token = tokenFromEmail(learner.email);
    const [row] = await ctx.handle.db
      .select()
      .from(invitations)
      .where(eq(invitations.email, learner.email));
    expect(row!.expiresAt.getTime() - ctx.clock.now().getTime()).toBe(14 * 86_400_000);

    ctx.clock.advanceDays(13);
    expect(
      (await api.get(`/invitations/${token}`, { token: await tokenFor(ctx, learner) })).status,
    ).toBe(200);
    ctx.clock.advanceDays(2);
    const expired = await api.get(`/invitations/${token}`, { token: await tokenFor(ctx, learner) });
    expect(expired.status).toBe(404);
    ctx.clock.advanceDays(-15);
  });

  it('chỉ một lời mời chờ mỗi (tổ chức, email); mời lại được sau khi lời mời cũ hết hạn', async () => {
    const { org, classId, teacherToken } = await setup();
    const email = uniqueEmail('moi-lai');
    const first = await invite(classId, teacherToken, [email]);
    expect(first.body.results[0].outcome).toBe('invited');
    const dup = await invite(classId, teacherToken, [email]);
    expect(dup.body.results[0].outcome).toBe('already_invited');

    ctx.clock.advanceDays(15);
    // Token cũ đã hết hạn theo đồng hồ giả nên ký lại token mới cho giáo viên.
    const fresh = await invite(classId, (await freshTeacherToken(classId)) ?? teacherToken, [
      email,
    ]);
    expect(fresh.body.results[0].outcome).toBe('invited');
    const rows = await ctx.handle.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.organizationId, org.orgId), eq(invitations.email, email)));
    expect(rows.filter((r) => r.status === 'pending')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'expired')).toHaveLength(1);
    ctx.clock.advanceDays(-15);
  });
});

/** Ký token mới (đồng hồ giả đã tiến) cho giáo viên phụ trách lớp. */
async function freshTeacherToken(classId: string): Promise<string | undefined> {
  const rows = await ctx.handle.db.execute<{ user_id: string }>(
    sql`SELECT user_id FROM class_teachers WHERE class_id = ${classId} LIMIT 1`,
  );
  const userId = rows.rows[0]?.user_id;
  return userId ? tokenFor(ctx, { userId, role: 'learner' }) : undefined;
}

describe('giữ chỗ seat và thời điểm tính seat (FR-005, FR-016)', () => {
  it('lời mời giữ chỗ; seat chỉ bị tính khi join_class + confirmed; stay_personal không tốn seat', async () => {
    const { owner, classId, teacherToken } = await setup(3);
    const ownerBearer = await tokenFor(ctx, owner);
    const a = await createTestUser(ctx);
    const b = await createTestUser(ctx);
    await invite(classId, teacherToken, [a.email, b.email]);
    const seatsNow = async () => (await api.get('/org', { token: ownerBearer })).body.seats;
    expect(await seatsNow()).toMatchObject({ total: 3, used: 1, reserved: 2, available: 0 });

    const declined = await respond(tokenFromEmail(a.email), await tokenFor(ctx, a), {
      decision: 'stay_personal',
    });
    expect(declined.body.status).toBe('stayed_personal');
    expect(await seatsNow()).toMatchObject({ used: 1, reserved: 1, available: 1 });

    const joined = await respond(tokenFromEmail(b.email), await tokenFor(ctx, b), joinBody);
    expect(joined.body.status).toBe('joined');
    expect(await seatsNow()).toMatchObject({ used: 2, reserved: 0, available: 1 });
  });

  it('chấp nhận khi seat đã mất → 409 SEAT_UNAVAILABLE, lời mời giữ pending, học viên không vào lớp', async () => {
    const { org, classId, teacherToken } = await setup(2);
    const learner = await createTestUser(ctx);
    await invite(classId, teacherToken, [learner.email]);
    // Mô phỏng seat trống biến mất (ví dụ giấy phép bị chỉnh ngoài luồng).
    await ctx.handle.db.delete(seats).where(isNull(seats.holderUserId));
    const bearer = await tokenFor(ctx, learner);
    const res = await respond(tokenFromEmail(learner.email), bearer, joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEAT_UNAVAILABLE');
    expect((await api.get('/me/class', { token: bearer })).status).toBe(404);
    const [row] = await ctx.handle.db
      .select()
      .from(invitations)
      .where(eq(invitations.email, learner.email));
    expect(row!.status).toBe('pending');
    void org;
  });

  it('seat trống đã hết lượt đổi người giữ → 422 SEAT_REASSIGN_LIMIT', async () => {
    const { teacher, classId, teacherToken } = await setup(2);
    const learner = await createTestUser(ctx);
    await invite(classId, teacherToken, [learner.email]);
    await ctx.handle.db
      .update(seats)
      .set({ lastHolderUserId: teacher.userId, reassignmentCount: 2 })
      .where(isNull(seats.holderUserId));
    const res = await respond(
      tokenFromEmail(learner.email),
      await tokenFor(ctx, learner),
      joinBody,
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SEAT_REASSIGN_LIMIT');
  });
});

describe('điều kiện vào lớp', () => {
  it('ALREADY_IN_CLASS và outcome already_in_other_class (FR-014)', async () => {
    const { org, classId, teacherToken } = await setup();
    const { classId: other } = await createTestClass(ctx, org.orgId, {});
    const learner = await createTestUser(ctx);
    await enrollLearner(ctx, org.orgId, other, learner.userId);

    const viaApi = await invite(classId, teacherToken, [learner.email]);
    expect(viaApi.body.results[0].outcome).toBe('already_in_other_class');

    const inv = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.email,
      classId,
    });
    const res = await respond(inv.token, await tokenFor(ctx, learner), joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_IN_CLASS');
  });

  it('email của tài khoản chờ xóa: mời được, nhưng xem trước/chấp nhận → 404 cho tới khi khôi phục', async () => {
    const { classId, teacherToken } = await setup();
    const learner = await createTestUser(ctx);
    await markPendingDeletion(ctx.handle.db, learner.userId, ctx.clock.now());
    const res = await invite(classId, teacherToken, [learner.email]);
    expect(res.body.results[0].outcome).toBe('invited');
    const token = tokenFromEmail(learner.email);
    const bearer = await tokenFor(ctx, learner);
    expect((await api.get(`/invitations/${token}`, { token: bearer })).status).toBe(404);
    expect((await respond(token, bearer, joinBody)).status).toBe(404);
  });

  it('openMembership tạo dòng organization_members (cờ vai trò false) cho học viên', async () => {
    const { org, classId, teacherToken } = await setup();
    const learner = await createTestUser(ctx);
    await invite(classId, teacherToken, [learner.email]);
    await respond(tokenFromEmail(learner.email), await tokenFor(ctx, learner), joinBody);
    const [member] = await ctx.handle.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, learner.userId));
    expect(member).toMatchObject({ organizationId: org.orgId, isOwner: false, isTeacher: false });
  });

  it('học viên của tổ chức A không được mời vào tổ chức B (lúc mời và lúc chấp nhận, không lộ tên)', async () => {
    const a = await setup();
    const b = await setup();
    const learner = await createTestUser(ctx);
    await enrollLearner(ctx, a.org.orgId, a.classId, learner.userId);

    const viaApi = await invite(b.classId, b.teacherToken, [learner.email]);
    expect(viaApi.body.results[0].outcome).toBe('unavailable');

    // Lời mời đã tồn tại từ trước (đua) vẫn bị chặn lúc chấp nhận.
    const inv = await createTestInvitation(ctx, b.org.orgId, {
      kind: 'student',
      email: learner.email,
      classId: b.classId,
    });
    const res = await respond(inv.token, await tokenFor(ctx, learner), joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain(String(a.org.orgId));
  });

  it('lớp chưa có lộ trình → CLASS_NOT_READY', async () => {
    const { org, teacher } = await setup();
    const { classId } = await createTestClass(ctx, org.orgId, {
      teacherIds: [teacher.userId],
      withPath: false,
    });
    const learner = await createTestUser(ctx);
    const inv = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.email,
      classId,
    });
    const res = await respond(inv.token, await tokenFor(ctx, learner), joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_NOT_READY');
  });

  it('lớp đủ CLASS_MAX_MEMBERS (3) → CLASS_FULL', async () => {
    const { org, classId } = await setup(8);
    for (let i = 0; i < 3; i++) {
      const u = await createTestUser(ctx);
      await enrollLearner(ctx, org.orgId, classId, u.userId);
    }
    const learner = await createTestUser(ctx);
    const inv = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.email,
      classId,
    });
    const res = await respond(inv.token, await tokenFor(ctx, learner), joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_FULL');
  });

  it('email khớp không phân biệt hoa thường', async () => {
    const { classId, teacherToken } = await setup();
    const learner = await createTestUser(ctx, { email: `Hoa.Tran-${Date.now()}@Example.com` });
    const res = await invite(classId, teacherToken, [learner.email.toLowerCase()]);
    expect(res.body.results[0].outcome).toBe('invited');
    const preview = await api.get(`/invitations/${tokenFromEmail(learner.email.toLowerCase())}`, {
      token: await tokenFor(ctx, learner),
    });
    expect(preview.status).toBe(200);
  });

  it('giáo viên phụ trách không được là học viên lớp mình (bất biến §3.5)', async () => {
    const { org, classId, teacher, teacherToken } = await setup();
    const viaApi = await invite(classId, teacherToken, [teacher.email]);
    expect(viaApi.body.results[0].outcome).toBe('unavailable');
    const inv = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: teacher.email,
      classId,
    });
    const res = await respond(inv.token, teacherToken, joinBody);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
  });
});
