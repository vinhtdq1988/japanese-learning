import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../src/db/migrate.js';

// globalSetup của dự án `db`: dựng PostgreSQL 16 sạch (Testcontainers), chạy migration và chia sẻ
// `databaseUrl` cho các test qua `inject('databaseUrl')`. Đặt `TEST_DATABASE_URL` để dùng CSDL có sẵn
// (CSDL đó sẽ bị XÓA SẠCH giữa các test – chỉ trỏ vào CSDL dành riêng cho kiểm thử).

declare module 'vitest' {
  export interface ProvidedContext {
    /** Chuỗi kết nối CSDL kiểm thử; rỗng nếu không dựng được (không có Docker). */
    databaseUrl: string;
    /** Lý do không có CSDL kiểm thử (khi `databaseUrl` rỗng). */
    databaseUnavailableReason: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let url = process.env.TEST_DATABASE_URL ?? '';
  let reason = '';

  if (!url) {
    try {
      container = await new PostgreSqlContainer('postgres:16').start();
      url = container.getConnectionUri();
    } catch (err) {
      reason = `Không dựng được PostgreSQL cho kiểm thử (cần Docker hoặc TEST_DATABASE_URL): ${(err as Error).message}`;
      console.warn(`\n[kiểm thử tích hợp] ${reason}\n`);
    }
  }
  if (url) await runMigrations(url);

  project.provide('databaseUrl', url);
  project.provide('databaseUnavailableReason', reason);

  return async () => {
    await container?.stop();
  };
}
