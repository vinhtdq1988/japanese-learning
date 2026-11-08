/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import { answersFor, distinctTopicExercises, seedAnswers } from './class-activity-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import {
  addOrgRole,
  createTestClass,
  createTestOrg,
  createTestUser,
  enrollLearner,
  tokenFor,
} from './org-helpers.js';

// Kiểm thử chủ đề yếu của cả lớp (spec 004, T113, US7, FR-032, quickstart OG7, research O11): ngưỡng 30 câu /
// 60%, chỉ lượt chính (`is_retry = false`, cả bài học và ôn tập), chỉ kể từ `joined_at`, xếp mức yếu giảm dần,
// cờ yếu từng học viên phát lại bằng `nextWeakFlag` (không dùng `topic_stats.is_weak`).

let ctx: TestApp;
let api: ContractClient;
const NOW = '2026-01-20T05:00:00Z';
const JOINED = '2026-01-06T03:00:00Z';

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
});
beforeEach(() => ctx.clock.set(NOW));
afterAll(async () => {
  await ctx.close();
});

async function setup() {
  const org = await createTestOrg(ctx, { seats: 10 });
  const teacher = await createTestUser(ctx);
  await addOrgRole(ctx, org.orgId, teacher.userId, { teacher: true });
  const { classId } = await createTestClass(ctx, org.orgId, { teacherIds: [teacher.userId] });
  const join = async (displayName: string) => {
    const user = await createTestUser(ctx, { displayName });
    ctx.clock.set(JOINED);
    await enrollLearner(ctx, org.orgId, classId, user.userId);
    ctx.clock.set(NOW);
    return user;
  };
  return { orgId: org.orgId, classId, token: await tokenFor(ctx, teacher), join };
}

describe('chủ đề yếu của lớp', () => {
  it('lọc theo ngưỡng 30 câu & 60%, chỉ lượt chính kể từ joined_at, xếp mức yếu giảm dần', async () => {
    const w = await setup();
    const [x, y, z, retryOnly, ok, before] = await distinctTopicExercises(ctx, 6);
    const a = await w.join('An');
    const b = await w.join('Bình');
    const day = '2026-01-15';

    // X: gộp 21/36 = 58,3% < 60% ⇒ yếu; chỉ An (4/18) bị gắn cờ, Bình (17/18) thì không.
    await seedAnswers(ctx, a.userId, answersFor(x!, day, 18, 4));
    await seedAnswers(ctx, b.userId, answersFor(x!, day, 18, 17));
    // Y: 29 câu (dưới ngưỡng 30) ⇒ KHÔNG xuất hiện dù độ chính xác rất thấp.
    await seedAnswers(ctx, a.userId, answersFor(y!, day, 29, 3));
    // Z: đúng 30 câu, nửa bài học nửa ôn tập, 6 đúng (20%) ⇒ yếu nhất.
    await seedAnswers(ctx, a.userId, answersFor(z!, day, 15, 3, { context: 'lesson' }));
    await seedAnswers(ctx, a.userId, answersFor(z!, day, 15, 3, { context: 'review' }));
    // 25 lượt chính + 10 lượt hỏi lại: lượt hỏi lại KHÔNG được tính ⇒ 25 < 30.
    await seedAnswers(ctx, a.userId, answersFor(retryOnly!, day, 25, 0));
    await seedAnswers(ctx, a.userId, answersFor(retryOnly!, day, 10, 0, { isRetry: true }));
    // Đủ số câu nhưng độ chính xác cao ⇒ không yếu.
    await seedAnswers(ctx, b.userId, answersFor(ok!, day, 40, 36));
    // Hoạt động TRƯỚC khi vào lớp (06/01) ⇒ không tính.
    await seedAnswers(ctx, a.userId, answersFor(before!, '2026-01-02', 40, 0));

    const res = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(res.status).toBe(200);
    const topics: any[] = res.body;
    expect(topics.map((t) => t.topicId)).toEqual([z!.topicId, x!.topicId]);

    expect(topics[0]).toMatchObject({ answers: 30, accuracy: 0.2 });
    expect(topics[0].flaggedLearners).toEqual([{ userId: a.userId, displayName: 'An' }]);
    expect(topics[1]).toMatchObject({ answers: 36, accuracy: 0.583 });
    expect(topics[1].flaggedLearners).toEqual([{ userId: a.userId, displayName: 'An' }]);
    for (const t of topics) {
      expect(t.name).toBeTruthy();
      expect(t.skill).toBeTruthy();
    }
  });

  it('cả hai học viên đều bị gắn cờ thì liệt kê cả hai theo thứ tự tên', async () => {
    const w = await setup();
    const [t] = await distinctTopicExercises(ctx, 1);
    const a = await w.join('Chi');
    const b = await w.join('Bảo');
    await seedAnswers(ctx, a.userId, answersFor(t!, '2026-01-12', 16, 4));
    await seedAnswers(ctx, b.userId, answersFor(t!, '2026-01-12', 16, 6));
    const res = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].flaggedLearners.map((l: any) => l.displayName)).toEqual(['Bảo', 'Chi']);
  });

  it('lớp chưa có dữ liệu ⇒ mảng rỗng', async () => {
    const w = await setup();
    await w.join('Em');
    const res = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('học viên đã rời lớp không còn góp số liệu vào chủ đề yếu', async () => {
    const w = await setup();
    const [t] = await distinctTopicExercises(ctx, 1);
    const a = await w.join('Dũng');
    await seedAnswers(ctx, a.userId, answersFor(t!, '2026-01-12', 30, 2));
    const before = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(before.body).toHaveLength(1);
    await ctx.handle.pool.query(
      `UPDATE class_memberships SET left_at = now(), end_reason = 'removed' WHERE user_id = $1`,
      [a.userId],
    );
    const after = await api.get(`/classes/${w.classId}/weak-topics`, { token: w.token });
    expect(after.body).toEqual([]);
  });
});
