import { eq, sql } from 'drizzle-orm';
import type { Database, DbExecutor } from '../client.js';
import { joinCodeAttempts } from '../schema.js';

// Bộ đếm nhập mã tham gia theo TÀI KHOẢN (spec 004, research O4, data-model §3.15). Mỗi lần nhập được tính
// TRƯỚC khi tra mã và cam kết riêng (không nằm trong giao dịch nghiệp vụ có thể hoàn tác), nên nhập song song
// hay nhập lại sau khi lỗi đều không vượt ngưỡng; mã đúng thì xóa bộ đếm.

export type AttemptResult = { allowed: true } | { allowed: false; lockedUntil: Date };

/**
 * Ghi nhận một lần nhập mã và quyết định có cho thử hay không. Đang bị khóa ⇒ từ chối, không tính thêm. Hết
 * cửa sổ `lockMinutes` kể từ lần đầu ⇒ đếm lại từ 1. Lần thử thứ `maxFailures + 1` trong cửa sổ ⇒ khóa
 * `lockMinutes` và từ chối. Khóa dòng bằng `FOR UPDATE` để các lần nhập song song được tuần tự hóa.
 */
export async function registerJoinAttempt(
  db: Database,
  userId: string,
  now: Date,
  maxFailures: number,
  lockMinutes: number,
): Promise<AttemptResult> {
  return db.transaction(async (tx) => {
    await tx
      .insert(joinCodeAttempts)
      .values({ userId, failures: 0, windowStartedAt: now })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(joinCodeAttempts)
      .where(eq(joinCodeAttempts.userId, userId))
      .for('update')
      .limit(1);
    if (!row) return { allowed: true as const };
    if (row.lockedUntil && row.lockedUntil > now) {
      return { allowed: false as const, lockedUntil: row.lockedUntil };
    }
    const windowMs = lockMinutes * 60_000;
    const expired = now.getTime() - row.windowStartedAt.getTime() >= windowMs;
    const failures = (expired ? 0 : row.failures) + 1;
    const windowStartedAt = expired ? now : row.windowStartedAt;
    if (failures > maxFailures) {
      const lockedUntil = new Date(now.getTime() + windowMs);
      await tx
        .update(joinCodeAttempts)
        .set({ failures, windowStartedAt, lockedUntil })
        .where(eq(joinCodeAttempts.userId, userId));
      return { allowed: false as const, lockedUntil };
    }
    await tx
      .update(joinCodeAttempts)
      .set({ failures, windowStartedAt, lockedUntil: null })
      .where(eq(joinCodeAttempts.userId, userId));
    return { allowed: true as const };
  });
}

/** Mã đúng ⇒ xóa bộ đếm của tài khoản. */
export async function clearJoinAttempts(db: DbExecutor, userId: string): Promise<void> {
  await db.delete(joinCodeAttempts).where(eq(joinCodeAttempts.userId, userId));
}

/** Số lần đang đếm (kiểm thử). */
export async function joinAttemptFailures(db: DbExecutor, userId: string): Promise<number> {
  const result = await db.execute<{ failures: number }>(
    sql`SELECT failures FROM join_code_attempts WHERE user_id = ${userId}`,
  );
  return result.rows[0]?.failures ?? 0;
}
