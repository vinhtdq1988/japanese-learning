import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { seatLicenses, seats } from '../schema.js';
import type { LocalDate } from '../../domain/types.js';
import { availableSeats, pickSeatToAssign, type FreeSeat } from '../../engine/seats.js';
import { countReservations, getActiveLicense, type SeatLicenseRow } from './organizations.js';

// Repository seat (spec 004, research O3, data-model §3.4). Mọi hàm nhận `organizationId` bắt buộc và
// chỉ chạm tới seat thuộc giấy phép của tổ chức đó. Các hàm GHI (`allocateSeat`, `releaseSeat`) PHẢI chạy
// trong giao dịch đã khóa tổ chức bằng `lockOrganization`.

export type SeatRow = typeof seats.$inferSelect;

export interface SeatSummary {
  total: number;
  used: number;
  reserved: number;
  available: number;
}

/** Seat đang giữ bởi `userId` trong tổ chức (không giới hạn giấy phép hiệu lực); `undefined` nếu không có. */
export async function findSeatByHolder(
  db: DbExecutor,
  organizationId: string,
  userId: string,
): Promise<SeatRow | undefined> {
  const [row] = await db
    .select({ seat: seats })
    .from(seats)
    .innerJoin(seatLicenses, eq(seatLicenses.id, seats.licenseId))
    .where(and(eq(seatLicenses.organizationId, organizationId), eq(seats.holderUserId, userId)))
    .limit(1);
  return row?.seat;
}

/** Seat trống của một giấy phép thuộc tổ chức, sắp theo id để chọn seat ổn định. */
export async function listFreeSeats(
  db: DbExecutor,
  organizationId: string,
  licenseId: string,
): Promise<FreeSeat[]> {
  const rows = await db
    .select({
      id: seats.id,
      lastHolderUserId: seats.lastHolderUserId,
      reassignmentCount: seats.reassignmentCount,
    })
    .from(seats)
    .innerJoin(seatLicenses, eq(seatLicenses.id, seats.licenseId))
    .where(
      and(
        eq(seatLicenses.organizationId, organizationId),
        eq(seats.licenseId, licenseId),
        sql`${seats.holderUserId} IS NULL`,
      ),
    )
    .orderBy(asc(seats.id));
  return rows;
}

export type AllocateResult =
  /** Gán thành công; `reassigned` = có tính một lần đổi người giữ. */
  | { ok: true; seatId: string; reassigned: boolean; alreadyHeld: boolean }
  /** Tổ chức không có giấy phép hiệu lực ⇒ không có seat nào. */
  | { ok: false; reason: 'no_license' }
  /** Hết seat trống ⇒ `SEAT_UNAVAILABLE` (409). */
  | { ok: false; reason: 'no_free_seat' }
  /** Còn seat trống nhưng hết lượt đổi người giữ ⇒ `SEAT_REASSIGN_LIMIT` (422). */
  | { ok: false; reason: 'reassign_limit' };

/**
 * Gán một seat cho `userId` theo quy tắc ưu tiên của `pickSeatToAssign`. Một tài khoản chỉ giữ MỘT seat
 * (ràng buộc UNIQUE): nếu người này đã giữ seat trong tổ chức (ví dụ giáo viên đồng thời là học viên) thì
 * dùng lại seat đó, `alreadyHeld = true`, không đổi gì. Caller PHẢI đã khóa tổ chức.
 */
export async function allocateSeat(
  tx: Transaction,
  organizationId: string,
  userId: string,
  today: LocalDate,
  now: Date,
): Promise<AllocateResult> {
  const existing = await findSeatByHolder(tx, organizationId, userId);
  if (existing) {
    return { ok: true, seatId: existing.id, reassigned: false, alreadyHeld: true };
  }
  const license = await getActiveLicense(tx, organizationId, today);
  if (!license) return { ok: false, reason: 'no_license' };

  const free = await listFreeSeats(tx, organizationId, license.id);
  const pick = pickSeatToAssign(free, userId, license.maxReassignments);
  if (pick.kind !== 'assign') return { ok: false, reason: pick.kind };

  await tx
    .update(seats)
    .set({
      holderUserId: userId,
      lastHolderUserId: userId,
      assignedAt: now,
      ...(pick.countsAsReassignment
        ? { reassignmentCount: sql`${seats.reassignmentCount} + 1` }
        : {}),
    })
    .where(eq(seats.id, pick.seatId));
  return {
    ok: true,
    seatId: pick.seatId,
    reassigned: pick.countsAsReassignment,
    alreadyHeld: false,
  };
}

/**
 * Giải phóng seat: `holder_user_id := NULL`, giữ `last_holder_user_id` để người cũ quay lại không tính
 * đổi. Chỉ tác động seat thuộc giấy phép của tổ chức; trả `true` nếu có seat được giải phóng.
 */
export async function releaseSeat(
  tx: Transaction,
  organizationId: string,
  seatId: string,
): Promise<boolean> {
  const updated = await tx
    .update(seats)
    .set({ holderUserId: null, assignedAt: null })
    .where(
      and(
        eq(seats.id, seatId),
        sql`${seats.holderUserId} IS NOT NULL`,
        sql`${seats.licenseId} IN (SELECT id FROM seat_licenses WHERE organization_id = ${organizationId})`,
      ),
    )
    .returning({ id: seats.id });
  return updated.length > 0;
}

/** Tổng số seat, số đang dùng và số seat trống có thể gán của một giấy phép. */
async function countSeats(
  db: DbExecutor,
  organizationId: string,
  license: SeatLicenseRow,
): Promise<{ total: number; used: number; assignableFree: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      used: sql<number>`count(*) FILTER (WHERE ${seats.holderUserId} IS NOT NULL)::int`,
      assignableFree: sql<number>`count(*) FILTER (
        WHERE ${seats.holderUserId} IS NULL
          AND (${seats.lastHolderUserId} IS NULL OR ${seats.reassignmentCount} < ${license.maxReassignments})
      )::int`,
    })
    .from(seats)
    .innerJoin(seatLicenses, eq(seatLicenses.id, seats.licenseId))
    .where(and(eq(seatLicenses.organizationId, organizationId), eq(seats.licenseId, license.id)));
  return {
    total: row?.total ?? 0,
    used: row?.used ?? 0,
    assignableFree: row?.assignableFree ?? 0,
  };
}

/**
 * Tóm tắt seat của giấy phép hiệu lực: `available = assignableFree − reserved` (không âm, bảo thủ).
 * Không có giấy phép hiệu lực ⇒ mọi số bằng 0 (nhưng vẫn đếm lời mời đang giữ chỗ).
 */
export async function seatSummary(
  db: DbExecutor,
  organizationId: string,
  today: LocalDate,
  now: Date,
): Promise<SeatSummary> {
  const reserved = await countReservations(db, organizationId, now);
  const license = await getActiveLicense(db, organizationId, today);
  if (!license) return { total: 0, used: 0, reserved, available: 0 };
  const counts = await countSeats(db, organizationId, license);
  return {
    total: counts.total,
    used: counts.used,
    reserved,
    available: availableSeats({
      totalSeats: counts.total,
      usedSeats: counts.used,
      assignableFree: counts.assignableFree,
      reservedInvitations: reserved,
    }),
  };
}

/** `SeatSummary` kèm số liệu nội bộ để phân biệt "hết seat" với "còn seat nhưng hết lượt đổi người giữ". */
export interface SeatAvailability extends SeatSummary {
  /** Seat trống (kể cả seat hết lượt đổi). */
  free: number;
  /** Seat trống còn gán được (`lastHolder IS NULL OR reassignmentCount < max`). */
  assignableFree: number;
}

export async function seatAvailability(
  db: DbExecutor,
  organizationId: string,
  today: LocalDate,
  now: Date,
): Promise<SeatAvailability> {
  const reserved = await countReservations(db, organizationId, now);
  const license = await getActiveLicense(db, organizationId, today);
  if (!license) return { total: 0, used: 0, reserved, available: 0, free: 0, assignableFree: 0 };
  const counts = await countSeats(db, organizationId, license);
  return {
    total: counts.total,
    used: counts.used,
    reserved,
    available: availableSeats({
      totalSeats: counts.total,
      usedSeats: counts.used,
      assignableFree: counts.assignableFree,
      reservedInvitations: reserved,
    }),
    free: Math.max(0, counts.total - counts.used),
    assignableFree: counts.assignableFree,
  };
}

/** Tổng/đang dùng của MỘT giấy phép bất kỳ (kể cả giấy phép đã hết hạn), dùng cho chi tiết quản trị. */
export async function licenseSeatCounts(
  db: DbExecutor,
  organizationId: string,
  licenseId: string,
): Promise<{ total: number; used: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      used: sql<number>`count(*) FILTER (WHERE ${seats.holderUserId} IS NOT NULL)::int`,
    })
    .from(seats)
    .innerJoin(seatLicenses, eq(seatLicenses.id, seats.licenseId))
    .where(and(eq(seatLicenses.organizationId, organizationId), eq(seats.licenseId, licenseId)));
  return { total: row?.total ?? 0, used: row?.used ?? 0 };
}

/** Thêm `count` dòng seat trống vào giấy phép (gọi trong giao dịch đã khóa tổ chức). */
export async function insertSeats(
  tx: Transaction,
  licenseId: string,
  count: number,
): Promise<void> {
  if (count <= 0) return;
  // Chèn theo lô để giấy phép hàng nghìn seat không tạo câu lệnh quá lớn.
  const BATCH = 500;
  for (let done = 0; done < count; done += BATCH) {
    const n = Math.min(BATCH, count - done);
    await tx.insert(seats).values(Array.from({ length: n }, () => ({ licenseId })));
  }
}

/**
 * Xóa `count` seat TRỐNG của giấy phép, ưu tiên seat chưa từng có người giữ rồi seat đã đổi nhiều nhất
 * (giữ lại seat còn khả năng "quay lại"). Trả số seat đã xóa thật (có thể ít hơn nếu không đủ seat trống).
 */
export async function deleteFreeSeats(
  tx: Transaction,
  organizationId: string,
  licenseId: string,
  count: number,
): Promise<number> {
  if (count <= 0) return 0;
  const victims = await tx
    .select({ id: seats.id })
    .from(seats)
    .innerJoin(seatLicenses, eq(seatLicenses.id, seats.licenseId))
    .where(
      and(
        eq(seatLicenses.organizationId, organizationId),
        eq(seats.licenseId, licenseId),
        sql`${seats.holderUserId} IS NULL`,
      ),
    )
    .orderBy(sql`${seats.lastHolderUserId} IS NOT NULL`, sql`${seats.reassignmentCount} DESC`)
    .limit(count);
  if (victims.length === 0) return 0;
  await tx.delete(seats).where(
    inArray(
      seats.id,
      victims.map((v) => v.id),
    ),
  );
  return victims.length;
}

export interface SeatHolderRow extends Record<string, unknown> {
  user_id: string;
  email: string;
  /** Chuỗi ISO 8601 UTC (SQL định dạng sẵn vì `db.execute` thô không tự đổi timestamptz sang Date). */
  assigned_at: string | null;
  is_teacher: boolean;
  is_learner: boolean;
}

/** Người giữ seat của tổ chức (email, vai trò, thời điểm gán), cũ nhất trước – chi tiết quản trị viên. */
export async function listSeatHolders(
  db: DbExecutor,
  organizationId: string,
): Promise<SeatHolderRow[]> {
  const result = await db.execute<SeatHolderRow>(sql`
    SELECT s.holder_user_id AS user_id, u.email,
           to_char(s.assigned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS assigned_at,
           COALESCE(m.is_teacher, false) AS is_teacher,
           EXISTS (SELECT 1 FROM class_memberships cm
                    WHERE cm.user_id = s.holder_user_id AND cm.left_at IS NULL) AS is_learner
      FROM seats s
      JOIN seat_licenses l ON l.id = s.license_id
      JOIN users u ON u.id = s.holder_user_id
      LEFT JOIN organization_members m
             ON m.user_id = s.holder_user_id AND m.organization_id = l.organization_id
     WHERE l.organization_id = ${organizationId} AND s.holder_user_id IS NOT NULL
     ORDER BY s.assigned_at ASC NULLS LAST, s.id ASC`);
  return result.rows;
}

/**
 * Giải phóng MỌI seat đang có người giữ của tổ chức (hết hạn, vô hiệu hóa – research O3); trả id người giữ
 * trước khi giải phóng. Giữ `last_holder_user_id` để người cũ quay lại không tính một lần đổi.
 */
export async function releaseAllSeats(tx: Transaction, organizationId: string): Promise<string[]> {
  const released = await tx
    .update(seats)
    .set({ holderUserId: null, assignedAt: null })
    .where(
      and(
        sql`${seats.holderUserId} IS NOT NULL`,
        sql`${seats.licenseId} IN (SELECT id FROM seat_licenses WHERE organization_id = ${organizationId})`,
      ),
    )
    .returning({ lastHolder: seats.lastHolderUserId });
  return released.map((r) => r.lastHolder).filter((id): id is string => id !== null);
}
