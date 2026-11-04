// Trình chạy migration SQL tường minh: `pnpm db:migrate`.
// Chạy các file `migrations/*.sql` theo thứ tự tên, mỗi file trong một giao dịch, và ghi vào bảng
// `schema_migrations` để không chạy lại.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Khóa advisory để hai tiến trình migrate không chạy chồng nhau. */
const MIGRATION_LOCK_KEY = 727_001;

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

/** Áp dụng mọi migration chưa chạy. Trả danh sách file đã áp dụng/bỏ qua. */
export async function runMigrations(
  databaseUrl: string,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrateResult> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const result: MigrateResult = { applied: [], skipped: [] };
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name       text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );
    for (const file of files) {
      if (done.has(file)) {
        result.skipped.push(file);
        continue;
      }
      const sqlText = await readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sqlText);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} thất bại: ${(err as Error).message}`, { cause: err });
      }
      result.applied.push(file);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    await client.end();
  }
  return result;
}

// Chạy trực tiếp: `tsx src/db/migrate.ts`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { loadDotEnv } = await import('../config.js');
  loadDotEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Thiếu biến môi trường DATABASE_URL (xem backend/.env.example)');
  const { applied, skipped } = await runMigrations(databaseUrl);
  console.log(`Migration: đã áp dụng ${applied.length}, bỏ qua ${skipped.length}`);
  for (const f of applied) console.log(`  + ${f}`);
}
