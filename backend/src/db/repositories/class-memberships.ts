import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { classMemberships, classes, organizationMembers } from '../schema.js';
import type { MembershipEndReason } from '../../domain/org-types.js';

// Repository thành viên lớp (spec 004, research O1, O6, data-model §3.2, §3.11).
// Mọi hàm đối tượng thuộc tổ chức nhận `organizationId` bắt buộc và lọc theo nó (FR-007). Ngoại lệ duy nhất
// là `findActiveMembershipByUser`: tra theo CHÍNH người dùng đang gọi (nguồn `userId` là token), dùng cho
// `resolveLearningContext` và khóa `CLASS_MANAGED`, không nhận id đối tượng từ bên ngoài.

export type ClassMembershipRow = typeof classMemberships.$inferSelect;

/** Thành viên lớp đang hoạt động (`left_at IS NULL`) của một người dùng; `undefined` nếu không thuộc lớp. */
export async function findActiveMembershipByUser(
  db: DbExecutor,
  userId: string,
): Promise<ClassMembershipRow | undefined> {
  const [row] = await db
    .select()
    .from(classMemberships)
    .where(and(eq(classMemberships.userId, userId), isNull(classMemberships.leftAt)))
    .limit(1);
  return row;
}

export interface OpenMembershipInput {
  classId: string;
  userId: string;
  organizationId: string;
  seatId: string | null;
  consentVersion: number;
  /** Thời điểm vào lớp, đồng thời là thời điểm xác nhận thông báo (`consent_at`). */
  now: Date;
}

export type OpenMembershipResult =
  | { ok: true; membership: ClassMembershipRow }
  /** Tài khoản đã thuộc tổ chức KHÁC (khóa chính `organization_members.user_id`) ⇒ `INVITEE_UNAVAILABLE`. */
  | { ok: false; reason: 'other_organization' };

/**
 * Mở một giai đoạn thành viên lớp. Cùng giao dịch TẠO dòng `organization_members` (cờ vai trò false) nếu
 * tài khoản chưa có dòng – chỗ ràng buộc "một tài khoản một tổ chức" áp cho học viên (data-model §3.2).
 * Vi phạm "một lớp đang hoạt động" do UNIQUE một phần của CSDL chặn (ném lỗi 23505).
 */
export async function openMembership(
  tx: Transaction,
  input: OpenMembershipInput,
): Promise<OpenMembershipResult> {
  const [member] = await tx
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, input.userId))
    .limit(1);
  if (member && member.organizationId !== input.organizationId) {
    return { ok: false, reason: 'other_organization' };
  }
  if (!member) {
    await tx.insert(organizationMembers).values({
      userId: input.userId,
      organizationId: input.organizationId,
      joinedAt: input.now,
    });
  }
  const [membership] = await tx
    .insert(classMemberships)
    .values({
      classId: input.classId,
      userId: input.userId,
      organizationId: input.organizationId,
      joinedAt: input.now,
      consentAt: input.now,
      consentVersion: input.consentVersion,
      seatId: input.seatId,
    })
    .returning();
  return { ok: true, membership: membership! };
}

/** Thông tin cần giữ lại sau khi đóng thành viên: `seatId` TRƯỚC khi bị đặt NULL để caller giải phóng seat. */
export interface ClosedMembership {
  membershipId: string;
  classId: string;
  userId: string;
  seatId: string | null;
}

/**
 * Đóng một thành viên lớp đang hoạt động: đặt `left_at`, `end_reason`, `exit_display_name` và
 * `seat_id := NULL` trên dòng thành viên. KHÔNG tự giải phóng dòng `seats` và KHÔNG xóa
 * `organization_members` – việc đó do `endMembership` (T053) quyết định theo vai trò còn lại.
 * Trả `undefined` nếu thành viên không tồn tại trong tổ chức hoặc đã đóng.
 */
export async function closeMembership(
  tx: Transaction,
  organizationId: string,
  membershipId: string,
  reason: MembershipEndReason,
  exitDisplayName: string | null,
  now: Date,
): Promise<ClosedMembership | undefined> {
  const [current] = await tx
    .select()
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.id, membershipId),
        eq(classMemberships.organizationId, organizationId),
        isNull(classMemberships.leftAt),
      ),
    )
    .for('update')
    .limit(1);
  if (!current) return undefined;
  await tx
    .update(classMemberships)
    .set({ leftAt: now, endReason: reason, exitDisplayName, seatId: null })
    .where(eq(classMemberships.id, current.id));
  return {
    membershipId: current.id,
    classId: current.classId,
    userId: current.userId,
    seatId: current.seatId,
  };
}

/**
 * Đóng MỌI thành viên đang hoạt động của tổ chức (hết hạn, vô hiệu hóa, thu hồi giấy phép – research O3).
 * Tên lúc rời lấy từ `learning_profiles.display_name`. Trả danh sách để caller giải phóng seat.
 */
export async function closeAllActiveForOrg(
  tx: Transaction,
  organizationId: string,
  reason: MembershipEndReason,
  now: Date,
): Promise<ClosedMembership[]> {
  const active = await tx
    .select()
    .from(classMemberships)
    .where(
      and(eq(classMemberships.organizationId, organizationId), isNull(classMemberships.leftAt)),
    )
    .for('update');
  if (active.length === 0) return [];
  await tx
    .update(classMemberships)
    .set({
      leftAt: now,
      endReason: reason,
      seatId: null,
      exitDisplayName: sql`(SELECT display_name FROM learning_profiles WHERE user_id = ${classMemberships.userId})`,
    })
    .where(
      and(eq(classMemberships.organizationId, organizationId), isNull(classMemberships.leftAt)),
    );
  return active.map((m) => ({
    membershipId: m.id,
    classId: m.classId,
    userId: m.userId,
    seatId: m.seatId,
  }));
}

/** Thành viên của một lớp thuộc tổ chức; mặc định chỉ đang hoạt động, `includeEnded` lấy cả đã đóng. */
export async function listMembershipsByClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  options: { includeEnded?: boolean } = {},
): Promise<ClassMembershipRow[]> {
  const where = and(
    eq(classMemberships.organizationId, organizationId),
    eq(classMemberships.classId, classId),
    options.includeEnded ? undefined : isNull(classMemberships.leftAt),
  );
  return db
    .select()
    .from(classMemberships)
    .where(where)
    .orderBy(asc(classMemberships.joinedAt), asc(classMemberships.id));
}

/** Số thành viên đang hoạt động của lớp (kiểm `CLASS_MAX_MEMBERS`). */
export async function countActiveMembers(
  db: DbExecutor,
  organizationId: string,
  classId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.organizationId, organizationId),
        eq(classMemberships.classId, classId),
        isNull(classMemberships.leftAt),
      ),
    );
  return row?.n ?? 0;
}

/** Thành viên đang hoạt động của một lớp cụ thể (tra theo học viên) – dùng cho gỡ/chuyển lớp, chi tiết. */
export async function findActiveMembershipInClass(
  db: DbExecutor,
  organizationId: string,
  classId: string,
  userId: string,
): Promise<ClassMembershipRow | undefined> {
  const [row] = await db
    .select()
    .from(classMemberships)
    .innerJoin(classes, eq(classes.id, classMemberships.classId))
    .where(
      and(
        eq(classMemberships.organizationId, organizationId),
        eq(classMemberships.classId, classId),
        eq(classMemberships.userId, userId),
        isNull(classMemberships.leftAt),
      ),
    )
    .limit(1);
  return row?.class_memberships;
}

/**
 * Xóa dòng `organization_members` của tài khoản khi không còn vai trò (`NOT is_owner AND NOT is_teacher`)
 * và không còn thành viên lớp đang hoạt động (research O1). Trả `true` nếu đã xóa.
 */
export async function removeOrgMemberIfUnused(
  tx: Transaction,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.isOwner, false),
        eq(organizationMembers.isTeacher, false),
        sql`NOT EXISTS (
          SELECT 1 FROM class_memberships
           WHERE user_id = ${userId} AND left_at IS NULL)`,
      ),
    )
    .returning({ userId: organizationMembers.userId });
  return deleted.length > 0;
}
