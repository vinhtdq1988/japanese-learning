import { notFoundGeneric } from '../api/errors.js';
import type { Transaction } from '../db/client.js';
import { logOrgAction } from '../db/repositories/admin-logs.js';
import { listPendingByOrg } from '../db/repositories/invitations.js';
import { countOrgClasses, listOwnerEmails } from '../db/repositories/organization-members.js';
import {
  getActiveLicense,
  getDisplayLicense,
  getLicenseInOrg,
  getOrganization,
  insertLicense,
  insertOrganization,
  listLicenses,
  listOrganizationsPage,
  lockOrganization,
  updateLicense,
  updateOrganization as updateOrganizationRow,
  type OrganizationRow,
  type SeatLicenseRow,
} from '../db/repositories/organizations.js';
import {
  insertSeats,
  licenseSeatCounts,
  listSeatHolders,
  seatSummary,
  type SeatSummary,
} from '../db/repositories/seats.js';
import type {
  AdminOrgCreateInput,
  AdminOrgUpdateInput,
  LicenseUpdateInput,
  LicenseWriteInput,
} from '../domain/org-validation.js';
import { AppError } from '../domain/types.js';
import { localToday } from '../engine/clock.js';
import { graceEndsOn, isLicenseEffective } from '../engine/seats.js';
import type { ServiceDeps } from './deps.js';
import { createInvitation, createInvitationTx, deliverInvitation } from './invitations.js';
import {
  invitationDto,
  licenseView,
  orgLicenseDto,
  seatSummaryDto,
  type InvitationRowDto,
  type LicenseViewDto,
  type OrgLicenseDto,
  type SeatSummaryDto,
} from './org-dto.js';
import { processOrgLapse } from './org-lifecycle.js';
import { adjustLicenseSeats, regrantTeacherSeats } from './org-seats.js';

// Dịch vụ quản trị tổ chức cho quản trị viên hệ thống (spec 004, T034, FR-001, FR-002, FR-006). Phản hồi
// chỉ có cấu trúc (tổ chức, giấy phép, người giữ seat); KHÔNG có dữ liệu học của học viên.

type AdminDeps = Pick<ServiceDeps, 'config' | 'db' | 'clock' | 'jobQueue'>;

export const ADMIN_ORG_PAGE_SIZE = 25;

export interface AdminOrganizationRowDto {
  id: string;
  name: string;
  status: OrganizationRow['status'];
  owners: { email: string; status: 'pending' | 'active' }[];
  seats: SeatSummaryDto;
  license: LicenseViewDto | null;
  warnings: ('noOwner' | 'expiring' | 'inGrace' | 'lapsed')[];
}

export interface AdminOrganizationDetailDto extends AdminOrganizationRowDto {
  licenses: OrgLicenseDto[];
  seatHolders: {
    userId: string;
    email: string;
    roles: ('teacher' | 'learner')[];
    assignedAt: string | null;
  }[];
  classCount: number;
  pendingInvitations: InvitationRowDto[];
}

const overlap = () =>
  new AppError(409, 'VALIDATION_FAILED', 'Kỳ hạn giấy phép chồng với giấy phép khác', {
    startsOn: 'Kỳ hạn chồng với giấy phép khác của tổ chức',
  });

/** Vi phạm ràng buộc loại trừ (`seat_licenses_no_overlap`, mã 23P01); Drizzle bọc lỗi gốc trong `cause`. */
function isExclusionViolation(err: unknown): boolean {
  const code = (e: unknown): unknown => (e as { code?: unknown } | null | undefined)?.code;
  return code(err) === '23P01' || code((err as { cause?: unknown } | null)?.cause) === '23P01';
}

async function organizationRow(
  deps: AdminDeps,
  org: OrganizationRow,
): Promise<AdminOrganizationRowDto> {
  const now = deps.clock.now();
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const [seats, display, activeOwners, pendingOwners] = await Promise.all([
    seatSummary(deps.db, org.id, today, now),
    getDisplayLicense(deps.db, org.id, today),
    listOwnerEmails(deps.db, org.id),
    listPendingByOrg(deps.db, org.id, now, ['owner']),
  ]);
  const license = display ? licenseView(display, today, deps.config) : null;
  const warnings: AdminOrganizationRowDto['warnings'] = [];
  if (activeOwners.length === 0) warnings.push('noOwner');
  if (license?.state === 'expiring') warnings.push('expiring');
  if (license?.state === 'in_grace') warnings.push('inGrace');
  if (license?.state === 'lapsed') warnings.push('lapsed');
  return {
    id: org.id,
    name: org.name,
    status: org.status,
    owners: [
      ...activeOwners.map((email) => ({ email, status: 'active' as const })),
      ...pendingOwners.map((inv) => ({ email: inv.email, status: 'pending' as const })),
    ],
    seats: seatSummaryDto(seats),
    license,
    warnings,
  };
}

export async function listOrganizations(
  deps: AdminDeps,
  query: { q?: string | undefined; status?: 'active' | 'disabled' | undefined; page: number },
): Promise<{ items: AdminOrganizationRowDto[]; total: number; page: number }> {
  const { rows, total } = await listOrganizationsPage(deps.db, {
    q: query.q,
    status: query.status,
    page: query.page,
    pageSize: ADMIN_ORG_PAGE_SIZE,
  });
  return {
    items: await Promise.all(rows.map((org) => organizationRow(deps, org))),
    total,
    page: query.page,
  };
}

/** Giấy phép kèm tóm tắt seat; chỉ giấy phép đang hiệu lực mới có `reserved`/`available`. */
async function licenseWithSeats(
  deps: Pick<ServiceDeps, 'config' | 'db' | 'clock'>,
  organizationId: string,
  license: SeatLicenseRow,
): Promise<OrgLicenseDto> {
  const now = deps.clock.now();
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const active = await getActiveLicense(deps.db, organizationId, today);
  let seats: SeatSummary;
  if (active?.id === license.id) {
    seats = await seatSummary(deps.db, organizationId, today, now);
  } else {
    const counts = await licenseSeatCounts(deps.db, organizationId, license.id);
    seats = { total: counts.total, used: counts.used, reserved: 0, available: 0 };
  }
  return orgLicenseDto(license, seats, today, deps.config);
}

export async function getOrganizationDetail(
  deps: AdminDeps,
  organizationId: string,
): Promise<AdminOrganizationDetailDto> {
  const org = await getOrganization(deps.db, organizationId);
  if (!org) throw notFoundGeneric();
  const now = deps.clock.now();
  const [row, licenses, holders, classCount, pending] = await Promise.all([
    organizationRow(deps, org),
    listLicenses(deps.db, org.id),
    listSeatHolders(deps.db, org.id),
    countOrgClasses(deps.db, org.id),
    // Lời mời học viên bị loại: quản trị viên hệ thống không thấy dữ liệu học viên (FR-002).
    listPendingByOrg(deps.db, org.id, now, ['owner', 'teacher']),
  ]);
  return {
    ...row,
    licenses: await Promise.all(licenses.map((l) => licenseWithSeats(deps, org.id, l))),
    seatHolders: holders.map((h) => ({
      userId: h.user_id,
      email: h.email,
      roles: [
        ...(h.is_teacher ? (['teacher'] as const) : []),
        ...(h.is_learner ? (['learner'] as const) : []),
      ],
      assignedAt: h.assigned_at,
    })),
    classCount,
    pendingInvitations: pending.map(invitationDto),
  };
}

/**
 * Tạo giấy phép + các dòng seat trống trong giao dịch của caller (tổ chức đã khóa). Kỳ hạn chồng ngày ⇒
 * 409. Nếu giấy phép đang hiệu lực, cấp lại seat cho giáo viên chưa có seat theo thứ tự vào tổ chức.
 */
export async function createLicenseTx(
  tx: Transaction,
  deps: Pick<ServiceDeps, 'config' | 'clock'>,
  actorId: string | null,
  organizationId: string,
  input: LicenseWriteInput,
): Promise<SeatLicenseRow> {
  let license: SeatLicenseRow;
  try {
    license = await insertLicense(tx, {
      organizationId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      graceDays: input.graceDays ?? deps.config.SEAT_GRACE_DAYS,
      maxReassignments: input.maxReassignments ?? deps.config.SEAT_MAX_REASSIGNMENTS,
      createdBy: actorId,
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw overlap();
    throw err;
  }
  await insertSeats(tx, license.id, input.seats);
  const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
  const regranted = isLicenseEffective(license, today)
    ? await regrantTeacherSeats(tx, deps, actorId, organizationId)
    : 0;
  await logOrgAction(tx, {
    actorId,
    organizationId,
    action: 'license.create',
    targetType: 'license',
    targetId: license.id,
    diff: {
      seats: input.seats,
      startsOn: license.startsOn,
      endsOn: license.endsOn,
      graceDays: license.graceDays,
      maxReassignments: license.maxReassignments,
      teachersRegranted: regranted,
    },
  });
  return license;
}

export async function createLicense(
  deps: AdminDeps,
  actorId: string | null,
  organizationId: string,
  input: LicenseWriteInput,
): Promise<OrgLicenseDto> {
  const license = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    return createLicenseTx(tx, deps, actorId, organizationId, input);
  });
  return licenseWithSeats(deps, organizationId, license);
}

/**
 * Chỉnh giấy phép: số seat (thêm/xóa seat TRỐNG; giảm dưới đang dùng + giữ chỗ ⇒ 422 `SEAT_BELOW_USAGE`),
 * ngày hết hạn (gia hạn giữ nguyên người giữ seat), ân hạn, giới hạn đổi người giữ. Gia hạn lại một giấy phép
 * đã bị xử lý hết hạn thì bỏ dấu `lapse_processed_at` để lần hết hạn sau được xử lý lại.
 */
export async function patchLicense(
  deps: AdminDeps,
  actorId: string | null,
  organizationId: string,
  licenseId: string,
  patch: LicenseUpdateInput,
): Promise<OrgLicenseDto> {
  const updated = await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    const license = await getLicenseInOrg(tx, organizationId, licenseId);
    if (!license) throw notFoundGeneric();
    const before = {
      endsOn: license.endsOn,
      graceDays: license.graceDays,
      maxReassignments: license.maxReassignments,
    };
    const next = {
      endsOn: patch.endsOn ?? license.endsOn,
      graceDays: patch.graceDays ?? license.graceDays,
      maxReassignments: patch.maxReassignments ?? license.maxReassignments,
    };
    if (next.endsOn < license.startsOn) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        endsOn: 'Ngày hết hạn phải từ ngày bắt đầu trở đi',
      });
    }
    if (patch.seats !== undefined) {
      await adjustLicenseSeats(tx, deps, organizationId, license, patch.seats);
    }
    const today = localToday(deps.clock, deps.config.ORG_TIMEZONE);
    const revived =
      license.lapseProcessedAt !== null && license.revokedAt === null && today <= graceEndsOn(next);
    try {
      await updateLicense(tx, organizationId, license.id, {
        ...next,
        ...(revived ? { lapseProcessedAt: null } : {}),
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw overlap();
      throw err;
    }
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: 'license.adjust',
      targetType: 'license',
      targetId: license.id,
      diff: { before, after: next, ...(patch.seats !== undefined ? { seats: patch.seats } : {}) },
    });
    return (await getLicenseInOrg(tx, organizationId, licenseId))!;
  });
  return licenseWithSeats(deps, organizationId, updated);
}

/** Thu hồi giấy phép ⇒ xử lý như hết hạn ngay (giải phóng seat, đóng thành viên, hủy lời mời). Idempotent. */
export async function revokeLicense(
  deps: AdminDeps,
  actorId: string | null,
  organizationId: string,
  licenseId: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    if (!(await lockOrganization(tx, organizationId))) throw notFoundGeneric();
    const license = await getLicenseInOrg(tx, organizationId, licenseId);
    if (!license) throw notFoundGeneric();
    if (license.revokedAt === null) {
      await updateLicense(tx, organizationId, license.id, { revokedAt: deps.clock.now() });
      await logOrgAction(tx, {
        actorId,
        organizationId,
        action: 'license.revoke',
        targetType: 'license',
        targetId: license.id,
        diff: null,
      });
    }
    await processOrgLapse(tx, deps, organizationId, 'seat_expired');
  });
}

/** Vô hiệu hóa (xử lý hết seat ngay) hoặc kích hoạt lại tổ chức; kích hoạt lại KHÔNG tự mời lại học viên. */
export async function setOrganizationStatus(
  deps: AdminDeps,
  actorId: string | null,
  organizationId: string,
  status: 'active' | 'disabled',
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    const org = await lockOrganization(tx, organizationId);
    if (!org) throw notFoundGeneric();
    if (org.status === status) return;
    const now = deps.clock.now();
    await updateOrganizationRow(
      tx,
      organizationId,
      { status, disabledAt: status === 'disabled' ? now : null },
      now,
    );
    if (status === 'disabled') await processOrgLapse(tx, deps, organizationId, 'org_disabled');
    await logOrgAction(tx, {
      actorId,
      organizationId,
      action: status === 'disabled' ? 'org.disable' : 'org.enable',
      targetType: 'organization',
      targetId: organizationId,
      diff: { from: org.status, to: status },
    });
  });
}

export async function updateOrganization(
  deps: AdminDeps,
  actorId: string | null,
  organizationId: string,
  patch: AdminOrgUpdateInput,
): Promise<AdminOrganizationDetailDto> {
  if (patch.name !== undefined) {
    await deps.db.transaction(async (tx) => {
      const org = await lockOrganization(tx, organizationId);
      if (!org) throw notFoundGeneric();
      if (org.name === patch.name) return;
      await updateOrganizationRow(tx, organizationId, { name: patch.name! }, deps.clock.now());
      await logOrgAction(tx, {
        actorId,
        organizationId,
        action: 'org.rename',
        targetType: 'organization',
        targetId: organizationId,
        diff: { rename: { from: org.name, to: patch.name } },
      });
    });
  }
  if (patch.status !== undefined) {
    await setOrganizationStatus(deps, actorId, organizationId, patch.status);
  }
  return getOrganizationDetail(deps, organizationId);
}

/**
 * Tạo tổ chức: tổ chức + (tùy chọn) giấy phép/seat + lời mời chủ tổ chức trong MỘT giao dịch, rồi gửi thư mời.
 * Email chủ là tài khoản của tổ chức khác ⇒ 409 `INVITEE_UNAVAILABLE` và không tạo gì.
 */
export async function createOrganization(
  deps: AdminDeps,
  actorId: string,
  input: AdminOrgCreateInput,
): Promise<AdminOrganizationDetailDto> {
  const { org, invitation } = await deps.db.transaction(async (tx) => {
    const org = await insertOrganization(tx, { name: input.name, createdBy: actorId });
    await logOrgAction(tx, {
      actorId,
      organizationId: org.id,
      action: 'org.create',
      targetType: 'organization',
      targetId: org.id,
      diff: { name: org.name },
    });
    if (input.license) await createLicenseTx(tx, deps, actorId, org.id, input.license);
    const invitation = await createInvitationTx(tx, deps, {
      organizationId: org.id,
      kind: 'owner',
      email: input.ownerEmail,
      invitedBy: actorId,
    });
    return { org, invitation };
  });
  await deliverInvitation(deps, invitation);
  return getOrganizationDetail(deps, org.id);
}

/** Mời thêm/thay chủ tổ chức (không chiếm seat). Tổ chức không tồn tại ⇒ 404 chung. */
export async function inviteOwner(
  deps: AdminDeps,
  actorId: string,
  organizationId: string,
  email: string,
): Promise<InvitationRowDto> {
  if (!(await getOrganization(deps.db, organizationId))) throw notFoundGeneric();
  return createInvitation(deps, { organizationId, kind: 'owner', email, invitedBy: actorId });
}
