/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSendEmailJob } from '../../src/jobs/send-email.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US1 (T038) trên PostgreSQL thật: đăng ký → onboarding → lộ trình + kế hoạch hôm nay;
// đặt lại mật khẩu; làm lại placement (US1.6, FR-009).

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

const query = async <T = Record<string, unknown>>(sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];

async function userIdOf(email: string): Promise<string> {
  return (await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]))[0]!.id;
}

async function correctAnswers(wrong = false) {
  const rows = await query<{ id: string; correct_choice: number }>(
    'SELECT id, correct_choice FROM placement_questions WHERE is_active ORDER BY position',
  );
  return rows.map((r) => ({
    questionId: r.id,
    choice: wrong ? (r.correct_choice + 1) % 4 : r.correct_choice,
  }));
}

describe('đăng ký → onboarding bỏ qua placement → lộ trình và /today', () => {
  it('sinh lộ trình reason=onboarding từ hồ sơ khai báo, kế hoạch hôm nay ≤ quỹ thời gian', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ timezone: 'Asia/Ho_Chi_Minh' }),
    });
    expect(status).toBe(200);

    const userId = await userIdOf(user.email);
    const paths = await query<{ reason: string; status: string; generated_from: any }>(
      'SELECT reason, status, generated_from FROM learning_paths WHERE user_id = $1',
      [userId],
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatchObject({ reason: 'onboarding', status: 'active' });
    expect(paths[0]!.generated_from).toMatchObject({
      start_level: 'N5',
      foundation_first: true,
      placement_result_id: null,
      scope_notice: null,
    });

    // Người mới: mục đầu của kế hoạch là đơn vị nền tảng; tổng ≤ 10 phút.
    expect(body.today.localDate).toBe('2026-01-05');
    expect(body.today.estimatedMinutes).toBeLessThanOrEqual(10);
    const planned = await query<{ tier: string; est_minutes: number }>(
      `SELECT u.tier::text AS tier, i.est_minutes
         FROM daily_plan_items i
         JOIN daily_plans p ON p.id = i.plan_id
         JOIN learning_units u ON u.id = i.unit_id
        WHERE p.user_id = $1 ORDER BY i.position`,
      [userId],
    );
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((r) => r.tier === 'foundation')).toBe(true);
  });

  it('gọi lại /onboarding/complete là idempotent: không sinh thêm lộ trình', async () => {
    const user = await registerUser(api);
    const first = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding(),
    });
    const second = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ dailyMinutes: 30 }),
    });
    expect(second.body.path.id).toBe(first.body.path.id);
    expect(second.body.today.id).toBe(first.body.today.id);
    const userId = await userIdOf(user.email);
    expect((await query('SELECT 1 FROM learning_paths WHERE user_id = $1', [userId])).length).toBe(
      1,
    );
  });

  it('dùng kết quả placement khi người học chọn rõ → generated_from.placement_result_id', async () => {
    const user = await registerUser(api);
    const placement = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await correctAnswers() },
    });
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ placementResultId: placement.body.id }),
    });
    expect(done.body.path.startLevel).toBe('N3');
    const [path] = await query<{ generated_from: any }>(
      'SELECT generated_from FROM learning_paths WHERE id = $1',
      [done.body.path.id],
    );
    expect(path!.generated_from.placement_result_id).toBe(placement.body.id);
  });

  it('placement đoán mò → lộ trình an toàn cho người mới (N5, nền tảng trước)', async () => {
    const user = await registerUser(api);
    const answers = (await correctAnswers(true)).map((a) => ({
      ...a,
      choice: null as number | null,
    }));
    const placement = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers },
    });
    expect(placement.body.guessSuspected).toBe(true);
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ currentLevel: 'N4', placementResultId: placement.body.id }),
    });
    expect(done.body.path.startLevel).toBe('N5');
  });

  it('đã làm placement nhưng không chọn dùng → lộ trình sinh từ hồ sơ khai báo', async () => {
    const user = await registerUser(api);
    await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await correctAnswers() },
    });
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding(), // không gửi placementResultId
    });
    expect(done.body.path.startLevel).toBe('N5');
    const userId = await userIdOf(user.email);
    const [path] = await query<{ generated_from: any }>(
      'SELECT generated_from FROM learning_paths WHERE user_id = $1',
      [userId],
    );
    expect(path!.generated_from.placement_result_id).toBeNull();
  });

  it('placementResultId của người khác bị từ chối (không lộ dữ liệu người học khác)', async () => {
    const owner = await registerUser(api);
    const other = await registerUser(api);
    const placement = await api.post('/placement/submit', {
      token: owner.accessToken,
      body: { answers: await correctAnswers() },
    });
    const { status, body } = await api.post('/onboarding/complete', {
      token: other.accessToken,
      body: newcomerOnboarding({ placementResultId: placement.body.id }),
    });
    expect(status).toBe(422);
    expect(body.fields.placementResultId).toBeTruthy();
  });

  it('mốc thời gian trong quá khứ bị từ chối theo ngày địa phương của người học', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ targetDate: '2026-01-04' }),
    });
    expect(status).toBe(422);
    expect(body.fields.targetDate).toBeTruthy();
  });
});

describe('kế hoạch hằng ngày', () => {
  it('sinh một lần mỗi ngày địa phương, kể cả khi nhiều yêu cầu đồng thời', async () => {
    const user = await registerUser(api);
    await api.post('/onboarding/complete', { token: user.accessToken, body: newcomerOnboarding() });
    const userId = await userIdOf(user.email);

    ctx.clock.advanceDays(1);
    // Access token cấp lúc 08:00 đã hết hạn (15 phút): đăng nhập lại.
    const login = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    const token = login.body.accessToken as string;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api.get('/today', { token })),
    );
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(results.every((r) => r.body.localDate === '2026-01-06')).toBe(true);
    expect((await query('SELECT 1 FROM daily_plans WHERE user_id = $1', [userId])).length).toBe(2);
    ctx.clock.advanceDays(-1);
  });

  it('khi lộ trình tạm dừng: GET /today trả 409 PATH_PAUSED và không sinh kế hoạch', async () => {
    const user = await registerUser(api);
    await api.post('/onboarding/complete', { token: user.accessToken, body: newcomerOnboarding() });
    const userId = await userIdOf(user.email);
    await query('UPDATE learning_profiles SET paused = true WHERE user_id = $1', [userId]);
    ctx.clock.advanceDays(1);
    const login = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    const { status, body } = await api.get('/today', { token: login.body.accessToken });
    ctx.clock.advanceDays(-1);
    expect(status).toBe(409);
    expect(body.code).toBe('PATH_PAUSED');
    expect((await query('SELECT 1 FROM daily_plans WHERE user_id = $1', [userId])).length).toBe(1);
  });

  it('đơn vị mới kích hoạt xuất hiện trong lộ trình sau khi bộ đệm hết TTL (≤ 60 giây)', async () => {
    const user = await registerUser(api);
    await api.post('/onboarding/complete', { token: user.accessToken, body: newcomerOnboarding() });
    ctx.app.deps.contentCache.invalidate();
    const before = await api.get('/path', { token: user.accessToken });

    const [topic] = await query<{ id: string }>(
      "SELECT id FROM topics WHERE skill = 'vocabulary' AND level = 'N5' LIMIT 1",
    );
    await query(
      `INSERT INTO learning_units (kind, title, level, topic_id, difficulty, est_minutes, status)
       VALUES ('vocabulary', '{"vi":"Đơn vị mới","en":"New unit"}', 'N5', $1, 2, 5, 'active')`,
      [topic!.id],
    );

    const cached = await api.get('/path', { token: user.accessToken });
    expect(cached.body.totalUnits).toBe(before.body.totalUnits);

    ctx.clock.advanceMs(61_000);
    const login = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    const fresh = await api.get('/path', { token: login.body.accessToken });
    ctx.clock.advanceMs(-61_000);
    expect(fresh.body.totalUnits).toBe(before.body.totalUnits + 1);
    await query("DELETE FROM learning_units WHERE title->>'en' = 'New unit'");
    ctx.app.deps.contentCache.invalidate();
  });
});

describe('đặt lại mật khẩu (FR-001)', () => {
  const sendEmailJob = () =>
    createSendEmailJob({ config: ctx.config, emailSender: ctx.emailSender });

  async function requestResetLink(email: string): Promise<string> {
    ctx.emailSender.clear();
    await api.post('/auth/password-reset/request', { body: { email } });
    await ctx.jobQueue.drain([sendEmailJob()]);
    const mail = ctx.emailSender.lastTo(email);
    expect(mail, 'phải có email đặt lại').toBeDefined();
    const token = /token=([^\s]+)/.exec(mail!.text)?.[1];
    expect(token).toBeTruthy();
    return decodeURIComponent(token!);
  }

  it('liên kết dùng một lần: đổi được mật khẩu, thu hồi mọi phiên, dùng lại bị từ chối', async () => {
    const user = await registerUser(api);
    const token = await requestResetLink(user.email);

    const ok = await api.post('/auth/password-reset/confirm', {
      body: { token, newPassword: 'Mat-Khau-Moi-789' },
    });
    expect(ok.status).toBe(204);

    const oldLogin = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api.post('/auth/login', {
      body: { email: user.email, password: 'Mat-Khau-Moi-789' },
    });
    expect(newLogin.status).toBe(200);

    // Mọi phiên cũ bị thu hồi: refresh token cấp lúc đăng ký không còn dùng được.
    const stale = await api.post('/auth/refresh', { body: { refreshToken: user.refreshToken } });
    expect(stale.status).toBe(401);

    const reuse = await api.post('/auth/password-reset/confirm', {
      body: { token, newPassword: 'Mat-Khau-Khac-456' },
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('liên kết hết hạn sau 1 giờ bị từ chối', async () => {
    const user = await registerUser(api);
    const token = await requestResetLink(user.email);
    ctx.clock.advanceMinutes(61);
    const { status, body } = await api.post('/auth/password-reset/confirm', {
      body: { token, newPassword: 'Mat-Khau-Moi-789' },
    });
    ctx.clock.advanceMinutes(-61);
    expect(status).toBe(400);
    expect(body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('chỉ lưu băm của token, không lưu token thô', async () => {
    const user = await registerUser(api);
    const token = await requestResetLink(user.email);
    const rows = await query<{ token_hash: string }>(
      'SELECT token_hash FROM password_reset_tokens',
    );
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  it('email không tồn tại: vẫn 202 và không gửi thư', async () => {
    ctx.emailSender.clear();
    const { status } = await api.post('/auth/password-reset/request', {
      body: { email: 'khong-ton-tai@example.com' },
    });
    await ctx.jobQueue.drain([sendEmailJob()]);
    expect(status).toBe(202);
    expect(ctx.emailSender.sent).toHaveLength(0);
  });

  it('mật khẩu mới yếu bị từ chối và token vẫn dùng được cho mật khẩu hợp lệ', async () => {
    const user = await registerUser(api);
    const token = await requestResetLink(user.email);
    const weak = await api.post('/auth/password-reset/confirm', {
      body: { token, newPassword: 'aaaaaaaa' },
      validateResponse: false,
    });
    expect(weak.status).toBe(422);
    const ok = await api.post('/auth/password-reset/confirm', {
      body: { token, newPassword: 'Mat-Khau-Moi-789' },
    });
    expect(ok.status).toBe(204);
  });
});

describe('làm lại placement (US1.6, FR-009)', () => {
  /** Chèn lịch sử học để chứng minh việc làm lại placement/xây dựng lại không đụng tới nó. */
  async function seedLearningHistory(userId: string): Promise<void> {
    // Một bài tập có gắn mục nội dung, cùng đơn vị và mảng của nó.
    const [exercise] = await query<{
      id: string;
      item_id: string;
      unit_id: string;
      topic_id: string;
    }>(
      `SELECT e.id, e.item_id, e.unit_id, u.topic_id
         FROM exercises e JOIN learning_units u ON u.id = e.unit_id
        WHERE e.item_id IS NOT NULL ORDER BY u.sequence, e.position LIMIT 1`,
    );
    const unit = { id: exercise!.unit_id, topic_id: exercise!.topic_id };
    await query(
      "INSERT INTO unit_progress (user_id, unit_id, status) VALUES ($1, $2, 'completed')",
      [userId, unit!.id],
    );
    const [session] = await query<{ id: string }>(
      `INSERT INTO lesson_sessions (user_id, kind, unit_id, snapshot, status)
       VALUES ($1, 'new_unit', $2, '{}', 'completed') RETURNING id`,
      [userId, unit!.id],
    );
    await query(
      `INSERT INTO study_records (user_id, client_event_id, session_id, exercise_id, item_id, topic_id,
                                  is_correct, submitted_answer, context, local_date)
       VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, true, '0', 'lesson', '2026-01-05')`,
      [userId, session!.id, exercise!.id, exercise!.item_id, unit!.topic_id],
    );
    await query(
      `INSERT INTO review_schedules (user_id, item_id, interval_days, ease, repetitions, lapses, due_date)
       VALUES ($1, $2, 1, 2.30, 1, 0, '2026-01-06')`,
      [userId, exercise!.item_id],
    );
    await query(
      `INSERT INTO topic_stats (user_id, topic_id, recent_results, accuracy)
       VALUES ($1, $2, ARRAY[1,0,1]::smallint[], 0.667)`,
      [userId, unit!.topic_id],
    );
  }

  const HISTORY_TABLES = ['unit_progress', 'study_records', 'review_schedules', 'topic_stats'];
  async function snapshotHistory(userId: string): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    for (const table of HISTORY_TABLES) {
      out[table] = await query(`SELECT * FROM ${table} WHERE user_id = $1 ORDER BY 1, 2`, [userId]);
    }
    return out;
  }

  async function onboardedUser() {
    const user = await registerUser(api);
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding(),
    });
    const userId = await userIdOf(user.email);
    await seedLearningHistory(userId);
    return { user, userId, firstPathId: done.body.path.id as string };
  }

  it('kết quả mới là is_current, kết quả cũ giữ làm lịch sử, lộ trình chưa đổi', async () => {
    const { user, userId, firstPathId } = await onboardedUser();
    const before = await snapshotHistory(userId);

    const first = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await correctAnswers(true) },
    });
    const second = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await correctAnswers() },
    });
    expect(second.body.id).not.toBe(first.body.id);

    const results = await query<{ id: string; is_current: boolean }>(
      'SELECT id, is_current FROM placement_results WHERE user_id = $1',
      [userId],
    );
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.is_current)!.id).toBe(second.body.id);

    // Chưa chọn xây dựng lại → lộ trình vẫn là bản onboarding.
    const path = await api.get('/path', { token: user.accessToken });
    expect(path.body.id).toBe(firstPathId);
    expect(path.body.reason).toBe('onboarding');
    expect(await snapshotHistory(userId)).toEqual(before);
  });

  it('chọn xây dựng lại → lộ trình mới reason=placement_retake, bản cũ superseded, lịch sử nguyên vẹn', async () => {
    const { user, userId, firstPathId } = await onboardedUser();
    const before = await snapshotHistory(userId);
    const placement = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: await correctAnswers() },
    });

    const rebuilt = await api.post('/path/rebuild', {
      token: user.accessToken,
      body: { usePlacementResultId: placement.body.id },
    });
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.reason).toBe('placement_retake');
    expect(rebuilt.body.id).not.toBe(firstPathId);

    const paths = await query<{ id: string; status: string; reason: string }>(
      'SELECT id, status, reason FROM learning_paths WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
    expect(paths).toEqual([
      { id: firstPathId, status: 'superseded', reason: 'onboarding' },
      { id: rebuilt.body.id, status: 'active', reason: 'placement_retake' },
    ]);
    expect(await snapshotHistory(userId)).toEqual(before);
  });

  it('xây dựng lại không tham số → reason=rebuild_request, vẫn giữ lịch sử', async () => {
    const { user, userId } = await onboardedUser();
    const before = await snapshotHistory(userId);
    const rebuilt = await api.post('/path/rebuild', { token: user.accessToken, body: {} });
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.reason).toBe('rebuild_request');
    expect(await snapshotHistory(userId)).toEqual(before);
  });

  it('usePlacementResultId không phải của người học bị từ chối', async () => {
    const owner = await registerUser(api);
    const { user } = await onboardedUser();
    const placement = await api.post('/placement/submit', {
      token: owner.accessToken,
      body: { answers: await correctAnswers() },
    });
    const { status } = await api.post('/path/rebuild', {
      token: user.accessToken,
      body: { usePlacementResultId: placement.body.id },
      validateResponse: false,
    });
    expect(status).toBe(404);
  });
});
