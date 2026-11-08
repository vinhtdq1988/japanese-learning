import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classMemberships, invitations, seatLicenses } from '../../src/db/schema.js';
import { sweepOrgLapses } from '../../src/jobs/org-lifecycle.js';
import { createInvitation } from '../../src/services/invitations.js';
import { createLicense, setOrganizationStatus } from '../../src/services/org-admin.js';
import { loadOrgContext } from '../../src/services/org-access.js';
import { processOrgLapse } from '../../src/services/org-lifecycle.js';
import { getSeatSummary } from '../../src/services/org-seats.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
} from './org-helpers.js';

// Vòng đời giấy phép (spec 004, T029, FR-006, FR-038, research O3) với Clock giả. Giấy phép thử nghiệm:
// 2026-01-01 → 2026-03-31, ân hạn 7 ngày (hết ân hạn 2026-04-07), ngày theo ORG_TIMEZONE (UTC+7).

let ctx: TestApp;
const deps = () => ctx.app.deps;

beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => {
  await ctx.close();
});

/** Tổ chức có chủ, một giáo viên giữ seat và một học viên trong lớp. */
async function world() {
  setClock('2026-01-10T05:00:00Z');
  const org = await createTestOrg(ctx, {
    seats: 5,
    startsOn: '2026-01-01',
    endsOn: '2026-03-31',
    graceDays: 7,
  });
  const owner = await createTestUser(ctx);
  const teacher = await createTestUser(ctx);
  const learner = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  await enrollLearner(ctx, org.orgId, classId, learner.userId);
  await createInvitation(deps(), {
    organizationId: org.orgId,
    kind: 'teacher',
    email: 'cho-xu-ly@example.com',
    invitedBy: owner.userId,
  });
  return { org, owner, teacher, learner, classId };
}

const setClock = (iso: string) => ctx.clock.set(iso);

describe('trạng thái giấy phép theo ngày', () => {
  it('trước hạn: expiring; quá hạn trong ân hạn: in_grace; vẫn có dataAccess', async () => {
    const w = await world();
    setClock('2026-03-10T05:00:00Z'); // còn 21 ngày → ok (ngưỡng cảnh báo 14 ngày)
    expect((await loadOrgContext(deps(), w.owner.userId))!.licenseState).toBe('ok');
    setClock('2026-03-20T05:00:00Z');
    expect((await loadOrgContext(deps(), w.owner.userId))!.licenseState).toBe('expiring');
    setClock('2026-04-03T05:00:00Z');
    const grace = (await loadOrgContext(deps(), w.teacher.userId))!;
    expect(grace.licenseState).toBe('in_grace');
    expect(grace.dataAccess).toBe(true);
    expect(grace.licenseGraceEndsOn).toBe('2026-04-07');
  });
});

describe('processOrgLapse', () => {
  it('hết ân hạn: giải phóng seat, đóng thành viên, hủy lời mời; giáo viên giữ vai trò nhưng mất dataAccess', async () => {
    const w = await world();
    setClock('2026-04-08T05:00:00Z');
    const teacherCtx = (await loadOrgContext(deps(), w.teacher.userId))!; // xử lý LƯỜI ngay khi truy cập
    expect(teacherCtx).toMatchObject({ isTeacher: true, hasSeat: false, dataAccess: false });
    expect(teacherCtx.licenseState).toBe('lapsed');

    expect((await getSeatSummary(deps(), w.org.orgId)).used).toBe(0);
    const [m] = await ctx.handle.db
      .select()
      .from(classMemberships)
      .where(eq(classMemberships.userId, w.learner.userId));
    expect(m!.endReason).toBe('seat_expired');
    expect(m!.leftAt).not.toBeNull();
    const pending = await ctx.handle.db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, w.org.orgId));
    expect(pending.every((i) => i.status !== 'pending')).toBe(true);
    const [license] = await ctx.handle.db
      .select()
      .from(seatLicenses)
      .where(eq(seatLicenses.id, w.org.licenseId!));
    expect(license!.lapseProcessedAt).not.toBeNull();
    // Học viên không còn dòng organization_members (không còn vai trò).
    expect(await loadOrgContext(deps(), w.learner.userId)).toBeNull();
  });

  it('idempotent: gọi hai lần không đổi gì thêm', async () => {
    const w = await world();
    setClock('2026-04-08T05:00:00Z');
    await ctx.handle.db.transaction((tx) =>
      processOrgLapse(tx, deps(), w.org.orgId, 'seat_expired'),
    );
    const [first] = await ctx.handle.db
      .select()
      .from(seatLicenses)
      .where(eq(seatLicenses.id, w.org.licenseId!));
    await ctx.handle.db.transaction((tx) =>
      processOrgLapse(tx, deps(), w.org.orgId, 'seat_expired'),
    );
    const [second] = await ctx.handle.db
      .select()
      .from(seatLicenses)
      .where(eq(seatLicenses.id, w.org.licenseId!));
    expect(second!.lapseProcessedAt).toEqual(first!.lapseProcessedAt);
    expect((await getSeatSummary(deps(), w.org.orgId)).used).toBe(0);
  });

  it('job quét xử lý tổ chức quá hạn không ai truy cập', async () => {
    const w = await world();
    setClock('2026-04-09T05:00:00Z');
    const processed = await sweepOrgLapses(deps());
    expect(processed).toBeGreaterThanOrEqual(1);
    const [m] = await ctx.handle.db
      .select()
      .from(classMemberships)
      .where(eq(classMemberships.userId, w.learner.userId));
    expect(m!.endReason).toBe('seat_expired');
    expect(await sweepOrgLapses(deps())).toBe(0); // lần hai không còn gì để xử lý
  });

  it('vô hiệu hóa tổ chức cho cùng kết quả (org_disabled) và bật lại không tự mời lại học viên', async () => {
    const w = await world();
    setClock('2026-02-01T05:00:00Z');
    await setOrganizationStatus(deps(), null, w.org.orgId, 'disabled');
    const ctxTeacher = (await loadOrgContext(deps(), w.teacher.userId))!;
    expect(ctxTeacher).toMatchObject({ orgActive: false, dataAccess: false, hasSeat: false });
    const [m] = await ctx.handle.db
      .select()
      .from(classMemberships)
      .where(eq(classMemberships.userId, w.learner.userId));
    expect(m!.endReason).toBe('org_disabled');

    await setOrganizationStatus(deps(), null, w.org.orgId, 'active');
    expect((await loadOrgContext(deps(), w.owner.userId))!.dataAccess).toBe(true);
    expect(await loadOrgContext(deps(), w.learner.userId)).toBeNull();
  });
});

describe('gia hạn và giấy phép mới', () => {
  it('kéo dài ends_on trước khi hết hạn giữ nguyên người giữ seat', async () => {
    const w = await world();
    setClock('2026-03-25T05:00:00Z');
    await ctx.handle.db
      .update(seatLicenses)
      .set({ endsOn: '2026-12-31' })
      .where(eq(seatLicenses.id, w.org.licenseId!));
    setClock('2026-05-01T05:00:00Z');
    const teacherCtx = (await loadOrgContext(deps(), w.teacher.userId))!;
    expect(teacherCtx).toMatchObject({ hasSeat: true, dataAccess: true, licenseState: 'ok' });
    const [m] = await ctx.handle.db
      .select()
      .from(classMemberships)
      .where(eq(classMemberships.userId, w.learner.userId));
    expect(m!.leftAt).toBeNull();
  });

  it('giấy phép mới sau khi đã lapse cấp lại seat cho giáo viên theo thứ tự mời', async () => {
    const w = await world();
    ctx.clock.advanceMinutes(10); // `second` được thêm SAU nên đứng sau trong thứ tự mời
    const second = await createTestUser(ctx);
    await addOrgRole(ctx, w.org.orgId, second.userId, { teacher: true });
    setClock('2026-04-10T05:00:00Z');
    await loadOrgContext(deps(), w.owner.userId); // kích hoạt xử lý lười: mọi seat được giải phóng
    expect((await getSeatSummary(deps(), w.org.orgId)).used).toBe(0);

    await createLicense(deps(), null, w.org.orgId, {
      seats: 1,
      startsOn: '2026-04-10',
      endsOn: '2027-04-09',
    });
    // Chỉ một seat: giáo viên được mời trước (joined_at sớm hơn) nhận seat.
    expect((await loadOrgContext(deps(), w.teacher.userId))!.hasSeat).toBe(true);
    expect((await loadOrgContext(deps(), second.userId))!.hasSeat).toBe(false);
  });
});
