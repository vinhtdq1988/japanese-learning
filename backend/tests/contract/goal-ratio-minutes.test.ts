import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  getToday,
  onboardedLearner,
  query,
  startSession,
  answerAll,
  type Learner,
} from '../integration/lesson-helpers.js';
import {
  celebratedCodes,
  earnedRows,
  markEarned,
  sessionUnitId,
} from '../integration/reward-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng `ProgressSummary.goal.completionRatio` tính theo PHÚT (spec 008, T212; OpenAPI 1.15.0,
// api-changes.md §4, research D12.1, C4): Σ estMinutes đã xong / Σ estMinutes trong phạm vi, cùng nguồn với
// thành tựu `goal_*`; hoàn thành đơn vị 10 phút tăng nhiều hơn đơn vị 5 phút; thành tựu đã đạt không bị thu
// hồi khi phạm vi tăng (hồi quy với `reward-achievements.test.ts`).

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

interface PathItem {
  unitId: string;
  estMinutes: number;
  status: string;
}

const pathItems = async (learner: Learner): Promise<PathItem[]> => {
  const res = await api.get('/path', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body.items as PathItem[];
};

const ratioOf = async (learner: Learner): Promise<number> => {
  const res = await api.get('/progress', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body.goal.completionRatio as number;
};

const markCompleted = async (learner: Learner, unitIds: readonly string[]) => {
  for (const unitId of unitIds) {
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status, updated_at)
       VALUES ($1, $2, 'completed', now()) ON CONFLICT DO NOTHING`,
      [learner.userId, unitId],
    );
  }
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const minutes = (items: readonly PathItem[]): number => items.reduce((s, i) => s + i.estMinutes, 0);
const isDone = (i: PathItem): boolean => i.status === 'completed' || i.status === 'mastered';

describe('completionRatio theo phút', () => {
  it('người học chưa học gì → 0; thuộc [0, 1]', async () => {
    const learner = await onboardedLearner(api, ctx);
    expect(await ratioOf(learner)).toBe(0);
  });

  it('bằng Σ phút đã xong / Σ phút trong phạm vi (làm tròn 3 chữ số) và khác tỷ lệ đếm đơn vị khi thời lượng lệch nhau', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = await pathItems(learner);
    const five = items.filter((i) => i.estMinutes === 5);
    const ten = items.filter((i) => i.estMinutes === 10);
    expect(five.length).toBeGreaterThan(2);
    expect(ten.length).toBeGreaterThan(2);

    await markCompleted(
      learner,
      five.slice(0, 3).map((i) => i.unitId),
    );
    const after = await pathItems(learner);
    const expected = round3(minutes(after.filter(isDone)) / minutes(after));
    const byCount = round3(after.filter(isDone).length / after.length);
    expect(after.filter(isDone)).toHaveLength(3);
    expect(await ratioOf(learner)).toBe(expected);
    // Ba đơn vị 5 phút: tỷ lệ theo phút nhỏ hơn tỷ lệ đếm đơn vị (đơn vị 10 phút nặng hơn).
    expect(expected).toBeLessThan(byCount);
  });

  it('hoàn thành đơn vị 10 phút tăng nhiều hơn đơn vị 5 phút; tăng đơn điệu', async () => {
    const a = await onboardedLearner(api, ctx);
    const b = await onboardedLearner(api, ctx);
    const items = await pathItems(a);
    const five = items.find((i) => i.estMinutes === 5)!;
    const ten = items.find((i) => i.estMinutes === 10)!;
    expect(await ratioOf(a)).toBe(0);

    await markCompleted(a, [five.unitId]);
    await markCompleted(b, [ten.unitId]);
    const afterFive = await ratioOf(a);
    const afterTen = await ratioOf(b);
    expect(afterFive).toBeGreaterThan(0);
    expect(afterTen).toBeGreaterThan(afterFive);

    // Thêm một đơn vị nữa vẫn tăng.
    const another = items.find((i) => i.unitId !== five.unitId)!;
    await markCompleted(a, [another.unitId]);
    expect(await ratioOf(a)).toBeGreaterThan(afterFive);
  });

  it('hoàn thành mọi đơn vị trong phạm vi → 1', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = await pathItems(learner);
    await markCompleted(
      learner,
      items.map((i) => i.unitId),
    );
    expect(await ratioOf(learner)).toBe(1);
  });
});

describe('thành tựu goal_* cùng nguồn tính theo phút', () => {
  it('hoàn thành bài đẩy tổng phút qua 25% → goal_25 được chúc mừng; GET /progress khớp', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = await pathItems(learner);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const lessonUnit = (await sessionUnitId(ctx, session.id))!;
    const lesson = items.find((i) => i.unitId === lessonUnit)!;
    const total = minutes(items);
    const limit = 0.25 * total;

    // Chọn các đơn vị khác sao cho Σ phút < 25% nhưng cộng thêm bài đang học thì ≥ 25%.
    const others = items.filter((i) => i.unitId !== lessonUnit);
    const chosen: PathItem[] = [];
    let sum = 0;
    for (const unit of others) {
      if (sum >= limit - lesson.estMinutes) break;
      if (sum + unit.estMinutes < limit) {
        chosen.push(unit);
        sum += unit.estMinutes;
      }
    }
    expect(sum).toBeLessThan(limit);
    expect(sum + lesson.estMinutes).toBeGreaterThanOrEqual(limit);
    await markCompleted(
      learner,
      chosen.map((i) => i.unitId),
    );
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });

    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
    expect(celebratedCodes(done.body)).toContain('goal_25');
    expect((await earnedRows(ctx, learner.userId)).goal_25).toBe('earned');

    const after = await pathItems(learner);
    expect(await ratioOf(learner)).toBe(round3(minutes(after.filter(isDone)) / minutes(after)));
  });

  it('thành tựu đã đạt không bị thu hồi khi phạm vi tăng làm tỷ lệ tụt (đổi mục tiêu lên N3)', async () => {
    const learner = await onboardedLearner(api, ctx, {
      goalType: 'jlpt',
      targetLevel: 'N5',
      currentLevel: 'none',
    });
    const narrow = await pathItems(learner);
    await markCompleted(
      learner,
      narrow.map((i) => i.unitId),
    );
    expect(await ratioOf(learner)).toBe(1);
    await markEarned(ctx, learner.userId, ['goal_25', 'goal_50'], 'earned');
    const before = await earnedRows(ctx, learner.userId);

    // Mở rộng phạm vi tới N3: tỷ lệ tụt dưới các mốc đã đạt.
    const widened = await api.patch('/me', { token: learner.token, body: { targetLevel: 'N3' } });
    expect(widened.status).toBe(200);
    const ratio = await ratioOf(learner);
    expect(ratio).toBeLessThan(0.5);

    expect(await earnedRows(ctx, learner.userId)).toEqual(before);
    // Hồi quy: nhiều lần đọc tiến độ vẫn không đổi các dòng đã đạt.
    await ratioOf(learner);
    expect((await earnedRows(ctx, learner.userId)).goal_25).toBe('earned');
  });
});
