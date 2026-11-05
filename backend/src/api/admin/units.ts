import type { FastifyInstance } from 'fastify';
import {
  adminUnitIdParamsSchema,
  adminUnitListQuerySchema,
  adminUnitStatusSchema,
  adminUnitWriteSchema,
} from '../../domain/admin-validation.js';
import {
  createAdminUnit,
  getAdminUnit,
  listAdminTopics,
  listAdminUnits,
  setAdminUnitStatus,
  updateAdminUnit,
} from '../../services/content.js';
import { parseInput } from '../errors.js';
import { currentUserId } from '../middleware/auth.js';
import type { AdminGuard } from './guard.js';

// Route quản trị đơn vị học (T105, FR-030): mục nội dung và bài tập lồng trong payload của đơn vị.

export function registerAdminUnitRoutes(api: FastifyInstance, guard: AdminGuard): void {
  const deps = api.deps;

  api.get('/admin/topics', guard, async () => listAdminTopics(deps));

  api.get('/admin/units', guard, async (request) =>
    listAdminUnits(deps, parseInput(adminUnitListQuerySchema, request.query)),
  );

  api.post('/admin/units', guard, async (request, reply) => {
    const input = parseInput(adminUnitWriteSchema, request.body);
    const unit = await createAdminUnit(deps, currentUserId(request), input);
    return reply.status(201).send(unit);
  });

  api.get('/admin/units/:unitId', guard, async (request) => {
    const { unitId } = parseInput(adminUnitIdParamsSchema, request.params);
    return getAdminUnit(deps, unitId);
  });

  api.put('/admin/units/:unitId', guard, async (request) => {
    const { unitId } = parseInput(adminUnitIdParamsSchema, request.params);
    const input = parseInput(adminUnitWriteSchema, request.body);
    return updateAdminUnit(deps, currentUserId(request), unitId, input);
  });

  api.put('/admin/units/:unitId/status', guard, async (request) => {
    const { unitId } = parseInput(adminUnitIdParamsSchema, request.params);
    const body = parseInput(adminUnitStatusSchema, request.body);
    return setAdminUnitStatus(deps, currentUserId(request), unitId, {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.isTrial !== undefined ? { isTrial: body.isTrial } : {}),
    });
  });
}
