import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { Config } from '../../config.js';
import {
  AppError,
  type AccountStatus,
  type Role,
  ACCOUNT_STATUSES,
  ROLES,
} from '../../domain/types.js';

// Xác thực JWT (R4): access token HS256 sống 15 phút, KHÔNG tra CSDL ở mỗi request.
// Vai trò và trạng thái tài khoản nằm trong claim; khi vô hiệu hóa/xóa, token đã cấp còn hiệu lực
// tối đa 15 phút (rủi ro được chấp nhận, xem plan.md).

export interface AuthContext {
  userId: string;
  role: Role;
  status: AccountStatus;
  /** `auth_sessions.id` của phiên đăng nhập sinh ra token (claim `sid`), dùng khi đổi mật khẩu giữ phiên hiện tại. */
  sessionId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Ngữ cảnh xác thực; null nếu route không qua `authenticate`. */
    auth: AuthContext | null;
  }
}

const ISSUER = 'japanese-learning';

/** Route mà tài khoản `pending_deletion` vẫn được gọi (R4): khôi phục và đăng xuất. */
export const PENDING_DELETION_ALLOWED: ReadonlySet<string> = new Set([
  'POST /api/v1/account/restore',
  'POST /api/v1/auth/logout',
]);

const secretKey = (config: Pick<Config, 'JWT_SECRET'>): Uint8Array =>
  new TextEncoder().encode(config.JWT_SECRET);

export interface AccessTokenClaims {
  userId: string;
  role: Role;
  status: AccountStatus;
  sessionId?: string | null;
}

/** Ký access token. `now` lấy từ Clock để kiểm thử hết hạn được (+15 phút → 401). */
export async function signAccessToken(
  config: Pick<Config, 'JWT_SECRET' | 'ACCESS_TOKEN_TTL_SECONDS'>,
  claims: AccessTokenClaims,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: claims.role, status: claims.status, sid: claims.sessionId ?? null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(iat + config.ACCESS_TOKEN_TTL_SECONDS)
    .sign(secretKey(config));
}

/** Kiểm tra chữ ký/hạn của access token; trả null nếu không hợp lệ. */
export async function verifyAccessToken(
  config: Pick<Config, 'JWT_SECRET'>,
  token: string,
  now: Date = new Date(),
): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(config), {
      issuer: ISSUER,
      algorithms: ['HS256'],
      currentDate: now,
    });
    const { sub, role, status, sid } = payload as {
      sub?: string;
      role?: unknown;
      status?: unknown;
      sid?: unknown;
    };
    if (
      !sub ||
      !(ROLES as readonly unknown[]).includes(role) ||
      !(ACCOUNT_STATUSES as readonly unknown[]).includes(status)
    ) {
      return null;
    }
    return {
      userId: sub,
      role: role as Role,
      status: status as AccountStatus,
      sessionId: typeof sid === 'string' ? sid : null,
    };
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) return null;
    throw err;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export interface AuthDeps {
  config: Pick<Config, 'JWT_SECRET'>;
  now: () => Date;
}

/** preHandler xác thực: gắn `request.auth`, từ chối 401/403 theo trạng thái tài khoản. */
export function createAuthenticate(deps: AuthDeps) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const token = bearerToken(request);
    const ctx = token ? await verifyAccessToken(deps.config, token, deps.now()) : null;
    if (!ctx) throw new AppError(401, 'UNAUTHORIZED', 'Chưa xác thực hoặc token không hợp lệ');

    if (ctx.status === 'disabled') {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');
    }
    if (ctx.status === 'pending_deletion') {
      const routeKey = `${request.method} ${request.routeOptions.url}`;
      if (!PENDING_DELETION_ALLOWED.has(routeKey)) {
        throw new AppError(
          403,
          'ACCOUNT_PENDING_DELETION',
          'Tài khoản đang chờ xóa; chỉ có thể khôi phục hoặc đăng xuất',
        );
      }
    }
    request.auth = ctx;
  };
}

/** preHandler vai trò (FR-004): chạy sau `authenticate`; trả 403 nếu không đủ quyền. */
export function requireRole(role: Role) {
  return async function checkRole(request: FastifyRequest): Promise<void> {
    if (!request.auth) throw new AppError(401, 'UNAUTHORIZED', 'Chưa xác thực');
    if (request.auth.role !== role) {
      throw new AppError(403, 'FORBIDDEN', 'Không có quyền truy cập');
    }
  };
}

/** Lấy `userId` từ token – NGUỒN DUY NHẤT cho mọi truy vấn dữ liệu người học (R16). */
export function currentUserId(request: FastifyRequest): string {
  if (!request.auth) throw new AppError(401, 'UNAUTHORIZED', 'Chưa xác thực');
  return request.auth.userId;
}
