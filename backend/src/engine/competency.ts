import { SKILLS, type Skill } from '../domain/types.js';
import { RECOVER_AT, WEAK_MIN_ANSWERS } from './difficulty.js';

// Engine phân loại năng lực thuần hàm (spec 007, FR-014…FR-018, contracts/competency-rules.md): một nguồn quy tắc
// duy nhất cho màu ở Hôm nay, Lộ trình, Tiến độ. Không phụ thuộc HTTP/CSDL/đồng hồ; client chỉ hiển thị mức nhận được.

/** Số câu tối thiểu để kết luận mức năng lực — cùng ngưỡng với cờ "mảng yếu" nên hai khái niệm không lệch. */
export const COMPETENCY_MIN_ANSWERS = WEAK_MIN_ANSWERS;
/** Độ chính xác từ mức này trở lên là `good` — cùng ngưỡng bỏ cờ "mảng yếu" (đúng 0.70 thuộc `good`). */
export const COMPETENCY_GOOD_AT = RECOVER_AT;

export type CompetencyLevel = 'good' | 'needs_improvement' | 'insufficient';

export interface CompetencyInput {
  /** Số câu lượt chính trong cửa sổ trượt (không tính câu hỏi lại cuối phiên). */
  answered: number;
  correct: number;
}

/**
 * Phân loại một đầu mục (đánh giá từ trên xuống): chưa đủ `COMPETENCY_MIN_ANSWERS` câu → `insufficient`;
 * độ chính xác ≥ `COMPETENCY_GOOD_AT` → `good`; còn lại → `needs_improvement`.
 */
export function classifyCompetency({ answered, correct }: CompetencyInput): CompetencyLevel {
  if (answered < COMPETENCY_MIN_ANSWERS) return 'insufficient';
  return correct / answered >= COMPETENCY_GOOD_AT ? 'good' : 'needs_improvement';
}

/** Cửa sổ kết quả gần nhất (`topic_stats.recent_results`) của một chủ đề cùng kỹ năng của chủ đề. */
export interface TopicWindow {
  topicId: string;
  skill: Skill;
  recentResults: readonly number[];
}

export interface SkillCompetency {
  skill: Skill;
  level: CompetencyLevel;
  answered: number;
  accuracy: number | null;
}

export interface TopicCompetency {
  topicId: string;
  skill: Skill;
  level: CompetencyLevel;
  answered: number;
  accuracy: number | null;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const sum = (results: readonly number[]): number => results.reduce((total, r) => total + r, 0);

function accuracyOf(answered: number, correct: number): number | null {
  return answered === 0 ? null : round3(correct / answered);
}

/** Mức của từng chủ đề CÓ dữ liệu (chủ đề chưa có kết quả nào không xuất hiện). */
export function topicCompetencies(windows: readonly TopicWindow[]): TopicCompetency[] {
  return windows
    .filter((w) => w.recentResults.length > 0)
    .map((w) => {
      const answered = w.recentResults.length;
      const correct = sum(w.recentResults);
      return {
        topicId: w.topicId,
        skill: w.skill,
        level: classifyCompetency({ answered, correct }),
        answered,
        accuracy: accuracyOf(answered, correct),
      };
    });
}

/**
 * Mức của từng kỹ năng: cộng `answered`/`correct` của mọi chủ đề cùng kỹ năng rồi áp cùng quy tắc. Trả kỹ năng
 * đang bật (`enabledSkills`) hoặc đã có dữ liệu, theo thứ tự `SKILLS`; kỹ năng chưa có dữ liệu là `insufficient`.
 */
export function skillCompetencies(
  windows: readonly TopicWindow[],
  enabledSkills: readonly Skill[],
): SkillCompetency[] {
  const totals = new Map<Skill, { answered: number; correct: number }>();
  for (const w of windows) {
    if (w.recentResults.length === 0) continue;
    const t = totals.get(w.skill) ?? { answered: 0, correct: 0 };
    t.answered += w.recentResults.length;
    t.correct += sum(w.recentResults);
    totals.set(w.skill, t);
  }
  return SKILLS.filter((skill) => totals.has(skill) || enabledSkills.includes(skill)).map(
    (skill) => {
      const { answered, correct } = totals.get(skill) ?? { answered: 0, correct: 0 };
      return {
        skill,
        level: classifyCompetency({ answered, correct }),
        answered,
        accuracy: accuracyOf(answered, correct),
      };
    },
  );
}
