/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setOrganizationStatus } from '../../src/services/org-admin.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  advanceDays,
  finishPlanItem,
  onboardedLearner,
  query,
  type Learner,
} from './lesson-helpers.js';
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

// Vòng đời thành viên lớp (spec 004, T102, FR-037, FR-004, FR-016, SC-008, research O6, O15): với MỖI nguyên
// nhân kết thúc, tổ chức mất quyền xem NGAY bằng cùng access token, seat được giải phóng, thành viên đóng đúng
// `end_reason` và lịch sử học KHÔNG đổi byte nào.

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

const HISTORY_TABLES = [
  'study_records',
  'review_schedules',
  'unit_progress',
  'daily_plans',
] as const;

/** Ảnh chụp toàn bộ lịch sử học của một người (mỗi dòng ở dạng văn bản để so sánh từng byte). */
async function historySnapshot(userId: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const table of HISTORY_TABLES) {
    const rows = await sql<{ r: string }>(
      `SELECT t::text AS r FROM ${table} t WHERE t.user_id = $1 ORDER BY t::text`,
      [userId],
    );
    out[table] = rows.map((row) => row.r);
  }
  return out;
}

/** Vào lớp qua luồng thật (lời mời + xác nhận) để kế hoạch hôm nay đổi sang nguồn lớp như học viên thật. */
async function joinViaInvitation(
  orgId: string,
  classId: string,
  learner: Learner,
): Promise<string> {
  const invitation = await createTestInvitation(ctx, orgId, {
    kind: 'student',
    email: learner.user.email,
    classId,
  });
  const res = await api.post(`/invitations/${invitation.token}/respond`, {
    token: learner.token,
    body: { decision: 'join_class', confirmed: true },
  });
  expect(res.status).toBe(200);
  const [membership] = await sql<{ id: string }>(
    'SELECT id FROM class_memberships WHERE user_id = $1 AND left_at IS NULL',
    [learner.userId],
  );
  return membership!.id;
}

interface World {
  orgId: string;
  classId: string;
  licenseId: string;
  owner: TestUser;
  teacher: TestUser;
  ownerToken: string;
  teacherToken: string;
  learner: Learner;
  membershipId: string;
}

/**
 * Tổ chức có chủ + giáo viên + lớp; một học viên đã onboarding cá nhân, vào lớp, đã học một mục (có bản ghi
 * học, lịch ôn, tiến độ và kế hoạch đã có mục hoàn thành). Giấy phép kết thúc 2026-01-10, không ân hạn.
 */
async function world(): Promise<World> {
  ctx.clock.set('2026-01-05T08:00:00Z');
  const org = await createTestOrg(ctx, {
    seats: 6,
    startsOn: '2026-01-01',
    endsOn: '2026-01-10',
    graceDays: 0,
  });
  const owner = await createTestUser(ctx);
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const learner = await onboardedLearner(api, ctx);
  const membershipId = await joinViaInvitation(org.orgId, classId, learner);
  const plan = (await api.get('/today', { token: learner.token })).body;
  const newUnit = plan.items.find((i: any) => i.type === 'new_unit');
  expect(newUnit, 'kế hoạch lớp phải có bài mới').toBeDefined();
  await finishPlanItem(api, ctx, learner, newUnit.id);
  return {
    orgId: org.orgId,
    classId,
    licenseId: org.licenseId!,
    owner,
    teacher,
    ownerToken: await tokenFor(ctx, owner),
    teacherToken: await tokenFor(ctx, teacher),
    learner,
    membershipId,
  };
}

const detailUrl = (w: World) => `/classes/${w.classId}/members/${w.learner.userId}/detail`;

type Cause =
  | 'switched_personal'
  | 'removed'
  | 'seat_revoked'
  | 'seat_expired'
  | 'org_disabled'
  | 'class_archived'
  | 'account_deleted';

async function applyCause(cause: Cause, w: World): Promise<void> {
  switch (cause) {
    case 'switched_personal': {
      const res = await api.post('/me/class/leave', {
        token: w.learner.token,
        body: { confirm: true },
      });
      expect(res.status).toBe(204);
      return;
    }
    case 'removed': {
      const res = await api.delete(`/classes/${w.classId}/members/${w.learner.userId}`, {
        token: w.teacherToken,
      });
      expect(res.status).toBe(204);
      return;
    }
    case 'seat_revoked': {
      const res = await api.post(`/org/seats/${w.learner.userId}/revoke`, { token: w.ownerToken });
      expect(res.status).toBe(204);
      return;
    }
    case 'seat_expired':
      // Giấy phép quá hạn (không ân hạn) mà KHÔNG tiến đồng hồ để giữ nguyên access token đang mở.
      await sql(`UPDATE seat_licenses SET ends_on = '2026-01-03' WHERE id = $1`, [w.licenseId]);
      return;
    case 'org_disabled':
      await setOrganizationStatus(ctx.app.deps, null, w.orgId, 'disabled');
      return;
    case 'class_archived': {
      const res = await api.post(`/classes/${w.classId}/archive`, {
        token: w.teacherToken,
        body: { confirm: true },
      });
      expect(res.status).toBe(200);
      return;
    }
    case 'account_deleted': {
      const res = await api.post('/account/delete', {
        token: w.learner.token,
        body: { password: w.learner.user.password },
      });
      expect(res.status).toBe(200);
    }
  }
}

/** Nguyên nhân làm mất quyền của CẢ tổ chức: vai trò còn nhưng không còn quyền xem dữ liệu ⇒ 403 thay vì 404. */
const ORG_WIDE: Cause[] = ['seat_expired', 'org_disabled'];

const CAUSES: Cause[] = [
  'switched_personal',
  'removed',
  'seat_revoked',
  'seat_expired',
  'org_disabled',
  'class_archived',
  'account_deleted',
];

describe('mỗi nguyên nhân kết thúc thành viên (SC-008)', () => {
  it.each(CAUSES)(
    '%s: cùng token ⇒ mất quyền xem ngay, seat giải phóng, đóng đúng end_reason, lịch sử nguyên vẹn',
    async (cause) => {
      const w = await world();
      const [profile] = await sql<{ display_name: string }>(
        'SELECT display_name FROM learning_profiles WHERE user_id = $1',
        [w.learner.userId],
      );
      // Trước khi kết thúc: cả giáo viên lẫn chủ tổ chức đều xem được chi tiết bằng chính token này.
      for (const token of [w.teacherToken, w.ownerToken]) {
        expect((await api.raw('GET', detailUrl(w), { token })).status).toBe(200);
      }
      const before = await historySnapshot(w.learner.userId);
      expect(before.study_records!.length).toBeGreaterThan(0);
      expect(before.unit_progress!.length).toBeGreaterThan(0);

      await applyCause(cause, w);

      for (const token of [w.teacherToken, w.ownerToken]) {
        const after = await api.raw('GET', detailUrl(w), { token });
        if (ORG_WIDE.includes(cause)) {
          // Vai trò còn nhưng tổ chức hết hiệu lực: `requireDataAccess` từ chối bằng 403 (permissions-matrix §3.2).
          expect([403, 404], `${cause}: ${after.text}`).toContain(after.status);
        } else {
          expect(after.status, `${cause}: ${after.text}`).toBe(404);
        }
        expect(after.text).not.toContain(profile!.display_name);
      }

      const memberships = await sql(
        'SELECT * FROM class_memberships WHERE user_id = $1 ORDER BY joined_at',
        [w.learner.userId],
      );
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        id: w.membershipId,
        end_reason: cause,
        seat_id: null,
        exit_display_name: profile!.display_name,
      });
      expect(memberships[0].left_at).not.toBeNull();
      expect(
        await sql('SELECT 1 FROM seats WHERE holder_user_id = $1', [w.learner.userId]),
      ).toHaveLength(0);
      expect(
        await sql('SELECT 1 FROM organization_members WHERE user_id = $1', [w.learner.userId]),
      ).toHaveLength(0);

      // Lịch sử học không đổi một byte nào (FR-037).
      expect(await historySnapshot(w.learner.userId)).toEqual(before);
    },
  );
});

describe('kế hoạch hôm nay khi nguồn học đổi', () => {
  it('mọi mục còn pending ⇒ kế hoạch hôm nay bị xóa để sinh lại theo lộ trình cá nhân', async () => {
    ctx.clock.set('2026-01-05T08:00:00Z');
    const org = await createTestOrg(ctx, { seats: 3 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, {
      teacherIds: [teacher.userId],
      dailyMinutes: 5,
    });
    const learner = await onboardedLearner(api, ctx); // cá nhân 10 phút/ngày
    await joinViaInvitation(org.orgId, classId, learner);
    const classPlan = (await api.get('/today', { token: learner.token })).body;
    expect(classPlan.budgetMinutes).toBe(5);

    await api.post('/me/class/leave', { token: learner.token, body: { confirm: true } });
    expect(
      await sql('SELECT 1 FROM daily_plans WHERE user_id = $1', [learner.userId]),
    ).toHaveLength(0);
    const personal = (await api.get('/today', { token: learner.token })).body;
    expect(personal.budgetMinutes).toBe(10);
    expect(personal.id).not.toBe(classPlan.id);
  });
});

describe('quay về lộ trình cá nhân', () => {
  it('lộ trình cá nhân được khôi phục cùng mọi quyền điều chỉnh (hết CLASS_MANAGED)', async () => {
    const w = await world();
    const locked = await api.patch('/me', {
      token: w.learner.token,
      body: { dailyMinutes: 15 },
      validateResponse: false,
    });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('CLASS_MANAGED');

    await applyCause('switched_personal', w);
    const me = (await api.get('/me', { token: w.learner.token })).body;
    expect(me.learningSource).toBe('personal');
    expect(me.classSummary).toBeUndefined();
    expect(me.profile.dailyMinutes).toBe(10);

    const patched = await api.patch('/me', { token: w.learner.token, body: { dailyMinutes: 15 } });
    expect(patched.status).toBe(200);
    expect(patched.body.profile.dailyMinutes).toBe(15);
    expect((await api.post('/path/pause', { token: w.learner.token })).status).toBe(204);
    expect((await api.post('/path/resume', { token: w.learner.token })).status).toBe(204);
    expect((await api.get('/path', { token: w.learner.token })).body.source).toBe('personal');
  });

  it('người chưa từng có hồ sơ cá nhân: rời lớp ⇒ trạng thái onboarding vẫn chưa bắt đầu để đi qua onboarding cá nhân', async () => {
    ctx.clock.set('2026-01-05T08:00:00Z');
    const org = await createTestOrg(ctx, { seats: 3 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
    const newcomer = await createTestUser(ctx);
    await enrollLearner(ctx, org.orgId, classId, newcomer.userId);
    const token = await tokenFor(ctx, newcomer);
    expect((await api.get('/today', { token })).status).toBe(200);

    await api.post('/me/class/leave', { token, body: { confirm: true } });
    const me = (await api.get('/me', { token })).body;
    expect(me.learningSource).toBe('personal');
    expect(me.profile.onboardingState).toBe('not_started');
    expect((await api.get('/today', { token, validateResponse: false })).status).toBe(404);
  });
});

describe('vào lại lớp', () => {
  it('đơn vị đã hoàn thành trước đó (kể cả khi học cá nhân) tính hoàn thành; quay lại cùng seat không tăng reassignment_count', async () => {
    const w = await world();
    const completedIn = async (): Promise<Set<string>> => {
      const path = (await api.get('/path', { token: w.learner.token })).body;
      return new Set(
        path.items
          .filter((i: any) => i.status === 'completed' || i.status === 'mastered')
          .map((i: any) => i.unitId as string),
      );
    };
    const first = await completedIn();
    expect(first.size).toBeGreaterThan(0);
    const [seatBefore] = await sql<{ id: string }>(
      'SELECT id FROM seats WHERE holder_user_id = $1',
      [w.learner.userId],
    );

    await applyCause('switched_personal', w);
    // Sang ngày sau để kế hoạch cá nhân có bài mới, rồi học thêm một bài khi đang ở lộ trình cá nhân.
    await advanceDays(api, ctx, w.learner);
    const personalPlan = (await api.get('/today', { token: w.learner.token })).body;
    const personalUnit = personalPlan.items.find((i: any) => i.type === 'new_unit');
    expect(personalUnit).toBeDefined();
    await finishPlanItem(api, ctx, w.learner, personalUnit.id);
    const learnedPersonally = await sql<{ unit_id: string }>(
      `SELECT unit_id FROM unit_progress WHERE user_id = $1 AND status IN ('completed','mastered')`,
      [w.learner.userId],
    );
    expect(learnedPersonally.length).toBeGreaterThan(first.size);

    // Được mời lại và xác nhận lại (FR-016): thành viên mới, đồng ý mới.
    const invitation = await createTestInvitation(ctx, w.orgId, {
      kind: 'student',
      email: w.learner.user.email,
      classId: w.classId,
    });
    const joined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: w.learner.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);

    const second = await completedIn();
    for (const id of first) expect(second.has(id)).toBe(true);
    for (const row of learnedPersonally) {
      const inClass = (await api.get('/path', { token: w.learner.token })).body.items.some(
        (i: any) => i.unitId === row.unit_id,
      );
      // Đơn vị học khi ở cá nhân mà thuộc lộ trình lớp thì tính hoàn thành khi vào lại.
      if (inClass) expect(second.has(row.unit_id)).toBe(true);
    }
    expect(second.size).toBeGreaterThan(first.size - 1);

    const [seatAfter] = await sql<{ id: string; reassignment_count: number }>(
      'SELECT id, reassignment_count FROM seats WHERE holder_user_id = $1',
      [w.learner.userId],
    );
    expect(seatAfter!.id).toBe(seatBefore!.id);
    expect(
      (
        await sql<{ n: number }>('SELECT COALESCE(SUM(reassignment_count),0)::int AS n FROM seats')
      )[0]!.n,
    ).toBe(0);
    const memberships = await sql(
      'SELECT consent_at, left_at FROM class_memberships WHERE user_id = $1 ORDER BY joined_at',
      [w.learner.userId],
    );
    expect(memberships).toHaveLength(2);
    expect(memberships[0].left_at).not.toBeNull();
    expect(memberships[1].left_at).toBeNull();
  });
});

describe('tài khoản vừa là giáo viên vừa là học viên (FR-004)', () => {
  interface DualWorld {
    orgId: string;
    owner: TestUser;
    ownerToken: string;
    dual: TestUser;
    dualToken: string;
    teacherOfD: TestUser;
    teacherDToken: string;
    classC: string;
    classD: string;
  }

  /** `dual` phụ trách lớp C và là học viên lớp D (do `teacherOfD` phụ trách): MỘT seat cho cả hai vai trò. */
  async function dualWorld(): Promise<DualWorld> {
    ctx.clock.set('2026-01-05T08:00:00Z');
    const org = await createTestOrg(ctx, { seats: 4 });
    const [owner, dual, teacherOfD] = [
      await createTestUser(ctx),
      await createTestUser(ctx),
      await createTestUser(ctx),
    ];
    await addOrgRole(ctx, org.orgId, owner.userId, { owner: true });
    await addOrgRole(ctx, org.orgId, dual.userId, { teacher: true });
    await addOrgRole(ctx, org.orgId, teacherOfD.userId, { teacher: true });
    const { classId: classC } = await createTestClass(ctx, org.orgId, {
      teacherIds: [dual.userId],
    });
    const { classId: classD } = await createTestClass(ctx, org.orgId, {
      teacherIds: [teacherOfD.userId],
    });
    await enrollLearner(ctx, org.orgId, classD, dual.userId);
    return {
      orgId: org.orgId,
      owner,
      ownerToken: await tokenFor(ctx, owner),
      dual,
      dualToken: await tokenFor(ctx, dual),
      teacherOfD,
      teacherDToken: await tokenFor(ctx, teacherOfD),
      classC,
      classD,
    };
  }

  const holdsSeat = async (userId: string) =>
    (await sql('SELECT 1 FROM seats WHERE holder_user_id = $1', [userId])).length === 1;
  const hasOrgRow = async (userId: string) =>
    (await sql('SELECT 1 FROM organization_members WHERE user_id = $1', [userId])).length === 1;

  it('một seat cho cả hai vai trò: vào lớp D không tốn thêm seat', async () => {
    const d = await dualWorld();
    expect(await holdsSeat(d.dual.userId)).toBe(true);
    const org = (await api.get('/org', { token: d.ownerToken })).body;
    expect(org.seats).toMatchObject({ used: 2 }); // dual + teacherOfD
  });

  it.each(['tự rời lớp', 'bị gỡ khỏi lớp', 'lớp bị lưu trữ'])(
    '%s ⇒ vẫn giữ seat và dòng organization_members (còn là giáo viên)',
    async (how) => {
      const d = await dualWorld();
      if (how === 'tự rời lớp') {
        await api.post('/me/class/leave', { token: d.dualToken, body: { confirm: true } });
      } else if (how === 'bị gỡ khỏi lớp') {
        await api.delete(`/classes/${d.classD}/members/${d.dual.userId}`, {
          token: d.teacherDToken,
        });
      } else {
        await api.post(`/classes/${d.classD}/archive`, {
          token: d.teacherDToken,
          body: { confirm: true },
        });
      }
      expect(
        (
          await sql('SELECT 1 FROM class_memberships WHERE user_id = $1 AND left_at IS NULL', [
            d.dual.userId,
          ])
        ).length,
      ).toBe(0);
      expect(await holdsSeat(d.dual.userId)).toBe(true);
      expect(await hasOrgRow(d.dual.userId)).toBe(true);
      // Vẫn quản lý được lớp C.
      expect((await api.get(`/classes/${d.classC}`, { token: d.dualToken })).status).toBe(200);
    },
  );

  it('bị gỡ vai trò giáo viên khi còn ở lớp D ⇒ vẫn giữ seat; rời lớp D (mất cả hai vai trò) ⇒ mới giải phóng', async () => {
    const d = await dualWorld();
    const removed = await api.delete(`/org/teachers/${d.dual.userId}`, { token: d.ownerToken });
    expect(removed.status).toBe(204);
    expect(await holdsSeat(d.dual.userId)).toBe(true);
    expect(await hasOrgRow(d.dual.userId)).toBe(true);
    // Mất quyền quản lý lớp C ngay bằng cùng token.
    expect((await api.raw('GET', `/classes/${d.classC}`, { token: d.dualToken })).status).not.toBe(
      200,
    );
    // Vẫn là học viên lớp D.
    expect((await api.get('/me/class', { token: d.dualToken })).status).toBe(200);

    await api.post('/me/class/leave', { token: d.dualToken, body: { confirm: true } });
    expect(await holdsSeat(d.dual.userId)).toBe(false);
    expect(await hasOrgRow(d.dual.userId)).toBe(false);
  });
});
