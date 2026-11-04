import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
/** Đối tượng giao dịch Drizzle; dùng chung kiểu truy vấn với `Database`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Nơi chạy truy vấn: kết nối thường hoặc trong giao dịch. */
export type DbExecutor = Database | Transaction;

export interface DbHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

// Cột `date` luôn trả chuỗi `YYYY-MM-DD` (ngày địa phương, không qua múi giờ máy chủ).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// bigint (đếm thống kê) trả số JS; giá trị đếm nằm xa dưới 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

/** Tạo pool kết nối và đối tượng Drizzle. Gọi `close()` khi tắt ứng dụng/kiểm thử. */
export function createDb(databaseUrl: string): DbHandle {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}

/** Chạy `fn` trong một giao dịch; tự rollback khi `fn` ném lỗi. */
export function withTransaction<T>(db: Database, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
