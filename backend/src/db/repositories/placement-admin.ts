import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { placementQuestions } from '../schema.js';

// Repository quản trị bộ câu hỏi kiểm tra trình độ (T106, data-model §2.5).

export type PlacementQuestionRow = typeof placementQuestions.$inferSelect;

/** Mọi câu hỏi: bộ đang kích hoạt trước (theo `position`), rồi các câu còn lại mới nhất trước. */
export async function listQuestions(db: DbExecutor): Promise<PlacementQuestionRow[]> {
  return db
    .select()
    .from(placementQuestions)
    .orderBy(
      desc(placementQuestions.isActive),
      asc(placementQuestions.position),
      desc(placementQuestions.createdAt),
      asc(placementQuestions.id),
    );
}

export async function getQuestion(
  db: DbExecutor,
  id: string,
): Promise<PlacementQuestionRow | undefined> {
  const [row] = await db
    .select()
    .from(placementQuestions)
    .where(eq(placementQuestions.id, id))
    .limit(1);
  return row;
}

export async function lockQuestion(
  db: DbExecutor,
  id: string,
): Promise<PlacementQuestionRow | undefined> {
  const [row] = await db
    .select()
    .from(placementQuestions)
    .where(eq(placementQuestions.id, id))
    .limit(1)
    .for('update');
  return row;
}

export async function insertQuestion(
  db: DbExecutor,
  values: typeof placementQuestions.$inferInsert,
): Promise<PlacementQuestionRow> {
  const [row] = await db.insert(placementQuestions).values(values).returning();
  return row!;
}

export async function updateQuestion(
  db: DbExecutor,
  id: string,
  values: Partial<typeof placementQuestions.$inferInsert>,
): Promise<PlacementQuestionRow> {
  const [row] = await db
    .update(placementQuestions)
    .set(values)
    .where(eq(placementQuestions.id, id))
    .returning();
  return row!;
}

/** Có câu khác trong bộ đang kích hoạt trùng `position` không. */
export async function activePositionTaken(
  db: DbExecutor,
  position: number,
  exceptId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: placementQuestions.id })
    .from(placementQuestions)
    .where(
      and(
        eq(placementQuestions.isActive, true),
        eq(placementQuestions.position, position),
        ne(placementQuestions.id, exceptId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Tuần tự hóa các lần kích hoạt bộ đồng thời (khóa tư vấn mức giao dịch, tự nhả khi commit/rollback). */
export async function lockActiveSetChange(db: DbExecutor): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('placement_active_set'))`);
}

export async function questionsByIds(
  db: DbExecutor,
  ids: readonly string[],
): Promise<PlacementQuestionRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(placementQuestions)
    .where(inArray(placementQuestions.id, [...ids]));
}

export async function listActiveQuestionIds(db: DbExecutor): Promise<string[]> {
  const rows = await db
    .select({ id: placementQuestions.id })
    .from(placementQuestions)
    .where(eq(placementQuestions.isActive, true))
    .orderBy(asc(placementQuestions.position), asc(placementQuestions.id));
  return rows.map((r) => r.id);
}

export async function deactivateAllQuestions(db: DbExecutor, now: Date): Promise<void> {
  await db
    .update(placementQuestions)
    .set({ isActive: false, updatedAt: now })
    .where(eq(placementQuestions.isActive, true));
}

export async function activateQuestion(
  db: DbExecutor,
  id: string,
  position: number,
  now: Date,
): Promise<void> {
  await db
    .update(placementQuestions)
    .set({ isActive: true, position, updatedAt: now })
    .where(eq(placementQuestions.id, id));
}
