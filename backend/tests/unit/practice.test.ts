import { describe, expect, it } from 'vitest';
import {
  PRACTICE_MIN_DAILY_MINUTES,
  effectiveSkills,
  isPracticeEligible,
} from '../../src/domain/practice.js';

// Điều kiện luyện đọc/viết (T004, data-model.md §3.1): hàm thuần, không đụng CSDL.

describe('PRACTICE_MIN_DAILY_MINUTES', () => {
  it('bằng 30 phút', () => {
    expect(PRACTICE_MIN_DAILY_MINUTES).toBe(30);
  });
});

describe('isPracticeEligible', () => {
  it.each([null, undefined, 0, 5, 10, 15, 29])('%s phút ⇒ chưa đủ điều kiện', (minutes) => {
    expect(isPracticeEligible(minutes)).toBe(false);
  });

  it('đúng 30 phút ⇒ đủ điều kiện', () => {
    expect(isPracticeEligible(30)).toBe(true);
  });

  it('trên 30 phút ⇒ đủ điều kiện', () => {
    expect(isPracticeEligible(45)).toBe(true);
  });
});

describe('effectiveSkills (bảng chân trị data-model.md §3.1)', () => {
  const WITH_PRACTICE = ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'];
  const WITHOUT_PRACTICE = ['vocabulary', 'grammar', 'kanji'];

  it('có reading/writing + 30 phút ⇒ giữ nguyên', () => {
    expect(effectiveSkills(WITH_PRACTICE, 30)).toEqual(WITH_PRACTICE);
  });

  it.each([5, 10, 15])('có reading/writing + %i phút ⇒ bỏ reading và writing', (minutes) => {
    expect(effectiveSkills(WITH_PRACTICE, minutes)).toEqual(WITHOUT_PRACTICE);
  });

  it('chỉ có một trong hai + phút < 30 ⇒ bỏ kỹ năng đó', () => {
    expect(effectiveSkills(['vocabulary', 'reading'], 15)).toEqual(['vocabulary']);
    expect(effectiveSkills(['writing', 'grammar'], 10)).toEqual(['grammar']);
  });

  it.each([5, 10, 15, 30])(
    'không có reading/writing + %i phút ⇒ giữ nguyên',
    (minutes) => {
      expect(effectiveSkills(WITHOUT_PRACTICE, minutes)).toEqual(WITHOUT_PRACTICE);
    },
  );

  it('phút null ⇒ coi như chưa đủ điều kiện, bỏ reading/writing', () => {
    expect(effectiveSkills(WITH_PRACTICE, null)).toEqual(WITHOUT_PRACTICE);
  });

  it('không đổi thứ tự các kỹ năng còn lại', () => {
    expect(effectiveSkills(['writing', 'kanji', 'reading', 'vocabulary', 'grammar'], 15)).toEqual([
      'kanji',
      'vocabulary',
      'grammar',
    ]);
    expect(effectiveSkills(['grammar', 'writing', 'vocabulary'], 30)).toEqual([
      'grammar',
      'writing',
      'vocabulary',
    ]);
  });

  it('là hàm thuần: không sửa mảng đầu vào và trả mảng mới', () => {
    const input = Object.freeze([...WITH_PRACTICE]) as string[];
    const lowered = effectiveSkills(input, 15);
    expect(input).toEqual(WITH_PRACTICE);
    expect(lowered).not.toBe(input);

    const kept = effectiveSkills(input, 30);
    expect(kept).toEqual(WITH_PRACTICE);
    expect(input).toEqual(WITH_PRACTICE);
  });
});
