import { describe, expect, it } from 'vitest';
import {
  ENCOURAGEMENT_CATALOG,
  ENCOURAGEMENT_STATES,
  STREAK_MIN_DAYS,
} from '../../src/domain/encouragement.js';

// Kiểm thử danh mục lời khích lệ (spec 007, T131, FR-027, SC-007, I7): quét TOÀN BỘ câu vi/en bằng bộ từ cấm
// của `contracts/encouragement-catalog.md` §4 và các quy tắc cấu trúc (số câu, `{n}`, độ dài, không lặp).

const BANNED_VI = [
  'bỏ lỡ',
  'bỏ qua ngày',
  'chậm',
  'trễ',
  'muộn',
  'mất chuỗi',
  'đứt chuỗi',
  'gián đoạn',
  'thua',
  'kém',
  'lười',
  'tệ',
  'thất bại',
  'đáng tiếc',
  'tiếc',
  'nợ',
  'người khác',
  'bạn khác',
  'các bạn khác',
];
const BANNED_EN = [
  'missed',
  'miss out',
  'behind',
  'late',
  'slow',
  'lose',
  'lost',
  'broke',
  'break your streak',
  'fail',
  'failure',
  'lazy',
  'worse',
  'pity',
  'debt',
  'overdue',
  'others',
  'other learners',
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Khớp theo từ nguyên (ranh giới là ký tự không phải chữ/số) nên "nợ" không khớp bên trong từ khác.
const wordRe = (word: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu');

describe('danh mục lời khích lệ', () => {
  it('đủ 6 trạng thái và ngưỡng chuỗi mặc định là 3', () => {
    expect(Object.keys(ENCOURAGEMENT_CATALOG).sort()).toEqual([...ENCOURAGEMENT_STATES].sort());
    expect(STREAK_MIN_DAYS).toBe(3);
  });

  describe.each(ENCOURAGEMENT_STATES)('trạng thái %s', (state) => {
    const variants = ENCOURAGEMENT_CATALOG[state];

    it('≥ 3 câu mỗi ngôn ngữ, hai ngôn ngữ cùng số câu (I7)', () => {
      const vi = variants.map((v) => v.vi).filter(Boolean);
      const en = variants.map((v) => v.en).filter(Boolean);
      expect(vi.length).toBeGreaterThanOrEqual(3);
      expect(en.length).toBe(vi.length);
    });

    it('không chứa từ/cụm cấm ở cả vi và en (FR-027, SC-007)', () => {
      for (const v of variants) {
        for (const word of BANNED_VI) {
          expect(wordRe(word).test(v.vi), `vi "${v.vi}" chứa "${word}"`).toBe(false);
        }
        for (const word of BANNED_EN) {
          expect(wordRe(word).test(v.en), `en "${v.en}" chứa "${word}"`).toBe(false);
        }
      }
    });

    it('`{n}` chỉ có ở streak và có ở cả hai bản của cùng một câu', () => {
      for (const v of variants) {
        const inVi = v.vi.includes('{n}');
        const inEn = v.en.includes('{n}');
        expect(inVi).toBe(inEn);
        expect(inVi).toBe(state === 'streak');
      }
    });

    it('mỗi câu ≤ 140 ký tự (vừa dải chữ ở màn hẹp)', () => {
      for (const v of variants) {
        expect([...v.vi].length).toBeLessThanOrEqual(140);
        expect([...v.en].length).toBeLessThanOrEqual(140);
      }
    });

    it('không có câu lặp trong cùng trạng thái và ngôn ngữ', () => {
      expect(new Set(variants.map((v) => v.vi)).size).toBe(variants.length);
      expect(new Set(variants.map((v) => v.en)).size).toBe(variants.length);
    });
  });
});
