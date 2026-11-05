import type { FastifyInstance } from 'fastify';
import {
  adminLogListQuerySchema,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  adminUserStatusSchema,
} from '../../domain/admin-validation.js';
import {
  listAdminActionLogs,
  listAdminUsers,
  setAdminUserStatus,
} from '../../services/admin-users.js';
import { parseInput } from '../errors.js';
import { currentUserId } from '../middleware/auth.js';
import type { AdminGuard } from './guard.js';

// Route quản trị người dùng và nhật ký hành động (T107, FR-031, FR-032).

export function registerAdminUserRoutes(api: FastifyInstance, guard: AdminGuard): void {
  const deps = api.deps;

  api.get('/admin/users', guard, async (request) =>
    listAdminUsers(deps, parseInput(adminUserListQuerySchema, request.query)),
  );

  api.put('/admin/users/:userId/status', guard, async (request, reply) => {
    const { userId } = parseInput(adminUserIdParamsSchema, request.params);
    const { status } = parseInput(adminUserStatusSchema, request.body);
    await setAdminUserStatus(deps, currentUserId(request), userId, status);
    return reply.status(204).send();
  });

  api.get('/admin/action-logs', guard, async (request, reply) => {
    const page = await listAdminActionLogs(
      deps,
      parseInput(adminLogListQuerySchema, request.query),
    );
    // Hợp đồng trả mảng; con trỏ trang kế tiếp nằm ở header (không đổi dạng thân phản hồi).
    if (page.nextCursor) reply.header('X-Next-Cursor', page.nextCursor);
    return page.items;
  });
}
