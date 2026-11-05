import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Database } from '../db/client.js';
import { incrementMetric } from '../db/repositories/aggregate-stats.js';
import { deleteExpiredPendingUsers } from '../db/repositories/users.js';
import { systemClock, type Clock } from '../engine/clock.js';
import { DELETION_GRACE_DAYS } from '../services/auth.js';
import { QUEUES, type JobDefinition } from './boss.js';

// Job xóa vĩnh viễn tài khoản quá 30 ngày chờ xóa (T112, FR-003, data-model §4). Mọi bảng dữ liệu cá
// nhân tham chiếu `users` bằng `ON DELETE CASCADE` nên chỉ cần xóa dòng `users`. Chỉ giữ lại bộ đếm tổng
// hợp ẩn danh `accounts_purged` trong `aggregate_daily_stats` (không có khóa ngoại, không định danh).

const DAY_MS = 86_400_000;

/** Giờ chạy hằng ngày (UTC), lệch khỏi đầu giờ để không trùng các job khác. */
const DAILY_CRON = '17 3 * * *';

/** Xóa cứng các tài khoản `pending_deletion` đã đủ hạn; trả số tài khoản đã xóa. */
export async function purgeDeletedAccounts(deps: { db: Database; clock: Clock }): Promise<number> {
  const now = deps.clock.now();
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * DAY_MS);
  return deps.db.transaction(async (tx) => {
    const purged = await deleteExpiredPendingUsers(tx, cutoff);
    if (purged > 0) {
      await incrementMetric(tx, now.toISOString().slice(0, 10), 'accounts_purged', purged);
    }
    return purged;
  });
}

export function createPurgeDeletedAccountsJob(deps: {
  db: Database;
  clock: Clock;
}): JobDefinition<object> {
  return {
    name: QUEUES.purgeDeletedAccounts,
    cron: DAILY_CRON,
    handler: async () => {
      await purgeDeletedAccounts(deps);
    },
  };
}

/** Lệnh `pnpm job:purge`: chạy một lần ngay (vận hành thủ công hoặc kịch bản quickstart K8). */
async function main(): Promise<void> {
  const { loadDotEnv } = await import('../config.js');
  const { createDb } = await import('../db/client.js');
  loadDotEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('Thiếu biến môi trường DATABASE_URL (xem backend/.env.example)');
  const handle = createDb(databaseUrl);
  try {
    const purged = await purgeDeletedAccounts({ db: handle.db, clock: systemClock });
    console.log(`Đã xóa vĩnh viễn ${purged} tài khoản quá hạn chờ xóa.`);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
