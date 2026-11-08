import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLASS_LOCKED_PROFILE_FIELDS } from '../../src/domain/org-types.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { onboardedLearner, type Learner } from './lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
  tokenFor,
} from './org-helpers.js';

// Khóa quyền kiểm soát khi thuộc lớp (spec 004, T064, FR-018, research O8): máy chủ từ chối mọi thao tác đổi
// mục tiêu/thời gian/kỹ năng/lộ trình bằng 409 `CLASS_MANAGED` kèm `fields`, ở TẦNG DỊCH VỤ; các thao tác khác
// (tên, ngôn ngữ, múi giờ, tiến độ, hôm nay, học thêm) vẫn dùng được.

let ctx: TestApp;
let api: ContractClient;
let learner: Learner;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);

  const org = await createTestOrg(ctx, { seats: 4 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });

  // Người học đã onboarding cá nhân rồi vào lớp bằng luồng thật (lời mời + xác nhận).
  learner = await onboardedLearner(api, ctx);
  const invitation = await createTestInvitation(ctx, org.orgId, {
    kind: 'student',
    email: learner.user.email,
    classId,
  });
  const joined = await api.post(`/invitations/${invitation.token}/respond`, {
    token: learner.token,
    body: { decision: 'join_class', confirmed: true },
  });
  expect(joined.status).toBe(200);
});
afterAll(async () => {
  await ctx.close();
});

const call = (method: string, url: string, body?: unknown) =>
  api.call(method, url, {
    token: learner.token,
    body,
    validateRequest: false,
    validateResponse: false,
  });

describe('thao tác bị khóa → 409 CLASS_MANAGED kèm fields', () => {
  const lockedPatches: [string, Record<string, unknown>][] = [
    ['dailyMinutes', { dailyMinutes: 15 }],
    ['skills', { skills: ['vocabulary'] }],
    ['prioritizedSkill', { prioritizedSkill: 'grammar' }],
    ['currentLevel', { currentLevel: 'N4' }],
    ['goalType', { goalType: 'daily_conversation' }],
    ['targetLevel', { goalType: 'jlpt', targetLevel: 'N4' }],
    ['targetDate', { targetDate: '2026-12-31' }],
  ];

  it('danh sách trường khóa của hợp đồng khớp CLASS_LOCKED_PROFILE_FIELDS', () => {
    expect(lockedPatches.map(([f]) => f).sort()).toEqual([...CLASS_LOCKED_PROFILE_FIELDS].sort());
  });

  it.each(lockedPatches)('PATCH /me %s', async (field, body) => {
    const res = await call('patch', '/me', body);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_MANAGED');
    expect(res.body.fields).toHaveProperty(Object.keys(body)[0]!);
    expect(res.body.message).toContain('lớp quyết định');
    void field;
  });

  it('PUT /onboarding và POST /onboarding/complete', async () => {
    const draft = await call('put', '/onboarding', { dailyMinutes: 15 });
    expect(draft.status).toBe(409);
    expect(draft.body.code).toBe('CLASS_MANAGED');
    const complete = await call('post', '/onboarding/complete', {
      currentLevel: 'none',
      goalType: 'daily_conversation',
      dailyMinutes: 10,
      skills: ['vocabulary'],
    });
    expect(complete.status).toBe(409);
    expect(complete.body.code).toBe('CLASS_MANAGED');
    // Mọi trường lộ trình được liệt kê trong `fields`.
    for (const f of CLASS_LOCKED_PROFILE_FIELDS) expect(complete.body.fields).toHaveProperty(f);
  });

  it.each([
    ['post', '/path/pause', undefined],
    ['post', '/path/resume', undefined],
    ['post', '/path/rebuild', {}],
    ['put', `/path/units/${randomUUID()}/master`, { mastered: true }],
    ['put', `/path/items/${randomUUID()}/master`, { mastered: true }],
  ])('%s %s', async (method, url, body) => {
    const res = await call(method, url, body);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_MANAGED');
  });

  it('POST /placement/submit (không classRequestId)', async () => {
    const res = await call('post', '/placement/submit', {
      answers: [{ questionId: randomUUID(), choice: 0 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_MANAGED');
  });

  it('hồ sơ cá nhân không bị đổi sau các lần thử bị từ chối', async () => {
    const { rows } = await ctx.handle.pool.query(
      'SELECT daily_minutes, skills::text[] AS skills, onboarding_state FROM learning_profiles WHERE user_id = $1',
      [learner.userId],
    );
    expect(rows[0]).toMatchObject({ daily_minutes: 10, onboarding_state: 'completed' });
    expect(rows[0].skills).toEqual(['vocabulary', 'grammar']);
  });
});

describe('thao tác vẫn được phép khi thuộc lớp', () => {
  it('PATCH /me displayName, language, timezone', async () => {
    const res = await call('patch', '/me', {
      displayName: 'Tên mới',
      language: 'en',
      timezone: 'Asia/Tokyo',
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      displayName: 'Tên mới',
      language: 'en',
      timezone: 'Asia/Tokyo',
    });
    // Trả lại múi giờ/ngôn ngữ để các kiểm thử sau không phụ thuộc thứ tự.
    await call('patch', '/me', { language: 'vi', timezone: 'Asia/Ho_Chi_Minh' });
  });

  it('GET /progress, GET /today, POST /today/extra không bị khóa', async () => {
    expect((await call('get', '/progress')).status).toBe(200);
    expect((await call('get', '/today')).status).toBe(200);
    const extra = await call('post', '/today/extra');
    expect([200, 404]).toContain(extra.status);
    if (extra.status === 404) expect(extra.body.code).toBe('CONTENT_EXHAUSTED');
  });

  it('đổi mật khẩu không bị khóa (sai mật khẩu hiện tại ⇒ 401, không phải CLASS_MANAGED)', async () => {
    const res = await call('put', '/me/password', {
      currentPassword: 'sai-mat-khau',
      newPassword: 'Matkhau-Moi-123',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).not.toBe('CLASS_MANAGED');
  });

  it('rời lớp mở khóa lại ngay: PATCH /me dailyMinutes thành công', async () => {
    const left = await call('post', '/me/class/leave', { confirm: true });
    expect(left.status).toBe(204);
    const res = await call('patch', '/me', { dailyMinutes: 15 });
    expect(res.status).toBe(200);
    expect(res.body.profile.dailyMinutes).toBe(15);
    void tokenFor;
  });
});
