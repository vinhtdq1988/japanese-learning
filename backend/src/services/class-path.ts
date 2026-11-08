import { notFoundGeneric } from '../api/errors.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  listClassPathUnits,
  lookupUnits,
  type ClassPathUnitRow,
} from '../db/repositories/class-adjustments.js';
import {
  listActiveAssignments,
  listClassWidePauses,
  type ClassAssignmentRow,
} from '../db/repositories/class-learning.js';
import {
  getClassPathRow,
  upsertClassPath,
  type ClassPathRow,
} from '../db/repositories/class-paths.js';
import { lockClassInOrg, type ClassRow } from '../db/repositories/classes.js';
import { getProfile } from '../db/repositories/profiles.js';
import { localize } from '../domain/i18n.js';
import type { ClassPathTemplateInputDto } from '../domain/org-validation.js';
import { DEFAULT_LANGUAGE, type Language } from '../domain/types.js';
import {
  assignmentWarnings,
  classPathParams,
  computeFeasibility,
  rankClassUnits,
  type ClassPathTemplateInput,
} from '../engine/class-path.js';
import type { ScopeNotice } from '../engine/path.js';
import { localToday } from '../engine/clock.js';
import type { CatalogUnit } from './content-cache.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';
import { assertClassWritable } from './org-access.js';

// Lộ trình lớp (spec 004, T070 + T096/T097, FR-017 → FR-025, research O7). Lộ trình là THAM SỐ MẪU: lưu một dòng
// `class_paths`, không sao chép đơn vị theo học viên, không có thao tác xóa. Giáo viên có thể chuyển sang chế độ
// LIỆT KÊ (`class_path_units`: chọn bài, thứ tự, ngày mở) và giao bài; thay đổi có hiệu lực từ kế hoạch được sinh
// kế tiếp, kế hoạch đã sinh, tiến độ và lịch ôn giữ nguyên.

type PathDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

export interface ClassPathUnitDto {
  unitId: string;
  title: string;
  kind: string;
  level: string;
  estMinutes: number;
  position: number;
  opensOn: string | null;
  isOpen: boolean;
}

export interface PathWarningDto {
  code: 'over_capacity';
  requiredMinutes: number;
  capacityMinutes: number;
  assignmentId?: string;
}

export interface ClassAssignmentDto {
  id: string;
  batchId: string;
  unitId: string;
  title: string;
  dueOn: string;
}

export interface ContentNoticeDto {
  unitId: string;
  title: string;
  source: 'path' | 'assignment';
}

/** `ClassPath` của OpenAPI. */
export interface ClassPathDto {
  startLevel: string;
  targetLevel: string;
  skills: string[];
  startsOn: string;
  endsOn: string;
  dailyMinutes: number;
  mode: 'template' | 'explicit';
  scopeNotice: ScopeNotice | null;
  units: ClassPathUnitDto[];
  assignments: ClassAssignmentDto[];
  warnings: PathWarningDto[];
  contentNotices: ContentNoticeDto[];
  updatedAt: string;
}

/** Mẫu lộ trình (đầu vào engine) từ dòng `class_paths`. */
export function templateOf(row: ClassPathRow): ClassPathTemplateInput {
  return {
    startLevel: row.startLevel,
    targetLevel: row.targetLevel,
    skills: row.skills,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    dailyMinutes: row.dailyMinutes,
  };
}

/**
 * Tập đơn vị BẮT BUỘC của lộ trình lớp (mẫu số tiến độ, trước khi trừ phần miễn của từng học viên): cùng tập cho
 * mọi học viên, chỉ đơn vị `active`. Chế độ liệt kê: đúng danh sách giáo viên chọn (kể cả đơn vị còn khóa).
 */
export async function loadRequiredUnits(
  deps: Pick<ServiceDeps, 'contentCache'>,
  row: ClassPathRow,
  explicit: readonly ClassPathUnitRow[] = [],
): Promise<readonly CatalogUnit[]> {
  const { required } = rankClassUnits({
    template: templateOf(row),
    units: await deps.contentCache.activeUnits(),
    unitProgress: new Map(),
    topicStats: [],
    explicit,
  });
  return required;
}

export async function languageOf(deps: Pick<ServiceDeps, 'db'>, userId: string): Promise<Language> {
  return (await getProfile(deps.db, userId))?.language ?? DEFAULT_LANGUAGE;
}

/**
 * Thông báo cho giáo viên về đơn vị đã bị vô hiệu hóa còn nằm trong lộ trình/bài giao (FR-020). Tính khi đọc,
 * không lưu: biến mất khi giáo viên gỡ đơn vị khỏi lộ trình hoặc hủy bài giao.
 */
export async function contentNoticesOf(
  deps: PathDeps,
  explicit: readonly ClassPathUnitRow[],
  assignments: readonly ClassAssignmentRow[],
  language: Language,
): Promise<ContentNoticeDto[]> {
  if (explicit.length === 0 && assignments.length === 0) return [];
  const active = new Set((await deps.contentCache.activeUnits()).map((u) => u.id));
  const stale = {
    path: explicit.filter((e) => !active.has(e.unitId)).map((e) => e.unitId),
    assignment: [...new Set(assignments.filter((a) => !active.has(a.unitId)).map((a) => a.unitId))],
  };
  if (stale.path.length === 0 && stale.assignment.length === 0) return [];
  const info = await lookupUnits(deps.db, [...stale.path, ...stale.assignment]);
  const notice = (unitId: string, source: ContentNoticeDto['source']): ContentNoticeDto => ({
    unitId,
    title: localize(info.get(unitId)?.title, language),
    source,
  });
  return [
    ...stale.path.map((id) => notice(id, 'path')),
    ...stale.assignment.map((id) => notice(id, 'assignment')),
  ];
}

/** Dựng `ClassPath` từ dòng lộ trình: thứ tự tham khảo + cảnh báo khả thi tính tại thời điểm gọi. */
export async function buildClassPathDto(
  deps: PathDeps,
  organizationId: string,
  classId: string,
  row: ClassPathRow,
  language: Language,
): Promise<ClassPathDto> {
  const template = templateOf(row);
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const [units, explicit, assignments, pauses] = await Promise.all([
    deps.contentCache.activeUnits(),
    listClassPathUnits(deps.db, organizationId, classId),
    listActiveAssignments(deps.db, organizationId, classId),
    listClassWidePauses(deps.db, classId),
  ]);
  const { ranked, required } = rankClassUnits({
    template,
    units,
    unitProgress: new Map(),
    topicStats: [],
    explicit,
  });
  const explicitById = new Map(explicit.map((e) => [e.unitId, e]));
  const unitsById = new Map(units.map((u) => [u.id, u]));

  const feasibility = computeFeasibility({
    remainingMinutes: required.reduce((sum, u) => sum + u.estMinutes, 0),
    today,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    dailyMinutes: row.dailyMinutes,
    pauses,
  });
  const warnings: PathWarningDto[] = [
    ...(feasibility.overBy > 0
      ? [
          {
            code: 'over_capacity' as const,
            requiredMinutes: feasibility.requiredMinutes,
            capacityMinutes: feasibility.capacityMinutes,
          },
        ]
      : []),
    ...assignmentWarnings({
      assignments: assignments.map((a) => ({ id: a.id, unitId: a.unitId, dueOn: a.dueOn })),
      units,
      today,
      dailyMinutes: row.dailyMinutes,
      pauses,
    }),
  ];

  const staleInfo = await lookupUnits(
    deps.db,
    assignments.filter((a) => !unitsById.has(a.unitId)).map((a) => a.unitId),
  );
  return {
    ...template,
    skills: [...row.skills],
    mode: explicit.length > 0 ? 'explicit' : 'template',
    scopeNotice: classPathParams(template).scopeNotice,
    units: ranked.map((r, index) => {
      const opensOn = explicitById.get(r.unit.id)?.opensOn ?? null;
      return {
        unitId: r.unit.id,
        title: localize(r.unit.title, language),
        kind: r.unit.kind,
        level: r.unit.level,
        estMinutes: r.unit.estMinutes,
        position: explicitById.get(r.unit.id)?.position ?? index + 1,
        opensOn,
        isOpen: !opensOn || opensOn <= today,
      };
    }),
    assignments: assignments.map((a) => ({
      id: a.id,
      batchId: a.batchId,
      unitId: a.unitId,
      title: localize((unitsById.get(a.unitId) ?? staleInfo.get(a.unitId))?.title, language),
      dueOn: a.dueOn,
    })),
    warnings,
    contentNotices: await contentNoticesOf(deps, explicit, assignments, language),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** `GET /classes/{id}/path`: `null` khi lớp chưa có lộ trình (client nhắc đặt lộ trình trước khi mời). */
export async function getClassPath(
  deps: PathDeps,
  ctx: OrgContext,
  cls: ClassRow,
): Promise<{ path: ClassPathDto | null }> {
  const row = await getClassPathRow(deps.db, cls.id);
  if (!row) return { path: null };
  return {
    path: await buildClassPathDto(
      deps,
      ctx.organizationId,
      cls.id,
      row,
      await languageOf(deps, ctx.userId),
    ),
  };
}

/**
 * `PUT /classes/{id}/path`: tạo hoặc sửa lộ trình theo mẫu. Lưu trọn vẹn hoặc không đổi (một câu lệnh trong giao
 * dịch); cảnh báo khả thi trả kèm trong `warnings` nhưng KHÔNG chặn lưu. Danh sách đơn vị đã chọn và bài giao
 * được giữ nguyên. Lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`.
 */
export async function putClassPathTemplate(
  deps: PathDeps,
  ctx: OrgContext,
  classId: string,
  input: ClassPathTemplateInputDto,
): Promise<ClassPathDto> {
  const row = await deps.db.transaction(async (tx) => {
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    const saved = await upsertClassPath(
      tx,
      classId,
      {
        startLevel: input.startLevel,
        targetLevel: input.targetLevel,
        skills: input.skills,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        dailyMinutes: input.dailyMinutes,
      },
      ctx.userId,
      deps.clock.now(),
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.path_update',
      targetType: 'class',
      targetId: classId,
      diff: { ...input },
    });
    return saved;
  });
  return buildClassPathDto(
    deps,
    ctx.organizationId,
    classId,
    row,
    await languageOf(deps, ctx.userId),
  );
}
