import { and, desc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { learningPaths, topicStats, unitProgress } from '../schema.js';
import type { UnitProgressStatus, TopicStatInput } from '../../engine/path.js';

// Repository lộ trình (chỉ lưu tham số sinh), tiến độ đơn vị và thống kê mảng.

export type LearningPathRow = typeof learningPaths.$inferSelect;

export async function getActivePath(
  db: DbExecutor,
  userId: string,
): Promise<LearningPathRow | undefined> {
  const [row] = await db
    .select()
    .from(learningPaths)
    .where(and(eq(learningPaths.userId, userId), eq(learningPaths.status, 'active')))
    .orderBy(desc(learningPaths.createdAt))
    .limit(1);
  return row;
}

/** Đặt lộ trình đang hoạt động thành `superseded` (không đụng tiến độ/lịch sử học). */
export async function supersedeActivePath(db: DbExecutor, userId: string): Promise<void> {
  await db
    .update(learningPaths)
    .set({ status: 'superseded' })
    .where(and(eq(learningPaths.userId, userId), eq(learningPaths.status, 'active')));
}

export async function insertPath(
  db: DbExecutor,
  values: typeof learningPaths.$inferInsert,
): Promise<LearningPathRow> {
  const [row] = await db.insert(learningPaths).values(values).returning();
  return row!;
}

/** Trạng thái học từng đơn vị của người học (không có dòng = chưa học). */
export async function loadUnitProgress(
  db: DbExecutor,
  userId: string,
): Promise<Map<string, UnitProgressStatus>> {
  const rows = await db
    .select({ unitId: unitProgress.unitId, status: unitProgress.status })
    .from(unitProgress)
    .where(eq(unitProgress.userId, userId));
  return new Map(rows.map((r) => [r.unitId, r.status]));
}

/** Đặt trạng thái tiến độ của một đơn vị (chèn hoặc cập nhật). */
export async function setUnitProgress(
  db: DbExecutor,
  userId: string,
  unitId: string,
  status: UnitProgressStatus,
  now: Date,
): Promise<void> {
  await db
    .insert(unitProgress)
    .values({ userId, unitId, status, updatedAt: now })
    .onConflictDoUpdate({
      target: [unitProgress.userId, unitProgress.unitId],
      set: { status, updatedAt: now },
    });
}

/** Xóa dòng tiến độ của một đơn vị (trở về "chưa học"). */
export async function deleteUnitProgress(
  db: DbExecutor,
  userId: string,
  unitId: string,
): Promise<void> {
  await db
    .delete(unitProgress)
    .where(and(eq(unitProgress.userId, userId), eq(unitProgress.unitId, unitId)));
}

export async function loadTopicStats(db: DbExecutor, userId: string): Promise<TopicStatInput[]> {
  const rows = await db
    .select({
      topicId: topicStats.topicId,
      isWeak: topicStats.isWeak,
      difficultyBias: topicStats.difficultyBias,
    })
    .from(topicStats)
    .where(eq(topicStats.userId, userId));
  return rows;
}
