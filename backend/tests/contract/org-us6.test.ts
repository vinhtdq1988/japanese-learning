/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SHARED_DATA_V1, sharedDataDisclosure } from '../../src/domain/org-types.js';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  buildRoleWorld,
  createTestInvitation,
  createTestUser,
  tokenFor,
  type RoleWorld,
} from '../integration/org-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US6 (spec 004, T105, quickstart OG6, FR-016, FR-036, FR-037, SC-013): `GET /me/class` đủ
// trường khớp OpenAPI 1.12.0; thông báo dữ liệu chia sẻ ở lời mời, ở nhập mã và ở "Lớp của tôi" GIỐNG HỆT
// nhau; rời lớp cần xác nhận; chuyển nguồn học đúng số bước API (≤ 3 lần nhấp).

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

/** Tài khoản mới (chưa thuộc tổ chức) kèm token, ngôn ngữ vi. */
async function newAccount() {
  const user = await createTestUser(ctx);
  return { user, token: await tokenFor(ctx, user) };
}

describe('GET /me/class', () => {
  it('học viên trong lớp: đủ trường khớp schema MyClass (disclosure, movedNotice, pausedToday, progress…)', async () => {
    const res = await api.get('/me/class', { token: world.tokens.LRN! });
    expect(res.status).toBe(200);
    const body = res.body;
    for (const key of [
      'class',
      'joinedAt',
      'path',
      'assignments',
      'pausedToday',
      'movedNotice',
      'disclosure',
      'progress',
      'placementRequest',
    ]) {
      expect(Object.keys(body), `thiếu khóa ${key}`).toContain(key);
    }
    expect(body.class).toMatchObject({ id: world.classC, name: 'Lớp C' });
    expect(body.path).toMatchObject({ dailyMinutes: 10, startLevel: 'N5', targetLevel: 'N4' });
    expect(body.pausedToday).toBe(false);
    // Chưa có thông báo chuyển lớp / yêu cầu kiểm tra: chỗ trống tường minh (US8 điền sau).
    expect(body.movedNotice).toBeNull();
    expect(body.placementRequest).toBeNull();
    expect(body.progress).toMatchObject({ hasStarted: false, minutesTotal: 0, streakDays: 0 });
    expect(Array.isArray(body.assignments)).toBe(true);
  });

  it('người không thuộc lớp (USR, giáo viên, chủ tổ chức, quản trị viên) → 404 chung; chưa đăng nhập → 401', async () => {
    for (const role of ['USR', 'TCH', 'OWN', 'ADM'] as const) {
      const res = await api.raw('GET', '/me/class', { token: world.tokens[role]! });
      expect(res.status, role).toBe(404);
      expect(JSON.parse(res.text)).toEqual({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy tài nguyên',
      });
    }
    expect((await api.raw('GET', '/me/class')).status).toBe(401);
  });
});

describe('thông báo dữ liệu chia sẻ giống hệt ở mọi nơi (FR-036 ↔ FR-016)', () => {
  it('lời mời, xem trước nhập mã và "Lớp của tôi" cùng một disclosure, đúng SHARED_DATA_V1', async () => {
    const invited = await newAccount();
    const invitation = await createTestInvitation(ctx, world.orgA.orgId, {
      kind: 'student',
      email: invited.user.email,
      classId: world.classC,
    });
    const preview = await api.get(`/invitations/${invitation.token}`, { token: invited.token });
    expect(preview.status).toBe(200);
    const fromInvitation = preview.body.disclosure;

    const viaCode = await newAccount();
    const codePreview = await api.post('/me/class/join', {
      token: viaCode.token,
      body: { code: world.joinCodeC },
    });
    expect(codePreview.status).toBe(200);
    const fromCode = codePreview.body.disclosure;

    const joined = await api.post(`/invitations/${invitation.token}/respond`, {
      token: invited.token,
      body: { decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);
    const mine = await api.get('/me/class', { token: invited.token });
    const fromMyClass = mine.body.disclosure;

    expect(fromCode).toEqual(fromInvitation);
    expect(fromMyClass).toEqual(fromInvitation);
    expect(fromInvitation).toEqual(sharedDataDisclosure('vi'));
    // Danh sách mã khớp hằng dùng chung và có phiên bản đồng ý.
    expect(fromInvitation.version).toBe(SHARED_DATA_V1.version);
    expect(fromInvitation.visible.map((i: any) => i.code)).toEqual(
      expect.arrayContaining(['display_name', 'email', 'progress', 'weak_topics']),
    );
    expect(fromInvitation.canLeaveAnytime).toBe(true);
    expect(fromInvitation.mayBeMovedWithinOrganization).toBe(false);
  });
});

describe('POST /me/class/leave', () => {
  it('thiếu confirm hoặc confirm:false → 422 và vẫn ở trong lớp', async () => {
    const learner = await newAccount();
    const invitation = await createTestInvitation(ctx, world.orgA.orgId, {
      kind: 'student',
      email: learner.user.email,
      classId: world.classC,
    });
    await api.post(`/invitations/${invitation.token}/respond`, {
      token: learner.token,
      body: { decision: 'join_class', confirmed: true },
    });

    for (const body of [undefined, {}, { confirm: false }]) {
      const res = await api.raw('POST', '/me/class/leave', {
        token: learner.token,
        ...(body !== undefined ? { body } : {}),
      });
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    expect((await api.get('/me/class', { token: learner.token })).status).toBe(200);
  });

  it('người không thuộc lớp → 404 chung', async () => {
    const res = await api.raw('POST', '/me/class/leave', {
      token: world.tokens.USR!,
      body: { confirm: true },
    });
    expect(res.status).toBe(404);
    expect(JSON.parse(res.text).code).toBe('NOT_FOUND');
  });

  it('chuyển nguồn học tốn đúng số bước API: rời lớp = 1 yêu cầu, vào lớp bằng mã = xem trước + xác nhận (SC-013)', async () => {
    const learner = await newAccount();
    // Vào lớp bằng mã: bước 1 xem trước (hai lựa chọn + thông báo), bước 2 xác nhận.
    const step1 = await api.post('/me/class/join', {
      token: learner.token,
      body: { code: world.joinCodeC },
    });
    expect(step1.status).toBe(200);
    expect(step1.body.disclosure).toBeDefined();
    const step2 = await api.post('/me/class/join', {
      token: learner.token,
      body: { code: world.joinCodeC, decision: 'join_class', confirmed: true },
    });
    expect(step2.status).toBe(200);
    expect(step2.body.status).toBe('joined');
    expect((await api.get('/me', { token: learner.token })).body.learningSource).toBe('class');

    // Rời lớp chỉ MỘT yêu cầu (bước xác nhận nằm ngay trong cùng yêu cầu `confirm:true`).
    const leave = await api.post('/me/class/leave', {
      token: learner.token,
      body: { confirm: true },
    });
    expect(leave.status).toBe(204);
    const me = (await api.get('/me', { token: learner.token })).body;
    expect(me.learningSource).toBe('personal');
    expect(me.classSummary).toBeUndefined();
    expect((await api.raw('GET', '/me/class', { token: learner.token })).status).toBe(404);
  });
});
