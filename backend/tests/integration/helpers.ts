import { inject } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, type BuildAppOptions } from '../../src/app.js';
import { registerApiRoutes } from '../../src/api/routes.js';
import { loadConfig, type Config } from '../../src/config.js';
import { createDb, type DbHandle } from '../../src/db/client.js';
import { FakeClock } from '../../src/engine/clock.js';
import { InMemoryJobQueue } from '../../src/jobs/boss.js';
import { InMemoryEmailSender } from '../../src/services/email.js';

// Tiện ích dùng chung cho kiểm thử cần CSDL (dự án `db`).

/** Cấu hình kiểm thử: bí mật cố định, ngưỡng mặc định; ghi đè được từng biến. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl') || 'postgres://unused',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    SMTP_URL: 'smtp://localhost:1025',
    APP_BASE_URL: 'http://localhost:8080',
    ...overrides,
  });
}

/** Chuỗi kết nối CSDL kiểm thử; ném lỗi rõ ràng nếu môi trường không có CSDL. */
export function requireDatabaseUrl(): string {
  const url = inject('databaseUrl');
  if (!url) {
    throw new Error(inject('databaseUnavailableReason') || 'Không có CSDL kiểm thử');
  }
  return url;
}

export function openTestDb(): DbHandle {
  return createDb(requireDatabaseUrl());
}

/** Xóa sạch dữ liệu mọi bảng nghiệp vụ (giữ lược đồ) để các test độc lập. */
export async function resetDatabase(handle: DbHandle): Promise<void> {
  const { rows } = await handle.pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await handle.pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestApp {
  app: FastifyInstance;
  handle: DbHandle;
  clock: FakeClock;
  emailSender: InMemoryEmailSender;
  jobQueue: InMemoryJobQueue;
  config: Config;
  close(): Promise<void>;
}

/** Dựng ứng dụng với phụ thuộc giả (đồng hồ, email, hàng đợi) trên CSDL kiểm thử đã dọn sạch. */
export async function createTestApp(
  options: BuildAppOptions = {},
  configOverrides: Record<string, string> = {},
): Promise<TestApp> {
  const handle = openTestDb();
  await resetDatabase(handle);
  const clock = new FakeClock('2026-01-05T08:00:00Z');
  const emailSender = new InMemoryEmailSender();
  const jobQueue = new InMemoryJobQueue();
  // Ngưỡng rate-limit được nâng cao để các kịch bản nhiều lần gọi từ cùng một IP không bị chặn;
  // kiểm thử rate-limit truyền lại ngưỡng thấp qua `configOverrides`.
  const config = testConfig({
    RATE_LIMIT_AUTH_PER_MIN: '1000',
    RATE_LIMIT_TRIAL_PER_MIN: '1000',
    RATE_LIMIT_TRIAL_GRADE_PER_MIN: '1000',
    ...configOverrides,
  });
  const app = await buildApp(
    { config, db: handle.db, clock, emailSender, jobQueue },
    { logger: false, registerRoutes: registerApiRoutes, ...options },
  );
  await app.ready();
  return {
    app,
    handle,
    clock,
    emailSender,
    jobQueue,
    config,
    close: async () => {
      await app.close();
      await handle.close();
    },
  };
}
