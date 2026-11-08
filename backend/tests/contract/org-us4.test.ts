/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  buildRoleWorld,
  createTestUser,
  endLearnerMembership,
  enrollLearner,
  randomMissingId,
  type RoleWorld,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng + riêng tư US4 (spec 004, T081, quickstart OG4, FR-035, research O13): bảng điều khiển và
// chi tiết học viên khớp OpenAPI 1.12.0; khóa JSON đúng danh sách trắng (thêm khóa mới làm test đỏ); không
// có từng câu trả lời; học viên đã rời lớp → 404 ngay; quyền theo vai trò.

let ctx: TestApp;
let api: ContractClient;
let world: RoleWorld;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  world = await buildRoleWorld(ctx);
});
afterAll(async () => {
  await ctx.close();
});

/** Danh sách trắng khóa của `ClassLearnerRow` (FR-035): đổi spec trước khi thêm khóa mới. */
const ROW_KEYS = [
  'absentDays',
  'alerts',
  'completionRatio',
  'displayName',
  'email',
  'expectedRatio',
  'hasStarted',
  'joinedAt',
  'lastActiveOn',
  'minutesLast7Days',
  'minutesTotal',
  'overrides',
  'pathCompleted',
  'progressStatus',
  'reviewAccuracy',
  'streakDays',
  'userId',
];
const ROW_REQUIRED = [
  'alerts',
  'displayName',
  'email',
  'hasStarted',
  'pathCompleted',
  'progressStatus',
  'userId',
];
/** Danh sách trắng khóa của `ClassLearnerDetail` (FR-035, api-changes §10). */
const DETAIL_KEYS = [
  'assignmentStates',
  'dailyMinutes30',
  'displayName',
  'placement',
  'reviewAccuracy',
  'row',
  'units',
  'userId',
  'weakTopics',
];
const DETAIL_REQUIRED = [
  'assignmentStates',
  'dailyMinutes30',
  'displayName',
  'row',
  'units',
  'userId',
  'weakTopics',
];
/** Khóa tuyệt đối không được xuất hiện ở bất kỳ độ sâu nào: dữ liệu thô của từng câu trả lời và bí mật tài khoản. */
const FORBIDDEN_KEYS = [
  'answers',
  'answer',
  'submittedAnswer',
  'choice',
  'isCorrect',
  'exerciseId',
  'clientEventId',
  'passwordHash',
  'password',
  'refreshToken',
  'sessions',
  'timezone',
  'goalType',
];

function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      collectKeys(v, into);
    }
  }
  return into;
}

const expectKeysWithin = (obj: object, allowed: string[], required: string[]) => {
  const keys = Object.keys(obj);
  expect(keys.filter((k) => !allowed.includes(k))).toEqual([]);
  expect(required.filter((k) => !keys.includes(k))).toEqual([]);
};

describe('GET /classes/{id}/dashboard', () => {
  it('TCH phụ trách: 200, khớp schema ClassDashboard, khóa mỗi dòng đúng danh sách trắng', async () => {
    const res = await api.get(`/classes/${world.classC}/dashboard`, {
      token: world.tokens.TCH!,
    });
    expect(res.status).toBe(200);
    expect(res.body.classId).toBe(world.classC);
    expect(res.body.learners.length).toBeGreaterThanOrEqual(1);
    for (const row of res.body.learners) expectKeysWithin(row, ROW_KEYS, ROW_REQUIRED);
    expect(Object.keys(res.body.summary).sort()).toEqual(
      expect.arrayContaining([
        'ahead',
        'behind',
        'learnerCount',
        'needAttention',
        'onTrack',
        'paused',
      ]),
    );
    // Học viên của lớp là LRN; tên và email đúng, không chứa dữ liệu ngoài danh sách trắng.
    const lrn = res.body.learners.find((r: any) => r.userId === world.users.LRN.userId);
    expect(lrn).toMatchObject({
      displayName: world.users.LRN.displayName,
      email: world.users.LRN.email,
    });
  });

  it('OWN của tổ chức cũng xem được (cùng dữ liệu với TCH)', async () => {
    const [own, tch] = await Promise.all([
      api.get(`/classes/${world.classC}/dashboard`, { token: world.tokens.OWN! }),
      api.get(`/classes/${world.classC}/dashboard`, { token: world.tokens.TCH! }),
    ]);
    expect(own.status).toBe(200);
    expect(own.body.learners.map((r: any) => r.userId)).toEqual(
      tch.body.learners.map((r: any) => r.userId),
    );
  });

  it('không có khóa nào của từng câu trả lời / bí mật tài khoản ở mọi độ sâu', async () => {
    const res = await api.get(`/classes/${world.classC}/dashboard`, {
      token: world.tokens.TCH!,
    });
    const keys = collectKeys(res.body);
    expect(FORBIDDEN_KEYS.filter((k) => keys.has(k))).toEqual([]);
  });

  it.each([
    ['ANON', 401],
    ['USR', 403],
    ['LRN', 403],
    ['TCH0', 403], // giữ vai trò nhưng mất seat ⇒ không còn quyền dữ liệu
    ['ADM', 403], // quản trị hệ thống KHÔNG xem tiến độ chi tiết (FR-002)
    ['TCHx', 404], // giáo viên cùng tổ chức nhưng không phụ trách lớp
    ['OWNb', 404], // tổ chức khác
    ['TCHb', 404],
  ] as const)('vai trò %s ⇒ %i', async (role, status) => {
    const res = await api.get(`/classes/${world.classC}/dashboard`, {
      token: world.tokens[role],
      validateResponse: false,
    });
    expect(res.status).toBe(status);
  });

  it('lớp không tồn tại và lớp của tổ chức khác cho cùng một phản hồi 404 (SC-004)', async () => {
    const [ghost, other] = await Promise.all([
      api.raw('GET', `/classes/${randomMissingId()}/dashboard`, { token: world.tokens.TCH }),
      api.raw('GET', `/classes/${world.classE}/dashboard`, { token: world.tokens.TCH }),
    ]);
    expect(ghost.status).toBe(404);
    expect(other.status).toBe(404);
    expect(other.text).toBe(ghost.text);
  });
});

describe('GET /classes/{id}/members/{userId}/detail', () => {
  const detailPath = (userId: string, classId = world.classC) =>
    `/classes/${classId}/members/${userId}/detail`;

  it('TCH phụ trách: 200, khớp schema ClassLearnerDetail, khóa đúng danh sách trắng', async () => {
    const res = await api.get(detailPath(world.users.LRN.userId), { token: world.tokens.TCH! });
    expect(res.status).toBe(200);
    expectKeysWithin(res.body, DETAIL_KEYS, DETAIL_REQUIRED);
    expectKeysWithin(res.body.row, ROW_KEYS, ROW_REQUIRED);
    expect(res.body).toMatchObject({
      userId: world.users.LRN.userId,
      displayName: world.users.LRN.displayName,
    });
    expect(res.body.units.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.dailyMinutes30)).toBe(true);
    expect(res.body.dailyMinutes30.length).toBeLessThanOrEqual(30);
    // Chi tiết và dòng bảng điều khiển cùng một nguồn số liệu.
    const dash = await api.get(`/classes/${world.classC}/dashboard`, { token: world.tokens.TCH! });
    expect(res.body.row).toEqual(
      dash.body.learners.find((r: any) => r.userId === world.users.LRN.userId),
    );
  });

  it('không có khóa nào của từng câu trả lời / bí mật tài khoản ở mọi độ sâu', async () => {
    const res = await api.get(detailPath(world.users.LRN.userId), { token: world.tokens.OWN! });
    expect(res.status).toBe(200);
    const keys = collectKeys(res.body);
    expect(FORBIDDEN_KEYS.filter((k) => keys.has(k))).toEqual([]);
  });

  it.each([
    ['ANON', 401],
    ['USR', 403],
    ['LRN', 403],
    ['TCH0', 403],
    ['ADM', 403],
    ['TCHx', 404],
    ['OWNb', 404],
  ] as const)('vai trò %s ⇒ %i', async (role, status) => {
    const res = await api.get(detailPath(world.users.LRN.userId), {
      token: world.tokens[role],
      validateResponse: false,
    });
    expect(res.status).toBe(status);
  });

  it('người dùng không phải thành viên lớp (kể cả học viên lớp khác) ⇒ 404 cùng phản hồi với id không tồn tại', async () => {
    const stranger = await createTestUser(ctx);
    const orgB = world.orgB;
    const outsider = await createTestUser(ctx);
    await enrollLearner(ctx, orgB.orgId, world.classE, outsider.userId);
    const [ghost, notMember, otherClass] = await Promise.all([
      api.raw('GET', detailPath(randomMissingId()), { token: world.tokens.TCH }),
      api.raw('GET', detailPath(stranger.userId), { token: world.tokens.TCH }),
      api.raw('GET', detailPath(outsider.userId), { token: world.tokens.TCH }),
    ]);
    expect(ghost.status).toBe(404);
    expect(notMember.text).toBe(ghost.text);
    expect(otherClass.text).toBe(ghost.text);
  });

  it('học viên đã rời/bị gỡ khỏi lớp ⇒ chi tiết 404 ngay và biến mất khỏi bảng điều khiển (SC-008)', async () => {
    const learner = await createTestUser(ctx, { displayName: 'Rời lớp' });
    const { membershipId } = await enrollLearner(
      ctx,
      world.orgA.orgId,
      world.classC,
      learner.userId,
    );
    const before = await api.get(detailPath(learner.userId), { token: world.tokens.TCH! });
    expect(before.status).toBe(200);

    await endLearnerMembership(ctx, world.orgA.orgId, membershipId, 'removed');
    const after = await api.get(detailPath(learner.userId), {
      token: world.tokens.TCH!,
      validateResponse: false,
    });
    expect(after.status).toBe(404);
    const dash = await api.get(`/classes/${world.classC}/dashboard`, { token: world.tokens.TCH! });
    expect(dash.body.learners.map((r: any) => r.userId)).not.toContain(learner.userId);
  });
});
