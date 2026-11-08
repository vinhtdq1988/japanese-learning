import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { DbExecutor, Transaction } from '../client.js';
import { invitations } from '../schema.js';
import { generateOpaqueToken, sha256Hex } from '../../services/tokens.js';

// Repository lời mời (spec 004, data-model §3.5, research O3, O4). QUY TẮC CÔ LẬP (FR-007): mọi hàm nhận
// `organizationId` bắt buộc và lọc theo nó, TRỪ `findByTokenHash`: người nhận chưa thuộc tổ chức nào nên
// token là thứ duy nhất họ có; dịch vụ PHẢI kiểm email người gọi khớp rồi mới trả bất cứ thông tin nào.

export type InvitationRow = typeof invitations.$inferSelect;
export type InvitationKind = InvitationRow['kind'];
export type InvitationStatus = InvitationRow['status'];

/** Token thô 32 byte base64url (chỉ nằm trong email) và băm SHA-256 lưu CSDL. */
export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = generateOpaqueToken();
  return { token, tokenHash: sha256Hex(token) };
}

export async function findByTokenHash(
  db: DbExecutor,
  tokenHash: string,
): Promise<InvitationRow | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function findInvitationInOrg(
  db: DbExecutor,
  organizationId: string,
  invitationId: string,
): Promise<InvitationRow | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), eq(invitations.id, invitationId)))
    .limit(1);
  return row;
}

/** Khóa dòng lời mời khi trả lời/thu hồi để hai yêu cầu song song không cùng chấp nhận một lời mời. */
export async function lockInvitation(
  tx: Transaction,
  organizationId: string,
  invitationId: string,
): Promise<InvitationRow | undefined> {
  const [row] = await tx
    .select()
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), eq(invitations.id, invitationId)))
    .for('update')
    .limit(1);
  return row;
}

/**
 * Chuyển `expired` mọi lời mời `pending` đã quá hạn của (tổ chức, email) TRƯỚC khi chèn lời mời mới cùng
 * email, để ràng buộc "một lời mời chờ cho mỗi (tổ chức, email)" không chặn nhầm (data-model §3.5).
 */
export async function expireStaleForEmail(
  tx: Transaction,
  organizationId: string,
  email: string,
  now: Date,
): Promise<void> {
  await tx
    .update(invitations)
    .set({ status: 'expired' })
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email),
        eq(invitations.status, 'pending'),
        lte(invitations.expiresAt, now),
      ),
    );
}

/** Lời mời `pending` (chưa hết hạn) của (tổ chức, email), nếu có. */
export async function findPendingForEmail(
  db: DbExecutor,
  organizationId: string,
  email: string,
  now: Date,
): Promise<InvitationRow | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email),
        eq(invitations.status, 'pending'),
        sql`${invitations.expiresAt} > ${now}`,
      ),
    )
    .limit(1);
  return row;
}

export interface NewInvitation {
  organizationId: string;
  classId?: string | null;
  kind: InvitationKind;
  email: string;
  displayNameHint?: string | null;
  tokenHash: string;
  expiresAt: Date;
  invitedBy: string | null;
}

export async function insertInvitation(
  tx: Transaction,
  values: NewInvitation,
): Promise<InvitationRow> {
  const [row] = await tx
    .insert(invitations)
    .values({
      organizationId: values.organizationId,
      classId: values.classId ?? null,
      kind: values.kind,
      email: values.email,
      displayNameHint: values.displayNameHint ?? null,
      tokenHash: values.tokenHash,
      expiresAt: values.expiresAt,
      invitedBy: values.invitedBy,
    })
    .returning();
  return row!;
}

/** Đặt trạng thái cuối của lời mời `pending` (accepted/declined/revoked); `false` nếu không còn `pending`. */
export async function closeInvitation(
  tx: Transaction,
  organizationId: string,
  invitationId: string,
  status: Exclude<InvitationStatus, 'pending' | 'expired'>,
  now: Date,
  acceptedBy: string | null = null,
): Promise<boolean> {
  const updated = await tx
    .update(invitations)
    .set({ status, respondedAt: now, acceptedBy: status === 'accepted' ? acceptedBy : null })
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.id, invitationId),
        eq(invitations.status, 'pending'),
      ),
    )
    .returning({ id: invitations.id });
  return updated.length > 0;
}

/** Lời mời `pending` chưa hết hạn của tổ chức theo loại, cũ nhất trước (tổng quan chủ tổ chức/quản trị viên). */
export async function listPendingByOrg(
  db: DbExecutor,
  organizationId: string,
  now: Date,
  kinds: readonly InvitationKind[],
): Promise<InvitationRow[]> {
  return db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, 'pending'),
        inArray(invitations.kind, [...kinds]),
        sql`${invitations.expiresAt} > ${now}`,
      ),
    )
    .orderBy(asc(invitations.createdAt), desc(invitations.id));
}

/**
 * Hủy mọi lời mời giáo viên/học viên đang chờ của tổ chức (hết hạn giấy phép, vô hiệu hóa – research O3).
 * Lời mời chủ tổ chức được giữ: chủ phải nhận quyền để còn gia hạn. Trả số lời mời đã hủy.
 */
export async function revokePendingSeatInvitations(
  tx: Transaction,
  organizationId: string,
  now: Date,
): Promise<number> {
  const updated = await tx
    .update(invitations)
    .set({ status: 'revoked', respondedAt: now })
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, 'pending'),
        inArray(invitations.kind, ['teacher', 'student']),
      ),
    )
    .returning({ id: invitations.id });
  return updated.length;
}

/** Việc dọn nền: chuyển `expired` mọi lời mời `pending` quá hạn (mọi tổ chức, chỉ dùng cho job). */
export async function expireOverdueInvitations(db: DbExecutor, now: Date): Promise<number> {
  const updated = await db
    .update(invitations)
    .set({ status: 'expired' })
    .where(and(eq(invitations.status, 'pending'), lte(invitations.expiresAt, now)))
    .returning({ id: invitations.id });
  return updated.length;
}
