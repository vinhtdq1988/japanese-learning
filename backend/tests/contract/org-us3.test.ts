/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { onboardedLearner } from '../integration/lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  tokenFor,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US3 (spec 004, T066, quickstart OG3): lộ trình lớp theo mẫu, `Me.learningSource` /
// `classSummary.lockedFields`, `GET /path` có `source`, người học không thuộc lớp chỉ thêm `learningSource`.
// Phản hồi được đối chiếu với OpenAPI 1.12.0.

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

async function setup(withPath = true) {
  const org = await createTestOrg(ctx, { seats: 5 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    teacherIds: [teacher.userId],
    withPath,
  });
  return { org, teacher, classId, token: await tokenFor(ctx, teacher) };
}

const template = (over: Record<string, unknown> = {}) => ({
  startLevel: 'N5',
  targetLevel: 'N4',
  skills: ['vocabulary', 'grammar'],
  startsOn: '2026-01-05',
  endsOn: '2026-06-30',
  dailyMinutes: 10,
  ...over,
});

describe('GET /classes/{id}/path', () => {
  it('path: null khi lớp chưa có lộ trình', async () => {
    const { classId, token } = await setup(false);
    const res = await api.get(`/classes/${classId}/path`, { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ path: null });
  });

  it('trả ClassPath ở chế độ mẫu kèm thứ tự tham khảo, không bài giao, không cảnh báo khi đủ sức chứa', async () => {
    const { classId, token } = await setup(true);
    const res = await api.get(`/classes/${classId}/path`, { token });
    expect(res.status).toBe(200);
    const path = res.body.path;
    expect(path).toMatchObject({
      startLevel: 'N5',
      targetLevel: 'N4',
      skills: ['vocabulary', 'grammar'],
      dailyMinutes: 10,
      mode: 'template',
      assignments: [],
      contentNotices: [],
    });
    expect(path.units.length).toBeGreaterThan(0);
    expect(path.units.map((u: any) => u.position)).toEqual(
      path.units.map((_: unknown, i: number) => i + 1),
    );
    expect(path.warnings).toEqual([]);
  });
});

describe('PUT /classes/{id}/path', () => {
  it('tạo lộ trình cho lớp chưa có; sau đó mời học viên được (hết CLASS_NOT_READY)', async () => {
    const { classId, token } = await setup(false);
    const before = await api.post(`/classes/${classId}/invitations`, {
      token,
      body: { invitees: [{ email: 'cho@example.com' }] },
    });
    expect(before.status).toBe(409);
    const put = await api.put(`/classes/${classId}/path`, { token, body: template() });
    expect(put.status).toBe(200);
    expect(put.body.mode).toBe('template');
    const after = await api.post(`/classes/${classId}/invitations`, {
      token,
      body: { invitees: [{ email: 'cho@example.com' }] },
    });
    expect(after.status).toBe(200);
  });

  it('sửa lộ trình: có hiệu lực ở lần đọc kế tiếp, dòng duy nhất trong CSDL (không có thao tác xóa)', async () => {
    const { classId, token } = await setup(true);
    const put = await api.put(`/classes/${classId}/path`, {
      token,
      body: template({ dailyMinutes: 15, skills: ['grammar'] }),
    });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ dailyMinutes: 15, skills: ['grammar'] });
    const got = await api.get(`/classes/${classId}/path`, { token });
    expect(got.body.path).toMatchObject({ dailyMinutes: 15, skills: ['grammar'] });
    const { rows } = await ctx.handle.pool.query(
      'SELECT count(*)::int AS n FROM class_paths WHERE class_id = $1',
      [classId],
    );
    expect(rows[0].n).toBe(1);
    // Không có thao tác xóa lộ trình.
    const del = await api.raw('DELETE', `/classes/${classId}/path`, { token });
    expect([404, 405]).toContain(del.status);
  });

  it('mốc quá chặt ⇒ 200 kèm warnings over_capacity (không chặn lưu)', async () => {
    const { classId, token } = await setup(true);
    const put = await api.put(`/classes/${classId}/path`, {
      token,
      body: template({ dailyMinutes: 5, startsOn: '2026-01-05', endsOn: '2026-01-07' }),
    });
    expect(put.status).toBe(200);
    expect(put.body.warnings).toEqual([
      expect.objectContaining({ code: 'over_capacity', capacityMinutes: 15 }),
    ]);
    expect(put.body.warnings[0].requiredMinutes).toBeGreaterThan(15);
  });

  it('đích N2/N1 ⇒ scopeNotice content_ceiling_n3', async () => {
    const { classId, token } = await setup(true);
    const put = await api.put(`/classes/${classId}/path`, {
      token,
      body: template({ targetLevel: 'N2' }),
    });
    expect(put.status).toBe(200);
    expect(put.body.scopeNotice).toBe('content_ceiling_n3');
  });

  it.each([
    ['endsOn không sau startsOn', { endsOn: '2026-01-05' }, 'endsOn'],
    ['dailyMinutes ngoài 5/10/15/30', { dailyMinutes: 7 }, 'dailyMinutes'],
    ['skills rỗng', { skills: [] }, 'skills'],
    ['skills trùng nhau', { skills: ['grammar', 'grammar'] }, 'skills'],
    ['trình độ sai', { startLevel: 'N9' }, 'startLevel'],
  ])('422 và KHÔNG đổi gì: %s', async (_name, over, field) => {
    const { classId, token } = await setup(true);
    const before = (await api.get(`/classes/${classId}/path`, { token })).body.path;
    const res = await api.put(`/classes/${classId}/path`, {
      token,
      body: template(over),
      validateRequest: false,
    });
    expect(res.status).toBe(422);
    expect(res.body.fields).toHaveProperty(field);
    const after = (await api.get(`/classes/${classId}/path`, { token })).body.path;
    expect(after).toEqual(before);
  });

  it('lớp lưu trữ ⇒ 409 CLASS_ARCHIVED', async () => {
    const { classId, token } = await setup(true);
    await api.post(`/classes/${classId}/archive`, { token, body: { confirm: true } });
    const res = await api.put(`/classes/${classId}/path`, { token, body: template() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_ARCHIVED');
  });
});

describe('GET /me, GET /path khi thuộc lớp', () => {
  it('GET /me có learningSource và classSummary.lockedFields; GET /path có source', async () => {
    const { org, classId } = await setup(true);
    const learner = await onboardedLearner(api, ctx);
    const personalMe = await api.get('/me', { token: learner.token });
    expect(personalMe.body.learningSource).toBe('personal');
    expect(personalMe.body.classSummary).toBeUndefined();
    const personalPath = await api.get('/path', { token: learner.token });
    expect(personalPath.body.source).toBe('personal');

    const invitation = await createTestInvitation(ctx, org.orgId, {
      kind: 'student',
      email: learner.user.email,
      classId,
    });
    await api.post(`/invitations/${invitation.token}/respond`, {
      token: learner.token,
      body: { decision: 'join_class', confirmed: true },
    });

    const me = await api.get('/me', { token: learner.token });
    expect(me.body.learningSource).toBe('class');
    expect(me.body.classSummary).toMatchObject({ classId, organizationName: expect.any(String) });
    expect(me.body.classSummary.lockedFields).toEqual(
      expect.arrayContaining(['dailyMinutes', 'skills', 'goalType', 'targetDate']),
    );
    const path = await api.get('/path', { token: learner.token });
    expect(path.body.source).toBe('class');
  });

  it('người học không thuộc lớp: phản hồi /me cũ chỉ thêm learningSource: personal', async () => {
    const learner = await onboardedLearner(api, ctx);
    const me = await api.get('/me', { token: learner.token });
    expect(Object.keys(me.body).sort()).toEqual(
      ['email', 'id', 'learningSource', 'profile', 'role', 'status'].sort(),
    );
    expect(me.body.learningSource).toBe('personal');
  });
});
