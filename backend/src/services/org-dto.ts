import type { Config } from '../config.js';
import type { InvitationRow } from '../db/repositories/invitations.js';
import type { SeatLicenseRow } from '../db/repositories/organizations.js';
import type { SeatSummary } from '../db/repositories/seats.js';
import type { LicenseState } from '../domain/org-types.js';
import type { LocalDate } from '../domain/types.js';
import { graceEndsOn, licenseStateOn } from '../engine/seats.js';

// DTO dùng chung cho các dịch vụ tổ chức (khớp openapi.yaml 1.12.0: SeatSummary, OrgLicense, InvitationRow).

export interface SeatSummaryDto {
  total: number;
  used: number;
  reserved: number;
  available: number;
}

export const seatSummaryDto = (s: SeatSummary): SeatSummaryDto => ({
  total: s.total,
  used: s.used,
  reserved: s.reserved,
  available: s.available,
});

/** Trạng thái hiển thị của một giấy phép tại `today` (thu hồi/quá ân hạn ⇒ `lapsed`). */
export function licenseStateOf(
  license: SeatLicenseRow,
  today: LocalDate,
  config: Pick<Config, 'SEAT_EXPIRY_WARNING_DAYS'>,
): LicenseState {
  return licenseStateOn(license, today, config.SEAT_EXPIRY_WARNING_DAYS);
}

export interface LicenseViewDto {
  state: LicenseState;
  endsOn: string;
  graceEndsOn: string;
}

/** `Me.organization.license` / một phần của tổng quan: ngày hết hạn, hết ân hạn và trạng thái. */
export function licenseView(
  license: SeatLicenseRow,
  today: LocalDate,
  config: Pick<Config, 'SEAT_EXPIRY_WARNING_DAYS'>,
): LicenseViewDto {
  return {
    state: licenseStateOf(license, today, config),
    endsOn: license.endsOn,
    graceEndsOn: graceEndsOn(license),
  };
}

export interface OrgLicenseDto {
  id: string;
  startsOn: string;
  endsOn: string;
  graceEndsOn: string;
  graceDays: number;
  maxReassignments: number;
  revokedAt: string | null;
  seats: SeatSummaryDto;
  state: LicenseState;
}

export function orgLicenseDto(
  license: SeatLicenseRow,
  seats: SeatSummary,
  today: LocalDate,
  config: Pick<Config, 'SEAT_EXPIRY_WARNING_DAYS'>,
): OrgLicenseDto {
  return {
    id: license.id,
    startsOn: license.startsOn,
    endsOn: license.endsOn,
    graceEndsOn: graceEndsOn(license),
    graceDays: license.graceDays,
    maxReassignments: license.maxReassignments,
    revokedAt: license.revokedAt ? license.revokedAt.toISOString() : null,
    seats: seatSummaryDto(seats),
    state: licenseStateOf(license, today, config),
  };
}

export interface InvitationRowDto {
  id: string;
  kind: InvitationRow['kind'];
  email: string;
  displayNameHint: string | null;
  classId: string | null;
  status: InvitationRow['status'];
  expiresAt: string;
  createdAt: string;
}

export const invitationDto = (row: InvitationRow): InvitationRowDto => ({
  id: row.id,
  kind: row.kind,
  email: row.email,
  displayNameHint: row.displayNameHint,
  classId: row.classId,
  status: row.status,
  expiresAt: row.expiresAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});
