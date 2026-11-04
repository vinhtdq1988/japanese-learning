/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  advanceDays,
  getToday,
  onboardedLearner,
  query,
  studyPlanItem,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US5 (T090, SC-006) trên PostgreSQL thật: mỗi ghi đè (mục tiêu, thời gian/ngày,
// tạm dừng/tiếp tục, ưu tiên kỹ năng, thành thạo, xây dựng lại) có hiệu lực ở kế hoạch kế tiếp; mỗi lần
// sinh lộ trình lưu đúng `reason`; lịch sử học giữ nguyên; khoảng nghỉ được lập lại ở mức xử lý được;
// độ khó thích ứng cập nhật khi hoàn thành phiên.

let ctx: TestApp;
let api: ContractClient;
const START = '2026-01-05T08:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => {
  ctx.clock.set(START);
});
afterAll(async () => {
  await ctx.close();
});

const patchMe = (learner: Learner, body: Record<string, unknown>) =>
  api.patch('/me', { token: learner.token, body });
const post = (learner: Learner, url: string, body?: unknown) =>
  api.post(url, { token: learner.token, ...(body !== undefined ? { body } : {}) });
const pathOf = async (learner: Learner) => (await api.get('/path', { token: learner.token })).body;

/** Học mọi mục của kế hoạch hôm nay (đúng hết, hoặc sai hết khi `allWrong`). */
async function studyToday(learner: Learner, options: { allWrong?: boolean } = {}) {
  const plan = await getToday(api, learner);
  for (const item of plan.items) await studyPlanItem(api, ctx, learner, item.id, options);
  return plan;
}

/** Ảnh chụp toàn bộ lịch sử học của người học (để chứng minh ghi đè không đụng tới nó). */
async function historyOf(learner: Learner) {
  const id = [learner.userId];
  return {
    progress: await query(
      ctx,
      `SELECT unit_id, status FROM unit_progress WHERE user_id = $1 ORDER BY unit_id`,
      id,
    ),
    records: await query(
      ctx,
      `SELECT id, is_correct, local_date::text AS d FROM study_records WHERE user_id = $1 ORDER BY id`,
      id,
    ),
    schedules: await query(
      ctx,
      `SELECT item_id, interval_days, ease::float AS ease, repetitions, lapses,
              due_date::text AS due_date, is_hard
         FROM review_schedules WHERE user_id = $1 ORDER BY item_id`,
      id,
    ),
    stats: await query(
      ctx,
      `SELECT topic_id, recent_results, accuracy::float AS accuracy, is_weak, difficulty_bias,
              consecutive_low, consecutive_high
         FROM topic_stats WHERE user_id = $1 ORDER BY topic_id`,
      id,
    ),
  };
}

const planKinds = (planItemIds: string[]) =>
  query<{ kind: string }>(
    ctx,
    `SELECT u.kind FROM daily_plan_items i JOIN learning_units u ON u.id = i.unit_id
      WHERE i.id = ANY($1::uuid[])`,
    [planItemIds],
  );

describe('lộ trình: reason và bảo toàn lịch sử', () => {
  it('mỗi lần sinh lộ trình lưu đúng reason; chỉ một lộ trình active; lịch sử học không đổi', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner, { allWrong: true });
    const before = await historyOf(learner);
    expect(before.records.length).toBeGreaterThan(0);
    expect(before.schedules.length).toBeGreaterThan(0);
    expect(before.stats.length).toBeGreaterThan(0);

    expect((await patchMe(learner, { goalType: 'jlpt', targetLevel: 'N5' })).status).toBe(200);
    expect(await historyOf(learner)).toEqual(before);
    expect((await patchMe(learner, { currentLevel: 'N5' })).status).toBe(200);
    expect(await historyOf(learner)).toEqual(before);
    expect((await post(learner, '/path/rebuild')).status).toBe(200);
    expect(await historyOf(learner)).toEqual(before);

    const paths = await query(
      ctx,
      `SELECT reason, status FROM learning_paths WHERE user_id = $1 ORDER BY created_at, id`,
      [learner.userId],
    );
    expect(paths.map((p) => p.reason)).toEqual([
      'onboarding',
      'goal_change',
      'level_change',
      'rebuild_request',
    ]);
    expect(paths.map((p) => p.status)).toEqual([
      'superseded',
      'superseded',
      'superseded',
      'active',
    ]);
  });

  it('đổi mục tiêu vẫn tính tiến độ đã học: đơn vị đã hoàn thành giữ trạng thái trên lộ trình mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await studyToday(learner);
    expect(plan.items.length).toBeGreaterThan(0);

    await patchMe(learner, { goalType: 'work' });
    const items = (await pathOf(learner)).items as any[];
    const completed = items.filter((i) => i.status === 'completed');
    expect(completed.length).toBe(plan.items.filter((i: any) => i.type === 'new_unit').length);
  });
});

describe('thời gian mỗi ngày', () => {
  it('có hiệu lực ở kế hoạch kế tiếp, không sinh lộ trình mới, kế hoạch đã sinh không đổi', async () => {
    const learner = await onboardedLearner(api, ctx);
    const day1 = await getToday(api, learner);
    expect(day1.budgetMinutes).toBe(10);

    expect((await patchMe(learner, { dailyMinutes: 15 })).status).toBe(200);
    // Kế hoạch hôm nay đã được sinh và lưu: giữ nguyên.
    expect((await getToday(api, learner)).budgetMinutes).toBe(10);

    await advanceDays(api, ctx, learner);
    const day2 = await getToday(api, learner);
    expect(day2.budgetMinutes).toBe(15);
    expect(day2.estimatedMinutes).toBeLessThanOrEqual(15);

    const [{ n }] = await query(
      ctx,
      `SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1`,
      [learner.userId],
    );
    expect(n).toBe(1);
  });
});

describe('tạm dừng và tiếp tục', () => {
  it('tạm dừng không sinh kế hoạch hay ngày bỏ lỡ; tiếp tục không báo khoảng nghỉ', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner); // 05/01
    const countPlans = async () =>
      (
        await query(ctx, `SELECT count(*)::int AS n FROM daily_plans WHERE user_id = $1`, [
          learner.userId,
        ])
      )[0].n;
    expect(await countPlans()).toBe(1);

    await advanceDays(api, ctx, learner); // 06/01
    expect((await post(learner, '/path/pause')).status).toBe(204);
    for (let day = 0; day < 4; day++) {
      const today = await api.get('/today', { token: learner.token, validateResponse: false });
      expect(today.status).toBe(409);
      expect(today.body.code).toBe('PATH_PAUSED');
      await advanceDays(api, ctx, learner);
    }
    // 10/01: không có kế hoạch hay ngày bỏ lỡ nào được tạo trong thời gian tạm dừng.
    expect(await countPlans()).toBe(1);

    expect((await post(learner, '/path/resume')).status).toBe(204);
    const plan = await getToday(api, learner);
    expect(plan.localDate).toBe('2026-01-10');
    expect(plan.items.length).toBeGreaterThan(0);
    // Ngày tạm dừng không tính là vắng → không phải khoảng nghỉ cần lập lại.
    expect(plan.notice).toBeNull();
    expect(await countPlans()).toBe(2);
  });

  it('tạm dừng rồi tiếp tục trong cùng ngày: giai đoạn rỗng, kế hoạch hôm nay vẫn dùng được', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await getToday(api, learner);
    await post(learner, '/path/pause');
    await post(learner, '/path/resume');
    expect((await getToday(api, learner)).id).toBe(before.id);
  });
});

describe('ưu tiên kỹ năng', () => {
  it('đặt prioritizedSkill đổi loại đơn vị mới trong kế hoạch kế tiếp', async () => {
    // Kế hoạch hôm nay đã được sinh lúc hoàn tất onboarding và không đổi; thiết lập có hiệu lực từ
    // kế hoạch được sinh kế tiếp (SC-006).
    const plain = await onboardedLearner(api, ctx);
    const prioritized = await onboardedLearner(api, ctx);
    expect((await patchMe(prioritized, { prioritizedSkill: 'grammar' })).status).toBe(200);
    const today = await getToday(api, prioritized);
    expect(today.items.map((i: any) => i.title)).toEqual(
      (await getToday(api, plain)).items.map((i: any) => i.title),
    );

    await advanceDays(api, ctx, plain);
    await advanceDays(api, ctx, prioritized, 0); // đồng hồ dùng chung: chỉ đăng nhập lại lấy token mới
    const plainPlan = await getToday(api, plain);
    const plainKinds = await planKinds([plainPlan.items[0].id]);
    expect(plainKinds[0]!.kind).toBe('vocabulary');

    const plan = await getToday(api, prioritized);
    const kinds = await planKinds([plan.items[0].id]);
    expect(kinds[0]!.kind).toBe('grammar');
  });
});

describe('đánh dấu đã thành thạo', () => {
  it('loại đơn vị khỏi bài sắp tới nhưng giữ lịch ôn; bỏ đánh dấu trả về trạng thái trước đó', async () => {
    const learner = await onboardedLearner(api, ctx);
    const day1 = await studyToday(learner);
    const learnedUnits = (await pathOf(learner)).items.filter(
      (i: any) => i.status === 'completed',
    ) as any[];
    expect(learnedUnits.length).toBeGreaterThan(0);
    const before = await historyOf(learner);

    // Đơn vị đã học: đánh dấu thành thạo không xóa lịch ôn.
    const learned = learnedUnits[0];
    const marked = await api.put(`/path/units/${learned.unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(marked.status).toBe(200);
    expect(
      ((await pathOf(learner)).items as any[]).find((i) => i.unitId === learned.unitId).status,
    ).toBe('mastered');
    const afterMark = await historyOf(learner);
    expect(afterMark.schedules).toEqual(before.schedules);
    expect(afterMark.records).toEqual(before.records);

    // Đơn vị chưa học kế tiếp bị đánh dấu thành thạo thì không vào kế hoạch ngày sau.
    const next = ((await pathOf(learner)).items as any[]).find((i) => i.status === 'pending');
    expect(next).toBeTruthy();
    await api.put(`/path/units/${next.unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    await advanceDays(api, ctx, learner);
    const day2 = await getToday(api, learner);
    const plannedUnits = await query<{ unit_id: string | null }>(
      ctx,
      `SELECT unit_id FROM daily_plan_items WHERE id = ANY($1::uuid[])`,
      [day2.items.map((i: any) => i.id)],
    );
    const plannedIds = plannedUnits.map((r) => r.unit_id);
    expect(plannedIds).not.toContain(next.unitId);
    expect(plannedIds).not.toContain(learned.unitId);
    // Lịch ôn của đơn vị thành thạo vẫn còn trong gói ôn hôm sau.
    expect(day2.items.some((i: any) => i.type === 'review_batch')).toBe(true);
    expect(day1.items.length).toBeGreaterThan(0);

    // Bỏ đánh dấu: đã từng hoàn thành → completed; chưa từng học → pending.
    await api.put(`/path/units/${learned.unitId}/master`, {
      token: learner.token,
      body: { mastered: false },
    });
    await api.put(`/path/units/${next.unitId}/master`, {
      token: learner.token,
      body: { mastered: false },
    });
    const items = (await pathOf(learner)).items as any[];
    expect(items.find((i) => i.unitId === learned.unitId).status).toBe('completed');
    expect(items.find((i) => i.unitId === next.unitId).status).toBe('pending');
  });

  it('đánh dấu đơn vị cuối cùng → remainingUnits=0; lộ trình chạm trần N3 → content_exhausted', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = (await pathOf(learner)).items as any[];
    const results = [];
    for (const item of items) {
      const res = await api.put(`/path/units/${item.unitId}/master`, {
        token: learner.token,
        body: { mastered: true },
      });
      expect(res.status).toBe(200);
      results.push(res.body);
    }
    expect(results.map((r) => r.remainingUnits)).toEqual(items.map((_, i) => items.length - 1 - i));
    // Chỉ đơn vị cuối cùng kèm gợi ý.
    expect(results.slice(0, -1).every((r) => r.suggestion === undefined)).toBe(true);
    expect(results.at(-1)).toEqual({ remainingUnits: 0, suggestion: 'content_exhausted' });

    // Hết bài mới: kế hoạch ngày sau chỉ còn thông báo hết nội dung (không có bài mới).
    await advanceDays(api, ctx, learner);
    const plan = await getToday(api, learner);
    expect(plan.items).toEqual([]);
    expect(plan.notice).toBe('content_exhausted');
  });

  it('mục tiêu JLPT N5 còn trình độ cao hơn trong N5–N3 → gợi ý raise_level', async () => {
    const learner = await onboardedLearner(api, ctx, { goalType: 'jlpt', targetLevel: 'N5' });
    const items = (await pathOf(learner)).items as any[];
    let last: any;
    for (const item of items) {
      last = await api.put(`/path/units/${item.unitId}/master`, {
        token: learner.token,
        body: { mastered: true },
      });
    }
    expect(last.body).toEqual({ remainingUnits: 0, suggestion: 'raise_level' });

    // Nâng mục tiêu lên N3 → sinh lộ trình mới (goal_change) và còn nội dung phù hợp nếu có đơn vị mới.
    expect((await patchMe(learner, { targetLevel: 'N3' })).status).toBe(200);
    expect((await pathOf(learner)).reason).toBe('goal_change');
  });

  it('người học khác không đánh dấu được đơn vị thay người học này (R16)', async () => {
    const a = await onboardedLearner(api, ctx);
    const b = await onboardedLearner(api, ctx);
    const unitId = ((await pathOf(a)).items as any[])[0].unitId;
    await api.put(`/path/units/${unitId}/master`, { token: a.token, body: { mastered: true } });
    expect(((await pathOf(b)).items as any[]).find((i) => i.unitId === unitId).status).toBe(
      'pending',
    );
  });
});

describe('khoảng nghỉ (FR-015, T092)', () => {
  it('vắng nhiều ngày: kế hoạch ≤ 60% quỹ cho ôn, mục dư giữ due_date gốc, có thông báo, không có "nợ"', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner);
    const schedulesBefore = (await historyOf(learner)).schedules;
    expect(schedulesBefore.length).toBeGreaterThan(0);

    await advanceDays(api, ctx, learner, 6); // 11/01: vắng 6 ngày
    const plan = await getToday(api, learner);
    expect(plan.notice).toBe('replanned_after_gap');
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(plan.budgetMinutes);
    const reviewMinutes = plan.items
      .filter((i: any) => i.type === 'review_batch')
      .reduce((sum: number, i: any) => sum + i.estMinutes, 0);
    expect(reviewMinutes).toBeLessThanOrEqual(Math.floor(0.6 * plan.budgetMinutes));
    for (const item of plan.items) expect(item.estMinutes).toBeLessThanOrEqual(15);

    // Không có trường nào mang nghĩa "nợ/tồn đọng" trong kế hoạch trả về.
    const keys = JSON.stringify(plan)
      .match(/"[A-Za-z_]+":/g)!
      .map((k) => k.toLowerCase());
    expect(keys.filter((k) => /debt|backlog|overdue|owed/.test(k))).toEqual([]);

    // Lịch ôn không bị sửa khi lập lại kế hoạch: due_date gốc vẫn giữ để ưu tiên về sau.
    expect((await historyOf(learner)).schedules).toEqual(schedulesBefore);
  });

  it('học liên tục (vắng dưới 2 ngày) thì không có thông báo khoảng nghỉ', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner);
    await advanceDays(api, ctx, learner);
    expect((await getToday(api, learner)).notice).toBeNull();
  });

  it('vắng đúng 2 ngày là khoảng nghỉ; người học chưa từng học thì không', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner);
    await advanceDays(api, ctx, learner, 2);
    expect((await getToday(api, learner)).notice).toBe('replanned_after_gap');

    const newcomer = await onboardedLearner(api, ctx);
    await advanceDays(api, ctx, newcomer, 7);
    expect((await getToday(api, newcomer)).notice).toBeNull();
  });
});

describe('độ khó thích ứng khi hoàn thành phiên (T091, FR-013)', () => {
  const stats = (learner: Learner) =>
    query(
      ctx,
      `SELECT topic_id, is_weak, difficulty_bias, consecutive_low, consecutive_high
         FROM topic_stats WHERE user_id = $1 ORDER BY topic_id`,
      [learner.userId],
    );

  /** Học ngày 1 (mọi mục) rồi ôn ngày 2, cùng một kết quả đúng/sai cho cả hai phiên. */
  async function twoSessions(learner: Learner, allWrong: boolean) {
    await studyToday(learner, { allWrong });
    await advanceDays(api, ctx, learner);
    const day2 = await getToday(api, learner);
    const review = day2.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();
    return studyPlanItem(api, ctx, learner, review.id, { allWrong });
  }

  it('< 60% liên tiếp 2 phiên → bias −1 và cờ điểm yếu', async () => {
    const learner = await onboardedLearner(api, ctx);
    await twoSessions(learner, true);

    const rows = await stats(learner);
    const adjusted = rows.filter((r) => r.consecutive_low >= 2);
    expect(adjusted.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.consecutive_high).toBe(0);
      expect(row.difficulty_bias).toBe(row.consecutive_low >= 2 ? -1 : 0);
    }
    expect(adjusted.every((r) => r.is_weak)).toBe(true);
  });

  it('> 90% liên tiếp 2 phiên → bias +1, không có điểm yếu', async () => {
    const learner = await onboardedLearner(api, ctx);
    await twoSessions(learner, false);

    const rows = await stats(learner);
    const adjusted = rows.filter((r) => r.consecutive_high >= 2);
    expect(adjusted.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.consecutive_low).toBe(0);
      expect(row.difficulty_bias).toBe(row.consecutive_high >= 2 ? 1 : 0);
      expect(row.is_weak).toBe(false);
    }
  });

  it('hoàn thành phiên gọi lại chỉ trả tóm tắt, không đếm chuỗi hai lần', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const { session } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      allWrong: true,
    });
    const before = await stats(learner);

    const again = await post(learner, `/sessions/${session.id}/complete`);
    expect(again.status).toBe(200);
    expect(await stats(learner)).toEqual(before);
    expect(before.every((r) => r.consecutive_low <= 1)).toBe(true);
  });

  it('phiên xen kẽ (thấp rồi cao) cắt chuỗi: bias không đổi', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyToday(learner, { allWrong: true });
    await advanceDays(api, ctx, learner);
    const day2 = await getToday(api, learner);
    const review = day2.items.find((i: any) => i.type === 'review_batch');
    await studyPlanItem(api, ctx, learner, review.id); // trả lời đúng hết

    for (const row of await stats(learner)) {
      expect(row.difficulty_bias).toBe(0);
      expect(row.consecutive_low).toBeLessThanOrEqual(1);
    }
  });
});
