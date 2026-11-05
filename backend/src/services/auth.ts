import { signAccessToken } from '../api/middleware/auth.js';
import {
  consumePasswordResetToken,
  findAuthSessionByHash,
  findUserByEmail,
  findProfileLanguage,
  findUserById,
  insertAuthSession,
  insertPasswordResetToken,
  insertProfile,
  insertUser,
  invalidateUserResetTokens,
  isUniqueViolation,
  revokeAuthSession,
  revokeUserSessions,
  rotateAuthSession,
  setPasswordHash,
  type UserRow,
} from '../db/repositories/users.js';
import type { DbExecutor } from '../db/client.js';
import { AppError, DEFAULT_LANGUAGE, type AccountStatus } from '../domain/types.js';
import { QUEUES } from '../jobs/boss.js';
import type { RegisterInput } from '../domain/profile-validation.js';
import type { SendEmailJob } from '../jobs/send-email.js';
import type { ServiceDeps } from './deps.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateOpaqueToken, sha256Hex } from './tokens.js';

// Dịch vụ xác thực (T043, R4): đăng ký, đăng nhập, làm mới token xoay vòng, đăng xuất và đặt lại
// mật khẩu. Access token JWT 15 phút; refresh token đục 30 ngày, chỉ lưu băm SHA-256.

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Thời gian chờ trước khi xóa vĩnh viễn; trong khoảng này tài khoản còn khôi phục được (FR-003). */
export const DELETION_GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Số giây hiệu lực của access token. */
  expiresIn: number;
}

export interface LoginResult extends AuthTokens {
  accountStatus: AccountStatus;
}

type TokenDeps = Pick<ServiceDeps, 'config' | 'clock'>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Tài khoản `pending_deletion` đã quá 30 ngày chờ xóa (job nền sẽ xóa cứng): coi như không còn. */
export function isDeletionGraceOver(user: UserRow, now: Date): boolean {
  return (
    user.status === 'pending_deletion' &&
    user.deletionRequestedAt !== null &&
    now.getTime() - user.deletionRequestedAt.getTime() >= DELETION_GRACE_DAYS * DAY_MS
  );
}

async function accessTokenFor(
  deps: TokenDeps,
  user: Pick<UserRow, 'id' | 'role' | 'status'>,
  sessionId: string,
): Promise<string> {
  return signAccessToken(
    deps.config,
    { userId: user.id, role: user.role, status: user.status, sessionId },
    deps.clock.now(),
  );
}

async function openSession(
  deps: TokenDeps,
  db: DbExecutor,
  user: Pick<UserRow, 'id' | 'role' | 'status'>,
  userAgent: string | null,
): Promise<AuthTokens> {
  const refreshToken = generateOpaqueToken();
  const now = deps.clock.now();
  const session = await insertAuthSession(db, {
    userId: user.id,
    refreshTokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(now.getTime() + deps.config.REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent,
  });
  return {
    accessToken: await accessTokenFor(deps, user, session.id),
    refreshToken,
    expiresIn: deps.config.ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function emailConflict(existing: UserRow): AppError {
  return existing.status === 'pending_deletion'
    ? new AppError(
        409,
        'EMAIL_PENDING_DELETION',
        'Email này thuộc tài khoản đang chờ xóa. Hãy đăng nhập để khôi phục tài khoản trong vòng 30 ngày.',
        { email: 'Email thuộc tài khoản đang chờ xóa' },
      )
    : new AppError(409, 'EMAIL_TAKEN', 'Email đã được sử dụng', {
        email: 'Email đã được sử dụng',
      });
}

/** Đăng ký (FR-001): không cần xác minh email; đăng nhập luôn sau khi tạo tài khoản. */
export async function register(
  deps: ServiceDeps,
  input: RegisterInput,
  userAgent: string | null = null,
): Promise<AuthTokens> {
  const email = normalizeEmail(input.email);
  if (input.password.toLowerCase() === email) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      password: 'Mật khẩu không được trùng với email',
    });
  }
  const existing = await findUserByEmail(deps.db, email);
  if (existing) throw emailConflict(existing);

  const passwordHash = await hashPassword(input.password);
  try {
    return await deps.db.transaction(async (tx) => {
      const user = await insertUser(tx, {
        email,
        passwordHash,
        fromTrial: input.fromTrial ?? false,
      });
      await insertProfile(tx, {
        userId: user.id,
        displayName: input.displayName,
        language: input.language ?? DEFAULT_LANGUAGE,
        timezone: input.timezone ?? DEFAULT_TIMEZONE,
      });
      return openSession(deps, tx, user, userAgent);
    });
  } catch (err) {
    // Hai yêu cầu đăng ký đồng thời cùng email: ràng buộc unique chặn yêu cầu đến sau.
    if (isUniqueViolation(err)) {
      const winner = await findUserByEmail(deps.db, email);
      if (winner) throw emailConflict(winner);
    }
    throw err;
  }
}

const INVALID_CREDENTIALS = (): AppError =>
  new AppError(401, 'UNAUTHORIZED', 'Email hoặc mật khẩu không đúng');

let dummyHash: Promise<string> | undefined;
/** Băm giả để đăng nhập email không tồn tại tốn thời gian như email có thật (chống dò tài khoản). */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  return dummyHash;
}

export async function login(
  deps: ServiceDeps,
  input: { email: string; password: string },
  userAgent: string | null = null,
): Promise<LoginResult> {
  const user = await findUserByEmail(deps.db, normalizeEmail(input.email));
  // Email không tồn tại vẫn băm một lần để thời gian phản hồi không lộ sự tồn tại của tài khoản.
  const hashToCheck = user ? user.passwordHash : await getDummyHash();
  const matches = await verifyPassword(hashToCheck, input.password);
  if (!user || !matches) throw INVALID_CREDENTIALS();

  if (user.status === 'disabled') {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');
  }
  if (isDeletionGraceOver(user, deps.clock.now())) throw INVALID_CREDENTIALS();

  const tokens = await openSession(deps, deps.db, user, userAgent);
  return { ...tokens, accountStatus: user.status };
}

/** Làm mới access token và xoay vòng refresh token (mỗi refresh token chỉ dùng được một lần). */
export async function refresh(deps: ServiceDeps, refreshToken: string): Promise<AuthTokens> {
  const now = deps.clock.now();
  const oldHash = sha256Hex(refreshToken);
  const session = await findAuthSessionByHash(deps.db, oldHash);
  if (!session) throw INVALID_CREDENTIALS();

  const user = await findUserById(deps.db, session.userId);
  if (!user) throw INVALID_CREDENTIALS();
  // Kiểm tra trước khi xét phiên đã thu hồi: admin vô hiệu hóa tài khoản đã thu hồi mọi phiên, nhưng
  // người giữ refresh token vẫn phải nhận 403 `ACCOUNT_DISABLED` (hợp đồng) chứ không phải 401 chung chung.
  if (user.status === 'disabled') {
    await revokeUserSessions(deps.db, user.id, now);
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');
  }
  if (session.revokedAt || session.expiresAt <= now) throw INVALID_CREDENTIALS();
  if (isDeletionGraceOver(user, now)) throw INVALID_CREDENTIALS();

  const nextToken = generateOpaqueToken();
  const rotated = await rotateAuthSession(deps.db, {
    oldHash,
    newHash: sha256Hex(nextToken),
    expiresAt: new Date(now.getTime() + deps.config.REFRESH_TOKEN_TTL_SECONDS * 1000),
    now,
  });
  // Một yêu cầu làm mới đồng thời khác đã dùng token này trước.
  if (!rotated) throw INVALID_CREDENTIALS();

  return {
    accessToken: await accessTokenFor(deps, user, rotated.id),
    refreshToken: nextToken,
    expiresIn: deps.config.ACCESS_TOKEN_TTL_SECONDS,
  };
}

/** Đăng xuất: thu hồi phiên sinh ra access token hiện tại. */
export async function logout(deps: ServiceDeps, sessionId: string | null): Promise<void> {
  if (sessionId) await revokeAuthSession(deps.db, sessionId, deps.clock.now());
}

/**
 * Yêu cầu liên kết đặt lại mật khẩu. Không bao giờ cho biết email có tồn tại hay không: luôn kết thúc
 * bình thường, chỉ khi có tài khoản dùng được mới tạo token và đẩy job gửi email.
 */
export async function requestPasswordReset(deps: ServiceDeps, rawEmail: string): Promise<void> {
  const user = await findUserByEmail(deps.db, normalizeEmail(rawEmail));
  if (!user || user.status === 'disabled' || isDeletionGraceOver(user, deps.clock.now())) return;

  const token = generateOpaqueToken();
  const now = deps.clock.now();
  await insertPasswordResetToken(deps.db, {
    userId: user.id,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(now.getTime() + deps.config.PASSWORD_RESET_TTL_SECONDS * 1000),
  });

  const job: SendEmailJob = {
    kind: 'password_reset',
    to: user.email,
    token,
    language: (await findProfileLanguage(deps.db, user.id)) ?? DEFAULT_LANGUAGE,
  };
  await deps.jobQueue.enqueue(QUEUES.sendEmail, job);
}

/** Đặt mật khẩu mới bằng token một lần; thu hồi mọi phiên hiện có. */
export async function confirmPasswordReset(
  deps: ServiceDeps,
  input: { token: string; newPassword: string },
): Promise<void> {
  const now = deps.clock.now();
  const passwordHash = await hashPassword(input.newPassword);
  await deps.db.transaction(async (tx) => {
    const consumed = await consumePasswordResetToken(tx, sha256Hex(input.token), now);
    if (!consumed) {
      throw new AppError(
        400,
        'RESET_TOKEN_INVALID',
        'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới.',
      );
    }
    await setPasswordHash(tx, consumed.userId, passwordHash, now);
    await invalidateUserResetTokens(tx, consumed.userId, now);
    await revokeUserSessions(tx, consumed.userId, now);
  });
}
