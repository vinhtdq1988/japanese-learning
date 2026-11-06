import { and, eq, exists, inArray, isNull, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  contentItems,
  learningUnits,
  lessonSessions,
  pausePeriods,
  reviewSchedules,
  studyIntervals,
  studyRecords,
  topics,
  unitProgress,
} from '../schema.js';
import type { StudyInterval } from '../../domain/intervals.js';
import type { I18nText, LocalDate, Skill } from '../../domain/types.js';
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

/** Kỹ năng (`skill`) của các mảng theo id (nhãn kỹ năng của mảng yếu – research K4). */
export async function getTopicSkills(
  db: DbExecutor,
  topicIds: readonly string[],
): Promise<Map<string, Skill>> {
  if (topicIds.length === 0) return new Map();
  const rows = await db
    .select({ id: topics.id, skill: topics.skill })
    .from(topics)
    .where(inArray(topics.id, [...topicIds]));
  return new Map(rows.map((r) => [r.id, r.skill]));
}

// --- Số liệu Kanji (spec 003, research K8, data-model §4.1) ---

/**
 * Số chữ Kanji đã học: số `item_id` Kanji khác nhau có ≥ 1 dòng `review_schedules` VÀ đơn vị chứa chữ đã được
 * người học hoàn thành (chữ trong bài dở dang chưa tính). Tính cả chữ đã đánh dấu thành thạo, chữ/bài đã ngừng,
 * và bài đã hoàn thành rồi đánh dấu thành thạo (vẫn có phiên `completed`).
 */
export async function countKanjiCharactersLearned(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${reviewSchedules.itemId})`.mapWith(Number) })
    .from(reviewSchedules)
    .innerJoin(contentItems, eq(contentItems.id, reviewSchedules.itemId))
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        eq(contentItems.kind, 'kanji'),
        exists(
          db
            .select({ one: sql`1` })
            .from(lessonSessions)
            .where(
              and(
                eq(lessonSessions.userId, userId),
                eq(lessonSessions.unitId, contentItems.unitId),
                eq(lessonSessions.status, 'completed'),
              ),
            ),
        ),
      ),
    );
  return row?.n ?? 0;
}

/** Số bài Kanji đã hoàn thành (`unit_progress.status = 'completed'` của đơn vị `kind = 'kanji'`). */
export async function countKanjiLessonsCompleted(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(unitProgress)
    .innerJoin(learningUnits, eq(learningUnits.id, unitProgress.unitId))
    .where(
      and(
        eq(unitProgress.userId, userId),
        eq(unitProgress.status, 'completed'),
        eq(learningUnits.kind, 'kanji'),
      ),
    );
  return row?.n ?? 0;
}

/** Khoảng thời gian học của các phiên bài Kanji (`new_unit`/`extra` của đơn vị `kind = 'kanji'`). */
export async function listKanjiLessonIntervals(
  db: DbExecutor,
  userId: string,
): Promise<StudyInterval[]> {
  return db
    .select({
      startedAt: studyIntervals.startedAt,
      durationSeconds: studyIntervals.durationSeconds,
    })
    .from(studyIntervals)
    .innerJoin(lessonSessions, eq(lessonSessions.id, studyIntervals.sessionId))
    .innerJoin(learningUnits, eq(learningUnits.id, lessonSessions.unitId))
    .where(and(eq(studyIntervals.userId, userId), eq(learningUnits.kind, 'kanji')));
}

/** Một phiên ôn hỗn hợp có câu Kanji: thời gian của phiên và số câu lượt chính Kanji / tổng. */
export interface ReviewSessionKanjiShare {
  sessionId: string;
  kanjiPrimary: number;
  totalPrimary: number;
  intervals: StudyInterval[];
}

/**
 * Các phiên ôn (`kind = 'review'`) có ít nhất một câu lượt chính Kanji, kèm khoảng thời gian của từng phiên để
 * phân bổ theo tỷ lệ câu Kanji (research K8; `allocateKanjiSeconds`).
 */
export async function listReviewSessionKanjiShares(
  db: DbExecutor,
  userId: string,
): Promise<ReviewSessionKanjiShare[]> {
  const kanjiCount = sql`count(*) filter (where ${contentItems.kind} = 'kanji')`;
  const counts = await db
    .select({
      sessionId: studyRecords.sessionId,
      kanjiPrimary: sql<number>`${kanjiCount}`.mapWith(Number),
      totalPrimary: sql<number>`count(*)`.mapWith(Number),
    })
    .from(studyRecords)
    .innerJoin(lessonSessions, eq(lessonSessions.id, studyRecords.sessionId))
    .leftJoin(contentItems, eq(contentItems.id, studyRecords.itemId))
    .where(
      and(
        eq(studyRecords.userId, userId),
        eq(lessonSessions.kind, 'review'),
        eq(studyRecords.isRetry, false),
      ),
    )
    .groupBy(studyRecords.sessionId)
    .having(sql`${kanjiCount} > 0`);
  if (counts.length === 0) return [];

  const intervalRows = await db
    .select({
      sessionId: studyIntervals.sessionId,
      startedAt: studyIntervals.startedAt,
      durationSeconds: studyIntervals.durationSeconds,
    })
    .from(studyIntervals)
    .where(
      inArray(
        studyIntervals.sessionId,
        counts.map((c) => c.sessionId),
      ),
    );
  return counts.map((c) => ({
    ...c,
    intervals: intervalRows
      .filter((r) => r.sessionId === c.sessionId)
      .map(({ startedAt, durationSeconds }) => ({ startedAt, durationSeconds })),
  }));
}

/** Số câu đúng / tổng câu lượt chính ngữ cảnh ôn của mục Kanji (gộp các khía cạnh – "tính theo chữ"). */
export async function countKanjiReviewResults(
  db: DbExecutor,
  userId: string,
): Promise<{ correct: number; total: number }> {
  const [row] = await db
    .select({
      correct: sql<number>`count(*) filter (where ${studyRecords.isCorrect})`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(studyRecords)
    .innerJoin(contentItems, eq(contentItems.id, studyRecords.itemId))
    .where(
      and(
        eq(studyRecords.userId, userId),
        eq(studyRecords.context, 'review'),
        eq(studyRecords.isRetry, false),
        eq(contentItems.kind, 'kanji'),
      ),
    );
  return { correct: row?.correct ?? 0, total: row?.total ?? 0 };
}

/** Người học đã có dữ liệu học Kanji nào chưa (câu trả lời mục Kanji, hoặc tiến độ đơn vị Kanji). */
export async function hasKanjiStudyData(db: DbExecutor, userId: string): Promise<boolean> {
  const [records, progress] = await Promise.all([
    db
      .select({ one: sql`1` })
      .from(studyRecords)
      .innerJoin(contentItems, eq(contentItems.id, studyRecords.itemId))
      .where(and(eq(studyRecords.userId, userId), eq(contentItems.kind, 'kanji')))
      .limit(1),
    db
      .select({ one: sql`1` })
      .from(unitProgress)
      .innerJoin(learningUnits, eq(learningUnits.id, unitProgress.unitId))
      .where(and(eq(unitProgress.userId, userId), eq(learningUnits.kind, 'kanji')))
      .limit(1),
  ]);
  return records.length + progress.length > 0;
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
