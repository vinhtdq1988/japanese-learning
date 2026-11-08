import { inviteeUnavailable, notFoundGeneric, orgError } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  closeMembership,
  countActiveMembers,
  findActiveMembershipByUser,
  findActiveMembershipInClass,
  openMembership,
  removeOrgMemberIfUnused,
  type ClassMembershipRow,
} from '../db/repositories/class-memberships.js';
import { getClassInOrg, hasClassPath, isClassTeacher } from '../db/repositories/classes.js';
import { findOrgMemberOfUser, getOrgMember } from '../db/repositories/organization-members.js';
import { getOrganization, lockOrganization } from '../db/repositories/organizations.js';
import { getProfile } from '../db/repositories/profiles.js';
import { allocateSeat, findSeatByHolder, releaseSeat } from '../db/repositories/seats.js';
import { SHARED_DATA_V1, type MembershipEndReason } from '../domain/org-types.js';
import { localToday } from '../engine/clock.js';
import type { ServiceDeps } from './deps.js';
import type { OrgContext } from './org-access.js';
import { assertSeatAvailable, seatError } from './org-seats.js';
import { clearPendingTodayPlan } from './plan-reset.js';

// Vòng đời thành viên lớp (spec 004, T050, T053, research O6, FR-004, FR-014, FR-016, FR-037). Mọi hàm `…Tx`
// chạy trong giao dịch mà caller ĐÃ khóa `organizations` (thứ tự khóa cố định: tổ chức → lớp → lời mời).

type MemberDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;
type TxDeps = Pick<ServiceDeps, 'config' | 'clock'>;

export interface EnterClassParams {
  organizationId: string;
  classId: string;
  userId: string;
  /**
   * `true` khi vào lớp KHÔNG qua lời mời (nhập mã): cần seat trống thật sự sau khi trừ lời mời đang giữ chỗ.
   * `false` khi nhận lời mời: chỗ đã được giữ cho chính lời mời này nên chỉ cần `allocateSeat` thành công.
   */
  requireFreeSeat: boolean;
}

/**
 * Bước vào lớp dùng chung cho lời mời, mã tham gia và chuyển lớp (data-model §5): tổ chức `active`, lớp
 * `active` có `class_paths`, không phải giáo viên phụ trách chính lớp này, chưa có thành viên lớp hiệu lực,
 * không thuộc tổ chức khác, lớp chưa đủ `CLASS_MAX_MEMBERS`, còn seat (người đã giữ seat – ví dụ giáo viên của
 * tổ chức – dùng lại seat đó, không tốn thêm). Mở thành viên với `consent_at`/`consent_version` (FR-016).
 */
export async function enterClassTx(
  tx: Transaction,
  deps: TxDeps,
  params: EnterClassParams,
): Promise<ClassMembershipRow> {
  const { organizationId, classId, userId } = params;
  const now = deps.clock.now();
  const org = await getOrganization(tx, organizationId);
  if (!org) throw notFoundGeneric();
  if (org.status !== 'active') throw seatError('no_license');

  const cls = await getClassInOrg(tx, organizationId, classId);
  if (!cls) throw notFoundGeneric();
  if (cls.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ');
  if (!(await hasClassPath(tx, classId))) {
    throw orgError('CLASS_NOT_READY', 'Lớp chưa có lộ trình nên chưa nhận học viên');
  }
  // Bất biến §3.5: giáo viên phụ trách không được là học viên của chính lớp mình.
  if (await isClassTeacher(tx, organizationId, classId, userId)) throw inviteeUnavailable();

  const member = await findOrgMemberOfUser(tx, userId);
  if (member && member.organizationId !== organizationId) throw inviteeUnavailable();
  const active = await findActiveMembershipByUser(tx, userId);
  if (active) {
    throw active.organizationId === organizationId
      ? orgError('ALREADY_IN_CLASS', 'Bạn đã thuộc một lớp học')
      : inviteeUnavailable();
  }
  if ((await countActiveMembers(tx, organizationId, classId)) >= deps.config.CLASS_MAX_MEMBERS) {
    throw orgError('CLASS_FULL', 'Lớp đã đủ số học viên tối đa');
  }

  const alreadyHolds = (await findSeatByHolder(tx, organizationId, userId)) !== undefined;
  if (params.requireFreeSeat && !alreadyHolds) await assertSeatAvailable(tx, deps, organizationId);
  const seat = await allocateSeat(
    tx,
    organizationId,
    userId,
    localToday(deps.clock, deps.config.ORG_TIMEZONE),
    now,
  );
  if (!seat.ok) throw seatError(seat.reason);

  const opened = await openMembership(tx, {
    classId,
    userId,
    organizationId,
    seatId: seat.seatId,
    consentVersion: SHARED_DATA_V1.version,
    now,
  });
  if (!opened.ok) throw inviteeUnavailable();
  // Nguồn học đổi giữa ngày: bỏ kế hoạch hôm nay nếu chưa học gì để thấy ngay kế hoạch của lớp (O6, SC-013).
  await clearPendingTodayPlan(tx, deps, userId);
  if (!seat.alreadyHeld) {
    await logOrgAction(tx, {
      actorId: userId,
      organizationId,
      action: 'seat.assign',
      targetType: 'seat',
      targetId: seat.seatId,
      diff: { userId, reassigned: seat.reassigned, via: 'class_join' },
    });
  }
  await logOrgAction(tx, {
    actorId: userId,
    organizationId,
    action: 'class.join',
    targetType: 'membership',
    targetId: opened.membership.id,
    diff: { classId, consentVersion: SHARED_DATA_V1.version },
  });
  return opened.membership;
}

/**
 * Người này có quyền chuyển học viên giữa hai lớp không: chủ tổ chức, hoặc giáo viên phụ trách CẢ HAI lớp
 * (FR-014). Dùng cả lúc gửi lời mời chuyển lớp lẫn lúc học viên chấp nhận (quyền của người mời có thể đã mất).
 */
export async function canMoveBetween(
  tx: Transaction,
  organizationId: string,
  actorId: string | null,
  fromClassId: string,
  toClassId: string,
): Promise<boolean> {
  if (!actorId) return false;
  const member = await getOrgMember(tx, organizationId, actorId);
  if (!member) return false;
  if (member.isOwner) return true;
  return (
    member.isTeacher &&
    (await isClassTeacher(tx, organizationId, fromClassId, actorId)) &&
    (await isClassTeacher(tx, organizationId, toClassId, actorId))
  );
}

/**
 * Chuyển lớp SAU KHI học viên đồng ý lại (nhận lời mời chuyển lớp, Hiến pháp III): đóng thành viên lớp cũ
 * `moved` rồi mở thành viên lớp mới trong CÙNG giao dịch, GIỮ NGUYÊN seat (không giải phóng, không tăng đếm đổi
 * người) và mọi dữ liệu học. Thất bại (lớp đầy, chưa sẵn sàng…) làm hoàn tác nên học viên ở lại lớp cũ. Người
 * mời `authorizedBy` PHẢI còn quyền ở cả hai lớp, nếu không ⇒ 409 `ALREADY_IN_CLASS` (không chuyển ngầm).
 */
export async function transferMembershipTx(
  tx: Transaction,
  deps: TxDeps,
  params: {
    organizationId: string;
    userId: string;
    current: Pick<ClassMembershipRow, 'id' | 'classId'>;
    toClassId: string;
    authorizedBy: string | null;
  },
): Promise<ClassMembershipRow> {
  const { organizationId, userId, current, toClassId } = params;
  if (
    !(await canMoveBetween(tx, organizationId, params.authorizedBy, current.classId, toClassId))
  ) {
    throw orgError('ALREADY_IN_CLASS', 'Bạn đã thuộc một lớp học');
  }
  const exitName = (await getProfile(tx, userId))?.displayName ?? null;
  const closed = await closeMembership(
    tx,
    organizationId,
    current.id,
    'moved',
    exitName,
    deps.clock.now(),
  );
  if (!closed) throw notFoundGeneric();
  const membership = await enterClassTx(tx, deps, {
    organizationId,
    classId: toClassId,
    userId,
    requireFreeSeat: false,
  });
  await logOrgAction(tx, {
    actorId: userId,
    organizationId,
    action: 'class.move_student',
    targetType: 'membership',
    targetId: membership.id,
    diff: {
      op: 'accepted',
      fromClassId: current.classId,
      toClassId,
      authorizedBy: params.authorizedBy,
    },
  });
  return membership;
}

/**
 * Kết thúc thành viên lớp đang hoạt động (rời lớp, bị gỡ, lưu trữ, hết hạn…): đóng thành viên với tên lúc
 * rời; giải phóng seat CHỈ KHI tài khoản không còn là giáo viên (giáo viên rời lớp vẫn giữ seat – FR-004,
 * US1.7); xóa dòng `organization_members` nếu không còn vai trò nào. Dùng chung cho mọi lý do (research O6).
 * Lịch sử học KHÔNG bị chạm tới (FR-037). Trả `false` nếu thành viên đã đóng.
 */
export async function endMembershipTx(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'clock'>,
  organizationId: string,
  membership: Pick<ClassMembershipRow, 'id' | 'userId'>,
  reason: MembershipEndReason,
): Promise<boolean> {
  const exitName = (await getProfile(tx, membership.userId))?.displayName ?? null;
  const closed = await closeMembership(
    tx,
    organizationId,
    membership.id,
    reason,
    exitName,
    deps.clock.now(),
  );
  if (!closed) return false;
  await clearPendingTodayPlan(tx, deps, membership.userId);
  const member = await getOrgMember(tx, organizationId, membership.userId);
  if (!member?.isTeacher) {
    const seat = await findSeatByHolder(tx, organizationId, membership.userId);
    if (seat) await releaseSeat(tx, organizationId, seat.id);
  }
  await removeOrgMemberIfUnused(tx, organizationId, membership.userId);
  return true;
}

/**
 * Gỡ học viên khỏi lớp (`removed`), giải phóng seat. Học viên không thuộc lớp *hiện tại* (đã rời, đã bị gỡ,
 * hoặc ngoài phạm vi) ⇒ 404 chung. Lớp lưu trữ ⇒ 409 `CLASS_ARCHIVED`.
 */
export async function removeStudent(
  deps: MemberDeps,
  ctx: OrgContext,
  classId: string,
  userId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, ctx.organizationId))) throw notFoundGeneric();
    const cls = await getClassInOrg(tx, ctx.organizationId, classId);
    if (!cls) throw notFoundGeneric();
    if (cls.status === 'archived') throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ');
    const membership = await findActiveMembershipInClass(tx, ctx.organizationId, classId, userId);
    if (!membership) throw notFoundGeneric();
    await endMembershipTx(tx, deps, ctx.organizationId, membership, 'removed');
    await logOrgAction(tx, {
      actorId: ctx.userId,
      organizationId: ctx.organizationId,
      action: 'class.remove_student',
      targetType: 'membership',
      targetId: membership.id,
      diff: { classId, userId },
    });
  });
}

/**
 * Học viên chuyển sang lộ trình cá nhân (rời lớp) bất cứ lúc nào (FR-037): đóng thành viên
 * `switched_personal`, giải phóng seat, tổ chức mất quyền xem NGAY (dữ liệu giáo viên tra theo thành viên
 * đang hoạt động), lịch sử học và hồ sơ/lộ trình cá nhân giữ nguyên. Không thuộc lớp ⇒ 404 chung.
 */
export async function leaveClass(deps: MemberDeps, userId: string): Promise<void> {
  const preliminary = await findActiveMembershipByUser(deps.db, userId);
  if (!preliminary) throw notFoundGeneric();
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, preliminary.organizationId))) throw notFoundGeneric();
    const membership = await findActiveMembershipByUser(tx, userId);
    if (!membership) throw notFoundGeneric();
    await endMembershipTx(tx, deps, membership.organizationId, membership, 'switched_personal');
    await logOrgAction(tx, {
      actorId: userId,
      organizationId: membership.organizationId,
      action: 'class.leave',
      targetType: 'membership',
      targetId: membership.id,
      diff: { classId: membership.classId },
    });
  });
}
