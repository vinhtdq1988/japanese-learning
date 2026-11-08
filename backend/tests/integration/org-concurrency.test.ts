import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/types.js';
import { createInvitation, respondInvitation } from '../../src/services/invitations.js';
import { getSeatSummary, grantSeatToTeacher, revokeSeat } from '../../src/services/org-seats.js';
import { QUEUES } from '../../src/jobs/boss.js';
import { createTestApp, type TestApp } from './helpers.js';
import { addOrgRole, createTestOrg, createTestUser } from './org-helpers.js';

// Kiểm thử đồng thời sức chứa (spec 004, T028, FR-005, research O3): các yêu cầu được bắn song song vào cùng
// ứng dụng/CSDL; khóa `organizations FOR UPDATE` phải tuần tự hóa nên không bao giờ vượt số seat.

let ctx: TestApp;
const deps = () => ctx.app.deps;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

function tokenFromEmail(to: string): string {
  const job = [...ctx.jobQueue.jobs]
    .reverse()
    .find((j) => j.name === QUEUES.sendEmail && (j.data as { to?: string }).to === to);
  return /#\/invite\/([A-Za-z0-9_-]+)/.exec((job!.data as { text: string }).text)![1]!;
}

const outcome = async (p: Promise<unknown>): Promise<'ok' | string> =>
  p.then(
    () => 'ok',
    (e: unknown) => (e instanceof AppError ? e.code : `lỗi: ${String(e)}`),
  );

describe('đồng thời trên seat cuối cùng', () => {
  it('hai lời mời giáo viên được chấp nhận cùng lúc cho seat cuối → đúng một thành công', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    const [a, b] = [await createTestUser(ctx), await createTestUser(ctx)];
    for (const u of [a, b]) {
      await createInvitation(deps(), {
        organizationId: org.orgId,
        kind: 'teacher',
        email: u.email,
        invitedBy: owner.userId,
      });
    }
    // Một người khác chiếm mất một seat qua đường trực tiếp (quản trị viên), chỉ còn đúng một seat trống.
    const taker = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, taker.userId, { teacher: true });

    const results = await Promise.all(
      [a, b].map((u) =>
        outcome(
          respondInvitation(deps(), u.userId, tokenFromEmail(u.email), { decision: 'accept' }),
        ),
      ),
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'SEAT_UNAVAILABLE')).toHaveLength(1);
    const summary = await getSeatSummary(deps(), org.orgId);
    expect(summary.used).toBe(2);
    expect(summary.used).toBeLessThanOrEqual(summary.total);
  });

  it('gửi lời mời đồng thời không bao giờ vượt số seat trống', async () => {
    const org = await createTestOrg(ctx, { seats: 3 });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        outcome(
          createInvitation(deps(), {
            organizationId: org.orgId,
            kind: 'teacher',
            email: `dong-thoi-${i}@example.com`,
            invitedBy: null,
          }),
        ),
      ),
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(3);
    expect(results.filter((r) => r === 'SEAT_UNAVAILABLE')).toHaveLength(7);
    const summary = await getSeatSummary(deps(), org.orgId);
    expect(summary).toMatchObject({ total: 3, reserved: 3, available: 0 });
  });

  it('cấp seat song song cho nhiều giáo viên không vượt tổng số seat', async () => {
    const org = await createTestOrg(ctx, { seats: 2 });
    const teachers = [];
    for (let i = 0; i < 5; i++) {
      const u = await createTestUser(ctx);
      await addOrgRole(ctx, org.orgId, u.userId, { teacher: true, seat: false });
      teachers.push(u);
    }
    const results = await Promise.all(
      teachers.map((t) => outcome(grantSeatToTeacher(deps(), null, org.orgId, t.userId))),
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(2);
    expect(results.filter((r) => r !== 'ok').every((r) => r === 'SEAT_UNAVAILABLE')).toBe(true);
    expect((await getSeatSummary(deps(), org.orgId)).used).toBe(2);
  });

  it('thu hồi seat song song không làm âm đếm; thu hồi lại là idempotent về số liệu', async () => {
    const org = await createTestOrg(ctx, { seats: 3 });
    const teachers = [];
    for (let i = 0; i < 3; i++) {
      const u = await createTestUser(ctx);
      await addOrgRole(ctx, org.orgId, u.userId, { teacher: true });
      teachers.push(u);
    }
    // Mỗi người bị thu hồi hai lần song song: lần thừa trả 404 chung nhưng không làm sai số đếm.
    const results = await Promise.all(
      teachers.flatMap((t) => [
        outcome(revokeSeat(deps(), null, org.orgId, t.userId)),
        outcome(revokeSeat(deps(), null, org.orgId, t.userId)),
      ]),
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(3);
    expect(results.filter((r) => r !== 'ok').every((r) => r === 'NOT_FOUND')).toBe(true);
    expect(await getSeatSummary(deps(), org.orgId)).toMatchObject({
      total: 3,
      used: 0,
      available: 3,
    });
  });
});
