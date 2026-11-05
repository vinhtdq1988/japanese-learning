import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerSecurityHeaders } from '../../src/api/middleware/security-headers.js';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { getToday, onboardedLearner, startSession, type Learner } from './lesson-helpers.js';

// Rà soát bảo mật (T116, FR-034, R16): header phòng thủ trên API, không rò đáp án qua endpoint người
// học ngoài phiên, thông điệp lỗi không lộ dữ liệu người khác, vai trò admin được server kiểm tra.

let ctx: TestApp;
let api: ContractClient;
let learner: Learner;
let other: Learner;

/** Khóa JSON chỉ được xuất hiện ở nội dung dùng thử công khai (chấm cục bộ) hoặc API quản trị. */
const ANSWER_KEYS = [
  'correct_index',
  'correct_choice',
  'correctChoice',
  'correctIndex',
  'accepted_answers',
  'acceptedAnswers',
  'answerKey',
];

function expectNoAnswerKeys(body: unknown): void {
  const raw = JSON.stringify(body);
  for (const key of ANSWER_KEYS) expect(raw, `không được lộ khóa ${key}`).not.toContain(key);
}

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  learner = await onboardedLearner(api, ctx);
  other = await onboardedLearner(api, ctx);
});
afterAll(async () => {
  await ctx.close();
});

describe('header bảo mật của API', () => {
  it('phản hồi thành công và lỗi đều có CSP chặt, nosniff, DENY và no-store', async () => {
    const ok = await api.get('/me', { token: learner.token });
    const unauthorized = await api.get('/me', { validateResponse: false });
    const missing = await ctx.app.inject({ method: 'GET', url: '/api/v1/khong-ton-tai' });
    expect(unauthorized.status).toBe(401);
    expect(missing.statusCode).toBe(404);

    const responses = [ok.headers, unauthorized.headers, missing.headers];
    for (const h of responses) {
      expect(h['content-security-policy']).toContain("default-src 'none'");
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['referrer-policy']).toBe('no-referrer');
      expect(h['cache-control']).toBe('no-store');
    }
  });

  it('HSTS chỉ bật khi được yêu cầu (production sau TLS), dev chạy HTTP thường', async () => {
    const res = await api.get('/me', { token: learner.token });
    expect(res.headers['strict-transport-security']).toBeUndefined();

    const bare = Fastify();
    registerSecurityHeaders(bare, { hsts: true });
    bare.get('/ping', async () => ({ ok: true }));
    try {
      const r = await bare.inject({ method: 'GET', url: '/ping' });
      expect(String(r.headers['strict-transport-security'])).toContain('max-age=31536000');
    } finally {
      await bare.close();
    }
  });
});

describe('không rò đáp án qua endpoint người học ngoài phiên', () => {
  it('bộ câu hỏi placement công khai không kèm đáp án đúng', async () => {
    const res = await api.get('/placement/questions');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(20);
    expectNoAnswerKeys(res.body);
  });

  it('/me, /today, /path, /progress và phiên đang học không chứa khóa đáp án', async () => {
    const plan = await getToday(api, learner);
    const session = await startSession(api, learner, plan.items[0].id);
    const bodies = [
      (await api.get('/me', { token: learner.token })).body,
      (await api.get('/today', { token: learner.token })).body,
      (await api.get('/path', { token: learner.token })).body,
      (await api.get('/progress', { token: learner.token })).body,
      session,
    ];
    for (const body of bodies) expectNoAnswerKeys(body);
  });

  it('phiên ôn tập/bắt đầu lại giữa chừng cũng không lộ đáp án', async () => {
    const plan = await getToday(api, learner);
    const resumed = await startSession(api, learner, plan.items[0].id);
    expectNoAnswerKeys(resumed.exercises);
  });
});

describe('thông điệp lỗi không lộ dữ liệu người khác', () => {
  it('tài nguyên của người khác trả 404 giống hệt tài nguyên không tồn tại', async () => {
    const theirs = (await getToday(api, other)).items[0].id;
    const foreign = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: theirs },
    });
    const missing = await api.post('/sessions', {
      token: learner.token,
      body: { planItemId: randomUUID() },
    });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);

    const theirSession = await startSession(api, other, theirs);
    const answerForeign = await api.post(`/sessions/${theirSession.id}/answers`, {
      token: learner.token,
      body: {
        exerciseId: theirSession.exercises[0].id,
        clientEventId: randomUUID(),
        answer: 0,
      },
      validateRequest: false,
    });
    const answerMissing = await api.post(`/sessions/${randomUUID()}/answers`, {
      token: learner.token,
      body: {
        exerciseId: theirSession.exercises[0].id,
        clientEventId: randomUUID(),
        answer: 0,
      },
      validateRequest: false,
    });
    expect(answerForeign.status).toBe(404);
    expect(answerForeign.body).toEqual(answerMissing.body);
  });

  it('đăng nhập sai email hay sai mật khẩu cho cùng thông điệp', async () => {
    const wrongPassword = await api.post('/auth/login', {
      body: { email: learner.user.email, password: 'Sai-mat-khau-999' },
    });
    const wrongEmail = await api.post('/auth/login', {
      body: { email: 'khong-ton-tai@example.com', password: 'Sai-mat-khau-999' },
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(wrongEmail.body.message);
  });

  it('yêu cầu đặt lại mật khẩu trả cùng một phản hồi với email có và không tồn tại', async () => {
    const known = await api.post('/auth/password-reset/request', {
      body: { email: learner.user.email },
      validateResponse: false,
    });
    const unknown = await api.post('/auth/password-reset/request', {
      body: { email: 'khong-ton-tai@example.com' },
      validateResponse: false,
    });
    expect(known.status).toBe(unknown.status);
    expect(known.body ?? null).toEqual(unknown.body ?? null);
  });

  it('JSON hỏng hoặc thiếu trường trả lỗi chung, không kèm dấu vết ngăn xếp', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": ',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.body).not.toMatch(/at .*\(.*:\d+:\d+\)|node_modules|stack/i);
  });
});

describe('quyền quản trị do server kiểm tra', () => {
  it('người học thường nhận 403 trên mọi route /admin, token giả nhận 401', async () => {
    const routes = [
      '/admin/units',
      '/admin/topics',
      '/admin/users',
      '/admin/placement-questions',
      '/admin/action-logs',
    ];
    for (const route of routes) {
      const asLearner = await api.get(route, { token: learner.token, validateResponse: false });
      expect(asLearner.status, route).toBe(403);
      expectNoAnswerKeys(asLearner.body);
      const forged = await api.get(route, { token: 'khong.phai.jwt', validateResponse: false });
      expect(forged.status, route).toBe(401);
      const anon = await api.get(route, { validateResponse: false });
      expect(anon.status, route).toBe(401);
    }
  });
});
