import type { FastifyInstance } from 'fastify';
import { invitationRespondSchema } from '../domain/org-validation.js';
import { previewInvitation, respondInvitation, revokeInvitation } from '../services/invitations.js';
import { parseInput } from './errors.js';
import { uuidParam } from './http.js';
import { currentUserId } from './middleware/auth.js';
import { createOrgGuards, requireOrgContext } from './middleware/org-auth.js';

// Route lời mời `/invitations/{token}*` (spec 004, T038, api-changes §5.2, §7). Token là bí mật đi kèm email:
// token sai/hết hạn/đã dùng/email không khớp đều là 404 chung. `DELETE` dùng cùng vị trí đường dẫn nhưng tham
// số mang id (uuid) của lời mời, vì OpenAPI không cho hai mẫu đường dẫn chỉ khác tên tham số.
// Nhánh học viên (`join_class`/`stay_personal`) thêm ở US2 (T050).

export function registerInvitationRoutes(api: FastifyInstance): void {
  const deps = api.deps;
  const guards = createOrgGuards(api);
  const secured = { preHandler: [api.authenticate] };
  const staff = { preHandler: [api.authenticate, guards.requireOrgStaff] };
  type Params = { token?: string };

  api.get('/invitations/:token', secured, async (request) =>
    previewInvitation(deps, currentUserId(request), (request.params as Params).token ?? ''),
  );

  api.post('/invitations/:token/respond', secured, async (request) => {
    const input = parseInput(invitationRespondSchema, request.body);
    return respondInvitation(
      deps,
      currentUserId(request),
      (request.params as Params).token ?? '',
      input,
    );
  });

  api.delete('/invitations/:token', staff, async (request, reply) => {
    await revokeInvitation(
      deps,
      requireOrgContext(request),
      uuidParam((request.params as Params).token),
    );
    return reply.status(204).send();
  });
}
