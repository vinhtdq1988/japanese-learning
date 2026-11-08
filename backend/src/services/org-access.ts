import { sql } from 'drizzle-orm';
import { notFoundGeneric, orgError } from '../api/errors.js';
import { getClassInOrg, isClassTeacher, type ClassRow } from '../db/repositories/classes.js';
import type { LicenseState } from '../domain/org-types.js';
import { localToday } from '../engine/clock.js';
import { graceEndsOn, licenseStateOn } from '../engine/seats.js';
import type { ServiceDeps } from './deps.js';
import { needsLapseCondition, processOrgLapse } from './org-lifecycle.js';

// Ngữ cảnh và quyền tổ chức (spec 004, research O2, contracts/permissions-matrix.md).
// Vai trò tổ chức KHÔNG nằm trong JWT: mọi route tổ chức/lớp tra CSDL MỖI request nên mất quyền (gỡ vai
// trò, mất seat, hết hạn, vô hiệu hóa tổ chức) có hiệu lực ngay cả với phiên đang mở (FR-037, SC-008).

/** Ngữ cảnh tổ chức của người gọi; `null` khi tài khoản không thuộc tổ chức nào. */
export interface OrgContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  isOwner: boolean;
  isTeacher: boolean;
  /** Đang giữ seat trong giấy phép còn hiệu lực. */
  hasSeat: boolean;
  /** Tổ chức đang `active` (không bị vô hiệu hóa). */
  orgActive: boolean;
  /** Có giấy phép còn hiệu lực (kể cả ân hạn). */
  licenseEffective: boolean;
  /** `none` khi tổ chức chưa có giấy phép nào; các giá trị còn lại theo `licenseStateOn`. */
  licenseState: LicenseState | 'none';
  /** Ngày hết hạn và hết ân hạn của giấy phép hiệu lực (null nếu không có). */
  licenseEndsOn: string | null;
  licenseGraceEndsOn: string | null;
  /**
   * Quyền xem dữ liệu học viên: tổ chức `active` ∧ giấy phép hiệu lực (kể cả ân hạn) ∧ (chủ tổ chức ∨ giáo
   * viên đang giữ seat). Giáo viên mất seat giữ vai trò nhưng chỉ xem cấu trúc (FR-038).
   */
  dataAccess: boolean;
}

interface OrgContextRow extends Record<string, unknown> {
  organization_id: string;
  organization_name: string;
  org_status: 'active' | 'disabled';
  is_owner: boolean;
  is_teacher: boolean;
  license_starts_on: string | null;
  license_ends_on: string | null;
  license_grace_days: number | null;
  has_any_license: boolean;
  seat_id: string | null;
  needs_lapse: boolean;
}

/** Quyền dữ liệu từ các thành phần (hàm thuần để kiểm thử độc lập). */
export function computeDataAccess(input: {
  orgActive: boolean;
  licenseEffective: boolean;
  isOwner: boolean;
  isTeacher: boolean;
  hasSeat: boolean;
}): boolean {
  return (
    input.orgActive &&
    input.licenseEffective &&
    (input.isOwner || (input.isTeacher && input.hasSeat))
  );
}

/**
 * Nạp ngữ cảnh tổ chức của `userId` bằng MỘT truy vấn: `organization_members` ⨝ `organizations` ⨝ giấy phép
 * hiệu lực (ngày theo `ORG_TIMEZONE`) ⨝ seat của chính người này. Trả `null` nếu không thuộc tổ chức nào.
 */
export async function loadOrgContext(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  userId: string,
  lapseChecked = false,
): Promise<OrgContext | null> {
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const result = await deps.db.execute<OrgContextRow>(sql`
    SELECT m.organization_id,
           o.name   AS organization_name,
           o.status AS org_status,
           m.is_owner,
           m.is_teacher,
           l.starts_on     AS license_starts_on,
           l.ends_on       AS license_ends_on,
           l.grace_days    AS license_grace_days,
           EXISTS (SELECT 1 FROM seat_licenses a WHERE a.organization_id = m.organization_id)
             AS has_any_license,
           s.id AS seat_id,
           ${needsLapseCondition(sql`m.organization_id`, sql`o.status`, today)} AS needs_lapse
      FROM organization_members m
      JOIN organizations o ON o.id = m.organization_id
      LEFT JOIN LATERAL (
        SELECT sl.id, sl.starts_on, sl.ends_on, sl.grace_days
          FROM seat_licenses sl
         WHERE sl.organization_id = m.organization_id
           AND sl.revoked_at IS NULL
           AND sl.starts_on <= ${today}::date
           AND ${today}::date <= sl.ends_on + sl.grace_days::int
         ORDER BY sl.starts_on DESC
         LIMIT 1
      ) l ON true
      LEFT JOIN seats s ON s.license_id = l.id AND s.holder_user_id = m.user_id
     WHERE m.user_id = ${userId}`);
  const row = result.rows[0];
  if (!row) return null;

  // Xử lý LƯỜI khi phát hiện giấy phép quá hạn/tổ chức bị vô hiệu hóa mà dữ liệu chưa được dọn: mất quyền có
  // hiệu lực ngay trong chính request này, không chờ job định kỳ (SC-008). Idempotent, nên an toàn khi đua.
  if (row.needs_lapse && !lapseChecked) {
    await deps.db.transaction((tx) =>
      processOrgLapse(tx, deps, row.organization_id, 'seat_expired'),
    );
    return loadOrgContext(deps, userId, true);
  }

  const hasLicense = row.license_starts_on !== null;
  let licenseState: OrgContext['licenseState'] = row.has_any_license ? 'lapsed' : 'none';
  let licenseEndsOn: string | null = null;
  let licenseGraceEndsOn: string | null = null;
  if (hasLicense) {
    const dates = {
      startsOn: row.license_starts_on!,
      endsOn: row.license_ends_on!,
      graceDays: Number(row.license_grace_days),
      revokedAt: null,
    };
    licenseState = licenseStateOn(dates, today, deps.config.SEAT_EXPIRY_WARNING_DAYS);
    licenseEndsOn = dates.endsOn;
    licenseGraceEndsOn = graceEndsOn(dates);
  }
  const orgActive = row.org_status === 'active';
  const licenseEffective = hasLicense;
  const hasSeat = row.seat_id !== null;
  return {
    userId,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    isOwner: row.is_owner,
    isTeacher: row.is_teacher,
    hasSeat,
    orgActive,
    licenseEffective,
    licenseState,
    licenseEndsOn,
    licenseGraceEndsOn,
    dataAccess: computeDataAccess({
      orgActive,
      licenseEffective,
      isOwner: row.is_owner,
      isTeacher: row.is_teacher,
      hasSeat,
    }),
  };
}

/**
 * Lớp mà người gọi QUẢN LÝ: chủ tổ chức quản lý mọi lớp của tổ chức; giáo viên chỉ lớp có dòng trong
 * `class_teachers`. Lớp không tồn tại, thuộc tổ chức khác, hoặc giáo viên không phụ trách ⇒ 404 chung,
 * thân phản hồi giống hệt nhau (FR-007, SC-004).
 */
export async function getManagedClass(
  deps: Pick<ServiceDeps, 'db'>,
  ctx: OrgContext,
  classId: string,
): Promise<ClassRow> {
  const cls = await getClassInOrg(deps.db, ctx.organizationId, classId);
  if (!cls) throw notFoundGeneric();
  if (!ctx.isOwner) {
    if (
      !ctx.isTeacher ||
      !(await isClassTeacher(deps.db, ctx.organizationId, cls.id, ctx.userId))
    ) {
      throw notFoundGeneric();
    }
  }
  return cls;
}

/** Thao tác ghi trên lớp đã lưu trữ ⇒ 409 `CLASS_ARCHIVED` (FR-009). */
export function assertClassWritable(cls: Pick<ClassRow, 'status'>): void {
  if (cls.status === 'archived') {
    throw orgError('CLASS_ARCHIVED', 'Lớp đã được lưu trữ, không thể thay đổi');
  }
}
