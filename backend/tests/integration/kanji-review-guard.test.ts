/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { getToday, onboardedLearner, query } from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Bộ lọc tạm bảo vệ gói ôn (T090, research K6 "an toàn trung gian"): cặp Kanji (facet ≠ item) chưa vào gói
// ôn cho tới khi US3 gỡ bộ lọc ở `listDueReviewItems`. Test này được thay thế bằng `kanji-review.test.ts` ở US3.

let ctx: TestApp;
let api: ContractClient;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
afterAll(async () => {
  await ctx.close();
});

/** Dựng một chữ Kanji tối thiểu (đơn vị, mục, 3 bài tập theo 3 khía cạnh) trực tiếp trong CSDL. */
async function insertKanjiItem(): Promise<string> {
  const topic = (
    await query(
      ctx,
      `INSERT INTO topics (skill, name, level) VALUES ('kanji', '{"vi":"Số","en":"Numbers"}', 'N5') RETURNING id`,
    )
  )[0].id;
  const unit = (
    await query(
      ctx,
      `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes, status)
       VALUES ('kanji', '{"vi":"K","en":"K"}', 'N5', $1, 1, 5, 'active') RETURNING id`,
      [topic],
    )
  )[0].id;
  const item = (
    await query(
      ctx,
      `INSERT INTO content_items (unit_id, kind, japanese, meaning, topic_id, kanji_details)
       VALUES ($1, 'kanji', '三', '{"vi":"ba","en":"three"}', $2, $3) RETURNING id`,
      [unit, topic, JSON.stringify({ onReadings: ['サン'], kunReadings: ['み'], strokeCount: 3 })],
    )
  )[0].id;
  for (const facet of ['meaning', 'reading', 'word']) {
    await query(
      ctx,
      `INSERT INTO exercises (unit_id, item_id, facet, type, prompt, payload, feedback_correct, feedback_incorrect)
       VALUES ($1, $2, $3, 'multiple_choice', '{"vi":"q","en":"q"}', '{"choices":["a","b"],"correct_index":0}', '{"vi":"ok","en":"ok"}', '{"vi":"no","en":"no"}')`,
      [unit, item, facet],
    );
  }
  return item;
}

describe('bộ lọc tạm gói ôn: cặp Kanji chưa vào gói ôn (T090)', () => {
  it('3 cặp Kanji đến hạn không làm trùng review_item_ids; mục từ vựng đến hạn vẫn được ôn', async () => {
    const learner = await onboardedLearner(api, ctx);
    const kanjiItem = await insertKanjiItem();
    const [vocabItem] = await query<{ id: string }>(
      ctx,
      `SELECT ci.id FROM content_items ci
         JOIN exercises e ON e.item_id = ci.id AND e.status = 'active'
        WHERE ci.kind = 'vocabulary' AND ci.status = 'active' LIMIT 1`,
    );

    // Hôm nay (2026-01-05) đến hạn: ba cặp của chữ Kanji và một mục từ vựng.
    for (const facet of ['meaning', 'reading', 'word']) {
      await query(
        ctx,
        `INSERT INTO review_schedules (user_id, item_id, facet, interval_days, ease, due_date)
         VALUES ($1, $2, $3, 1, 2.50, '2026-01-04')`,
        [learner.userId, kanjiItem, facet],
      );
    }
    await query(
      ctx,
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, due_date)
       VALUES ($1, $2, 1, 2.50, '2026-01-04')`,
      [learner.userId, vocabItem!.id],
    );

    // Kế hoạch hôm nay đã được sinh ngay khi onboarding: xóa để sinh lại với lịch ôn vừa chèn.
    await query(ctx, 'DELETE FROM daily_plans WHERE user_id = $1', [learner.userId]);
    const plan = await getToday(api, learner);
    expect(plan.items.some((i: any) => i.type === 'review_batch')).toBe(true);
    const reviewIds: string[] = [];
    const stored = await query<{
      review_item_ids: string[] | null;
      review_facets: string[] | null;
    }>(
      ctx,
      `SELECT dpi.review_item_ids, dpi.review_facets
         FROM daily_plan_items dpi JOIN daily_plans dp ON dp.id = dpi.plan_id
        WHERE dp.user_id = $1 AND dpi.type = 'review_batch'`,
      [learner.userId],
    );
    for (const row of stored) reviewIds.push(...(row.review_item_ids ?? []));

    expect(reviewIds).not.toContain(kanjiItem);
    expect(new Set(reviewIds).size).toBe(reviewIds.length);
    expect(reviewIds).toContain(vocabItem!.id);
    for (const row of stored) expect(row.review_facets).toBeNull();
  });
});
