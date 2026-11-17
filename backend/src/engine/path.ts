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

/**
 * Mã thông báo phạm vi trả ở `notices` (spec 008, research D12.2): suy ra LÚC ĐỌC từ hồ sơ và tham số lộ trình,
 * không lưu vào `learning_paths.generated_from` nên lộ trình đã tồn tại cũng có.
 * - `content_ceiling_n3`: như `scopeNotice` (trình độ/mục tiêu N2, N1 bị cắt ở N3);
 * - `listening_not_available`: mục tiêu JLPT — ứng dụng chưa có phần nghe hiểu của kỳ thi (Giai đoạn 2).
 */
export type ScopeNoticeCode = ScopeNotice | 'listening_not_available';

/** Thông báo phạm vi theo thứ tự cố định: `content_ceiling_n3` (nếu có) rồi `listening_not_available` (mục tiêu JLPT). */
export function scopeNotices(
  scopeNotice: ScopeNotice | null,
  goalType: GoalType | null,
): ScopeNoticeCode[] {
  const notices: ScopeNoticeCode[] = [];
  if (scopeNotice) notices.push(scopeNotice);
  if (goalType === 'jlpt') notices.push('listening_not_available');
  return notices;
}

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
  // Điểm nền của đơn vị chưa học NGOÀI biên giới (spec 008, research D10): thấp hơn mọi điểm có thể có của
  // đơn vị trong biên giới (≈ −250 ở trường hợp xấu nhất) nên chúng luôn đứng sau, chỉ phân biệt theo
  // (trình độ, sequence).
  beyondFrontier: -10_000,
} as const;

/**
 * Biên giới thứ tự học (research D10): mỗi loại chỉ `FRONTIER_SIZE` đơn vị chưa học đầu tiên theo
 * `(trình độ, sequence)` được hưởng cộng điểm thích ứng; thích ứng chỉ hoán đổi trong các bài kế tiếp thay
 * vì nhảy tới bất kỳ đâu trong hàng trăm đơn vị.
 */
export const FRONTIER_SIZE = 3;
/** Học viên mục tiêu `work`/`daily_conversation`: nhìn trước tối đa `GOAL_LOOKAHEAD` đơn vị chưa học của loại… */
export const GOAL_LOOKAHEAD = 12;
/** …và đưa tối đa `GOAL_EXTRA` đơn vị đầu tiên mang thẻ mục tiêu trong cửa sổ đó vào biên giới. */
export const GOAL_EXTRA = 3;

/**
 * Ôn lùi có chặn cho người xếp thẳng N3 (research D11): tối đa `REMEDIAL_MAX_UNITS` đơn vị của ĐÚNG MỘT bậc dưới
 * trình độ xuất phát (N4) thuộc mảng yếu của placement được đưa vào lộ trình, bất kể trạng thái học; học xong ba
 * bài đó cũng không có bài ôn lùi thứ tư.
 */
export const REMEDIAL_MAX_UNITS = 3;
/** Chỉ người xếp N3 được ôn lùi (xếp N4/N5 hoặc `foundationFirst` thì không). */
const REMEDIAL_START_LEVEL: ContentLevel = 'N3';

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

  // Lọc điều kiện (chưa chấm điểm): cần biết toàn bộ đơn vị chưa học của từng loại để dựng biên giới.
  const remedial = remedialUnitIds(params, skills, units);
  const candidates: Candidate<U>[] = [];
  for (const unit of units) {
    if (unit.status !== undefined && unit.status !== 'active') continue;
    if (!skills.has(unit.kind)) continue;
    const idx = levelIndex(unit.level);
    const isRemedial = remedial.has(unit.id);
    if (!isRemedial && (idx < lowIdx || idx > highIdx)) continue;

    const progress = unitProgress.get(unit.id);
    if (progress === 'mastered' && !options.includeMastered) continue;
    candidates.push({ unit, status: progress ?? 'pending', idx, remedial: isRemedial });
  }
  const frontier = frontierOf(candidates, profile.goalType);

  const ranked: RankedUnit<U>[] = [];
  for (const { unit, status, idx, remedial: isRemedial } of candidates) {
    // Đơn vị chưa học ngoài biên giới: điểm chỉ phụ thuộc (trình độ, sequence) nên luôn đúng thứ tự giáo trình.
    if (status === 'pending' && !isRemedial && !frontier.has(unit.id)) {
      ranked.push({
        unit,
        status,
        score: W.beyondFrontier - W.perLevelStep * (idx - startIdx) - unit.sequence * W.sequence,
      });
      continue;
    }

    let score = 0;
    if (status === 'in_progress') score += W.inProgress;
    if (params.foundationFirst && unit.tier === 'foundation') score += W.foundation;
    // Bài ôn lùi (một bậc dưới trình độ xuất phát): điểm trình độ kẹp bằng 0 thay vì cộng thêm bậc lùi.
    if (!isRemedial) score -= W.perLevelStep * (idx - startIdx);
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

/** Ứng viên đã lọc điều kiện, chưa chấm điểm; `remedial` = bài ôn lùi (research D11). */
interface Candidate<U extends RankableUnit> {
  unit: U;
  status: RankedStatus;
  idx: number;
  remedial: boolean;
}

/**
 * Tập id đơn vị ôn lùi (research D11, bất biến I8): `REMEDIAL_MAX_UNITS` đơn vị đầu theo `(sequence, id)` của đúng
 * một bậc dưới trình độ xuất phát thuộc `params.weakTopics`, trong các kỹ năng đã chọn, bất kể trạng thái học. Rỗng khi
 * không có mảng yếu của placement, người học không xếp N3 hoặc `foundationFirst`.
 */
function remedialUnitIds<U extends RankableUnit>(
  params: PathParams,
  skills: ReadonlySet<Skill>,
  units: readonly U[],
): Set<string> {
  if (params.startLevel !== REMEDIAL_START_LEVEL || params.foundationFirst) return new Set();
  if (params.weakTopics.length === 0) return new Set();
  const weak = new Set<string>(params.weakTopics);
  const belowIdx = levelIndex(params.startLevel) - 1;
  return new Set(
    units
      .filter(
        (u) =>
          (u.status === undefined || u.status === 'active') &&
          skills.has(u.kind) &&
          levelIndex(u.level) === belowIdx &&
          weak.has(u.topicId),
      )
      .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
      .slice(0, REMEDIAL_MAX_UNITS)
      .map((u) => u.id),
  );
}

/**
 * Tập id đơn vị thuộc biên giới (research D10). Với mỗi loại: `FRONTIER_SIZE` đơn vị chưa học đầu tiên
 * theo `(trình độ, sequence)`, mọi đơn vị `in_progress`, và — chỉ khi mục tiêu là `work` hoặc
 * `daily_conversation` — tối đa `GOAL_EXTRA` đơn vị đầu tiên mang thẻ mục tiêu trong `GOAL_LOOKAHEAD` đơn vị
 * chưa học đầu tiên. Mục tiêu `jlpt` hoặc rỗng không mở rộng (mọi đơn vị đều mang thẻ `jlpt`).
 * Khi một loại còn ≤ `FRONTIER_SIZE` đơn vị chưa học, biên giới bao trùm tất cả nên kết quả bằng công thức cũ.
 */
function frontierOf<U extends RankableUnit>(
  candidates: readonly Candidate<U>[],
  goalType: GoalType | null,
): Set<string> {
  const pendingByKind = new Map<Skill, Candidate<U>[]>();
  for (const c of candidates) {
    if (c.status !== 'pending' && c.status !== 'in_progress') continue;
    // Bài ôn lùi không chiếm chỗ biên giới của loại (điểm của chúng không đi qua nhánh "ngoài biên giới").
    if (c.remedial) continue;
    const list = pendingByKind.get(c.unit.kind) ?? [];
    list.push(c);
    pendingByKind.set(c.unit.kind, list);
  }
  const goalExtends = goalType === 'work' || goalType === 'daily_conversation';
  const frontier = new Set<string>();
  for (const list of pendingByKind.values()) {
    list.sort(
      (a, b) =>
        a.idx - b.idx ||
        a.unit.sequence - b.unit.sequence ||
        // `sequence` duy nhất trong (trình độ × loại) với nội dung mới; id chỉ phá hòa với nội dung cũ.
        a.unit.id.localeCompare(b.unit.id),
    );
    for (const c of list.slice(0, FRONTIER_SIZE)) frontier.add(c.unit.id);
    for (const c of list) if (c.status === 'in_progress') frontier.add(c.unit.id);
    if (goalExtends) {
      list
        .slice(0, GOAL_LOOKAHEAD)
        .filter((c) => c.unit.goalTags.includes(goalType))
        .slice(0, GOAL_EXTRA)
        .forEach((c) => frontier.add(c.unit.id));
    }
  }
  return frontier;
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
