import { describe, expect, it } from 'vitest';
import { PRACTICE_MIN_DAILY_MINUTES } from '../../src/domain/practice.js';
import {
  STUDY_DEFAULTS,
  studyDefaultsDto,
  suggestedSkills,
} from '../../src/domain/study-defaults.js';
import type { Skill } from '../../src/domain/types.js';
import { loadLearnerProfile } from '../fixtures/learner-profiles/index.js';
import { loadSimCatalog, simulatePlans } from '../fixtures/golden/simulate-plans.js';

// Bảng gợi ý kỹ năng theo quỹ thời gian (T026, data-model.md §3.5, FR-021…023): hàm thuần, không đụng CSDL.

const EXPECTED: Record<number, Skill[]> = {
  5: ['vocabulary'],
  10: ['vocabulary', 'grammar'],
  15: ['vocabulary', 'grammar', 'kanji'],
  30: ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'],
};

describe('STUDY_DEFAULTS', () => {
  it('đúng bảng 4 dòng theo thứ tự tăng dần của quỹ thời gian', () => {
    expect(STUDY_DEFAULTS.map((row) => row.dailyMinutes)).toEqual([5, 10, 15, 30]);
    for (const row of STUDY_DEFAULTS) {
      expect(row.skills, `${row.dailyMinutes} phút`).toEqual(EXPECTED[row.dailyMinutes]);
    }
  });

  it('I8: tập kỹ năng của mức nhỏ là tập con của mức lớn hơn kế tiếp', () => {
    for (let i = 1; i < STUDY_DEFAULTS.length; i++) {
      const smaller = STUDY_DEFAULTS[i - 1]!.skills;
      const larger = STUDY_DEFAULTS[i]!.skills;
      expect(smaller.every((s) => larger.includes(s))).toBe(true);
      expect(larger.length).toBeGreaterThan(smaller.length);
    }
  });

  it('FR-022: reading/writing chỉ có ở mức 30 phút', () => {
    for (const row of STUDY_DEFAULTS) {
      const hasPractice = row.skills.includes('reading') || row.skills.includes('writing');
      expect(hasPractice, `${row.dailyMinutes} phút`).toBe(row.dailyMinutes === 30);
    }
  });

  it('không có kỹ năng trùng lặp trong một dòng', () => {
    for (const row of STUDY_DEFAULTS) {
      expect(new Set(row.skills).size).toBe(row.skills.length);
    }
  });
});

describe('suggestedSkills', () => {
  it.each([5, 10, 15, 30] as const)('%i phút ⇒ đúng gợi ý của bảng', (minutes) => {
    expect(suggestedSkills(minutes)).toEqual(EXPECTED[minutes]);
  });

  it('trả bản sao: sửa kết quả không làm hỏng bảng gốc', () => {
    const first = suggestedSkills(10);
    first.push('kanji');
    expect(suggestedSkills(10)).toEqual(['vocabulary', 'grammar']);
  });

  it('mức không có trong bảng ⇒ mảng rỗng', () => {
    expect(suggestedSkills(7)).toEqual([]);
  });
});

describe('studyDefaultsDto', () => {
  it('practiceMinDailyMinutes bằng ngưỡng luyện đọc/viết và items giống bảng', () => {
    const dto = studyDefaultsDto();
    expect(dto.practiceMinDailyMinutes).toBe(PRACTICE_MIN_DAILY_MINUTES);
    expect(dto.items).toEqual(STUDY_DEFAULTS.map((r) => ({ ...r })));
  });
});

describe('US1.5: kế hoạch mô phỏng với từng bộ mặc định không vượt quỹ thời gian', () => {
  const base = loadLearnerProfile('newcomer-10min');
  const catalog = loadSimCatalog(true);

  it.each(STUDY_DEFAULTS.map((row) => [row.dailyMinutes, row] as const))(
    '%i phút: mọi ngày estimatedMinutes ≤ dailyMinutes',
    (_minutes, row) => {
      const fixture = {
        ...base,
        profile: { ...base.profile, dailyMinutes: row.dailyMinutes, skills: [...row.skills] },
      };
      const history = simulatePlans(fixture, { catalog });
      expect(history.length).toBeGreaterThan(0);
      for (const day of history) {
        if (day === null) continue;
        expect(day.estimatedMinutes).toBeLessThanOrEqual(row.dailyMinutes);
      }
    },
  );
});
