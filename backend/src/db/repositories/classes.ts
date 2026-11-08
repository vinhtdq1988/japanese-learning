import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { classTeachers, classes } from '../schema.js';

// Repository lớp học (spec 004, data-model §3.6, §3.7). Mọi hàm nhận `organizationId` BẮT BUỘC và lọc theo
// nó: KHÔNG có hàm "tìm lớp theo id" không lọc tổ chức (FR-007, research O2). Các câu chuyện sau bổ sung
// thêm hàm (tạo, liệt kê, lưu trữ…) vào cùng file này.

export type ClassRow = typeof classes.$inferSelect;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` nếu chuỗi có dạng UUID; id sai dạng bị coi là "không tồn tại" thay vì để CSDL ném lỗi 22P02. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Lớp theo id TRONG phạm vi tổ chức; `undefined` nếu không tồn tại hoặc thuộc tổ chức khác. */
export async function getClassInOrg(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<ClassRow | undefined> {
  if (!isUuid(classId)) return undefined;
  const [row] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.organizationId, organizationId), eq(classes.id, classId)))
    .limit(1);
  return row;
}

/** `userId` có phải giáo viên phụ trách lớp (thuộc tổ chức) hay không. */
export async function isClassTeacher(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: classTeachers.userId })
    .from(classTeachers)
    .innerJoin(classes, eq(classes.id, classTeachers.classId))
    .where(
      and(
        eq(classes.organizationId, organizationId),
        eq(classTeachers.classId, classId),
        eq(classTeachers.userId, userId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export interface ClassBriefRow extends Record<string, unknown> {
  id: string;
  name: string;
  status: 'active' | 'archived';
  member_count: number;
  has_path: boolean;
  teachers: { userId: string; displayName: string }[];
}

/**
 * Lớp của tổ chức kèm số thành viên đang hoạt động, đã có lộ trình chưa và giáo viên phụ trách (tổng quan
 * chủ tổ chức, T035). `teacherless` do dịch vụ suy ra từ `teachers` rỗng của lớp `active` (FR-040).
 */
export async function listClassBriefs(
  db: DbExecutor,
  organizationId: string,
  options: { teacherUserId?: string; classId?: string } = {},
): Promise<ClassBriefRow[]> {
  const teacherFilter = options.teacherUserId
    ? sql`AND EXISTS (SELECT 1 FROM class_teachers t
                       WHERE t.class_id = c.id AND t.user_id = ${options.teacherUserId})`
    : sql``;
  const classFilter = options.classId ? sql`AND c.id = ${options.classId}` : sql``;
  const result = await db.execute<ClassBriefRow>(sql`
    SELECT c.id, c.name, c.status,
           (SELECT count(*)::int FROM class_memberships cm
             WHERE cm.class_id = c.id AND cm.left_at IS NULL) AS member_count,
           EXISTS (SELECT 1 FROM class_paths cp WHERE cp.class_id = c.id) AS has_path,
           COALESCE((
             SELECT json_agg(json_build_object(
                      'userId', ct.user_id,
                      'displayName', COALESCE(p.display_name, '')) ORDER BY ct.added_at)
               FROM class_teachers ct
               JOIN users tu ON tu.id = ct.user_id AND tu.status = 'active'
               LEFT JOIN learning_profiles p ON p.user_id = ct.user_id
              WHERE ct.class_id = c.id), '[]'::json) AS teachers
      FROM classes c
     WHERE c.organization_id = ${organizationId} ${teacherFilter} ${classFilter}
     ORDER BY c.created_at ASC, c.id ASC`);
  return result.rows;
}

/** Gỡ người dùng khỏi MỌI lớp của tổ chức (gỡ vai trò giáo viên – FR-040); trả số lớp bị gỡ. */
export async function removeTeacherFromOrgClasses(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<number> {
  const removed = await tx
    .delete(classTeachers)
    .where(
      and(
        eq(classTeachers.userId, userId),
        sql`${classTeachers.classId} IN (SELECT id FROM classes WHERE organization_id = ${organizationId})`,
      ),
    )
    .returning({ classId: classTeachers.classId });
  return removed.length;
}

/** Khóa dòng lớp (`FOR UPDATE`) trong phạm vi tổ chức; caller đã khóa tổ chức trước (thứ tự khóa cố định). */
export async function lockClassInOrg(
  tx: Transaction,
  organizationId: string,
  classId: string,
): Promise<ClassRow | undefined> {
  if (!isUuid(classId)) return undefined;
  const [row] = await tx
    .select()
    .from(classes)
    .where(and(eq(classes.organizationId, organizationId), eq(classes.id, classId)))
    .for('update')
    .limit(1);
  return row;
}

export interface NewClass {
  organizationId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
}

export async function insertClass(tx: Transaction, values: NewClass): Promise<ClassRow> {
  const [row] = await tx.insert(classes).values(values).returning();
  return row!;
}

export type ClassPatch = Partial<
  Pick<
    ClassRow,
    | 'name'
    | 'description'
    | 'absenceThresholdDays'
    | 'status'
    | 'archivedAt'
    | 'joinCode'
    | 'joinCodeEnabled'
    | 'joinCodeExpiresAt'
  >
>;

/** Cập nhật lớp thuộc tổ chức; trả dòng sau cập nhật. */
export async function updateClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  patch: ClassPatch,
  now: Date,
): Promise<ClassRow | undefined> {
  const [row] = await db
    .update(classes)
    .set({ ...patch, updatedAt: now })
    .where(and(eq(classes.organizationId, organizationId), eq(classes.id, classId)))
    .returning();
  return row;
}

/** Id giáo viên phụ trách lớp (thuộc tổ chức). */
export async function listClassTeacherIds(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: classTeachers.userId })
    .from(classTeachers)
    .innerJoin(classes, eq(classes.id, classTeachers.classId))
    .where(and(eq(classes.organizationId, organizationId), eq(classTeachers.classId, classId)));
  return rows.map((r) => r.userId);
}

/**
 * Đặt đúng tập giáo viên phụ trách (xóa người không còn, thêm người mới). Chỉ chạm lớp thuộc tổ chức; caller
 * đã kiểm lớp thuộc `organizationId`. Trả danh sách đã thêm/gỡ để ghi nhật ký.
 */
export async function replaceClassTeachers(
  tx: Transaction,
  organizationId: string,
  classId: string,
  userIds: string[],
  now: Date,
): Promise<{ added: string[]; removed: string[] }> {
  const current = await listClassTeacherIds(tx, organizationId, classId);
  const wanted = new Set(userIds);
  const removed = current.filter((id) => !wanted.has(id));
  const added = userIds.filter((id) => !current.includes(id));
  if (removed.length > 0) {
    await tx
      .delete(classTeachers)
      .where(and(eq(classTeachers.classId, classId), inArray(classTeachers.userId, removed)));
  }
  if (added.length > 0) {
    await tx
      .insert(classTeachers)
      .values(added.map((userId) => ({ classId, userId, addedAt: now })));
  }
  return { added, removed };
}

/** Thêm giáo viên phụ trách cho lớp vừa tạo. */
export async function addClassTeachers(
  tx: Transaction,
  classId: string,
  userIds: string[],
  now: Date,
): Promise<void> {
  if (userIds.length === 0) return;
  await tx
    .insert(classTeachers)
    .values(userIds.map((userId) => ({ classId, userId, addedAt: now })));
}

/** `true` nếu lớp có lộ trình (`class_paths`) – điều kiện nhận học viên (FR-010). */
export async function hasClassPath(db: DbExecutor, classId: string): Promise<boolean> {
  const result = await db.execute<{ ok: boolean }>(
    sql`SELECT EXISTS (SELECT 1 FROM class_paths WHERE class_id = ${classId}) AS ok`,
  );
  return result.rows[0]?.ok === true;
}

/**
 * Lớp theo mã tham gia – DUY NHẤT hàm tra theo mã, không lọc tổ chức vì người nhập mã chưa biết tổ chức.
 * Chỉ trả khi mã đang bật, chưa hết hạn, lớp `active`, đã có lộ trình và tổ chức `active`; mọi trường hợp
 * khác đều "không tìm thấy" để cùng một phản hồi 404 (research O4).
 */
export async function findClassByJoinCode(
  db: DbExecutor,
  code: string,
  now: Date,
): Promise<ClassRow | undefined> {
  const result = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM classes c
      JOIN organizations o ON o.id = c.organization_id
     WHERE c.join_code = ${code}
       AND c.join_code_enabled
       AND (c.join_code_expires_at IS NULL OR c.join_code_expires_at > ${now})
       AND c.status = 'active'
       AND o.status = 'active'
       AND EXISTS (SELECT 1 FROM class_paths cp WHERE cp.class_id = c.id)
     LIMIT 1`);
  const id = result.rows[0]?.id;
  if (!id) return undefined;
  const [row] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  return row;
}

export interface ClassBriefDto {
  id: string;
  name: string;
  organizationName: string;
  teachers: { displayName: string }[];
}

/** `ClassBrief` của OpenAPI (tên lớp, tổ chức, giáo viên phụ trách) cho màn hình hai lựa chọn của học viên. */
export async function getClassBrief(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<ClassBriefDto | undefined> {
  const result = await db.execute<{
    id: string;
    name: string;
    organization_name: string;
    teachers: { displayName: string }[];
  }>(sql`
    SELECT c.id, c.name, o.name AS organization_name,
           COALESCE((
             SELECT json_agg(json_build_object('displayName', COALESCE(p.display_name, ''))
                             ORDER BY ct.added_at)
               FROM class_teachers ct
               LEFT JOIN learning_profiles p ON p.user_id = ct.user_id
              WHERE ct.class_id = c.id), '[]'::json) AS teachers
      FROM classes c JOIN organizations o ON o.id = c.organization_id
     WHERE c.organization_id = ${organizationId} AND c.id = ${classId}`);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    organizationName: row.organization_name,
    teachers: row.teachers,
  };
}

export interface RosterQueryRow extends Record<string, unknown> {
  user_id: string | null;
  display_name: string;
  email: string | null;
  status: 'joined' | 'invited' | 'declined' | 'switched_personal' | 'removed' | 'other_ended';
  at: Date | string;
  invitation_id: string | null;
}

/**
 * Danh sách học viên của lớp (FR-015): thành viên đang hoạt động, thành viên đã đóng (CHỈ tên + ngày, không
 * userId/email – research O13), lời mời `pending` chưa hết hạn và `declined`.
 */
export async function listClassRoster(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  now: Date,
): Promise<RosterQueryRow[]> {
  const result = await db.execute<RosterQueryRow>(sql`
    SELECT * FROM (
      SELECT cm.user_id, COALESCE(p.display_name, u.email::text) AS display_name, u.email::text AS email,
             'joined' AS status, cm.joined_at AS at, NULL::uuid AS invitation_id
        FROM class_memberships cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN learning_profiles p ON p.user_id = cm.user_id
       WHERE cm.organization_id = ${organizationId} AND cm.class_id = ${classId}
         AND cm.left_at IS NULL
      UNION ALL
      SELECT NULL::uuid, COALESCE(cm.exit_display_name, ''), NULL::text,
             CASE cm.end_reason::text WHEN 'switched_personal' THEN 'switched_personal'
                                      WHEN 'removed' THEN 'removed' ELSE 'other_ended' END,
             cm.left_at, NULL::uuid
        FROM class_memberships cm
       WHERE cm.organization_id = ${organizationId} AND cm.class_id = ${classId}
         AND cm.left_at IS NOT NULL
      UNION ALL
      SELECT NULL::uuid, COALESCE(i.display_name_hint, i.email::text), i.email::text,
             CASE i.status::text WHEN 'pending' THEN 'invited' ELSE 'declined' END,
             COALESCE(i.responded_at, i.created_at), i.id
        FROM invitations i
       WHERE i.organization_id = ${organizationId} AND i.class_id = ${classId}
         AND i.kind = 'student'
         AND ((i.status = 'pending' AND i.expires_at > ${now}) OR i.status = 'declined')
    ) r ORDER BY r.at ASC`);
  return result.rows;
}

/** Hủy mọi lời mời học viên đang chờ của lớp (lưu trữ lớp); trả số lời mời đã hủy. */
export async function revokePendingClassInvitations(
  tx: Transaction,
  organizationId: string,
  classId: string,
  now: Date,
): Promise<number> {
  const result = await tx.execute<{ id: string }>(sql`
    UPDATE invitations SET status = 'revoked', responded_at = ${now}
     WHERE organization_id = ${organizationId} AND class_id = ${classId}
       AND kind = 'student' AND status = 'pending'
    RETURNING id`);
  return result.rows.length;
}
