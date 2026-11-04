import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { placementQuestions, placementResults, topics } from '../schema.js';
import type { I18nText } from '../../domain/types.js';

// Repository bộ câu hỏi và kết quả kiểm tra trình độ.

export type PlacementQuestionRow = typeof placementQuestions.$inferSelect;
export type PlacementResultRow = typeof placementResults.$inferSelect;

/** Bộ câu hỏi đang kích hoạt, theo `position`. */
export async function listActiveQuestions(db: DbExecutor): Promise<PlacementQuestionRow[]> {
  return db
    .select()
    .from(placementQuestions)
    .where(eq(placementQuestions.isActive, true))
    .orderBy(asc(placementQuestions.position));
}

/** Tên (i18n) của các mảng theo id. */
export async function getTopicNames(
  db: DbExecutor,
  topicIds: readonly string[],
): Promise<Map<string, I18nText>> {
  if (topicIds.length === 0) return new Map();
  const rows = await db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(inArray(topics.id, [...topicIds]));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function getCurrentPlacement(
  db: DbExecutor,
  userId: string,
): Promise<PlacementResultRow | undefined> {
  const [row] = await db
    .select()
    .from(placementResults)
    .where(and(eq(placementResults.userId, userId), eq(placementResults.isCurrent, true)))
    .limit(1);
  return row;
}

export async function getPlacementById(
  db: DbExecutor,
  userId: string,
  id: string,
): Promise<PlacementResultRow | undefined> {
  const [row] = await db
    .select()
    .from(placementResults)
    .where(and(eq(placementResults.userId, userId), eq(placementResults.id, id)))
    .limit(1);
  return row;
}

/** Bỏ cờ hiện hành của mọi kết quả cũ (kết quả cũ giữ làm lịch sử, FR-009). */
export async function clearCurrentPlacement(db: DbExecutor, userId: string): Promise<void> {
  await db
    .update(placementResults)
    .set({ isCurrent: false })
    .where(and(eq(placementResults.userId, userId), eq(placementResults.isCurrent, true)));
}

export async function insertPlacementResult(
  db: DbExecutor,
  values: typeof placementResults.$inferInsert,
): Promise<PlacementResultRow> {
  const [row] = await db.insert(placementResults).values(values).returning();
  return row!;
}

export async function markPlacementCurrent(db: DbExecutor, id: string): Promise<void> {
  await db.update(placementResults).set({ isCurrent: true }).where(eq(placementResults.id, id));
}
