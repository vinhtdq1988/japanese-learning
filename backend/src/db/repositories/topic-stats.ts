import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { studyRecords, topicStats } from '../schema.js';
import type { TopicAnswerResult, TopicStatState } from '../../engine/difficulty.js';
import { EMPTY_TOPIC_STATS } from '../../engine/difficulty.js';

// Repository thống kê theo mảng (`topic_stats`, US4/US5): điểm yếu và độ khó thích ứng. Mọi truy vấn
// lọc theo `user_id` lấy từ token (R16).

export type TopicStatRow = typeof topicStats.$inferSelect;

function toState(row: TopicStatRow | undefined): TopicStatState {
  if (!row) return { ...EMPTY_TOPIC_STATS, recentResults: [] };
  return {
    recentResults: row.recentResults.map((r) => (r === 1 ? 1 : 0)),
    accuracy: row.accuracy === null ? null : Number(row.accuracy),
    isWeak: row.isWeak,
    difficultyBias: row.difficultyBias,
    consecutiveLow: row.consecutiveLow,
    consecutiveHigh: row.consecutiveHigh,
  };
}

/**
 * Khóa thống kê của một mảng trong giao dịch hiện tại rồi đọc (mặc định rỗng nếu chưa có dòng). Khóa tư
 * vấn bao cả trường hợp chưa có dòng, nên hai câu trả lời đồng thời được xếp hàng và không ghi đè nhau.
 */
export async function lockTopicStats(
  tx: DbExecutor,
  userId: string,
  topicId: string,
): Promise<TopicStatState> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`topic:${userId}:${topicId}`}, 0))`,
  );
  const [row] = await tx
    .select()
    .from(topicStats)
    .where(and(eq(topicStats.userId, userId), eq(topicStats.topicId, topicId)))
    .limit(1);
  return toState(row);
}

/** Ghi (chèn hoặc cập nhật) thống kê mảng; gọi sau `lockTopicStats`. */
export async function saveTopicStats(
  tx: DbExecutor,
  userId: string,
  topicId: string,
  state: TopicStatState,
): Promise<void> {
  const values = {
    recentResults: state.recentResults,
    accuracy: state.accuracy === null ? null : state.accuracy.toFixed(3),
    isWeak: state.isWeak,
    difficultyBias: state.difficultyBias,
    consecutiveLow: state.consecutiveLow,
    consecutiveHigh: state.consecutiveHigh,
  };
  await tx
    .insert(topicStats)
    .values({ userId, topicId, ...values })
    .onConflictDoUpdate({ target: [topicStats.userId, topicStats.topicId], set: values });
}

/** Kết quả lượt chính (không tính câu hỏi lại cuối phiên) của một phiên, kèm mảng của từng câu. */
export async function listSessionTopicResults(
  db: DbExecutor,
  sessionId: string,
): Promise<TopicAnswerResult[]> {
  return db
    .select({ topicId: studyRecords.topicId, isCorrect: studyRecords.isCorrect })
    .from(studyRecords)
    .where(and(eq(studyRecords.sessionId, sessionId), eq(studyRecords.isRetry, false)));
}

/** Các mảng được đánh dấu yếu của người học, độ chính xác thấp nhất trước. */
export async function listWeakTopicStats(
  db: DbExecutor,
  userId: string,
): Promise<{ topicId: string; accuracy: number | null }[]> {
  const rows = await db
    .select({ topicId: topicStats.topicId, accuracy: topicStats.accuracy })
    .from(topicStats)
    .where(and(eq(topicStats.userId, userId), eq(topicStats.isWeak, true)));
  return rows
    .map((r) => ({ topicId: r.topicId, accuracy: r.accuracy === null ? null : Number(r.accuracy) }))
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.topicId.localeCompare(b.topicId));
}
