import { and, asc, desc, eq, gt, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { invitations, organizations, seatLicenses } from '../schema.js';
import type { LocalDate } from '../../domain/types.js';

// Repository tổ chức và giấy phép (spec 004, research O2, O3, data-model §3.1–§3.3).
// QUY TẮC CÔ LẬP (FR-007): mọi hàm đối tượng thuộc tổ chức nhận `organizationId` BẮT BUỘC và lọc theo nó;
// KHÔNG có hàm "tìm theo id" không lọc tổ chức (ngoại lệ duy nhất: `getOrganization` tra chính tổ chức).

export type OrganizationRow = typeof organizations.$inferSelect;
export type SeatLicenseRow = typeof seatLicenses.$inferSelect;

export async function getOrganization(
  db: DbExecutor,
  organizationId: string,
): Promise<OrganizationRow | undefined> {
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row;
}

/**
 * Khóa dòng tổ chức bằng `SELECT … FOR UPDATE` để tuần tự hóa mọi thao tác ảnh hưởng sức chứa (gửi lời mời,
 * chấp nhận, gán/thu hồi seat, chỉnh giấy phép) – research O3. PHẢI gọi trong giao dịch; trả `undefined`
 * nếu tổ chức không tồn tại.
 */
export async function lockOrganization(
  tx: Transaction,
  organizationId: string,
): Promise<OrganizationRow | undefined> {
  const [row] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for('update')
    .limit(1);
  return row;
}

/**
 * Giấy phép còn hiệu lực tại `today` (kể cả ân hạn): `revoked_at IS NULL ∧ starts_on ≤ d ∧ d ≤ ends_on +
 * grace_days`. Nếu ân hạn của giấy phép cũ chồng lên giấy phép mới thì lấy giấy phép bắt đầu muộn nhất.
 */
export async function getActiveLicense(
  db: DbExecutor,
  organizationId: string,
  today: LocalDate,
): Promise<SeatLicenseRow | undefined> {
  const [row] = await db
    .select()
    .from(seatLicenses)
    .where(
      and(
        eq(seatLicenses.organizationId, organizationId),
        sql`${seatLicenses.revokedAt} IS NULL`,
        sql`${seatLicenses.startsOn} <= ${today}::date`,
        sql`${today}::date <= ${seatLicenses.endsOn} + ${seatLicenses.graceDays}::int`,
      ),
    )
    .orderBy(desc(seatLicenses.startsOn))
    .limit(1);
  return row;
}

/**
 * Giấy phép để HIỂN THỊ (cảnh báo hết hạn): giấy phép hiệu lực nếu có; không thì giấy phép chưa thu hồi
 * kết thúc gần nhất; không thì giấy phép bất kỳ gần nhất; `undefined` khi tổ chức chưa có giấy phép nào.
 */
export async function getDisplayLicense(
  db: DbExecutor,
  organizationId: string,
  today: LocalDate,
): Promise<SeatLicenseRow | undefined> {
  const active = await getActiveLicense(db, organizationId, today);
  if (active) return active;
  const [row] = await db
    .select()
    .from(seatLicenses)
    .where(eq(seatLicenses.organizationId, organizationId))
    .orderBy(sql`${seatLicenses.revokedAt} IS NOT NULL`, desc(seatLicenses.endsOn))
    .limit(1);
  return row;
}

/** Tìm giấy phép theo id TRONG phạm vi tổ chức (không có hàm tìm theo id trần). */
export async function getLicenseInOrg(
  db: DbExecutor,
  organizationId: string,
  licenseId: string,
): Promise<SeatLicenseRow | undefined> {
  const [row] = await db
    .select()
    .from(seatLicenses)
    .where(and(eq(seatLicenses.organizationId, organizationId), eq(seatLicenses.id, licenseId)))
    .limit(1);
  return row;
}

/** Mọi giấy phép của tổ chức, mới nhất trước. */
export async function listLicenses(
  db: DbExecutor,
  organizationId: string,
): Promise<SeatLicenseRow[]> {
  return db
    .select()
    .from(seatLicenses)
    .where(eq(seatLicenses.organizationId, organizationId))
    .orderBy(desc(seatLicenses.startsOn));
}

/**
 * Số lời mời giáo viên/học viên đang chờ chưa hết hạn: giữ chỗ seat theo ĐẾM, không gắn seat cụ thể
 * (research O3). Không tính: lời mời chủ tổ chức; lời mời gửi tới người ĐÃ giữ seat của tổ chức (dùng lại
 * seat đó, không giữ chỗ thêm – FR-004); lời mời giáo viên gửi tới chủ tổ chức (chủ không chiếm seat).
 */
export async function countReservations(
  db: DbExecutor,
  organizationId: string,
  now: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        inArray(invitations.kind, ['teacher', 'student']),
        eq(invitations.status, 'pending'),
        gt(invitations.expiresAt, now),
        sql`NOT EXISTS (
          SELECT 1 FROM users u
            JOIN seats s ON s.holder_user_id = u.id
            JOIN seat_licenses l ON l.id = s.license_id
           WHERE u.email = ${invitations.email} AND l.organization_id = ${invitations.organizationId})`,
        sql`NOT (${invitations.kind} = 'teacher' AND EXISTS (
          SELECT 1 FROM users u
            JOIN organization_members m ON m.user_id = u.id
           WHERE u.email = ${invitations.email}
             AND m.organization_id = ${invitations.organizationId} AND m.is_owner))`,
      ),
    );
  return row?.n ?? 0;
}

export async function insertOrganization(
  tx: Transaction,
  values: { name: string; createdBy: string | null },
): Promise<OrganizationRow> {
  const [row] = await tx.insert(organizations).values(values).returning();
  return row!;
}

export async function updateOrganization(
  tx: Transaction,
  organizationId: string,
  patch: { name?: string; status?: 'active' | 'disabled'; disabledAt?: Date | null },
  now: Date,
): Promise<void> {
  await tx
    .update(organizations)
    .set({ ...patch, updatedAt: now })
    .where(eq(organizations.id, organizationId));
}

export interface NewLicense {
  organizationId: string;
  startsOn: string;
  endsOn: string;
  graceDays: number;
  maxReassignments: number;
  createdBy: string | null;
}

export async function insertLicense(tx: Transaction, values: NewLicense): Promise<SeatLicenseRow> {
  const [row] = await tx.insert(seatLicenses).values(values).returning();
  return row!;
}

export async function updateLicense(
  tx: Transaction,
  organizationId: string,
  licenseId: string,
  patch: Partial<
    Pick<
      SeatLicenseRow,
      'endsOn' | 'graceDays' | 'maxReassignments' | 'lapseProcessedAt' | 'revokedAt'
    >
  >,
): Promise<void> {
  await tx
    .update(seatLicenses)
    .set(patch)
    .where(and(eq(seatLicenses.organizationId, organizationId), eq(seatLicenses.id, licenseId)));
}

/**
 * Giấy phép chưa xử lý hết hạn: chưa có `lapse_processed_at` và đã bị thu hồi hoặc quá ân hạn tại `today`.
 */
export async function listUnprocessedLapsedLicenses(
  db: DbExecutor,
  organizationId: string,
  today: LocalDate,
): Promise<SeatLicenseRow[]> {
  return db
    .select()
    .from(seatLicenses)
    .where(
      and(
        eq(seatLicenses.organizationId, organizationId),
        sql`${seatLicenses.lapseProcessedAt} IS NULL`,
        sql`(${seatLicenses.revokedAt} IS NOT NULL
             OR ${today}::date > ${seatLicenses.endsOn} + ${seatLicenses.graceDays}::int)`,
      ),
    );
}

export interface OrganizationListFilter {
  q?: string | undefined;
  status?: 'active' | 'disabled' | undefined;
  page: number;
  pageSize: number;
}

/** Một trang tổ chức (tên tăng dần) kèm tổng số khớp bộ lọc; chỉ dành cho quản trị viên hệ thống. */
export async function listOrganizationsPage(
  db: DbExecutor,
  filter: OrganizationListFilter,
): Promise<{ rows: OrganizationRow[]; total: number }> {
  const conditions: SQL[] = [];
  if (filter.q) {
    // Thoát ký tự đại diện của LIKE để tìm đúng chuỗi người dùng nhập.
    conditions.push(ilike(organizations.name, `%${filter.q.replace(/[\\%_]/g, '\\$&')}%`));
  }
  if (filter.status) conditions.push(eq(organizations.status, filter.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(organizations)
      .where(where)
      .orderBy(asc(organizations.name), asc(organizations.id))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(organizations)
      .where(where),
  ]);
  return { rows, total: count?.n ?? 0 };
}
