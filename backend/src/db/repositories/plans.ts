import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { dailyPlanItems, dailyPlans, learningUnits } from '../schema.js';
import type { I18nText, LocalDate } from '../../domain/types.js';
import type { PlanDayKind } from '../../engine/daily-plan.js';

// Repository kế hoạch hằng ngày. Kế hoạch sinh một lần mỗi (user_id, local_date) và lưu lại, nên
// idempotent và không đổi khi nội dung đổi trong ngày.

export type DailyPlanRow = typeof dailyPlans.$inferSelect;
export type DailyPlanItemRow = typeof dailyPlanItems.$inferSelect;

export async function findPlan(
  db: DbExecutor,
  userId: string,
  localDate: LocalDate,
): Promise<DailyPlanRow | undefined> {
  const [row] = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.localDate, localDate)))
    .limit(1);
  return row;
}

export async function listPlanItems(db: DbExecutor, planId: string): Promise<DailyPlanItemRow[]> {
  return db
    .select()
    .from(dailyPlanItems)
    .where(eq(dailyPlanItems.planId, planId))
    .orderBy(asc(dailyPlanItems.position));
}

/**
 * Chèn kế hoạch nếu chưa có cho `(user_id, local_date)`. Trả null khi một yêu cầu đồng thời đã tạo
 * trước (người gọi đọc lại kế hoạch đã có).
 */
export async function insertPlanIfAbsent(
  db: DbExecutor,
  values: typeof dailyPlans.$inferInsert,
): Promise<DailyPlanRow | null> {
  const [row] = await db
    .insert(dailyPlans)
    .values(values)
    .onConflictDoNothing({ target: [dailyPlans.userId, dailyPlans.localDate] })
    .returning();
  return row ?? null;
}

export async function insertPlanItems(
  db: DbExecutor,
  values: (typeof dailyPlanItems.$inferInsert)[],
): Promise<DailyPlanItemRow[]> {
  if (values.length === 0) return [];
  return db.insert(dailyPlanItems).values(values).returning();
}

/** Loại kế hoạch của ngày liền trước (kế hoạch gần nhất có `local_date` < `before`), null nếu chưa có. */
export async function previousPlanKind(
  db: DbExecutor,
  userId: string,
  before: LocalDate,
): Promise<PlanDayKind | null> {
  const [prev] = await db
    .select({ id: dailyPlans.id })
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), lt(dailyPlans.localDate, before)))
    .orderBy(desc(dailyPlans.localDate))
    .limit(1);
  if (!prev) return null;
  const items = await db
    .select({ type: dailyPlanItems.type })
    .from(dailyPlanItems)
    .where(eq(dailyPlanItems.planId, prev.id));
  if (items.length === 0) return 'empty';
  const hasReview = items.some((i) => i.type === 'review_batch');
  const hasNew = items.some((i) => i.type === 'new_unit');
  if (hasReview && hasNew) return 'mixed';
  return hasReview ? 'review_only' : 'new_only';
}

/** Tiêu đề (i18n) của các đơn vị theo id – đọc thẳng CSDL để kế hoạch đã lưu không phụ thuộc bộ đệm. */
export async function getUnitTitles(
  db: DbExecutor,
  unitIds: readonly string[],
): Promise<Map<string, I18nText>> {
  if (unitIds.length === 0) return new Map();
  const rows = await db
    .select({ id: learningUnits.id, title: learningUnits.title })
    .from(learningUnits)
    .where(inArray(learningUnits.id, [...unitIds]));
  return new Map(rows.map((r) => [r.id, r.title]));
}
