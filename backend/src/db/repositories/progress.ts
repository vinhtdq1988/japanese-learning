import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  lessonSessions,
  pausePeriods,
  studyIntervals,
  studyRecords,
  topics,
  unitProgress,
} from '../schema.js';
import type { StudyInterval } from '../../domain/intervals.js';
import type { I18nText, LocalDate } from '../../domain/types.js';
import type { PausePeriod } from '../../engine/daily-plan.js';

// Repository số liệu tiến độ và giai đoạn tạm dừng (US4/US5). Mọi truy vấn lọc theo `user_id` lấy từ
// token (R16).

// --- Số liệu tiến độ ---

/** Mọi khoảng thời gian học của người học (đầu vào của hợp khoảng → tổng thời gian, FR-026/041). */
export async function listUserIntervals(db: DbExecutor, userId: string): Promise<StudyInterval[]> {
  return db
    .select({
      startedAt: studyIntervals.startedAt,
      durationSeconds: studyIntervals.durationSeconds,
    })
    .from(studyIntervals)
    .where(eq(studyIntervals.userId, userId));
}

/** Số câu đúng / tổng số câu lượt chính trong ngữ cảnh ôn tập (không tính câu hỏi lại cuối phiên). */
export async function countReviewResults(
  db: DbExecutor,
  userId: string,
): Promise<{ correct: number; total: number }> {
  const [row] = await db
    .select({
      correct: sql<number>`count(*) filter (where ${studyRecords.isCorrect})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(studyRecords)
    .where(
      and(
        eq(studyRecords.userId, userId),
        eq(studyRecords.context, 'review'),
        eq(studyRecords.isRetry, false),
      ),
    );
  return { correct: row?.correct ?? 0, total: row?.total ?? 0 };
}

/** Các ngày địa phương có ít nhất một câu trả lời (R11); ngày lấy từ `local_date` đã lưu lúc xảy ra. */
export async function listActiveDays(db: DbExecutor, userId: string): Promise<Set<LocalDate>> {
  const rows = await db
    .selectDistinct({ day: studyRecords.localDate })
    .from(studyRecords)
    .where(eq(studyRecords.userId, userId));
  return new Set(rows.map((r) => r.day));
}

/** Ngày địa phương học gần nhất (null nếu chưa từng học). */
export async function latestActiveDay(db: DbExecutor, userId: string): Promise<LocalDate | null> {
  const [row] = await db
    .select({ day: sql<string | null>`max(${studyRecords.localDate})::text` })
    .from(studyRecords)
    .where(eq(studyRecords.userId, userId));
  return row?.day ?? null;
}

/** Số đơn vị người học đã hoàn thành (`unit_progress.status = 'completed'`). */
export async function countCompletedUnits(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(unitProgress)
    .where(and(eq(unitProgress.userId, userId), eq(unitProgress.status, 'completed')));
  return row?.n ?? 0;
}

/** Người học đã có bất kỳ dữ liệu học nào (câu trả lời, khoảng thời gian, tiến độ đơn vị) chưa. */
export async function hasAnyStudyData(db: DbExecutor, userId: string): Promise<boolean> {
  const [records, intervals, progress] = await Promise.all([
    db
      .select({ one: sql`1` })
      .from(studyRecords)
      .where(eq(studyRecords.userId, userId))
      .limit(1),
    db
      .select({ one: sql`1` })
      .from(studyIntervals)
      .where(eq(studyIntervals.userId, userId))
      .limit(1),
    db
      .select({ one: sql`1` })
      .from(unitProgress)
      .where(eq(unitProgress.userId, userId))
      .limit(1),
  ]);
  return records.length + intervals.length + progress.length > 0;
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

/** Đơn vị đã từng được hoàn thành qua một phiên học (để bỏ đánh dấu `mastered` trả về `completed`). */
export async function hasCompletedUnitSession(
  db: DbExecutor,
  userId: string,
  unitId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .where(
      and(
        eq(lessonSessions.userId, userId),
        eq(lessonSessions.unitId, unitId),
        eq(lessonSessions.status, 'completed'),
      ),
    )
    .limit(1);
  return row !== undefined;
}

// --- Tạm dừng ---

export async function listPausePeriods(db: DbExecutor, userId: string): Promise<PausePeriod[]> {
  return db
    .select({ startedOn: pausePeriods.startedOn, endedOn: pausePeriods.endedOn })
    .from(pausePeriods)
    .where(eq(pausePeriods.userId, userId));
}

/**
 * Mở giai đoạn tạm dừng từ `startedOn`; không làm gì nếu đã có giai đoạn mở (unique partial index
 * `pause_periods_one_open_idx`). Trả true nếu vừa mở.
 */
export async function openPausePeriod(
  db: DbExecutor,
  userId: string,
  startedOn: LocalDate,
): Promise<boolean> {
  const rows = await db
    .insert(pausePeriods)
    .values({ userId, startedOn })
    .onConflictDoNothing()
    .returning({ id: pausePeriods.id });
  return rows.length > 0;
}

/** Đóng giai đoạn tạm dừng đang mở tại `endedOn`; trả true nếu có giai đoạn được đóng. */
export async function closePausePeriod(
  db: DbExecutor,
  userId: string,
  endedOn: LocalDate,
): Promise<boolean> {
  const rows = await db
    .update(pausePeriods)
    .set({ endedOn })
    .where(and(eq(pausePeriods.userId, userId), isNull(pausePeriods.endedOn)))
    .returning({ id: pausePeriods.id });
  return rows.length > 0;
}
