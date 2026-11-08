import { notFoundGeneric } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  findActiveMembershipByUser,
  removeOrgMemberIfUnused,
} from '../db/repositories/class-memberships.js';
import { listClassBriefs, removeTeacherFromOrgClasses } from '../db/repositories/classes.js';
import { listPendingByOrg } from '../db/repositories/invitations.js';
import {
  clearTeacherRole,
  findOrgMemberOfUser,
  getOrgMember,
  listOrgStaff,
} from '../db/repositories/organization-members.js';
import {
  getDisplayLicense,
  getOrganization,
  lockOrganization,
} from '../db/repositories/organizations.js';
import { findSeatByHolder, releaseSeat, seatSummary } from '../db/repositories/seats.js';
import { localToday } from '../engine/clock.js';
import { graceEndsOn } from '../engine/seats.js';
import type { ServiceDeps } from './deps.js';
import {
  invitationDto,
  licenseStateOf,
  seatSummaryDto,
  type InvitationRowDto,
  type SeatSummaryDto,
} from './org-dto.js';
import { endMembershipTx } from './class-members.js';
import type { OrgContext } from './org-access.js';

// Tổng quan và quản lý giáo viên cho chủ tổ chức (spec 004, T035, FR-003, FR-039, FR-040).

type MemberDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;

/** `ClassRow` của OpenAPI (tổng quan chỉ có phần cấu trúc; `needAttentionCount` thêm ở US4). */
export interface ClassRowDto {
  id: string;
  name: string;
  status: 'active' | 'archived';
  memberCount: number;
  hasPath: boolean;
  teachers: { userId: string; displayName: string }[];
  teacherless: boolean;
}

export interface OrgOverviewDto {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  seats: SeatSummaryDto;
  license: {
    startsOn: string;
    endsOn: string;
    graceEndsOn: string;
    state: ReturnType<typeof licenseStateOf>;
  } | null;
  teachers: {
    userId: string;
    email: string;
    displayName: string;
    hasSeat: boolean;
    classIds: string[];
  }[];
  classes: ClassRowDto[];
  pendingInvitations: InvitationRowDto[];
}

/** Danh sách lớp của tổ chức: lớp `active` không còn giáo viên phụ trách là `teacherless` (FR-040). */
export async function listOrgClassesBrief(
  deps: Pick<ServiceDeps, 'db'>,
  organizationId: string,
): Promise<ClassRowDto[]> {
  const rows = await listClassBriefs(deps.db, organizationId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    memberCount: r.member_count,
    hasPath: r.has_path,
    teachers: r.teachers,
    teacherless: r.status === 'active' && r.teachers.length === 0,
  }));
}

/** `GET /org`: seat, giấy phép (kèm cảnh báo hết hạn), giáo viên, lớp và lời mời giáo viên đang chờ. */
export async function getOrgOverview(deps: MemberDeps, ctx: OrgContext): Promise<OrgOverviewDto> {
  const org = await getOrganization(deps.db, ctx.organizationId);
  if (!org) throw notFoundGeneric();
  const now = deps.clock.now();
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const [seats, license, staff, classes, pending] = await Promise.all([
    seatSummary(deps.db, org.id, today, now),
    getDisplayLicense(deps.db, org.id, today),
    listOrgStaff(deps.db, org.id),
    listOrgClassesBrief(deps, org.id),
    listPendingByOrg(deps.db, org.id, now, ['teacher', 'owner']),
  ]);
  return {
    id: org.id,
    name: org.name,
    status: org.status,
    seats: seatSummaryDto(seats),
    license: license
      ? {
          startsOn: license.startsOn,
          endsOn: license.endsOn,
          graceEndsOn: graceEndsOn(license),
          state: licenseStateOf(license, today, deps.config),
        }
      : null,
    teachers: staff
      .filter((s) => s.is_teacher)
      .map((s) => ({
        userId: s.user_id,
        email: s.email,
        displayName: s.display_name ?? '',
        hasSeat: s.has_seat,
        classIds: s.class_ids ?? [],
      })),
    classes,
    pendingInvitations: pending.map(invitationDto),
  };
}

/**
 * Gỡ vai trò giáo viên: tắt cờ, gỡ khỏi `class_teachers` của tổ chức, mất quyền NGAY (vai trò tra CSDL mỗi
 * request). Seat chỉ được giải phóng nếu tài khoản không còn là thành viên lớp đang hoạt động (FR-004); lớp
 * hết giáo viên thành `teacherless` (FR-040). Không phải giáo viên của tổ chức ⇒ 404 chung.
 */
export async function removeTeacher(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  actorId: string | null,
  organizationId: string,
  userId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    const member = await getOrgMember(tx, organizationId, userId);
    if (!member?.isTeacher) throw notFoundGeneric();

    await clearTeacherRole(tx, organizationId, userId);
    const classesLeft = await removeTeacherFromOrgClasses(tx, organizationId, userId);
    const learning = await findActiveMembershipByUser(tx, userId);
    let seatReleased = false;
    if (!learning) {
      const seat = await findSeatByHolder(tx, organizationId, userId);
      if (seat) seatReleased = await releaseSeat(tx, organizationId, seat.id);
    }
    await removeOrgMemberIfUnused(tx, organizationId, userId);
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: 'teacher.remove',
      targetType: 'membership',
      targetId: userId,
      diff: { classesLeft, seatReleased },
    });
  });
}

/**
 * Tài khoản yêu cầu xóa (FR-039, research O15), chạy trong CÙNG giao dịch `markPendingDeletion`:
 * - học viên đang thuộc lớp: đóng thành viên `account_deleted` nên tổ chức mất quyền xem NGAY; tư cách này
 *   KHÔNG được khôi phục khi tài khoản được khôi phục trong 30 ngày (phải được mời lại và xác nhận lại);
 * - giáo viên: gỡ khỏi `class_teachers` (lớp có thể thành `teacherless`);
 * - mọi vai trò: giải phóng seat đang giữ. Cờ `is_owner`/`is_teacher` giữ nguyên để khôi phục tài khoản trả lại
 *   vai trò, còn tổ chức không đếm tài khoản không `active` là chủ/giáo viên (cảnh báo `noOwner`/`teacherless`
 *   là dẫn xuất); khi xóa cứng, khóa ngoại `ON DELETE CASCADE` dọn dòng `organization_members`.
 * Không thuộc tổ chức nào ⇒ không làm gì.
 */
export async function endOrgParticipationOnAccountDeletion(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'clock'>,
  userId: string,
): Promise<void> {
  const member = await findOrgMemberOfUser(tx, userId);
  if (!member) return;
  const organizationId = member.organizationId;
  if (!(await lockOrganization(tx, organizationId))) return;

  const membership = await findActiveMembershipByUser(tx, userId);
  const learnerEnded = membership
    ? await endMembershipTx(tx, deps, organizationId, membership, 'account_deleted')
    : false;
  const classesLeft = member.isTeacher
    ? await removeTeacherFromOrgClasses(tx, organizationId, userId)
    : 0;
  const seat = await findSeatByHolder(tx, organizationId, userId);
  const seatReleased = seat ? await releaseSeat(tx, organizationId, seat.id) : false;
  await removeOrgMemberIfUnused(tx, organizationId, userId);

  if (learnerEnded || classesLeft > 0 || seatReleased) {
    await logOrgAction(tx, {
      actorId: userId,
      organizationId,
      action: 'seat.revoke',
      targetType: 'membership',
      targetId: membership?.id ?? userId,
      diff: { reason: 'account_deleted', learnerEnded, classesLeft, seatReleased },
    });
  }
}
