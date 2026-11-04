/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  incrementMetric,
  readMetric,
  TRIAL_METRICS,
} from '../../src/db/repositories/aggregate-stats.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US8 (T096) trên PostgreSQL thật: endpoint dùng thử không ghi bản ghi định danh nào
// (chỉ bộ đếm ẩn danh), bị rate-limit khi vượt ngưỡng, không ghi IP vào CSDL (FR-038, FR-040) và kết quả
// placement dùng thử được mang sang onboarding bằng cách chấm lại trên server (FR-039).

const GUEST_IP = '203.0.113.77';

let ctx: TestApp;
let api: ContractClient;

const query = async <T = Record<string, unknown>>(sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];

async function placementAnswers(mode: 'correct' | 'wrong' | 'blank' = 'correct') {
  const rows = await query<{ id: string; correct_choice: number }>(
    'SELECT id, correct_choice FROM placement_questions WHERE is_active ORDER BY position',
  );
  return rows.map((r) => ({
    questionId: r.id,
    choice:
      mode === 'blank' ? null : mode === 'correct' ? r.correct_choice : (r.correct_choice + 1) % 4,
  }));
}

/** Gọi API như một khách từ IP cố định (không token) và trả mã trạng thái + thân. */
async function guest(method: 'GET' | 'POST', url: string, body?: unknown) {
  const res = await ctx.app.inject({
    method,
    url: `/api/v1${url}`,
    remoteAddress: GUEST_IP,
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

/** Số dòng của mọi bảng, trừ `aggregate_daily_stats` (bộ đếm ẩn danh duy nhất được phép thay đổi). */
async function identifyingRowCounts(): Promise<Record<string, number>> {
  const tables = await query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables) {
    if (tablename === 'aggregate_daily_stats') continue;
    const [row] = await query<{ n: string }>(`SELECT count(*) AS n FROM "${tablename}"`);
    counts[tablename] = Number(row!.n);
  }
  return counts;
}

async function allMetrics(): Promise<Record<string, number>> {
  const rows = await query<{ metric: string; value: string }>(
    'SELECT metric, sum(value) AS value FROM aggregate_daily_stats GROUP BY metric',
  );
  return Object.fromEntries(rows.map((r) => [r.metric, Number(r.value)]));
}

describe('endpoint dùng thử không ghi dữ liệu định danh (FR-038)', () => {
  beforeAll(async () => {
    ctx = await createTestApp();
    await seedContent(ctx.handle.db);
    api = new ContractClient(ctx.app);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('chỉ tăng bộ đếm ẩn danh; mọi bảng khác giữ nguyên số dòng', async () => {
    const before = await identifyingRowCounts();

    expect((await guest('GET', '/trial/content')).status).toBe(200);
    expect((await guest('GET', '/placement/questions')).status).toBe(200);
    const graded = await guest('POST', '/trial/placement/grade', {
      answers: await placementAnswers('correct'),
    });
    expect(graded.status).toBe(200);
    expect(graded.body.id).toBeNull();
    expect((await guest('POST', '/trial/events', { event: 'lesson_completed' })).status).toBe(204);

    expect(await identifyingRowCounts()).toEqual(before);
    expect(await allMetrics()).toEqual({
      trial_content_loaded: 1,
      trial_placement_completed: 1,
      trial_placement_level_N3: 1,
      trial_lesson_completed: 1,
    });
  });

  it('bộ đếm cộng dồn nguyên tử khi nhiều yêu cầu đồng thời', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        guest('POST', '/trial/events', { event: 'lesson_completed' }),
      ),
    );
    await guest('POST', '/trial/placement/grade', { answers: await placementAnswers('blank') });
    const metrics = await allMetrics();
    expect(metrics.trial_lesson_completed).toBe(6);
    expect(metrics.trial_placement_completed).toBe(2);
    expect(metrics.trial_placement_level_none).toBe(1);
    const day = ctx.clock.now().toISOString().slice(0, 10);
    expect(await readMetric(ctx.handle.db, day, 'trial_lesson_completed')).toBe(6);
  });

  it('chấm placement lỗi (422) không tăng bộ đếm', async () => {
    const before = await allMetrics();
    const bad = await guest('POST', '/trial/placement/grade', {
      answers: [{ questionId: '00000000-0000-4000-8000-000000000000', choice: 0 }],
    });
    expect(bad.status).toBe(422);
    expect(await allMetrics()).toEqual(before);
  });

  it('chỉ chấp nhận metric trong danh sách cố định', async () => {
    await expect(incrementMetric(ctx.handle.db, '2026-01-05', 'metric_la')).rejects.toThrow();
    await expect(
      incrementMetric(ctx.handle.db, '2026-01-05', 'trial_placement_level_N1'),
    ).rejects.toThrow();
    const names = new Set<string>(TRIAL_METRICS);
    for (const metric of Object.keys(await allMetrics())) expect(names.has(metric)).toBe(true);
  });

  it('POST /trial/events không nhận dữ liệu nào khác ngoài tên sự kiện', async () => {
    const before = { counts: await identifyingRowCounts(), metrics: await allMetrics() };
    for (const body of [
      { event: 'lesson_completed', email: 'a@b.c' },
      { event: 'lesson_completed', userId: 'x' },
      { event: 'placement_completed' },
      { event: 42 },
      {},
    ]) {
      expect((await guest('POST', '/trial/events', body)).status).toBe(422);
    }
    expect({ counts: await identifyingRowCounts(), metrics: await allMetrics() }).toEqual(before);
  });

  it('không ghi IP của khách vào bất kỳ bảng nào', async () => {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    for (const { tablename } of tables) {
      const [row] = await query<{ n: string }>(
        `SELECT count(*) AS n FROM "${tablename}" t WHERE t::text LIKE $1`,
        [`%${GUEST_IP}%`],
      );
      expect(Number(row!.n), `bảng ${tablename} chứa IP khách`).toBe(0);
    }
    expect(api).toBeDefined();
  });
});

describe('giới hạn tần suất (FR-040)', () => {
  beforeAll(async () => {
    ctx = await createTestApp(
      {},
      { RATE_LIMIT_TRIAL_PER_MIN: '3', RATE_LIMIT_TRIAL_GRADE_PER_MIN: '2' },
    );
    await seedContent(ctx.handle.db);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('nhóm /trial/* và /placement/questions dùng chung ngưỡng, vượt ngưỡng trả 429', async () => {
    expect((await guest('GET', '/trial/content')).status).toBe(200);
    expect((await guest('GET', '/placement/questions')).status).toBe(200);
    expect((await guest('POST', '/trial/events', { event: 'lesson_completed' })).status).toBe(204);

    const limited = await guest('GET', '/trial/content');
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('TOO_MANY_REQUESTS');
    expect((await guest('POST', '/trial/events', { event: 'lesson_completed' })).status).toBe(429);

    // Bộ đếm theo IP: khách từ IP khác không bị ảnh hưởng.
    const other = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/trial/content',
      remoteAddress: '198.51.100.5',
    });
    expect(other.statusCode).toBe(200);
  });

  it('POST /trial/placement/grade có ngưỡng riêng (thấp hơn)', async () => {
    const body = { answers: await placementAnswers('correct') };
    expect((await guest('POST', '/trial/placement/grade', body)).status).toBe(200);
    expect((await guest('POST', '/trial/placement/grade', body)).status).toBe(200);
    expect((await guest('POST', '/trial/placement/grade', body)).status).toBe(429);
  });

  it('yêu cầu bị chặn (429) không tăng bộ đếm', async () => {
    const [row] = await query<{ n: string }>(
      `SELECT coalesce(sum(value), 0) AS n FROM aggregate_daily_stats WHERE metric = 'trial_content_loaded'`,
    );
    // 1 lần của IP khách + 1 lần của IP khác; lần thứ 4 của IP khách bị chặn trước khi vào xử lý.
    expect(Number(row!.n)).toBe(2);
  });
});

describe('mang kết quả placement dùng thử sang onboarding (FR-039)', () => {
  beforeAll(async () => {
    ctx = await createTestApp();
    await seedContent(ctx.handle.db);
    api = new ContractClient(ctx.app);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('đăng ký fromTrial=true rồi gửi câu trả lời dùng thử → server chấm lại, lưu is_current, onboarding dùng kết quả đó', async () => {
    const answers = await placementAnswers('correct');
    const trial = await api.post('/trial/placement/grade', { body: { answers } });
    expect(trial.body.id).toBeNull();

    const user = await registerUser(api, { fromTrial: true });
    const [userRow] = await query<{ id: string; from_trial: boolean }>(
      'SELECT id, from_trial FROM users WHERE email = $1',
      [user.email],
    );
    expect(userRow!.from_trial).toBe(true);

    // Client gửi câu trả lời (không phải kết quả); server tự chấm lại.
    const submitted = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers },
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.id).toEqual(expect.any(String));
    expect(submitted.body.estimatedLevel).toBe(trial.body.estimatedLevel);

    const stored = await query<{ id: string; is_current: boolean }>(
      'SELECT id, is_current FROM placement_results WHERE user_id = $1',
      [userRow!.id],
    );
    expect(stored).toEqual([{ id: submitted.body.id, is_current: true }]);

    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ placementResultId: submitted.body.id }),
    });
    expect(done.status).toBe(200);
    const [path] = await query<{ generated_from: any }>(
      'SELECT generated_from FROM learning_paths WHERE id = $1',
      [done.body.path.id],
    );
    expect(path!.generated_from.placement_result_id).toBe(submitted.body.id);
  });

  it('server không tin kết quả từ client: chấm lại theo câu trả lời gửi lên', async () => {
    const user = await registerUser(api, { fromTrial: true });
    const submitted = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await placementAnswers('wrong') },
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.score).toBe(0);
    expect(submitted.body.estimatedLevel).toBe('none');
  });

  it('bỏ kết quả rồi làm lại → kết quả mới thay thế (is_current), kết quả cũ giữ làm lịch sử', async () => {
    const user = await registerUser(api, { fromTrial: true });
    const first = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await placementAnswers('wrong') },
    });
    const retake = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await placementAnswers('correct') },
    });
    expect(retake.body.id).not.toBe(first.body.id);
    expect(retake.body.estimatedLevel).toBe('N3');

    const rows = await query<{ id: string; is_current: boolean }>(
      `SELECT r.id, r.is_current FROM placement_results r
         JOIN users u ON u.id = r.user_id WHERE u.email = $1`,
      [user.email],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.is_current)!.id).toBe(retake.body.id);
    expect(rows.find((r) => r.id === first.body.id)!.is_current).toBe(false);

    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ placementResultId: retake.body.id }),
    });
    expect(done.status).toBe(200);
    const [path] = await query<{ generated_from: any }>(
      'SELECT generated_from FROM learning_paths WHERE id = $1',
      [done.body.path.id],
    );
    expect(path!.generated_from.placement_result_id).toBe(retake.body.id);
  });
});
