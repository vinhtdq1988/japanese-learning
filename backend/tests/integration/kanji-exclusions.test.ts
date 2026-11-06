import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { ContractClient, newcomerOnboarding, registerUser } from '../contract/client.js';
import { createTestApp, type TestApp } from './helpers.js';
import { KANJI_SKILLS, query } from './lesson-helpers.js';

// Kiểm thử hồi quy phạm vi loại trừ Kanji (T085, research K12): dùng thử và kiểm tra trình độ KHÔNG BAO GIỜ
// chứa nội dung Kanji, kể cả khi thư viện Kanji đã seed; người học chọn Kanji vẫn làm placement 20 câu như cũ.

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

describe('GET /trial/content', () => {
  it('không chứa bài, chữ hay khía cạnh Kanji dù thư viện Kanji đã seed và bị đánh dấu dùng thử', async () => {
    const kanjiUnits = await query<{ id: string }>(
      ctx,
      `SELECT id FROM learning_units WHERE kind = 'kanji'`,
    );
    expect(kanjiUnits.length).toBeGreaterThanOrEqual(7);
    // Cố ý đánh dấu mọi bài Kanji là dùng thử: tập dùng thử vẫn chỉ được duyệt từ vựng + ngữ pháp.
    await query(ctx, `UPDATE learning_units SET is_trial = true WHERE kind = 'kanji'`);

    const res = await api.get('/trial/content?lang=vi');
    expect(res.status).toBe(200);
    expect(res.body.units.length).toBeGreaterThan(0);
    const kanjiIds = new Set(kanjiUnits.map((u) => u.id));
    for (const unit of res.body.units) {
      expect(['vocabulary', 'grammar']).toContain(unit.kind);
      expect(kanjiIds.has(unit.id)).toBe(false);
      for (const item of unit.items) {
        expect(item.kind).not.toBe('kanji');
        expect(item.kanji ?? null).toBeNull();
        expect(item.topicId ?? null).toBeNull();
      }
      for (const exercise of unit.exercises) {
        expect(exercise.facet ?? 'item').toBe('item');
      }
    }
  });
});

describe('GET /placement/questions', () => {
  it('đủ 20 câu, không có câu Kanji (kỹ năng chỉ vocabulary/grammar) và không có trong CSDL', async () => {
    const res = await api.get('/placement/questions?lang=en');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(20);
    for (const q of res.body.questions) {
      expect(['vocabulary', 'grammar']).toContain(q.skill);
    }
    const [row] = await query<{ n: number }>(
      ctx,
      `SELECT count(*)::int AS n FROM placement_questions WHERE skill = 'kanji'`,
    );
    expect(row!.n).toBe(0);
  });

  it('người học chọn Kanji vẫn làm placement 20 câu rồi hoàn tất onboarding với Kanji', async () => {
    const user = await registerUser(api);
    const questions = await api.get('/placement/questions', { token: user.accessToken });
    expect(questions.status).toBe(200);
    expect(questions.body.questions).toHaveLength(20);

    const keys = await query<{ id: string; correct_choice: number }>(
      ctx,
      `SELECT id, correct_choice FROM placement_questions WHERE is_active`,
    );
    const placement = await api.post('/placement/submit', {
      token: user.accessToken,
      body: {
        durationSeconds: 400,
        answers: keys.map((k) => ({ questionId: k.id, choice: k.correct_choice })),
      },
    });
    expect(placement.status).toBe(200);
    expect(placement.body).toMatchObject({ total: 20, score: 20 });

    const done = await api.post('/onboarding/complete', {
      token: user.accessToken,
      body: newcomerOnboarding({
        currentLevel: 'N4',
        skills: KANJI_SKILLS,
        placementResultId: placement.body.id,
      }),
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
  });
});
