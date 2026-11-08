import { logOrgAction } from '../db/repositories/admin-logs.js';
import { getClassInOrg } from '../db/repositories/classes.js';
import { listDashboardMembers } from '../db/repositories/class-stats.js';
import { toCsv } from '../domain/csv.js';
import { notFoundGeneric } from '../api/errors.js';
import { toLocalDate } from '../engine/clock.js';
import { getDashboard, loadLearnerDetail, type ClassLearnerRowDto } from './class-dashboard.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';

// Xuất báo cáo lớp ra CSV (spec 004, T119, US7, FR-033, contracts/csv-formats.md §2–§4). DÙNG CHUNG dữ liệu với
// bảng điều khiển/chi tiết học viên (`getDashboard`, `loadLearnerDetail`) nên số liệu trong tệp khớp màn hình
// (SC-009); mọi ô chuỗi đi qua `csvCell` (chống công thức) trong `toCsv`. Mỗi lần xuất ghi `class.export`.

type ExportDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

export interface CsvExport {
  filename: string;
  body: string;
}

/** Tiêu đề tiếng Anh cố định, thứ tự cố định (csv-formats.md §2). */
export const CLASS_EXPORT_COLUMNS = [
  'display_name',
  'email',
  'joined_on',
  'status',
  'alerts',
  'completion_percent',
  'expected_percent',
  'streak_days',
  'minutes_last_7_days',
  'minutes_total',
  'review_accuracy_percent',
  'last_active_on',
  'absent_days',
] as const;

/** Tỷ lệ 0–1 → phần trăm 1 chữ số thập phân; `null` giữ nguyên (ô rỗng). */
const percent = (ratio: number | null): number | null =>
  ratio === null ? null : Math.round(ratio * 1000) / 10;
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;

/** Tên tệp `class-<tên-lớp-đã-làm-sạch>-<YYYY-MM-DD>.csv`; tên rỗng sau khi làm sạch ⇒ chỉ còn `class-<ngày>`. */
export function exportFilename(className: string, date: string): string {
  const slug = className
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `class-${slug}-${date}.csv` : `class-${date}.csv`;
}

function classRow(row: ClassLearnerRowDto, joinedOn: string): (string | number | null)[] {
  return [
    row.displayName,
    row.email,
    joinedOn,
    row.hasStarted ? row.progressStatus : 'not_started',
    row.alerts.join('|'),
    percent(row.completionRatio),
    percent(row.expectedRatio),
    row.streakDays,
    oneDecimal(row.minutesLast7Days),
    oneDecimal(row.minutesTotal),
    percent(row.reviewAccuracy),
    row.lastActiveOn,
    row.absentDays,
  ];
}

/** `GET /classes/{id}/export.csv`: mỗi học viên đang hoạt động một dòng. */
export async function exportClassCsv(
  deps: ExportDeps,
  ctx: OrgContext,
  classId: string,
): Promise<CsvExport> {
  const cls = await getClassInOrg(deps.db, ctx.organizationId, classId);
  if (!cls) throw notFoundGeneric();
  const [dashboard, members] = await Promise.all([
    getDashboard(deps, ctx, classId),
    listDashboardMembers(deps.db, ctx.organizationId, classId),
  ]);
  const timezoneOf = new Map(members.map((m) => [m.userId, m.timezone]));
  const rows = dashboard.learners.map((l) =>
    classRow(
      l,
      toLocalDate(new Date(l.joinedAt), timezoneOf.get(l.userId) ?? deps.config.ORG_TIMEZONE),
    ),
  );
  await deps.db.transaction(async (tx) => {
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.export',
      targetType: 'class',
      targetId: classId,
      diff: { type: 'class' },
    });
  });
  const today = toLocalDate(deps.clock.now(), deps.config.ORG_TIMEZONE);
  return {
    filename: exportFilename(cls.name, today),
    body: toCsv([[...CLASS_EXPORT_COLUMNS], ...rows]),
  };
}

/**
 * `GET /classes/{id}/members/{userId}/export.csv`: dạng "dài" `section,label,value,extra`. Người không phải
 * thành viên HIỆN TẠI ⇒ 404 chung (đã rời lớp thì mất quyền xem ngay, SC-008).
 */
export async function exportLearnerCsv(
  deps: ExportDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
): Promise<CsvExport> {
  const cls = await getClassInOrg(deps.db, ctx.organizationId, classId);
  if (!cls) throw notFoundGeneric();
  const { detail, unitMeta, assignmentRows } = await loadLearnerDetail(deps, ctx, classId, userId);
  const { row } = detail;

  const lines: (string | number | null)[][] = [['section', 'label', 'value', 'extra']];
  lines.push(['summary', 'completion_percent', percent(row.completionRatio), null]);
  lines.push(['summary', 'streak_days', row.streakDays, null]);
  lines.push(['summary', 'minutes_total', oneDecimal(row.minutesTotal), null]);
  lines.push(['summary', 'review_accuracy_percent', percent(row.reviewAccuracy), null]);
  for (const u of detail.units)
    lines.push(['unit', u.title, u.status, unitMeta.get(u.unitId) ?? null]);
  for (const a of assignmentRows) lines.push(['assignment', a.title, a.state, a.dueOn]);
  for (const d of detail.dailyMinutes30)
    lines.push(['daily_minutes', d.date, oneDecimal(d.minutes), null]);
  for (const w of detail.weakTopics)
    lines.push(['weak_topic', w.name, percent(w.accuracy), w.answers]);
  lines.push([
    'placement',
    'estimated_level',
    detail.placement?.estimatedLevel ?? 'none',
    detail.placement ? `${detail.placement.score}/${detail.placement.total}` : null,
  ]);

  await deps.db.transaction(async (tx) => {
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.export',
      targetType: 'class',
      targetId: classId,
      diff: { type: 'learner', userId },
    });
  });
  const today = toLocalDate(deps.clock.now(), deps.config.ORG_TIMEZONE);
  return { filename: exportFilename(cls.name, today), body: toCsv(lines) };
}
