/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { onboardedLearner, type Learner } from '../integration/lesson-helpers.js';
import { ContractClient, registerUser } from './client.js';

// Kiểm thử hợp đồng US5 (T089): `/path/rebuild`, `/path/pause`, `/path/resume`, `/path/units/{unitId}/master`
// (trả `MasterResult` khớp schema) và hệ quả của `PATCH /me` lên lộ trình. Mọi request/response được
// ContractClient đối chiếu `contracts/openapi.yaml`.

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

const pathOf = async (learner: Learner) => {
  const res = await api.get('/path', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body;
};

describe('POST /path/rebuild', () => {
  it('200 PathSummary mới với reason=rebuild_request; lộ trình cũ không còn hoạt động', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    expect(before.reason).toBe('onboarding');

    const { status, body } = await api.post('/path/rebuild', { token: learner.token });
    expect(status).toBe(200);
    expect(body.reason).toBe('rebuild_request');
    expect(body.id).not.toBe(before.id);
    expect((await pathOf(learner)).id).toBe(body.id);
  });

  it('404 khi chưa hoàn tất onboarding; 404 khi kết quả kiểm tra không tồn tại; 422 khi id sai định dạng', async () => {
    const fresh = await registerUser(api);
    expect((await api.post('/path/rebuild', { token: fresh.accessToken })).status).toBe(404);

    const learner = await onboardedLearner(api, ctx);
    const missing = await api.post('/path/rebuild', {
      token: learner.token,
      body: { usePlacementResultId: randomUUID() },
    });
    expect(missing.status).toBe(404);

    const bad = await api.post('/path/rebuild', {
      token: learner.token,
      body: { usePlacementResultId: 'khong-phai-uuid' },
      validateRequest: false,
    });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.usePlacementResultId).toBeTruthy();
  });
});

describe('POST /path/pause và /path/resume', () => {
  it('204 khi tạm dừng và tiếp tục; gọi lặp lại không lỗi; hồ sơ phản ánh trạng thái', async () => {
    const learner = await onboardedLearner(api, ctx);
    const paused = () =>
      api.get('/me', { token: learner.token }).then((r) => r.body.profile.paused);

    expect((await api.post('/path/pause', { token: learner.token })).status).toBe(204);
    expect(await paused()).toBe(true);
    expect((await api.post('/path/pause', { token: learner.token })).status).toBe(204);
    expect(await paused()).toBe(true);

    expect((await api.post('/path/resume', { token: learner.token })).status).toBe(204);
    expect(await paused()).toBe(false);
    expect((await api.post('/path/resume', { token: learner.token })).status).toBe(204);
    expect(await paused()).toBe(false);
  });

  it('khi đang tạm dừng GET /today trả 409 PATH_PAUSED', async () => {
    const learner = await onboardedLearner(api, ctx);
    await api.post('/path/pause', { token: learner.token });
    const today = await api.get('/today', { token: learner.token, validateResponse: false });
    expect(today.status).toBe(409);
    expect(today.body.code).toBe('PATH_PAUSED');
  });

  it('404 khi chưa hoàn tất onboarding; 401 khi thiếu token', async () => {
    const fresh = await registerUser(api);
    expect((await api.post('/path/pause', { token: fresh.accessToken })).status).toBe(404);
    expect((await api.post('/path/resume', { token: fresh.accessToken })).status).toBe(404);
    expect((await api.post('/path/pause', { validateResponse: false })).status).toBe(401);
    expect((await api.post('/path/resume', { validateResponse: false })).status).toBe(401);
  });
});

describe('PUT /path/units/{unitId}/master', () => {
  it('200 MasterResult khớp schema; đánh dấu rồi bỏ đánh dấu trả lại trạng thái cũ', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = (await pathOf(learner)).items as any[];
    const unitId = items[0].unitId;

    const marked = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(marked.status).toBe(200);
    expect(marked.body.remainingUnits).toBe(items.length - 1);
    expect(marked.body).not.toHaveProperty('suggestion');
    expect(((await pathOf(learner)).items as any[]).find((i) => i.unitId === unitId).status).toBe(
      'mastered',
    );

    const unmarked = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: false },
    });
    expect(unmarked.status).toBe(200);
    expect(unmarked.body.remainingUnits).toBe(items.length);
    expect(((await pathOf(learner)).items as any[]).find((i) => i.unitId === unitId).status).toBe(
      'pending',
    );
  });

  it('đơn vị cuối cùng còn lại → remainingUnits=0 kèm suggestion hợp lệ', async () => {
    const learner = await onboardedLearner(api, ctx);
    const items = (await pathOf(learner)).items as any[];
    let last: any;
    for (const item of items) {
      last = await api.put(`/path/units/${item.unitId}/master`, {
        token: learner.token,
        body: { mastered: true },
      });
      expect(last.status).toBe(200);
    }
    expect(last.body.remainingUnits).toBe(0);
    expect(['raise_level', 'content_exhausted']).toContain(last.body.suggestion);
  });

  it('404 cho đơn vị không tồn tại hoặc người học chưa onboarding; 422 khi thân hoặc id sai', async () => {
    const learner = await onboardedLearner(api, ctx);
    const unknown = await api.put(`/path/units/${randomUUID()}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(unknown.status).toBe(404);

    const fresh = await registerUser(api);
    const early = await api.put(`/path/units/${randomUUID()}/master`, {
      token: fresh.accessToken,
      body: { mastered: true },
    });
    expect(early.status).toBe(404);

    const unitId = ((await pathOf(learner)).items as any[])[0].unitId;
    const badBody = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: 'có' },
      validateRequest: false,
    });
    expect(badBody.status).toBe(422);
    expect(badBody.body.fields.mastered).toBeTruthy();

    const badId = await api.put('/path/units/khong-phai-uuid/master', {
      token: learner.token,
      body: { mastered: true },
      validateRequest: false,
    });
    expect(badId.status).toBe(422);
    expect(badId.body.fields.unitId).toBeTruthy();
  });

  it('401 khi thiếu token', async () => {
    const res = await api.put(`/path/units/${randomUUID()}/master`, {
      body: { mastered: true },
      validateResponse: false,
    });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /me – hệ quả lên lộ trình', () => {
  it('đổi mục tiêu sinh lộ trình mới reason=goal_change', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    const res = await api.patch('/me', {
      token: learner.token,
      body: { goalType: 'jlpt', targetLevel: 'N5' },
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ goalType: 'jlpt', targetLevel: 'N5' });

    const after = await pathOf(learner);
    expect(after.id).not.toBe(before.id);
    expect(after.reason).toBe('goal_change');
  });

  it('đổi currentLevel sinh lộ trình mới reason=level_change', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    const res = await api.patch('/me', { token: learner.token, body: { currentLevel: 'N5' } });
    expect(res.status).toBe(200);
    expect(res.body.profile.currentLevel).toBe('N5');

    const after = await pathOf(learner);
    expect(after.id).not.toBe(before.id);
    expect(after.reason).toBe('level_change');
  });

  it('đổi thời gian mỗi ngày KHÔNG sinh lộ trình mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    const res = await api.patch('/me', { token: learner.token, body: { dailyMinutes: 15 } });
    expect(res.status).toBe(200);
    expect(res.body.profile.dailyMinutes).toBe(15);
    expect((await pathOf(learner)).id).toBe(before.id);
  });

  it('đặt prioritizedSkill ảnh hưởng thứ tự đơn vị kế tiếp mà không sinh lộ trình mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    expect(before.items[0].kind).toBe('vocabulary');

    const grammar = await api.patch('/me', {
      token: learner.token,
      body: { prioritizedSkill: 'grammar' },
    });
    expect(grammar.status).toBe(200);
    expect(grammar.body.profile.prioritizedSkill).toBe('grammar');
    const after = await pathOf(learner);
    expect(after.id).toBe(before.id);
    expect(after.items[0].kind).toBe('grammar');

    // Bỏ ưu tiên (null) trả lại thứ tự mặc định.
    const cleared = await api.patch('/me', {
      token: learner.token,
      body: { prioritizedSkill: null },
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.profile).not.toHaveProperty('prioritizedSkill');
    expect((await pathOf(learner)).items[0].kind).toBe('vocabulary');
  });

  it('gửi lại đúng giá trị hiện tại không sinh lộ trình mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await pathOf(learner);
    const res = await api.patch('/me', {
      token: learner.token,
      body: { goalType: 'daily_conversation', currentLevel: 'none' },
    });
    expect(res.status).toBe(200);
    expect((await pathOf(learner)).id).toBe(before.id);
  });

  it('422 khi mục tiêu JLPT thiếu cấp độ, mốc ở quá khứ hoặc kỹ năng ưu tiên ngoài kỹ năng đã chọn', async () => {
    const learner = await onboardedLearner(api, ctx, { skills: ['vocabulary'] });

    const noLevel = await api.patch('/me', { token: learner.token, body: { goalType: 'jlpt' } });
    expect(noLevel.status).toBe(422);
    expect(noLevel.body.fields.targetLevel).toBeTruthy();

    const past = await api.patch('/me', {
      token: learner.token,
      body: { targetDate: '2025-12-31' },
    });
    expect(past.status).toBe(422);
    expect(past.body.fields.targetDate).toBeTruthy();

    const skill = await api.patch('/me', {
      token: learner.token,
      body: { prioritizedSkill: 'grammar' },
    });
    expect(skill.status).toBe(422);
    expect(skill.body.fields.prioritizedSkill).toBeTruthy();
  });
});
