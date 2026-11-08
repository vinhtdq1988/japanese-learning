import { sql, type SQL } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import { closeAllActiveForOrg } from '../db/repositories/class-memberships.js';
import { revokePendingSeatInvitations } from '../db/repositories/invitations.js';
import { deleteUnusedOrgMembers } from '../db/repositories/organization-members.js';
import {
  listUnprocessedLapsedLicenses,
  lockOrganization,
  updateLicense,
} from '../db/repositories/organizations.js';
import { releaseAllSeats } from '../db/repositories/seats.js';
import type { LocalDate } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import type { ServiceDeps } from './deps.js';
import { clearPendingTodayPlan } from './plan-reset.js';

// Vòng đời hết hạn / ân hạn / vô hiệu hóa tổ chức (spec 004, FR-006, FR-038, research O3). `processOrgLapse`
// vừa được gọi LƯỜI khi `loadOrgContext` phát hiện quá hạn chưa xử lý (hiệu lực tức thì – SC-008), vừa bởi job
// định kỳ `org-lifecycle` (nhất quán dữ liệu khi không ai truy cập).

export type LapseReason = 'seat_expired' | 'org_disabled';

type LifecycleDeps = Pick<ServiceDeps, 'config' | 'clock'>;

/**
 * Điều kiện SQL "tổ chức cần xử lý hết hạn", dùng chung cho `loadOrgContext` và job quét:
 * (1) tổ chức `disabled` mà vẫn còn seat/thành viên lớp/lời mời giáo viên–học viên đang chờ; hoặc
 * (2) KHÔNG còn giấy phép hiệu lực mà vẫn có giấy phép bị thu hồi/quá ân hạn chưa `lapse_processed_at`.
 * Điều kiện "không còn giấy phép hiệu lực" giữ nguyên người học khi gia hạn bằng giấy phép liền kề: giấy phép
 * cũ chưa xử lý nhưng giấy phép mới đã hiệu lực thì không xóa gì cả.
 */
export function needsLapseCondition(orgId: SQL, orgStatus: SQL, today: LocalDate): SQL {
  return sql`(
    (${orgStatus} = 'disabled' AND (
        EXISTS (SELECT 1 FROM seats s JOIN seat_licenses l ON l.id = s.license_id
                 WHERE l.organization_id = ${orgId} AND s.holder_user_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM class_memberships cm
                 WHERE cm.organization_id = ${orgId} AND cm.left_at IS NULL)
     OR EXISTS (SELECT 1 FROM invitations i
                 WHERE i.organization_id = ${orgId} AND i.status = 'pending' AND i.kind <> 'owner')
    ))
    OR (
      NOT EXISTS (SELECT 1 FROM seat_licenses e
                   WHERE e.organization_id = ${orgId} AND e.revoked_at IS NULL
                     AND e.starts_on <= ${today}::date
                     AND ${today}::date <= e.ends_on + e.grace_days::int)
      AND EXISTS (SELECT 1 FROM seat_licenses u
                   WHERE u.organization_id = ${orgId} AND u.lapse_processed_at IS NULL
                     AND (u.revoked_at IS NOT NULL
                          OR ${today}::date > u.ends_on + u.grace_days::int))
    )
  )`;
}

/** Id các tổ chức đang cần xử lý hết hạn tại `today` (job quét). */
export async function findOrgsNeedingLapse(db: Database, today: LocalDate): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    SELECT o.id FROM organizations o
     WHERE ${needsLapseCondition(sql`o.id`, sql`o.status`, today)}
     ORDER BY o.id`);
  return result.rows.map((r) => r.id);
}

/**
 * Xử lý hết hạn/vô hiệu hóa cho một tổ chức, trong giao dịch của caller: đóng mọi thành viên lớp, giải
 * phóng mọi seat, hủy lời mời giáo viên/học viên đang chờ, đánh dấu giấy phép đã xử lý và dọn dòng
 * `organization_members` không còn vai trò. Giáo viên GIỮ vai trò (chỉ mất seat ⇒ mất quyền xem dữ liệu).
 *
 * IDEMPOTENT và an toàn khi chạy đồng thời với job/người dùng khác nhờ khóa advisory theo tổ chức; lần gọi
 * thứ hai không còn gì để làm nên không ghi nhật ký. Tổ chức đang `disabled` luôn dùng lý do `org_disabled`.
 * Trả `true` nếu có thay đổi.
 */
export async function processOrgLapse(
  tx: Transaction,
  deps: LifecycleDeps,
  organizationId: string,
  reason: LapseReason,
): Promise<boolean> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`org-lapse:${organizationId}`}))`);
  const org = await lockOrganization(tx, organizationId);
  if (!org) return false;
  const now = deps.clock.now();
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const effectiveReason: LapseReason = org.status === 'disabled' ? 'org_disabled' : reason;

  const closed = await closeAllActiveForOrg(tx, organizationId, effectiveReason, now);
  // Học viên bị đóng thành viên quay về lộ trình cá nhân: bỏ kế hoạch hôm nay nếu chưa học gì (O6).
  for (const member of closed) await clearPendingTodayPlan(tx, deps, member.userId);
  const releasedSeats = await releaseAllSeats(tx, organizationId);
  const revokedInvitations = await revokePendingSeatInvitations(tx, organizationId, now);
  const lapsedLicenses = await listUnprocessedLapsedLicenses(tx, organizationId, today);
  for (const license of lapsedLicenses) {
    await updateLicense(tx, organizationId, license.id, { lapseProcessedAt: now });
  }
  await deleteUnusedOrgMembers(tx, organizationId);

  const changed =
    closed.length > 0 ||
    releasedSeats.length > 0 ||
    revokedInvitations > 0 ||
    lapsedLicenses.length > 0;
  if (changed) {
    await logOrgAction(tx, {
      actorId: null,
      organizationId,
      action: 'seat.revoke',
      targetType: 'organization',
      targetId: organizationId,
      diff: {
        reason: effectiveReason,
        learnersEnded: closed.length,
        seatsReleased: releasedSeats.length,
        invitationsRevoked: revokedInvitations,
      },
    });
  }
  return changed;
}
