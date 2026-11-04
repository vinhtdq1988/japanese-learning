import { describe, expect, it } from 'vitest';
import { gradeExercise, normalizeAnswer } from '../../src/domain/grading.js';

describe('chấm multiple_choice', () => {
  const payload = { choices: ['a', 'b', 'c'], correct_index: 1 };

  it('đúng khi chỉ số trùng đáp án', () => {
    expect(gradeExercise('multiple_choice', payload, 1)).toEqual({
      isCorrect: true,
      correctAnswer: 1,
    });
  });

  it('sai khi chỉ số khác, không phải số nguyên hoặc kiểu khác', () => {
    expect(gradeExercise('multiple_choice', payload, 0).isCorrect).toBe(false);
    expect(gradeExercise('multiple_choice', payload, 1.5).isCorrect).toBe(false);
    expect(gradeExercise('multiple_choice', payload, '1').isCorrect).toBe(false);
    expect(gradeExercise('multiple_choice', payload, null).isCorrect).toBe(false);
    expect(gradeExercise('multiple_choice', payload, 0).correctAnswer).toBe(1);
  });
});

describe('chấm matching', () => {
  const payload = {
    pairs: [
      ['水', { vi: 'nước', en: 'water' }],
      ['お茶', { vi: 'trà', en: 'tea' }],
    ],
  };

  it('đúng khi đủ cặp, thứ tự tùy ý, theo ngôn ngữ đang hiển thị', () => {
    expect(
      gradeExercise(
        'matching',
        payload,
        [
          ['お茶', 'trà'],
          ['水', 'nước'],
        ],
        'vi',
      ).isCorrect,
    ).toBe(true);
    expect(
      gradeExercise(
        'matching',
        payload,
        [
          ['水', 'water'],
          ['お茶', 'tea'],
        ],
        'en',
      ).isCorrect,
    ).toBe(true);
  });

  it('sai khi ghép nhầm, thiếu cặp, trùng cặp hoặc sai định dạng', () => {
    expect(
      gradeExercise(
        'matching',
        payload,
        [
          ['水', 'trà'],
          ['お茶', 'nước'],
        ],
        'vi',
      ).isCorrect,
    ).toBe(false);
    expect(gradeExercise('matching', payload, [['水', 'nước']], 'vi').isCorrect).toBe(false);
    expect(
      gradeExercise(
        'matching',
        payload,
        [
          ['水', 'nước'],
          ['水', 'nước'],
        ],
        'vi',
      ).isCorrect,
    ).toBe(false);
    expect(gradeExercise('matching', payload, 'x', 'vi').isCorrect).toBe(false);
    // Trả lời theo ngôn ngữ khác với ngôn ngữ người học đang thấy là sai.
    expect(
      gradeExercise(
        'matching',
        payload,
        [
          ['水', 'water'],
          ['お茶', 'tea'],
        ],
        'vi',
      ).isCorrect,
    ).toBe(false);
  });

  it('trả đáp án đúng đã bản địa hóa', () => {
    expect(gradeExercise('matching', payload, [], 'en').correctAnswer).toEqual([
      ['水', 'water'],
      ['お茶', 'tea'],
    ]);
  });

  it('chấp nhận vế dùng chung (chuỗi trung lập)', () => {
    const neutral = {
      pairs: [
        ['一', 'いち'],
        ['二', 'に'],
      ],
    };
    expect(
      gradeExercise('matching', neutral, [
        ['二', 'に'],
        ['一', 'いち'],
      ]).isCorrect,
    ).toBe(true);
  });
});

describe('chấm fill_blank', () => {
  const payload = { accepted_answers: ['すみません', 'すいません'] };

  it('chấp nhận mọi đáp án trong tập cố định', () => {
    expect(gradeExercise('fill_blank', payload, 'すみません').isCorrect).toBe(true);
    expect(gradeExercise('fill_blank', payload, 'すいません').isCorrect).toBe(true);
  });

  it('chuẩn hóa khoảng trắng, chữ hoa/thường và dạng chữ toàn/bán chiều khi so khớp', () => {
    expect(gradeExercise('fill_blank', { accepted_answers: ['ha'] }, '  HA ').isCorrect).toBe(true);
    expect(gradeExercise('fill_blank', { accepted_answers: ['ga ku'] }, 'ga   ku').isCorrect).toBe(
      true,
    );
    expect(gradeExercise('fill_blank', { accepted_answers: ['pan'] }, 'ｐａｎ').isCorrect).toBe(
      true,
    );
  });

  it('sai với đáp án ngoài tập, không phải chuỗi, và trả đáp án đầu tiên làm đáp án đúng', () => {
    const r = gradeExercise('fill_blank', payload, 'ありがとう');
    expect(r.isCorrect).toBe(false);
    expect(r.correctAnswer).toBe('すみません');
    expect(gradeExercise('fill_blank', payload, 3).isCorrect).toBe(false);
    expect(gradeExercise('fill_blank', payload, '').isCorrect).toBe(false);
  });

  it('normalizeAnswer idempotent', () => {
    const once = normalizeAnswer('  Ｈｅｌｌｏ   World ');
    expect(once).toBe('hello world');
    expect(normalizeAnswer(once)).toBe(once);
  });
});
