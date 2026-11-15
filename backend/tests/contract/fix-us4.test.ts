import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENCOURAGEMENT_CATALOG, type EncouragementState } from '../../src/domain/encouragement.js';
import { addDays, localToday } from '../../src/engine/clock.js';
import { seedContent } from '../../src/seed/index.js';
import {
  loadEncouragementProfiles,
  loadLearnerProfile,
  type LearnerProfileFixture,
} from '../fixtures/learner-profiles/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import {
  advanceDays,
  finishPlanItem,
  getToday,
  onboardedLearner,
  type Learner,
} from '../integration/lesson-helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US4 của spec 007 (T133): `GET /today` trả `encouragement { state, message }` đúng trạng thái
// cho từng hồ sơ mẫu, đúng ngôn ngữ hồ sơ, ổn định trong ngày, khác câu ở ngày kế, không có khi tạm dừng và không
// làm đổi các trường `notice`, `kanjiNotice`, `summary` (FR-026…FR-031, SC-007, SC-008).

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

const messagesOf = (state: EncouragementState, language: 'vi' | 'en'): string[] =>
  ENCOURAGEMENT_CATALOG[state].map((v) => v[language]);

/** Mẫu câu của một trạng thái đã chuyển thành regex để khớp cả khi `{n}` đã được thay bằng số. */
const matchesCatalog = (state: EncouragementState, language: 'vi' | 'en', message: string): boolean =>
  messagesOf(state, language).some((template) => {
    const pattern = template
      .split('{n}')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\d+');
    return new RegExp(`^${pattern}$`).test(message);
  });

/** Đăng ký + onboarding theo hồ sơ (`targetDate` tương đối so với đồng hồ giả vì đồng hồ có thể đã trôi). */
async function learnerOf(fx: LearnerProfileFixture, targetInDays?: number): Promise<Learner> {
  const p = fx.profile;
  const targetDate =
    targetInDays === undefined
      ? {}
      : { targetDate: addDays(localToday(ctx.clock, p.timezone), targetInDays) };
  return onboardedLearner(api, ctx, {
    currentLevel: p.currentLevel,
    goalType: p.goalType,
    dailyMinutes: p.dailyMinutes,
    skills: p.skills,
    language: p.language,
    ...targetDate,
  });
}

const profileOf = (id: string): LearnerProfileFixture =>
  loadEncouragementProfiles().find((p) => p.id === id) ?? loadLearnerProfile(id);

const expectedState = (id: string): EncouragementState =>
  (profileOf(id).expected.encouragement as { state: EncouragementState }).state;

describe('GET /today: encouragement theo hồ sơ mẫu', () => {
  it('newcomer-10min → not_started, đúng câu vi và các trường cũ không đổi', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    const today = await getToday(api, learner);
    expect(today.encouragement.state).toBe('not_started');
    expect(matchesCatalog('not_started', 'vi', today.encouragement.message)).toBe(true);
    // Các trường hiện có vẫn nguyên vẹn (FR-030): kế hoạch, thông báo, tổng kết.
    expect(today.items.length).toBeGreaterThan(0);
    expect(today.notice ?? null).toBeNull();
    expect(today.kanjiNotice).toBeUndefined();
    expect(today.summary).toBeUndefined();
  });

  it('đổi language vi ↔ en ⇒ message đúng ngôn ngữ hồ sơ (FR-028)', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    const vi = (await getToday(api, learner)).encouragement;
    expect(matchesCatalog('not_started', 'vi', vi.message)).toBe(true);

    const patched = await api.patch('/me', { token: learner.token, body: { language: 'en' } });
    expect(patched.status).toBe(200);
    const en = (await getToday(api, learner)).encouragement;
    expect(en.state).toBe('not_started');
    expect(matchesCatalog('not_started', 'en', en.message)).toBe(true);
  });

  it('encouragement-in-progress → in_progress sau khi xong 1 trong nhiều mục', async () => {
    const learner = await learnerOf(profileOf('encouragement-in-progress'));
    const plan = await getToday(api, learner);
    expect(plan.items.length).toBeGreaterThan(1);
    await finishPlanItem(api, ctx, learner, plan.items[0].id);
    const after = await getToday(api, learner);
    expect(after.status).toBe('open');
    expect(after.encouragement.state).toBe(expectedState('encouragement-in-progress'));
    expect(matchesCatalog('in_progress', 'vi', after.encouragement.message)).toBe(true);
  });

  it('encouragement-day-completed → day_completed khi xong cả kế hoạch; summary vẫn có', async () => {
    const learner = await learnerOf(profileOf('encouragement-day-completed'));
    const plan = await getToday(api, learner);
    for (const item of plan.items) await finishPlanItem(api, ctx, learner, item.id);
    const after = await getToday(api, learner);
    expect(after.status).toBe('completed');
    expect(after.summary).toBeDefined();
    expect(after.encouragement.state).toBe(expectedState('encouragement-day-completed'));
    expect(matchesCatalog('day_completed', 'vi', after.encouragement.message)).toBe(true);
  });

  it('encouragement-behind-target → behind_target khi mốc gần mà còn nhiều nội dung', async () => {
    const learner = await learnerOf(profileOf('encouragement-behind-target'), 7);
    const today = await getToday(api, learner);
    expect(today.encouragement.state).toBe(expectedState('encouragement-behind-target'));
    expect(matchesCatalog('behind_target', 'vi', today.encouragement.message)).toBe(true);
  });

  it('có mốc nhưng đủ thời gian (onTrack) ⇒ không phải behind_target', async () => {
    const learner = await learnerOf(profileOf('encouragement-behind-target'), 3650);
    const today = await getToday(api, learner);
    expect(today.encouragement.state).toBe('not_started');
  });

  it('tải lại trong ngày ⇒ cùng một câu (không nhấp nháy)', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    const first = (await getToday(api, learner)).encouragement;
    const second = (await getToday(api, learner)).encouragement;
    expect(second).toEqual(first);
  });

  it('lộ trình tạm dừng ⇒ 409 PATH_PAUSED và không có encouragement', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    expect((await api.post('/path/pause', { token: learner.token })).status).toBe(204);
    const res = await api.get('/today', { token: learner.token });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PATH_PAUSED');
    expect(res.body.encouragement).toBeUndefined();
  });
});

// Các kịch bản dưới đây làm đồng hồ giả trôi qua nhiều ngày nên đặt SAU các kịch bản cùng-ngày ở trên.
describe('GET /today: encouragement theo thời gian', () => {
  it('ngày kế cùng trạng thái ⇒ câu khác (SC-008)', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    const day1 = (await getToday(api, learner)).encouragement;
    await advanceDays(api, ctx, learner, 1);
    const day2 = (await getToday(api, learner)).encouragement;
    expect(day1.state).toBe('not_started');
    expect(day2.state).toBe('not_started');
    expect(day2.message).not.toBe(day1.message);
  });

  it('học 3 ngày liên tiếp ⇒ ngày thứ 4 là streak và câu có số ngày chuỗi', async () => {
    const learner = await learnerOf(loadLearnerProfile('newcomer-10min'));
    for (let day = 0; day < 3; day++) {
      const plan = await getToday(api, learner);
      await finishPlanItem(api, ctx, learner, plan.items[0].id);
      await advanceDays(api, ctx, learner, 1);
    }
    const today = await getToday(api, learner);
    expect(today.status).toBe('open');
    expect(today.encouragement.state).toBe('streak');
    expect(matchesCatalog('streak', 'vi', today.encouragement.message)).toBe(true);
    expect(today.encouragement.message).toContain('3');
    expect(today.encouragement.message).not.toContain('{n}');
  });

  it('returning-after-gap: vắng nhiều ngày ⇒ welcome_back cùng notice replanned_after_gap', async () => {
    const fx = loadLearnerProfile('returning-after-gap');
    const learner = await learnerOf(fx);
    const plan = await getToday(api, learner);
    await finishPlanItem(api, ctx, learner, plan.items[0].id);
    await advanceDays(api, ctx, learner, 5);
    const today = await getToday(api, learner);
    expect(today.notice).toBe('replanned_after_gap');
    expect(today.encouragement.state).toBe('welcome_back');
    expect(matchesCatalog('welcome_back', 'vi', today.encouragement.message)).toBe(true);
  });
});
