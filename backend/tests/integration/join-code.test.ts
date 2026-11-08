import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classes, joinCodeAttempts } from '../../src/db/schema.js';
import { JOIN_CODE_ALPHABET } from '../../src/services/join-code.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử mã tham gia (spec 004, T046, FR-012, research O4): mã không nhập nhằng, bật/tắt/đổi, hạn dùng,
// mọi lỗi mã cho CÙNG một 404, chống dò mã theo tài khoản (429 + Retry-After), giáo viên không nhập mã lớp mình.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

async function setup(options: { withPath?: boolean; seats?: number } = {}) {
  const org = await createTestOrg(ctx, { seats: options.seats ?? 6 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, {
    teacherIds: [teacher.userId],
    withPath: options.withPath ?? true,
  });
  return { org, teacher, classId, teacherToken: await tokenFor(ctx, teacher) };
}

const enable = async (classId: string, token: string, body: Record<string, unknown> = {}) =>
  api.put(`/classes/${classId}/join-code`, { token, body: { enabled: true, ...body } });

const tryCode = (token: string, code: string, extra: Record<string, unknown> = {}) =>
  api.raw('POST', '/me/class/join', { token, body: { code, ...extra } });

describe('sinh và quản lý mã', () => {
  it('mã 8 ký tự từ bảng chữ không nhập nhằng; bật/tắt/đổi', async () => {
    const { classId, teacherToken } = await setup();
    expect(JOIN_CODE_ALPHABET).toHaveLength(32);
    expect(JOIN_CODE_ALPHABET).not.toMatch(/[01IO]/);

    const on = await enable(classId, teacherToken);
    expect(on.body.code).toMatch(new RegExp(`^[${JOIN_CODE_ALPHABET}]{8}$`));
    const code = on.body.code as string;

    const off = await api.put(`/classes/${classId}/join-code`, {
      token: teacherToken,
      body: { enabled: false },
    });
    expect(off.body).toMatchObject({ enabled: false, code });
    const learner = await createTestUser(ctx);
    expect((await tryCode(await tokenFor(ctx, learner), code)).status).toBe(404);

    const reOn = await enable(classId, teacherToken);
    expect(reOn.body.code).toBe(code);
    const rotated = await api.post(`/classes/${classId}/join-code/rotate`, { token: teacherToken });
    expect(rotated.body.code).not.toBe(code);
    expect(rotated.body.enabled).toBe(true);
    expect((await tryCode(await tokenFor(ctx, learner), code)).status).toBe(404);
    expect((await tryCode(await tokenFor(ctx, learner), rotated.body.code)).status).toBe(200);
  });

  it('không bật được khi lớp chưa có lộ trình (409 CLASS_NOT_READY)', async () => {
    const { classId, teacherToken } = await setup({ withPath: false });
    const res = await enable(classId, teacherToken);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_NOT_READY');
  });

  it('hạn dùng tùy chọn: quá hạn → 404; hạn ở quá khứ → 422', async () => {
    const { classId, teacherToken } = await setup();
    const past = await api.put(`/classes/${classId}/join-code`, {
      token: teacherToken,
      body: { enabled: true, expiresAt: '2026-01-04T00:00:00Z' },
    });
    expect(past.status).toBe(422);

    const on = await enable(classId, teacherToken, { expiresAt: '2026-01-06T08:00:00Z' });
    expect(on.body.expiresAt).toBe('2026-01-06T08:00:00.000Z');
    const learner = await createTestUser(ctx);
    expect((await tryCode(await tokenFor(ctx, learner), on.body.code)).status).toBe(200);
    ctx.clock.advanceDays(2);
    const late = await tryCode(await tokenFor(ctx, learner), on.body.code);
    expect(late.status).toBe(404);
    ctx.clock.advanceDays(-2);
  });
});

describe('mọi lỗi mã cho cùng một 404 (so từng byte)', () => {
  it('sai mã / mã đã tắt / hết hạn / lớp lưu trữ / lớp chưa lộ trình', async () => {
    const good = await setup();
    const on = await enable(good.classId, good.teacherToken);
    const code = on.body.code as string;

    const off = await setup();
    const offCode = (await enable(off.classId, off.teacherToken)).body.code as string;
    await api.put(`/classes/${off.classId}/join-code`, {
      token: off.teacherToken,
      body: { enabled: false },
    });

    const archived = await setup();
    const archivedCode = (await enable(archived.classId, archived.teacherToken)).body
      .code as string;
    await api.post(`/classes/${archived.classId}/archive`, {
      token: archived.teacherToken,
      body: { confirm: true },
    });

    const noPath = await setup();
    await ctx.handle.db
      .update(classes)
      .set({ joinCode: 'ABCD2345', joinCodeEnabled: true })
      .where(eq(classes.id, noPath.classId));
    // Lớp có mã nhưng bị gỡ lộ trình trực tiếp: mô phỏng "chưa lộ trình".
    await ctx.handle.db.execute(sql`DELETE FROM class_paths WHERE class_id = ${noPath.classId}`);

    // Mỗi trường hợp dùng một tài khoản riêng để không chạm ngưỡng khóa.
    const bodies: string[] = [];
    for (const attempt of ['ZZZZZZZZ', offCode, archivedCode, 'ABCD2345']) {
      const res = await tryCode(await tokenFor(ctx, await createTestUser(ctx)), attempt);
      expect(res.status).toBe(404);
      bodies.push(res.text);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual({
      code: 'NOT_FOUND',
      message: 'Không tìm thấy tài nguyên',
    });
    expect((await tryCode(await tokenFor(ctx, await createTestUser(ctx)), code)).status).toBe(200);
  });
});

describe('chống dò mã theo tài khoản', () => {
  it('sai quá 5 lần → 429 Retry-After, kể cả khi nhập mã đúng; hết khóa thì nhập lại được', async () => {
    const { classId, teacherToken } = await setup();
    const code = (await enable(classId, teacherToken)).body.code as string;
    const learner = await createTestUser(ctx);
    const bearer = await tokenFor(ctx, learner);

    for (let i = 0; i < 5; i++) expect((await tryCode(bearer, 'ZZZZZZZZ')).status).toBe(404);
    const locked = await tryCode(bearer, 'ZZZZZZZZ');
    expect(locked.status).toBe(429);
    expect(JSON.parse(locked.text).code).toBe('TOO_MANY_REQUESTS');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);

    const correctWhileLocked = await tryCode(bearer, code);
    expect(correctWhileLocked.status).toBe(429);

    // Tài khoản khác không bị ảnh hưởng.
    expect((await tryCode(await tokenFor(ctx, await createTestUser(ctx)), code)).status).toBe(200);

    ctx.clock.advanceMinutes(16);
    const afterLock = await tryCode(await tokenFor(ctx, learner), code);
    expect(afterLock.status).toBe(200);
    // Mã đúng xóa bộ đếm.
    const rows = await ctx.handle.db
      .select()
      .from(joinCodeAttempts)
      .where(eq(joinCodeAttempts.userId, learner.userId));
    expect(rows).toHaveLength(0);
    ctx.clock.advanceMinutes(-16);
  });

  it('nhập song song không vượt ngưỡng: tối đa 5 lần được xử lý', async () => {
    const { classId, teacherToken } = await setup();
    await enable(classId, teacherToken);
    const bearer = await tokenFor(ctx, await createTestUser(ctx));
    const results = await Promise.all(
      Array.from({ length: 15 }, () => tryCode(bearer, 'ZZZZZZZZ')),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 404)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(10);
  });
});

describe('giáo viên và vai trò đặc biệt', () => {
  it('giáo viên phụ trách nhập mã lớp mình → 409 INVITEE_UNAVAILABLE (bất biến §3.5); lớp khác cùng tổ chức vẫn vào được', async () => {
    const w = await setup();
    const code = (await enable(w.classId, w.teacherToken)).body.code as string;
    const own = await api.post('/me/class/join', {
      token: w.teacherToken,
      body: { code, decision: 'join_class', confirmed: true },
    });
    expect(own.status).toBe(409);
    expect(own.body.code).toBe('INVITEE_UNAVAILABLE');

    // Lớp khác cùng tổ chức (do giáo viên khác phụ trách): vào được và dùng lại chính seat đang giữ.
    const second = await createTestUser(ctx);
    await addOrgRole(ctx, w.org.orgId, second.userId, { teacher: true });
    const { classId: other } = await createTestClass(ctx, w.org.orgId, {
      teacherIds: [second.userId],
    });
    const otherCode = (await enable(other, await tokenFor(ctx, second))).body.code as string;
    const owner = await createTestUser(ctx);
    await addOrgRole(ctx, w.org.orgId, owner.userId, { owner: true });
    const before = (await api.get('/org', { token: await tokenFor(ctx, owner) })).body.seats;
    const joined = await api.post('/me/class/join', {
      token: w.teacherToken,
      body: { code: otherCode, decision: 'join_class', confirmed: true },
    });
    expect(joined.status).toBe(200);
    const after = (await api.get('/org', { token: await tokenFor(ctx, owner) })).body.seats;
    expect(after.used).toBe(before.used);
  });

  it('mã của tổ chức khác với tài khoản đã thuộc tổ chức → INVITEE_UNAVAILABLE', async () => {
    const a = await setup();
    const b = await setup();
    const code = (await enable(b.classId, b.teacherToken)).body.code as string;
    const learner = await createTestUser(ctx);
    await enrollLearner(ctx, a.org.orgId, a.classId, learner.userId);
    // Học viên đang ở lớp của tổ chức A nhập mã của tổ chức B.
    const res = await api.post('/me/class/join', {
      token: await tokenFor(ctx, learner),
      body: { code, decision: 'join_class', confirmed: true },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITEE_UNAVAILABLE');
  });

  it('hết seat → SEAT_UNAVAILABLE khi vào lớp bằng mã', async () => {
    const w = await setup({ seats: 1 });
    const code = (await enable(w.classId, w.teacherToken)).body.code as string;
    const res = await api.post('/me/class/join', {
      token: await tokenFor(ctx, await createTestUser(ctx)),
      body: { code, decision: 'join_class', confirmed: true },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEAT_UNAVAILABLE');
  });
});
