import type { FastifyInstance } from 'fastify';
import { confirmSchema, joinByCodeSchema } from '../domain/org-validation.js';
import { leaveClass } from '../services/class-members.js';
import { joinByCode } from '../services/join-code.js';
import { getMyClass } from '../services/my-class.js';
import { parseInput } from './errors.js';
import { currentUserId } from './middleware/auth.js';

// Route của học viên `/me/class*` (spec 004, T055, api-changes §5.3): nhập mã (hai bước không trạng thái),
// xem "Lớp của tôi", chuyển sang lộ trình cá nhân (rời lớp).

export function registerMyClassRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const secured = { preHandler: [api.authenticate] };

  api.post('/me/class/join', secured, async (request, reply) => {
    const input = parseInput(joinByCodeSchema, request.body);
    const result = await joinByCode(deps, currentUserId(request), input);
    if (result === null) return reply.status(204).send();
    return result;
  });

  api.get('/me/class', secured, async (request) => getMyClass(deps, currentUserId(request)));

  api.post('/me/class/leave', secured, async (request, reply) => {
    parseInput(confirmSchema, request.body);
    await leaveClass(deps, currentUserId(request));
    return reply.status(204).send();
  });
}
