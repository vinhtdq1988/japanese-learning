import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import type { Database } from '../../src/db/client.js';
import { InMemoryJobQueue } from '../../src/jobs/boss.js';
import { InMemoryEmailSender } from '../../src/services/email.js';

// CORS chỉ dành cho dev (client web khác origin với API); mặc định tắt.

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  SMTP_URL: 'smtp://localhost:1025',
  APP_BASE_URL: 'http://localhost:8080',
};
const LAN_ORIGIN = 'http://192.168.1.11:8080';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function makeApp(corsOrigins?: string): Promise<FastifyInstance> {
  const config = loadConfig({
    ...baseEnv,
    ...(corsOrigins === undefined ? {} : { CORS_ALLOWED_ORIGINS: corsOrigins }),
  });
  app = await buildApp(
    {
      config,
      db: {} as Database,
      emailSender: new InMemoryEmailSender(),
      jobQueue: new InMemoryJobQueue(),
    },
    {
      registerRoutes: (api) => {
        api.post('/ping', async () => ({ ok: true }));
      },
    },
  );
  return app;
}

describe('cấu hình CORS_ALLOWED_ORIGINS', () => {
  it('mặc định rỗng', () => {
    expect(loadConfig(baseEnv).CORS_ALLOWED_ORIGINS).toEqual([]);
  });

  it('tách theo dấu phẩy và bỏ khoảng trắng', () => {
    const config = loadConfig({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: ` http://localhost:8080 , ${LAN_ORIGIN} `,
    });
    expect(config.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:8080', LAN_ORIGIN]);
  });

  it.each(['*', 'http://localhost:8080/', 'localhost:8080', 'http://localhost:8080/app'])(
    'từ chối giá trị không phải origin: %s',
    (value) => {
      expect(() => loadConfig({ ...baseEnv, CORS_ALLOWED_ORIGINS: value })).toThrow(
        /CORS_ALLOWED_ORIGINS/,
      );
    },
  );
});

describe('middleware CORS', () => {
  it('tắt khi danh sách rỗng: không có header CORS, preflight không được xử lý', async () => {
    const res = await (
      await makeApp()
    ).inject({
      method: 'OPTIONS',
      url: '/api/v1/ping',
      headers: { origin: LAN_ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight từ origin được phép trả 204 kèm header cho phép', async () => {
    const res = await (
      await makeApp(LAN_ORIGIN)
    ).inject({
      method: 'OPTIONS',
      url: '/api/v1/ping',
      headers: {
        origin: LAN_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(LAN_ORIGIN);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers.vary).toBe('Origin');
  });

  it('phản hồi thường từ origin được phép có Allow-Origin', async () => {
    const res = await (
      await makeApp(LAN_ORIGIN)
    ).inject({
      method: 'POST',
      url: '/api/v1/ping',
      headers: { origin: LAN_ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(LAN_ORIGIN);
  });

  it('phản hồi lỗi (404) từ origin được phép vẫn có Allow-Origin để client đọc được lỗi', async () => {
    const res = await (
      await makeApp(LAN_ORIGIN)
    ).inject({
      method: 'GET',
      url: '/api/v1/khong-ton-tai',
      headers: { origin: LAN_ORIGIN },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['access-control-allow-origin']).toBe(LAN_ORIGIN);
  });

  it('origin không có trong danh sách không nhận header cho phép', async () => {
    const res = await (
      await makeApp(LAN_ORIGIN)
    ).inject({
      method: 'POST',
      url: '/api/v1/ping',
      headers: { origin: 'http://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('yêu cầu không có Origin (cùng origin, curl) không bị ảnh hưởng', async () => {
    const res = await (await makeApp(LAN_ORIGIN)).inject({ method: 'POST', url: '/api/v1/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
