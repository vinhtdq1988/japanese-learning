import { orgError, notFoundGeneric } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import {
  closeMembership,
  findActiveMembershipByUser,
  removeOrgMemberIfUnused,
} from '../db/repositories/class-memberships.js';
import { getOrgMember, listTeachersWithoutSeat } from '../db/repositories/organization-members.js';
import {
  countReservations,
  lockOrganization,
  type SeatLicenseRow,
} from '../db/repositories/organizations.js';
import {
  allocateSeat,
  deleteFreeSeats,
  findSeatByHolder,
  insertSeats,
  licenseSeatCounts,
  releaseSeat,
  seatAvailability,
  seatSummary,
  type SeatAvailability,
  type SeatSummary,
} from '../db/repositories/seats.js';
import { getProfile } from '../db/repositories/profiles.js';
import type { MembershipEndReason } from '../domain/org-types.js';
import type { AppError } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import { isLicenseEffective } from '../engine/seats.js';
import type { ServiceDeps } from './deps.js';
import { clearPendingTodayPlan } from './plan-reset.js';

// Dịch vụ seat (spec 004, T032, FR-004, FR-005, research O3). Mọi thao tác ảnh hưởng sức chứa chạy trong
// giao dịch đã khóa `organizations` bằng `SELECT … FOR UPDATE`, nên hai yêu cầu song song không bao giờ cùng
// lấy seat cuối cùng và đếm giữ chỗ không bị đọc lệch.

export type SeatDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock'>;

/** Lỗi nghiệp vụ tương ứng lý do không cấp được seat (`SEAT_UNAVAILABLE` 409 / `SEAT_REASSIGN_LIMIT` 422). */
export function seatError(reason: 'no_license' | 'no_free_seat' | 'reassign_limit'): AppError {
  return reason === 'reassign_limit'
    ? orgError(
        'SEAT_REASSIGN_LIMIT',
        'Các seat trống đã dùng hết số lần đổi người giữ; quản trị viên cần nâng giới hạn',
      )
    : orgError('SEAT_UNAVAILABLE', 'Không còn seat trống');
}

/** Lý do không còn chỗ dựa trên số liệu: còn seat trống nhưng hết lượt đổi ⇒ `reassign_limit`. */
export function unavailableReason(a: SeatAvailability): 'no_free_seat' | 'reassign_limit' {
  return a.assignableFree === 0 && a.free > a.reserved ? 'reassign_limit' : 'no_free_seat';
}

export async function getSeatSummary(deps: SeatDeps, organizationId: string): Promise<SeatSummary> {
  return seatSummary(
    deps.db,
    organizationId,
    localToday(deps.clock, deps.config.ORG_TIMEZONE),
    deps.clock.now(),
  );
}

/** Số liệu seat đọc trong giao dịch (đã khóa tổ chức) để quyết định gửi lời mời/cấp seat. */
export async function readSeatAvailability(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  organizationId: string,
): Promise<SeatAvailability> {
  return seatAvailability(
    tx,
    organizationId,
    localToday(deps.clock, deps.config.ORG_TIMEZONE),
    deps.clock.now(),
  );
}

/** Ném `SEAT_UNAVAILABLE`/`SEAT_REASSIGN_LIMIT` nếu không còn chỗ trống (đã trừ lời mời đang chờ). */
export async function assertSeatAvailable(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  organizationId: string,
): Promise<void> {
  const a = await readSeatAvailability(tx, deps, organizationId);
  if (a.available < 1) throw seatError(a.total === 0 ? 'no_license' : unavailableReason(a));
}

/**
 * Cấp seat cho giáo viên đang mất seat (hoặc vừa được thêm vai trò). Giáo viên cũng là chủ tổ chức không
 * chiếm seat; người đã giữ seat (ví dụ đồng thời là học viên) dùng lại seat đó – cả hai đều không đổi gì.
 * Không phải giáo viên của tổ chức ⇒ 404 chung.
 */
export async function grantSeatToTeacher(
  deps: SeatDeps,
  actorId: string | null,
  organizationId: string,
  userId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    const member = await getOrgMember(tx, organizationId, userId);
    if (!member || !member.isTeacher) throw notFoundGeneric();
    if (member.isOwner) return;
    if (await findSeatByHolder(tx, organizationId, userId)) return;

    const now = deps.clock.now();
    const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
    // Có lời mời đang giữ chỗ thì không được lấy mất chỗ của họ; không có thì để `allocateSeat` quyết định
    // (kể cả seat cũ của chính người này, vốn không tính một lần đổi).
    const a = await readSeatAvailability(tx, deps, organizationId);
    if (a.reserved > 0 && a.available < 1) {
      throw seatError(a.total === 0 ? 'no_license' : unavailableReason(a));
    }
    const result = await allocateSeat(tx, organizationId, userId, today, now);
    if (!result.ok) throw seatError(result.reason);
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: 'seat.assign',
      targetType: 'seat',
      targetId: result.seatId,
      diff: { userId, reassigned: result.reassigned },
    });
  });
}

/** Tên hiển thị lúc rời lớp, để giáo viên còn thấy "đã chuyển sang lộ trình cá nhân" mà không đọc hồ sơ. */
async function exitName(tx: Transaction, userId: string): Promise<string | null> {
  return (await getProfile(tx, userId))?.displayName ?? null;
}

/**
 * Thu hồi seat của một người trong tổ chức. Học viên đang trong lớp ⇒ đóng thành viên (`seat_revoked`);
 * giáo viên ⇒ giữ vai trò nhưng mất quyền dữ liệu (FR-038). Người không giữ seat ⇒ 404 chung (nên thu hồi
 * song song hai lần chỉ có một lần thành công).
 */
export async function revokeSeat(
  deps: SeatDeps,
  actorId: string | null,
  organizationId: string,
  userId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    const seat = await findSeatByHolder(tx, organizationId, userId);
    if (!seat) throw notFoundGeneric();
    const now = deps.clock.now();

    const membership = await findActiveMembershipByUser(tx, userId);
    let learnerEnded = false;
    if (membership && membership.organizationId === organizationId) {
      await closeMembership(
        tx,
        organizationId,
        membership.id,
        'seat_revoked',
        await exitName(tx, userId),
        now,
      );
      await clearPendingTodayPlan(tx, deps, userId);
      learnerEnded = true;
    }
    await releaseSeat(tx, organizationId, seat.id);
    await removeOrgMemberIfUnused(tx, organizationId, userId);
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: 'seat.revoke',
      targetType: 'seat',
      targetId: seat.id,
      diff: { userId, learnerEnded },
    });
  });
}

/**
 * Kết thúc thành viên lớp đang hoạt động của `userId` trong tổ chức (rời lớp, bị gỡ, lưu trữ…): đóng thành
 * viên, giải phóng seat NẾU người này không còn là giáo viên (giáo viên rời lớp vẫn giữ seat – FR-004), rồi
 * dọn dòng `organization_members` nếu không còn vai trò nào. Trả `false` nếu không có thành viên để đóng.
 * Việc dọn kế hoạch hôm nay và nhật ký thuộc caller (US2/US3).
 */
export async function endLearnerMembership(
  deps: SeatDeps,
  organizationId: string,
  userId: string,
  reason: MembershipEndReason,
): Promise<boolean> {
  return deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) return false;
    const membership = await findActiveMembershipByUser(tx, userId);
    if (!membership || membership.organizationId !== organizationId) return false;
    await closeMembership(
      tx,
      organizationId,
      membership.id,
      reason,
      await exitName(tx, userId),
      deps.clock.now(),
    );
    await clearPendingTodayPlan(tx, deps, userId);
    const member = await getOrgMember(tx, organizationId, userId);
    if (!member?.isTeacher) {
      const seat = await findSeatByHolder(tx, organizationId, userId);
      if (seat) await releaseSeat(tx, organizationId, seat.id);
    }
    await removeOrgMemberIfUnused(tx, organizationId, userId);
    return true;
  });
}

/**
 * Đổi số seat của một giấy phép (thêm/xóa dòng seat TRỐNG). Giảm dưới (đang dùng + giữ chỗ) ⇒ 422
 * `SEAT_BELOW_USAGE` (FR-005); chỉ giấy phép đang hiệu lực mới bị trừ phần giữ chỗ vì lời mời chỉ giữ chỗ trên
 * giấy phép hiệu lực. Caller đã khóa tổ chức.
 */
export async function adjustLicenseSeats(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  organizationId: string,
  license: SeatLicenseRow,
  target: number,
): Promise<void> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const counts = await licenseSeatCounts(tx, organizationId, license.id);
  const reserved = isLicenseEffective(license, today)
    ? await countReservations(tx, organizationId, deps.clock.now())
    : 0;
  if (target < counts.used + reserved) {
    throw orgError(
      'SEAT_BELOW_USAGE',
      `Không thể giảm xuống ${target} seat: đang dùng ${counts.used} và giữ chỗ ${reserved}`,
    );
  }
  if (target > counts.total) {
    await insertSeats(tx, license.id, target - counts.total);
  } else if (target < counts.total) {
    const wanted = counts.total - target;
    const removed = await deleteFreeSeats(tx, organizationId, license.id, wanted);
    if (removed < wanted) {
      throw orgError('SEAT_BELOW_USAGE', 'Không đủ seat trống để giảm số lượng');
    }
  }
}

/**
 * Sau khi có giấy phép mới: cấp lại seat cho giáo viên (không phải chủ tổ chức) chưa có seat theo thứ tự vào
 * tổ chức, dừng khi hết chỗ (FR-006). Trả số giáo viên đã được cấp. Caller đã khóa tổ chức.
 */
export async function regrantTeacherSeats(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  actorId: string | null,
  organizationId: string,
): Promise<number> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const now = deps.clock.now();
  let granted = 0;
  for (const userId of await listTeachersWithoutSeat(tx, organizationId)) {
    const result = await allocateSeat(tx, organizationId, userId, today, now);
    if (!result.ok) break;
    granted += 1;
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: 'seat.assign',
      targetType: 'seat',
      targetId: result.seatId,
      diff: { userId, reassigned: result.reassigned, regrant: true },
    });
  }
  return granted;
}
