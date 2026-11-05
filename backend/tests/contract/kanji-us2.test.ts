/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  getToday,
  kanjiLearner,
  onboardedLearner,
  query,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US2 Kanji (T042): PATCH /me.skills, PlanItem.kind và DailyPlan.kanjiNotice khớp
// OpenAPI 1.11.0 (mọi request/response được đối chiếu hợp đồng).

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

const patchMe = (learner: Learner, body: Record<string, unknown>, validateRequest = true) =>
  api.patch('/me', { token: learner.token, body, validateRequest });

describe('PATCH /me – skills (ProfileUpdate)', () => {
  it('200: thêm rồi bỏ Kanji; hồ sơ trả về skills mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const added = await patchMe(learner, { skills: ['vocabulary', 'grammar', 'kanji'] });
    expect(added.status).toBe(200);
    expect(added.body.profile.skills).toEqual(['vocabulary', 'grammar', 'kanji']);

    const removed = await patchMe(learner, { skills: ['vocabulary', 'grammar'] });
    expect(removed.status).toBe(200);
    expect(removed.body.profile.skills).toEqual(['vocabulary', 'grammar']);
  });

  it('chỉ Kanji cũng hợp lệ (tập con không rỗng của kỹ năng)', async () => {
    const learner = await onboardedLearner(api, ctx);
    const res = await patchMe(learner, { skills: ['kanji'] });
    expect(res.status).toBe(200);
    expect(res.body.profile.skills).toEqual(['kanji']);
  });

  it('422 VALIDATION_FAILED với fields.skills khi rỗng', async () => {
    const learner = await onboardedLearner(api, ctx);
    const res = await patchMe(learner, { skills: [] }, false);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.fields.skills).toBeTruthy();
  });

  it('422 với listening/reading (chưa có trong phiên bản này)', async () => {
    const learner = await onboardedLearner(api, ctx);
    for (const skill of ['listening', 'reading']) {
      const res = await patchMe(learner, { skills: ['vocabulary', skill] }, false);
      expect(res.status, skill).toBe(422);
      expect(res.body.fields.skills, skill).toContain('chưa có trong phiên bản');
    }
  });

  it('422 khi chưa hoàn tất onboarding', async () => {
    const { registerUser } = await import('./client.js');
    const user = await registerUser(api);
    const res = await api.patch('/me', {
      token: user.accessToken,
      body: { skills: ['vocabulary', 'kanji'] },
    });
    expect(res.status).toBe(422);
    expect(res.body.fields.skills).toBeTruthy();
  });

  it('422 khi prioritizedSkill gửi kèm không thuộc skills mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const res = await patchMe(learner, {
      skills: ['vocabulary', 'grammar'],
      prioritizedSkill: 'kanji',
    });
    expect(res.status).toBe(422);
    expect(res.body.fields.prioritizedSkill).toBeTruthy();
  });
});

describe('GET /today – PlanItem.kind và kanjiNotice', () => {
  it('mục bài mới có kind (Skill), mục ôn kind = null; có bài Kanji cho người đã chọn Kanji', async () => {
    const learner = await kanjiLearner(api, ctx);
    const plan = await getToday(api, learner);
    const newUnits = plan.items.filter((i: any) => i.type === 'new_unit');
    expect(newUnits.length).toBeGreaterThan(0);
    for (const item of newUnits) expect(['vocabulary', 'grammar', 'kanji']).toContain(item.kind);
    expect(newUnits.some((i: any) => i.kind === 'kanji')).toBe(true);
    for (const item of plan.items.filter((i: any) => i.type === 'review_batch')) {
      expect(item.kind).toBeNull();
    }
    expect(plan).not.toHaveProperty('kanjiNotice');
  });

  it('người không chọn Kanji: không có kanjiNotice và không có PlanItem.kind = kanji', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    expect(plan).not.toHaveProperty('kanjiNotice');
    expect(plan.items.some((i: any) => i.kind === 'kanji')).toBe(false);
  });

  it('hết bài Kanji N5 → kanjiNotice = { kanji_exhausted, raise_level } và kế hoạch vẫn có bài', async () => {
    const learner = await kanjiLearner(api, ctx, {
      currentLevel: 'N5',
      goalType: 'jlpt',
      targetLevel: 'N5',
    });
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status)
       SELECT $1, id, 'completed' FROM learning_units WHERE kind = 'kanji' AND level = 'N5'`,
      [learner.userId],
    );
    // Kế hoạch hôm nay đã được sinh khi onboarding: xóa để sinh lại sau khi đã học hết Kanji N5.
    await query(ctx, 'DELETE FROM daily_plans WHERE user_id = $1', [learner.userId]);
    const plan = await getToday(api, learner);
    expect(plan.kanjiNotice).toEqual({ code: 'kanji_exhausted', suggestion: 'raise_level' });
    expect(plan.items.length).toBeGreaterThan(0);
    expect(plan.items.some((i: any) => i.kind === 'kanji')).toBe(false);
  });

  it('đã hết toàn bộ Kanji trong thư viện → suggestion = content_exhausted', async () => {
    const learner = await kanjiLearner(api, ctx, { currentLevel: 'N3' });
    await query(
      ctx,
      `INSERT INTO unit_progress (user_id, unit_id, status)
       SELECT $1, id, 'completed' FROM learning_units WHERE kind = 'kanji'`,
      [learner.userId],
    );
    const plan = await getToday(api, learner);
    expect(plan.kanjiNotice).toEqual({ code: 'kanji_exhausted', suggestion: 'content_exhausted' });
  });

  it('POST /today/extra trả đơn vị có kind (kể cả Kanji khi chỉ chọn Kanji)', async () => {
    const learner = await kanjiLearner(api, ctx, { skills: ['kanji'] });
    const res = await api.post('/today/extra', { token: learner.token });
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('kanji');
    expect(res.body.type).toBe('new_unit');
  });
});
