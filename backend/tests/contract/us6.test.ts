/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import {
  adminSession,
  rows,
  topicIdFor,
  vocabUnitPayload,
  type AdminSession,
} from '../integration/admin-helpers.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US6 (T102): mọi `/admin/*`. Request/response được ContractClient đối chiếu
// `contracts/openapi.yaml`; mã 401 không được khai báo ở từng route admin nên tắt đối chiếu response khi thử 401.

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

const asAdmin = {
  get token() {
    return admin.token;
  },
};

describe('phân quyền /admin/*', () => {
  const anyId = randomUUID();
  const routes: [string, string][] = [
    ['get', '/admin/topics'],
    ['get', '/admin/units'],
    ['post', '/admin/units'],
    ['get', `/admin/units/${anyId}`],
    ['put', `/admin/units/${anyId}`],
    ['put', `/admin/units/${anyId}/status`],
    ['get', '/admin/placement-questions'],
    ['post', '/admin/placement-questions'],
    ['put', `/admin/placement-questions/${anyId}`],
    ['put', '/admin/placement-questions/active-set'],
    ['get', '/admin/users'],
    ['put', `/admin/users/${anyId}/status`],
    ['get', '/admin/action-logs'],
  ];

  it('403 cho người học thường và 401 khi thiếu token ở mọi route', async () => {
    const learner = await registerUser(api);
    for (const [method, url] of routes) {
      const forbidden = await api.call(method, url, {
        token: learner.accessToken,
        body: method === 'get' ? undefined : {},
        validateRequest: false,
      });
      expect(forbidden.status, `${method} ${url}`).toBe(403);
      expect(forbidden.body.code).toBe('FORBIDDEN');

      const anonymous = await api.call(method, url, {
        body: method === 'get' ? undefined : {},
        validateRequest: false,
        validateResponse: false,
      });
      expect(anonymous.status, `${method} ${url}`).toBe(401);
    }
  });
});

describe('/admin/topics', () => {
  it('GET 200 liệt kê mảng nội dung kèm tên song ngữ để chọn topicId', async () => {
    const res = await api.get('/admin/topics', { ...asAdmin });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((t: any) => t.id === vocabTopic && t.skill === 'vocabulary')).toBe(true);
    expect(res.body.every((t: any) => t.name.vi && t.name.en)).toBe(true);
  });
});

describe('/admin/units', () => {
  it('POST 201 tạo bản nháp kèm mục và bài tập; GET chi tiết khớp AdminUnit', async () => {
    const created = await api.post('/admin/units', {
      ...asAdmin,
      body: vocabUnitPayload(vocabTopic),
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.isTrial).toBe(false);
    expect(created.body.items).toHaveLength(2);
    expect(created.body.exercises).toHaveLength(3);
    // itemIndex được trả lại đối xứng với khi ghi.
    expect(created.body.exercises.map((e: any) => e.itemIndex)).toEqual([0, 1, 0]);

    const detail = await api.get(`/admin/units/${created.body.id}`, { ...asAdmin });
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(created.body);
  });

  it('GET danh sách lọc theo trạng thái/trình độ/loại và không kèm items/exercises', async () => {
    const all = await api.get('/admin/units', { ...asAdmin });
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThanOrEqual(7);
    expect(all.body[0].items).toBeUndefined();

    const drafts = await api.get('/admin/units?status=draft', { ...asAdmin });
    expect(drafts.body.every((u: any) => u.status === 'draft')).toBe(true);
    expect(drafts.body.length).toBeGreaterThanOrEqual(1);

    const grammar = await api.get('/admin/units?kind=grammar&level=N5&status=active', {
      ...asAdmin,
    });
    expect(grammar.body.every((u: any) => u.kind === 'grammar' && u.level === 'N5')).toBe(true);
  });

  it('422 khi tham số lọc sai; 404 khi đơn vị không tồn tại', async () => {
    const bad = await api.get('/admin/units?status=bogus', { ...asAdmin });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.status).toBeTruthy();

    expect((await api.get(`/admin/units/${randomUUID()}`, { ...asAdmin })).status).toBe(404);
    expect(
      (
        await api.put(`/admin/units/${randomUUID()}`, {
          ...asAdmin,
          body: vocabUnitPayload(vocabTopic),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api.put(`/admin/units/${randomUUID()}/status`, {
          ...asAdmin,
          body: { status: 'active' },
        })
      ).status,
    ).toBe(404);
  });

  it('POST 422 nêu từng trường sai: estMinutes, tier foundation ở level N4, itemIndex ngoài khoảng, mảng không khớp', async () => {
    const post = (overrides: Record<string, unknown>) =>
      api.post('/admin/units', {
        ...asAdmin,
        body: vocabUnitPayload(vocabTopic, overrides),
        validateRequest: false,
      });

    const minutes = await post({ estMinutes: 7 });
    expect(minutes.status).toBe(422);
    expect(minutes.body.code).toBe('VALIDATION_FAILED');
    expect(minutes.body.fields.estMinutes).toContain('5, 10, 15');

    const tier = await post({ level: 'N4', tier: 'foundation' });
    expect(tier.status).toBe(422);
    expect(tier.body.fields.tier).toBeTruthy();

    const exercises = vocabUnitPayload(vocabTopic).exercises.map((e) => ({ ...e, itemIndex: 5 }));
    const index = await post({ exercises });
    expect(index.status).toBe(422);
    expect(index.body.fields['exercises.0.itemIndex']).toBeTruthy();

    const wrongTopic = await post({ topicId: await topicIdFor(ctx, 'grammar', 'N5') });
    expect(wrongTopic.status).toBe(422);
    expect(wrongTopic.body.fields.topicId).toBeTruthy();

    const unknownTopic = await post({ topicId: randomUUID() });
    expect(unknownTopic.status).toBe(422);
    expect(unknownTopic.body.fields.topicId).toBeTruthy();
  });

  it('PUT 200 sửa tại chỗ; PUT 422 khi id mục không thuộc đơn vị', async () => {
    const created = await api.post('/admin/units', {
      ...asAdmin,
      body: vocabUnitPayload(vocabTopic),
    });
    const unit = created.body;
    const edited = await api.put(`/admin/units/${unit.id}`, {
      ...asAdmin,
      body: {
        ...unit,
        title: { vi: 'Tiêu đề mới', en: 'New title' },
        // Gỡ mục thứ hai và bài tập gắn với nó: phần tử vắng mặt chuyển inactive.
        items: [unit.items[0]],
        exercises: [unit.exercises[0], unit.exercises[2]],
      },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.title.en).toBe('New title');
    expect(edited.body.items.map((i: any) => i.status)).toEqual(['active', 'inactive']);
    expect(edited.body.exercises.map((e: any) => e.status)).toEqual([
      'active',
      'active',
      'inactive',
    ]);

    const foreign = await api.put(`/admin/units/${unit.id}`, {
      ...asAdmin,
      body: { ...unit, items: [{ ...unit.items[0], id: randomUUID() }], exercises: [] },
      validateRequest: false,
    });
    expect(foreign.status).toBe(422);
    expect(foreign.body.fields['items[0].id']).toBeTruthy();
  });

  it('PUT /status: 200 kích hoạt, 422 liệt kê lỗi nội dung, 422 khi thân rỗng', async () => {
    const incomplete = await api.post('/admin/units', {
      ...asAdmin,
      body: vocabUnitPayload(vocabTopic, { exercises: [] }),
    });
    const rejected = await api.put(`/admin/units/${incomplete.body.id}/status`, {
      ...asAdmin,
      body: { status: 'active' },
    });
    expect(rejected.status).toBe(422);
    expect(rejected.body.fields.exercises).toBeTruthy();

    const complete = await api.post('/admin/units', {
      ...asAdmin,
      body: vocabUnitPayload(vocabTopic),
    });
    const activated = await api.put(`/admin/units/${complete.body.id}/status`, {
      ...asAdmin,
      body: { status: 'active', isTrial: true },
    });
    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({ status: 'active', isTrial: true });

    const empty = await api.put(`/admin/units/${complete.body.id}/status`, {
      ...asAdmin,
      body: {},
    });
    expect(empty.status).toBe(422);
  });
});

describe('/admin/placement-questions', () => {
  const question = (topicId: string, overrides: Record<string, unknown> = {}) => ({
    level: 'N5',
    skill: 'vocabulary',
    topicId,
    prompt: '「試験」の意味は？',
    hint: { vi: 'Chọn nghĩa đúng.', en: 'Choose the right meaning.' },
    choices: ['kỳ thi', 'bài tập', 'bữa ăn', 'cuộc họp'],
    correctChoice: 0,
    position: 0,
    ...overrides,
  });

  it('GET danh sách có bộ hiện hành 20 câu và không trả thêm trường nội bộ', async () => {
    const res = await api.get('/admin/placement-questions', { ...asAdmin });
    expect(res.status).toBe(200);
    expect(res.body.filter((q: any) => q.isActive)).toHaveLength(20);
    expect(res.body[0].correctChoice).toBeTypeOf('number');
  });

  it('POST 201 (chưa kích hoạt) / PUT 200 / 404 / 422', async () => {
    const created = await api.post('/admin/placement-questions', {
      ...asAdmin,
      body: question(vocabTopic),
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      isActive: false,
      hint: { en: 'Choose the right meaning.' },
    });

    const updated = await api.put(`/admin/placement-questions/${created.body.id}`, {
      ...asAdmin,
      body: question(vocabTopic, { prompt: '「宿題」の意味は？', correctChoice: 1, position: 5 }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      prompt: '「宿題」の意味は？',
      correctChoice: 1,
      position: 5,
    });

    expect(
      (
        await api.put(`/admin/placement-questions/${randomUUID()}`, {
          ...asAdmin,
          body: question(vocabTopic),
        })
      ).status,
    ).toBe(404);

    const outOfRange = await api.post('/admin/placement-questions', {
      ...asAdmin,
      body: question(vocabTopic, { correctChoice: 9 }),
    });
    expect(outOfRange.status).toBe(422);
    expect(outOfRange.body.fields.correctChoice).toBeTruthy();

    const duplicated = await api.post('/admin/placement-questions', {
      ...asAdmin,
      body: question(vocabTopic, { choices: ['a', 'a'], correctChoice: 0 }),
    });
    expect(duplicated.status).toBe(422);

    const wrongSkill = await api.post('/admin/placement-questions', {
      ...asAdmin,
      body: question(vocabTopic, { skill: 'grammar' }),
    });
    expect(wrongSkill.status).toBe(422);
    expect(wrongSkill.body.fields.topicId).toBeTruthy();
  });

  it('PUT /active-set: 204 khi hợp lệ; 422 PLACEMENT_SET_INVALID khi sai số lượng/không tồn tại', async () => {
    const current = await rows<{ id: string }>(
      ctx,
      'SELECT id FROM placement_questions WHERE is_active ORDER BY position',
    );
    const ids = current.map((r) => r.id);

    const same = await api.put('/admin/placement-questions/active-set', {
      ...asAdmin,
      body: { questionIds: ids },
    });
    expect(same.status).toBe(204);

    const unknown = await api.put('/admin/placement-questions/active-set', {
      ...asAdmin,
      body: { questionIds: [...ids.slice(0, 19), randomUUID()] },
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body.code).toBe('PLACEMENT_SET_INVALID');

    const short = await api.put('/admin/placement-questions/active-set', {
      ...asAdmin,
      body: { questionIds: ids.slice(0, 19) },
      validateRequest: false,
    });
    expect(short.status).toBe(422);
    expect(short.body.code).toBe('PLACEMENT_SET_INVALID');
  });
});

describe('/admin/users và /admin/action-logs', () => {
  it('GET /admin/users tìm theo email/tên và phân trang theo con trỏ', async () => {
    const a = await registerUser(api);
    await registerUser(api);

    const found = await api.get(`/admin/users?q=${encodeURIComponent(a.email)}`, { ...asAdmin });
    expect(found.status).toBe(200);
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0]).toMatchObject({
      email: a.email,
      role: 'learner',
      status: 'active',
    });
    expect(found.body.nextCursor).toBeNull();

    // Ký tự đại diện của LIKE được hiểu theo nghĩa đen.
    const wildcard = await api.get('/admin/users?q=%25', { ...asAdmin });
    expect(wildcard.body.items).toHaveLength(0);

    const bad = await api.get('/admin/users?cursor=khong-phai-uuid', { ...asAdmin });
    expect(bad.status).toBe(422);
    const missing = await api.get(`/admin/users?cursor=${randomUUID()}`, { ...asAdmin });
    expect(missing.status).toBe(422);
  });

  it('PUT /admin/users/{id}/status: 204, 404, 422 (chính mình, tài khoản admin)', async () => {
    const learner = await registerUser(api);
    const [{ id: learnerId }] = await rows(ctx, 'SELECT id FROM users WHERE email = $1', [
      learner.email,
    ]);

    expect(
      (
        await api.put(`/admin/users/${learnerId}/status`, {
          ...asAdmin,
          body: { status: 'disabled' },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await api.put(`/admin/users/${learnerId}/status`, {
          ...asAdmin,
          body: { status: 'active' },
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await api.put(`/admin/users/${randomUUID()}/status`, {
          ...asAdmin,
          body: { status: 'disabled' },
        })
      ).status,
    ).toBe(404);

    const self = await api.put(`/admin/users/${admin.userId}/status`, {
      ...asAdmin,
      body: { status: 'disabled' },
    });
    expect(self.status).toBe(422);
    expect(self.body.fields.status).toBeTruthy();

    const other = await adminSession(api, ctx);
    const onAdmin = await api.put(`/admin/users/${other.userId}/status`, {
      ...asAdmin,
      body: { status: 'disabled' },
    });
    expect(onAdmin.status).toBe(422);

    const invalid = await api.put(`/admin/users/${learnerId}/status`, {
      ...asAdmin,
      body: { status: 'pending_deletion' },
      validateRequest: false,
    });
    expect(invalid.status).toBe(422);
  });

  it('GET /admin/action-logs trả mảng mới nhất trước, header X-Next-Cursor khi còn trang sau', async () => {
    await ctx.handle.pool.query(
      `INSERT INTO admin_action_logs (actor_id, action, target_type, target_id, diff, occurred_at)
       SELECT $1, 'test.bulk', 'user', gen_random_uuid(), '{"i": 1}'::jsonb, now() + (g || ' seconds')::interval
         FROM generate_series(1, 60) g`,
      [admin.userId],
    );
    const first = await api.get('/admin/action-logs', { ...asAdmin });
    expect(first.status).toBe(200);
    expect(first.body).toHaveLength(50);
    const times = first.body.map((l: any) => Date.parse(l.occurredAt));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    const cursor = first.headers['x-next-cursor'] as string;
    expect(cursor).toBe(first.body[49].id);

    const second = await api.get(`/admin/action-logs?cursor=${cursor}`, { ...asAdmin });
    expect(second.status).toBe(200);
    expect(second.body.length).toBeGreaterThan(0);
    const firstIds = new Set(first.body.map((l: any) => l.id));
    expect(second.body.every((l: any) => !firstIds.has(l.id))).toBe(true);

    expect((await api.get('/admin/action-logs?cursor=xyz', { ...asAdmin })).status).toBe(422);
  });
});
