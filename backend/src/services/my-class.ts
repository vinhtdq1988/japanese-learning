import { notFoundGeneric } from '../api/errors.js';
import { listExemptedUnitIds, lookupUnits } from '../db/repositories/class-adjustments.js';
import { findActiveMembershipByUser } from '../db/repositories/class-memberships.js';
import {
  getLearnerOverride,
  listActiveAssignments,
  listPausesForMember,
} from '../db/repositories/class-learning.js';
import { getClassPathRow } from '../db/repositories/class-paths.js';
import { loadCompletionTimes } from '../db/repositories/class-stats.js';
import { getClassBrief } from '../db/repositories/classes.js';
import { getProfile } from '../db/repositories/profiles.js';
import { localize } from '../domain/i18n.js';
import { sharedDataDisclosure } from '../domain/org-types.js';
import { DEFAULT_LANGUAGE } from '../domain/types.js';
import { assignmentState, type AssignmentState } from '../engine/class-path.js';
import { localToday } from '../engine/clock.js';
import { isPausedOn } from '../engine/daily-plan.js';
import { getMyClassProgress } from './class-dashboard.js';
import { pendingRequestForLearner } from './class-placement.js';
import type { ServiceDeps } from './deps.js';

// "Lớp của tôi" cho học viên (spec 004, T055 + T087 + T099, api-changes §5.3, FR-024, FR-026, FR-030, FR-036):
// lớp, lộ trình lớp, bài giao kèm trạng thái, điều chỉnh của giáo viên, thông báo dữ liệu chia sẻ (CÙNG hằng
// `SHARED_DATA_V1` với màn hình lời mời) và tiến độ trong lớp (CÙNG hàm với bảng điều khiển của giáo viên).

export interface ClassPathTemplateDto {
  startLevel: string;
  targetLevel: string;
  skills: string[];
  startsOn: string;
  endsOn: string;
  dailyMinutes: number;
}

const EMPTY_PROGRESS = { hasStarted: false, minutesTotal: 0, minutesLast7Days: 0, streakDays: 0 };

export interface MyAssignmentDto {
  id: string;
  batchId: string;
  unitId: string;
  title: string;
  dueOn: string;
  state: AssignmentState;
}

export async function getMyClass(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>,
  userId: string,
) {
  const membership = await findActiveMembershipByUser(deps.db, userId);
  if (!membership) throw notFoundGeneric();
  const { organizationId, classId } = membership;
  const [brief, path, profile, override, exempted, assignments, pauses] = await Promise.all([
    getClassBrief(deps.db, organizationId, classId),
    getClassPathRow(deps.db, classId),
    getProfile(deps.db, userId),
    getLearnerOverride(deps.db, membership.id),
    listExemptedUnitIds(deps.db, membership.id),
    listActiveAssignments(deps.db, organizationId, classId),
    listPausesForMember(deps.db, classId, membership.id),
  ]);
  if (!brief || !path) throw notFoundGeneric();

  const language = profile?.language ?? DEFAULT_LANGUAGE;
  const timezone = profile?.timezone ?? deps.config.ORG_TIMEZONE;
  const today = localToday(deps.clock, timezone);
  const exemptSet = new Set(exempted);
  const mine = assignments.filter((a) => !exemptSet.has(a.unitId));

  const [progress, placementRequest, completedAt, unitTitles] = await Promise.all([
    getMyClassProgress(deps, organizationId, classId, userId),
    pendingRequestForLearner(deps.db, userId, classId),
    loadCompletionTimes(
      deps.db,
      userId,
      mine.map((a) => a.unitId),
    ),
    deps.contentCache.activeUnits(),
  ]);
  const titles = new Map(unitTitles.map((u) => [u.id, u.title]));
  const missing = mine.map((a) => a.unitId).filter((id) => !titles.has(id));
  const fallback = await lookupUnits(deps.db, missing);

  const template: ClassPathTemplateDto = {
    startLevel: path.startLevel,
    targetLevel: path.targetLevel,
    skills: path.skills,
    startsOn: path.startsOn,
    endsOn: path.endsOn,
    dailyMinutes: path.dailyMinutes,
  };
  const myAssignments: MyAssignmentDto[] = mine.map((a) => ({
    id: a.id,
    batchId: a.batchId,
    unitId: a.unitId,
    title: localize(titles.get(a.unitId) ?? fallback.get(a.unitId)?.title, language),
    dueOn: a.dueOn,
    state: assignmentState({
      dueOn: a.dueOn,
      assignedAt: a.createdAt,
      completedAt: completedAt.get(a.unitId) ?? null,
      today,
      timezone,
    }),
  }));

  return {
    class: brief,
    joinedAt: membership.joinedAt.toISOString(),
    path: template,
    assignments: myAssignments,
    // "Giáo viên đã điều chỉnh cho bạn" (FR-026): chỉ có khi giáo viên đã đặt ghi đè hoặc miễn bài.
    ...(override || exempted.length > 0
      ? {
          teacherAdjustments: {
            dailyMinutes: override?.dailyMinutes ?? null,
            shiftDays: override?.shiftDays ?? 0,
            exemptUnitIds: exempted,
          },
        }
      : {}),
    pausedToday: isPausedOn(today, pauses),
    // Thông báo sau khi bị chuyển lớp (US8, T126–T127); khóa luôn có mặt (null) để client không phải đoán lớp có
    // hỗ trợ hay không. `placementRequest` có khi lớp đang yêu cầu kiểm tra trình độ và học viên chưa nộp.
    movedNotice: null,
    placementRequest,
    disclosure: sharedDataDisclosure(language),
    // CÙNG hàm với bảng điều khiển, cùng cửa sổ từ `joinedAt` (FR-030, research O11).
    progress: progress ?? EMPTY_PROGRESS,
  };
}
