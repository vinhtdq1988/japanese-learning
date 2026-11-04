import { describe, expect, it } from 'vitest';
import { gradeExercise } from '../../src/domain/grading.js';
import {
  buildSnapshot,
  parseSnapshot,
  publicExercise,
  shuffleStable,
  type ExerciseSource,
  type ItemSource,
} from '../../src/domain/session-snapshot.js';

const t = (vi: string, en: string) => ({ vi, en });

const item = (
  id: string,
  position: number,
  status: 'active' | 'inactive' = 'active',
): ItemSource => ({
  id,
  kind: 'vocabulary',
  japanese: `語${id}`,
  reading: `ご${id}`,
  meaning: t(`nghĩa ${id}`, `meaning ${id}`),
  explanation: null,
  examples: [{ ja: '例', translation: t('ví dụ', 'example') }],
  position,
  status,
});

const exercise = (
  id: string,
  position: number,
  overrides: Partial<ExerciseSource> = {},
): ExerciseSource => ({
  id,
  itemId: null,
  topicId: 'topic-1',
  type: 'multiple_choice',
  prompt: t(`câu ${id}`, `q ${id}`),
  payload: { choices: [t('Nước', 'Water'), 'お茶', 'パン'], correct_index: 0 },
  feedbackCorrect: t('Đúng', 'Right'),
  feedbackIncorrect: t('Sai', 'Wrong'),
  position,
  status: 'active',
  ...overrides,
});

describe('buildSnapshot', () => {
  const base = {
    title: t('Đồ ăn', 'Food'),
    unitId: 'unit-1',
    items: [item('b', 2), item('a', 1), item('x', 3, 'inactive')],
    exercises: [
      exercise('e2', 2),
      exercise('e1', 1),
      exercise('e3', 3, { status: 'inactive' }),
      exercise('e4', 4, { itemId: 'x' }), // gắn với mục đã bị gỡ
      exercise('e5', 5, { itemId: 'a' }),
    ],
  };

  it('chỉ lấy mục và bài tập active, sắp theo position', () => {
    const snap = buildSnapshot({ ...base, language: 'vi' });
    expect(snap.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(snap.exercises.map((e) => e.id)).toEqual(['e1', 'e2', 'e5']);
  });

  it('bản địa hóa tiêu đề, nghĩa, lời nhắc và phản hồi theo ngôn ngữ', () => {
    const vi = buildSnapshot({ ...base, language: 'vi' });
    const en = buildSnapshot({ ...base, language: 'en' });
    expect(vi.title).toBe('Đồ ăn');
    expect(en.title).toBe('Food');
    expect(vi.items[0]!.meaning).toBe('nghĩa a');
    expect(en.items[0]!.meaning).toBe('meaning a');
    expect(vi.exercises[0]!.feedbackIncorrect).toBe('Sai');
    expect(en.exercises[0]!.feedbackIncorrect).toBe('Wrong');
    expect(en.items[0]!.examples[0]!.translation).toBe('example');
  });

  it('parseSnapshot từ chối dạng không nhận ra và đọc lại đúng bản đã lưu', () => {
    expect(() => parseSnapshot({ version: 99, exercises: [] })).toThrow();
    expect(() => parseSnapshot(null)).toThrow();
    const snap = buildSnapshot({ ...base, language: 'vi' });
    expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
});

describe('publicExercise (không lộ đáp án)', () => {
  it('multiple_choice: chỉ có choices đã bản địa hóa, không có correct_index', () => {
    const snap = buildSnapshot({
      title: t('A', 'A'),
      unitId: null,
      items: [],
      exercises: [exercise('e1', 1)],
      language: 'en',
    });
    const pub = publicExercise(snap.exercises[0]!, 'en');
    expect(pub.payload).toEqual({ choices: ['Water', 'お茶', 'パン'] });
    expect(JSON.stringify(pub)).not.toContain('correct_index');
  });

  it('matching: trả left/right, vế phải đã xáo và không trùng thứ tự đáp án', () => {
    const pairs = [
      ['水', t('nước', 'water')],
      ['お茶', t('trà', 'tea')],
      ['パン', t('bánh mì', 'bread')],
      ['ごはん', t('cơm', 'rice')],
    ];
    const snap = buildSnapshot({
      title: t('A', 'A'),
      unitId: null,
      items: [],
      exercises: [exercise('m1', 1, { type: 'matching', payload: { pairs } })],
      language: 'vi',
    });
    const pub = publicExercise(snap.exercises[0]!, 'vi');
    const { left, right } = pub.payload as { left: string[]; right: string[] };
    expect(left).toEqual(['水', 'お茶', 'パン', 'ごはん']);
    expect([...right].sort()).toEqual(['bánh mì', 'cơm', 'nước', 'trà']);
    expect(right).not.toEqual(['nước', 'trà', 'bánh mì', 'cơm']);
    expect(JSON.stringify(pub)).not.toContain('pairs');
    // Ổn định giữa các lần tiếp tục phiên.
    expect(publicExercise(snap.exercises[0]!, 'vi')).toEqual(pub);
    // Đáp án đúng (theo thứ tự trái) được bộ chấm công nhận.
    expect(
      gradeExercise('matching', snap.exercises[0]!.payload, [
        ['水', 'nước'],
        ['お茶', 'trà'],
        ['パン', 'bánh mì'],
        ['ごはん', 'cơm'],
      ]).isCorrect,
    ).toBe(true);
  });

  it('fill_blank: không có accepted_answers, chỉ giữ hint nếu có', () => {
    const snap = buildSnapshot({
      title: t('A', 'A'),
      unitId: null,
      items: [],
      exercises: [
        exercise('f1', 1, {
          type: 'fill_blank',
          payload: { accepted_answers: ['は'], hint: 'trợ từ' },
        }),
        exercise('f2', 2, { type: 'fill_blank', payload: { accepted_answers: ['が'] } }),
      ],
      language: 'vi',
    });
    expect(publicExercise(snap.exercises[0]!, 'vi').payload).toEqual({ hint: 'trợ từ' });
    expect(publicExercise(snap.exercises[1]!, 'vi').payload).toEqual({});
  });
});

describe('shuffleStable', () => {
  it('tất định theo hạt giống, giữ đủ phần tử và luôn đổi thứ tự khi ≥ 2 phần tử', () => {
    for (let i = 0; i < 20; i++) {
      const out = shuffleStable(['a', 'b'], `seed-${i}`);
      expect(out).toEqual(['b', 'a']);
    }
    expect(shuffleStable([1, 2, 3, 4, 5], 'x')).toEqual(shuffleStable([1, 2, 3, 4, 5], 'x'));
    expect(shuffleStable(['only'], 'x')).toEqual(['only']);
    expect(shuffleStable([], 'x')).toEqual([]);
  });
});
