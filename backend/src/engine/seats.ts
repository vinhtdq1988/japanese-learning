import type { LicenseState } from '../domain/org-types.js';
import type { LocalDate } from '../domain/types.js';
import { addDays, diffDays } from './clock.js';

// Chọn seat, tính chỗ còn trống và trạng thái giấy phép – hàm thuần (spec 004, research O3, data-model §3.3, §3.4).
// Không đụng CSDL: lớp repository nạp danh sách seat trống rồi gọi các hàm này trong giao dịch đã khóa
// tổ chức, nên quy tắc "đổi người giữ tối đa N lần" kiểm thử được bằng hồ sơ dữ liệu thuần.

/** Một seat trống (chưa có người giữ) của giấy phép hiệu lực. */
export interface FreeSeat {
  id: string;
  /** Người giữ gần nhất (null = chưa từng có người giữ). */
  lastHolderUserId: string | null;
  /** Số lần đổi người giữ đã dùng trong kỳ hạn. */
  reassignmentCount: number;
}

export type SeatPick =
  | {
      kind: 'assign';
      seatId: string;
      /** `true` nếu việc gán này tính là một lần đổi người giữ (tăng đếm, đặt lại `lastHolder`). */
      countsAsReassignment: boolean;
    }
  | {
      /** Không còn seat trống nào. */
      kind: 'no_free_seat';
    }
  | {
      /** Còn seat trống nhưng mọi seat đã dùng hết số lần đổi người giữ. */
      kind: 'reassign_limit';
    };

/**
 * Chọn seat để gán cho `userId`, theo thứ tự ưu tiên (research O3):
 * 1. seat trống mà chính người này từng giữ (`lastHolder === userId`) – KHÔNG tăng đếm ("rời rồi vào lại");
 * 2. seat trống chưa từng có người giữ – không tăng đếm;
 * 3. seat trống của người khác còn `reassignmentCount < maxReassignments` – tăng 1 (ưu tiên seat đã đổi ít
 *    nhất để dàn đều số lần đổi);
 * 4. không có: `no_free_seat` nếu hết seat trống, `reassign_limit` nếu còn seat nhưng đã hết lượt đổi.
 *
 * Thứ tự đầu vào quyết định kết quả khi hòa (ổn định) nên truy vấn nên sắp theo id.
 */
export function pickSeatToAssign(
  freeSeats: readonly FreeSeat[],
  userId: string,
  maxReassignments: number,
): SeatPick {
  if (freeSeats.length === 0) return { kind: 'no_free_seat' };

  const returning = freeSeats.find((s) => s.lastHolderUserId === userId);
  if (returning) return { kind: 'assign', seatId: returning.id, countsAsReassignment: false };

  const virgin = freeSeats.find((s) => s.lastHolderUserId === null);
  if (virgin) return { kind: 'assign', seatId: virgin.id, countsAsReassignment: false };

  let best: FreeSeat | undefined;
  for (const s of freeSeats) {
    if (s.reassignmentCount >= maxReassignments) continue;
    if (!best || s.reassignmentCount < best.reassignmentCount) best = s;
  }
  if (best) return { kind: 'assign', seatId: best.id, countsAsReassignment: true };
  return { kind: 'reassign_limit' };
}

/** Đầu vào của `availableSeats`. */
export interface SeatCounts {
  /** Tổng số seat của giấy phép hiệu lực. */
  totalSeats: number;
  /** Seat đang có người giữ. */
  usedSeats: number;
  /**
   * Seat trống có thể gán (`lastHolder IS NULL OR reassignmentCount < max`). Tính bảo thủ: không xét ưu
   * tiên "quay lại" của một người cụ thể.
   */
  assignableFree: number;
  /** Lời mời giáo viên/học viên đang chờ chưa hết hạn (giữ chỗ theo đếm). */
  reservedInvitations: number;
}

/** Số chỗ còn có thể mời/gán: `assignableFree − reservedInvitations`, không âm và không vượt seat trống. */
export function availableSeats(counts: SeatCounts): number {
  const free = Math.max(0, counts.totalSeats - counts.usedSeats);
  const assignable = Math.min(Math.max(0, counts.assignableFree), free);
  return Math.max(0, assignable - Math.max(0, counts.reservedInvitations));
}

/** Các cột ngày của giấy phép dùng để tính hiệu lực (ngày theo `ORG_TIMEZONE`, research O3). */
export interface LicenseDates {
  startsOn: LocalDate;
  endsOn: LocalDate;
  graceDays: number;
  revokedAt: Date | null;
}

/** Ngày cuối cùng còn quyền sử dụng: `ends_on + grace_days` (hết ân hạn). */
export function graceEndsOn(license: Pick<LicenseDates, 'endsOn' | 'graceDays'>): LocalDate {
  return addDays(license.endsOn, license.graceDays);
}

/**
 * Giấy phép còn hiệu lực tại `today` (kể cả ân hạn): `revoked_at IS NULL ∧ starts_on ≤ d ≤ ends_on + grace`.
 * Đây cũng là điều kiện truy vấn của `getActiveLicense`.
 */
export function isLicenseEffective(license: LicenseDates, today: LocalDate): boolean {
  return license.revokedAt === null && license.startsOn <= today && today <= graceEndsOn(license);
}

/**
 * Trạng thái hiển thị của giấy phép tại `today`: `lapsed` khi bị thu hồi hoặc quá ân hạn; `in_grace` khi
 * quá `ends_on` nhưng còn ân hạn; `expiring` khi còn ≤ `warningDays` ngày đến `ends_on`; còn lại `ok`
 * (giấy phép chưa bắt đầu cũng hiện `ok` – chưa có hiệu lực nhưng chưa có gì cần cảnh báo).
 */
export function licenseStateOn(
  license: LicenseDates,
  today: LocalDate,
  warningDays: number,
): LicenseState {
  if (license.revokedAt !== null || today > graceEndsOn(license)) return 'lapsed';
  if (today > license.endsOn) return 'in_grace';
  if (diffDays(today, license.endsOn) <= warningDays) return 'expiring';
  return 'ok';
}
