import type { DbExecutor } from '../db/client.js';
import {
  findUserByEmail,
  findUserById,
  invalidateUserResetTokens,
  isUniqueViolation,
  markPendingDeletion,
  restoreFromPendingDeletion,
  revokeUserSessions,
  setEmail,
  setPasswordHash,
  type UserRow,
} from '../db/repositories/users.js';
import type { PasswordChangeInput } from '../domain/profile-validation.js';
import { AppError } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';
import { DELETION_GRACE_DAYS, emailConflict, isDeletionGraceOver, normalizeEmail } from './auth.js';
import { hashPassword, verifyPassword } from './password.js';

// Dịch vụ tài khoản (T111, FR-002, FR-003): đổi email, đổi mật khẩu, xóa và khôi phục tài khoản.
// Sửa phần hồ sơ còn lại (tên, ngôn ngữ, múi giờ, mục tiêu…) do `profile.ts` (`PATCH /me`) đảm nhận.

const DAY_MS = 86_400_000;

const WRONG_PASSWORD = (): AppError =>
  new AppError(401, 'UNAUTHORIZED', 'Mật khẩu hiện tại không đúng');

async function requireUser(db: DbExecutor, userId: string): Promise<UserRow> {
  const user = await findUserById(db, userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
  return user;
}

/** Xác nhận mật khẩu hiện tại; thiếu hoặc sai → 401 (hành động nhạy cảm cần người dùng nhập lại mật khẩu). */
async function requirePassword(user: UserRow, password: string | undefined): Promise<void> {
  if (!password || !(await verifyPassword(user.passwordHash, password))) throw WRONG_PASSWORD();
}

export interface EmailChange {
  /** Email đã chuẩn hóa sẽ lưu. */
  email: string;
}

/**
 * Kiểm tra yêu cầu đổi email của `PATCH /me`: bắt buộc `currentPassword` đúng, email mới không trùng
 * tài khoản khác (409 `EMAIL_TAKEN`) hay tài khoản đang chờ xóa (409 `EMAIL_PENDING_DELETION`).
 * Trả `null` nếu email mới giống email hiện tại (không có gì để đổi).
 */
export async function prepareEmailChange(
  db: DbExecutor,
  userId: string,
  rawEmail: string,
  currentPassword: string | undefined,
): Promise<EmailChange | null> {
  const user = await requireUser(db, userId);
  await requirePassword(user, currentPassword);

  const email = normalizeEmail(rawEmail);
  if (email === user.email.toLowerCase()) return null;

  const existing = await findUserByEmail(db, email);
  if (existing && existing.id !== userId) throw emailConflict(existing);
  return { email };
}

/** Lưu email đã qua `prepareEmailChange`; chạy trong cùng giao dịch với phần sửa hồ sơ còn lại. */
export async function applyEmailChange(
  db: DbExecutor,
  userId: string,
  change: EmailChange,
  now: Date,
): Promise<void> {
  try {
    await setEmail(db, userId, change.email, now);
  } catch (err) {
    // Một yêu cầu đồng thời vừa chiếm email này giữa lúc kiểm tra và lúc lưu.
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email đã được sử dụng', {
        email: 'Email đã được sử dụng',
      });
    }
    throw err;
  }
}

/**
 * `PUT /me/password`: đổi mật khẩu khi biết mật khẩu hiện tại; thu hồi mọi phiên KHÁC, giữ phiên hiện
 * tại (`sessionId` lấy từ token), và vô hiệu hóa các liên kết đặt lại còn hiệu lực.
 */
export async function changePassword(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
  sessionId: string | null,
  input: PasswordChangeInput,
): Promise<void> {
  const user = await requireUser(deps.db, userId);
  await requirePassword(user, input.currentPassword);
  if (input.newPassword.toLowerCase() === user.email.toLowerCase()) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      newPassword: 'Mật khẩu không được trùng với email',
    });
  }

  const now = deps.clock.now();
  const passwordHash = await hashPassword(input.newPassword);
  await deps.db.transaction(async (tx) => {
    await setPasswordHash(tx, userId, passwordHash, now);
    await invalidateUserResetTokens(tx, userId, now);
    await revokeUserSessions(tx, userId, now, sessionId);
  });
}

export function permanentDeletionAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY_MS);
}

/**
 * `POST /account/delete`: cần mật khẩu; chuyển `pending_deletion` ngay và thu hồi MỌI phiên (kể cả phiên
 * hiện tại, client phải xóa token cục bộ). Access token đã cấp cho cửa sổ khác còn hiệu lực tới khi hết
 * hạn (tối đa 15 phút, FR-003). Dữ liệu chỉ bị xóa cứng sau 30 ngày bởi job nền (T112).
 */
export async function deleteAccount(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
  password: string,
): Promise<{ permanentDeletionAt: string }> {
  const user = await requireUser(deps.db, userId);
  if (user.status === 'disabled') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');
  }
  await requirePassword(user, password);

  // Đã chờ xóa từ trước (hai yêu cầu đồng thời): giữ nguyên mốc cũ.
  if (user.status === 'pending_deletion' && user.deletionRequestedAt) {
    return { permanentDeletionAt: permanentDeletionAt(user.deletionRequestedAt).toISOString() };
  }

  const now = deps.clock.now();
  await deps.db.transaction(async (tx) => {
    await markPendingDeletion(tx, userId, now);
    await revokeUserSessions(tx, userId, now);
  });
  return { permanentDeletionAt: permanentDeletionAt(now).toISOString() };
}

/**
 * `POST /account/restore`: khôi phục tài khoản trong 30 ngày chờ xóa, giữ nguyên toàn bộ dữ liệu học.
 * Quá hạn (hoặc dữ liệu đã bị job xóa) → 410 `ACCOUNT_DELETED`. Gọi lại khi đã khôi phục thì không đổi gì.
 * Access token hiện tại vẫn mang `status='pending_deletion'`, nên client PHẢI làm mới token sau đó.
 */
export async function restoreAccount(
  deps: Pick<ServiceDeps, 'db' | 'clock'>,
  userId: string,
): Promise<void> {
  const gone = (): AppError =>
    new AppError(410, 'ACCOUNT_DELETED', 'Đã quá 30 ngày chờ xóa, dữ liệu tài khoản đã bị xóa');
  const user = await findUserById(deps.db, userId);
  if (!user) throw gone();
  if (user.status === 'disabled') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');
  }
  const now = deps.clock.now();
  if (isDeletionGraceOver(user, now)) throw gone();
  if (user.status === 'pending_deletion') await restoreFromPendingDeletion(deps.db, userId, now);
}
