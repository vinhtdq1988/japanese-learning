import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_CATALOG,
  achievementByCode,
  compareAchievementOrder,
  type AchievementKind,
} from '../../src/domain/achievements.js';

// Kiểm thử danh mục thành tựu cố định (spec 005, contracts/achievement-catalog.md §6).

const byKind = (kind: AchievementKind) => ACHIEVEMENT_CATALOG.filter((a) => a.kind === kind);

describe('danh mục thành tựu', () => {
  it('có đúng 16 mốc với mã duy nhất', () => {
    expect(ACHIEVEMENT_CATALOG).toHaveLength(16);
    const codes = ACHIEVEMENT_CATALOG.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([
      'first_lesson',
      'perfect_lesson',
      'streak_3',
      'streak_7',
      'streak_14',
      'streak_30',
      'streak_60',
      'streak_100',
      'items_50',
      'items_100',
      'items_250',
      'items_500',
      'goal_25',
      'goal_50',
      'goal_75',
      'goal_100',
    ]);
  });

  it('mã khớp ^[a-z]+(_[a-z]+)*(_[0-9]+)?$ và ≤ 40 ký tự (khớp CHECK của bảng)', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.code, a.code).toMatch(/^[a-z]+(_[a-z]+)*(_[0-9]+)?$/);
      expect(a.code.length, a.code).toBeLessThanOrEqual(40);
      expect(a.code.length, a.code).toBeGreaterThanOrEqual(1);
    }
  });

  it('mỗi mốc có tên và mô tả không rỗng ở cả vi và en; tên ≤ 30 ký tự', () => {
    for (const a of ACHIEVEMENT_CATALOG) {
      for (const lang of ['vi', 'en'] as const) {
        expect(a.name[lang].trim(), `${a.code}.name.${lang}`).not.toBe('');
        expect(a.description[lang].trim(), `${a.code}.description.${lang}`).not.toBe('');
        expect([...a.name[lang]].length, `${a.code}.name.${lang}`).toBeLessThanOrEqual(30);
      }
    }
  });

  it('ngưỡng tăng ngặt trong từng loại; goal_progress kết thúc ở 100', () => {
    for (const kind of ['streak', 'items_learned', 'goal_progress'] as const) {
      const thresholds = byKind(kind).map((a) => a.threshold);
      expect(thresholds.length, kind).toBeGreaterThan(0);
      for (const t of thresholds) expect(Number.isInteger(t) && t! >= 1, `${kind} ${t}`).toBe(true);
      for (let i = 1; i < thresholds.length; i++) {
        expect(thresholds[i]!, kind).toBeGreaterThan(thresholds[i - 1]!);
      }
    }
    expect(byKind('goal_progress').at(-1)?.threshold).toBe(100);
  });

  it('số mốc theo loại: 1 + 1 + 6 + 4 + 4; mã khớp loại và ngưỡng', () => {
    expect(byKind('first_lesson')).toHaveLength(1);
    expect(byKind('perfect_lesson')).toHaveLength(1);
    expect(byKind('streak')).toHaveLength(6);
    expect(byKind('items_learned')).toHaveLength(4);
    expect(byKind('goal_progress')).toHaveLength(4);
    for (const a of ACHIEVEMENT_CATALOG) {
      if (a.kind === 'streak') expect(a.code).toBe(`streak_${a.threshold}`);
      if (a.kind === 'items_learned') expect(a.code).toBe(`items_${a.threshold}`);
      if (a.kind === 'goal_progress') expect(a.code).toBe(`goal_${a.threshold}`);
    }
  });

  it('hai thành tựu một lần không có ngưỡng', () => {
    expect(achievementByCode('first_lesson')?.threshold).toBeUndefined();
    expect(achievementByCode('perfect_lesson')?.threshold).toBeUndefined();
  });

  it('achievementByCode tra đúng và trả undefined cho mã lạ', () => {
    expect(achievementByCode('streak_7')?.threshold).toBe(7);
    expect(achievementByCode('goal_100')?.kind).toBe('goal_progress');
    expect(achievementByCode('khong_co')).toBeUndefined();
  });
});

describe('thứ tự trình bày (FR-014)', () => {
  it('first_lesson → perfect_lesson → streak → items → goal; cùng loại theo ngưỡng tăng dần', () => {
    const shuffled = [...ACHIEVEMENT_CATALOG].reverse();
    const sorted = [...shuffled].sort(compareAchievementOrder).map((a) => a.code);
    expect(sorted).toEqual(ACHIEVEMENT_CATALOG.map((a) => a.code));
  });

  it('một tập con bất kỳ được sắp đúng', () => {
    const codes = [
      'goal_50',
      'streak_30',
      'items_100',
      'perfect_lesson',
      'streak_3',
      'first_lesson',
    ];
    const sorted = codes
      .map((c) => achievementByCode(c)!)
      .sort(compareAchievementOrder)
      .map((a) => a.code);
    expect(sorted).toEqual([
      'first_lesson',
      'perfect_lesson',
      'streak_3',
      'streak_30',
      'items_100',
      'goal_50',
    ]);
  });
});
