/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, registerUser } from '../contract/client.js';
import {
  advanceDays,
  getToday,
  onboardedLearner,
  query,
  startSession,
  studyPlanItem,
  submit,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US4 (T083) trên PostgreSQL thật: số liệu `GET /progress` khớp hoạt động đã ghi
// (tổng thời gian là hợp các khoảng, chuỗi ngày theo `local_date` bỏ qua ngày tạm dừng và không đứt khi
// đổi múi giờ, trạng thái trống, đúng/chậm tiến độ so với `target_date`) và thống kê mảng (T084).

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

const progressOf = async (learner: Learner) => {
  const res = await api.get('/progress', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body;
};

/** Học mục đầu tiên của kế hoạch hôm nay. */
async function studyFirstItem(learner: Learner, options: Parameters<typeof studyPlanItem>[4] = {}) {
  const plan = await getToday(api, learner);
  return studyPlanItem(api, ctx, learner, plan.items[0].id, options);
}

describe('trạng thái trống', () => {
  it('người học mới: isEmpty, mọi số liệu bằng 0/null, không có điểm yếu', async () => {
    const learner = await onboardedLearner(api, ctx);
    expect(await progressOf(learner)).toMatchObject({
      isEmpty: true,
      totalMinutes: 0,
      lessonsCompleted: 0,
      reviewAccuracy: null,
      currentStreakDays: 0,
      goal: { completionRatio: 0, onTrack: null, targetDate: null },
      weakTopics: [],
    });
  });

  it('chỉ mở kế hoạch hôm nay chưa học gì thì vẫn là trạng thái trống', async () => {
    const learner = await onboardedLearner(api, ctx);
    await getToday(api, learner);
    expect((await progressOf(learner)).isEmpty).toBe(true);
  });

  it('tài khoản chưa onboarding trả trạng thái trống thay vì lỗi', async () => {
    const user = await registerUser(api);
    const res = await api.get('/progress', { token: user.accessToken });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isEmpty: true, currentStreakDays: 0, weakTopics: [] });
  });
});

describe('thời gian học và số bài hoàn thành', () => {
  it('tổng thời gian = độ dài hợp các khoảng: khoảng chồng nhau từ hai cửa sổ chỉ tính một lần', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const t0 = new Date('2026-01-05T07:00:00Z').getTime();
    const post = (offsetSeconds: number, durationSeconds: number, clientEventId = randomUUID()) =>
      api.post(`/sessions/${session.id}/intervals`, {
        token: learner.token,
        body: {
          clientEventId,
          startedAt: new Date(t0 + offsetSeconds * 1000).toISOString(),
          durationSeconds,
        },
      });

    expect((await post(0, 600)).status).toBe(204);
    expect((await post(300, 600)).status).toBe(204); // cửa sổ thứ hai, chồng 5 phút → hợp 0..900 giây
    expect((await post(2000, 60)).status).toBe(204); // khoảng rời
    expect((await progressOf(learner)).totalMinutes).toBe(16);

    // Gửi lại cùng clientEventId (thử lại sau mất kết nối) không cộng thêm.
    const retried = randomUUID();
    await post(5000, 60, retried);
    await post(5000, 60, retried);
    expect((await progressOf(learner)).totalMinutes).toBe(17);
    expect((await progressOf(learner)).isEmpty).toBe(false);
  });

  it('số bài hoàn thành tăng khi hoàn thành đơn vị, không tăng khi mới học dở', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    await startSession(api, learner, plan.items[0].id);
    expect((await progressOf(learner)).lessonsCompleted).toBe(0);

    await studyPlanItem(api, ctx, learner, plan.items[0].id);
    expect((await progressOf(learner)).lessonsCompleted).toBe(1);
    expect((await progressOf(learner)).isEmpty).toBe(false);
  });

  it('độ chính xác ôn chỉ tính câu lượt chính của phiên ôn', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyFirstItem(learner, { wrongIndexes: [0] });
    // Mới học bài, chưa ôn: chưa có độ chính xác ôn.
    expect((await progressOf(learner)).reviewAccuracy).toBeNull();

    await advanceDays(api, ctx, learner);
    const today = await getToday(api, learner);
    const review = today.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();
    const { session, results } = await studyPlanItem(api, ctx, learner, review.id, {
      wrongIndexes: [0],
    });
    expect(session.kind).toBe('review');
    const correct = results.filter((r: any) => r.isCorrect).length;
    expect((await progressOf(learner)).reviewAccuracy).toBeCloseTo(correct / results.length, 3);

    // Câu hỏi lại cuối phiên (isRetry) không làm đổi độ chính xác.
    const before = (await progressOf(learner)).reviewAccuracy;
    await submit(api, ctx, learner, session.id, session.exercises[0].id, {
      correct: true,
      isRetry: true,
    });
    expect((await progressOf(learner)).reviewAccuracy).toBe(before);
  });
});

describe('chuỗi ngày học (R11)', () => {
  it('đếm ngày liên tiếp, giữ chuỗi trong ngày chưa học, đứt khi vắng trọn một ngày', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyFirstItem(learner);
    expect((await progressOf(learner)).currentStreakDays).toBe(1);

    await advanceDays(api, ctx, learner); // ngày 2
    expect((await progressOf(learner)).currentStreakDays).toBe(1); // chưa học hôm nay: chuỗi chưa đứt
    await studyFirstItem(learner);
    expect((await progressOf(learner)).currentStreakDays).toBe(2);

    await advanceDays(api, ctx, learner); // ngày 3: chưa học
    expect((await progressOf(learner)).currentStreakDays).toBe(2);
    await advanceDays(api, ctx, learner); // ngày 4: vắng trọn ngày 3 → chuỗi đứt
    expect((await progressOf(learner)).currentStreakDays).toBe(0);

    await studyFirstItem(learner);
    expect((await progressOf(learner)).currentStreakDays).toBe(1);
  });

  it('bỏ qua ngày tạm dừng, đúng cả khi tạm dừng rồi tiếp tục nhiều lần', async () => {
    const learner = await onboardedLearner(api, ctx);
    const post = (url: string) => api.post(url, { token: learner.token });

    await studyFirstItem(learner); // 05/01
    await advanceDays(api, ctx, learner); // 06/01
    expect((await post('/path/pause')).status).toBe(204);

    await advanceDays(api, ctx, learner, 3); // 09/01: tiếp tục sau 3 ngày tạm dừng
    expect((await post('/path/resume')).status).toBe(204);
    await studyFirstItem(learner);
    // 09/01 + (08, 07, 06 tạm dừng) + 05/01 = 2 ngày học liên tiếp theo quy tắc bỏ qua tạm dừng.
    expect((await progressOf(learner)).currentStreakDays).toBe(2);

    await advanceDays(api, ctx, learner); // 10/01
    expect((await post('/path/pause')).status).toBe(204);
    await advanceDays(api, ctx, learner, 2); // 12/01
    expect((await post('/path/resume')).status).toBe(204);
    await studyFirstItem(learner);
    // 12/01 + (11, 10 tạm dừng) + 09/01 + (08, 07, 06 tạm dừng) + 05/01 = 3.
    expect((await progressOf(learner)).currentStreakDays).toBe(3);

    const periods = await query(
      ctx,
      `SELECT started_on::text AS s, ended_on::text AS e FROM pause_periods
        WHERE user_id = $1 ORDER BY started_on`,
      [learner.userId],
    );
    expect(periods).toEqual([
      { s: '2026-01-06', e: '2026-01-09' },
      { s: '2026-01-10', e: '2026-01-12' },
    ]);
  });

  it('đang tạm dừng không làm đứt chuỗi', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyFirstItem(learner);
    await api.post('/path/pause', { token: learner.token });
    await advanceDays(api, ctx, learner, 5);
    expect((await progressOf(learner)).currentStreakDays).toBe(1);
  });

  it('không đứt khi đổi múi giờ làm "hôm nay" lùi trước ngày học đã lưu', async () => {
    const learner = await onboardedLearner(api, ctx);
    await studyFirstItem(learner); // local_date 05/01 theo Asia/Ho_Chi_Minh (15:00)
    const patched = await api.patch('/me', {
      token: learner.token,
      body: { timezone: 'America/Anchorage' }, // 08:00Z = 23:00 ngày 04/01 tại đây
    });
    expect(patched.status).toBe(200);
    expect((await progressOf(learner)).currentStreakDays).toBe(1);

    // Bản ghi cũ giữ `local_date` lúc xảy ra, không bị tính lại theo múi giờ mới.
    const rows = await query(
      ctx,
      `SELECT DISTINCT local_date::text AS d FROM study_records WHERE user_id = $1`,
      [learner.userId],
    );
    expect(rows).toEqual([{ d: '2026-01-05' }]);
  });
});

describe('tiến độ mục tiêu (FR-028)', () => {
  /** Số đơn vị `active` trong khoảng trình độ của người mới (N5–N3: toàn bộ nội dung đã seed). */
  const activeUnits = async (): Promise<number> =>
    (await query(ctx, `SELECT count(*)::int AS n FROM learning_units WHERE status = 'active'`))[0]
      .n;

  it('tỷ lệ hoàn thành theo đơn vị `active` trong khoảng trình độ; đúng/chậm tiến độ theo mốc', async () => {
    // Mốc 54 ngày: đủ cho toàn bộ nội dung N5–N3 ở quỹ 10 phút/ngày (40% dành cho bài mới).
    const learner = await onboardedLearner(api, ctx, { targetDate: '2026-02-28' });
    const total = await activeUnits();
    const start = await progressOf(learner);
    expect(start.goal).toMatchObject({
      completionRatio: 0,
      onTrack: true,
      targetDate: '2026-02-28',
    });

    await studyFirstItem(learner);
    const after = await progressOf(learner);
    expect(after.goal.completionRatio).toBeCloseTo(1 / total, 3);
    expect(after.goal.onTrack).toBe(true);

    // Mốc gần (4 ngày) không đủ cho phần còn lại → chậm tiến độ; số liệu đã học không đổi.
    const tight = await api.patch('/me', {
      token: learner.token,
      body: { targetDate: '2026-01-09' },
    });
    expect(tight.status).toBe(200);
    const late = await progressOf(learner);
    expect(late.goal).toMatchObject({ onTrack: false, targetDate: '2026-01-09' });
    expect(late.goal.completionRatio).toBeCloseTo(1 / total, 3);
    expect(late.lessonsCompleted).toBe(1);

    // Bỏ mốc → không đánh giá đúng/chậm tiến độ.
    await api.patch('/me', { token: learner.token, body: { targetDate: null } });
    expect((await progressOf(learner)).goal).toMatchObject({ onTrack: null, targetDate: null });
  });

  it('đơn vị đánh dấu thành thạo tính là đã xong', async () => {
    const learner = await onboardedLearner(api, ctx);
    const path = await api.get('/path', { token: learner.token });
    const unitId = path.body.items[0].unitId;
    const marked = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(marked.status).toBe(200);
    expect((await progressOf(learner)).goal.completionRatio).toBeCloseTo(
      1 / (await activeUnits()),
      3,
    );
  });

  it('đơn vị bị admin vô hiệu hóa không tính vào tiến độ mục tiêu', async () => {
    const learner = await onboardedLearner(api, ctx);
    const [unit] = await query(
      ctx,
      `SELECT id FROM learning_units WHERE status = 'active' AND tier = 'core' LIMIT 1`,
    );
    await query(ctx, `UPDATE learning_units SET status = 'inactive' WHERE id = $1`, [unit.id]);
    ctx.app.deps.contentCache.invalidate();
    try {
      await studyFirstItem(learner);
      const total = await activeUnits(); // đã trừ đơn vị vừa vô hiệu hóa
      expect(total).toBeGreaterThanOrEqual(5);
      expect((await progressOf(learner)).goal.completionRatio).toBeCloseTo(1 / total, 3);
    } finally {
      await query(ctx, `UPDATE learning_units SET status = 'active' WHERE id = $1`, [unit.id]);
      ctx.app.deps.contentCache.invalidate();
    }
  });

  it('trình độ N2 tự khai báo hiển thị scopeNotice trong tiến độ mục tiêu', async () => {
    const learner = await onboardedLearner(api, ctx, { currentLevel: 'N2' });
    expect((await progressOf(learner)).goal.scopeNotice).toBe('content_ceiling_n3');
  });
});

describe('thống kê mảng và điểm yếu (T084, FR-029)', () => {
  const topicRows = (learner: Learner) =>
    query(
      ctx,
      `SELECT topic_id, recent_results, accuracy::float AS accuracy, is_weak,
              difficulty_bias, consecutive_low, consecutive_high
         FROM topic_stats WHERE user_id = $1 ORDER BY topic_id`,
      [learner.userId],
    );

  it('trả lời ghi vào topic_stats; gửi trùng clientEventId không đếm hai lần', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const [first] = session.exercises;
    const clientEventId = randomUUID();

    const a = await submit(api, ctx, learner, session.id, first.id, {
      clientEventId,
      correct: false,
    });
    const b = await submit(api, ctx, learner, session.id, first.id, {
      clientEventId,
      correct: false,
    });
    expect(a.body.duplicate).toBe(false);
    expect(b.body.duplicate).toBe(true);

    const rows = await topicRows(learner);
    expect(rows).toHaveLength(1);
    expect(rows[0].recent_results).toEqual([0]);
    expect(rows[0].accuracy).toBe(0);
    // Chưa đủ 8 câu: chưa gắn cờ yếu.
    expect(rows[0].is_weak).toBe(false);
  });

  it('câu hỏi lại cuối phiên (isRetry) không vào topic_stats', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    for (const e of session.exercises) {
      await submit(api, ctx, learner, session.id, e.id, { correct: false });
    }
    const before = await topicRows(learner);
    expect(before[0].recent_results).toHaveLength(session.exercises.length);

    for (const e of session.exercises) {
      await submit(api, ctx, learner, session.id, e.id, { correct: true, isRetry: true });
    }
    expect(await topicRows(learner)).toEqual(before);
  });

  it('mảng làm kém (< 60% với ≥ 8 câu) được hiển thị là điểm yếu kèm tên theo ngôn ngữ', async () => {
    const learner = await onboardedLearner(api, ctx);
    const day1 = await getToday(api, learner);
    for (const item of day1.items) {
      await studyPlanItem(api, ctx, learner, item.id, { allWrong: true });
    }

    await advanceDays(api, ctx, learner);
    const day2 = await getToday(api, learner);
    const review = day2.items.find((i: any) => i.type === 'review_batch');
    expect(review).toBeTruthy();
    await studyPlanItem(api, ctx, learner, review.id, { allWrong: true });

    const weakRows = (await topicRows(learner)).filter((r) => r.is_weak);
    expect(weakRows.length).toBeGreaterThan(0);

    const { weakTopics } = await progressOf(learner);
    expect(weakTopics).toHaveLength(weakRows.length);
    for (const t of weakTopics) {
      expect(weakRows.map((r) => r.topic_id)).toContain(t.topicId);
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.accuracy).toBe(0);
    }
    const names = await query(
      ctx,
      `SELECT name->>'vi' AS vi FROM topics WHERE id = ANY($1::uuid[])`,
      [weakTopics.map((t: any) => t.topicId)],
    );
    expect(weakTopics.map((t: any) => t.name).sort()).toEqual(names.map((n) => n.vi).sort());
  });

  it('tiến độ của người học này không lẫn dữ liệu của người học khác (R16)', async () => {
    const a = await onboardedLearner(api, ctx);
    const b = await onboardedLearner(api, ctx);
    await studyFirstItem(a, { allWrong: true });
    expect((await progressOf(b)).isEmpty).toBe(true);
    expect((await progressOf(a)).lessonsCompleted).toBe(1);
  });
});
