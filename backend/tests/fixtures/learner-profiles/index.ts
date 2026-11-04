import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GoalType, Language, Level, Skill, TargetLevel } from '../../../src/domain/types.js';

// Hồ sơ người học đại diện dùng chung cho kiểm thử engine (FR-035, hiến pháp).
// Mỗi hồ sơ là một file JSON cạnh file này: hồ sơ học tập, kết quả placement, lịch sử làm bài,
// tồn đọng ôn tập và kết quả mong đợi. Phần `expected` mô tả hành vi đúng theo research R6–R8.

/** Kết quả mong đợi: cấu trúc tự do theo từng engine (path / dailyPlan / gap / difficulty / placement). */
export type ExpectedOutcomes = Record<string, Record<string, unknown>>;

export interface LearnerProfileFixture {
  id: string;
  description: string;
  /** Ngày địa phương "hôm nay" khi chạy kịch bản. */
  asOf: string;
  profile: {
    currentLevel: Level;
    goalType: GoalType;
    targetLevel: TargetLevel | null;
    dailyMinutes: 5 | 10 | 15 | 30;
    targetDate: string | null;
    skills: Skill[];
    prioritizedSkill: Skill | null;
    language: Language;
    timezone: string;
    paused: boolean;
  };
  /** Câu trả lời đúng/sai theo vị trí (1–20) của bộ `content/placement/placement-v1.json`. */
  placement: { note?: string; correctByPosition: boolean[] } | null;
  /** Ngày học gần nhất (null = chưa từng học); dùng để phát hiện khoảng nghỉ. */
  lastActiveDate: string | null;
  pausePeriods: { startedOn: string; endedOn: string | null }[];
  /** Các phiên làm bài theo mảng (khóa mảng ở `content/topics.json`), kết quả 1 = đúng, 0 = sai. */
  history: { date: string; topic: string; context: 'lesson' | 'review'; results: (0 | 1)[] }[];
  /** Mục ôn đến hạn tồn đọng: `count` mục, mỗi mục quá hạn `daysOverdue` ngày. */
  reviewBacklog: { count: number; daysOverdue: number; isHard: boolean }[];
  expected: ExpectedOutcomes;
}

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** Đọc mọi hồ sơ đại diện (sắp theo `id`). */
export function loadLearnerProfiles(): LearnerProfileFixture[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as LearnerProfileFixture)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadLearnerProfile(id: string): LearnerProfileFixture {
  const found = loadLearnerProfiles().find((p) => p.id === id);
  if (!found) throw new Error(`Không có hồ sơ đại diện "${id}"`);
  return found;
}

/** Tập hồ sơ bắt buộc theo FR-035 / quickstart §3. */
export const REQUIRED_PROFILE_IDS = [
  'newcomer-10min',
  'n3-30min',
  'returning-after-gap',
  'five-minute-backlog',
  'placement-guesser',
  'low-accuracy-topic',
  'high-accuracy-topic',
  'recovered-weak-topic',
  'self-declared-n2',
  'jlpt-n1-goal',
] as const;
