import { readProfilesWithPrefix, CLASS_PREFIX, type LearnerProfileFixture } from './index.js';
import type { Level, Skill, TargetLevel } from '../../../src/domain/types.js';

// Hồ sơ người học trong lớp (spec 004, FR-043, research O19): hồ sơ cá nhân cộng thêm phần `class` mô tả
// lộ trình lớp, thành viên và các điều chỉnh. Loader RIÊNG – không thêm vào `loadLearnerProfiles()` để golden
// hồi quy `plans-pre-org.json` chỉ phủ hồ sơ cũ.

export interface ClassFixtureAssignment {
  /** Tên file (không đuôi) của đơn vị được giao. */
  unit: string;
  dueOn: string;
}

export interface ClassFixture {
  /** `template`: chế độ mẫu; `explicit`: giáo viên liệt kê bài (`explicitUnits`). */
  mode: 'template' | 'explicit';
  startLevel: Level;
  targetLevel: TargetLevel;
  skills: Skill[];
  startsOn: string;
  endsOn: string;
  dailyMinutes: 5 | 10 | 15 | 30;
  /** Ngày học viên vào lớp (mốc hiển thị dữ liệu cho giáo viên). */
  joinedOn: string;
  absenceThresholdDays: number;
  explicitUnits: { unit: string; opensOn?: string | null }[];
  assignments: ClassFixtureAssignment[];
  /** Ghi đè riêng một học viên (phút/ngày, dời mốc) hoặc null. */
  overrides: { dailyMinutes?: 5 | 10 | 15 | 30 | null; shiftDays?: number } | null;
  /** Tên file các đơn vị được miễn cho học viên này. */
  exemptions: string[];
  /** Khoảng tạm dừng của cả lớp, nửa khoảng `[startedOn, endedOn)`. */
  classPauses: { startedOn: string; endedOn: string | null }[];
  /** Giáo viên đổi lộ trình giữa chừng (hồ sơ `class-path-changed-midway`). */
  pathChange?: { on: string; skills?: Skill[]; dailyMinutes?: 5 | 10 | 15 | 30 };
}

export interface ClassProfileFixture extends LearnerProfileFixture {
  class: ClassFixture;
}

/** Tập hồ sơ lớp bắt buộc (FR-043, research O19). */
export const CLASS_PROFILE_IDS = [
  'class-newcomer-10min',
  'class-midway-personal-progress',
  'class-absent-many-days',
  'class-exempt-unit',
  'class-overdue-assignment',
  'class-path-changed-midway',
  'class-paused-whole-class',
] as const;

/** Đọc nhóm hồ sơ lớp, sắp theo `id`. */
export function loadClassProfiles(): ClassProfileFixture[] {
  return readProfilesWithPrefix<ClassProfileFixture>(CLASS_PREFIX);
}

/** Đọc một hồ sơ lớp theo `id`. */
export function loadClassProfile(id: string): ClassProfileFixture {
  const found = loadClassProfiles().find((p) => p.id === id);
  if (!found) throw new Error(`Không có hồ sơ lớp "${id}"`);
  return found;
}
