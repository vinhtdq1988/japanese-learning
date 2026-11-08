import { listClassPathUnits, listExemptedUnitIds } from '../db/repositories/class-adjustments.js';
import { findActiveMembershipByUser } from '../db/repositories/class-memberships.js';
import {
  getLearnerOverride,
  listActiveAssignments,
  listPausesForMember,
  type LearnerOverrideRow,
} from '../db/repositories/class-learning.js';
import { getClassPathRow } from '../db/repositories/class-paths.js';
import { getClassBrief } from '../db/repositories/classes.js';
import {
  getActivePath,
  loadTopicStats,
  loadUnitProgress,
  type LearningPathRow,
} from '../db/repositories/paths.js';
import { getProfile, type ProfileRow } from '../db/repositories/profiles.js';
import type { ClassMembershipRow } from '../db/repositories/class-memberships.js';
import { localToday } from '../engine/clock.js';
import { classPathParams, rankClassUnits } from '../engine/class-path.js';
import type {
  AssignmentInput,
  ClassPathTemplateInput,
  ExplicitPathUnit,
} from '../engine/class-path.js';
import { isPausedOn, type PausePeriod } from '../engine/daily-plan.js';
import type { PathParams, RankedUnit } from '../engine/path.js';
import type { CatalogUnit } from './content-cache.js';
import type { ServiceDeps } from './deps.js';
import { loadOrgContext } from './org-access.js';
import { paramsOfPath, rankForUser, type ReadDeps } from './path.js';

export { clearPendingTodayPlan } from './plan-reset.js';

// Điểm DUY NHẤT chọn nguồn học (spec 004, research O6, FR-017, FR-021, FR-041). Hồ sơ và lộ trình cá nhân
// KHÔNG bị sửa khi vào/rời lớp: khi thuộc lớp, hồ sơ cá nhân được CHỒNG một "hồ sơ hiệu lực" TRONG BỘ NHỚ (phút,
// kỹ năng, tạm dừng của lớp) nên rời lớp là đóng thành viên và mọi thứ cá nhân tự nguyên vẹn — "tạm ngưng không
// xóa". Người học không thuộc lớp đi nhánh `personal` với đúng hành vi cũ.

type ContextDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;

export interface PersonalLearningContext {
  source: 'personal';
  profile: ProfileRow;
  path: LearningPathRow;
  params: PathParams;
}

export interface ClassLearningContext {
  source: 'class';
  /** Hồ sơ cá nhân ghi đè trong bộ nhớ: phút = ghi đè ?? phút lớp, kỹ năng lớp, không ưu tiên/mục tiêu. */
  profile: ProfileRow;
  params: PathParams;
  template: ClassPathTemplateInput;
  classInfo: { id: string; name: string; organizationId: string; organizationName: string };
  membership: ClassMembershipRow;
  override: LearnerOverrideRow | null;
  /** Khoảng tạm dừng áp dụng (cả lớp + riêng người học); `pause_periods` cá nhân bị bỏ qua trong lớp (O9). */
  pauses: PausePeriod[];
  /** Danh sách đơn vị giáo viên chọn (chế độ liệt kê); rỗng ⇒ chế độ mẫu. */
  explicit: ExplicitPathUnit[];
  /** Đơn vị được miễn cho riêng người học này (gắn với giai đoạn thành viên hiện tại). */
  exemptions: Set<string>;
  /** Bài giao còn hiệu lực của lớp. */
  assignments: AssignmentInput[];
  /** Hôm nay theo múi giờ của người học (khóa theo ngày mở, phân loại bài giao quá hạn). */
  today: string;
}

export type LearningContext = PersonalLearningContext | ClassLearningContext;

/**
 * Nguồn học của người học. `null` khi người học cá nhân chưa hoàn tất onboarding (chưa có lộ trình). Người học
 * thuộc lớp luôn có ngữ cảnh (coi như đã onboarding). Khi phát hiện giấy phép quá hạn chưa xử lý, `loadOrgContext`
 * gọi `processOrgLapse` ngay (có thể đóng thành viên lớp) nên nguồn học đổi tức thì (SC-008).
 */
export async function resolveLearningContext(
  deps: ContextDeps,
  userId: string,
): Promise<LearningContext | null> {
  let membership = await findActiveMembershipByUser(deps.db, userId);
  if (membership) {
    await loadOrgContext(deps, userId);
    membership = await findActiveMembershipByUser(deps.db, userId);
  }
  const profile = await getProfile(deps.db, userId);
  if (!profile) return null;

  if (membership) {
    const classContext = await buildClassContext(deps, profile, membership);
    if (classContext) return classContext;
  }

  const path = await getActivePath(deps.db, userId);
  if (!path || profile.onboardingState !== 'completed') return null;
  return { source: 'personal', profile, path, params: paramsOfPath(path) };
}

async function buildClassContext(
  deps: ContextDeps,
  profile: ProfileRow,
  membership: ClassMembershipRow,
): Promise<ClassLearningContext | null> {
  const [classPath, brief, override, pauses, explicit, exempted, assignments] = await Promise.all([
    getClassPathRow(deps.db, membership.classId),
    getClassBrief(deps.db, membership.organizationId, membership.classId),
    getLearnerOverride(deps.db, membership.id),
    listPausesForMember(deps.db, membership.classId, membership.id),
    listClassPathUnits(deps.db, membership.organizationId, membership.classId),
    listExemptedUnitIds(deps.db, membership.id),
    listActiveAssignments(deps.db, membership.organizationId, membership.classId),
  ]);
  // Thành viên luôn gắn với lớp có lộ trình (điều kiện vào lớp); thiếu dữ liệu thì rơi về nhánh cá nhân.
  if (!classPath || !brief) return null;

  const template: ClassPathTemplateInput = {
    startLevel: classPath.startLevel,
    targetLevel: classPath.targetLevel,
    skills: classPath.skills,
    startsOn: classPath.startsOn,
    endsOn: classPath.endsOn,
    dailyMinutes: classPath.dailyMinutes,
  };
  const today = localToday(deps.clock, profile.timezone);
  const effective: ProfileRow = {
    ...profile,
    dailyMinutes: override?.dailyMinutes ?? classPath.dailyMinutes,
    skills: classPath.skills,
    prioritizedSkill: null,
    goalType: null,
    targetDate: classPath.endsOn,
    paused: isPausedOn(today, pauses),
    onboardingState: 'completed',
  };
  return {
    source: 'class',
    profile: effective,
    params: classPathParams(template),
    template,
    classInfo: {
      id: brief.id,
      name: brief.name,
      organizationId: membership.organizationId,
      organizationName: brief.organizationName,
    },
    membership,
    override: override ?? null,
    pauses,
    explicit,
    exemptions: new Set(exempted),
    assignments: assignments.map((a) => ({ unitId: a.unitId, dueOn: a.dueOn })),
    today,
  };
}

/**
 * Danh sách đơn vị đã xếp hạng cho người học theo nguồn: cá nhân dùng `rankForUser` (đúng như cũ), lớp dùng
 * `rankClassUnits` (chế độ mẫu hoặc liệt kê, kèm miễn bài, bài giao, ngày mở). Mặc định loại đơn vị `mastered` như `rankUnits`; `includeMastered` giữ lại để
 * hiển thị/đếm tiến độ.
 */
export async function rankForContext(
  deps: ReadDeps,
  userId: string,
  ctx: LearningContext,
  options: { includeMastered?: boolean } = {},
): Promise<RankedUnit<CatalogUnit>[]> {
  if (ctx.source === 'personal') {
    return rankForUser(deps, userId, ctx.profile, ctx.params, options);
  }
  const [units, progress, stats] = await Promise.all([
    deps.contentCache.activeUnits(),
    loadUnitProgress(deps.db, userId),
    loadTopicStats(deps.db, userId),
  ]);
  const { ranked } = rankClassUnits({
    template: ctx.template,
    units,
    unitProgress: progress,
    topicStats: stats,
    explicit: ctx.explicit,
    exemptions: ctx.exemptions,
    assignments: ctx.assignments,
    today: ctx.today,
  });
  return options.includeMastered ? ranked : ranked.filter((r) => r.status !== 'mastered');
}
