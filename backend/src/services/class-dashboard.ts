import { notFoundGeneric } from '../api/errors.js';
import { listClassPathUnits, type ClassPathUnitRow } from '../db/repositories/class-adjustments.js';
import {
  listActiveAssignments,
  listExemptionsForClass,
  listOverridesForClass,
  listPausesForClass,
  type ClassAssignmentRow,
  type ClassPauseRow,
} from '../db/repositories/class-learning.js';
import { getClassPathRow, type ClassPathRow } from '../db/repositories/class-paths.js';
import {
  getClassProgressFor,
  getLatestClassPlacement,
  listClassTopicAggregates,
  listDashboardMembers,
  listTopicWindows,
  loadCompletedUnits,
  loadCompletionTimes,
  loadUnitStatuses,
  type ClassActivity,
  type DashboardMember,
} from '../db/repositories/class-stats.js';
import { getClassInOrg, listClassTeacherIds } from '../db/repositories/classes.js';
import { getProfile } from '../db/repositories/profiles.js';
import { getTopicNames, getTopicSkills } from '../db/repositories/progress.js';
import { localize } from '../domain/i18n.js';
import { unionDurationSeconds } from '../domain/intervals.js';
import { DEFAULT_LANGUAGE, type LocalDate } from '../domain/types.js';
import type { ClassAlert, DashboardFilter, DashboardSort } from '../domain/org-types.js';
import { assignmentState, type AssignmentState } from '../engine/class-path.js';
import { addDays, localToday, toLocalDate } from '../engine/clock.js';
import {
  completionRatio,
  computeAlerts,
  expectedRatio,
  hasStarted,
  pathCompleted,
  progressStatus,
  replayWeakFlag,
  type ClassProgressStatus,
} from '../engine/class-progress.js';
import { absentDays, isPausedOn, type PausePeriod } from '../engine/daily-plan.js';
import { TOPIC_WINDOW } from '../engine/difficulty.js';
import { currentStreakDays } from '../engine/progress.js';
import type { CatalogUnit } from './content-cache.js';
import {
  contentNoticesOf,
  languageOf,
  loadRequiredUnits,
  type ContentNoticeDto,
} from './class-path.js';
import type { ServiceDeps } from './deps.js';
import { secondsToMinutes } from './lesson-session.js';
import type { OrgContext } from './org-access.js';

// Bảng điều khiển lớp và chi tiết học viên (spec 004, T085, US4, research O10/O11/O13, FR-027 → FR-030, FR-035).
// Số liệu TÍNH khi đọc từ bản ghi học thật (không bảng số liệu lưu sẵn), chỉ kể từ `joined_at` của từng học viên.
// DTO dựng bằng DANH SÁCH TRẮNG theo FR-035: không mật khẩu/phiên, không hồ sơ cá nhân ngoài danh sách, không
// từng câu trả lời.

type DashDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** `LearnerOverride` của OpenAPI. */
export interface LearnerOverrideDto {
  dailyMinutes: number | null;
  shiftDays: number;
  exemptUnitIds: string[];
}

/** `ClassLearnerRow` của OpenAPI – danh sách trắng FR-035. */
export interface ClassLearnerRowDto {
  userId: string;
  displayName: string;
  email: string;
  joinedAt: string;
  hasStarted: boolean;
  pathCompleted: boolean;
  completionRatio: number | null;
  expectedRatio: number;
  streakDays: number;
  minutesLast7Days: number;
  minutesTotal: number;
  reviewAccuracy: number | null;
  lastActiveOn: LocalDate | null;
  progressStatus: ClassProgressStatus;
  alerts: ClassAlert[];
  absentDays: number;
  overrides?: LearnerOverrideDto;
}

/** Khối "tiến độ trong lớp" của học viên (`MyClass.progress`): cùng nguồn với dòng bảng điều khiển. */
export interface ClassProgressBlock {
  hasStarted: boolean;
  completionRatio: number | null;
  minutesTotal: number;
  minutesLast7Days: number;
  reviewAccuracy: number | null;
  streakDays: number;
  lastActiveOn: LocalDate | null;
}

/** Dữ liệu cấu trúc của lớp dùng chung cho mọi học viên (đọc MỘT lần mỗi request). */
interface ClassSnapshot {
  /** Ngưỡng vắng mặt của lớp (`classes.absence_threshold_days`). */
  absenceThresholdDays: number;
  path: ClassPathRow;
  explicit: ClassPathUnitRow[];
  required: readonly CatalogUnit[];
  pauses: ClassPauseRow[];
  overrides: Awaited<ReturnType<typeof listOverridesForClass>>;
  exemptions: Awaited<ReturnType<typeof listExemptionsForClass>>;
  assignments: ClassAssignmentRow[];
}

async function loadSnapshot(
  deps: DashDeps,
  organizationId: string,
  classId: string,
): Promise<ClassSnapshot | null> {
  const [cls, path] = await Promise.all([
    getClassInOrg(deps.db, organizationId, classId),
    getClassPathRow(deps.db, classId),
  ]);
  if (!cls || !path) return null;
  const explicit = await listClassPathUnits(deps.db, organizationId, classId);
  const [required, pauses, overrides, exemptions, assignments] = await Promise.all([
    loadRequiredUnits(deps, path, explicit),
    listPausesForClass(deps.db, organizationId, classId),
    listOverridesForClass(deps.db, organizationId, classId),
    listExemptionsForClass(deps.db, organizationId, classId),
    listActiveAssignments(deps.db, organizationId, classId),
  ]);
  return {
    absenceThresholdDays: cls.absenceThresholdDays,
    path,
    explicit,
    required,
    pauses,
    overrides,
    exemptions,
    assignments,
  };
}

/** Một học viên đã tính xong: dòng DTO kèm các đại lượng trung gian dùng cho chi tiết/lọc. */
interface ComputedLearner {
  member: DashboardMember;
  row: ClassLearnerRowDto;
  today: LocalDate;
  paused: boolean;
  pauses: PausePeriod[];
  exempt: ReadonlySet<string>;
  activity: ClassActivity;
  completed: ReadonlySet<string>;
}

const NO_ACTIVITY: ClassActivity = {
  recordCount: 0,
  reviewCorrect: 0,
  reviewTotal: 0,
  activeDays: new Set(),
  intervals: [],
};

function computeLearner(
  deps: DashDeps,
  snapshot: ClassSnapshot,
  member: DashboardMember,
  activity: ClassActivity,
  completed: ReadonlySet<string>,
): ComputedLearner {
  const today = localToday(deps.clock, member.timezone);
  const pauses: PausePeriod[] = snapshot.pauses.filter(
    (p) => p.membershipId === null || p.membershipId === member.membershipId,
  );
  const override = snapshot.overrides.get(member.membershipId);
  const shiftDays = override?.shiftDays ?? 0;
  const exempt = snapshot.exemptions.get(member.membershipId) ?? new Set<string>();

  const requiredIds = snapshot.required.filter((u) => !exempt.has(u.id)).map((u) => u.id);
  const ratio = completionRatio(requiredIds, completed);
  const expected = expectedRatio({
    startsOn: snapshot.path.startsOn,
    endsOn: snapshot.path.endsOn,
    shiftDays,
    pauses,
    today,
  });
  const paused = isPausedOn(today, pauses);
  const hasOverdueAssignment = snapshot.assignments.some(
    (a) => !exempt.has(a.unitId) && a.dueOn < today && !completed.has(a.unitId),
  );
  const status = progressStatus({
    completionRatio: ratio,
    expectedRatio: expected,
    margin: deps.config.CLASS_PROGRESS_MARGIN_PCT / 100,
    paused,
    hasOverdueAssignment,
  });

  const days = [...activity.activeDays];
  const lastActiveOn = days.length > 0 ? days.reduce((a, b) => (a > b ? a : b)) : null;
  const since7 = addDays(today, -6);
  const joinedLocal = toLocalDate(member.joinedAt, member.timezone);
  // Số ngày vắng tính từ hôm qua để ngày hôm nay chưa học không bị tính là vắng thêm (research O10).
  const absent = absentDays(lastActiveOn ?? joinedLocal, addDays(today, -1), pauses);

  const row: ClassLearnerRowDto = {
    userId: member.userId,
    displayName: member.displayName,
    email: member.email,
    joinedAt: member.joinedAt.toISOString(),
    hasStarted: hasStarted(activity.recordCount),
    pathCompleted: pathCompleted(ratio),
    completionRatio: ratio === null ? null : round3(ratio),
    expectedRatio: round3(expected),
    streakDays: currentStreakDays(activity.activeDays, today, pauses),
    minutesLast7Days: secondsToMinutes(
      unionDurationSeconds(activity.intervals.filter((i) => i.localDate >= since7)),
    ),
    minutesTotal: secondsToMinutes(unionDurationSeconds(activity.intervals)),
    reviewAccuracy:
      activity.reviewTotal > 0 ? round3(activity.reviewCorrect / activity.reviewTotal) : null,
    lastActiveOn,
    progressStatus: status,
    alerts: computeAlerts({
      progressStatus: status,
      absentDays: absent,
      threshold: snapshot.absenceThresholdDays,
      hasOverdueAssignment,
      paused,
    }),
    absentDays: absent,
  };
  if (override || exempt.size > 0) {
    row.overrides = {
      dailyMinutes: override?.dailyMinutes ?? null,
      shiftDays,
      exemptUnitIds: [...exempt],
    };
  }
  return { member, row, today, paused, pauses, exempt, activity, completed };
}

/** Tính toàn bộ học viên của lớp bằng số truy vấn KHÔNG phụ thuộc số học viên. */
async function computeLearners(
  deps: DashDeps,
  snapshot: ClassSnapshot,
  members: readonly DashboardMember[],
): Promise<ComputedLearner[]> {
  const userIds = members.map((m) => m.userId);
  const [activities, completedByUser] = await Promise.all([
    getClassProgressFor(deps.db, userIds),
    loadCompletedUnits(deps.db, userIds),
  ]);
  return members.map((m) =>
    computeLearner(
      deps,
      snapshot,
      m,
      activities.get(m.userId) ?? NO_ACTIVITY,
      completedByUser.get(m.userId) ?? new Set<string>(),
    ),
  );
}

/** `MyClass.progress`: tách từ dòng bảng điều khiển để cùng nguồn, cùng cửa sổ từ `joinedAt` (FR-030). */
export function progressBlockOf(row: ClassLearnerRowDto): ClassProgressBlock {
  return {
    hasStarted: row.hasStarted,
    completionRatio: row.completionRatio,
    minutesTotal: row.minutesTotal,
    minutesLast7Days: row.minutesLast7Days,
    reviewAccuracy: row.reviewAccuracy,
    streakDays: row.streakDays,
    lastActiveOn: row.lastActiveOn,
  };
}

/**
 * Tiến độ trong lớp của chính học viên (cho `GET /me/class`): CÙNG hàm tính với bảng điều khiển. `null` nếu lớp
 * chưa có lộ trình hoặc tài khoản không còn là thành viên hoạt động.
 */
export async function getMyClassProgress(
  deps: DashDeps,
  organizationId: string,
  classId: string,
  userId: string,
): Promise<ClassProgressBlock | null> {
  const snapshot = await loadSnapshot(deps, organizationId, classId);
  if (!snapshot) return null;
  const members = await listDashboardMembers(deps.db, organizationId, classId, userId);
  const [computed] = await computeLearners(deps, snapshot, members);
  return computed ? progressBlockOf(computed.row) : null;
}

// --- Sắp xếp và lọc ---

const STATUS_ORDER: Record<ClassProgressStatus, number> = {
  behind: 0,
  paused: 1,
  on_track: 2,
  ahead: 3,
};

function sortValue(row: ClassLearnerRowDto, sort: DashboardSort): number | string | null {
  switch (sort) {
    case 'name':
      return row.displayName;
    case 'completion':
      return row.completionRatio;
    case 'streak':
      return row.streakDays;
    case 'minutes7':
      return row.minutesLast7Days;
    case 'accuracy':
      return row.reviewAccuracy;
    case 'lastActive':
      return row.lastActiveOn;
    case 'status':
      return STATUS_ORDER[row.progressStatus];
  }
}

function compareValues(a: number | string | null, b: number | string | null): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'vi');
  return Number(a) - Number(b);
}

/** Sắp xếp ổn định; giá trị rỗng (`null`) luôn xếp cuối dù tăng hay giảm, hòa thì theo `userId`. */
function sortRows(
  rows: ClassLearnerRowDto[],
  sort: DashboardSort,
  order: 'asc' | 'desc',
): ClassLearnerRowDto[] {
  const sign = order === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort);
    const vb = sortValue(b, sort);
    if (va === null && vb !== null) return 1;
    if (va !== null && vb === null) return -1;
    const diff = va === null || vb === null ? 0 : compareValues(va, vb);
    return diff !== 0 ? sign * diff : a.userId.localeCompare(b.userId);
  });
}

function matchesFilter(row: ClassLearnerRowDto, filter: DashboardFilter): boolean {
  switch (filter) {
    case 'behind':
      return row.progressStatus === 'behind';
    case 'paused':
      return row.progressStatus === 'paused';
    case 'not_started':
      return !row.hasStarted;
    case 'absent':
      return row.alerts.includes('absent');
    case 'needs_attention':
      return row.alerts.length > 0;
  }
}

// --- Bảng điều khiển ---

export interface ClassDashboardDto {
  classId: string;
  learners: ClassLearnerRowDto[];
  summary: {
    learnerCount: number;
    onTrack: number;
    behind: number;
    ahead: number;
    paused: number;
    needAttention: number;
    avgCompletionRatio: number | null;
    avgReviewAccuracy: number | null;
  };
  contentNotices: ContentNoticeDto[];
  teacherlessWarning: boolean;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round3(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * `GET /classes/{id}/dashboard`. `summary` luôn tính trên CẢ lớp; `filter` chỉ lọc danh sách `learners`.
 * Lớp chưa có lộ trình (không có mẫu số/mốc) ⇒ danh sách rỗng.
 */
export async function getDashboard(
  deps: DashDeps,
  ctx: OrgContext,
  classId: string,
  options: { sort?: DashboardSort; order?: 'asc' | 'desc'; filter?: DashboardFilter } = {},
): Promise<ClassDashboardDto> {
  const snapshot = await loadSnapshot(deps, ctx.organizationId, classId);
  const [members, teacherIds] = await Promise.all([
    snapshot ? listDashboardMembers(deps.db, ctx.organizationId, classId) : Promise.resolve([]),
    listClassTeacherIds(deps.db, ctx.organizationId, classId),
  ]);
  const computed = snapshot ? await computeLearners(deps, snapshot, members) : [];
  const rows = computed.map((c) => c.row);

  const count = (status: ClassProgressStatus) =>
    rows.filter((r) => r.progressStatus === status).length;
  const filtered = options.filter ? rows.filter((r) => matchesFilter(r, options.filter!)) : rows;
  return {
    classId,
    learners: sortRows(filtered, options.sort ?? 'name', options.order ?? 'asc'),
    summary: {
      learnerCount: rows.length,
      onTrack: count('on_track'),
      behind: count('behind'),
      ahead: count('ahead'),
      paused: count('paused'),
      needAttention: rows.filter((r) => r.alerts.length > 0).length,
      avgCompletionRatio: mean(
        rows.flatMap((r) => (r.completionRatio === null ? [] : [r.completionRatio])),
      ),
      avgReviewAccuracy: mean(
        rows.flatMap((r) => (r.reviewAccuracy === null ? [] : [r.reviewAccuracy])),
      ),
    },
    contentNotices: snapshot
      ? await contentNoticesOf(
          deps,
          snapshot.explicit,
          snapshot.assignments,
          await languageOf(deps, ctx.userId),
        )
      : [],
    teacherlessWarning: teacherIds.length === 0,
  };
}

/**
 * Số học viên cần chú ý của lớp (`ClassRow.needAttentionCount`): CÙNG hàm tính với bảng điều khiển. Lớp chưa có
 * lộ trình ⇒ 0.
 */
export async function countNeedAttention(
  deps: DashDeps,
  organizationId: string,
  classId: string,
): Promise<number> {
  const snapshot = await loadSnapshot(deps, organizationId, classId);
  if (!snapshot) return 0;
  const members = await listDashboardMembers(deps.db, organizationId, classId);
  const computed = await computeLearners(deps, snapshot, members);
  return computed.filter((c) => c.row.alerts.length > 0).length;
}

// --- Chi tiết một học viên ---

export interface ClassLearnerDetailDto {
  userId: string;
  displayName: string;
  row: ClassLearnerRowDto;
  units: {
    unitId: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'mastered' | 'exempt';
    dueOn: LocalDate | null;
  }[];
  dailyMinutes30: { date: LocalDate; minutes: number }[];
  reviewAccuracy: number | null;
  weakTopics: { topicId: string; name: string; accuracy: number; answers: number }[];
  placement: { estimatedLevel: string; score: number; total: number; takenAt: string } | null;
  assignmentStates: { assignmentId: string; state: AssignmentState }[];
}

/**
 * `GET /classes/{id}/members/{userId}/detail`. 404 chung nếu người đó KHÔNG phải thành viên HIỆN TẠI của lớp
 * (đã rời/bị gỡ/mất seat/xóa tài khoản ⇒ mất quyền xem ngay, SC-008). Không có từng câu trả lời (FR-035).
 */
export async function getLearnerDetail(
  deps: DashDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
): Promise<ClassLearnerDetailDto> {
  return (await loadLearnerDetail(deps, ctx, classId, userId)).detail;
}

/** Chi tiết học viên kèm dữ liệu phụ chỉ dùng cho xuất CSV (không nằm trong DTO của OpenAPI). */
export interface LearnerDetailBundle {
  detail: ClassLearnerDetailDto;
  /** `kind/level` của từng đơn vị bắt buộc (cột `extra` của mục `unit`). */
  unitMeta: Map<string, string>;
  /** Bài giao của học viên (đã loại bài được miễn) kèm tên đơn vị, hạn và trạng thái. */
  assignmentRows: { title: string; dueOn: LocalDate; state: AssignmentState }[];
  /** Múi giờ của học viên (ngày vào lớp tính theo múi giờ này). */
  timezone: string;
}

export async function loadLearnerDetail(
  deps: DashDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
): Promise<LearnerDetailBundle> {
  const members = await listDashboardMembers(deps.db, ctx.organizationId, classId, userId);
  const member = members[0];
  if (!member) throw notFoundGeneric();
  const snapshot = await loadSnapshot(deps, ctx.organizationId, classId);
  if (!snapshot) throw notFoundGeneric();

  const [learner] = await computeLearners(deps, snapshot, [member]);
  if (!learner) throw notFoundGeneric();

  const assignments = snapshot.assignments.filter((a) => !learner.exempt.has(a.unitId));
  const [statuses, completionTimes, windows, placement, profile] = await Promise.all([
    loadUnitStatuses(deps.db, userId),
    loadCompletionTimes(
      deps.db,
      userId,
      assignments.map((a) => a.unitId),
    ),
    listTopicWindows(deps.db, [userId], TOPIC_WINDOW),
    getLatestClassPlacement(deps.db, userId),
    getProfile(deps.db, ctx.userId),
  ]);
  const language = profile?.language ?? DEFAULT_LANGUAGE;

  const weak = windows
    .map((w) => ({ topicId: w.topicId, ...replayWeakFlag(w.results) }))
    .filter((w) => w.weak);
  const names = await getTopicNames(
    deps.db,
    weak.map((w) => w.topicId),
  );

  const dueByUnit = new Map<string, LocalDate>();
  for (const a of snapshot.assignments) {
    const known = dueByUnit.get(a.unitId);
    if (!known || a.dueOn < known) dueByUnit.set(a.unitId, a.dueOn);
  }

  const states = assignments.map((a) =>
    assignmentState({
      dueOn: a.dueOn,
      assignedAt: a.createdAt,
      completedAt: completionTimes.get(a.unitId) ?? null,
      today: learner.today,
      timezone: member.timezone,
    }),
  );
  // Bài giao có thể nằm ngoài tập bắt buộc (chế độ mẫu) nên tra tên trong cả danh mục đang hoạt động.
  const titleOf = new Map(
    (await deps.contentCache.activeUnits()).map((u) => [u.id, localize(u.title, language)]),
  );
  const detail: ClassLearnerDetailDto = {
    userId,
    displayName: member.displayName,
    row: learner.row,
    units: snapshot.required.map((u) => ({
      unitId: u.id,
      title: localize(u.title, language),
      status: learner.exempt.has(u.id) ? 'exempt' : (statuses.get(u.id) ?? 'pending'),
      dueOn: dueByUnit.get(u.id) ?? null,
    })),
    dailyMinutes30: dailyMinutesOf(learner, 30),
    reviewAccuracy: learner.row.reviewAccuracy,
    weakTopics: weak
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || a.topicId.localeCompare(b.topicId))
      .map((w) => ({
        topicId: w.topicId,
        name: localize(names.get(w.topicId), language),
        accuracy: round3(w.accuracy ?? 0),
        answers: w.answers,
      })),
    placement: placement
      ? {
          estimatedLevel: placement.estimatedLevel,
          score: placement.score,
          total: placement.total,
          takenAt: placement.takenAt.toISOString(),
        }
      : null,
    assignmentStates: assignments.map((a, i) => ({ assignmentId: a.id, state: states[i]! })),
  };
  return {
    detail,
    unitMeta: new Map(snapshot.required.map((u) => [u.id, `${u.kind}/${u.level}`])),
    assignmentRows: assignments.map((a, i) => ({
      title: titleOf.get(a.unitId) ?? a.unitId,
      dueOn: a.dueOn,
      state: states[i]!,
    })),
    timezone: member.timezone,
  };
}

/** Phút học mỗi ngày trong `days` ngày gần nhất tính đến hôm nay (cũ → mới), kể cả ngày 0 phút. */
function dailyMinutesOf(
  learner: ComputedLearner,
  days: number,
): { date: LocalDate; minutes: number }[] {
  const byDay = new Map<LocalDate, typeof learner.activity.intervals>();
  for (const interval of learner.activity.intervals) {
    const list = byDay.get(interval.localDate) ?? [];
    list.push(interval);
    byDay.set(interval.localDate, list);
  }
  const result: { date: LocalDate; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(learner.today, -i);
    result.push({ date, minutes: secondsToMinutes(unionDurationSeconds(byDay.get(date) ?? [])) });
  }
  return result;
}

// --- Chủ đề yếu của cả lớp (US7, FR-032) ---

export interface ClassWeakTopicDto {
  topicId: string;
  name: string;
  skill: string;
  /** Độ chính xác gộp của cả lớp trên lượt chính kể từ khi từng người vào lớp (0–1). */
  accuracy: number;
  answers: number;
  /** Học viên đang bị gắn cờ yếu ở chủ đề này (cửa sổ ≤ `TOPIC_WINDOW` kết quả mới nhất kể từ `joined_at`). */
  flaggedLearners: { userId: string; displayName: string }[];
}

/**
 * `GET /classes/{id}/weak-topics`: chủ đề có ≥ `CLASS_WEAK_MIN_ANSWERS` lượt chính và độ chính xác gộp
 * < `CLASS_WEAK_ACCURACY_PCT`, xếp theo độ chính xác tăng dần (mức yếu giảm dần). Cờ yếu từng học viên phát lại
 * bằng `nextWeakFlag` của engine độ khó, KHÔNG dùng `topic_stats.is_weak` vì nó có thể gồm kết quả trước khi
 * vào lớp. Chỉ trả tổng hợp, không có từng câu trả lời (FR-035).
 */
export async function getClassWeakTopics(
  deps: DashDeps,
  ctx: OrgContext,
  classId: string,
): Promise<ClassWeakTopicDto[]> {
  const members = await listDashboardMembers(deps.db, ctx.organizationId, classId);
  const userIds = members.map((m) => m.userId);
  const aggregates = await listClassTopicAggregates(deps.db, userIds);
  const minAnswers = deps.config.CLASS_WEAK_MIN_ANSWERS;
  const threshold = deps.config.CLASS_WEAK_ACCURACY_PCT / 100;
  const weak = aggregates
    .filter((a) => a.answers >= minAnswers && a.correct / a.answers < threshold)
    .map((a) => ({ ...a, accuracy: a.correct / a.answers }));
  if (weak.length === 0) return [];

  const topicIds = weak.map((w) => w.topicId);
  const [windows, names, skills, profile] = await Promise.all([
    listTopicWindows(deps.db, userIds, TOPIC_WINDOW),
    getTopicNames(deps.db, topicIds),
    getTopicSkills(deps.db, topicIds),
    getProfile(deps.db, ctx.userId),
  ]);
  const language = profile?.language ?? DEFAULT_LANGUAGE;
  const displayNames = new Map(members.map((m) => [m.userId, m.displayName]));
  const flaggedByTopic = new Map<string, { userId: string; displayName: string }[]>();
  for (const w of windows) {
    if (!replayWeakFlag(w.results).weak) continue;
    const list = flaggedByTopic.get(w.topicId) ?? [];
    list.push({ userId: w.userId, displayName: displayNames.get(w.userId) ?? '' });
    flaggedByTopic.set(w.topicId, list);
  }
  return weak
    .sort((a, b) => a.accuracy - b.accuracy || a.topicId.localeCompare(b.topicId))
    .map((w) => ({
      topicId: w.topicId,
      name: localize(names.get(w.topicId), language),
      skill: skills.get(w.topicId) ?? '',
      accuracy: round3(w.accuracy),
      answers: w.answers,
      flaggedLearners: (flaggedByTopic.get(w.topicId) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'vi'),
      ),
    }));
}
