import { randomUUID } from 'node:crypto';
import type { TestApp } from './helpers.js';

// Tiện ích dựng hoạt động học cho kiểm thử số liệu lớp (spec 004, US7): ghi trực tiếp phiên + bản ghi trả lời
// theo (chủ đề, ngày, đúng/sai, ngữ cảnh, lượt hỏi lại). Mỗi bản ghi có phiên riêng vì chỉ mục duy nhất
// `(session_id, exercise_id) WHERE NOT is_retry` chỉ cho một câu lượt chính cho mỗi bài tập trong một phiên.

export interface TopicExercise {
  exerciseId: string;
  topicId: string;
}

/** Mỗi chủ đề (khác nhau) một bài tập đang hoạt động; `count` chủ đề đầu theo id. */
export async function distinctTopicExercises(
  ctx: TestApp,
  count: number,
): Promise<TopicExercise[]> {
  const { rows } = await ctx.handle.pool.query<{ id: string; topic_id: string }>(
    `SELECT DISTINCT ON (u.topic_id) e.id, u.topic_id
       FROM exercises e JOIN learning_units u ON u.id = e.unit_id
      WHERE e.status = 'active'
      ORDER BY u.topic_id, e.id`,
  );
  if (rows.length < count) throw new Error(`Chỉ có ${rows.length} chủ đề, cần ${count}`);
  return rows.slice(0, count).map((r) => ({ exerciseId: r.id, topicId: r.topic_id }));
}

export interface AnswerSpec {
  topic: TopicExercise;
  /** Ngày địa phương `YYYY-MM-DD` (giờ UTC cố định 03:00 = 10:00 giờ Việt Nam). */
  day: string;
  correct: boolean;
  context?: 'lesson' | 'review';
  isRetry?: boolean;
}

/** Ghi hàng loạt câu trả lời cho một học viên (một phiên cho mỗi câu). */
export async function seedAnswers(
  ctx: TestApp,
  userId: string,
  answers: readonly AnswerSpec[],
): Promise<void> {
  if (answers.length === 0) return;
  const sessionIds = answers.map(() => randomUUID());
  const at = answers.map((a) => `${a.day}T03:00:00Z`);
  await ctx.handle.pool.query(
    `INSERT INTO lesson_sessions (id, user_id, kind, snapshot, status, started_at, completed_at)
     SELECT s.id, $1, 'review', '{}'::jsonb, 'completed', s.at::timestamptz, s.at::timestamptz
       FROM unnest($2::uuid[], $3::text[]) AS s(id, at)`,
    [userId, sessionIds, at],
  );
  await ctx.handle.pool.query(
    `INSERT INTO study_records (user_id, client_event_id, session_id, exercise_id, topic_id, is_correct,
                                submitted_answer, context, is_retry, occurred_at, local_date)
     SELECT $1, gen_random_uuid(), r.s, r.e, r.t, r.c, '{}'::jsonb, r.ctx::record_context, r.retry,
            r.at::timestamptz, r.d::date
       FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::boolean[], $6::text[], $7::boolean[],
                   $8::text[], $9::text[]) AS r(s, e, t, c, ctx, retry, at, d)`,
    [
      userId,
      sessionIds,
      answers.map((a) => a.topic.exerciseId),
      answers.map((a) => a.topic.topicId),
      answers.map((a) => a.correct),
      answers.map((a) => a.context ?? 'review'),
      answers.map((a) => a.isRetry ?? false),
      at,
      answers.map((a) => a.day),
    ],
  );
}

/** `total` câu của một chủ đề trong một ngày, `correct` câu đầu đúng, phần còn lại sai. */
export function answersFor(
  topic: TopicExercise,
  day: string,
  total: number,
  correct: number,
  extra: Partial<Pick<AnswerSpec, 'context' | 'isRetry'>> = {},
): AnswerSpec[] {
  return Array.from({ length: total }, (_, i) => ({ topic, day, correct: i < correct, ...extra }));
}

/** Ghi khoảng thời gian học (giây) cho một học viên vào các ngày địa phương cho trước. */
export async function seedIntervals(
  ctx: TestApp,
  userId: string,
  intervals: readonly { day: string; seconds: number }[],
): Promise<void> {
  if (intervals.length === 0) return;
  const sessionIds = intervals.map(() => randomUUID());
  const at = intervals.map((i) => `${i.day}T03:00:00Z`);
  await ctx.handle.pool.query(
    `INSERT INTO lesson_sessions (id, user_id, kind, snapshot, status, started_at, completed_at)
     SELECT s.id, $1, 'review', '{}'::jsonb, 'completed', s.at::timestamptz, s.at::timestamptz
       FROM unnest($2::uuid[], $3::text[]) AS s(id, at)`,
    [userId, sessionIds, at],
  );
  await ctx.handle.pool.query(
    `INSERT INTO study_intervals (user_id, client_event_id, session_id, started_at, duration_seconds, local_date)
     SELECT $1, gen_random_uuid(), i.s, i.at::timestamptz, i.sec, i.d::date
       FROM unnest($2::uuid[], $3::text[], $4::int[], $5::text[]) AS i(s, at, sec, d)`,
    [userId, sessionIds, at, intervals.map((i) => i.seconds), intervals.map((i) => i.day)],
  );
}
