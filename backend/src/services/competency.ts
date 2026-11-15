import { listTopicWindows } from '../db/repositories/topic-stats.js';
import type { Skill } from '../domain/types.js';
import {
  skillCompetencies,
  topicCompetencies,
  type CompetencyLevel,
  type SkillCompetency,
  type TopicCompetency,
} from '../engine/competency.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ năng lực (spec 007, FR-018): một truy vấn `topic_stats ⨝ topics` cho mỗi yêu cầu, dựng mức theo chủ đề
// và theo kỹ năng bằng cùng một hàm thuần. `progress`, `daily-plan`, `path` đều dùng chung nên ba màn luôn khớp.

export interface Competency {
  /** Kỹ năng đang bật hoặc đã có dữ liệu, theo thứ tự `SKILLS`. */
  skills: SkillCompetency[];
  /** Mọi chủ đề có dữ liệu. */
  topics: TopicCompetency[];
  /** Mức của kỹ năng; kỹ năng không thuộc `skills` (chưa bật, chưa có dữ liệu) coi như `insufficient`. */
  skillLevel(skill: Skill): CompetencyLevel;
  /** Mức của chủ đề; chủ đề chưa có dữ liệu là `insufficient`. */
  topicLevel(topicId: string): CompetencyLevel;
}

/** Tải năng lực của người học; `enabledSkills` là kỹ năng hiệu lực (đã lọc theo quỹ thời gian). */
export async function loadCompetency(
  deps: Pick<ServiceDeps, 'db'>,
  userId: string,
  enabledSkills: readonly Skill[] = [],
): Promise<Competency> {
  const windows = await listTopicWindows(deps.db, userId);
  const skills = skillCompetencies(windows, enabledSkills);
  const topics = topicCompetencies(windows);
  const skillLevels = new Map(skills.map((s) => [s.skill, s.level]));
  const topicLevels = new Map(topics.map((t) => [t.topicId, t.level]));
  return {
    skills,
    topics,
    skillLevel: (skill) => skillLevels.get(skill) ?? 'insufficient',
    topicLevel: (topicId) => topicLevels.get(topicId) ?? 'insufficient',
  };
}
