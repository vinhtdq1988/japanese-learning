import { randomUUID } from 'node:crypto';
import { notFoundGeneric, orgError } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  addExemption,
  cancelAssignment as cancelAssignmentRow,
  closePause,
  hasOpenPause,
  insertAssignments,
  insertPause,
  listAssignedUnitIds,
  listExemptedUnitIds,
  listPauses as listPauseRows,
  removeExemption,
  replaceClassPathUnits,
  upsertOverride,
  type PauseRow,
} from '../db/repositories/class-adjustments.js';
import { findActiveMembershipInClass } from '../db/repositories/class-memberships.js';
import { listActiveAssignments, listClassWidePauses } from '../db/repositories/class-learning.js';
import { getClassPathRow } from '../db/repositories/class-paths.js';
import { lockClassInOrg } from '../db/repositories/classes.js';
import { localize } from '../domain/i18n.js';
import type {
  AssignmentCreateInput,
  LearnerOverrideInput,
  PathUnitsInput,
  PauseCreateInput,
  PauseEndInput,
} from '../domain/org-validation.js';
import { AppError, type LocalDate } from '../domain/types.js';
import { assignmentWarnings } from '../engine/class-path.js';
import { localToday } from '../engine/clock.js';
import {
  buildClassPathDto,
  languageOf,
  type ClassAssignmentDto,
  type ClassPathDto,
  type PathWarningDto,
} from './class-path.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';
import { assertClassWritable } from './org-access.js';

// Tinh chỉnh lộ trình lớp (spec 004, T096, US5, FR-022 → FR-026): chọn bài/thứ tự/ngày mở, bài giao, ghi đè riêng
// một học viên, miễn bài, tạm dừng. Mọi thao tác ghi khóa dòng lớp (`FOR UPDATE`) nên các thay đổi đồng thời trên
// cùng lớp tuần tự hóa; thay đổi có hiệu lực từ kế hoạch được sinh kế tiếp (kế hoạch đã sinh giữ nguyên).

type AdjustDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

const invalid = (field: string, message: string) =>
  new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { [field]: message });
/** Xung đột trạng thái (409) với mã `VALIDATION_FAILED` và `fields` chỉ ra trường vướng. */
const conflict = (field: string, message: string) =>
  new AppError(409, 'VALIDATION_FAILED', message, { [field]: message });

/** Khóa lớp trong tổ chức, bảo đảm ghi được (không lưu trữ) và đã có lộ trình. */
async function lockWritableClass(tx: Transaction, ctx: OrgContext, classId: string) {
  const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
  if (!cls) throw notFoundGeneric();
  assertClassWritable(cls);
  return cls;
}

async function requirePath(tx: Transaction, classId: string) {
  const path = await getClassPathRow(tx, classId);
  if (!path) throw orgError('CLASS_NOT_READY', 'Lớp chưa có lộ trình');
  return path;
}

async function activeUnitIds(deps: AdjustDeps): Promise<Set<string>> {
  return new Set((await deps.contentCache.activeUnits()).map((u) => u.id));
}

/** Thành viên ĐANG hoạt động của lớp; người khác (kể cả đã rời) ⇒ 404 chung. */
async function requireMember(tx: Transaction, ctx: OrgContext, classId: string, userId: string) {
  const membership = await findActiveMembershipInClass(tx, ctx.organizationId, classId, userId);
  if (!membership) throw notFoundGeneric();
  return membership;
}

// --- Chọn bài, thứ tự, ngày mở ---

/**
 * `PUT /classes/{id}/path/units`: thay TOÀN BỘ danh sách đơn vị (đơn vị phải `active`, không trùng); `units: []`
 * quay lại chế độ mẫu. Lưu trọn vẹn hoặc không đổi. Lớp chưa có lộ trình ⇒ 409 `CLASS_NOT_READY`.
 */
export async function putPathUnits(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  input: PathUnitsInput,
): Promise<ClassPathDto> {
  const active = await activeUnitIds(deps);
  const row = await deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const path = await requirePath(tx, classId);
    const ids = input.units.map((u) => u.unitId);
    if (new Set(ids).size !== ids.length) throw invalid('units', 'Đơn vị bị chọn trùng nhau');
    if (ids.some((id) => !active.has(id))) {
      throw invalid('units', 'Đơn vị không tồn tại hoặc không còn hoạt động');
    }
    await replaceClassPathUnits(
      tx,
      classId,
      input.units.map((u) => ({ unitId: u.unitId, opensOn: u.opensOn ?? null })),
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.path_update',
      targetType: 'class',
      targetId: classId,
      diff: { mode: ids.length > 0 ? 'explicit' : 'template', unitCount: ids.length },
    });
    return path;
  });
  return buildClassPathDto(
    deps,
    ctx.organizationId,
    classId,
    row,
    await languageOf(deps, ctx.userId),
  );
}

// --- Bài giao ---

export interface CreatedAssignmentsDto {
  batchId: string;
  assignments: ClassAssignmentDto[];
  warnings: PathWarningDto[];
}

/**
 * `POST /classes/{id}/assignments`: giao 1–20 đơn vị với một hạn (không ở quá khứ). Đơn vị đã có bài giao còn hiệu
 * lực ⇒ 409. Trả `warnings` `over_capacity` (theo `assignmentId`) khi khối lượng vượt quỹ — KHÔNG chặn lưu.
 */
export async function createAssignments(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  input: AssignmentCreateInput,
): Promise<CreatedAssignmentsDto> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const units = await deps.contentCache.activeUnits();
  const byId = new Map(units.map((u) => [u.id, u]));
  const language = await languageOf(deps, ctx.userId);

  return deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const path = await requirePath(tx, classId);
    if (input.unitIds.some((id) => !byId.has(id))) {
      throw invalid('unitIds', 'Đơn vị không tồn tại hoặc không còn hoạt động');
    }
    if (input.dueOn < today) throw invalid('dueOn', 'Hạn nộp không được ở quá khứ');
    const taken = await listAssignedUnitIds(tx, classId, input.unitIds);
    if (taken.size > 0) throw conflict('unitIds', 'Có đơn vị đã có bài giao còn hiệu lực');

    const batchId = randomUUID();
    const rows = await insertAssignments(tx, {
      classId,
      batchId,
      unitIds: input.unitIds,
      dueOn: input.dueOn,
      assignedBy: ctx.userId,
      now: deps.clock.now(),
    });
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.assign',
      targetType: 'assignment',
      targetId: batchId,
      diff: { classId, unitIds: input.unitIds, dueOn: input.dueOn },
    });

    const all = await listActiveAssignments(tx, ctx.organizationId, classId);
    const created = new Set(rows.map((r) => r.id));
    const warnings = assignmentWarnings({
      assignments: all.map((a) => ({ id: a.id, unitId: a.unitId, dueOn: a.dueOn })),
      units,
      today,
      dailyMinutes: path.dailyMinutes,
      pauses: await listClassWidePauses(tx, classId),
    }).filter((w) => created.has(w.assignmentId));
    return {
      batchId,
      assignments: rows.map((r) => ({
        id: r.id,
        batchId: r.batchId,
        unitId: r.unitId,
        title: localize(byId.get(r.unitId)?.title, language),
        dueOn: r.dueOn,
      })),
      warnings,
    };
  });
}

/** `DELETE /classes/{id}/assignments/{assignmentId}`: hủy bài giao còn hiệu lực; không có ⇒ 404 chung. */
export async function cancelAssignment(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  assignmentId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const cancelled = await cancelAssignmentRow(
      tx,
      ctx.organizationId,
      classId,
      assignmentId,
      deps.clock.now(),
    );
    if (!cancelled) throw notFoundGeneric();
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.assign',
      targetType: 'assignment',
      targetId: assignmentId,
      diff: { classId, cancelled: true, unitId: cancelled.unitId },
    });
  });
}

// --- Ghi đè riêng và miễn bài ---

export interface LearnerOverrideDto {
  dailyMinutes: number | null;
  shiftDays: number;
  exemptUnitIds: string[];
}

/** `PUT /classes/{id}/members/{userId}/override`: phút mỗi ngày (hoặc `null` = theo lớp) và dời mốc (FR-026). */
export async function putOverride(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
  input: LearnerOverrideInput,
): Promise<LearnerOverrideDto> {
  return deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const membership = await requireMember(tx, ctx, classId, userId);
    await upsertOverride(
      tx,
      membership.id,
      { dailyMinutes: input.dailyMinutes ?? null, shiftDays: input.shiftDays },
      ctx.userId,
      deps.clock.now(),
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.override',
      targetType: 'membership',
      targetId: membership.id,
      diff: { classId, dailyMinutes: input.dailyMinutes ?? null, shiftDays: input.shiftDays },
    });
    return {
      dailyMinutes: input.dailyMinutes ?? null,
      shiftDays: input.shiftDays,
      exemptUnitIds: await listExemptedUnitIds(tx, membership.id),
    };
  });
}

/** `PUT /classes/{id}/members/{userId}/exemptions/{unitId}`: miễn một đơn vị (lũy đẳng; đơn vị phải `active`). */
export async function exemptUnit(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
  unitId: string,
): Promise<void> {
  const active = await activeUnitIds(deps);
  await deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const membership = await requireMember(tx, ctx, classId, userId);
    if (!active.has(unitId))
      throw invalid('unitId', 'Đơn vị không tồn tại hoặc không còn hoạt động');
    await addExemption(tx, membership.id, unitId, ctx.userId, deps.clock.now());
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.override',
      targetType: 'membership',
      targetId: membership.id,
      diff: { classId, exempt: unitId },
    });
  });
}

/** `DELETE /classes/{id}/members/{userId}/exemptions/{unitId}`: bỏ miễn (lũy đẳng). */
export async function unexemptUnit(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
  unitId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const membership = await requireMember(tx, ctx, classId, userId);
    await removeExemption(tx, membership.id, unitId);
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.override',
      targetType: 'membership',
      targetId: membership.id,
      diff: { classId, unexempt: unitId },
    });
  });
}

// --- Tạm dừng ---

/** `ClassPause` của OpenAPI. */
export interface ClassPauseDto {
  id: string;
  userId: string | null;
  displayName: string | null;
  startedOn: LocalDate;
  endedOn: LocalDate | null;
}

const pauseDto = (r: PauseRow): ClassPauseDto => ({
  id: r.id,
  userId: r.userId,
  displayName: r.displayName,
  startedOn: r.startedOn,
  endedOn: r.endedOn,
});

/** `GET /classes/{id}/pauses`: khoảng tạm dừng của cả lớp và của các học viên đang hoạt động. */
export async function listPauses(
  deps: Pick<ServiceDeps, 'db'>,
  ctx: OrgContext,
  classId: string,
): Promise<ClassPauseDto[]> {
  return (await listPauseRows(deps.db, ctx.organizationId, classId)).map(pauseDto);
}

/**
 * `POST /classes/{id}/pauses`: tạm dừng cả lớp (vắng `userId`) hoặc một học viên. `endedOn` bỏ trống ⇒ khoảng
 * mở; đã có khoảng MỞ cùng phạm vi ⇒ 409. Khoảng đặt trước (tương lai) hợp lệ. Ngày tạm dừng không bị tính là
 * bỏ lỡ và không sinh cảnh báo (FR-031).
 */
export async function createPause(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  input: PauseCreateInput,
): Promise<ClassPauseDto> {
  return deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const membership = input.userId
      ? await requireMember(tx, ctx, classId, input.userId)
      : undefined;
    const endedOn = input.endedOn ?? null;
    if (endedOn !== null && endedOn <= input.startedOn) {
      throw invalid('endedOn', 'Ngày kết thúc phải sau ngày bắt đầu');
    }
    if (endedOn === null && (await hasOpenPause(tx, classId, membership?.id ?? null))) {
      throw conflict('startedOn', 'Đã có khoảng tạm dừng đang mở cùng phạm vi');
    }
    const id = await insertPause(tx, {
      classId,
      membershipId: membership?.id ?? null,
      startedOn: input.startedOn,
      endedOn,
      createdBy: ctx.userId,
      now: deps.clock.now(),
    });
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.pause',
      targetType: membership ? 'membership' : 'class',
      targetId: membership?.id ?? classId,
      diff: { classId, pauseId: id, startedOn: input.startedOn, endedOn },
    });
    const [row] = await listPauseRows(tx, ctx.organizationId, classId, id);
    return pauseDto(row!);
  });
}

/**
 * `POST /classes/{id}/pauses/{pauseId}/end`: kết thúc một khoảng chưa kết thúc (đang mở hoặc đặt trước), mặc định
 * hôm nay. Ngày kết thúc phải sau ngày bắt đầu; khoảng đã kết thúc ⇒ 409; không có ⇒ 404 chung.
 */
export async function endPause(
  deps: AdjustDeps,
  ctx: OrgContext,
  classId: string,
  pauseId: string,
  input: PauseEndInput,
): Promise<ClassPauseDto> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  return deps.db.transaction(async (tx) => {
    await lockWritableClass(tx, ctx, classId);
    const [pause] = await listPauseRows(tx, ctx.organizationId, classId, pauseId);
    if (!pause) throw notFoundGeneric();
    if (pause.endedOn !== null && pause.endedOn <= today) {
      throw conflict('pauseId', 'Khoảng tạm dừng đã kết thúc');
    }
    const endedOn = input.endedOn ?? today;
    if (endedOn <= pause.startedOn) {
      throw invalid('endedOn', 'Ngày kết thúc phải sau ngày bắt đầu');
    }
    await closePause(tx, pauseId, endedOn);
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.pause',
      targetType: pause.membershipId ? 'membership' : 'class',
      targetId: pause.membershipId ?? classId,
      diff: { classId, pauseId, endedOn },
    });
    return pauseDto({ ...pause, endedOn });
  });
}
