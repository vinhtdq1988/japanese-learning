import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import type { AdminGuard } from './guard.js';
import { registerAdminPlacementRoutes } from './placement.js';
import { registerAdminUnitRoutes } from './units.js';
import { registerAdminUserRoutes } from './users.js';

/** Mọi route `/admin/*`: người học thường nhận 403, người chưa đăng nhập nhận 401 (FR-004). */
export function registerAdminRoutes(api: FastifyInstance): void {
  const guard: AdminGuard = { preHandler: [api.authenticate, requireRole('admin')] };
  registerAdminUnitRoutes(api, guard);
  registerAdminPlacementRoutes(api, guard);
  registerAdminUserRoutes(api, guard);
}
