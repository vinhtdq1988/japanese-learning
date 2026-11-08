/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  countItemsLearned,
  hasEarlierCompletedLesson,
  hasEarlierPerfectLesson,
} from '../../src/db/repositories/progress.js';
import { ACHIEVEMENT_CATALOG } from '../../src/domain/achievements.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  answerAll,
  getToday,
  onboardedLearner,
  query,
  startSession,
  studyPlanItem,
  type Learner,
} from './lesson-helpers.js';
import {
  celebratedCodes,
  celebratedDays,
  earnedRows,
  localDaysAgo,
  markEarned,
  seedActivityDays,
  seedLearnedItems,
  seedStreakEndingYesterday,
  sessionUnitId,
} from './reward-helpers.js';

// Kiểm thử tích hợp thành tựu (spec 005, T041, data-model §3.3–3.4) trên PostgreSQL thật: đồng thời, idempotent,
// mốc ghi âm thầm khi đổi cấu hình/người học cũ, ranh giới ngày, cascade xóa, hiệu năng của `complete`.

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

const complete = (learner: Learner, sessionId: string) =>
  api.post(`/sessions/${sessionId}/complete`, { token: learner.token });

/** Đăng nhập lại để lấy token hợp lệ sau khi đặt lại đồng hồ giả (access token sống 15 phút). */
async function relogin(learner: Learner): Promise<void> {
  const login = await api.post('/auth/login', {
    body: { email: learner.user.email, password: learner.user.password },
  });
  learner.token = login.body.accessToken;
}

/** Mở một phiên "học thêm" và trả lời mọi câu (câu đầu sai nên không hoàn hảo); chưa hoàn thành. */
async function openExtraSession(learner: Learner, exclude: readonly string[] = []) {
  const extra = await api.post('/today/extra', { token: learner.token });
  if (extra.status !== 200) throw new Error(`Không có bài học thêm: ${JSON.stringify(extra.body)}`);
  if (exclude.includes(extra.body.id)) throw new Error('Bài học thêm trùng bài đã mở');
  const session = await startSession(api, learner, extra.body.id);
  await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
  return session;
}

describe('(a) đồng thời và (b) idempotent', () => {
  it('hai phiên cùng vượt một mốc → đúng một dòng và chỉ MỘT phản hồi có mốc đó', async () => {
    const learner = await onboardedLearner(api, ctx);
    await seedStreakEndingYesterday(ctx, learner, 6);
    const plan = await getToday(api, learner);
    const a = await startSession(api, learner, plan.items[0].id);
    await answerAll(api, ctx, learner, a, { wrongIndexes: [0] });
    const b = await openExtraSession(learner);

    const [ra, rb] = await Promise.all([complete(learner, a.id), complete(learner, b.id)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);

    for (const code of ['streak_7', 'first_lesson']) {
      const hits = [ra.body, rb.body].filter((s) => celebratedCodes(s).includes(code));
      expect(hits, `mốc ${code} phải được chúc mừng đúng một lần`).toHaveLength(1);
    }
    const rows = await query(
      ctx,
      `SELECT achievement_code FROM earned_achievements
        WHERE user_id = $1 AND achievement_code IN ('streak_7', 'first_lesson')`,
      [learner.userId],
    );
    expect(rows).toHaveLength(2);
  });

  it('hai lệnh complete đồng thời trên CÙNG phiên → chỉ một lệnh nhận celebrations', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    await answerAll(api, ctx, learner, session);
    const results = await Promise.all([
      complete(learner, session.id),
      complete(learner, session.id),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.filter((r) => r.body.celebrations)).toHaveLength(1);
  });
});

describe('(c) mốc earned ⇔ đã trả cho client', () => {
  it('mọi dòng source=earned đều đã được trả trong một phản hồi, và ngược lại', async () => {
    const learner = await onboardedLearner(api, ctx);
    await seedStreakEndingYesterday(ctx, learner, 2);
    const returned = new Set<string>();
    const plan = await getToday(api, learner);
    for (const item of plan.items) {
      const { summary } = await studyPlanItem(api, ctx, learner, item.id);
      celebratedCodes(summary).forEach((c) => returned.add(c));
    }
    const rows = await earnedRows(ctx, learner.userId);
    const earned = Object.entries(rows)
      .filter(([, source]) => source === 'earned')
      .map(([code]) => code);
    expect([...returned].sort()).toEqual(earned.sort());
    expect(returned.has('streak_3')).toBe(true);
  });
});

describe('(d) chỉ số trên dữ liệu thật', () => {
  it('countItemsLearned: chỉ mục có lịch ôn VÀ đơn vị đã có phiên hoàn thành', async () => {
    const learner = await onboardedLearner(api, ctx);
    expect(await countItemsLearned(ctx.handle.db, learner.userId)).toBe(0);
    expect(await seedLearnedItems(ctx, learner, 30)).toBe(30);
    expect(await countItemsLearned(ctx.handle.db, learner.userId)).toBe(30);

    // Mục có lịch ôn nhưng đơn vị chưa có phiên hoàn thành thì chưa tính.
    const [stray] = await query<{ id: string }>(
      ctx,
      `SELECT ci.id FROM content_items ci
        WHERE NOT EXISTS (SELECT 1 FROM lesson_sessions s
                           WHERE s.user_id = $1 AND s.unit_id = ci.unit_id AND s.status = 'completed')
        LIMIT 1`,
      [learner.userId],
    );
    await query(
      ctx,
      `INSERT INTO review_schedules (user_id, item_id, facet, interval_days, ease, repetitions, lapses, due_date)
       VALUES ($1, $2, 'item', 1, 2.5, 1, 0, '2026-02-01')`,
      [learner.userId, stray!.id],
    );
    expect(await countItemsLearned(ctx.handle.db, learner.userId)).toBe(30);
  });

  it('hasEarlierCompletedLesson / hasEarlierPerfectLesson', async () => {
    const learner = await onboardedLearner(api, ctx);
    const db = ctx.handle.db;
    const none = randomUUID();
    expect(await hasEarlierCompletedLesson(db, learner.userId, none)).toBe(false);
    expect(await hasEarlierPerfectLesson(db, learner.userId, none)).toBe(false);

    // Chỉ có phiên ôn hoàn thành: không phải bài học mới.
    await seedActivityDays(ctx, learner, [localDaysAgo(ctx, 1)]);
    expect(await hasEarlierCompletedLesson(db, learner.userId, none)).toBe(false);
    expect(await hasEarlierPerfectLesson(db, learner.userId, none)).toBe(false);

    const plan = await getToday(api, learner);
    const imperfect = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(await hasEarlierCompletedLesson(db, learner.userId, none)).toBe(true);
    // Loại chính phiên đó ra thì không còn bài học nào khác.
    expect(await hasEarlierCompletedLesson(db, learner.userId, imperfect.session.id)).toBe(false);
    expect(await hasEarlierPerfectLesson(db, learner.userId, none)).toBe(false);

    const perfect = await openExtraSession(learner); // câu đầu sai nên không hoàn hảo
    await complete(learner, perfect.id);
    expect(await hasEarlierPerfectLesson(db, learner.userId, none)).toBe(false);

    // Phiên hoàn hảo: trả lời đúng hết.
    const extra = await api.post('/today/extra', { token: learner.token });
    const good = await startSession(api, learner, extra.body.id);
    await answerAll(api, ctx, learner, good);
    await complete(learner, good.id);
    expect(await hasEarlierPerfectLesson(db, learner.userId, none)).toBe(true);
    expect(await hasEarlierPerfectLesson(db, learner.userId, good.id)).toBe(false);
  });
});

describe('(e)(f) đổi mục tiêu làm tỷ lệ nhảy mốc; tỷ lệ tụt không đạt lại', () => {
  it('tỷ lệ nhảy qua 25% do dữ liệu cấu hình → goal_25 ghi âm thầm, không chúc mừng', async () => {
    const learner = await onboardedLearner(api, ctx);
    const path = await api.get('/path', { token: learner.token });
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const lessonUnit = (await sessionUnitId(ctx, session.id))!;
    const others = (path.body.items as any[]).filter((i) => i.unitId !== lessonUnit);
    const jump = Math.ceil(path.body.totalUnits * 0.3);
    for (const unit of others.slice(0, jump)) {
      await query(
        ctx,
        `INSERT INTO unit_progress (user_id, unit_id, status, updated_at)
         VALUES ($1, $2, 'completed', now()) ON CONFLICT DO NOTHING`,
        [learner.userId, unit.unitId],
      );
    }
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const done = await complete(learner, session.id);
    expect(celebratedCodes(done.body)).not.toContain('goal_25');
    expect((await earnedRows(ctx, learner.userId)).goal_25).toBe('silent');
  });

  it('tỷ lệ tụt dưới mốc đã đạt → dòng cũ giữ nguyên, không đạt lại ở lần sau', async () => {
    const learner = await onboardedLearner(api, ctx);
    await markEarned(ctx, learner.userId, ['goal_25'], 'earned');
    const before = await query<{ earned_at: string }>(
      ctx,
      `SELECT earned_at FROM earned_achievements WHERE user_id = $1 AND achievement_code = 'goal_25'`,
      [learner.userId],
    );
    await query(ctx, 'DELETE FROM unit_progress WHERE user_id = $1', [learner.userId]);
    const plan = await getToday(api, learner);
    const { summary } = await studyPlanItem(api, ctx, learner, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(celebratedCodes(summary)).not.toContain('goal_25');
    const after = await query<{ earned_at: string; source: string }>(
      ctx,
      `SELECT earned_at, source FROM earned_achievements WHERE user_id = $1 AND achievement_code = 'goal_25'`,
      [learner.userId],
    );
    expect(after).toHaveLength(1);
    expect(after[0]!.source).toBe('earned');
    expect(after[0]!.earned_at).toEqual(before[0]!.earned_at);
  });
});

describe('(g) người học cũ', () => {
  it('chuỗi 20 ngày + 60 mục chưa có dòng nào → mốc đã vượt ghi âm thầm, không chúc mừng dồn dập', async () => {
    const learner = await onboardedLearner(api, ctx);
    await seedStreakEndingYesterday(ctx, learner, 20);
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const lessonUnit = (await sessionUnitId(ctx, session.id))!;
    // Nội dung seed chỉ có vài chục mục nên dùng 60 mục (vượt mốc items_50) thay vì 120 như hồ sơ `reward-veteran`.
    expect(await seedLearnedItems(ctx, learner, 60, [lessonUnit])).toBe(60);
    await answerAll(api, ctx, learner, session, { wrongIndexes: [0] });
    const done = await complete(learner, session.id);

    const celebrated = celebratedCodes(done.body);
    for (const code of ['streak_3', 'streak_7', 'streak_14', 'items_50', 'first_lesson']) {
      expect(celebrated, `không được chúc mừng ${code}`).not.toContain(code);
    }
    const rows = await earnedRows(ctx, learner.userId);
    for (const code of ['streak_3', 'streak_7', 'streak_14', 'items_50', 'first_lesson']) {
      expect(rows[code], code).toBe('silent');
    }
  });
});

describe('(h) tạm dừng / tiếp tục lộ trình', () => {
  it('không sinh dòng thành tựu hay chúc mừng nào', async () => {
    const learner = await onboardedLearner(api, ctx);
    const pause = await api.post('/path/pause', { token: learner.token });
    expect(pause.status).toBe(204);
    const resume = await api.post('/path/resume', { token: learner.token });
    expect(resume.status).toBe(204);
    expect(await earnedRows(ctx, learner.userId)).toEqual({});
    expect(await celebratedDays(ctx, learner.userId)).toEqual([]);
  });
});

describe('(i) ranh giới ngày bằng đồng hồ giả', () => {
  const setLocal = async (learner: Learner, iso: string) => {
    ctx.clock.set(iso);
    await relogin(learner);
  };

  it('23:59 giờ địa phương vẫn nối chuỗi 6 ngày thành 7; 00:01 ngày sau (đứt một ngày) thì không', async () => {
    // Asia/Ho_Chi_Minh = UTC+7: 2026-01-05T16:59Z = 23:59 ngày 05; 17:01Z = 00:01 ngày 06.
    const nearMidnight = await onboardedLearner(api, ctx);
    await seedStreakEndingYesterday(ctx, nearMidnight, 6); // 6 ngày kết thúc ngày 04
    await setLocal(nearMidnight, '2026-01-05T16:59:00Z');
    const plan = await getToday(api, nearMidnight);
    const { summary } = await studyPlanItem(api, ctx, nearMidnight, plan.items[0].id, {
      wrongIndexes: [0],
    });
    expect(celebratedCodes(summary)).toContain('streak_7');

    const afterMidnight = await onboardedLearner(api, ctx);
    await setLocal(afterMidnight, '2026-01-05T08:00:00Z');
    await seedStreakEndingYesterday(ctx, afterMidnight, 6); // kết thúc ngày 04
    await setLocal(afterMidnight, '2026-01-05T17:01:00Z'); // đã sang ngày 06: thiếu ngày 05
    const plan2 = await getToday(api, afterMidnight);
    const { summary: s2 } = await studyPlanItem(api, ctx, afterMidnight, plan2.items[0].id, {
      wrongIndexes: [0],
    });
    expect(celebratedCodes(s2)).not.toContain('streak_7');
    expect((await earnedRows(ctx, afterMidnight.userId)).streak_7).toBeUndefined();
    ctx.clock.set('2026-01-05T08:00:00Z');
  });
});

describe('(j) xóa tài khoản', () => {
  it('xóa người dùng kéo theo xóa earned_achievements và daily_completion_celebrations', async () => {
    const learner = await onboardedLearner(api, ctx);
    await markEarned(ctx, learner.userId, ['streak_3']);
    await query(
      ctx,
      `INSERT INTO daily_completion_celebrations (user_id, local_date, celebrated_at)
       VALUES ($1, '2026-01-05', now())`,
      [learner.userId],
    );
    await query(ctx, 'DELETE FROM users WHERE id = $1', [learner.userId]);
    for (const table of ['earned_achievements', 'daily_completion_celebrations']) {
      const rows = await query(ctx, `SELECT 1 FROM ${table} WHERE user_id = $1`, [learner.userId]);
      expect(rows, table).toHaveLength(0);
    }
  });
});

describe('(k) hiệu năng: p95 của complete tăng ≤ 100 ms ở hồ sơ lớn', () => {
  const SAMPLES = 8;
  const p95 = (values: number[]) =>
    [...values].sort((a, b) => a - b)[
      Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)
    ]!;

  async function timeCompletions(learner: Learner, resetEarned: boolean): Promise<number[]> {
    const timings: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const session = await openExtraSession(learner);
      const started = performance.now();
      const res = await complete(learner, session.id);
      timings.push(performance.now() - started);
      expect(res.status).toBe(200);
      // Giữ trạng thái "chưa có mốc nào" để lần sau lại phải tính đủ chỉ số.
      if (resetEarned) {
        await query(ctx, 'DELETE FROM earned_achievements WHERE user_id = $1', [learner.userId]);
      }
    }
    return timings;
  }

  it('đo so với đường cơ sở (mọi mốc đã đạt ⇒ không tính gì thêm)', async () => {
    const heavy = await onboardedLearner(api, ctx);
    const baseline = await onboardedLearner(api, ctx);
    for (const learner of [heavy, baseline]) {
      await seedStreakEndingYesterday(ctx, learner, 60);
      await seedLearnedItems(ctx, learner, 150);
    }
    await markEarned(
      ctx,
      baseline.userId,
      ACHIEVEMENT_CATALOG.map((a) => a.code),
      'silent',
    );
    // Khởi động (kết nối, cache) trước khi đo.
    await complete(baseline, (await openExtraSession(baseline)).id);

    const base = await timeCompletions(baseline, false);
    const full = await timeCompletions(heavy, true);
    const delta = p95(full) - p95(base);
    expect(
      delta,
      `p95 đầy đủ ${p95(full).toFixed(0)}ms, cơ sở ${p95(base).toFixed(0)}ms`,
    ).toBeLessThanOrEqual(100);
  }, 120_000);
});
