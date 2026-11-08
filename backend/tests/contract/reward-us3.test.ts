/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { getToday, onboardedLearner, query } from '../integration/lesson-helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestInvitation,
  createTestOrg,
  createTestUser,
} from '../integration/org-helpers.js';
import { loadAuthzMatrix } from './authz-matrix.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng tùy chọn hiệu ứng (spec 005, T058, contracts/api-changes.md): `soundEnabled` và
// `visualEffectsEnabled` của `GET/PATCH /me`. Mọi phản hồi được đối chiếu `openapi.yaml` 1.13.0.

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

describe('GET /me → tùy chọn hiệu ứng', () => {
  it('người học mới mặc định bật cả hai', async () => {
    const learner = await onboardedLearner(api, ctx);
    const me = await api.get('/me', { token: learner.token });
    expect(me.status).toBe(200);
    expect(me.body.profile).toMatchObject({ soundEnabled: true, visualEffectsEnabled: true });
  });

  it('người học cũ (cột mới vừa thêm) cũng mặc định bật cả hai', async () => {
    const learner = await onboardedLearner(api, ctx);
    // Mô phỏng hồ sơ có trước migration 0005: cột nhận giá trị mặc định của migration.
    await query(
      ctx,
      'UPDATE learning_profiles SET sound_enabled = DEFAULT, visual_effects_enabled = DEFAULT WHERE user_id = $1',
      [learner.userId],
    );
    const me = await api.get('/me', { token: learner.token });
    expect(me.body.profile).toMatchObject({ soundEnabled: true, visualEffectsEnabled: true });
  });
});

describe('PATCH /me → tùy chọn hiệu ứng', () => {
  it('lưu từng tùy chọn độc lập và GET /me trả đúng', async () => {
    const learner = await onboardedLearner(api, ctx);

    const sound = await api.patch('/me', { token: learner.token, body: { soundEnabled: false } });
    expect(sound.status).toBe(200);
    expect(sound.body.profile).toMatchObject({ soundEnabled: false, visualEffectsEnabled: true });

    const visual = await api.patch('/me', {
      token: learner.token,
      body: { visualEffectsEnabled: false },
    });
    expect(visual.status).toBe(200);
    expect(visual.body.profile).toMatchObject({ soundEnabled: false, visualEffectsEnabled: false });

    const me = await api.get('/me', { token: learner.token });
    expect(me.body.profile).toMatchObject({ soundEnabled: false, visualEffectsEnabled: false });

    const back = await api.patch('/me', {
      token: learner.token,
      body: { soundEnabled: true, visualEffectsEnabled: true },
    });
    expect(back.status).toBe(200);
    expect(back.body.profile).toMatchObject({ soundEnabled: true, visualEffectsEnabled: true });
  });

  it('giữ nguyên sau khi đăng xuất rồi đăng nhập lại', async () => {
    const learner = await onboardedLearner(api, ctx);
    const saved = await api.patch('/me', {
      token: learner.token,
      body: { soundEnabled: false, visualEffectsEnabled: false },
    });
    expect(saved.status).toBe(200);

    const out = await api.post('/auth/logout', { token: learner.token });
    expect(out.status).toBe(204);

    const login = await api.post('/auth/login', {
      body: { email: learner.user.email, password: learner.user.password },
    });
    expect(login.status).toBe(200);
    const me = await api.get('/me', { token: login.body.accessToken });
    expect(me.body.profile).toMatchObject({ soundEnabled: false, visualEffectsEnabled: false });
  });

  it('chỉ đổi hai tùy chọn thì không sinh lại lộ trình, không đụng kế hoạch, không cần currentPassword', async () => {
    const learner = await onboardedLearner(api, ctx);
    const planBefore = await getToday(api, learner);
    const pathBefore = await query(
      ctx,
      'SELECT id, status FROM learning_paths WHERE user_id = $1 ORDER BY id',
      [learner.userId],
    );
    const plansBefore = await query(
      ctx,
      'SELECT id, local_date, status FROM daily_plans WHERE user_id = $1 ORDER BY id',
      [learner.userId],
    );

    const res = await api.patch('/me', {
      token: learner.token,
      body: { soundEnabled: false, visualEffectsEnabled: false },
    });
    expect(res.status).toBe(200); // không gửi currentPassword

    expect(
      await query(ctx, 'SELECT id, status FROM learning_paths WHERE user_id = $1 ORDER BY id', [
        learner.userId,
      ]),
    ).toEqual(pathBefore);
    expect(
      await query(
        ctx,
        'SELECT id, local_date, status FROM daily_plans WHERE user_id = $1 ORDER BY id',
        [learner.userId],
      ),
    ).toEqual(plansBefore);
    const planAfter = await getToday(api, learner);
    expect(planAfter.items.map((i: any) => i.id)).toEqual(planBefore.items.map((i: any) => i.id));
  });

  it('kiểu sai (chuỗi/số) → 422 VALIDATION_FAILED kèm trường lỗi', async () => {
    const learner = await onboardedLearner(api, ctx);
    for (const body of [
      { soundEnabled: 'false' },
      { soundEnabled: 0 },
      { visualEffectsEnabled: 'true' },
      { visualEffectsEnabled: 1 },
    ]) {
      const res = await api.patch('/me', {
        token: learner.token,
        body,
        validateRequest: false,
      });
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty(Object.keys(body)[0]!);
    }
    // Giá trị cũ không bị ghi đè bởi yêu cầu lỗi.
    const me = await api.get('/me', { token: learner.token });
    expect(me.body.profile).toMatchObject({ soundEnabled: true, visualEffectsEnabled: true });
  });

  it('học viên thuộc lớp vẫn PATCH được (200, không CLASS_MANAGED)', async () => {
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

    const res = await api.patch('/me', {
      token: learner.token,
      body: { soundEnabled: false, visualEffectsEnabled: false },
    });
    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
    expect(res.body.profile).toMatchObject({ soundEnabled: false, visualEffectsEnabled: false });

    // Trường bị khóa của lớp vẫn bị khóa — hai tùy chọn mới không làm lỏng khóa.
    const locked = await api.call('patch', '/me', {
      token: learner.token,
      body: { dailyMinutes: 15 },
      validateRequest: false,
      validateResponse: false,
    });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('CLASS_MANAGED');
  });
});

describe('ma trận phân quyền', () => {
  it('không thêm dòng nào cho tùy chọn hiệu ứng (không có route mới)', () => {
    const matrix = loadAuthzMatrix();
    const text = JSON.stringify(matrix);
    expect(text).not.toMatch(/soundEnabled|visualEffectsEnabled|sound_enabled|effects/i);
  });
});
