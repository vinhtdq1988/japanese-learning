import { PRACTICE_SKILLS } from './types.js';

// Điều kiện luyện đọc/viết (data-model.md §3.1): hàm thuần, không truy vấn CSDL.

/** Quỹ thời gian tối thiểu mỗi ngày (phút) để dùng luyện đọc/viết. */
export const PRACTICE_MIN_DAILY_MINUTES = 30;

/** Người học có đủ quỹ thời gian để dùng luyện đọc/viết không (thiếu giá trị ⇒ chưa đủ). */
export function isPracticeEligible(dailyMinutes: number | null | undefined): boolean {
  return (dailyMinutes ?? 0) >= PRACTICE_MIN_DAILY_MINUTES;
}

/**
 * Bộ kỹ năng hiệu lực: đủ điều kiện thì giữ nguyên, ngược lại loại `reading`/`writing`.
 * Luôn trả mảng mới, giữ thứ tự các kỹ năng còn lại; không sửa mảng đầu vào.
 */
export function effectiveSkills<T extends string>(
  skills: readonly T[],
  dailyMinutes: number | null | undefined,
): T[] {
  if (isPracticeEligible(dailyMinutes)) return [...skills];
  const locked: readonly string[] = PRACTICE_SKILLS;
  return skills.filter((skill) => !locked.includes(skill));
}

/** Thông điệp 422/403 khi chọn hoặc dùng luyện đọc/viết mà quỹ thời gian chưa đủ. */
export const PRACTICE_LOCKED_MESSAGE = 'Luyện đọc/viết dành cho người học từ 30 phút mỗi ngày';

/** Có kỹ năng luyện (reading/writing) nào trong danh sách không. */
export function hasPracticeSkill(skills: readonly string[]): boolean {
  const practice: readonly string[] = PRACTICE_SKILLS;
  return skills.some((skill) => practice.includes(skill));
}

/**
 * Kỹ năng luyện được THÊM MỚI so với `previous` (data-model §3.1: chỉ từ chối thêm mới khi phút sau cập nhật
 * < 30; giá trị đã lưu từ trước không bị đụng tới khi hạ phút).
 */
export function newlyAddedPractice(next: readonly string[], previous: readonly string[]): string[] {
  const practice: readonly string[] = PRACTICE_SKILLS;
  return next.filter((skill) => practice.includes(skill) && !previous.includes(skill));
}
