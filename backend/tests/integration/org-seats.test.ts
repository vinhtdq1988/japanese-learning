import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/types.js';
import { seats } from '../../src/db/schema.js';
import { createInvitation, respondInvitation } from '../../src/services/invitations.js';
import { patchLicense } from '../../src/services/org-admin.js';
import { removeTeacher } from '../../src/services/org-members.js';
import { getSeatSummary, grantSeatToTeacher, revokeSeat } from '../../src/services/org-seats.js';
import { endLearnerMembership } from '../../src/services/org-seats.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  enrollLearner,
} from './org-helpers.js';

// Kiểm thử tích hợp seat (spec 004, T027, FR-004, FR-005): ưu tiên người cũ, giới hạn đổi người giữ, giữ chỗ
// lời mời, một tài khoản một seat (giáo viên + học viên), giảm số seat, chủ tổ chức không chiếm seat.

let ctx: TestApp;
const deps = () => ctx.app.deps;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

/** Tạo giáo viên chưa có seat trong tổ chức. */
async function teacherWithoutSeat(orgId: string) {
  const user = await createTestUser(ctx);
  await addOrgRole(ctx, orgId, user.userId, { teacher: true, seat: false });
  return user;
}

describe('gán seat theo ưu tiên người cũ và giới hạn đổi', () => {
  it('rời rồi quay lại KHÔNG tính một lần đổi người giữ', async () => {
    const org = await createTestOrg(ctx, { seats: 1, maxReassignments: 1 });
    const t = await teacherWithoutSeat(org.orgId);
    for (let i = 0; i < 3; i++) {
      await grantSeatToTeacher(deps(), null, org.orgId, t.userId);
      await revokeSeat(deps(), null, org.orgId, t.userId);
    }
    const [seat] = await ctx.handle.db.select().from(seats).where(eq(seats.id, org.seatIds[0]!));
    expect(seat!.reassignmentCount).toBe(0);
    expect(seat!.lastHolderUserId).toBe(t.userId);
  });

  it('đổi sang người khác tính một lần; vượt giới hạn → SEAT_REASSIGN_LIMIT, nâng giới hạn thì được', async () => {
    const org = await createTestOrg(ctx, { seats: 1, maxReassignments: 1 });
    const [a, b, c] = [
      await teacherWithoutSeat(org.orgId),
      await teacherWithoutSeat(org.orgId),
      await teacherWithoutSeat(org.orgId),
    ];
    await grantSeatToTeacher(deps(), null, org.orgId, a.userId); // seat chưa từng có người giữ
    await revokeSeat(deps(), null, org.orgId, a.userId);
    await grantSeatToTeacher(deps(), null, org.orgId, b.userId); // đổi lần 1
    await revokeSeat(deps(), null, org.orgId, b.userId);
    await expectCode(grantSeatToTeacher(deps(), null, org.orgId, c.userId), 'SEAT_REASSIGN_LIMIT');

    await patchLicense(deps(), null, org.orgId, org.licenseId!, { maxReassignments: 3 });
    await grantSeatToTeacher(deps(), null, org.orgId, c.userId);
    const summary = await getSeatSummary(deps(), org.orgId);
    expect(summary).toMatchObject({ total: 1, used: 1, available: 0 });
  });

  it('hết seat → SEAT_UNAVAILABLE', async () => {
    const org = await createTestOrg(ctx, { seats: 1 });
    const [a, b] = [await teacherWithoutSeat(org.orgId), await teacherWithoutSeat(org.orgId)];
    await grantSeatToTeacher(deps(), null, org.orgId, a.userId);
    await expectCode(grantSeatToTeacher(deps(), null, org.orgId, b.userId), 'SEAT_UNAVAILABLE');
  });
});

describe('giữ chỗ bởi lời mời', () => {
  it('lời mời giáo viên giữ chỗ nên số còn trống giảm, không vượt số seat trống', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const invite = (email: string) =>
      createInvitation(deps(), {
        organizationId: org.orgId,
        kind: 'teacher',
        email,
        invitedBy: owner.userId,
      });
    await invite('a@example.com');
    await invite('b@example.com');
    expect(await getSeatSummary(deps(), org.orgId)).toMatchObject({
      total: 2,
      used: 0,
      reserved: 2,
      available: 0,
    });
    await expectCode(invite('c@example.com'), 'SEAT_UNAVAILABLE');
  });

  it('lời mời quá hạn không còn giữ chỗ', async () => {
    const org = await createTestOrg(ctx, { seats: 1 });
    await createTestInvitation(ctx, org.orgId, {
      kind: 'teacher',
      email: 'het-han@example.com',
      expired: true,
    });
    expect((await getSeatSummary(deps(), org.orgId)).reserved).toBe(0);
  });
});

describe('một tài khoản một seat (FR-004)', () => {
  it('giáo viên đồng thời là học viên lớp khác dùng chung một seat, không tính thêm', async () => {
    const org = await createTestOrg(ctx, { seats: 3 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId);
    const before = await getSeatSummary(deps(), org.orgId);
    const { seatId } = await enrollLearner(ctx, org.orgId, classId, teacher.userId);
    const after = await getSeatSummary(deps(), org.orgId);
    expect(after.used).toBe(before.used);
    expect(after.available).toBe(before.available);
    expect(seatId).not.toBeNull();
  });

  it('học viên-cũng-là-giáo viên rời lớp vẫn giữ seat; chỉ mất cả hai vai trò mới giải phóng', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const both = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, both.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId);
    await enrollLearner(ctx, org.orgId, classId, both.userId);

    // Rời lớp nhưng còn là giáo viên → giữ seat.
    await endLearnerMembership(deps(), org.orgId, both.userId, 'switched_personal');
    expect((await getSeatSummary(deps(), org.orgId)).used).toBe(1);

    // Vào lại lớp rồi bị gỡ vai trò giáo viên khi còn ở lớp → giữ seat (còn là học viên).
    await enrollLearner(ctx, org.orgId, classId, both.userId, { seat: false });
    await removeTeacher(deps(), owner.userId, org.orgId, both.userId);
    expect((await getSeatSummary(deps(), org.orgId)).used).toBe(1);

    // Rời lớp nốt → mất cả hai vai trò → giải phóng seat.
    await endLearnerMembership(deps(), org.orgId, both.userId, 'switched_personal');
    expect((await getSeatSummary(deps(), org.orgId)).used).toBe(0);
  });

  it('giảm số seat dưới (đang dùng + giữ chỗ) bị từ chối', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const t = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, t.userId, { teacher: true });
    await createInvitation(deps(), {
      organizationId: org.orgId,
      kind: 'teacher',
      email: 'giu-cho@example.com',
      invitedBy: null,
    });
    await expectCode(
      patchLicense(deps(), null, org.orgId, org.licenseId!, { seats: 1 }),
      'SEAT_BELOW_USAGE',
    );
    await patchLicense(deps(), null, org.orgId, org.licenseId!, { seats: 2 });
    expect((await getSeatSummary(deps(), org.orgId)).total).toBe(2);
  });
});

describe('chủ tổ chức không chiếm seat', () => {
  it('chủ tổ chức kiêm giáo viên chấp nhận lời mời giáo viên mà không tốn seat', async () => {
    const org = await createTestOrg(ctx, { seats: 1 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    await createInvitation(deps(), {
      organizationId: org.orgId,
      kind: 'teacher',
      email: owner.email,
      invitedBy: null,
    });
    // Mời chủ tổ chức làm giáo viên không giữ chỗ.
    expect((await getSeatSummary(deps(), org.orgId)).reserved).toBe(0);
    const result = await respondInvitation(
      deps(),
      owner.userId,
      await firstTeacherToken(owner.email),
      {
        decision: 'accept',
      },
    );
    expect(result.status).toBe('accepted');
    expect(await getSeatSummary(deps(), org.orgId)).toMatchObject({ used: 0, available: 1 });
  });
});

/** Token của lời mời mới nhất gửi tới email (lấy từ hàng đợi email). */
async function firstTeacherToken(email: string): Promise<string> {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => (j.data as { to?: string }).to === email);
  const match = /#\/invite\/([A-Za-z0-9_-]+)/.exec((job?.data as { text: string }).text);
  return match![1]!;
}
