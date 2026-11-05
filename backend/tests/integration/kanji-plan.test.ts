/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient } from '../contract/client.js';
import {
  advanceDays,
  getToday,
  kanjiLearner,
  onboardedLearner,
  query,
  studyPlanItem,
  type Learner,
} from './lesson-helpers.js';
import { createTestApp, type TestApp } from './helpers.js';

// Kiểm thử tích hợp US2 Kanji (T043) trên PostgreSQL thật: onboarding/đổi kỹ năng, kế hoạch hằng ngày có
// bài Kanji, giữ nguyên dữ liệu học, xây dựng lại lộ trình, đánh dấu thành thạo (quickstart KJ3, KJ4, KJ8).

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

const patchMe = (learner: Learner, body: Record<string, unknown>) =>
  api.patch('/me', { token: learner.token, body });
const counts = async (learner: Learner) => ({
  progress: (
    await query(ctx, 'SELECT count(*)::int AS n FROM unit_progress WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].n,
  schedules: (
    await query(ctx, 'SELECT count(*)::int AS n FROM review_schedules WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].n,
  topics: (
    await query(ctx, 'SELECT count(*)::int AS n FROM topic_stats WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].n,
  records: (
    await query(ctx, 'SELECT count(*)::int AS n FROM study_records WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].n,
  paths: (
    await query(ctx, 'SELECT count(*)::int AS n FROM learning_paths WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].n,
});
const kanjiSelectedAt = async (learner: Learner): Promise<Date | null> =>
  (
    await query(ctx, 'SELECT kanji_selected_at FROM learning_profiles WHERE user_id = $1', [
      learner.userId,
    ])
  )[0].kanji_selected_at;
const unitKinds = async (ids: string[]) =>
  await query<{ kind: string; level: string }>(
    ctx,
    'SELECT kind::text AS kind, level::text AS level FROM learning_units WHERE id = ANY($1::uuid[])',
    [ids],
  );

describe('onboarding với Kanji', () => {
  it('đặt kanji_selected_at; kế hoạch hôm nay có bài Kanji đúng trình độ (US2.1, US2.2)', async () => {
    const learner = await kanjiLearner(api, ctx);
    expect(await kanjiSelectedAt(learner)).toEqual(ctx.clock.now());
    const plan = await getToday(api, learner);
    const kanjiItems = plan.items.filter((i: any) => i.kind === 'kanji');
    expect(kanjiItems.length).toBeGreaterThanOrEqual(1);
    const units = await query<{ level: string; est: number }>(
      ctx,
      `SELECT u.level::text AS level, u.est_minutes AS est FROM daily_plan_items i JOIN learning_units u ON u.id = i.unit_id WHERE i.id = $1`,
      [kanjiItems[0].id],
    );
    expect(units[0]!.level).toBe('N5');
    expect(plan.estimatedMinutes).toBeLessThanOrEqual(plan.budgetMinutes);
    expect(kanjiItems[0].estMinutes).toBeLessThanOrEqual(15);
  });

  it('người không chọn Kanji không có kanji_selected_at', async () => {
    const learner = await onboardedLearner(api, ctx);
    expect(await kanjiSelectedAt(learner)).toBeNull();
  });
});

describe('thêm / bỏ Kanji sau onboarding (US2.4)', () => {
  it('thêm Kanji: kế hoạch hôm nay không đổi, dữ liệu học và lộ trình giữ nguyên, ngày sau có bài Kanji', async () => {
    const learner = await onboardedLearner(api, ctx);
    const plan = await getToday(api, learner);
    await studyPlanItem(api, ctx, learner, plan.items[0].id);
    const before = await counts(learner);
    expect(before.progress).toBeGreaterThan(0);
    expect(before.schedules).toBeGreaterThan(0);

    const res = await patchMe(learner, { skills: ['vocabulary', 'grammar', 'kanji'] });
    expect(res.status).toBe(200);
    expect(await kanjiSelectedAt(learner)).not.toBeNull();
    expect(await counts(learner)).toEqual(before);

    const same = await getToday(api, learner);
    expect(same.items.map((i: any) => i.id)).toEqual(plan.items.map((i: any) => i.id));
    expect(same.items.some((i: any) => i.kind === 'kanji')).toBe(false);

    await advanceDays(api, ctx, learner);
    const tomorrow = await getToday(api, learner);
    expect(tomorrow.items.some((i: any) => i.kind === 'kanji')).toBe(true);
  });

  it('bỏ kỹ năng đang là prioritizedSkill → prioritizedSkill = null trong cùng giao dịch', async () => {
    const learner = await kanjiLearner(api, ctx);
    expect((await patchMe(learner, { prioritizedSkill: 'kanji' })).status).toBe(200);
    const res = await patchMe(learner, { skills: ['vocabulary', 'grammar'] });
    expect(res.status).toBe(200);
    expect(res.body.profile).not.toHaveProperty('prioritizedSkill');
    expect(
      (
        await query(ctx, 'SELECT prioritized_skill FROM learning_profiles WHERE user_id = $1', [
          learner.userId,
        ])
      )[0].prioritized_skill,
    ).toBeNull();
  });

  it('bỏ rồi chọn lại Kanji: kanji_selected_at giữ khi bỏ, đặt lại khi chọn lại', async () => {
    const learner = await kanjiLearner(api, ctx);
    const first = await kanjiSelectedAt(learner);
    ctx.clock.advanceDays(2);
    await advanceDays(api, ctx, learner, 0);
    expect((await patchMe(learner, { skills: ['vocabulary', 'grammar'] })).status).toBe(200);
    expect(await kanjiSelectedAt(learner)).toEqual(first);
    expect((await patchMe(learner, { skills: ['vocabulary', 'grammar', 'kanji'] })).status).toBe(
      200,
    );
    const again = await kanjiSelectedAt(learner);
    expect(again!.getTime()).toBeGreaterThan(first!.getTime());
  });

  it('đổi kỹ năng không sinh lộ trình mới', async () => {
    const learner = await onboardedLearner(api, ctx);
    const before = await counts(learner);
    await patchMe(learner, { skills: ['vocabulary', 'grammar', 'kanji'] });
    await patchMe(learner, { skills: ['grammar'] });
    expect((await counts(learner)).paths).toBe(before.paths);
  });
});

describe('xây dựng lại lộ trình và đánh dấu thành thạo', () => {
  it('POST /path/rebuild (FR-010): lộ trình mới có bài Kanji đúng trình độ, dữ liệu học giữ nguyên', async () => {
    const learner = await kanjiLearner(api, ctx, {
      currentLevel: 'N4',
      goalType: 'jlpt',
      targetLevel: 'N4',
    });
    const plan = await getToday(api, learner);
    await studyPlanItem(api, ctx, learner, plan.items[0].id);
    const before = await counts(learner);

    const rebuilt = await api.post('/path/rebuild', { token: learner.token, body: {} });
    expect(rebuilt.status).toBe(200);
    const after = await counts(learner);
    expect({ ...after, paths: 0 }).toEqual({ ...before, paths: 0 });
    expect(after.paths).toBe(before.paths + 1);

    const path = await api.get('/path', { token: learner.token });
    const kanjiUnits = path.body.items.filter((i: any) => i.kind === 'kanji');
    expect(kanjiUnits.length).toBeGreaterThan(0);
    for (const unit of kanjiUnits) expect(['N4']).toContain(unit.level);
  });

  it('PUT /path/units/{unitId}/master với bài Kanji: rời bài sắp tới, lịch ôn giữ nguyên; bỏ đánh dấu thì quay lại', async () => {
    const learner = await kanjiLearner(api, ctx, { skills: ['kanji'] });
    const extra = await api.post('/today/extra', { token: learner.token });
    expect(extra.status).toBe(200);
    const unitId = extra.body.id as string;
    await studyPlanItem(api, ctx, learner, unitId);
    const before = await counts(learner);
    expect(before.schedules).toBeGreaterThan(0);

    const marked = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: true },
    });
    expect(marked.status).toBe(200);
    const path = await api.get('/path', { token: learner.token });
    expect(path.body.items.find((i: any) => i.unitId === unitId).status).toBe('mastered');
    expect((await counts(learner)).schedules).toBe(before.schedules);
    const next = await api.post('/today/extra', { token: learner.token });
    expect(next.body.id).not.toBe(unitId);

    const unmarked = await api.put(`/path/units/${unitId}/master`, {
      token: learner.token,
      body: { mastered: false },
    });
    expect(unmarked.status).toBe(200);
    const again = await api.get('/path', { token: learner.token });
    expect(again.body.items.find((i: any) => i.unitId === unitId).status).toBe('completed');
  });
});

describe('phạm vi nội dung', () => {
  it('POST /today/extra trả được đơn vị Kanji khi đã chọn Kanji', async () => {
    const learner = await kanjiLearner(api, ctx, { skills: ['kanji'] });
    const extra = await api.post('/today/extra', { token: learner.token });
    expect(extra.status).toBe(200);
    expect(extra.body.kind).toBe('kanji');
  });

  it('trình độ N2 → nội dung Kanji chỉ tới N3, kèm scopeNotice hiện có', async () => {
    const learner = await kanjiLearner(api, ctx, { currentLevel: 'N2' });
    const path = await api.get('/path', { token: learner.token });
    expect(path.body.scopeNotice).toBe('content_ceiling_n3');
    const kanji = path.body.items.filter((i: any) => i.kind === 'kanji');
    expect(kanji.length).toBeGreaterThan(0);
    for (const unit of kanji) expect(unit.level).toBe('N3');
    const kinds = await unitKinds(kanji.map((u: any) => u.unitId));
    expect(kinds.every((k) => k.kind === 'kanji' && k.level === 'N3')).toBe(true);
  });

  it('kế hoạch 14 ngày với Kanji luôn ≤ quỹ và mỗi mục ≤ 15 phút trên dữ liệu thật', async () => {
    const learner = await kanjiLearner(api, ctx, { dailyMinutes: 5 });
    for (let day = 0; day < 4; day++) {
      const plan = await getToday(api, learner);
      expect(plan.estimatedMinutes).toBeLessThanOrEqual(5);
      for (const item of plan.items) expect(item.estMinutes).toBeLessThanOrEqual(15);
      const unitItem = plan.items.find((i: any) => i.type === 'new_unit');
      if (unitItem) await studyPlanItem(api, ctx, learner, unitItem.id);
      await advanceDays(api, ctx, learner);
    }
  });
});
