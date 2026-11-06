import { and, desc, eq, exists, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import {
  contentItems,
  exercises,
  learningUnits,
  lessonSessions,
  reviewSchedules,
  studyRecords,
} from '../schema.js';
import type { ExerciseSource, ItemSource } from '../../domain/session-snapshot.js';
import type { LocalDate, ReviewFacet, Skill } from '../../domain/types.js';
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
 * Khóa lịch ôn của một cặp (mục, khía cạnh) trong giao dịch hiện tại rồi đọc dòng (nếu có). Khóa tư vấn
 * bao cả trường hợp chưa có dòng (hai phiên cùng ôn cặp mới), `FOR UPDATE` giữ dòng đã có đến hết giao
 * dịch (R10). Khóa của facet `item` giữ nguyên dạng cũ (`srs:user:item`) để hành vi 001 không đổi.
 */
export async function lockSchedule(
  tx: DbExecutor,
  userId: string,
  itemId: string,
  facet: ReviewFacet = 'item',
): Promise<ReviewScheduleRow | undefined> {
  const lockKey = facet === 'item' ? `srs:${userId}:${itemId}` : `srs:${userId}:${itemId}:${facet}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
  const [row] = await tx
    .select()
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        eq(reviewSchedules.itemId, itemId),
        eq(reviewSchedules.facet, facet),
      ),
    )
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

/** Ghi (chèn hoặc cập nhật) lịch ôn của cặp (mục, khía cạnh); gọi sau `lockSchedule` nên không có đua ghi. */
export async function upsertSchedule(
  tx: DbExecutor,
  userId: string,
  itemId: string,
  write: ScheduleWrite,
  facet: ReviewFacet = 'item',
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
    .values({ userId, itemId, facet, ...values })
    .onConflictDoUpdate({
      target: [reviewSchedules.userId, reviewSchedules.itemId, reviewSchedules.facet],
      set: values,
    });
}

/** Ngày đến hạn hiện tại của một cặp (mục, khía cạnh); null nếu chưa có lịch. */
export async function getDueDate(
  db: DbExecutor,
  userId: string,
  itemId: string,
  facet: ReviewFacet = 'item',
): Promise<LocalDate | null> {
  const [row] = await db
    .select({ dueDate: reviewSchedules.dueDate })
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.userId, userId),
        eq(reviewSchedules.itemId, itemId),
        eq(reviewSchedules.facet, facet),
      ),
    )
    .limit(1);
  return row?.dueDate ?? null;
}

/** Kết quả (true = đúng) của các câu lượt chính gần nhất của một cặp (mục, khía cạnh), mới nhất trước. */
export async function recentItemResults(
  db: DbExecutor,
  userId: string,
  itemId: string,
  limit: number,
  facet: ReviewFacet = 'item',
): Promise<boolean[]> {
  const rows = await db
    .select({ isCorrect: studyRecords.isCorrect })
    .from(studyRecords)
    .where(
      and(
        eq(studyRecords.userId, userId),
        eq(studyRecords.itemId, itemId),
        eq(studyRecords.facet, facet),
        eq(studyRecords.isRetry, false),
      ),
    )
    .orderBy(desc(studyRecords.occurredAt), desc(studyRecords.id))
    .limit(limit);
  return rows.map((r) => r.isCorrect);
}

/** Số dòng lịch ôn tối đa đọc cho một lần chọn gói ôn (đủ cho mọi quỹ thời gian). */
const DUE_FETCH_LIMIT = 2000;

/** Cặp (mục, khía cạnh) đến hạn ôn; `kind` là loại nội dung của mục. */
export interface DueReviewPair extends DueReviewItem {
  facet: ReviewFacet;
  kind: Skill;
}

/**
 * Cặp (mục, khía cạnh) đến hạn (`due_date ≤ today`) có thể ôn (data-model §3.7): chưa được đánh dấu thành
 * thạo (`mastered_at IS NULL`), mục `active` thuộc đơn vị `active`, còn ít nhất một bài tập `active` có cùng
 * `item_id` VÀ `facet`. Riêng chữ Kanji chỉ vào gói ôn khi người học đã hoàn thành bài chứa chữ đó: dòng lịch
 * của bài dở dang có thể đã tồn tại (ghi theo từng câu) nhưng chữ chưa được coi là "đã học" (research K6).
 * Bài đã hoàn thành rồi đánh dấu thành thạo (`unit_progress.status='mastered'`) vẫn tính là hoàn thành nên
 * lịch ôn các chữ của bài không bị loại; từ vựng/ngữ pháp giữ hành vi 001. Dòng `review_schedules` của cặp bị
 * loại luôn được giữ nguyên. Thứ tự ưu tiên do `rankDueItems` quyết định; ở đây chỉ cắt số lượng theo độ quá
 * hạn để chặn truy vấn lớn.
 */
export async function listDueReviewItems(
  db: DbExecutor,
  userId: string,
  today: LocalDate,
): Promise<DueReviewPair[]> {
  const rows = await db
    .select({
      itemId: reviewSchedules.itemId,
      facet: reviewSchedules.facet,
      kind: contentItems.kind,
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
        isNull(reviewSchedules.masteredAt),
        eq(contentItems.status, 'active'),
        eq(learningUnits.status, 'active'),
        exists(
          db
            .select({ one: sql`1` })
            .from(exercises)
            .where(
              and(
                eq(exercises.itemId, contentItems.id),
                eq(exercises.facet, reviewSchedules.facet),
                eq(exercises.status, 'active'),
              ),
            ),
        ),
        or(
          ne(contentItems.kind, 'kanji'),
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
      ),
    )
    .orderBy(desc(reviewSchedules.isHard), reviewSchedules.dueDate, reviewSchedules.itemId)
    .limit(DUE_FETCH_LIMIT);
  return rows;
}

/**
 * Đặt / xóa `mastered_at` cho mọi cặp của chữ (research K7). Trả số dòng lịch ôn của chữ (0 = người học chưa
 * học chữ này). Đánh dấu lại khi đã đánh dấu giữ nguyên mốc thời gian cũ (idempotent); bỏ đánh dấu để lịch tiếp
 * tục từ `due_date` đã lưu.
 */
export async function setItemMastered(
  db: DbExecutor,
  userId: string,
  itemId: string,
  mastered: boolean,
  now: Date,
): Promise<number> {
  const where = and(eq(reviewSchedules.userId, userId), eq(reviewSchedules.itemId, itemId));
  const rows = await db
    .update(reviewSchedules)
    .set({
      masteredAt: mastered ? sql`coalesce(${reviewSchedules.masteredAt}, ${now})` : null,
    })
    .where(where)
    .returning({ facet: reviewSchedules.facet });
  return rows.length;
}

/** Loại nội dung của một mục (null nếu không tồn tại). */
export async function getItemKind(db: DbExecutor, itemId: string): Promise<Skill | null> {
  const [row] = await db
    .select({ kind: contentItems.kind })
    .from(contentItems)
    .where(eq(contentItems.id, itemId))
    .limit(1);
  return row?.kind ?? null;
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
      topicId: r.topicId,
      kanjiDetails: r.kanjiDetails,
      position: r.position,
      status: r.status,
    })),
    exercises: exerciseRows.map(({ exercise: r, topicId }) => ({
      id: r.id,
      itemId: r.itemId,
      topicId,
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
