import type { FastifyInstance } from 'fastify';
import {
  rebuildPathSchema,
  setMasteredSchema,
  unitIdParamsSchema,
} from '../domain/profile-validation.js';
import {
  getPathDetail,
  pausePath,
  rebuildPath,
  resumePath,
  setUnitMastered,
} from '../services/path.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route lộ trình (T049, T051, T093): xem, xây dựng lại, tạm dừng/tiếp tục và đánh dấu đã thành thạo.
// Mọi truy vấn lọc theo `user_id` lấy từ token (R16).

export function registerPathRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.get('/path', secured, async (request) => getPathDetail(deps, currentUserId(request)));

  api.post('/path/rebuild', secured, async (request) => {
    const body = parseInput(rebuildPathSchema, request.body);
    return rebuildPath(
      deps,
      currentUserId(request),
      body?.usePlacementResultId ? { placementResultId: body.usePlacementResultId } : {},
    );
  });

  api.post('/path/pause', secured, async (request, reply) => {
    await pausePath(deps, currentUserId(request));
    return reply.status(204).send();
  });

  api.post('/path/resume', secured, async (request, reply) => {
    await resumePath(deps, currentUserId(request));
    return reply.status(204).send();
  });

  api.put('/path/units/:unitId/master', secured, async (request) => {
    const { unitId } = parseInput(unitIdParamsSchema, request.params);
    const { mastered } = parseInput(setMasteredSchema, request.body);
    return setUnitMastered(deps, currentUserId(request), unitId, mastered);
  });
}
