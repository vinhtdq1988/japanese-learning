import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { onboardedLearner, query, type Learner } from '../integration/lesson-helpers.js';
import { ContractClient, newcomerOnboarding, registerUser } from './client.js';

// Kiểm thử hợp đồng thông báo phạm vi suy ra lúc đọc (spec 008, T211; OpenAPI 1.15.0, api-changes.md §3,
// research D12.2, FR-022): `notices` ở `PathSummary` (onboarding/complete, GET /path, POST /path/rebuild) và
// `ProgressSummary.goal`. `listening_not_available` có mặt KHI VÀ CHỈ KHI `goalType = 'jlpt'` — kể cả lộ trình
// đã tồn tại từ trước (không lưu trong `generated_from`); `scopeNotice` cũ giữ nguyên.

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

const jlpt = (over: Record<string, unknown> = {}) =>
  onboardedLearner(api, ctx, { goalType: 'jlpt', targetLevel: 'N3', currentLevel: 'N4', ...over });

const pathNotices = async (learner: Learner) => {
  const res = await api.get('/path', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body;
};
const progressGoal = async (learner: Learner) => {
  const res = await api.get('/progress', { token: learner.token });
  expect(res.status).toBe(200);
  return res.body.goal;
};

describe('listening_not_available khi và chỉ khi mục tiêu JLPT', () => {
  it('mục tiêu JLPT: có ở GET /path và GET /progress; scopeNotice null', async () => {
    const learner = await jlpt();
    const path = await pathNotices(learner);
    expect(path.notices).toEqual(['listening_not_available']);
    expect(path.scopeNotice).toBeNull();
    const goal = await progressGoal(learner);
    expect(goal.notices).toEqual(['listening_not_available']);
    expect(goal.scopeNotice).toBeNull();
  });

  it.each(['work', 'daily_conversation'])(
    'mục tiêu %s: không có thông báo nghe hiểu',
    async (goalType) => {
      const learner = await onboardedLearner(api, ctx, {
        goalType,
        currentLevel: 'N4',
      });
      expect((await pathNotices(learner)).notices ?? []).toEqual([]);
      expect((await progressGoal(learner)).notices ?? []).toEqual([]);
    },
  );

  it('onboarding/complete trả PathSummary có notices (JLPT) hoặc rỗng (không JLPT)', async () => {
    const user = await registerUser(api);
    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({ goalType: 'jlpt', targetLevel: 'N4', currentLevel: 'N5' }),
    });
    expect(done.status).toBe(200);
    expect(done.body.path.notices).toEqual(['listening_not_available']);

    const other = await registerUser(api);
    const doneOther = await api.post('/onboarding/complete', {
      token: other.accessToken,
      body: newcomerOnboarding({ goalType: 'daily_conversation' }),
    });
    expect(doneOther.status).toBe(200);
    expect(doneOther.body.path.notices ?? []).toEqual([]);
  });

  it('POST /path/rebuild cũng trả notices', async () => {
    const learner = await jlpt();
    const rebuilt = await api.post('/path/rebuild', { token: learner.token });
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.notices).toEqual(['listening_not_available']);
  });

  it('lộ trình đã tồn tại từ trước (generated_from không có thông báo): vẫn có notices vì tính lúc đọc', async () => {
    const learner = await jlpt();
    // Mô phỏng lộ trình sinh trước spec 008: bỏ hết khóa thông báo khỏi `generated_from`.
    await query(
      ctx,
      `UPDATE learning_paths SET generated_from = generated_from - 'scope_notice' WHERE user_id = $1`,
      [learner.userId],
    );
    expect((await pathNotices(learner)).notices).toEqual(['listening_not_available']);
    expect((await progressGoal(learner)).notices).toEqual(['listening_not_available']);
  });

  it('đổi mục tiêu sang không JLPT thì thông báo biến mất, đổi về JLPT thì xuất hiện lại', async () => {
    const learner = await jlpt();
    const toWork = await api.patch('/me', {
      token: learner.token,
      body: { goalType: 'work' },
    });
    expect(toWork.status).toBe(200);
    expect((await pathNotices(learner)).notices ?? []).toEqual([]);
    expect((await progressGoal(learner)).notices ?? []).toEqual([]);

    const back = await api.patch('/me', {
      token: learner.token,
      body: { goalType: 'jlpt', targetLevel: 'N3' },
    });
    expect(back.status).toBe(200);
    expect((await pathNotices(learner)).notices).toEqual(['listening_not_available']);
  });
});

describe('N2/N1 và thứ tự thông báo', () => {
  it('JLPT N2: cả content_ceiling_n3 và listening_not_available theo thứ tự đó; scopeNotice cũ giữ nguyên', async () => {
    const learner = await jlpt({ currentLevel: 'N2', targetLevel: 'N2' });
    const path = await pathNotices(learner);
    expect(path.notices).toEqual(['content_ceiling_n3', 'listening_not_available']);
    expect(path.scopeNotice).toBe('content_ceiling_n3');
    const goal = await progressGoal(learner);
    expect(goal.notices).toEqual(['content_ceiling_n3', 'listening_not_available']);
    expect(goal.scopeNotice).toBe('content_ceiling_n3');
  });

  it('JLPT N1 cũng nhận cả hai', async () => {
    const learner = await jlpt({ currentLevel: 'N1', targetLevel: 'N1' });
    expect((await pathNotices(learner)).notices).toEqual([
      'content_ceiling_n3',
      'listening_not_available',
    ]);
  });

  it('trình độ N2 nhưng mục tiêu không JLPT: chỉ content_ceiling_n3', async () => {
    const learner = await onboardedLearner(api, ctx, {
      goalType: 'work',
      currentLevel: 'N2',
    });
    const path = await pathNotices(learner);
    expect(path.notices).toEqual(['content_ceiling_n3']);
    expect(path.scopeNotice).toBe('content_ceiling_n3');
  });
});

describe('chưa onboarding', () => {
  it('GET /progress trước onboarding vẫn là trạng thái trống hợp lệ theo hợp đồng', async () => {
    const fresh = await registerUser(api);
    const res = await api.get('/progress', { token: fresh.accessToken });
    expect(res.status).toBe(200);
    expect(res.body.isEmpty).toBe(true);
    expect(res.body.goal.notices ?? []).toEqual([]);
  });
});
