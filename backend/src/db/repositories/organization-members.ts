import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { organizationMembers } from '../schema.js';

// Repository vai trò tổ chức (spec 004, data-model §3.2). Khóa chính `user_id` ⇒ một tài khoản tối đa một
// tổ chức. Mọi hàm đối tượng nhận `organizationId` bắt buộc; `findOrgMemberOfUser` tra theo tài khoản (email
// của lời mời → tài khoản) để biết tài khoản đã thuộc tổ chức NÀO, phục vụ `INVITEE_UNAVAILABLE`.

export type OrgMemberRow = typeof organizationMembers.$inferSelect;

/** Dòng thành viên của tài khoản ở BẤT KỲ tổ chức nào; `undefined` nếu chưa thuộc tổ chức nào. */
export async function findOrgMemberOfUser(
  db: DbExecutor,
  userId: string,
): Promise<OrgMemberRow | undefined> {
  const [row] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return row;
}

/** Dòng thành viên của tài khoản TRONG tổ chức; `undefined` nếu không thuộc tổ chức đó. */
export async function getOrgMember(
  db: DbExecutor,
  organizationId: string,
  userId: string,
): Promise<OrgMemberRow | undefined> {
  const [row] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Thêm vai trò cho tài khoản trong tổ chức: tạo dòng nếu chưa có, ngược lại CHỈ bật thêm cờ (không bao giờ
 * tắt cờ đang có). Caller PHẢI đã kiểm tài khoản không thuộc tổ chức khác.
 */
export async function grantOrgRole(
  tx: Transaction,
  organizationId: string,
  userId: string,
  roles: { owner?: boolean; teacher?: boolean },
  now: Date,
): Promise<void> {
  await tx
    .insert(organizationMembers)
    .values({
      userId,
      organizationId,
      isOwner: roles.owner ?? false,
      isTeacher: roles.teacher ?? false,
      joinedAt: now,
    })
    .onConflictDoUpdate({
      target: organizationMembers.userId,
      set: {
        ...(roles.owner ? { isOwner: true } : {}),
        ...(roles.teacher ? { isTeacher: true } : {}),
      },
      setWhere: eq(organizationMembers.organizationId, organizationId),
    });
}

/** Tắt cờ giáo viên của tài khoản trong tổ chức; `true` nếu cờ đang bật và đã được tắt. */
export async function clearTeacherRole(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const updated = await tx
    .update(organizationMembers)
    .set({ isTeacher: false })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.isTeacher, true),
      ),
    )
    .returning({ userId: organizationMembers.userId });
  return updated.length > 0;
}

/**
 * Xóa dòng thành viên không còn lý do tồn tại của MỌI tài khoản trong tổ chức (không phải chủ, không phải
 * giáo viên, không còn thành viên lớp đang hoạt động). Dùng sau khi xử lý hết hạn/vô hiệu hóa.
 */
export async function deleteUnusedOrgMembers(
  tx: Transaction,
  organizationId: string,
): Promise<number> {
  const deleted = await tx
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.isOwner, false),
        eq(organizationMembers.isTeacher, false),
        sql`NOT EXISTS (
          SELECT 1 FROM class_memberships cm
           WHERE cm.user_id = ${organizationMembers.userId} AND cm.left_at IS NULL)`,
      ),
    )
    .returning({ userId: organizationMembers.userId });
  return deleted.length;
}

export interface OrgStaffRow extends Record<string, unknown> {
  user_id: string;
  email: string;
  display_name: string | null;
  is_owner: boolean;
  is_teacher: boolean;
  joined_at: Date;
  has_seat: boolean;
  class_ids: string[] | null;
}

/**
 * Chủ tổ chức và giáo viên của tổ chức (email, tên, có đang giữ seat không, các lớp phụ trách), thứ tự vào
 * tổ chức tăng dần – cũng là thứ tự cấp lại seat khi có giấy phép mới (T034). Tài khoản đang chờ xóa hoặc bị
 * vô hiệu hóa không được liệt kê (FR-040, research O15).
 */
export async function listOrgStaff(db: DbExecutor, organizationId: string): Promise<OrgStaffRow[]> {
  const result = await db.execute<OrgStaffRow>(sql`
    SELECT m.user_id, u.email, p.display_name, m.is_owner, m.is_teacher, m.joined_at,
           EXISTS (
             SELECT 1 FROM seats s JOIN seat_licenses l ON l.id = s.license_id
              WHERE s.holder_user_id = m.user_id AND l.organization_id = m.organization_id
           ) AS has_seat,
           (SELECT array_agg(ct.class_id ORDER BY ct.added_at)
              FROM class_teachers ct JOIN classes c ON c.id = ct.class_id
             WHERE ct.user_id = m.user_id AND c.organization_id = m.organization_id) AS class_ids
      FROM organization_members m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN learning_profiles p ON p.user_id = m.user_id
     WHERE m.organization_id = ${organizationId} AND (m.is_owner OR m.is_teacher)
       AND u.status = 'active'
     ORDER BY m.joined_at ASC, m.user_id ASC`);
  return result.rows;
}

/** Giáo viên (không phải chủ, tài khoản `active`) chưa giữ seat, theo thứ tự vào tổ chức – để cấp lại khi có giấy phép mới. */
export async function listTeachersWithoutSeat(
  db: DbExecutor,
  organizationId: string,
): Promise<string[]> {
  const result = await db.execute<{ user_id: string }>(sql`
    SELECT m.user_id
      FROM organization_members m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ${organizationId} AND m.is_teacher AND NOT m.is_owner
       AND u.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM seats s JOIN seat_licenses l ON l.id = s.license_id
          WHERE s.holder_user_id = m.user_id AND l.organization_id = m.organization_id)
     ORDER BY m.joined_at ASC, m.user_id ASC`);
  return result.rows.map((r) => r.user_id);
}

/**
 * Chủ tổ chức đang hoạt động (cảnh báo `noOwner` là dẫn xuất) và email của họ. Tài khoản đang chờ xóa hoặc bị
 * vô hiệu hóa không được tính, kể cả khi dòng `organization_members` chưa bị xóa cứng (FR-040, research O15).
 */
export async function listOwnerEmails(db: DbExecutor, organizationId: string): Promise<string[]> {
  const result = await db.execute<{ email: string }>(sql`
    SELECT u.email
      FROM organization_members m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ${organizationId} AND m.is_owner AND u.status = 'active'
     ORDER BY m.joined_at ASC`);
  return result.rows.map((r) => r.email);
}

/** Số lớp của tổ chức (kể cả đã lưu trữ). */
export async function countOrgClasses(db: DbExecutor, organizationId: string): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM classes WHERE organization_id = ${organizationId}`,
  );
  return result.rows[0]?.n ?? 0;
}
