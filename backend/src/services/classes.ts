import { notFoundGeneric, orgError } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  findActiveMembershipByUser,
  listMembershipsByClass,
} from '../db/repositories/class-memberships.js';
import {
  addClassTeachers,
  getClassInOrg,
  insertClass,
  listClassBriefs,
  listClassRoster,
  lockClassInOrg,
  replaceClassTeachers,
  revokePendingClassInvitations,
  updateClass,
  type ClassBriefRow,
  type ClassRow,
} from '../db/repositories/classes.js';
import { getOrgMember } from '../db/repositories/organization-members.js';
import { getOrganization, lockOrganization } from '../db/repositories/organizations.js';
import type { ClassCreateInput, ClassPatchInput } from '../domain/org-validation.js';
import { AppError } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';
import { countNeedAttention } from './class-dashboard.js';
import { endMembershipTx } from './class-members.js';
import type { OrgContext } from './org-access.js';
import { assertClassWritable } from './org-access.js';

// Dịch vụ lớp học (spec 004, T052, FR-009 → FR-015, FR-040). Đối tượng ngoài phạm vi người gọi ⇒ 404 chung
// (guard `requireClassManager` đã lọc; hàm ở đây vẫn lọc theo `organizationId` để không phụ thuộc vào guard).

type ClassDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

/** `ClassRow` của OpenAPI. `needAttentionCount` chỉ có khi người gọi có quyền xem dữ liệu học viên. */
export interface ClassRowDto {
  id: string;
  name: string;
  status: 'active' | 'archived';
  memberCount: number;
  hasPath: boolean;
  teachers: { userId: string; displayName: string }[];
  needAttentionCount?: number;
  teacherless: boolean;
}

export interface ClassDetailDto extends ClassRowDto {
  description: string | null;
  absenceThresholdDays: number;
  archivedAt: string | null;
  createdAt: string;
}

const validation = (field: string, message: string) =>
  new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { [field]: message });

type ClassListDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'contentCache'>;

/** Số học viên cần chú ý (US7); 0 khi người gọi không có quyền xem dữ liệu hoặc lớp chưa có thành viên/lộ trình. */
async function needAttentionOf(
  deps: ClassListDeps,
  ctx: OrgContext,
  row: ClassBriefRow,
): Promise<number> {
  if (!ctx.dataAccess || !row.has_path || row.member_count === 0) return 0;
  return countNeedAttention(deps, ctx.organizationId, row.id);
}

function rowDto(row: ClassBriefRow, ctx: OrgContext, needAttentionCount: number): ClassRowDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    memberCount: row.member_count,
    hasPath: row.has_path,
    teachers: row.teachers,
    ...(ctx.dataAccess ? { needAttentionCount } : {}),
    teacherless: row.status === 'active' && row.teachers.length === 0,
  };
}

/** Giáo viên: lớp mình phụ trách; chủ tổ chức: mọi lớp (kể cả đã lưu trữ). */
export async function listClasses(deps: ClassListDeps, ctx: OrgContext): Promise<ClassRowDto[]> {
  const rows = await listClassBriefs(
    deps.db,
    ctx.organizationId,
    ctx.isOwner ? {} : { teacherUserId: ctx.userId },
  );
  const counts = await Promise.all(rows.map((r) => needAttentionOf(deps, ctx, r)));
  return rows.map((r, i) => rowDto(r, ctx, counts[i]!));
}

async function detailDto(
  deps: ClassListDeps,
  ctx: OrgContext,
  cls: ClassRow,
): Promise<ClassDetailDto> {
  const [brief] = await listClassBriefs(deps.db, ctx.organizationId, { classId: cls.id });
  if (!brief) throw notFoundGeneric();
  return {
    ...rowDto(brief, ctx, await needAttentionOf(deps, ctx, brief)),
    description: cls.description,
    absenceThresholdDays: cls.absenceThresholdDays,
    archivedAt: cls.archivedAt ? cls.archivedAt.toISOString() : null,
    createdAt: cls.createdAt.toISOString(),
  };
}

export async function getClassDetail(
  deps: ClassListDeps,
  ctx: OrgContext,
  cls: ClassRow,
): Promise<ClassDetailDto> {
  return detailDto(deps, ctx, cls);
}

/** Mọi id phải là giáo viên (`is_teacher`) CÙNG tổ chức; ngược lại 422 theo trường. */
async function assertTeachers(
  tx: Transaction,
  organizationId: string,
  userIds: string[],
  field: string,
): Promise<void> {
  for (const userId of userIds) {
    const member = await getOrgMember(tx, organizationId, userId);
    if (!member?.isTeacher) {
      throw validation(field, 'Chỉ giáo viên của tổ chức mới được phụ trách lớp');
    }
  }
}

/**
 * Tạo lớp. Giáo viên tạo thì tự là phụ trách và KHÔNG được chỉ định `teacherIds` (403); chủ tổ chức chọn
 * `teacherIds` (đều là giáo viên cùng tổ chức); nếu chủ tổ chức cũng là giáo viên thì mặc định là phụ trách.
 * Chủ tổ chức không chọn ai và không phải giáo viên ⇒ lớp tạm chưa có giáo viên (`teacherless`, FR-040) để
 * chủ tổ chức gán sau bằng `PUT /classes/{id}/teachers`.
 */
export async function createClass(
  deps: ClassDeps,
  ctx: OrgContext,
  input: ClassCreateInput,
): Promise<ClassDetailDto> {
  if (!ctx.isOwner && input.teacherIds && input.teacherIds.length > 0) {
    throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ tổ chức mới chỉ định giáo viên phụ trách');
  }
  const created = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const org = await getOrganization(tx, ctx.organizationId);
    if (!org || org.status !== 'active') {
      throw orgError('SEAT_UNAVAILABLE', 'Tổ chức đang bị vô hiệu hóa');
    }
    let teacherIds: string[];
    if (ctx.isOwner) {
      teacherIds = [...new Set(input.teacherIds ?? [])];
      if (teacherIds.length === 0 && ctx.isTeacher) teacherIds = [ctx.userId];
      await assertTeachers(tx, ctx.organizationId, teacherIds, 'teacherIds');
    } else {
      teacherIds = [ctx.userId];
    }
    const now = deps.clock.now();
    const cls = await insertClass(tx, {
      organizationId: ctx.organizationId,
      name: input.name,
      description: input.description?.trim() || null,
      createdBy: ctx.userId,
    });
    await addClassTeachers(tx, cls.id, teacherIds, now);
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.create',
      targetType: 'class',
      targetId: cls.id,
      diff: { name: cls.name, teacherIds },
    });
    return cls;
  });
  return detailDto(deps, ctx, created);
}

/** `PATCH /classes/{id}`: tên, mô tả, ngưỡng vắng mặt. Lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`. */
export async function patchClass(
  deps: ClassDeps,
  ctx: OrgContext,
  classId: string,
  input: ClassPatchInput,
): Promise<ClassDetailDto> {
  const updated = await deps.db.transaction(async (tx) => {
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    const next = await updateClass(
      tx,
      ctx.organizationId,
      classId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.absenceThresholdDays !== undefined
          ? { absenceThresholdDays: input.absenceThresholdDays }
          : {}),
      },
      deps.clock.now(),
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.update',
      targetType: 'class',
      targetId: classId,
      diff: input,
    });
    return next!;
  });
  return detailDto(deps, ctx, updated);
}

/**
 * `PUT /classes/{id}/teachers` (chủ tổ chức): đặt đúng danh sách giáo viên phụ trách. Rỗng ⇒ 409
 * `LAST_TEACHER`. Một học viên đang thuộc chính lớp này không được thành giáo viên phụ trách lớp mình (bất
 * biến §3.5) ⇒ 409 `ALREADY_IN_CLASS`.
 */
export async function setClassTeachers(
  deps: ClassDeps,
  ctx: OrgContext,
  classId: string,
  userIds: string[],
): Promise<ClassDetailDto> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) {
    throw orgError('LAST_TEACHER', 'Lớp phải có ít nhất một giáo viên phụ trách');
  }
  const updated = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    await assertTeachers(tx, ctx.organizationId, ids, 'userIds');
    for (const userId of ids) {
      const membership = await findActiveMembershipByUser(tx, userId);
      if (membership && membership.classId === classId) {
        throw orgError(
          'ALREADY_IN_CLASS',
          'Người này đang là học viên của lớp, không thể làm giáo viên phụ trách',
        );
      }
    }
    const change = await replaceClassTeachers(
      tx,
      ctx.organizationId,
      classId,
      ids,
      deps.clock.now(),
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.teachers',
      targetType: 'class',
      targetId: classId,
      diff: change,
    });
    return cls;
  });
  return detailDto(deps, ctx, updated);
}

/**
 * `POST /classes/{id}/archive`: một chiều, không khôi phục. Đóng MỌI thành viên (`class_archived`, giải phóng
 * seat), vô hiệu mã tham gia và hủy lời mời chờ (trả lại chỗ giữ); lịch sử học nguyên vẹn. Trả số học viên
 * bị đóng thành viên. Đã lưu trữ ⇒ 409 `CLASS_ARCHIVED`.
 */
export async function archiveClass(
  deps: ClassDeps,
  ctx: OrgContext,
  classId: string,
): Promise<{ learnersMoved: number }> {
  return deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const cls = await lockClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    assertClassWritable(cls);
    const now = deps.clock.now();
    const members = await listMembershipsByClass(tx, ctx.organizationId, classId);
    let learnersMoved = 0;
    for (const membership of members) {
      if (await endMembershipTx(tx, deps, ctx.organizationId, membership, 'class_archived')) {
        learnersMoved += 1;
      }
    }
    const invitationsRevoked = await revokePendingClassInvitations(
      tx,
      ctx.organizationId,
      classId,
      now,
    );
    await updateClass(
      tx,
      ctx.organizationId,
      classId,
      { status: 'archived', archivedAt: now, joinCodeEnabled: false },
      now,
    );
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.archive',
      targetType: 'class',
      targetId: classId,
      diff: { learnersMoved, invitationsRevoked },
    });
    return { learnersMoved };
  });
}

export interface RosterRowDto {
  userId: string | null;
  displayName: string;
  email: string | null;
  status: 'joined' | 'invited' | 'declined' | 'switched_personal' | 'removed' | 'other_ended';
  at: string;
  invitationId: string | null;
}

/** `GET /classes/{id}/roster`: học viên theo trạng thái; người đã rời chỉ có tên + ngày (research O13). */
export async function getRoster(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  ctx: OrgContext,
  classId: string,
): Promise<RosterRowDto[]> {
  const cls = await getClassInOrg(deps.db, ctx.organizationId, classId);
  if (!cls) throw notFoundGeneric();
  const rows = await listClassRoster(deps.db, ctx.organizationId, classId, deps.clock.now());
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    email: r.email,
    status: r.status,
    at: new Date(r.at).toISOString(),
    invitationId: r.invitation_id,
  }));
}
