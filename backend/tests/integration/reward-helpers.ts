/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { addDays, toLocalDate } from '../../src/engine/clock.js';
import type { TestApp } from './helpers.js';
import { query, type Learner } from './lesson-helpers.js';

// Trợ giúp dựng tình huống thưởng/thành tựu (spec 005, T039): đặt lịch sử học sát mốc, đọc bảng thành tựu bằng
// truy vấn trực tiếp. Dùng chung cho `tests/contract/reward-us2.test.ts` và `tests/integration/reward-*.test.ts`.
// (Đặt cạnh `lesson-helpers.ts` thay vì `contract/helper.ts` vì `helper.ts` chỉ chứa đối chiếu OpenAPI, không có CSDL.)

export const TIMEZONE = 'Asia/Ho_Chi_Minh';

/** Ngày địa phương "hôm nay" của đồng hồ giả. */
export function localTodayOf(ctx: TestApp): string {
  return toLocalDate(ctx.clock.now(), TIMEZONE);
}

/** Ngày địa phương cách hôm nay `daysAgo` ngày. */
export function localDaysAgo(ctx: TestApp, daysAgo: number): string {
  return addDays(localTodayOf(ctx), -daysAgo);
}

async function anyExercise(ctx: TestApp): Promise<{ exerciseId: string; topicId: string }> {
  const rows = await query<{ id: string; topic_id: string }>(
    ctx,
    `SELECT e.id, u.topic_id FROM exercises e JOIN learning_units u ON u.id = e.unit_id LIMIT 1`,
  );
  if (rows.length === 0) throw new Error('Chưa seed nội dung (không có bài tập)');
  return { exerciseId: rows[0]!.id, topicId: rows[0]!.topic_id };
}

/**
 * Tạo hoạt động học ở các ngày địa phương `dates`: mỗi ngày một phiên ôn (`kind='review'`, đã hoàn thành,
 * KHÔNG phải bài học mới nên không ảnh hưởng `first_lesson`/`perfect_lesson`) kèm một câu trả lời lượt chính.
 */
export async function seedActivityDays(
  ctx: TestApp,
  learner: Learner,
  dates: readonly string[],
): Promise<void> {
  const { exerciseId, topicId } = await anyExercise(ctx);
  for (const date of dates) {
    const [session] = await query<{ id: string }>(
      ctx,
      `INSERT INTO lesson_sessions (user_id, kind, snapshot, status, started_at, completed_at)
       VALUES ($1, 'review', '{}'::jsonb, 'completed', $2, $2) RETURNING id`,
      [learner.userId, `${date}T05:00:00Z`],
    );
    await query(
      ctx,
      `INSERT INTO study_records
         (user_id, client_event_id, session_id, exercise_id, topic_id, is_correct, submitted_answer,
          context, is_retry, occurred_at, local_date)
       VALUES ($1, $2, $3, $4, $5, true, '0'::jsonb, 'review', false, $6, $7)`,
      [learner.userId, randomUUID(), session!.id, exerciseId, topicId, `${date}T05:00:00Z`, date],
    );
  }
}

/** `days` ngày liên tiếp kết thúc hôm qua (không gồm hôm nay), để lần hoàn thành hôm nay nối dài chuỗi. */
export async function seedStreakEndingYesterday(
  ctx: TestApp,
  learner: Learner,
  days: number,
): Promise<void> {
  const dates = Array.from({ length: days }, (_, i) => localDaysAgo(ctx, i + 1));
  await seedActivityDays(ctx, learner, dates);
}

/**
 * Đặt `count` mục "đã học" (có `review_schedules`) thuộc các đơn vị đã có phiên hoàn thành (`kind='extra'`),
 * trừ các đơn vị trong `excludeUnitIds` (đơn vị của phiên đang kiểm thử). Trả số mục thật sự đặt được.
 */
export async function seedLearnedItems(
  ctx: TestApp,
  learner: Learner,
  count: number,
  excludeUnitIds: readonly string[] = [],
): Promise<number> {
  const items = await query<{ id: string; unit_id: string }>(
    ctx,
    `SELECT ci.id, ci.unit_id
       FROM content_items ci JOIN learning_units lu ON lu.id = ci.unit_id
      WHERE lu.status = 'active' AND ci.status = 'active' AND NOT (ci.unit_id = ANY($1::uuid[]))
      ORDER BY ci.unit_id, ci.position
      LIMIT $2`,
    [excludeUnitIds, count],
  );
  const dueDate = addDays(localTodayOf(ctx), 1);
  const unitIds = [...new Set(items.map((i) => i.unit_id))];
  for (const unitId of unitIds) {
    await query(
      ctx,
      `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot, status, started_at, completed_at)
       VALUES ($1, 'extra', $2, '{}'::jsonb, 'completed', $3, $3)`,
      [learner.userId, unitId, `${localDaysAgo(ctx, 30)}T05:00:00Z`],
    );
  }
  for (const item of items) {
    await query(
      ctx,
      `INSERT INTO review_schedules
         (user_id, item_id, facet, interval_days, ease, repetitions, lapses, due_date)
       VALUES ($1, $2, 'item', 1, 2.5, 1, 0, $3)`,
      [learner.userId, item.id, dueDate],
    );
  }
  return items.length;
}

/** Id đơn vị học của một phiên. */
export async function sessionUnitId(ctx: TestApp, sessionId: string): Promise<string | null> {
  const rows = await query<{ unit_id: string | null }>(
    ctx,
    'SELECT unit_id FROM lesson_sessions WHERE id = $1',
    [sessionId],
  );
  return rows[0]?.unit_id ?? null;
}

/** Các dòng `earned_achievements` của người học (mã → nguồn). */
export async function earnedRows(
  ctx: TestApp,
  userId: string,
): Promise<Record<string, 'earned' | 'silent'>> {
  const rows = await query<{ achievement_code: string; source: 'earned' | 'silent' }>(
    ctx,
    'SELECT achievement_code, source FROM earned_achievements WHERE user_id = $1',
    [userId],
  );
  return Object.fromEntries(rows.map((r) => [r.achievement_code, r.source]));
}

/** Các ngày địa phương đã chúc mừng hoàn thành ngày. */
export async function celebratedDays(ctx: TestApp, userId: string): Promise<string[]> {
  const rows = await query<{ d: string }>(
    ctx,
    `SELECT local_date::text AS d FROM daily_completion_celebrations WHERE user_id = $1 ORDER BY 1`,
    [userId],
  );
  return rows.map((r) => r.d);
}

/** Ghi sẵn các mốc đã đạt (mô phỏng người học đã được chúc mừng trước đó). */
export async function markEarned(
  ctx: TestApp,
  userId: string,
  codes: readonly string[],
  source: 'earned' | 'silent' = 'earned',
): Promise<void> {
  for (const code of codes) {
    await query(
      ctx,
      `INSERT INTO earned_achievements (user_id, achievement_code, earned_at, source)
       VALUES ($1, $2, now(), $3) ON CONFLICT DO NOTHING`,
      [userId, code, source],
    );
  }
}

/** Mã thành tựu trong `celebrations` của một tóm tắt phiên (rỗng nếu vắng). */
export function celebratedCodes(summary: any): string[] {
  return (summary.celebrations?.achievements ?? []).map((a: { code: string }) => a.code);
}
