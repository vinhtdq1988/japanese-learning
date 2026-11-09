// PostgreSQL nhúng cho dev (máy không có Docker). Chạy ở foreground; Ctrl+C để dừng.
// Dữ liệu lưu ở .dev-data/pg (bị .gitignore) nên giữ nguyên giữa các lần chạy.
// Tham số: DEV_DB_PORT (mặc định 5432), DEV_DB_DIR, DEV_DB_USER/PASSWORD/NAME (mặc định khớp .env.example).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const databaseDir = process.env.DEV_DB_DIR ?? path.join(root, '.dev-data', 'pg');
const port = Number(process.env.DEV_DB_PORT ?? 5432);
const user = process.env.DEV_DB_USER ?? 'japanese';
const password = process.env.DEV_DB_PASSWORD ?? 'japanese';
const dbName = process.env.DEV_DB_NAME ?? 'japanese_learning';

const pg = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
  // UTF8 + locale C: mặc định của Windows (WIN1252) làm migration tiếng Việt lỗi 22P05.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: (e) => console.error(e),
});

if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  console.log(`[dev-db] Khởi tạo cụm PostgreSQL mới tại ${databaseDir}`);
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase(dbName);
  console.log(`[dev-db] Đã tạo CSDL ${dbName}`);
} catch (err) {
  // Đã tồn tại từ lần chạy trước thì bỏ qua.
  if (!/already exists/i.test(String(err?.message ?? err))) throw err;
}
console.log(`[dev-db] Sẵn sàng: postgres://${user}:${password}@localhost:${port}/${dbName}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('[dev-db] Đang dừng…');
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // giữ tiến trình sống
