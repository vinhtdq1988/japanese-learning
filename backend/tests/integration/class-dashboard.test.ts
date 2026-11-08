/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { getToday, onboardedLearner, query, studyPlanItem } from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
  type TestUser,
} from './org-helpers.js';

// Kiểm thử tích hợp bảng điều khiển lớp (spec 004, T080, US4, quickstart OG4, research O10/O11): mỗi học viên
// có đủ trường FR-027 và dòng tổng hợp; sắp xếp/lọc; số liệu chỉ tính từ `joined_at`; "chưa bắt đầu" khi chưa
// hoạt động; loại tài khoản không hoạt động; khớp màn hình học viên (SC-006); hiệu năng 50 học viên × 30 ngày.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z'; // 12:00 giờ Việt Nam, ngày địa phương 2026-01-20

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => {
  ctx.clock.set(NOW);
});
afterAll(async () => {
  await ctx.close();
});

interface ExercisePool {
  exerciseId: string;
  topicId: string;
}
let pool: ExercisePool[] = [];
async function exercisePool(): Promise<ExercisePool[]> {
  if (pool.length > 0) return pool;
  pool = (
    await query<{ id: string; topic_id: string }>(
      ctx,
      `SELECT e.id, u.topic_id FROM exercises e JOIN learning_units u ON u.id = e.unit_id
        WHERE e.status = 'active' ORDER BY e.id LIMIT 8`,
    )
  ).map((r) => ({ exerciseId: r.id, topicId: r.topic_id }));
  return pool;
}

interface Activity {
  /** Ngày địa phương (Asia/Ho_Chi_Minh) của hoạt động. */
  day: string;
  /** Độ dài khoảng thời gian học (giây), mặc định 600. */
  seconds?: number;
  /** Số câu lượt chính trả lời đúng/tổng (ngữ cảnh `review`), mặc định 3/4. */
  correct?: number;
  total?: number;
  context?: 'lesson' | 'review';
}

/** Ghi trực tiếp phiên + bản ghi + khoảng thời gian học (hàng loạt) cho một học viên. */
async function seedActivity(userId: string, activities: Activity[]): Promise<void> {
  if (activities.length === 0) return;
  const exs = await exercisePool();
  const sessionIds = activities.map(() => randomUUID());
  await ctx.handle.pool.query(
    `INSERT INTO lesson_sessions (id, user_id, kind, snapshot, status, started_at, completed_at)
     SELECT s.id, $1, 'review', '{}'::jsonb, 'completed', s.at::timestamptz, s.at::timestamptz
       FROM unnest($2::uuid[], $3::text[]) AS s(id, at)`,
    [userId, sessionIds, activities.map((a) => `${a.day}T03:00:00Z`)],
  );
  const rec = {
    session: [] as string[],
    exercise: [] as string[],
    topic: [] as string[],
    correct: [] as boolean[],
    context: [] as string[],
    at: [] as string[],
    day: [] as string[],
  };
  activities.forEach((a, i) => {
    const total = a.total ?? 4;
    const correct = a.correct ?? 3;
    for (let k = 0; k < total; k++) {
      const ex = exs[k % exs.length]!;
      rec.session.push(sessionIds[i]!);
      rec.exercise.push(ex.exerciseId);
      rec.topic.push(ex.topicId);
      rec.correct.push(k < correct);
      rec.context.push(a.context ?? 'review');
      rec.at.push(`${a.day}T03:00:00Z`);
      rec.day.push(a.day);
    }
  });
  await ctx.handle.pool.query(
    `INSERT INTO study_records (user_id, client_event_id, session_id, exercise_id, topic_id, is_correct,
                                submitted_answer, context, is_retry, occurred_at, local_date)
     SELECT $1, gen_random_uuid(), r.s, r.e, r.t, r.c, '{}'::jsonb, r.ctx::record_context, false,
            r.at::timestamptz, r.d::date
       FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::boolean[], $6::text[], $7::text[], $8::text[])
         AS r(s, e, t, c, ctx, at, d)`,
    [userId, rec.session, rec.exercise, rec.topic, rec.correct, rec.context, rec.at, rec.day],
  );
  await ctx.handle.pool.query(
    `INSERT INTO study_intervals (user_id, client_event_id, session_id, started_at, duration_seconds, local_date)
     SELECT $1, gen_random_uuid(), i.s, i.at::timestamptz, i.sec, i.d::date
       FROM unnest($2::uuid[], $3::text[], $4::int[], $5::text[]) AS i(s, at, sec, d)`,
    [
      userId,
      sessionIds,
      activities.map((a) => `${a.day}T03:00:00Z`),
      activities.map((a) => a.seconds ?? 600),
      activities.map((a) => a.day),
    ],
  );
}

/** Đánh dấu `count` đơn vị đầu của lộ trình lớp là đã hoàn thành cho học viên. */
async function completeUnits(userId: string, unitIds: string[]): Promise<void> {
  if (unitIds.length === 0) return;
  await ctx.handle.pool.query(
    `INSERT INTO unit_progress (user_id, unit_id, status)
     SELECT $1, u, 'completed' FROM unnest($2::uuid[]) AS u
     ON CONFLICT (user_id, unit_id) DO UPDATE SET status = 'completed'`,
    [userId, unitIds],
  );
}

interface World {
  orgId: string;
  classId: string;
  teacher: TestUser;
  token: string;
  /** Id các đơn vị bắt buộc của lộ trình lớp, theo thứ tự tham khảo. */
  requiredUnitIds: string[];
}

/** Lớp có lộ trình chặt (05→25/01, 30 phút/ngày) để hôm nay (20/01) mong đợi ~75%. */
async function setupClass(seats = 20, licenseStartsOn?: string): Promise<World> {
  const org = await createTestOrg(ctx, {
    seats,
    ...(licenseStartsOn ? { startsOn: licenseStartsOn } : {}),
  });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const token = await tokenFor(ctx, teacher);
  const put = await api.put(`/classes/${classId}/path`, {
    token,
    body: {
      startLevel: 'N5',
      targetLevel: 'N4',
      skills: ['vocabulary', 'grammar'],
      startsOn: '2026-01-05',
      endsOn: '2026-01-25',
      dailyMinutes: 30,
    },
  });
  expect(put.status).toBe(200);
  const path = await api.get(`/classes/${classId}/path`, { token });
  const requiredUnitIds: string[] = path.body.path.units.map((u: any) => u.unitId);
  expect(requiredUnitIds.length).toBeGreaterThan(4);
  return { orgId: org.orgId, classId, teacher, token, requiredUnitIds };
}

/** Học viên vào lớp vào thời điểm `joinedAt` (đồng hồ giả được đặt lại về NOW sau đó). */
async function joinLearner(
  w: World,
  displayName: string,
  joinedAt = '2026-01-06T03:00:00Z',
): Promise<TestUser & { membershipId: string }> {
  const user = await createTestUser(ctx, { displayName });
  ctx.clock.set(joinedAt);
  const { membershipId } = await enrollLearner(ctx, w.orgId, w.classId, user.userId);
  ctx.clock.set(NOW);
  return { ...user, membershipId };
}

const dashboard = async (w: World, qs = '') => {
  const res = await api.get(`/classes/${w.classId}/dashboard${qs}`, { token: w.token });
  expect(res.status).toBe(200);
  return res.body;
};
const rowOf = (body: any, userId: string) => body.learners.find((r: any) => r.userId === userId);

describe('đủ trường FR-027 và dòng tổng hợp', () => {
  it('năm học viên ở năm trạng thái: đúng tiến độ, chậm, vượt, tạm dừng, chưa bắt đầu', async () => {
    const w = await setupClass();
    const n = w.requiredUnitIds.length;
    const onTrack = await joinLearner(w, 'An đúng tiến độ');
    const behind = await joinLearner(w, 'Bình chậm tiến độ');
    const ahead = await joinLearner(w, 'Chi vượt tiến độ');
    const paused = await joinLearner(w, 'Dũng tạm dừng');
    const fresh = await joinLearner(w, 'Em chưa bắt đầu');

    await completeUnits(onTrack.userId, w.requiredUnitIds.slice(0, Math.round(n * 0.75)));
    await completeUnits(ahead.userId, w.requiredUnitIds.slice(0, n));
    await seedActivity(onTrack.userId, [
      { day: '2026-01-18', seconds: 1200, correct: 4, total: 4 },
      { day: '2026-01-19', seconds: 600, correct: 2, total: 4 },
    ]);
    await seedActivity(behind.userId, [{ day: '2026-01-10', seconds: 300 }]);
    await seedActivity(ahead.userId, [{ day: '2026-01-19', seconds: 900 }]);
    await seedActivity(paused.userId, [{ day: '2026-01-12', seconds: 300 }]);
    await ctx.handle.pool.query(
      `INSERT INTO class_pause_periods (class_id, membership_id, started_on) VALUES ($1, $2, '2026-01-18')`,
      [w.classId, paused.membershipId],
    );

    const body = await dashboard(w);
    expect(body.classId).toBe(w.classId);
    expect(body.learners).toHaveLength(5);

    const a = rowOf(body, onTrack.userId);
    expect(a).toMatchObject({
      displayName: 'An đúng tiến độ',
      email: onTrack.email,
      hasStarted: true,
      pathCompleted: false,
      progressStatus: 'on_track',
      lastActiveOn: '2026-01-19',
      streakDays: 2,
      minutesTotal: 30,
      minutesLast7Days: 30,
      reviewAccuracy: 0.75, // (4 + 2) / 8 câu lượt chính ôn tập
    });
    expect(a.completionRatio).toBeCloseTo(Math.round(n * 0.75) / n, 2);
    expect(a.expectedRatio).toBeGreaterThan(0.6);
    expect(a.expectedRatio).toBeLessThan(0.9);
    expect(a.joinedAt).toBeTruthy();

    expect(rowOf(body, behind.userId)).toMatchObject({
      hasStarted: true,
      progressStatus: 'behind',
      lastActiveOn: '2026-01-10',
      minutesTotal: 5,
      streakDays: 0,
    });
    expect(rowOf(body, ahead.userId)).toMatchObject({
      progressStatus: 'ahead',
      pathCompleted: true,
      completionRatio: 1,
    });
    expect(rowOf(body, paused.userId)).toMatchObject({ progressStatus: 'paused' });
    expect(rowOf(body, fresh.userId)).toMatchObject({
      hasStarted: false,
      lastActiveOn: null,
      reviewAccuracy: null,
    });

    expect(body.summary).toMatchObject({
      learnerCount: 5,
      onTrack: expect.any(Number),
      behind: expect.any(Number),
      ahead: 1,
      paused: 1,
      needAttention: expect.any(Number),
    });
    const s = body.summary;
    expect(s.onTrack + s.behind + s.ahead + s.paused).toBe(5);
    expect(s.avgCompletionRatio).toBeTypeOf('number');
    expect(body.contentNotices).toEqual([]);
  });

  it('lớp chưa có học viên: danh sách rỗng, tổng hợp bằng 0, trung bình null', async () => {
    const w = await setupClass();
    const body = await dashboard(w);
    expect(body.learners).toEqual([]);
    expect(body.summary).toMatchObject({
      learnerCount: 0,
      onTrack: 0,
      behind: 0,
      ahead: 0,
      paused: 0,
      needAttention: 0,
    });
    expect(body.summary.avgCompletionRatio ?? null).toBeNull();
    expect(body.summary.avgReviewAccuracy ?? null).toBeNull();
  });

  it('bài giao quá hạn chưa xong ⇒ chậm tiến độ dù hoàn thành nhiều', async () => {
    const w = await setupClass();
    const n = w.requiredUnitIds.length;
    const learner = await joinLearner(w, 'Giang trễ bài giao');
    await completeUnits(learner.userId, w.requiredUnitIds.slice(1, Math.round(n * 0.8)));
    await ctx.handle.pool.query(
      `INSERT INTO class_assignments (class_id, batch_id, unit_id, due_on) VALUES ($1, $2, $3, '2026-01-10')`,
      [w.classId, randomUUID(), w.requiredUnitIds[0]],
    );
    await seedActivity(learner.userId, [{ day: '2026-01-19' }]);
    const body = await dashboard(w);
    expect(rowOf(body, learner.userId).progressStatus).toBe('behind');
  });
});

describe('sắp xếp và lọc', () => {
  async function sortedWorld() {
    const w = await setupClass();
    const n = w.requiredUnitIds.length;
    const names = ['Cường', 'An', 'Bình'];
    const ratios = [0.5, 0.9, 0.1];
    const mins = [900, 300, 1800];
    const users = [];
    for (let i = 0; i < names.length; i++) {
      const u = await joinLearner(w, names[i]!);
      await completeUnits(u.userId, w.requiredUnitIds.slice(0, Math.round(n * ratios[i]!)));
      await seedActivity(u.userId, [{ day: '2026-01-19', seconds: mins[i]! }]);
      users.push(u);
    }
    return { w, users };
  }

  it('sort=name theo thứ tự chữ cái, order=desc đảo ngược', async () => {
    const { w } = await sortedWorld();
    const asc = (await dashboard(w, '?sort=name&order=asc')).learners.map(
      (r: any) => r.displayName,
    );
    expect(asc).toEqual(['An', 'Bình', 'Cường']);
    const desc = (await dashboard(w, '?sort=name&order=desc')).learners.map(
      (r: any) => r.displayName,
    );
    expect(desc).toEqual(['Cường', 'Bình', 'An']);
  });

  it('sort=completion và sort=minutes7 theo giá trị số', async () => {
    const { w } = await sortedWorld();
    const byCompletion = (await dashboard(w, '?sort=completion&order=desc')).learners.map(
      (r: any) => r.displayName,
    );
    expect(byCompletion).toEqual(['An', 'Cường', 'Bình']);
    const byMinutes = (await dashboard(w, '?sort=minutes7&order=asc')).learners.map(
      (r: any) => r.displayName,
    );
    expect(byMinutes).toEqual(['An', 'Cường', 'Bình']);
  });

  it('tham số sắp xếp/lọc không hợp lệ ⇒ 422', async () => {
    const w = await setupClass();
    for (const qs of ['?sort=password', '?order=sideways', '?filter=everything']) {
      const res = await api.get(`/classes/${w.classId}/dashboard${qs}`, {
        token: w.token,
        validateResponse: false,
      });
      expect(res.status).toBe(422);
    }
  });

  it('filter=behind | paused | not_started chỉ trả đúng nhóm; summary vẫn tính cả lớp', async () => {
    const w = await setupClass();
    const behind = await joinLearner(w, 'Chậm');
    const paused = await joinLearner(w, 'Nghỉ');
    const fresh = await joinLearner(w, 'Mới');
    await seedActivity(behind.userId, [{ day: '2026-01-10' }]);
    await seedActivity(paused.userId, [{ day: '2026-01-10' }]);
    await ctx.handle.pool.query(
      `INSERT INTO class_pause_periods (class_id, membership_id, started_on) VALUES ($1, $2, '2026-01-18')`,
      [w.classId, paused.membershipId],
    );

    const ids = (body: any) => body.learners.map((r: any) => r.userId).sort();
    const b = await dashboard(w, '?filter=behind');
    expect(ids(b)).toContain(behind.userId);
    expect(ids(b)).not.toContain(paused.userId);
    expect(b.summary.learnerCount).toBe(3);
    expect(ids(await dashboard(w, '?filter=paused'))).toEqual([paused.userId]);
    expect(ids(await dashboard(w, '?filter=not_started'))).toEqual([fresh.userId]);
  });
});

describe('cửa sổ số liệu: chỉ từ khi vào lớp (FR-030)', () => {
  it('hoạt động trước joined_at không lộ cho giáo viên', async () => {
    const w = await setupClass();
    const u = await joinLearner(w, 'Hoa vào lớp muộn', '2026-01-15T03:00:00Z');
    await seedActivity(u.userId, [
      { day: '2026-01-10', seconds: 1800, correct: 4, total: 4 }, // trước khi vào lớp
      { day: '2026-01-16', seconds: 600, correct: 1, total: 4 }, // sau khi vào lớp
    ]);
    const row = rowOf(await dashboard(w), u.userId);
    expect(row.minutesTotal).toBe(10);
    expect(row.reviewAccuracy).toBe(0.25);
    expect(row.lastActiveOn).toBe('2026-01-16');
    expect(row.streakDays).toBe(0);
  });

  it('vừa vào lớp, chỉ có lịch sử cũ ⇒ hasStarted=false, không số 0 gây hiểu nhầm', async () => {
    const w = await setupClass();
    const u = await joinLearner(w, 'Khoa lịch sử cũ', '2026-01-15T03:00:00Z');
    await seedActivity(u.userId, [{ day: '2026-01-12', seconds: 1800 }]);
    const row = rowOf(await dashboard(w), u.userId);
    expect(row).toMatchObject({ hasStarted: false, lastActiveOn: null, reviewAccuracy: null });
    expect(row.minutesTotal ?? 0).toBe(0);
  });
});

describe('loại tài khoản không hoạt động', () => {
  it('tài khoản disabled / pending_deletion không xuất hiện trong danh sách và tổng hợp', async () => {
    const w = await setupClass();
    const active = await joinLearner(w, 'Lan còn hoạt động');
    const disabled = await joinLearner(w, 'Mai bị khóa');
    const pending = await joinLearner(w, 'Nam chờ xóa');
    await ctx.handle.pool.query(`UPDATE users SET status = 'disabled' WHERE id = $1`, [
      disabled.userId,
    ]);
    await ctx.handle.pool.query(
      `UPDATE users SET status = 'pending_deletion', deletion_requested_at = now() WHERE id = $1`,
      [pending.userId],
    );
    const body = await dashboard(w);
    expect(body.learners.map((r: any) => r.userId)).toEqual([active.userId]);
    expect(body.summary.learnerCount).toBe(1);
  });
});

describe('khớp màn hình học viên (SC-006, research O11)', () => {
  it('học viên vừa vào lớp không có lịch sử: bảng điều khiển = GET /progress = GET /me/class', async () => {
    const w = await setupClass();
    const learner = await onboardedLearner(api, ctx);
    ctx.clock.set('2026-01-18T01:00:00Z');
    await enrollLearner(ctx, w.orgId, w.classId, learner.userId);
    // Học một mục kế hoạch sau khi vào lớp (qua API thật để có phiên, câu trả lời và khoảng thời gian).
    ctx.clock.set('2026-01-19T02:00:00Z');
    const login = await api.post('/auth/login', {
      body: { email: learner.user.email, password: learner.user.password },
    });
    learner.token = login.body.accessToken;
    const plan = await getToday(api, learner);
    await studyPlanItem(api, ctx, learner, plan.items[0].id);
    ctx.clock.set(NOW);
    const login2 = await api.post('/auth/login', {
      body: { email: learner.user.email, password: learner.user.password },
    });
    learner.token = login2.body.accessToken;

    const row = rowOf(await dashboard(w), learner.userId);
    const mine = (await api.get('/progress', { token: learner.token })).body;
    expect(row.hasStarted).toBe(true);
    expect(row.minutesTotal).toBe(mine.totalMinutes);
    expect(row.reviewAccuracy ?? null).toBe(mine.reviewAccuracy);
    expect(row.streakDays).toBe(mine.currentStreakDays);

    // Khối "tiến độ trong lớp" (T087) dùng cùng nguồn repository, cùng cửa sổ từ joinedAt.
    const myClass = (await api.get('/me/class', { token: learner.token })).body;
    expect(myClass.progress).toMatchObject({
      hasStarted: true,
      minutesTotal: row.minutesTotal,
      minutesLast7Days: row.minutesLast7Days,
      streakDays: row.streakDays,
    });
    expect(myClass.progress.reviewAccuracy ?? null).toBe(row.reviewAccuracy ?? null);
    expect(myClass.progress.completionRatio ?? null).toBe(row.completionRatio ?? null);
    expect(myClass.progress.lastActiveOn ?? null).toBe(row.lastActiveOn ?? null);
  });
});

describe('hiệu năng và số truy vấn bounded (SC-006)', () => {
  /** Đếm mọi truy vấn gửi tới PostgreSQL trong lúc chạy `fn`. */
  async function countQueries<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
    const spy = vi.spyOn(pg.Client.prototype, 'query');
    try {
      const result = await fn();
      return { result, queries: spy.mock.calls.length };
    } finally {
      spy.mockRestore();
    }
  }

  async function bulkClass(
    learners: number,
    days: number,
    joinedAt = '2026-01-06T03:00:00Z',
  ): Promise<World> {
    const w = await setupClass(
      learners + 5,
      joinedAt.slice(0, 4) < '2026' ? '2025-01-01' : undefined,
    );
    for (let i = 0; i < learners; i++) {
      const u = await joinLearner(w, `Học viên ${String(i).padStart(3, '0')}`, joinedAt);
      const acts: Activity[] = [];
      for (let d = 0; d < days; d++) {
        const date = new Date(Date.UTC(2026, 0, 19 - d));
        acts.push({ day: date.toISOString().slice(0, 10), seconds: 300 + ((i + d) % 5) * 60 });
      }
      await seedActivity(u.userId, acts);
      await completeUnits(u.userId, w.requiredUnitIds.slice(0, i % w.requiredUnitIds.length));
    }
    return w;
  }

  it('50 học viên × 30 ngày: ≤ 3 giây và số truy vấn không tăng theo số học viên', async () => {
    const small = await bulkClass(5, 30);
    await dashboard(small); // làm nóng bộ nhớ đệm nội dung/kết nối
    const baseline = await countQueries(() => dashboard(small));

    const large = await bulkClass(50, 30);
    const started = performance.now();
    const measured = await countQueries(() => dashboard(large));
    const elapsedMs = performance.now() - started;

    expect(measured.result.learners).toHaveLength(50);
    expect(elapsedMs).toBeLessThanOrEqual(3000);
    // Không N+1: 10 lần số học viên nhưng số truy vấn gần như không đổi.
    expect(measured.queries).toBeLessThanOrEqual(baseline.queries + 2);
    expect(measured.queries).toBeLessThanOrEqual(40);
  }, 120_000);

  // T131 (plan "Rủi ro"): kịch bản cận trên — 100 học viên đã vào lớp từ ~4 tháng trước, mỗi người học 120 ngày liên
  // tiếp (≈ 48.000 bản ghi trả lời + 12.000 khoảng thời gian). Nếu vượt 3 giây phải thêm chỉ mục
  // `study_records(user_id, occurred_at)` (migration 0005); kết quả đo được ghi ở research O11.
  it('100 học viên × 120 ngày (cận trên): bảng điều khiển ≤ 3 giây', async () => {
    const large = await bulkClass(100, 120, '2025-09-15T03:00:00Z');
    await dashboard(large); // làm nóng bộ nhớ đệm nội dung/kết nối (không tính giờ)
    const timings: number[] = [];
    let measured: Awaited<ReturnType<typeof dashboard>> | undefined;
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      measured = await dashboard(large);
      timings.push(performance.now() - started);
    }
    const best = Math.min(...timings);
    const worst = Math.max(...timings);
    console.info(
      `[T131] dashboard 100 học viên × 120 ngày: tốt nhất ${best.toFixed(0)} ms, tệ nhất ${worst.toFixed(0)} ms`,
    );
    expect(measured!.learners).toHaveLength(100);
    expect(worst).toBeLessThanOrEqual(3000);
  }, 600_000);
});
