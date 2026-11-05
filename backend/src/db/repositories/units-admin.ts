import { and, asc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { contentItems, exercises, learningUnits, topics } from '../schema.js';

// Repository nội dung cho Admin API (T104). Mục và bài tập KHÔNG bao giờ bị xóa cứng: bị gỡ khỏi payload
// thì chuyển `inactive` để khóa ngoại từ `study_records`/`review_schedules` luôn hợp lệ (data-model §2.10).

export type UnitRow = typeof learningUnits.$inferSelect;
export type ItemRow = typeof contentItems.$inferSelect;
export type ExerciseRow = typeof exercises.$inferSelect;
export type TopicRow = typeof topics.$inferSelect;

export interface UnitFilters {
  status?: UnitRow['status'];
  level?: UnitRow['level'];
  kind?: UnitRow['kind'];
}

export async function listUnits(db: DbExecutor, filters: UnitFilters): Promise<UnitRow[]> {
  const conditions = [];
  if (filters.status) conditions.push(eq(learningUnits.status, filters.status));
  if (filters.level) conditions.push(eq(learningUnits.level, filters.level));
  if (filters.kind) conditions.push(eq(learningUnits.kind, filters.kind));
  return db
    .select()
    .from(learningUnits)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(learningUnits.level),
      asc(learningUnits.kind),
      asc(learningUnits.sequence),
      asc(learningUnits.createdAt),
      asc(learningUnits.id),
    );
}

export async function getUnit(db: DbExecutor, id: string): Promise<UnitRow | undefined> {
  const [row] = await db.select().from(learningUnits).where(eq(learningUnits.id, id)).limit(1);
  return row;
}

/** Khóa hàng đơn vị (`FOR UPDATE`): hai admin sửa cùng đơn vị được tuần tự hóa. */
export async function lockUnit(db: DbExecutor, id: string): Promise<UnitRow | undefined> {
  const [row] = await db
    .select()
    .from(learningUnits)
    .where(eq(learningUnits.id, id))
    .limit(1)
    .for('update');
  return row;
}

/** Mọi mảng nội dung, theo trình độ rồi kỹ năng. */
export async function listTopics(db: DbExecutor): Promise<TopicRow[]> {
  return db
    .select()
    .from(topics)
    .orderBy(asc(topics.level), asc(topics.skill), asc(topics.createdAt), asc(topics.id));
}

export async function getTopic(db: DbExecutor, id: string): Promise<TopicRow | undefined> {
  const [row] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  return row;
}

/** Mọi mục của đơn vị (cả `inactive`), theo `position`. */
export async function listItems(db: DbExecutor, unitId: string): Promise<ItemRow[]> {
  return db
    .select()
    .from(contentItems)
    .where(eq(contentItems.unitId, unitId))
    .orderBy(asc(contentItems.position), asc(contentItems.createdAt), asc(contentItems.id));
}

/** Mọi bài tập của đơn vị (cả `inactive`), theo `position`. */
export async function listExercises(db: DbExecutor, unitId: string): Promise<ExerciseRow[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.unitId, unitId))
    .orderBy(asc(exercises.position), asc(exercises.createdAt), asc(exercises.id));
}

export async function insertUnit(
  db: DbExecutor,
  values: typeof learningUnits.$inferInsert,
): Promise<UnitRow> {
  const [row] = await db.insert(learningUnits).values(values).returning();
  return row!;
}

export async function updateUnit(
  db: DbExecutor,
  id: string,
  values: Partial<typeof learningUnits.$inferInsert>,
): Promise<void> {
  await db.update(learningUnits).set(values).where(eq(learningUnits.id, id));
}

export async function insertItem(
  db: DbExecutor,
  values: typeof contentItems.$inferInsert,
): Promise<ItemRow> {
  const [row] = await db.insert(contentItems).values(values).returning();
  return row!;
}

export async function updateItem(
  db: DbExecutor,
  id: string,
  values: Partial<typeof contentItems.$inferInsert>,
): Promise<void> {
  await db.update(contentItems).set(values).where(eq(contentItems.id, id));
}

export async function insertExercise(
  db: DbExecutor,
  values: typeof exercises.$inferInsert,
): Promise<ExerciseRow> {
  const [row] = await db.insert(exercises).values(values).returning();
  return row!;
}

export async function updateExercise(
  db: DbExecutor,
  id: string,
  values: Partial<typeof exercises.$inferInsert>,
): Promise<void> {
  await db.update(exercises).set(values).where(eq(exercises.id, id));
}
