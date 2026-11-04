/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedContent } from '../../src/seed/index.js';
import { createTestApp, type TestApp } from '../integration/helpers.js';
import { ContractClient } from './client.js';

// Kiểm thử hợp đồng US8 (T095): `GET /trial/content`, `POST /trial/placement/grade`, `POST /trial/events`
// đối chiếu `contracts/openapi.yaml` (ContractClient tự validate mã trạng thái và thân phản hồi).
// `/placement/questions` đã được kiểm thử ở T037/T048; ở đây chỉ dùng để lấy câu hỏi nộp bài.

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

async function placementAnswers(mode: 'correct' | 'wrong' | 'blank') {
  const { rows } = await ctx.handle.pool.query<{ id: string; correct_choice: number }>(
    'SELECT id, correct_choice FROM placement_questions WHERE is_active ORDER BY position',
  );
  return rows.map((r) => ({
    questionId: r.id,
    choice:
      mode === 'blank' ? null : mode === 'correct' ? r.correct_choice : (r.correct_choice + 1) % 4,
  }));
}

describe('GET /trial/content', () => {
  it('200 TrialContent công khai (không cần token): 1 từ vựng + 1 ngữ pháp, tổng ≤ 10 phút', async () => {
    const { status, body } = await api.get('/trial/content');
    expect(status).toBe(200);
    expect(body.units.map((u: any) => u.kind).sort()).toEqual(['grammar', 'vocabulary']);
    const minutes = body.units.reduce((sum: number, u: any) => sum + u.estMinutes, 0);
    expect(minutes).toBeLessThanOrEqual(10);
    for (const unit of body.units) {
      expect(unit.estMinutes).toBe(5);
      expect(unit.items.length).toBeGreaterThan(0);
      expect(unit.exercises.length).toBeGreaterThan(0);
    }
  });

  it('bài tập kèm đáp án theo từng loại để client tự chấm', async () => {
    const { body } = await api.get('/trial/content');
    const exercises = body.units.flatMap((u: any) => u.exercises);
    const seen = new Set<string>();
    for (const e of exercises) {
      seen.add(e.type);
      if (e.type === 'multiple_choice') {
        expect(e.answerKey.correctIndex).toBeGreaterThanOrEqual(0);
        expect(e.answerKey.correctIndex).toBeLessThan(e.payload.choices.length);
      } else if (e.type === 'matching') {
        expect(e.answerKey.pairs).toHaveLength(e.payload.left.length);
        for (const [l, r] of e.answerKey.pairs) {
          expect(e.payload.left).toContain(l);
          expect(e.payload.right).toContain(r);
        }
      } else {
        expect(e.answerKey.acceptedAnswers.length).toBeGreaterThan(0);
      }
      expect(e.feedbackCorrect).toEqual(expect.any(String));
      expect(e.feedbackIncorrect).toEqual(expect.any(String));
      // Payload công khai KHÔNG chứa đáp án gốc của luồng người học.
      expect(e.payload).not.toHaveProperty('correct_index');
      expect(e.payload).not.toHaveProperty('accepted_answers');
      expect(e.payload).not.toHaveProperty('pairs');
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('bản địa hóa theo tham số lang', async () => {
    const vi = await api.get('/trial/content?lang=vi');
    const en = await api.get('/trial/content?lang=en');
    expect(vi.status).toBe(200);
    expect(en.status).toBe(200);
    expect(vi.body.units.map((u: any) => u.title)).not.toEqual(
      en.body.units.map((u: any) => u.title),
    );
  });
});

describe('POST /trial/placement/grade', () => {
  it('200 PlacementResult với id null (không lưu)', async () => {
    const { status, body } = await api.post('/trial/placement/grade', {
      body: { answers: await placementAnswers('correct') },
    });
    expect(status).toBe(200);
    expect(body.id).toBeNull();
    expect(body.estimatedLevel).toBe('N3');
    expect(body.score).toBe(body.total);
  });

  it('đoán mò/bỏ trống → mức none và guessSuspected', async () => {
    const { status, body } = await api.post('/trial/placement/grade', {
      body: { answers: await placementAnswers('blank') },
    });
    expect(status).toBe(200);
    expect(body.estimatedLevel).toBe('none');
    expect(body.guessSuspected).toBe(true);
  });

  it('422 khi thân sai hình dạng hoặc câu hỏi không thuộc bộ hiện hành', async () => {
    const bad = await api.post('/trial/placement/grade', {
      body: { answers: 'khong-phai-mang' },
      validateRequest: false,
    });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('VALIDATION_FAILED');

    const unknown = await api.post('/trial/placement/grade', {
      body: { answers: [{ questionId: '00000000-0000-4000-8000-000000000000', choice: 0 }] },
    });
    expect(unknown.status).toBe(422);
  });
});

describe('POST /trial/events', () => {
  it('204 khi ghi nhận lesson_completed', async () => {
    const { status } = await api.post('/trial/events', { body: { event: 'lesson_completed' } });
    expect(status).toBe(204);
  });

  it('422 khi tên sự kiện ngoài danh sách hoặc thân có trường khác', async () => {
    const unknownEvent = await api.post('/trial/events', {
      body: { event: 'khac' },
      validateRequest: false,
    });
    expect(unknownEvent.status).toBe(422);

    const extra = await api.post('/trial/events', {
      body: { event: 'lesson_completed', userId: 'abc' },
      validateRequest: false,
    });
    expect(extra.status).toBe(422);

    const empty = await api.post('/trial/events', { body: {}, validateRequest: false });
    expect(empty.status).toBe(422);
  });
});
