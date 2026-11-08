import type { FastifyInstance } from 'fastify';
import { emailBodySchema } from '../domain/org-validation.js';
import { createInvitation } from '../services/invitations.js';
import { getOrgOverview, removeTeacher } from '../services/org-members.js';
import { grantSeatToTeacher, revokeSeat } from '../services/org-seats.js';
import { parseInput } from './errors.js';
import { uuidParam } from './http.js';
import { createOrgGuards, requireOrgContext } from './middleware/org-auth.js';

// Route của chủ tổ chức `/org*` (spec 004, T038, api-changes §7, FR-003). Vai trò tra CSDL mỗi request qua
// `requireOrgOwner`; người không phải chủ tổ chức nhận 403, đối tượng ngoài tổ chức nhận 404 chung.

export function registerOrgRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const guards = createOrgGuards(api);
  const owner = { preHandler: [api.authenticate, guards.requireOrgOwner] };
  type Params = { userId?: string };

  api.get('/org', owner, async (request) => getOrgOverview(deps, requireOrgContext(request)));

  api.post('/org/teachers/invitations', owner, async (request, reply) => {
    const { email } = parseInput(emailBodySchema, request.body);
    const ctx = requireOrgContext(request);
    const row = await createInvitation(deps, {
      organizationId: ctx.organizationId,
      kind: 'teacher',
      email,
      invitedBy: ctx.userId,
    });
    return reply.status(201).send(row);
  });

  api.delete('/org/teachers/:userId', owner, async (request, reply) => {
    const ctx = requireOrgContext(request);
    await removeTeacher(
      deps,
      ctx.userId,
      ctx.organizationId,
      uuidParam((request.params as Params).userId),
    );
    return reply.status(204).send();
  });

  api.post('/org/seats/:userId/grant', owner, async (request, reply) => {
    const ctx = requireOrgContext(request);
    await grantSeatToTeacher(
      deps,
      ctx.userId,
      ctx.organizationId,
      uuidParam((request.params as Params).userId),
    );
    return reply.status(204).send();
  });

  api.post('/org/seats/:userId/revoke', owner, async (request, reply) => {
    const ctx = requireOrgContext(request);
    await revokeSeat(
      deps,
      ctx.userId,
      ctx.organizationId,
      uuidParam((request.params as Params).userId),
    );
    return reply.status(204).send();
  });
}
