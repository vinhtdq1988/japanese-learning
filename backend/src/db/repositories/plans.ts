import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { dailyPlanItems, dailyPlans, learningUnits } from '../schema.js';
import type { ReviewPair } from '../../domain/review-key.js';
import type { I18nText, LocalDate, ReviewFacet, Skill } from '../../domain/types.js';
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

/**
 * Mảng `review_facets` ghi cùng `review_item_ids`: NULL khi mọi phần tử là `item` (mọi gói không có Kanji),
 * nên dòng của người học không có Kanji giống hệt trước spec 003.
 */
export function reviewFacetsColumn(pairs: readonly ReviewPair[]): ReviewFacet[] | null {
  return pairs.some((p) => p.facet !== 'item') ? pairs.map((p) => p.facet) : null;
}

/** Các cặp (mục, khía cạnh) của một mục kế hoạch ôn, theo thứ tự ưu tiên; NULL `review_facets` = mọi phần tử `item`. */
export function reviewPairsOf(
  item: Pick<DailyPlanItemRow, 'reviewItemIds' | 'reviewFacets'>,
): ReviewPair[] {
  const ids = item.reviewItemIds ?? [];
  return ids.map((itemId, i) => ({ itemId, facet: item.reviewFacets?.[i] ?? 'item' }));
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

/**
 * Kỹ năng (`kind`) của các đơn vị trong kế hoạch gần nhất TRƯỚC `before` có ít nhất một mục `new_unit`
 * (research K5: dùng quyết định có đưa bài Kanji lên đầu hôm nay không). Null nếu chưa có kế hoạch nào
 * như vậy (ví dụ ngày đầu sau khi chọn Kanji).
 */
export async function lastNewUnitPlanKinds(
  db: DbExecutor,
  userId: string,
  before: LocalDate,
): Promise<Skill[] | null> {
  const [latest] = await db
    .select({ planId: dailyPlanItems.planId })
    .from(dailyPlanItems)
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanItems.planId))
    .where(
      and(
        eq(dailyPlans.userId, userId),
        lt(dailyPlans.localDate, before),
        eq(dailyPlanItems.type, 'new_unit'),
      ),
    )
    .orderBy(desc(dailyPlans.localDate))
    .limit(1);
  if (!latest) return null;
  const rows = await db
    .select({ kind: learningUnits.kind })
    .from(dailyPlanItems)
    .innerJoin(learningUnits, eq(learningUnits.id, dailyPlanItems.unitId))
    .where(and(eq(dailyPlanItems.planId, latest.planId), eq(dailyPlanItems.type, 'new_unit')));
  return rows.map((r) => r.kind);
}

/** Tiêu đề (i18n) và kỹ năng của các đơn vị theo id – đọc thẳng CSDL, không phụ thuộc bộ đệm. */
export async function getUnitInfo(
  db: DbExecutor,
  unitIds: readonly string[],
): Promise<Map<string, { title: I18nText; kind: Skill }>> {
  if (unitIds.length === 0) return new Map();
  const rows = await db
    .select({ id: learningUnits.id, title: learningUnits.title, kind: learningUnits.kind })
    .from(learningUnits)
    .where(inArray(learningUnits.id, [...unitIds]));
  return new Map(rows.map((r) => [r.id, { title: r.title, kind: r.kind }]));
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

/**
 * Xóa kế hoạch của `(user_id, local_date)` NẾU mọi mục còn `pending` (mục xóa theo cascade; không mất dữ liệu
 * học). Có mục `in_progress/completed` ⇒ giữ nguyên. Dùng khi nguồn học đổi giữa ngày (vào/rời lớp) để học
 * viên thấy ngay kế hoạch đúng nguồn (spec 004, research O6). Trả `true` nếu đã xóa.
 */
export async function deletePlanIfAllPending(
  db: DbExecutor,
  userId: string,
  localDate: LocalDate,
): Promise<boolean> {
  const plan = await findPlan(db, userId, localDate);
  if (!plan) return false;
  const items = await listPlanItems(db, plan.id);
  if (items.some((i) => i.status !== 'pending')) return false;
  await db.delete(dailyPlans).where(eq(dailyPlans.id, plan.id));
  return true;
}
