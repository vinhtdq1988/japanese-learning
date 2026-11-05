import { insertAdminLog, listAdminLogs, adminLogExists } from '../db/repositories/admin-logs.js';
import {
  lockUser,
  searchUsers,
  setUserStatus,
  userExists,
} from '../db/repositories/admin-users.js';
import { revokeUserSessions } from '../db/repositories/users.js';
import { AppError } from '../domain/types.js';
import type { ServiceDeps } from './deps.js';

// Dịch vụ quản trị tài khoản và nhật ký (T107, FR-031, FR-032).

export type AdminUsersDeps = Pick<ServiceDeps, 'db' | 'clock'>;

export const ADMIN_USER_PAGE_SIZE = 25;
export const ADMIN_LOG_PAGE_SIZE = 50;

export interface AdminUserItemDto {
  id: string;
  email: string;
  displayName: string;
  role: 'learner' | 'admin';
  status: 'active' | 'disabled' | 'pending_deletion';
  createdAt: string;
}

export interface AdminUserPageDto {
  items: AdminUserItemDto[];
  nextCursor: string | null;
}

export interface AdminActionLogDto {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  diff: Record<string, unknown> | null;
  occurredAt: string;
}

const invalidCursor = (): AppError =>
  new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { cursor: 'cursor không hợp lệ' });

/** Tìm tài khoản theo email/tên, mới nhất trước; `nextCursor` là id của dòng cuối khi còn trang sau. */
export async function listAdminUsers(
  deps: Pick<AdminUsersDeps, 'db'>,
  query: { q?: string | undefined; cursor?: string | undefined },
): Promise<AdminUserPageDto> {
  if (query.cursor && !(await userExists(deps.db, query.cursor))) throw invalidCursor();
  const rows = await searchUsers(deps.db, {
    ...(query.q ? { q: query.q } : {}),
    ...(query.cursor ? { afterId: query.cursor } : {}),
    limit: ADMIN_USER_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, ADMIN_USER_PAGE_SIZE);
  return {
    items: page.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.displayName ?? '',
      role: r.role,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: rows.length > ADMIN_USER_PAGE_SIZE ? page[page.length - 1]!.id : null,
  };
}

/**
 * Vô hiệu hóa / kích hoạt lại tài khoản người học. Vô hiệu hóa thu hồi mọi `auth_sessions` trong cùng giao
 * dịch (access token đã cấp còn hiệu lực tối đa 15 phút – R4). Chỉ áp dụng cho tài khoản người học đang
 * `active`/`disabled` và không phải của chính admin; gọi lại với trạng thái hiện có là idempotent.
 * Nhật ký chỉ ghi trạng thái, không ghi email hay thông tin nhạy cảm.
 */
export async function setAdminUserStatus(
  deps: AdminUsersDeps,
  actorId: string,
  userId: string,
  status: 'active' | 'disabled',
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
    if (user.id === actorId) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        status: 'Không thể đổi trạng thái tài khoản của chính mình',
      });
    }
    if (user.role !== 'learner') {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        status: 'Chỉ đổi được trạng thái của tài khoản người học',
      });
    }
    if (user.status === 'pending_deletion') {
      throw new AppError(422, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
        status: 'Tài khoản đang chờ xóa; người học tự khôi phục hoặc chờ xóa vĩnh viễn',
      });
    }
    if (user.status === status) return;

    const now = deps.clock.now();
    await setUserStatus(tx, userId, status, now);
    if (status === 'disabled') await revokeUserSessions(tx, userId, now);
    await insertAdminLog(tx, {
      actorId,
      action: status === 'disabled' ? 'user.disable' : 'user.enable',
      targetType: 'user',
      targetId: userId,
      diff: { status: { from: user.status, to: status } },
    });
  });
}

/** Trang nhật ký hành động quản trị, mới nhất trước. */
export async function listAdminActionLogs(
  deps: Pick<AdminUsersDeps, 'db'>,
  query: { cursor?: string | undefined },
): Promise<{ items: AdminActionLogDto[]; nextCursor: string | null }> {
  if (query.cursor && !(await adminLogExists(deps.db, query.cursor))) throw invalidCursor();
  const rows = await listAdminLogs(deps.db, {
    ...(query.cursor ? { afterId: query.cursor } : {}),
    limit: ADMIN_LOG_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, ADMIN_LOG_PAGE_SIZE);
  return {
    items: page.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      diff: r.diff,
      occurredAt: r.occurredAt.toISOString(),
    })),
    nextCursor: rows.length > ADMIN_LOG_PAGE_SIZE ? page[page.length - 1]!.id : null,
  };
}
