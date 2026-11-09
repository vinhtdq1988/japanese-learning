import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../../src/app.js';
import { parseInput } from '../../src/api/errors.js';
import {
  signAccessToken,
  verifyAccessToken,
  requireRole,
  currentUserId,
} from '../../src/api/middleware/auth.js';
import { ruleForRoute } from '../../src/api/middleware/rate-limit.js';
import { loadConfig } from '../../src/config.js';
import type { Database } from '../../src/db/client.js';
import { AppError } from '../../src/domain/types.js';
import { FakeClock } from '../../src/engine/clock.js';
import { InMemoryJobQueue } from '../../src/jobs/boss.js';
import { InMemoryEmailSender } from '../../src/services/email.js';

// Kiểm thử khung API (T016–T021) không cần CSDL: dùng Fastify `inject` với route thử nghiệm.

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  SMTP_URL: 'smtp://localhost:1025',
  APP_BASE_URL: 'http://localhost:8080',
});

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const userId = '11111111-1111-4111-8111-111111111111';

async function makeApp(
  clock = new FakeClock('2026-01-05T08:00:00Z'),
  cfg = config,
): Promise<{ app: FastifyInstance; clock: FakeClock }> {
  app = await buildApp(
    {
      config: cfg,
      db: {} as Database,
      clock,
      emailSender: new InMemoryEmailSender(),
      jobQueue: new InMemoryJobQueue(),
    },
    {
      registerRoutes: (api) => {
        const secured = { preHandler: [api.authenticate] };
        api.get('/me', secured, async (req) => ({ id: currentUserId(req) }));
        api.post('/account/restore', secured, async () => ({ restored: true }));
        api.post('/auth/logout', secured, async (_req, reply) => reply.status(204).send());
        api.get(
          '/admin/units',
          { preHandler: [api.authenticate, requireRole('admin')] },
          async () => [],
        );
        api.post('/trial/placement/grade', async () => ({ ok: true }));
        api.post('/trial/events', async (_req, reply) => reply.status(204).send());
        api.get('/placement/questions', async () => ({ ok: true }));
        api.post('/auth/login', async () => ({ ok: true }));
        api.post('/auth/refresh', async () => ({ ok: true }));
        api.post('/boom', async () => {
          throw new Error('chi tiết nội bộ không được lộ');
        });
        api.post('/validate', async (req) =>
          parseInput(z.object({ email: z.email(), age: z.number().int() }), req.body),
        );
        api.get('/conflict', async () => {
          throw new AppError(409, 'EMAIL_TAKEN', 'Email đã được sử dụng');
        });
      },
    },
  );
  return { app, clock };
}

const token = (
  role: 'learner' | 'admin' = 'learner',
  status: 'active' | 'disabled' | 'pending_deletion' = 'active',
  now?: Date,
) => signAccessToken(config, { userId, role, status, sessionId: 'sess-1' }, now);

const bearer = async (...args: Parameters<typeof token>) => ({
  authorization: `Bearer ${await token(...args)}`,
});

describe('xác thực JWT (T017, R4)', () => {
  it('token hợp lệ cho phép truy cập và userId lấy từ token', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: await bearer() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: userId });
  });

  it('thiếu hoặc sai token → 401 UNAUTHORIZED theo schema lỗi', async () => {
    const { app } = await makeApp();
    for (const headers of [
      {},
      { authorization: 'Bearer rac.roi.xyz' },
      { authorization: 'Basic abc' },
    ]) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED', message: expect.any(String) });
    }
  });

  it('token ký bằng khóa khác bị từ chối', async () => {
    const { app } = await makeApp();
    const forged = await signAccessToken(
      { JWT_SECRET: 'khac-khac-khac-khac-khac-khac-khac-khac', ACCESS_TOKEN_TTL_SECONDS: 900 },
      { userId, role: 'admin', status: 'active' },
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('access token hết hạn sau 15 phút (đồng hồ giả lập +15 phút → 401)', async () => {
    const { app, clock } = await makeApp();
    const headers = await bearer('learner', 'active', clock.now());
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers })).statusCode).toBe(200);
    clock.advanceMinutes(14);
    expect((await app.inject({ method: 'GET', url: '/api/v1/me', headers })).statusCode).toBe(200);
    clock.advanceMinutes(2);
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });

  it('pending_deletion chỉ gọi được /account/restore và /auth/logout, route khác 403 ACCOUNT_PENDING_DELETION', async () => {
    const { app } = await makeApp();
    const headers = await bearer('learner', 'pending_deletion');
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/account/restore', headers })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers })).statusCode,
    ).toBe(204);
    const blocked = await app.inject({ method: 'GET', url: '/api/v1/me', headers });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().code).toBe('ACCOUNT_PENDING_DELETION');
  });

  it('claim status=disabled → 403 ACCOUNT_DISABLED', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: await bearer('learner', 'disabled'),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('ACCOUNT_DISABLED');
  });

  it('route admin: người học thường 403 FORBIDDEN, admin 200 (FR-004)', async () => {
    const { app } = await makeApp();
    const learner = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/units',
      headers: await bearer('learner'),
    });
    expect(learner.statusCode).toBe(403);
    expect(learner.json().code).toBe('FORBIDDEN');
    const admin = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/units',
      headers: await bearer('admin'),
    });
    expect(admin.statusCode).toBe(200);
    const anon = await app.inject({ method: 'GET', url: '/api/v1/admin/units' });
    expect(anon.statusCode).toBe(401);
  });

  it('verifyAccessToken trả vai trò, trạng thái và sid', async () => {
    const t = await token('admin');
    expect(await verifyAccessToken(config, t)).toEqual({
      userId,
      role: 'admin',
      status: 'active',
      sessionId: 'sess-1',
    });
    expect(await verifyAccessToken(config, 'khong-phai-jwt')).toBeNull();
  });
});

describe('xử lý lỗi theo schema Error (T016)', () => {
  it('AppError giữ nguyên mã và thông điệp', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'EMAIL_TAKEN', message: 'Email đã được sử dụng' });
  });

  it('dữ liệu sai → 422 VALIDATION_FAILED kèm thông báo theo trường', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/validate',
      payload: { email: 'khong-phai-email', age: 1.5 },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(body.fields).sort()).toEqual(['age', 'email']);
  });

  it('JSON hỏng → 422 VALIDATION_FAILED', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{không phải json',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('VALIDATION_FAILED');
  });

  it('POST không body nhưng có Content-Type JSON (client Dio) vẫn được xử lý, không 422', async () => {
    const { app } = await makeApp();
    for (const payload of [undefined, '', '  ']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/account/restore',
        headers: { ...(await bearer()), 'content-type': 'application/json' },
        payload,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('lỗi hệ thống → 500 INTERNAL_ERROR, không lộ chi tiết nội bộ', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' });
    expect(res.body).not.toContain('chi tiết nội bộ');
  });

  it('route không tồn tại → 404 NOT_FOUND', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/khong-co' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });
});

describe('header bảo mật (T021)', () => {
  it('mọi phản hồi mang CSP chặt, nosniff, DENY frame, no-store', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    // Ngoài production không bật HSTS (dev dùng HTTP).
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('production bật HSTS', async () => {
    const prod = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://unused',
      JWT_SECRET: 'prod-secret-prod-secret-prod-secret-12345',
      SMTP_URL: 'smtp://localhost:1025',
      APP_BASE_URL: 'https://example.com',
    });
    const { app } = await makeApp(undefined, prod);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });
});

describe('giới hạn tần suất theo IP (T018, R9, FR-040)', () => {
  it('ruleForRoute phân nhóm route theo đặc tả', () => {
    const rule = (url: string) => ruleForRoute(config, url);
    expect(rule('/api/v1/trial/placement/grade')).toEqual({ groupId: 'trial-grade', max: 10 });
    expect(rule('/api/v1/trial/events')).toEqual({ groupId: 'trial', max: 60 });
    expect(rule('/api/v1/trial/content')).toEqual({ groupId: 'trial', max: 60 });
    expect(rule('/api/v1/placement/questions')).toEqual({ groupId: 'trial', max: 60 });
    for (const p of ['register', 'login', 'password-reset/request', 'password-reset/confirm']) {
      expect(rule(`/api/v1/auth/${p}`)).toEqual({ groupId: 'auth', max: 10 });
    }
    expect(rule('/api/v1/auth/refresh')).toBeNull();
    expect(rule('/api/v1/auth/logout')).toBeNull();
    expect(rule('/api/v1/today')).toBeNull();
    expect(rule('/api/v1/placement/submit')).toBeNull();
  });

  it('POST /trial/placement/grade: yêu cầu thứ 11 trong phút bị chặn 429 kèm Retry-After', async () => {
    const { app } = await makeApp();
    const hit = () =>
      app.inject({ method: 'POST', url: '/api/v1/trial/placement/grade', payload: {} });
    for (let i = 0; i < 10; i++) expect((await hit()).statusCode).toBe(200);
    const blocked = await hit();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('/trial/* và /placement/questions dùng chung một bộ đếm 60/phút', async () => {
    const { app } = await makeApp();
    for (let i = 0; i < 30; i++) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/trial/events',
            payload: { event: 'lesson_completed' },
          })
        ).statusCode,
      ).toBe(204);
    }
    for (let i = 0; i < 30; i++) {
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/placement/questions' })).statusCode,
      ).toBe(200);
    }
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/placement/questions' })).statusCode,
    ).toBe(429);
    // Chấm placement có bộ đếm riêng, không bị ảnh hưởng.
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/trial/placement/grade', payload: {} }))
        .statusCode,
    ).toBe(200);
  });

  it('/auth/login giới hạn 10/phút còn /auth/refresh không bị giới hạn', async () => {
    const { app } = await makeApp();
    for (let i = 0; i < 10; i++) {
      expect(
        (await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} })).statusCode,
      ).toBe(200);
    }
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} })).statusCode,
    ).toBe(429);
    for (let i = 0; i < 15; i++) {
      expect(
        (await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', payload: {} })).statusCode,
      ).toBe(200);
    }
  });

  it('ngưỡng đọc từ cấu hình', async () => {
    const small = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://unused',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      SMTP_URL: 'smtp://localhost:1025',
      APP_BASE_URL: 'http://localhost:8080',
      RATE_LIMIT_AUTH_PER_MIN: '2',
    });
    const { app } = await makeApp(undefined, small);
    const hit = () => app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: {} });
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429);
  });
});
