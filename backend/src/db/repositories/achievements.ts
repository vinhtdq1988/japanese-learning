import { eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { dailyCompletionCelebrations, earnedAchievements } from '../schema.js';
import type { LocalDate } from '../../domain/types.js';

// Repository thành tựu đã đạt và đánh dấu chúc mừng hoàn thành ngày (spec 005, data-model §1.2–1.3). Mọi truy
// vấn lọc theo `user_id` lấy từ token (R16). Bảng chỉ THÊM, không xóa/sửa trong luồng ứng dụng (FR-017a).

export interface NewAchievementRow {
  code: string;
  source: 'earned' | 'silent';
}

/** Mã thành tựu người học đã đạt (≤ số mốc của danh mục). */
export async function listEarnedCodes(db: DbExecutor, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ code: earnedAchievements.achievementCode })
    .from(earnedAchievements)
    .where(eq(earnedAchievements.userId, userId));
  return new Set(rows.map((r) => r.code));
}

/**
 * Ghi các mốc; `ON CONFLICT DO NOTHING` nên hai giao dịch đồng thời cùng đạt một mốc chỉ chèn được một
 * dòng. Trả tập mã THỰC SỰ được chèn bởi lời gọi này (người gọi chỉ chúc mừng các mốc ở trong tập đó).
 */
export async function insertAchievements(
  db: DbExecutor,
  userId: string,
  rows: readonly NewAchievementRow[],
  now: Date,
): Promise<Set<string>> {
  if (rows.length === 0) return new Set();
  const inserted = await db
    .insert(earnedAchievements)
    .values(rows.map((r) => ({ userId, achievementCode: r.code, earnedAt: now, source: r.source })))
    .onConflictDoNothing({
      target: [earnedAchievements.userId, earnedAchievements.achievementCode],
    })
    .returning({ code: earnedAchievements.achievementCode });
  return new Set(inserted.map((r) => r.code));
}

/** Đánh dấu đã chúc mừng hoàn thành ngày `localDate`; trả true nếu đây là lần đầu (chèn được dòng). */
export async function markDayCelebrated(
  db: DbExecutor,
  userId: string,
  localDate: LocalDate,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .insert(dailyCompletionCelebrations)
    .values({ userId, localDate, celebratedAt: now })
    .onConflictDoNothing({
      target: [dailyCompletionCelebrations.userId, dailyCompletionCelebrations.localDate],
    })
    .returning({ one: sql<number>`1` });
  return rows.length > 0;
}
