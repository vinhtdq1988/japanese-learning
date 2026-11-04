/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { resolveText } from '../../src/domain/i18n.js';
import {
  ContractClient,
  newcomerOnboarding,
  registerUser,
  type RegisteredUser,
} from '../contract/client.js';
import type { TestApp } from './helpers.js';

// Tiện ích dùng chung cho kiểm thử phiên học (US2): tạo người học đã onboarding, lấy đáp án đúng/sai
// của bài tập từ CSDL (client không bao giờ thấy đáp án) và trả lời cả phiên.

export interface Learner {
  user: RegisteredUser;
  token: string;
  userId: string;
}

/** Đăng ký + onboarding bỏ qua placement (người mới 10 phút/ngày, vi). */
export async function onboardedLearner(
  api: ContractClient,
  ctx: TestApp,
  onboarding: Record<string, unknown> = {},
): Promise<Learner> {
  const user = await registerUser(api);
  const done = await api.post('/onboarding/complete', {
    token: user.accessToken,
    body: newcomerOnboarding({ timezone: 'Asia/Ho_Chi_Minh', ...onboarding }),
  });
  if (done.status !== 200) throw new Error(`Onboarding thất bại: ${JSON.stringify(done.body)}`);
  const { rows } = await ctx.handle.pool.query('SELECT id FROM users WHERE email = $1', [
    user.email,
  ]);
  return { user, token: user.accessToken, userId: rows[0].id };
}

export async function getToday(api: ContractClient, learner: Learner) {
  const res = await api.get('/today', { token: learner.token });
  if (res.status !== 200) throw new Error(`GET /today lỗi: ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function startSession(api: ContractClient, learner: Learner, planItemId: string) {
  const res = await api.post('/sessions', { token: learner.token, body: { planItemId } });
  if (res.status !== 200) throw new Error(`POST /sessions lỗi: ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Câu trả lời đúng (hoặc cố ý sai) của bài tập, dựng từ payload trong CSDL theo ngôn ngữ `vi`. */
export async function answerFor(
  ctx: TestApp,
  exerciseId: string,
  correct: boolean,
): Promise<unknown> {
  const { rows } = await ctx.handle.pool.query(
    'SELECT type, payload FROM exercises WHERE id = $1',
    [exerciseId],
  );
  const { type, payload } = rows[0];
  switch (type) {
    case 'multiple_choice':
      return correct ? payload.correct_index : (payload.correct_index + 1) % payload.choices.length;
    case 'matching': {
      const pairs = payload.pairs.map(([l, r]: [any, any]) => [
        resolveText(l, 'vi'),
        resolveText(r, 'vi'),
      ]);
      if (correct) return pairs;
      // Hoán đổi vế phải của hai cặp đầu → chắc chắn sai.
      const wrong = pairs.map((p: string[]) => [...p]);
      [wrong[0][1], wrong[1][1]] = [wrong[1][1], wrong[0][1]];
      return wrong;
    }
    default:
      return correct ? payload.accepted_answers[0] : 'sai-hoan-toan';
  }
}

export async function submit(
  api: ContractClient,
  ctx: TestApp,
  learner: Learner,
  sessionId: string,
  exerciseId: string,
  options: { correct?: boolean; clientEventId?: string; isRetry?: boolean } = {},
) {
  return api.post(`/sessions/${sessionId}/answers`, {
    token: learner.token,
    body: {
      clientEventId: options.clientEventId ?? randomUUID(),
      exerciseId,
      answer: await answerFor(ctx, exerciseId, options.correct ?? true),
      ...(options.isRetry ? { isRetry: true } : {}),
    },
  });
}

/** Trả lời mọi bài tập của phiên (tất cả đúng, hoặc `wrongIndexes` cố ý sai); trả danh sách kết quả. */
export async function answerAll(
  api: ContractClient,
  ctx: TestApp,
  learner: Learner,
  session: any,
  options: { wrongIndexes?: number[] } = {},
) {
  const results = [];
  for (const [i, exercise] of (session.exercises as any[]).entries()) {
    const res = await submit(api, ctx, learner, session.id, exercise.id, {
      correct: !options.wrongIndexes?.includes(i),
    });
    if (res.status !== 200) throw new Error(`Ghi câu trả lời lỗi: ${JSON.stringify(res.body)}`);
    results.push(res.body);
  }
  return results;
}

/** Học trọn một mục kế hoạch: bắt đầu, trả lời hết, hoàn thành; trả tóm tắt. */
export async function finishPlanItem(
  api: ContractClient,
  ctx: TestApp,
  learner: Learner,
  planItemId: string,
) {
  const session = await startSession(api, learner, planItemId);
  await answerAll(api, ctx, learner, session);
  const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
  if (done.status !== 200) throw new Error(`Hoàn thành phiên lỗi: ${JSON.stringify(done.body)}`);
  return { session, summary: done.body };
}

export const query = async <T = any>(ctx: TestApp, sqlText: string, params: unknown[] = []) =>
  (await ctx.handle.pool.query(sqlText, params)).rows as T[];

/** Sang ngày địa phương kế tiếp: access token cũ hết hạn (15 phút) nên đăng nhập lại để lấy token mới. */
export async function advanceDays(
  api: ContractClient,
  ctx: TestApp,
  learner: Learner,
  days = 1,
): Promise<void> {
  ctx.clock.advanceDays(days);
  const login = await api.post('/auth/login', {
    body: { email: learner.user.email, password: learner.user.password },
  });
  if (login.status !== 200) throw new Error(`Đăng nhập lại lỗi: ${JSON.stringify(login.body)}`);
  learner.token = login.body.accessToken;
}

/** Học trọn một mục kế hoạch, cố ý trả lời sai tại `wrongIndexes` hoặc sai hết khi `allWrong`. */
export async function studyPlanItem(
  api: ContractClient,
  ctx: TestApp,
  learner: Learner,
  planItemId: string,
  options: { wrongIndexes?: number[]; allWrong?: boolean } = {},
) {
  const session = await startSession(api, learner, planItemId);
  const wrongIndexes = options.allWrong
    ? (session.exercises as unknown[]).map((_, i) => i)
    : options.wrongIndexes;
  const results = await answerAll(api, ctx, learner, session, wrongIndexes ? { wrongIndexes } : {});
  const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
  if (done.status !== 200) throw new Error(`Hoàn thành phiên lỗi: ${JSON.stringify(done.body)}`);
  return { session, results, summary: done.body };
}
