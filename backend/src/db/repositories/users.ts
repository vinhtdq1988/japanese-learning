import { and, eq, gt, isNull, lte, ne } from 'drizzle-orm';
import type { DbExecutor } from '../client.js';
import { authSessions, learningProfiles, passwordResetTokens, users } from '../schema.js';
import type { Language } from '../../domain/types.js';

// Repository người dùng, phiên đăng nhập (refresh token) và token đặt lại mật khẩu (T042).
// Mọi hàm nhận `DbExecutor` để chạy được cả trong giao dịch.

export type UserRow = typeof users.$inferSelect;
export type AuthSessionRow = typeof authSessions.$inferSelect;

/** Lỗi vi phạm ràng buộc unique của PostgreSQL (Drizzle bọc lỗi gốc trong `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown): unknown => (e as { code?: unknown } | null | undefined)?.code;
  return code(err) === '23505' || code((err as { cause?: unknown } | null)?.cause) === '23505';
}

export async function findUserByEmail(db: DbExecutor, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

export async function findUserById(db: DbExecutor, id: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  fromTrial: boolean;
}

export async function insertUser(db: DbExecutor, values: NewUser): Promise<UserRow> {
  const [row] = await db.insert(users).values(values).returning();
  return row!;
}

export interface NewProfile {
  userId: string;
  displayName: string;
  language: Language;
  timezone: string;
}

export async function insertProfile(db: DbExecutor, values: NewProfile): Promise<void> {
  await db.insert(learningProfiles).values(values);
}

export async function findProfileLanguage(
  db: DbExecutor,
  userId: string,
): Promise<Language | undefined> {
  const [row] = await db
    .select({ language: learningProfiles.language })
    .from(learningProfiles)
    .where(eq(learningProfiles.userId, userId))
    .limit(1);
  return row?.language;
}

export async function setPasswordHash(
  db: DbExecutor,
  userId: string,
  passwordHash: string,
  now: Date,
): Promise<void> {
  await db.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, userId));
}

export async function setEmail(
  db: DbExecutor,
  userId: string,
  email: string,
  now: Date,
): Promise<void> {
  await db.update(users).set({ email, updatedAt: now }).where(eq(users.id, userId));
}

// --- Xóa / khôi phục tài khoản (FR-003) ---

/** Đặt tài khoản `active` sang `pending_deletion`; trả false nếu tài khoản không còn ở trạng thái `active`. */
export async function markPendingDeletion(
  db: DbExecutor,
  userId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ status: 'pending_deletion', deletionRequestedAt: now, updatedAt: now })
    .where(and(eq(users.id, userId), eq(users.status, 'active')))
    .returning({ id: users.id });
  return rows.length > 0;
}

/** Đưa tài khoản `pending_deletion` về `active`, xóa mốc yêu cầu xóa. */
export async function restoreFromPendingDeletion(
  db: DbExecutor,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(users)
    .set({ status: 'active', deletionRequestedAt: null, updatedAt: now })
    .where(and(eq(users.id, userId), eq(users.status, 'pending_deletion')));
}

/**
 * Xóa cứng mọi tài khoản `pending_deletion` có `deletion_requested_at <= cutoff`. Mọi bảng dữ liệu cá
 * nhân tham chiếu `users` bằng `ON DELETE CASCADE` nên bị xóa theo (data-model §4). Trả số tài khoản đã xóa.
 */
export async function deleteExpiredPendingUsers(db: DbExecutor, cutoff: Date): Promise<number> {
  const rows = await db
    .delete(users)
    .where(and(eq(users.status, 'pending_deletion'), lte(users.deletionRequestedAt, cutoff)))
    .returning({ id: users.id });
  return rows.length;
}

// --- Phiên đăng nhập ---

export interface NewAuthSession {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
}

export async function insertAuthSession(
  db: DbExecutor,
  values: NewAuthSession,
): Promise<AuthSessionRow> {
  const [row] = await db.insert(authSessions).values(values).returning();
  return row!;
}

export async function findAuthSessionByHash(
  db: DbExecutor,
  refreshTokenHash: string,
): Promise<AuthSessionRow | undefined> {
  const [row] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.refreshTokenHash, refreshTokenHash))
    .limit(1);
  return row;
}

/**
 * Xoay vòng refresh token tại chỗ: chỉ thành công nếu băm cũ còn khớp, chưa thu hồi và chưa hết hạn.
 * Hai yêu cầu làm mới đồng thời với cùng token chỉ một yêu cầu thắng (yêu cầu kia nhận `undefined`).
 */
export async function rotateAuthSession(
  db: DbExecutor,
  args: { oldHash: string; newHash: string; expiresAt: Date; now: Date },
): Promise<AuthSessionRow | undefined> {
  const [row] = await db
    .update(authSessions)
    .set({ refreshTokenHash: args.newHash, expiresAt: args.expiresAt })
    .where(
      and(
        eq(authSessions.refreshTokenHash, args.oldHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, args.now),
      ),
    )
    .returning();
  return row;
}

export async function revokeAuthSession(
  db: DbExecutor,
  sessionId: string,
  now: Date,
): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: now })
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

/** Thu hồi mọi phiên của người dùng (trừ `exceptSessionId` nếu có). */
export async function revokeUserSessions(
  db: DbExecutor,
  userId: string,
  now: Date,
  exceptSessionId?: string | null,
): Promise<void> {
  const conditions = [eq(authSessions.userId, userId), isNull(authSessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(authSessions.id, exceptSessionId));
  await db
    .update(authSessions)
    .set({ revokedAt: now })
    .where(and(...conditions));
}

// --- Token đặt lại mật khẩu ---

export async function insertPasswordResetToken(
  db: DbExecutor,
  values: { userId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.insert(passwordResetTokens).values(values);
}

/**
 * Tiêu thụ token đặt lại: chỉ thành công nếu chưa dùng và chưa hết hạn (dùng một lần).
 * Trả `userId` của token, hoặc `undefined` nếu token sai/đã dùng/hết hạn.
 */
export async function consumePasswordResetToken(
  db: DbExecutor,
  tokenHash: string,
  now: Date,
): Promise<{ userId: string } | undefined> {
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });
  return row;
}

/** Vô hiệu hóa mọi token đặt lại còn hiệu lực của người dùng (sau khi đổi mật khẩu). */
export async function invalidateUserResetTokens(
  db: DbExecutor,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
}
