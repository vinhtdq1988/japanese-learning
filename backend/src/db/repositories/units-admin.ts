import { and, asc, eq, ne } from 'drizzle-orm';
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

/** Mọi mảng nội dung (tùy chọn lọc theo kỹ năng), theo trình độ rồi kỹ năng. */
export async function listTopics(
  db: DbExecutor,
  filters: { skill?: TopicRow['skill'] } = {},
): Promise<TopicRow[]> {
  return db
    .select()
    .from(topics)
    .where(filters.skill ? eq(topics.skill, filters.skill) : undefined)
    .orderBy(asc(topics.level), asc(topics.skill), asc(topics.createdAt), asc(topics.id));
}

export async function getTopic(db: DbExecutor, id: string): Promise<TopicRow | undefined> {
  const [row] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  return row;
}

/** Đơn vị `active` đang chứa một mục chính (cho quy tắc "mục chính duy nhất", FR-007, research K10/D4). */
export interface KanjiHolder {
  unitId: string;
  /** Định danh dễ đọc của đơn vị trong thông báo lỗi (tiêu đề tiếng Anh; DB không có slug). */
  unitSlug: string;
}

/** Loại đơn vị có quy tắc mục chính duy nhất qua Admin: Kanji, từ vựng, ngữ pháp. */
export type PrimaryItemKind = 'kanji' | 'vocabulary' | 'grammar';

/**
 * Khóa mục chính của mục `active` trong các đơn vị `active` CÙNG LOẠI, kèm đơn vị chứa: Kanji = ký tự;
 * từ vựng = `japanese|reading`; ngữ pháp = `japanese`. `excludeUnitId` loại đơn vị đang kiểm tra để mục của
 * chính nó không bị tính là trùng.
 */
export async function listActiveItemKeys(
  db: DbExecutor,
  excludeUnitId: string | undefined,
  kind: PrimaryItemKind,
): Promise<Map<string, KanjiHolder>> {
  const rows = await db
    .select({
      japanese: contentItems.japanese,
      reading: contentItems.reading,
      unitId: learningUnits.id,
      title: learningUnits.title,
    })
    .from(contentItems)
    .innerJoin(learningUnits, eq(contentItems.unitId, learningUnits.id))
    .where(
      and(
        eq(learningUnits.kind, kind),
        eq(learningUnits.status, 'active'),
        eq(contentItems.kind, kind),
        eq(contentItems.status, 'active'),
        excludeUnitId ? ne(learningUnits.id, excludeUnitId) : undefined,
      ),
    )
    .orderBy(asc(learningUnits.createdAt), asc(learningUnits.id));
  const holders = new Map<string, KanjiHolder>();
  for (const r of rows) {
    const key = kind === 'vocabulary' ? `${r.japanese}|${r.reading ?? ''}` : r.japanese;
    if (!holders.has(key)) {
      holders.set(key, { unitId: r.unitId, unitSlug: r.title.en || r.unitId });
    }
  }
  return holders;
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
