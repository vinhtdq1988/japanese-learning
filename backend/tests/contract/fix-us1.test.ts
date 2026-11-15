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
} from '../integration/org-helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US1 của spec 007 (T027): `GET /study-defaults` và việc máy chủ KHÔNG tự áp gợi ý
// vào `skills` đã lưu khi đổi quỹ thời gian (FR-021…025). Phản hồi đối chiếu `openapi.yaml` 1.14.0.

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

describe('GET /study-defaults', () => {
  it('có token → 200, đúng 4 dòng tăng dần và practiceMinDailyMinutes = 30', async () => {
    const user = await registerUser(api);
    const res = await api.get('/study-defaults', { token: user.accessToken });
    expect(res.status).toBe(200);
    expect(res.body.practiceMinDailyMinutes).toBe(30);
    expect(res.body.items).toEqual([
      { dailyMinutes: 5, skills: ['vocabulary'] },
      { dailyMinutes: 10, skills: ['vocabulary', 'grammar'] },
      { dailyMinutes: 15, skills: ['vocabulary', 'grammar', 'kanji'] },
      { dailyMinutes: 30, skills: ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'] },
    ]);
  });

  it('không token → 401', async () => {
    const res = await api.get('/study-defaults', { validateResponse: false });
    expect(res.status).toBe(401);
  });

  it('học viên thuộc lớp cũng 200 (đọc bảng tĩnh, không bị khóa)', async () => {
    const org = await createTestOrg(ctx, { seats: 4 });
    const teacher = await createTestUser(ctx);
    await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
    const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });

    const learner = await onboardedLearner(api, ctx);
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

    const res = await api.get('/study-defaults', { token: learner.token });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(4);
  });
});

describe('PATCH /me {dailyMinutes}: máy chủ không tự áp gợi ý (FR-024)', () => {
  it('đổi 10 → 15 phút giữ nguyên skills đã lưu', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await api.get('/me', { token: learner.token });
    expect(before.status).toBe(200);
    const savedSkills: string[] = before.body.profile.skills;
    expect(savedSkills).not.toContain('kanji');

    const patched = await api.patch('/me', { token: learner.token, body: { dailyMinutes: 15 } });
    expect(patched.status).toBe(200);
    expect(patched.body.profile.dailyMinutes).toBe(15);
    expect(patched.body.profile.skills).toEqual(savedSkills);

    const after = await api.get('/me', { token: learner.token });
    expect(after.body.profile.dailyMinutes).toBe(15);
    expect(after.body.profile.skills).toEqual(savedSkills);
  });
});
