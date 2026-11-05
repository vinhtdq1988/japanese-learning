/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, registerUser } from '../contract/client.js';
import {
  adminSession,
  rows,
  topicIdFor,
  vocabUnitPayload,
  type AdminSession,
} from './admin-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';
import { getToday, onboardedLearner, startSession, submit } from './lesson-helpers.js';

// Kiểm thử tích hợp US6 (T103) trên PostgreSQL thật: phân quyền, kiểm tra nội dung khi kích hoạt, hiệu lực
// với người học sau TTL bộ đệm (SC-008), bảo toàn dữ liệu đã học khi sửa nội dung, bộ placement, vô hiệu
// hóa tài khoản và nhật ký hành động.

let ctx: TestApp;
let api: ContractClient;
let admin: AdminSession;
let vocabTopic: string;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedContent(ctx.handle.db);
  api = new ContractClient(ctx.app);
  admin = await adminSession(api, ctx);
  vocabTopic = await topicIdFor(ctx, 'vocabulary', 'N5');
});
afterAll(async () => {
  await ctx.close();
});

const auth = () => ({ token: admin.token });

async function createActiveUnit(overrides: Record<string, unknown> = {}) {
  const created = await api.post('/admin/units', {
    ...auth(),
    body: vocabUnitPayload(vocabTopic, overrides),
  });
  expect(created.status).toBe(201);
  const activated = await api.put(`/admin/units/${created.body.id}/status`, {
    ...auth(),
    body: { status: 'active' },
  });
  expect(activated.status).toBe(200);
  return activated.body;
}

const logsFor = (targetId: string) =>
  rows(ctx, 'SELECT * FROM admin_action_logs WHERE target_id = $1 ORDER BY occurred_at, id', [
    targetId,
  ]);

describe('phân quyền (FR-004)', () => {
  it('người học thường nhận 403 ở mọi /admin/*, kể cả đã onboarding và có dữ liệu', async () => {
    const learner = await onboardedLearner(api, ctx);
    const probes: [string, string, unknown?][] = [
      ['get', '/admin/units'],
      ['post', '/admin/units', vocabUnitPayload(vocabTopic)],
      ['get', '/admin/placement-questions'],
      ['get', '/admin/users'],
      ['get', '/admin/action-logs'],
    ];
    for (const [method, url, body] of probes) {
      const res = await api.call(method, url, {
        token: learner.token,
        ...(body ? { body } : {}),
      });
      expect(res.status, `${method} ${url}`).toBe(403);
    }
    // Không có thay đổi nào được ghi nhận.
    expect(
      await rows(ctx, "SELECT 1 FROM admin_action_logs WHERE action LIKE 'unit.%'"),
    ).toHaveLength(0);
  });
});

describe('kích hoạt đơn vị (R13, data-model §2.8)', () => {
  it('thiếu bản dịch hoặc thiếu bài tập thì bị từ chối và đơn vị giữ nguyên trạng thái', async () => {
    const noTranslation = await api.post('/admin/units', {
      ...auth(),
      body: vocabUnitPayload(vocabTopic, {
        title: { vi: 'Chỉ có tiếng Việt', en: '' },
      }),
    });
    const rejected = await api.put(`/admin/units/${noTranslation.body.id}/status`, {
      ...auth(),
      body: { status: 'active' },
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body.fields.title).toBeTruthy();
    expect((await api.get(`/admin/units/${noTranslation.body.id}`, auth())).body.status).toBe(
      'draft',
    );

    const noExercise = await api.post('/admin/units', {
      ...auth(),
      body: vocabUnitPayload(vocabTopic, { exercises: [] }),
    });
    const rejected2 = await api.put(`/admin/units/${noExercise.body.id}/status`, {
      ...auth(),
      body: { status: 'active' },
    });
    expect(rejected2.status).toBe(422);
    expect(rejected2.body.fields.exercises).toBeTruthy();

    // Thiếu cách đọc của từ vựng và đáp án trắc nghiệm ngoài danh sách: liệt kê đủ từng vị trí.
    const payload = vocabUnitPayload(vocabTopic);
    payload.items[0] = { ...payload.items[0], reading: '' } as any;
    payload.exercises[0] = {
      ...payload.exercises[0],
      payload: { choices: ['a', 'b'], correct_index: 7 },
    } as any;
    const broken = await api.post('/admin/units', { ...auth(), body: payload });
    const rejected3 = await api.put(`/admin/units/${broken.body.id}/status`, {
      ...auth(),
      body: { status: 'active' },
    });
    expect(rejected3.status).toBe(422);
    expect(Object.keys(rejected3.body.fields)).toEqual(
      expect.arrayContaining(['items[0].reading', 'exercises[0].payload.correct_index']),
    );
    expect(await logsFor(broken.body.id)).toHaveLength(1); // chỉ có unit.create
  });

  it('sửa đơn vị đang active thành không hợp lệ bị hoàn tác toàn bộ', async () => {
    const unit = await createActiveUnit();
    const bad = await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: { ...unit, title: { vi: 'Đã đổi', en: '' } },
    });
    expect(bad.status).toBe(422);
    const after = (await api.get(`/admin/units/${unit.id}`, auth())).body;
    expect(after.title).toEqual(unit.title);
    expect(after.status).toBe('active');
  });
});

describe('hiệu lực với người học (SC-008)', () => {
  it('đơn vị mới xuất hiện ở GET /path và chọn được qua học thêm sau TTL; kế hoạch hôm nay không đổi; không tới người học khác kỹ năng', async () => {
    const vocabLearner = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });
    const grammarLearner = await onboardedLearner(api, ctx, { skills: ['grammar'] });
    const planBefore = await getToday(api, vocabLearner);
    const pathBefore = (await api.get('/path', { token: vocabLearner.token })).body;

    const unit = await createActiveUnit();

    // Kế hoạch hôm nay đã sinh KHÔNG đổi dù nội dung đổi trong ngày.
    ctx.clock.advanceMs(61_000);
    const planAfter = await getToday(api, vocabLearner);
    expect(planAfter.items.map((i: any) => i.id)).toEqual(planBefore.items.map((i: any) => i.id));

    const pathAfter = (await api.get('/path', { token: vocabLearner.token })).body;
    expect(pathAfter.items.some((i: any) => i.unitId === unit.id)).toBe(true);
    expect(pathBefore.items.some((i: any) => i.unitId === unit.id)).toBe(false);

    const extra = await api.post('/today/extra', { token: vocabLearner.token });
    expect(extra.status).toBe(200);
    expect(extra.body.id).toBe(unit.id);

    // Người học chỉ chọn ngữ pháp không thấy đơn vị từ vựng.
    const grammarPath = (await api.get('/path', { token: grammarLearner.token })).body;
    expect(grammarPath.items.some((i: any) => i.unitId === unit.id)).toBe(false);
    const grammarExtra = await api.post('/today/extra', {
      token: grammarLearner.token,
      validateResponse: false,
    });
    expect(grammarExtra.body.id).not.toBe(unit.id);

    // Vô hiệu hóa: biến mất khỏi lộ trình sau TTL.
    await api.put(`/admin/units/${unit.id}/status`, { ...auth(), body: { status: 'inactive' } });
    ctx.clock.advanceMs(61_000);
    const hidden = (await api.get('/path', { token: vocabLearner.token })).body;
    expect(hidden.items.some((i: any) => i.unitId === unit.id)).toBe(false);
  });
});

describe('sửa nội dung không làm hỏng dữ liệu đã học', () => {
  it('phần tử vắng mặt thành inactive, lịch sử và lịch ôn còn nguyên, phiên mới không chứa phần tử đó, phiên đang học giữ snapshot', async () => {
    const unit = await createActiveUnit();
    const learner = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });
    const learner2 = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });

    // Học viên 1 bắt đầu học thêm đơn vị này và trả lời bài tập đầu (gắn mục 0 → có lịch ôn).
    const session = await startSession(api, learner, unit.id);
    expect(session.exercises).toHaveLength(3);
    const answered = await submit(api, ctx, learner, session.id, session.exercises[0].id, {
      correct: true,
    });
    expect(answered.status).toBe(200);
    const [{ id: removedItem }] = await rows(
      ctx,
      'SELECT id FROM content_items WHERE unit_id = $1 AND japanese = $2',
      [unit.id, '宿題'],
    );
    const recordsBefore = await rows(ctx, 'SELECT * FROM study_records WHERE user_id = $1', [
      learner.userId,
    ]);
    const schedulesBefore = await rows(ctx, 'SELECT * FROM review_schedules WHERE user_id = $1', [
      learner.userId,
    ]);
    expect(recordsBefore).toHaveLength(1);
    expect(schedulesBefore).toHaveLength(1);

    // Admin gỡ mục 宿題 và bài tập điền chỗ trống khỏi payload.
    const edited = await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...unit,
        items: [unit.items[0]],
        exercises: [unit.exercises[0], unit.exercises[2]],
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.items.map((i: any) => i.status)).toEqual(['active', 'inactive']);
    expect(edited.body.exercises.map((e: any) => e.status)).toEqual([
      'active',
      'active',
      'inactive',
    ]);

    // Không có hàng nào bị xóa cứng; id của phần tử giữ nguyên.
    expect(
      await rows(ctx, 'SELECT 1 FROM content_items WHERE unit_id = $1', [unit.id]),
    ).toHaveLength(2);
    expect(await rows(ctx, 'SELECT 1 FROM exercises WHERE unit_id = $1', [unit.id])).toHaveLength(
      3,
    );
    expect(edited.body.items[0].id).toBe(unit.items[0].id);

    // Bản ghi học và lịch ôn liên quan vẫn còn, hợp lệ (khóa ngoại nguyên vẹn).
    expect(
      await rows(ctx, 'SELECT * FROM study_records WHERE user_id = $1', [learner.userId]),
    ).toEqual(recordsBefore);
    expect(
      await rows(ctx, 'SELECT * FROM review_schedules WHERE user_id = $1', [learner.userId]),
    ).toEqual(schedulesBefore);

    // Phiên đang học giữ nguyên snapshot (vẫn 3 bài tập, gồm bài đã bị gỡ khỏi nội dung).
    const resumed = await startSession(api, learner, unit.id);
    expect(resumed.id).toBe(session.id);
    expect(resumed.exercises.map((e: any) => e.id)).toEqual(
      session.exercises.map((e: any) => e.id),
    );

    // Phiên mới (sau TTL) chỉ chứa phần tử còn hoạt động.
    ctx.clock.advanceMs(61_000);
    const fresh = await startSession(api, learner2, unit.id);
    expect(fresh.exercises).toHaveLength(2);
    const freshExerciseIds = fresh.exercises.map((e: any) => e.id);
    expect(freshExerciseIds).not.toContain(edited.body.exercises[2].id);

    // Mục bị gỡ không vào gói ôn: lịch ôn của nó (nếu có) vẫn còn nhưng mục ở trạng thái inactive.
    const [removed] = await rows(ctx, 'SELECT status FROM content_items WHERE id = $1', [
      removedItem,
    ]);
    expect(removed.status).toBe('inactive');
  });

  it('đưa phần tử đã gỡ trở lại bằng id thì kích hoạt lại, không tạo bản sao', async () => {
    const unit = await createActiveUnit();
    const trimmed = await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: { ...unit, items: [unit.items[0]], exercises: [unit.exercises[0], unit.exercises[2]] },
    });
    const restored = await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...trimmed.body,
        items: trimmed.body.items.map((i: any) => ({ ...i, status: 'active' })),
        exercises: trimmed.body.exercises.map((e: any) => ({ ...e, status: 'active' })),
      },
    });
    expect(restored.status).toBe(200);
    expect(restored.body.items.map((i: any) => i.status)).toEqual(['active', 'active']);
    expect(restored.body.exercises).toHaveLength(3);
    expect(
      await rows(ctx, 'SELECT 1 FROM content_items WHERE unit_id = $1', [unit.id]),
    ).toHaveLength(2);
  });

  it('vắng mặt `items`/`exercises` nghĩa là giữ nguyên, khác với danh sách rỗng', async () => {
    const unit = await createActiveUnit();
    const { items, exercises, ...scalars } = unit;
    const renamed = await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: { ...scalars, sequence: -99999 },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.items).toHaveLength(items.length);
    expect(renamed.body.items.every((i: any) => i.status === 'active')).toBe(true);
    expect(renamed.body.exercises).toHaveLength(exercises.length);
    expect(renamed.body.sequence).toBe(-99999);
  });
});

describe('bộ câu hỏi kiểm tra trình độ (FR-007)', () => {
  const question = (topicId: string, overrides: Record<string, unknown> = {}) => ({
    level: 'N5',
    skill: 'vocabulary',
    topicId,
    prompt: '「先生」の意味は？',
    choices: ['giáo viên', 'học sinh', 'bác sĩ', 'nhân viên'],
    correctChoice: 0,
    ...overrides,
  });
  const activeIds = async () =>
    (
      await rows<{ id: string }>(
        ctx,
        'SELECT id FROM placement_questions WHERE is_active ORDER BY position',
      )
    ).map((r) => r.id);

  it('số câu theo trình độ sai → 422 PLACEMENT_SET_INVALID và bộ hiện hành không đổi', async () => {
    const before = await activeIds();
    const extra = await api.post('/admin/placement-questions', {
      ...auth(),
      body: question(vocabTopic),
    });
    const [removedN4] = await rows<{ id: string }>(
      ctx,
      "SELECT id FROM placement_questions WHERE is_active AND level = 'N4' LIMIT 1",
    );
    // Thay một câu N4 bằng câu N5 → 9 N5, 5 N4, 6 N3.
    const wrong = before.map((id) => (id === removedN4!.id ? extra.body.id : id));
    const res = await api.put('/admin/placement-questions/active-set', {
      ...auth(),
      body: { questionIds: wrong },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PLACEMENT_SET_INVALID');
    expect(res.body.fields).toMatchObject({ N5: expect.any(String), N4: expect.any(String) });
    expect(await activeIds()).toEqual(before);

    const duplicated = await api.put('/admin/placement-questions/active-set', {
      ...auth(),
      body: { questionIds: [...before.slice(0, 19), before[0]] },
    });
    expect(duplicated.status).toBe(422);
    expect(await activeIds()).toEqual(before);
  });

  it('kích hoạt bộ hợp lệ thay thế nguyên tử; thứ tự mảng = position; học viên thấy bộ mới', async () => {
    const before = await activeIds();
    const [n5] = await rows<{ id: string }>(
      ctx,
      "SELECT id FROM placement_questions WHERE is_active AND level = 'N5' LIMIT 1",
    );
    const replacement = await api.post('/admin/placement-questions', {
      ...auth(),
      body: question(vocabTopic, { prompt: '「学校」の意味は？' }),
    });
    const next = before.map((id) => (id === n5!.id ? replacement.body.id : id)).reverse();
    const res = await api.put('/admin/placement-questions/active-set', {
      ...auth(),
      body: { questionIds: next },
    });
    expect(res.status).toBe(204);
    expect(await activeIds()).toEqual(next);
    const [old] = await rows(ctx, 'SELECT is_active FROM placement_questions WHERE id = $1', [
      n5!.id,
    ]);
    expect(old.is_active).toBe(false);

    const learner = await registerUser(api);
    const questions = await api.get('/placement/questions', { token: learner.accessToken });
    expect(questions.body.questions.map((q: any) => q.id)).toEqual(next);
    expect(JSON.stringify(questions.body)).not.toContain('correctChoice');
  });

  it('hai lần kích hoạt đồng thời không bao giờ để lại hơn 20 câu hoạt động', async () => {
    const all = await rows<{ id: string; level: string }>(
      ctx,
      'SELECT id, level FROM placement_questions',
    );
    const take = (level: string, n: number, offset: number) =>
      all
        .filter((q) => q.level === level)
        .slice(offset, offset + n)
        .map((q) => q.id);
    const setA = [...take('N5', 8, 0), ...take('N4', 6, 0), ...take('N3', 6, 0)];
    const setB = [...take('N5', 8, 0), ...take('N4', 6, 0), ...take('N3', 6, 0)].reverse();
    const results = await Promise.all([
      api.put('/admin/placement-questions/active-set', { ...auth(), body: { questionIds: setA } }),
      api.put('/admin/placement-questions/active-set', { ...auth(), body: { questionIds: setB } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([204, 204]);
    const active = await activeIds();
    expect(active).toHaveLength(20);
    expect(new Set(active).size).toBe(20);
  });

  it('câu đang thuộc bộ hiện hành: sửa nội dung được, đổi trình độ hay trùng position thì bị từ chối', async () => {
    const [q] = await rows<any>(
      ctx,
      "SELECT * FROM placement_questions WHERE is_active AND level = 'N5' ORDER BY position LIMIT 1",
    );
    const [other] = await rows<any>(
      ctx,
      'SELECT position FROM placement_questions WHERE is_active AND id <> $1 ORDER BY position LIMIT 1',
      [q.id],
    );
    const base = {
      level: q.level,
      skill: q.skill,
      topicId: q.topic_id,
      prompt: q.prompt.ja,
      choices: q.choices,
      correctChoice: q.correct_choice,
      position: q.position,
    };
    const edited = await api.put(`/admin/placement-questions/${q.id}`, {
      ...auth(),
      body: { ...base, prompt: 'Đã sửa nội dung' },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.isActive).toBe(true);

    const level = await api.put(`/admin/placement-questions/${q.id}`, {
      ...auth(),
      body: { ...base, level: 'N4' },
    });
    expect(level.status).toBe(422);
    expect(level.body.code).toBe('PLACEMENT_SET_INVALID');

    const position = await api.put(`/admin/placement-questions/${q.id}`, {
      ...auth(),
      body: { ...base, position: other.position },
    });
    expect(position.status).toBe(422);
    expect(position.body.fields.position).toBeTruthy();
  });
});

describe('vô hiệu hóa tài khoản (FR-031)', () => {
  it('đăng nhập và refresh trả 403 ACCOUNT_DISABLED; kích hoạt lại thì đăng nhập được', async () => {
    const learner = await registerUser(api);
    const [{ id: userId }] = await rows(ctx, 'SELECT id FROM users WHERE email = $1', [
      learner.email,
    ]);

    const off = await api.put(`/admin/users/${userId}/status`, {
      ...auth(),
      body: { status: 'disabled' },
    });
    expect(off.status).toBe(204);

    // Mọi refresh token bị thu hồi trong cùng giao dịch.
    expect(
      await rows(ctx, 'SELECT 1 FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
      ]),
    ).toHaveLength(0);

    const login = await api.post('/auth/login', {
      body: { email: learner.email, password: learner.password },
    });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('ACCOUNT_DISABLED');

    const refresh = await api.post('/auth/refresh', {
      body: { refreshToken: learner.refreshToken },
    });
    expect(refresh.status).toBe(403);
    expect(refresh.body.code).toBe('ACCOUNT_DISABLED');

    const on = await api.put(`/admin/users/${userId}/status`, {
      ...auth(),
      body: { status: 'active' },
    });
    expect(on.status).toBe(204);
    const again = await api.post('/auth/login', {
      body: { email: learner.email, password: learner.password },
    });
    expect(again.status).toBe(200);
  });

  it('access token cấp trước đó còn dùng được tối đa 15 phút rồi hết hạn (R4)', async () => {
    const learner = await onboardedLearner(api, ctx);
    await api.put(`/admin/users/${learner.userId}/status`, {
      ...auth(),
      body: { status: 'disabled' },
    });
    expect((await api.get('/me', { token: learner.token })).status).toBe(200);
    ctx.clock.advanceMinutes(16);
    expect((await api.get('/me', { token: learner.token, validateResponse: false })).status).toBe(
      401,
    );
    // Token của admin cũng hết hạn theo đồng hồ giả: đăng nhập lại cho các kiểm thử sau.
    admin = await adminSession(api, ctx);
  });

  it('gọi lại với trạng thái hiện có là idempotent và không ghi nhật ký thừa', async () => {
    const learner = await registerUser(api);
    const [{ id: userId }] = await rows(ctx, 'SELECT id FROM users WHERE email = $1', [
      learner.email,
    ]);
    await api.put(`/admin/users/${userId}/status`, { ...auth(), body: { status: 'disabled' } });
    await api.put(`/admin/users/${userId}/status`, { ...auth(), body: { status: 'disabled' } });
    expect(await logsFor(userId)).toHaveLength(1);
  });

  it('tài khoản đang chờ xóa không đổi được trạng thái bởi admin', async () => {
    const learner = await registerUser(api);
    const [{ id: userId }] = await rows(ctx, 'SELECT id FROM users WHERE email = $1', [
      learner.email,
    ]);
    await ctx.handle.pool.query(
      "UPDATE users SET status = 'pending_deletion', deletion_requested_at = now() WHERE id = $1",
      [userId],
    );
    const res = await api.put(`/admin/users/${userId}/status`, {
      ...auth(),
      body: { status: 'disabled' },
    });
    expect(res.status).toBe(422);
  });
});

describe('nhật ký hành động quản trị (FR-032)', () => {
  it('mỗi thay đổi ghi ai, khi nào và diff; diff không chứa thông tin nhạy cảm', async () => {
    const unit = await createActiveUnit();
    await api.put(`/admin/units/${unit.id}`, {
      ...auth(),
      body: {
        ...unit,
        title: { vi: 'Tiêu đề đã sửa', en: 'Edited title' },
        items: [unit.items[0]],
        exercises: [unit.exercises[0], unit.exercises[2]],
      },
    });
    await api.put(`/admin/units/${unit.id}/status`, { ...auth(), body: { isTrial: true } });
    await api.put(`/admin/units/${unit.id}/status`, { ...auth(), body: { status: 'inactive' } });

    const logs = await logsFor(unit.id);
    expect(logs.map((l) => l.action)).toEqual([
      'unit.create',
      'unit.set_status',
      'unit.update',
      'unit.set_trial',
      'unit.set_status',
    ]);
    for (const log of logs) {
      expect(log.actor_id).toBe(admin.userId);
      expect(log.target_type).toBe('unit');
      expect(log.occurred_at).toBeInstanceOf(Date);
    }
    const update = logs[2]!;
    expect(update.diff.fields.title).toEqual({
      from: unit.title,
      to: { vi: 'Tiêu đề đã sửa', en: 'Edited title' },
    });
    expect(update.diff.items.deactivated).toHaveLength(1);
    expect(update.diff.exercises.deactivated).toHaveLength(1);
    expect(logs[1]!.diff.status).toEqual({ from: 'draft', to: 'active' });

    // Tài khoản: chỉ ghi trạng thái, không ghi email/mật khẩu/token.
    const learner = await registerUser(api);
    const [{ id: userId }] = await rows(ctx, 'SELECT id FROM users WHERE email = $1', [
      learner.email,
    ]);
    await api.put(`/admin/users/${userId}/status`, { ...auth(), body: { status: 'disabled' } });
    const [userLog] = await logsFor(userId);
    expect(userLog.action).toBe('user.disable');
    const serialized = JSON.stringify(userLog.diff);
    expect(serialized).not.toContain(learner.email);
    expect(serialized).not.toMatch(/password|token|hash/i);
    expect(userLog.diff).toEqual({ status: { from: 'active', to: 'disabled' } });

    // API nhật ký trả đúng các dòng đó.
    const res = await api.get('/admin/action-logs', auth());
    expect(res.status).toBe(200);
    expect(res.body.some((l: any) => l.id === userLog.id && l.actorId === admin.userId)).toBe(true);
  });

  it('thao tác với bộ câu hỏi được ghi, tạo/sửa câu có diff trước/sau', async () => {
    const created = await api.post('/admin/placement-questions', {
      ...auth(),
      body: {
        level: 'N4',
        skill: 'vocabulary',
        topicId: await topicIdFor(ctx, 'vocabulary', 'N4').catch(() => vocabTopic),
        prompt: '「会議」の意味は？',
        choices: ['cuộc họp', 'bữa tiệc'],
        correctChoice: 0,
      },
    });
    expect(created.status).toBe(201);
    await api.put(`/admin/placement-questions/${created.body.id}`, {
      ...auth(),
      body: {
        level: 'N4',
        skill: 'vocabulary',
        topicId: created.body.topicId,
        prompt: '「会議」の意味は？',
        choices: ['cuộc họp', 'bữa tiệc'],
        correctChoice: 1,
      },
    });
    const logs = await logsFor(created.body.id);
    expect(logs.map((l) => l.action)).toEqual([
      'placement_question.create',
      'placement_question.update',
    ]);
    expect(logs[1]!.diff.fields.correctChoice).toEqual({ from: 0, to: 1 });
  });

  it('phiên học đang diễn ra không bị đổi khi admin vô hiệu hóa đơn vị', async () => {
    const unit = await createActiveUnit();
    const learner = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });
    const session = await startSession(api, learner, unit.id);
    await api.put(`/admin/units/${unit.id}/status`, { ...auth(), body: { status: 'inactive' } });
    ctx.clock.advanceMs(61_000);

    // Đơn vị đã tắt thì không bắt đầu phiên mới được, nhưng phiên đã mở vẫn học và hoàn thành bình thường
    // bằng snapshot của chính nó.
    const newcomer = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });
    const fresh = await api.post('/sessions', {
      token: newcomer.token,
      body: { planItemId: unit.id },
      validateResponse: false,
    });
    expect(fresh.status).toBe(404);

    for (const exercise of session.exercises) {
      const res = await submit(api, ctx, learner, session.id, exercise.id, { correct: true });
      expect(res.status).toBe(200);
    }
    const done = await api.post(`/sessions/${session.id}/complete`, { token: learner.token });
    expect(done.status).toBe(200);
  });
});

describe('không rò rỉ giữa người dùng', () => {
  it('id không tồn tại cho 404 gọn, không lộ dữ liệu', async () => {
    const res = await api.get(`/admin/units/${randomUUID()}`, auth());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
  });
});
