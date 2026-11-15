import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  advanceDays,
  finishPlanItem,
  getToday,
  planItemOfKind,
  practiceLearner,
  query,
} from './lesson-helpers.js';

// Ghi nhận kết quả luyện đọc/viết (spec 007, T050, FR-010, FR-011, I9): không tạo lịch ôn, có study_records
// theo chủ đề của đơn vị, topic_stats cập nhật; khóa không xóa lịch sử.

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

const readingStats = async (userId: string) =>
  query(
    ctx,
    `SELECT ts.topic_id FROM topic_stats ts JOIN topics t ON t.id = ts.topic_id
      WHERE ts.user_id = $1 AND t.skill = 'reading'`,
    [userId],
  );

describe('bản ghi sau phiên luyện', () => {
  it('I9: không có review_schedules cho mục reading/writing; study_records mang chủ đề của đơn vị; topic_stats cập nhật', async () => {
    const learner = await practiceLearner(api, ctx);
    const item = planItemOfKind(await getToday(api, learner), 'reading')!;
    await finishPlanItem(api, ctx, learner, item.id);

    const [{ count }] = await query(
      ctx,
      `SELECT count(*)::int AS count FROM review_schedules rs
         JOIN content_items ci ON ci.id = rs.item_id
        WHERE ci.kind IN ('reading','writing')`,
    );
    expect(count).toBe(0);

    const records = await query(
      ctx,
      `SELECT r.topic_id, u.topic_id AS unit_topic, r.item_id, t.skill::text AS skill
         FROM study_records r
         JOIN exercises e ON e.id = r.exercise_id
         JOIN learning_units u ON u.id = e.unit_id
         JOIN topics t ON t.id = r.topic_id
        WHERE r.user_id = $1`,
      [learner.userId],
    );
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r.item_id).toBeNull();
      expect(r.topic_id).toBe(r.unit_topic);
      expect(r.skill).toBe('reading');
    }
    expect(await readingStats(learner.userId)).toHaveLength(1);
  });

  it('FR-011: sau khi hạ phút (khóa) lịch sử vẫn còn và GET /progress vẫn hiện', async () => {
    const learner = await practiceLearner(api, ctx);
    const item = planItemOfKind(await getToday(api, learner), 'reading')!;
    await finishPlanItem(api, ctx, learner, item.id);
    const [{ n: before }] = await query(
      ctx,
      'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1',
      [learner.userId],
    );

    const lowered = await api.patch('/me', { token: learner.token, body: { dailyMinutes: 15 } });
    expect(lowered.status).toBe(200);
    await advanceDays(api, ctx, learner);

    const [{ n: after }] = await query(
      ctx,
      'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1',
      [learner.userId],
    );
    expect(after).toBe(before);
    expect(await readingStats(learner.userId)).toHaveLength(1);
    const progress = await api.get('/progress', { token: learner.token });
    expect(progress.status).toBe(200);
  });
});
