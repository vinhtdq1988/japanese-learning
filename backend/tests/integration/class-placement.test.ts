/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
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

// Kiểm thử yêu cầu kiểm tra trình độ cho cả lớp (spec 004, T122, US8, FR-034, quickstart OG8): giáo viên tạo yêu
// cầu (một yêu cầu mở mỗi lớp), học viên (kể cả vào lớp sau) thấy và nộp bằng `classRequestId` → kết quả lưu
// `is_current = false`, KHÔNG đổi kết quả hiện hành cá nhân và KHÔNG đổi lộ trình; giáo viên xem kết quả từng
// người + phân bố; đóng yêu cầu. Phần chuyển lớp (`move`) nằm ở `class-move.test.ts`.

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => ctx.clock.set(NOW));
afterAll(async () => {
  await ctx.close();
});

interface Question {
  id: string;
  correct: number;
}
let questions: Question[] = [];
async function questionSet(): Promise<Question[]> {
  if (questions.length > 0) return questions;
  const { rows } = await ctx.handle.pool.query(
    'SELECT id, correct_choice FROM placement_questions WHERE is_active ORDER BY position',
  );
  questions = rows.map((r: any) => ({ id: r.id, correct: r.correct_choice }));
  return questions;
}

/** Bộ câu trả lời: `rightCount` câu đầu đúng, còn lại chọn sai. */
async function answers(rightCount: number) {
  const set = await questionSet();
  return set.map((q, i) => ({
    questionId: q.id,
    choice: i < rightCount ? q.correct : q.correct === 0 ? 1 : 0,
  }));
}

async function setup() {
  const org = await createTestOrg(ctx, { seats: 20 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const join = async (displayName: string): Promise<TestUser & { token: string }> => {
    const user = await createTestUser(ctx, { displayName });
    await enrollLearner(ctx, org.orgId, classId, user.userId);
    return { ...user, token: await tokenFor(ctx, user) };
  };
  return { orgId: org.orgId, classId, teacher, token: await tokenFor(ctx, teacher), join };
}

const createRequest = (w: { classId: string; token: string }) =>
  api.post(`/classes/${w.classId}/placement-requests`, { token: w.token });

describe('tạo / xem / đóng yêu cầu', () => {
  it('tạo yêu cầu 201; tạo lần hai khi còn mở ⇒ 409; ghi nhật ký class.placement_request', async () => {
    const w = await setup();
    const first = await createRequest(w);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ closedAt: null });
    expect(first.body.id).toBeTruthy();

    const second = await api.post(`/classes/${w.classId}/placement-requests`, {
      token: w.token,
      validateResponse: false,
    });
    expect(second.status).toBe(409);

    const { rows } = await ctx.handle.pool.query(
      `SELECT actor_id, organization_id, diff FROM admin_action_logs
        WHERE action = 'class.placement_request' AND target_id = $1 ORDER BY occurred_at, id`,
      [w.classId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: w.teacher.userId, organization_id: w.orgId });
    expect(rows[0].diff).toMatchObject({ op: 'create', requestId: first.body.id });
  });

  it('lớp đã lưu trữ ⇒ 409 CLASS_ARCHIVED', async () => {
    const w = await setup();
    await ctx.handle.pool.query(
      `UPDATE classes SET status = 'archived', archived_at = now() WHERE id = $1`,
      [w.classId],
    );
    const res = await api.post(`/classes/${w.classId}/placement-requests`, {
      token: w.token,
      validateResponse: false,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_ARCHIVED');
  });

  it('chưa có yêu cầu mở ⇒ GET current và close đều 404', async () => {
    const w = await setup();
    const get = await api.get(`/classes/${w.classId}/placement-requests/current`, {
      token: w.token,
      validateResponse: false,
    });
    expect(get.status).toBe(404);
    const close = await api.post(`/classes/${w.classId}/placement-requests/current/close`, {
      token: w.token,
      validateResponse: false,
    });
    expect(close.status).toBe(404);
  });

  it('đóng yêu cầu ⇒ 204, GET current 404, được tạo yêu cầu mới', async () => {
    const w = await setup();
    await createRequest(w);
    const close = await api.post(`/classes/${w.classId}/placement-requests/current/close`, {
      token: w.token,
    });
    expect(close.status).toBe(204);
    const get = await api.get(`/classes/${w.classId}/placement-requests/current`, {
      token: w.token,
      validateResponse: false,
    });
    expect(get.status).toBe(404);
    expect((await createRequest(w)).status).toBe(201);
  });
});

describe('học viên nộp bài theo yêu cầu của lớp', () => {
  it('thấy placementRequest (kể cả vào lớp sau), nộp ⇒ is_current=false, không đổi kết quả cá nhân và lộ trình', async () => {
    const w = await setup();
    // Học viên có kết quả cá nhân hiện hành TRƯỚC khi vào lớp.
    const early = await createTestUser(ctx, { displayName: 'An' });
    const earlyToken = await tokenFor(ctx, early);
    const personal = await api.post('/placement/submit', {
      token: earlyToken,
      body: { answers: await answers(5) },
    });
    expect(personal.status).toBe(200);
    await enrollLearner(ctx, w.orgId, w.classId, early.userId);
    const pathsBefore = await ctx.handle.pool.query(
      'SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1',
      [early.userId],
    );
    const classPathBefore = await ctx.handle.pool.query(
      'SELECT * FROM class_paths WHERE class_id = $1',
      [w.classId],
    );

    const request = (await createRequest(w)).body;
    const late = await w.join('Bình'); // vào lớp SAU khi tạo yêu cầu

    for (const token of [earlyToken, late.token]) {
      const mine = await api.get('/me/class', { token });
      expect(mine.status).toBe(200);
      expect(mine.body.placementRequest).toMatchObject({ id: request.id });
    }

    const submit = await api.post('/placement/submit', {
      token: earlyToken,
      body: { classRequestId: request.id, answers: await answers(20) },
    });
    expect(submit.status).toBe(200);
    expect(submit.body.id).not.toBe(personal.body.id);

    const { rows } = await ctx.handle.pool.query(
      `SELECT id, is_current, class_placement_request_id FROM placement_results
        WHERE user_id = $1 ORDER BY taken_at, id`,
      [early.userId],
    );
    expect(rows).toHaveLength(2);
    const classRow = rows.find((r: any) => r.id === submit.body.id);
    expect(classRow).toMatchObject({ is_current: false, class_placement_request_id: request.id });
    // Kết quả cá nhân vẫn là kết quả hiện hành.
    expect(rows.find((r: any) => r.id === personal.body.id).is_current).toBe(true);

    // Lộ trình cá nhân và lộ trình lớp không đổi (FR-034).
    const pathsAfter = await ctx.handle.pool.query(
      'SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1',
      [early.userId],
    );
    expect(pathsAfter.rows[0].n).toBe(pathsBefore.rows[0].n);
    const classPathAfter = await ctx.handle.pool.query(
      'SELECT * FROM class_paths WHERE class_id = $1',
      [w.classId],
    );
    expect(classPathAfter.rows).toEqual(classPathBefore.rows);

    // Đã nộp ⇒ không còn thấy yêu cầu; người chưa nộp vẫn thấy.
    expect((await api.get('/me/class', { token: earlyToken })).body.placementRequest).toBeNull();
    expect((await api.get('/me/class', { token: late.token })).body.placementRequest).toMatchObject(
      {
        id: request.id,
      },
    );
  });

  it('nộp lần hai, id yêu cầu sai hoặc yêu cầu đã đóng ⇒ 409 CLASS_MANAGED', async () => {
    const w = await setup();
    const learner = await w.join('Chi');
    const request = (await createRequest(w)).body;
    const body = { classRequestId: request.id, answers: await answers(10) };
    expect((await api.post('/placement/submit', { token: learner.token, body })).status).toBe(200);

    const again = await api.post('/placement/submit', {
      token: learner.token,
      body,
      validateResponse: false,
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CLASS_MANAGED');

    const wrong = await api.post('/placement/submit', {
      token: learner.token,
      body: { classRequestId: randomUUID(), answers: await answers(10) },
      validateResponse: false,
    });
    expect(wrong.status).toBe(409);
    expect(wrong.body.code).toBe('CLASS_MANAGED');

    const other = await w.join('Dũng');
    await api.post(`/classes/${w.classId}/placement-requests/current/close`, { token: w.token });
    const closed = await api.post('/placement/submit', {
      token: other.token,
      body: { classRequestId: request.id, answers: await answers(10) },
      validateResponse: false,
    });
    expect(closed.status).toBe(409);
    expect(closed.body.code).toBe('CLASS_MANAGED');
  });

  it('người không thuộc lớp gửi classRequestId ⇒ 404 chung', async () => {
    const w = await setup();
    const request = (await createRequest(w)).body;
    const outsider = await createTestUser(ctx);
    const res = await api.post('/placement/submit', {
      token: await tokenFor(ctx, outsider),
      body: { classRequestId: request.id, answers: await answers(10) },
      validateResponse: false,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('học viên thuộc lớp nộp KHÔNG kèm classRequestId vẫn bị khóa (409 CLASS_MANAGED)', async () => {
    const w = await setup();
    const learner = await w.join('Em');
    await createRequest(w);
    const res = await api.post('/placement/submit', {
      token: learner.token,
      body: { answers: await answers(10) },
      validateResponse: false,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLASS_MANAGED');
  });
});

describe('kết quả của lớp và phân bố', () => {
  it('results done|pending theo từng thành viên và distribution đếm đúng', async () => {
    const w = await setup();
    const strong = await w.join('An giỏi');
    const weak = await w.join('Bình yếu');
    const absent = await w.join('Chi chưa làm');
    const request = (await createRequest(w)).body;
    for (const [user, right] of [
      [strong, 20],
      [weak, 0],
    ] as const) {
      const res = await api.post('/placement/submit', {
        token: user.token,
        body: { classRequestId: request.id, answers: await answers(right) },
      });
      expect(res.status).toBe(200);
    }

    const res = await api.get(`/classes/${w.classId}/placement-requests/current`, {
      token: w.token,
    });
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ id: request.id, closedAt: null });
    expect(res.body.results).toHaveLength(3);
    const byId = Object.fromEntries(res.body.results.map((r: any) => [r.userId, r]));
    expect(byId[absent.userId]).toEqual({
      userId: absent.userId,
      displayName: 'Chi chưa làm',
      status: 'pending',
    });
    for (const u of [strong, weak]) {
      expect(byId[u.userId]).toMatchObject({ status: 'done', total: 20 });
      expect(byId[u.userId].estimatedLevel).toMatch(/^(none|N5|N4|N3)$/);
      expect(typeof byId[u.userId].score).toBe('number');
      expect(byId[u.userId].takenAt).toBeTruthy();
    }
    // Phân bố chỉ đếm người đã làm và khớp từng kết quả; luôn đủ bốn khóa.
    expect(Object.keys(res.body.distribution).sort()).toEqual(['N3', 'N4', 'N5', 'none']);
    const sum = Object.values(res.body.distribution as Record<string, number>).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(2);
    const expected: Record<string, number> = { none: 0, N5: 0, N4: 0, N3: 0 };
    for (const u of [strong, weak]) {
      const level: string = byId[u.userId].estimatedLevel;
      expected[level] = (expected[level] ?? 0) + 1;
    }
    expect(res.body.distribution).toEqual(expected);
    expect(byId[strong.userId].score).toBeGreaterThan(byId[weak.userId].score);
  });

  it('chỉ liệt kê thành viên HIỆN TẠI: học viên đã rời lớp không còn trong kết quả', async () => {
    const w = await setup();
    const stays = await w.join('An');
    const leaves = await w.join('Bình');
    const request = (await createRequest(w)).body;
    await api.post('/placement/submit', {
      token: leaves.token,
      body: { classRequestId: request.id, answers: await answers(10) },
    });
    await ctx.handle.pool.query(
      `UPDATE class_memberships SET left_at = now(), end_reason = 'removed' WHERE user_id = $1`,
      [leaves.userId],
    );
    const res = await api.get(`/classes/${w.classId}/placement-requests/current`, {
      token: w.token,
    });
    expect(res.body.results.map((r: any) => r.userId)).toEqual([stays.userId]);
    expect(res.body.distribution).toEqual({ none: 0, N5: 0, N4: 0, N3: 0 });
  });
});
