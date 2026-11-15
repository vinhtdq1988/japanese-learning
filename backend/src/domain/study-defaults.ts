import { PRACTICE_MIN_DAILY_MINUTES } from './practice.js';
import type { Skill } from './types.js';

// Bảng gợi ý kỹ năng theo quỹ thời gian mỗi ngày (data-model.md §3.5, FR-021…023): hàm thuần, không
// truy vấn CSDL. Đây chỉ là GỢI Ý — khối lượng mỗi ngày do engine chặn theo quỹ thời gian, người học
// luôn đổi/bỏ được từng lựa chọn và máy chủ không tự áp dụng vào hồ sơ.

export interface StudyDefaultRow {
  dailyMinutes: 5 | 10 | 15 | 30;
  skills: Skill[];
}

/** Thứ tự tăng dần theo phút; tập của mức nhỏ là tập con của mức lớn hơn; luyện đọc/viết chỉ ở mức 30. */
export const STUDY_DEFAULTS: readonly StudyDefaultRow[] = [
  { dailyMinutes: 5, skills: ['vocabulary'] },
  { dailyMinutes: 10, skills: ['vocabulary', 'grammar'] },
  { dailyMinutes: 15, skills: ['vocabulary', 'grammar', 'kanji'] },
  { dailyMinutes: 30, skills: ['vocabulary', 'grammar', 'kanji', 'reading', 'writing'] },
];

/** Kỹ năng gợi ý cho một quỹ thời gian (mảng mới; mức không có trong bảng ⇒ rỗng). */
export function suggestedSkills(dailyMinutes: number): Skill[] {
  const row = STUDY_DEFAULTS.find((r) => r.dailyMinutes === dailyMinutes);
  return row ? [...row.skills] : [];
}

/** Phản hồi của `GET /study-defaults` (schema `StudyDefaults`). */
export function studyDefaultsDto(): {
  practiceMinDailyMinutes: number;
  items: StudyDefaultRow[];
} {
  return {
    practiceMinDailyMinutes: PRACTICE_MIN_DAILY_MINUTES,
    items: STUDY_DEFAULTS.map((r) => ({ dailyMinutes: r.dailyMinutes, skills: [...r.skills] })),
  };
}
