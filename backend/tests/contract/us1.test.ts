import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { learningPaths, placementQuestions, users } from '../../src/db/schema.js';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient, newcomerOnboarding, registerUser } from './client.js';

// Kiểm thử hợp đồng US1 (T037): mọi request/response đối chiếu `contracts/openapi.yaml`.
// Phạm vi: /auth/*, GET/PATCH /me, /onboarding, /onboarding/complete, /placement/*, /path, /path/rebuild, /today.

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

/** Đáp án đúng của bộ placement đang kích hoạt, theo id câu hỏi. */
async function correctChoices(): Promise<Map<string, number>> {
  const rows = await ctx.handle.db
    .select({ id: placementQuestions.id, correct: placementQuestions.correctChoice })
    .from(placementQuestions)
    .where(eq(placementQuestions.isActive, true));
  return new Map(rows.map((r) => [r.id, r.correct]));
}

describe('/auth/*', () => {
  it('register 201 trả token; fromTrial=true được lưu vào users.from_trial', async () => {
    const user = await registerUser(api, { fromTrial: true });
    expect(user.accessToken).toBeTruthy();
    const [row] = await ctx.handle.db.select().from(users).where(eq(users.email, user.email));
    expect(row!.fromTrial).toBe(true);
  });

  it('register mặc định fromTrial=false', async () => {
    const user = await registerUser(api);
    const [row] = await ctx.handle.db.select().from(users).where(eq(users.email, user.email));
    expect(row!.fromTrial).toBe(false);
  });

  it('register 409 EMAIL_TAKEN với email trùng (không phân biệt hoa thường)', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.post('/auth/register', {
      body: { email: user.email.toUpperCase(), password: 'Matkhau-Khac-456', displayName: 'Trùng' },
    });
    expect(status).toBe(409);
    expect(body.code).toBe('EMAIL_TAKEN');
  });

  it('register 422 với email sai định dạng và mật khẩu yếu, có thông báo theo trường', async () => {
    const { status, body } = await api.post('/auth/register', {
      body: { email: 'khong-phai-email', password: '12345678', displayName: 'A' },
      validateRequest: false,
    });
    expect(status).toBe(422);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields.email).toMatch(/định dạng/);
    expect(body.fields.password).toMatch(/yếu/);
  });

  it('login 200 kèm accountStatus; sai mật khẩu 401', async () => {
    const user = await registerUser(api);
    const ok = await api.post('/auth/login', {
      body: { email: user.email, password: user.password },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accountStatus).toBe('active');
    const bad = await api.post('/auth/login', {
      body: { email: user.email, password: 'sai-mat-khau' },
    });
    expect(bad.status).toBe(401);
    const unknown = await api.post('/auth/login', {
      body: { email: 'khong-ton-tai@example.com', password: 'bat-ky-123' },
    });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(bad.body.message); // không lộ email có tồn tại hay không
  });

  it('refresh xoay vòng: token mới dùng được, token cũ bị từ chối', async () => {
    const user = await registerUser(api);
    const first = await api.post('/auth/refresh', { body: { refreshToken: user.refreshToken } });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);
    const reuse = await api.post('/auth/refresh', { body: { refreshToken: user.refreshToken } });
    expect(reuse.status).toBe(401);
    const second = await api.post('/auth/refresh', {
      body: { refreshToken: first.body.refreshToken },
    });
    expect(second.status).toBe(200);
  });

  it('logout 204 thu hồi phiên: refresh token không dùng được nữa', async () => {
    const user = await registerUser(api);
    const out = await api.post('/auth/logout', { token: user.accessToken });
    expect(out.status).toBe(204);
    const after = await api.post('/auth/refresh', { body: { refreshToken: user.refreshToken } });
    expect(after.status).toBe(401);
  });

  it('password-reset/request luôn 202 dù email có tồn tại hay không', async () => {
    const user = await registerUser(api);
    const known = await api.post('/auth/password-reset/request', { body: { email: user.email } });
    const unknown = await api.post('/auth/password-reset/request', {
      body: { email: 'khong-co@example.com' },
    });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
  });

  it('password-reset/confirm 400 RESET_TOKEN_INVALID với token sai', async () => {
    const { status, body } = await api.post('/auth/password-reset/confirm', {
      body: { token: 'token-khong-hop-le', newPassword: 'Matkhau-Moi-789' },
    });
    expect(status).toBe(400);
    expect(body.code).toBe('RESET_TOKEN_INVALID');
  });
});

describe('GET/PATCH /me', () => {
  it('GET /me 200 trả tài khoản + hồ sơ mặc định trước onboarding', async () => {
    const user = await registerUser(api, { language: 'en', timezone: 'Asia/Tokyo' });
    const { status, body } = await api.get('/me', { token: user.accessToken });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      email: user.email,
      role: 'learner',
      status: 'active',
      profile: {
        language: 'en',
        timezone: 'Asia/Tokyo',
        paused: false,
        onboardingState: 'not_started',
      },
    });
  });

  it('GET /me 401 khi thiếu token', async () => {
    const { status } = await api.get('/me');
    expect(status).toBe(401);
  });

  it('PATCH /me lưu tên hiển thị, ngôn ngữ, múi giờ, thời gian mỗi ngày', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.patch('/me', {
      token: user.accessToken,
      body: { displayName: 'Tên mới', language: 'en', timezone: 'Asia/Tokyo', dailyMinutes: 15 },
    });
    expect(status).toBe(200);
    expect(body.profile).toMatchObject({
      displayName: 'Tên mới',
      language: 'en',
      timezone: 'Asia/Tokyo',
      dailyMinutes: 15,
    });
  });

  it('PATCH /me 422 với giá trị sai và với trường lộ trình khi chưa hoàn tất onboarding', async () => {
    const user = await registerUser(api);
    const badMinutes = await api.patch('/me', {
      token: user.accessToken,
      body: { dailyMinutes: 7 },
      validateRequest: false,
    });
    expect(badMinutes.status).toBe(422);
    expect(badMinutes.body.fields.dailyMinutes).toBeTruthy();
    const deferred = await api.patch('/me', {
      token: user.accessToken,
      body: { goalType: 'work' },
    });
    expect(deferred.status).toBe(422);
    expect(deferred.body.fields.goalType).toBeTruthy();
  });
});

describe('onboarding', () => {
  it('GET /onboarding 200 not_started; PUT lưu nháp rồi GET trả lại đúng nháp', async () => {
    const user = await registerUser(api);
    const initial = await api.get('/onboarding', { token: user.accessToken });
    expect(initial.status).toBe(200);
    expect(initial.body.state).toBe('not_started');

    const saved = await api.put('/onboarding', {
      token: user.accessToken,
      body: { currentLevel: 'N5', dailyMinutes: 15 },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.state).toBe('in_progress');
    expect(saved.body.draft).toEqual({ currentLevel: 'N5', dailyMinutes: 15 });

    const again = await api.get('/onboarding', { token: user.accessToken });
    expect(again.body.draft).toEqual({ currentLevel: 'N5', dailyMinutes: 15 });
  });

  it('PUT /onboarding 422 với kỹ năng chưa hỗ trợ (nghe/đọc/Kanji)', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.put('/onboarding', {
      token: user.accessToken,
      body: { skills: ['listening'] },
      validateRequest: false,
    });
    expect(status).toBe(422);
    expect(Object.keys(body.fields).some((k) => k.startsWith('skills'))).toBe(true);
  });

  it('POST /onboarding/complete 200 trả lộ trình + kế hoạch hôm nay', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding(),
    });
    expect(status).toBe(200);
    expect(body.path).toMatchObject({ reason: 'onboarding', startLevel: 'N5' });
    expect(body.today.budgetMinutes).toBe(10);
    expect(body.today.estimatedMinutes).toBeLessThanOrEqual(10);
    expect(body.today.items.length).toBeGreaterThan(0);

    const me = await api.get('/me', { token: user.accessToken });
    expect(me.body.profile).toMatchObject({
      onboardingState: 'completed',
      goalType: 'daily_conversation',
      dailyMinutes: 10,
    });
  });

  it('POST /onboarding/complete 422 khi thiếu trường bắt buộc hoặc JLPT thiếu targetLevel', async () => {
    const user = await registerUser(api);
    const missing = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: { currentLevel: 'none' },
      validateRequest: false,
    });
    expect(missing.status).toBe(422);
    expect(Object.keys(missing.body.fields)).toEqual(
      expect.arrayContaining(['goalType', 'dailyMinutes', 'skills']),
    );

    const jlpt = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ goalType: 'jlpt' }),
    });
    expect(jlpt.status).toBe(422);
    expect(jlpt.body.fields.targetLevel).toBeTruthy();
  });

  it('POST /onboarding/complete 422 với thời gian mỗi ngày ngoài {5,10,15,30}', async () => {
    const user = await registerUser(api);
    const { status, body } = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ dailyMinutes: 20 }),
      validateRequest: false,
    });
    expect(status).toBe(422);
    expect(body.fields.dailyMinutes).toBeTruthy();
  });

  it('N2 tự khai báo: lộ trình bắt đầu N3 kèm scopeNotice', async () => {
    const user = await registerUser(api);
    const { body } = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ currentLevel: 'N2', goalType: 'jlpt', targetLevel: 'N2' }),
    });
    expect(body.path).toMatchObject({ startLevel: 'N3', scopeNotice: 'content_ceiling_n3' });
  });
});

describe('placement', () => {
  it('GET /placement/questions công khai, đủ 20 câu và KHÔNG lộ đáp án đúng', async () => {
    const { status, body } = await api.get('/placement/questions?lang=en');
    expect(status).toBe(200);
    expect(body.timeLimitSeconds).toBe(600);
    expect(body.questions).toHaveLength(20);
    for (const q of body.questions) {
      expect(Object.keys(q).sort()).toEqual(['choices', 'id', 'prompt', 'skill']);
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
    }
    expect(JSON.stringify(body)).not.toMatch(/correct/i);
  });

  it('POST /placement/submit 200: chấm trên server, đúng hết → N3', async () => {
    const user = await registerUser(api);
    const correct = await correctChoices();
    const { status, body } = await api.post('/placement/submit', {
      token: user.accessToken,
      body: {
        durationSeconds: 400,
        answers: [...correct].map(([questionId, choice]) => ({ questionId, choice })),
      },
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      estimatedLevel: 'N3',
      score: 20,
      total: 20,
      guessSuspected: false,
    });
    expect(body.id).toBeTruthy();
  });

  it('POST /placement/submit: bỏ trống toàn bộ → none + nghi đoán mò', async () => {
    const user = await registerUser(api);
    const correct = await correctChoices();
    const { status, body } = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: [...correct.keys()].map((questionId) => ({ questionId, choice: null })) },
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ estimatedLevel: 'none', score: 0, guessSuspected: true });
  });

  it('POST /placement/submit 422 với câu hỏi lạ, trả lời trùng, lựa chọn ngoài phạm vi', async () => {
    const user = await registerUser(api);
    const [firstId] = [...(await correctChoices()).keys()];
    const unknown = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: [{ questionId: '11111111-1111-4111-8111-111111111111', choice: 0 }] },
    });
    expect(unknown.status).toBe(422);
    const dup = await api.post('/placement/submit', {
      token: user.accessToken,
      body: {
        answers: [
          { questionId: firstId, choice: 0 },
          { questionId: firstId, choice: 1 },
        ],
      },
    });
    expect(dup.status).toBe(422);
    const range = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: [{ questionId: firstId, choice: 99 }] },
    });
    expect(range.status).toBe(422);
  });

  it('POST /placement/submit 401 khi thiếu token', async () => {
    const { status } = await api.post('/placement/submit', {
      body: { answers: [] },
      validateResponse: false,
    });
    expect(status).toBe(401);
  });
});

describe('/path và /today', () => {
  it('trước onboarding: GET /path 404 và GET /today 404', async () => {
    const user = await registerUser(api);
    expect((await api.get('/path', { token: user.accessToken })).status).toBe(404);
    expect((await api.get('/today', { token: user.accessToken })).status).toBe(404);
  });

  it('sau onboarding: GET /path trả khoảng trình độ động và GET /today khớp kế hoạch đã sinh', async () => {
    const user = await registerUser(api);
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding(),
    });
    const path = await api.get('/path', { token: user.accessToken });
    expect(path.status).toBe(200);
    expect(path.body.totalUnits).toBe(6);
    expect(path.body.completedUnits).toBe(0);
    // Người mới: các đơn vị đầu là nền tảng (đủ tiêu đề đã bản địa hóa).
    expect(path.body.items[0].title).toBeTruthy();

    const today = await api.get('/today', { token: user.accessToken });
    expect(today.status).toBe(200);
    expect(today.body).toEqual(done.body.today); // idempotent: cùng kế hoạch đã sinh
  });

  it('POST /path/rebuild với usePlacementResultId → lộ trình mới reason=placement_retake', async () => {
    const user = await registerUser(api);
    await api.post('/onboarding/complete', { token: user.accessToken, body: newcomerOnboarding() });
    const correct = await correctChoices();
    const placement = await api.post('/placement/submit', {
      token: user.accessToken,
      body: { answers: [...correct].map(([questionId, choice]) => ({ questionId, choice })) },
    });
    const rebuilt = await api.post('/path/rebuild', {
      token: user.accessToken,
      body: { usePlacementResultId: placement.body.id },
    });
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.reason).toBe('placement_retake');
    expect(rebuilt.body.startLevel).toBe('N3');

    const paths = await ctx.handle.db.select().from(learningPaths);
    const mine = paths.filter((p) => p.reason === 'placement_retake');
    expect(mine).toHaveLength(1);
    expect(mine[0]!.status).toBe('active');
  });
});
