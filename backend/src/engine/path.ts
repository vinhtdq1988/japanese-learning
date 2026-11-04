import { diffDays } from './clock.js';
import type { EstimatedLevel } from './placement.js';
import {
  CONTENT_LEVELS,
  type ContentLevel,
  type GoalType,
  type Level,
  type LocalDate,
  type Skill,
  type TargetLevel,
  type UnitStatus,
  type UnitTier,
} from '../domain/types.js';

// Engine lộ trình thuần hàm (research R7, Nguyên tắc II). Lộ trình KHÔNG lưu danh sách đơn vị:
// chỉ lưu tham số sinh (`PathParams`); thứ tự đơn vị được `rankUnits` tính động mỗi lần cần, nên đơn vị
// admin mới kích hoạt có mặt ngay và đơn vị bị vô hiệu hóa tự biến mất (SC-008).

/** Nội dung Giai đoạn 1 chỉ đến N3; trình độ/mục tiêu N2, N1 bị cắt ở trần này. */
export const CONTENT_CEILING: ContentLevel = 'N3';

export type ScopeNotice = 'content_ceiling_n3';

export interface PathProfileInput {
  currentLevel: Level;
  goalType: GoalType | null;
  targetLevel: TargetLevel | null;
  targetDate: LocalDate | null;
  skills: readonly Skill[];
  prioritizedSkill?: Skill | null;
}

/** Kết quả placement hiện hành dùng làm điểm xuất phát (nếu có). */
export interface PlacementInput {
  id: string | null;
  estimatedLevel: EstimatedLevel;
  weakTopics: readonly string[];
}

export interface PathParams {
  /** Trình độ nội dung bắt đầu học. */
  startLevel: ContentLevel;
  /** Khoảng trình độ [thấp nhất, cao nhất] được đưa vào lộ trình. */
  levelRange: [ContentLevel, ContentLevel];
  /** Người mới: các đơn vị `tier='foundation'` được xếp trước. */
  foundationFirst: boolean;
  goalType: GoalType | null;
  targetLevel: TargetLevel | null;
  targetDate: LocalDate | null;
  skills: Skill[];
  placementResultId: string | null;
  /** Mảng yếu lấy từ placement (id mảng). */
  weakTopics: string[];
  scopeNotice: ScopeNotice | null;
}

export function levelIndex(level: ContentLevel): number {
  return CONTENT_LEVELS.indexOf(level);
}

/** Cắt trình độ khai báo/mục tiêu về trình độ nội dung (N2, N1 → N3; none → null). */
function toContentLevel(level: Level | TargetLevel): ContentLevel | null {
  if (level === 'none') return null;
  if (level === 'N2' || level === 'N1') return CONTENT_CEILING;
  return level;
}

function isBeyondContent(level: Level | TargetLevel | null): boolean {
  return level === 'N2' || level === 'N1';
}

/**
 * Chọn điểm xuất phát và khoảng trình độ.
 * - Điểm xuất phát: kết quả placement nếu có, ngược lại trình độ tự khai báo. "Chưa biết gì" hoặc placement
 *   `none` (kém/đoán mò) → N5 và ưu tiên các đơn vị nền tảng.
 * - Trần khoảng trình độ: mục tiêu JLPT (cắt ở N3) nếu có, ngược lại N3; không bao giờ thấp hơn điểm xuất phát.
 * - `scopeNotice='content_ceiling_n3'` khi trình độ hoặc mục tiêu JLPT là N2/N1.
 */
export function buildPathParams(
  profile: PathProfileInput,
  placement: PlacementInput | null = null,
): PathParams {
  const effective: Level = placement ? placement.estimatedLevel : profile.currentLevel;
  const contentLevel = toContentLevel(effective);
  const startLevel: ContentLevel = contentLevel ?? 'N5';
  const foundationFirst = contentLevel === null;

  const jlptTarget = profile.goalType === 'jlpt' ? profile.targetLevel : null;
  const targetCap = jlptTarget ? toContentLevel(jlptTarget) : null;
  const ceiling: ContentLevel =
    targetCap && levelIndex(targetCap) >= levelIndex(startLevel) ? targetCap : startLevel;
  const endLevel: ContentLevel = jlptTarget ? ceiling : CONTENT_CEILING;

  const beyond =
    isBeyondContent(jlptTarget) || (!placement && isBeyondContent(profile.currentLevel));

  return {
    startLevel,
    levelRange: [startLevel, endLevel],
    foundationFirst,
    goalType: profile.goalType,
    targetLevel: profile.targetLevel,
    targetDate: profile.targetDate,
    skills: [...profile.skills],
    placementResultId: placement?.id ?? null,
    weakTopics: placement ? [...placement.weakTopics] : [],
    scopeNotice: beyond ? 'content_ceiling_n3' : null,
  };
}

/** Dạng lưu trong `learning_paths.generated_from` (data-model §2.11, khóa snake_case). */
export interface GeneratedFrom {
  start_level: ContentLevel;
  level_range: [ContentLevel, ContentLevel];
  foundation_first: boolean;
  goal_type: GoalType | null;
  target_level: TargetLevel | null;
  target_date: LocalDate | null;
  skills: Skill[];
  placement_result_id: string | null;
  weak_topics: string[];
  scope_notice: ScopeNotice | null;
}

export function toGeneratedFrom(p: PathParams): GeneratedFrom {
  return {
    start_level: p.startLevel,
    level_range: p.levelRange,
    foundation_first: p.foundationFirst,
    goal_type: p.goalType,
    target_level: p.targetLevel,
    target_date: p.targetDate,
    skills: p.skills,
    placement_result_id: p.placementResultId,
    weak_topics: p.weakTopics,
    scope_notice: p.scopeNotice,
  };
}

export function fromGeneratedFrom(g: GeneratedFrom): PathParams {
  return {
    startLevel: g.start_level,
    levelRange: g.level_range,
    foundationFirst: g.foundation_first,
    goalType: g.goal_type,
    targetLevel: g.target_level,
    targetDate: g.target_date,
    skills: g.skills,
    placementResultId: g.placement_result_id,
    weakTopics: g.weak_topics ?? [],
    scopeNotice: g.scope_notice,
  };
}

// --- Xếp hạng đơn vị ---

export interface RankableUnit {
  id: string;
  kind: Skill;
  level: ContentLevel;
  tier: UnitTier;
  goalTags: readonly string[];
  topicId: string;
  /** 1–5. */
  difficulty: number;
  estMinutes: number;
  sequence: number;
  /** Không có = coi như `active` (danh mục bộ đệm chỉ chứa đơn vị `active`). */
  status?: UnitStatus;
}

export type UnitProgressStatus = 'in_progress' | 'completed' | 'mastered';
export type RankedStatus = 'pending' | 'in_progress' | 'completed' | 'mastered';

export interface TopicStatInput {
  topicId: string;
  isWeak: boolean;
  /** −2..+2 (FR-013). */
  difficultyBias: number;
}

export interface RankedUnit<U extends RankableUnit = RankableUnit> {
  unit: U;
  status: RankedStatus;
  score: number;
}

export interface RankOptions {
  /** Giữ cả đơn vị `mastered` (xếp cuối) – dùng để hiển thị/đếm tiến độ; mặc định loại. */
  includeMastered?: boolean;
}

/** Trọng số chấm điểm (đặt tên để quy tắc đọc được và hiệu chỉnh sau dữ liệu thật). */
const W = {
  // Đơn vị đang học dở luôn đứng đầu, trên cả nền tảng chưa học: hoàn tất cái đã bắt đầu trước.
  inProgress: 2000,
  foundation: 1000,
  perLevelStep: 100,
  goalTag: 20,
  prioritizedSkill: 30,
  weakTopic: 40,
  biasPerDifficultyStep: 4,
  sequence: 0.01,
} as const;

/**
 * Tính thứ tự đơn vị cho một người học (hàm thuần, không lưu).
 *
 * Lọc: `active`, thuộc kỹ năng đã chọn, nằm trong khoảng trình độ, chưa `mastered` (trừ khi
 * `includeMastered`). Chấm điểm theo: đơn vị đang học dở, nền tảng cho người mới, trình độ gần điểm
 * xuất phát, thẻ mục tiêu, kỹ năng ưu tiên, mảng yếu, độ lệch độ khó (`difficulty_bias`) và `sequence`.
 * Đơn vị chưa hoàn thành đứng trước (theo điểm giảm dần); đơn vị đã hoàn thành rồi đến đơn vị `mastered`.
 */
export function rankUnits<U extends RankableUnit>(
  params: PathParams,
  profile: Pick<PathProfileInput, 'skills' | 'prioritizedSkill' | 'goalType'>,
  units: readonly U[],
  unitProgress: ReadonlyMap<string, UnitProgressStatus>,
  topicStats: readonly TopicStatInput[] = [],
  options: RankOptions = {},
): RankedUnit<U>[] {
  const skills = new Set<Skill>(profile.skills);
  const [lowIdx, highIdx] = [levelIndex(params.levelRange[0]), levelIndex(params.levelRange[1])];
  const startIdx = levelIndex(params.startLevel);
  const stats = new Map(topicStats.map((s) => [s.topicId, s]));
  const weakTopics = new Set<string>(params.weakTopics);
  for (const s of topicStats) if (s.isWeak) weakTopics.add(s.topicId);

  const ranked: RankedUnit<U>[] = [];
  for (const unit of units) {
    if (unit.status !== undefined && unit.status !== 'active') continue;
    if (!skills.has(unit.kind)) continue;
    const idx = levelIndex(unit.level);
    if (idx < lowIdx || idx > highIdx) continue;

    const progress = unitProgress.get(unit.id);
    if (progress === 'mastered' && !options.includeMastered) continue;
    const status: RankedStatus = progress ?? 'pending';

    let score = 0;
    if (status === 'in_progress') score += W.inProgress;
    if (params.foundationFirst && unit.tier === 'foundation') score += W.foundation;
    score -= W.perLevelStep * (idx - startIdx);
    if (profile.goalType && unit.goalTags.includes(profile.goalType)) score += W.goalTag;
    if (profile.prioritizedSkill && unit.kind === profile.prioritizedSkill) {
      score += W.prioritizedSkill;
    }
    if (weakTopics.has(unit.topicId)) score += W.weakTopic;
    const bias = stats.get(unit.topicId)?.difficultyBias ?? 0;
    score += W.biasPerDifficultyStep * bias * (unit.difficulty - 3);
    score -= unit.sequence * W.sequence;

    ranked.push({ unit, status, score });
  }

  const group = (s: RankedStatus): number => (s === 'completed' ? 1 : s === 'mastered' ? 2 : 0);
  return ranked.sort(
    (a, b) =>
      group(a.status) - group(b.status) ||
      b.score - a.score ||
      // Cùng điểm: từ vựng trước ngữ pháp, rồi theo id để kết quả tất định.
      (a.unit.kind === b.unit.kind ? 0 : a.unit.kind === 'vocabulary' ? -1 : 1) ||
      a.unit.id.localeCompare(b.unit.id),
  );
}

/** Đơn vị còn có thể học mới (chưa hoàn thành, chưa thành thạo), giữ thứ tự xếp hạng. */
export function upcomingUnits<U extends RankableUnit>(ranked: readonly RankedUnit<U>[]): U[] {
  return ranked
    .filter((r) => r.status === 'pending' || r.status === 'in_progress')
    .map((r) => r.unit);
}

/**
 * Số đơn vị mới cần học mỗi ngày để kịp mốc thời gian (chỉ để đánh giá "đúng tiến độ", FR-028; KHÔNG
 * được dùng để vượt quỹ thời gian). Trả null khi không có mốc.
 */
export function requiredUnitsPerDay(
  remainingUnits: number,
  today: LocalDate,
  targetDate: LocalDate | null,
): number | null {
  if (!targetDate) return null;
  const days = diffDays(today, targetDate);
  if (days <= 0) return remainingUnits;
  return remainingUnits / days;
}
