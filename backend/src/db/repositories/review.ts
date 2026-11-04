import { and, desc, eq, exists, inArray, lte, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  contentItems,
  exercises,
  learningUnits,
  reviewSchedules,
  studyRecords,
} from '../schema.js';
import type { ExerciseSource, ItemSource } from '../../domain/session-snapshot.js';
import type { LocalDate } from '../../domain/types.js';
import type { DueReviewItem } from '../../engine/daily-plan.js';
import type { SrsState } from '../../engine/srs.js';

// Repository lịch ôn tập (US3, data-model §2.16). Mọi truy vấn lọc theo `user_id` lấy từ token (R16).

export type ReviewScheduleRow = typeof reviewSchedules.$inferSelect;

/** Dòng lịch ôn dưới dạng trạng thái engine SRS (`ease` là numeric nên Drizzle trả chuỗi). */
export function toSrsState(row: ReviewScheduleRow): SrsState {
  return {
    intervalDays: row.intervalDays,
    ease: Number(row.ease),
    repetitions: row.repetitions,
    lapses: row.lapses,
    isHard: row.isHard,
  };
}

/**
 * Khóa lịch ôn của một mục trong giao dịch hiện tại rồi đọc dòng (nếu có). Khóa tư vấn bao cả trường hợp
 * chưa có dòng (hai phiên cùng ôn mục mới), `FOR UPDATE` giữ dòng đã có đến hết giao dịch (R10).
 */
export async function lockSchedule(
  tx: DbExecutor,
  userId: string,
  itemId: string,
): Promise<ReviewScheduleRow | undefined> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`srs:${userId}:${itemId}`}, 0))`,
  );
  const [row] = await tx
    .select()
    .from(reviewSchedules)
    .where(and(eq(reviewSchedules.userId, userId), eq(reviewSchedules.itemId, itemId)))
    .limit(1)
    .for('update');
  return row;
}

export interface ScheduleWrite extends SrsState {
  dueDate: LocalDate;
  lastResult: boolean;
  lastReviewedAt: Date;
  lastReviewedLocalDate: LocalDate;
}

/** Ghi (chèn hoặc cập nhật) lịch ôn; gọi sau `lockSchedule` nên không có đua ghi. */
export async function upsertSchedule(
  tx: DbExecutor,
  userId: string,
  itemId: string,
  write: ScheduleWrite,
): Promise<void> {
  const values = {
    intervalDays: write.intervalDays,
    ease: write.ease.toFixed(2),
    repetitions: write.repetitions,
    lapses: write.lapses,
    dueDate: write.dueDate,
    lastResult: write.lastResult,
    lastReviewedAt: write.lastReviewedAt,
    lastReviewedLocalDate: write.lastReviewedLocalDate,
    isHard: write.isHard,
  };
  await tx
    .insert(reviewSchedules)
    .values({ userId, itemId, ...values })
    .onConflictDoUpdate({ target: [reviewSchedules.userId, reviewSchedules.itemId], set: values });
}

/** Ngày đến hạn hiện tại của một mục (null nếu mục chưa có lịch). */
export async function getDueDate(
  db: DbExecutor,
  userId: string,
  itemId: string,
): Promise<LocalDate | null> {
  const [row] = await db
    .select({ dueDate: reviewSchedules.dueDate })
    .from(reviewSchedules)
    .where(and(eq(reviewSchedules.userId, userId), eq(reviewSchedules.itemId, itemId)))
    .limit(1);
  return row?.dueDate ?? null;
}

/** Kết quả (true = đúng) của các câu lượt chính gần nhất của một mục, mới nhất trước. */
export async function recentItemResults(
  db: DbExecutor,
  userId: string,
  itemId: string,
  limit: number,
): Promise<boolean[]> {
  const rows = await db
    .select({ isCorrect: studyRecords.isCorrect })
    .from(studyRecords)
    .where(
      and(
        eq(studyRecords.userId, userId),
        eq(studyRecords.itemId, itemId),
        eq(studyRecords.isRetry, false),
      ),
    )
    .orderBy(desc(studyRecords.occurredAt), desc(studyRecords.id))
    .limit(limit);
  return rows.map((r) => r.isCorrect);
}

/** Số dòng lịch ôn tối đa đọc cho một lần chọn gói ôn (đủ cho mọi quỹ thời gian). */
const DUE_FETCH_LIMIT = 2000;

/**
 * Mục đến hạn (`due_date ≤ today`) có thể ôn: mục `active`, thuộc đơn vị `active`, còn ít nhất một bài tập
 * `active` gắn với nó (data-model §2.16). Dòng `review_schedules` của mục bị loại vẫn được giữ nguyên.
 * Thứ tự ưu tiên do `rankDueItems` quyết định; ở đây chỉ cắt số lượng theo độ quá hạn để chặn truy vấn lớn.
 */
export async function listDueReviewItems(
  db: DbExecutor,
  userId: string,
  today: LocalDate,
): Promise<DueReviewItem[]> {
  const rows = await db
    .select({
      itemId: reviewSchedules.itemId,
      dueDate: reviewSchedules.dueDate,
      isHard: reviewSchedules.isHard,
    })
    .from(reviewSchedules)
    .innerJoin(contentItems, eq(contentItems.id, reviewSchedules.itemId))
    .innerJoin(learningUnits, eq(learningUnits.id, contentItems.unitId))
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        lte(reviewSchedules.dueDate, today),
        eq(contentItems.status, 'active'),
        eq(learningUnits.status, 'active'),
        exists(
          db
            .select({ one: sql`1` })
            .from(exercises)
            .where(and(eq(exercises.itemId, contentItems.id), eq(exercises.status, 'active'))),
        ),
      ),
    )
    .orderBy(desc(reviewSchedules.isHard), reviewSchedules.dueDate, reviewSchedules.itemId)
    .limit(DUE_FETCH_LIMIT);
  return rows;
}

export interface ReviewContentRows {
  items: ItemSource[];
  exercises: ExerciseSource[];
}

/**
 * Nội dung hiện hành của các mục ôn: mục `active` thuộc đơn vị `active` kèm bài tập `active` gắn với
 * chúng. Bài tập mang `topicId` của đơn vị chứa nó (dùng cho thống kê mảng).
 */
export async function loadReviewContent(
  db: DbExecutor,
  itemIds: readonly string[],
): Promise<ReviewContentRows> {
  if (itemIds.length === 0) return { items: [], exercises: [] };
  const ids = [...itemIds];
  const [itemRows, exerciseRows] = await Promise.all([
    db
      .select({ item: contentItems })
      .from(contentItems)
      .innerJoin(learningUnits, eq(learningUnits.id, contentItems.unitId))
      .where(
        and(
          inArray(contentItems.id, ids),
          eq(contentItems.status, 'active'),
          eq(learningUnits.status, 'active'),
        ),
      ),
    db
      .select({ exercise: exercises, topicId: learningUnits.topicId })
      .from(exercises)
      .innerJoin(learningUnits, eq(learningUnits.id, exercises.unitId))
      .where(
        and(
          inArray(exercises.itemId, ids),
          eq(exercises.status, 'active'),
          eq(learningUnits.status, 'active'),
        ),
      ),
  ]);
  return {
    items: itemRows.map(({ item: r }) => ({
      id: r.id,
      kind: r.kind,
      japanese: r.japanese,
      reading: r.reading,
      meaning: r.meaning,
      explanation: r.explanation,
      examples: r.examples,
      position: r.position,
      status: r.status,
    })),
    exercises: exerciseRows.map(({ exercise: r, topicId }) => ({
      id: r.id,
      itemId: r.itemId,
      topicId,
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
