import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  contentItems,
  dailyPlanItems,
  dailyPlans,
  exercises,
  learningUnits,
  lessonSessions,
  studyIntervals,
  studyRecords,
  unitProgress,
} from '../schema.js';
import type { StudyInterval } from '../../domain/intervals.js';
import type { I18nText, Skill } from '../../domain/types.js';
import type { ExerciseSource, ItemSource } from '../../domain/session-snapshot.js';
import type { DailyPlanItemRow, DailyPlanRow } from './plans.js';

// Repository phiên học, bản ghi câu trả lời và khoảng thời gian học (US2). Mọi truy vấn lọc theo
// `user_id` lấy từ token (R16). Các lệnh chèn dùng `ON CONFLICT DO NOTHING` để idempotent (FR-041).

export type SessionRow = typeof lessonSessions.$inferSelect;
export type StudyRecordRow = typeof studyRecords.$inferSelect;

// --- Mục kế hoạch ---

/** Mục kế hoạch cùng kế hoạch chứa nó, chỉ khi thuộc người học (không thì undefined). */
export async function getPlanItemForUser(
  db: DbExecutor,
  userId: string,
  planItemId: string,
): Promise<{ item: DailyPlanItemRow; plan: DailyPlanRow } | undefined> {
  const [row] = await db
    .select({ item: dailyPlanItems, plan: dailyPlans })
    .from(dailyPlanItems)
    .innerJoin(dailyPlans, eq(dailyPlanItems.planId, dailyPlans.id))
    .where(and(eq(dailyPlanItems.id, planItemId), eq(dailyPlans.userId, userId)))
    .limit(1);
  return row;
}

export async function setPlanItemStatus(
  db: DbExecutor,
  planItemId: string,
  status: DailyPlanItemRow['status'],
): Promise<void> {
  await db.update(dailyPlanItems).set({ status }).where(eq(dailyPlanItems.id, planItemId));
}

/** Đặt mục kế hoạch `in_progress` chỉ khi còn `pending` (không lùi mục đã hoàn thành). */
export async function markPlanItemInProgress(db: DbExecutor, planItemId: string): Promise<void> {
  await db
    .update(dailyPlanItems)
    .set({ status: 'in_progress' })
    .where(and(eq(dailyPlanItems.id, planItemId), eq(dailyPlanItems.status, 'pending')));
}

export async function listPlanItemStatuses(
  db: DbExecutor,
  planId: string,
): Promise<DailyPlanItemRow['status'][]> {
  const rows = await db
    .select({ status: dailyPlanItems.status })
    .from(dailyPlanItems)
    .where(eq(dailyPlanItems.planId, planId));
  return rows.map((r) => r.status);
}

export async function markPlanCompleted(db: DbExecutor, planId: string, now: Date): Promise<void> {
  await db
    .update(dailyPlans)
    .set({ status: 'completed', completedAt: now })
    .where(and(eq(dailyPlans.id, planId), ne(dailyPlans.status, 'completed')));
}

// --- Phiên học ---

/** Phiên gần nhất của một mục kế hoạch (tiếp tục phiên dở dang, hoặc xem lại phiên đã xong). */
export async function findSessionForPlanItem(
  db: DbExecutor,
  userId: string,
  planItemId: string,
): Promise<SessionRow | undefined> {
  const [row] = await db
    .select()
    .from(lessonSessions)
    .where(and(eq(lessonSessions.userId, userId), eq(lessonSessions.planItemId, planItemId)))
    .orderBy(desc(lessonSessions.startedAt))
    .limit(1);
  return row;
}

/** Phiên "học thêm" đang dở của một đơn vị (để tiếp tục thay vì tạo trùng). */
export async function findOpenExtraSession(
  db: DbExecutor,
  userId: string,
  unitId: string,
): Promise<SessionRow | undefined> {
  const [row] = await db
    .select()
    .from(lessonSessions)
    .where(
      and(
        eq(lessonSessions.userId, userId),
        eq(lessonSessions.kind, 'extra'),
        eq(lessonSessions.unitId, unitId),
        eq(lessonSessions.status, 'in_progress'),
      ),
    )
    .orderBy(desc(lessonSessions.startedAt))
    .limit(1);
  return row;
}

export async function insertSession(
  db: DbExecutor,
  values: typeof lessonSessions.$inferInsert,
): Promise<SessionRow> {
  const [row] = await db.insert(lessonSessions).values(values).returning();
  return row!;
}

export async function getSession(
  db: DbExecutor,
  userId: string,
  sessionId: string,
  options: { forUpdate?: boolean } = {},
): Promise<SessionRow | undefined> {
  const query = db
    .select()
    .from(lessonSessions)
    .where(and(eq(lessonSessions.id, sessionId), eq(lessonSessions.userId, userId)))
    .limit(1);
  const [row] = await (options.forUpdate ? query.for('update') : query);
  return row;
}

export async function markSessionCompleted(
  db: DbExecutor,
  sessionId: string,
  now: Date,
): Promise<void> {
  await db
    .update(lessonSessions)
    .set({ status: 'completed', completedAt: now })
    .where(eq(lessonSessions.id, sessionId));
}

// --- Nội dung đơn vị (cho snapshot) ---

export interface UnitContentRows {
  unit: { id: string; kind: Skill; title: I18nText; topicId: string };
  items: ItemSource[];
  exercises: ExerciseSource[];
}

/** Đơn vị `active` cùng mục và bài tập của nó; undefined nếu đơn vị không còn `active`. */
export async function loadActiveUnitContent(
  db: DbExecutor,
  unitId: string,
): Promise<UnitContentRows | undefined> {
  const [unit] = await db
    .select()
    .from(learningUnits)
    .where(and(eq(learningUnits.id, unitId), eq(learningUnits.status, 'active')))
    .limit(1);
  if (!unit) return undefined;

  const [itemRows, exerciseRows] = await Promise.all([
    db.select().from(contentItems).where(eq(contentItems.unitId, unitId)),
    db.select().from(exercises).where(eq(exercises.unitId, unitId)),
  ]);
  return {
    unit: { id: unit.id, kind: unit.kind, title: unit.title, topicId: unit.topicId },
    items: itemRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      japanese: r.japanese,
      reading: r.reading,
      meaning: r.meaning,
      explanation: r.explanation,
      examples: r.examples,
      topicId: r.topicId,
      kanjiDetails: r.kanjiDetails,
      position: r.position,
      status: r.status,
    })),
    exercises: exerciseRows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      topicId: unit.topicId,
      facet: r.facet,
      type: r.type,
      prompt: r.prompt,
      payload: r.payload,
      feedbackCorrect: r.feedbackCorrect,
      feedbackIncorrect: r.feedbackIncorrect,
      position: r.position,
      status: r.status,
    })),
  };
}

// --- Tiến độ đơn vị ---

/**
 * Đặt `in_progress` khi bắt đầu học một đơn vị chưa có dòng tiến độ. Đơn vị đã `completed`/`mastered`
 * giữ nguyên (không lùi trạng thái).
 */
export async function ensureUnitInProgress(
  db: DbExecutor,
  userId: string,
  unitId: string,
  now: Date,
): Promise<void> {
  await db
    .insert(unitProgress)
    .values({ userId, unitId, status: 'in_progress', updatedAt: now })
    .onConflictDoNothing({ target: [unitProgress.userId, unitProgress.unitId] });
}

/** Đặt `completed`; đơn vị người học đã đánh dấu `mastered` giữ nguyên. */
export async function markUnitCompleted(
  db: DbExecutor,
  userId: string,
  unitId: string,
  now: Date,
): Promise<void> {
  await db
    .insert(unitProgress)
    .values({ userId, unitId, status: 'completed', updatedAt: now })
    .onConflictDoUpdate({
      target: [unitProgress.userId, unitProgress.unitId],
      set: { status: 'completed', updatedAt: now },
      setWhere: ne(unitProgress.status, 'mastered'),
    });
}

// --- Câu trả lời ---

/**
 * Chèn bản ghi câu trả lời. `ON CONFLICT DO NOTHING` (không chỉ định đích) bao cả hai ràng buộc
 * idempotent: `(user_id, client_event_id)` và lượt chính duy nhất `(session_id, exercise_id)`.
 * Trả null khi trùng (người gọi đọc lại bản ghi đã có).
 */
export async function insertStudyRecord(
  db: DbExecutor,
  values: typeof studyRecords.$inferInsert,
): Promise<StudyRecordRow | null> {
  const [row] = await db.insert(studyRecords).values(values).onConflictDoNothing().returning();
  return row ?? null;
}

export async function findRecordByClientEvent(
  db: DbExecutor,
  userId: string,
  clientEventId: string,
): Promise<StudyRecordRow | undefined> {
  const [row] = await db
    .select()
    .from(studyRecords)
    .where(and(eq(studyRecords.userId, userId), eq(studyRecords.clientEventId, clientEventId)))
    .limit(1);
  return row;
}

export async function findPrimaryRecord(
  db: DbExecutor,
  sessionId: string,
  exerciseId: string,
): Promise<StudyRecordRow | undefined> {
  const [row] = await db
    .select()
    .from(studyRecords)
    .where(
      and(
        eq(studyRecords.sessionId, sessionId),
        eq(studyRecords.exerciseId, exerciseId),
        eq(studyRecords.isRetry, false),
      ),
    )
    .limit(1);
  return row;
}

/** Các câu đã trả lời lượt chính trong phiên, theo thứ tự trả lời. */
export async function listPrimaryRecords(
  db: DbExecutor,
  sessionId: string,
): Promise<Pick<StudyRecordRow, 'exerciseId' | 'isCorrect'>[]> {
  return db
    .select({ exerciseId: studyRecords.exerciseId, isCorrect: studyRecords.isCorrect })
    .from(studyRecords)
    .where(and(eq(studyRecords.sessionId, sessionId), eq(studyRecords.isRetry, false)))
    .orderBy(asc(studyRecords.occurredAt), asc(studyRecords.id));
}

// --- Khoảng thời gian học ---

/** Chèn khoảng thời gian; trả false khi `(user_id, client_event_id)` đã có (idempotent). */
export async function insertStudyInterval(
  db: DbExecutor,
  values: typeof studyIntervals.$inferInsert,
): Promise<boolean> {
  const rows = await db
    .insert(studyIntervals)
    .values(values)
    .onConflictDoNothing({ target: [studyIntervals.userId, studyIntervals.clientEventId] })
    .returning({ id: studyIntervals.id });
  return rows.length > 0;
}

export async function listSessionIntervals(
  db: DbExecutor,
  sessionIds: readonly string[],
): Promise<StudyInterval[]> {
  if (sessionIds.length === 0) return [];
  return db
    .select({
      startedAt: studyIntervals.startedAt,
      durationSeconds: studyIntervals.durationSeconds,
    })
    .from(studyIntervals)
    .where(inArray(studyIntervals.sessionId, [...sessionIds]));
}

// --- Tóm tắt kế hoạch ngày ---

/** Mọi phiên gắn với các mục của một kế hoạch ngày. */
export async function listPlanSessionIds(db: DbExecutor, planId: string): Promise<string[]> {
  const rows = await db
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .innerJoin(dailyPlanItems, eq(lessonSessions.planItemId, dailyPlanItems.id))
    .where(eq(dailyPlanItems.planId, planId));
  return rows.map((r) => r.id);
}

/** Id các mục có ít nhất một câu lượt chính trả lời sai trong phiên (không tính câu hỏi lại cuối phiên). */
export async function listIncorrectItemIds(db: DbExecutor, sessionId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ itemId: studyRecords.itemId })
    .from(studyRecords)
    .where(
      and(
        eq(studyRecords.sessionId, sessionId),
        eq(studyRecords.isRetry, false),
        eq(studyRecords.isCorrect, false),
        isNotNull(studyRecords.itemId),
      ),
    );
  return rows.flatMap((r) => (r.itemId ? [r.itemId] : []));
}

/** Số câu đúng / tổng số câu lượt chính của các phiên (không tính câu hỏi lại cuối phiên). */
export async function countPrimaryResults(
  db: DbExecutor,
  sessionIds: readonly string[],
): Promise<{ correct: number; total: number }> {
  if (sessionIds.length === 0) return { correct: 0, total: 0 };
  const [row] = await db
    .select({
      correct: sql<number>`count(*) filter (where ${studyRecords.isCorrect})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(studyRecords)
    .where(and(inArray(studyRecords.sessionId, [...sessionIds]), eq(studyRecords.isRetry, false)));
  return { correct: row?.correct ?? 0, total: row?.total ?? 0 };
}
