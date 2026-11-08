import type { FastifyInstance } from 'fastify';
import {
  adminOrgCreateSchema,
  adminOrgListQuerySchema,
  adminOrgUpdateSchema,
  emailBodySchema,
  licenseUpdateSchema,
  licenseWriteSchema,
} from '../../domain/org-validation.js';
import {
  createLicense,
  createOrganization,
  getOrganizationDetail,
  inviteOwner,
  listOrganizations,
  patchLicense,
  revokeLicense,
  updateOrganization,
} from '../../services/org-admin.js';
import { revokeSeat } from '../../services/org-seats.js';
import { parseInput } from '../errors.js';
import { uuidParam } from '../http.js';
import { currentUserId } from '../middleware/auth.js';
import type { AdminGuard } from './guard.js';

// Route `/admin/organizations*` cho quản trị viên hệ thống (spec 004, T037, api-changes §6). Chỉ trả cấu
// trúc tổ chức/giấy phép/người giữ seat; KHÔNG có dữ liệu học của học viên (FR-002).

export function registerAdminOrganizationRoutes(api: FastifyInstance, guard: AdminGuard): void {
  const deps = api.deps;
  type Params = { orgId?: string; licenseId?: string; userId?: string };

  api.get('/admin/organizations', guard, async (request) =>
    listOrganizations(deps, parseInput(adminOrgListQuerySchema, request.query)),
  );

  api.post('/admin/organizations', guard, async (request, reply) => {
    const input = parseInput(adminOrgCreateSchema, request.body);
    const detail = await createOrganization(deps, currentUserId(request), input);
    return reply.status(201).send(detail);
  });

  api.get('/admin/organizations/:orgId', guard, async (request) =>
    getOrganizationDetail(deps, uuidParam((request.params as Params).orgId)),
  );

  api.patch('/admin/organizations/:orgId', guard, async (request) =>
    updateOrganization(
      deps,
      currentUserId(request),
      uuidParam((request.params as Params).orgId),
      parseInput(adminOrgUpdateSchema, request.body),
    ),
  );

  api.post('/admin/organizations/:orgId/owners/invitations', guard, async (request, reply) => {
    const { email } = parseInput(emailBodySchema, request.body);
    const row = await inviteOwner(
      deps,
      currentUserId(request),
      uuidParam((request.params as Params).orgId),
      email,
    );
    return reply.status(201).send(row);
  });

  api.post('/admin/organizations/:orgId/licenses', guard, async (request, reply) => {
    const license = await createLicense(
      deps,
      currentUserId(request),
      uuidParam((request.params as Params).orgId),
      parseInput(licenseWriteSchema, request.body),
    );
    return reply.status(201).send(license);
  });

  api.patch('/admin/organizations/:orgId/licenses/:licenseId', guard, async (request) => {
    const params = request.params as Params;
    return patchLicense(
      deps,
      currentUserId(request),
      uuidParam(params.orgId),
      uuidParam(params.licenseId),
      parseInput(licenseUpdateSchema, request.body),
    );
  });

  api.post(
    '/admin/organizations/:orgId/licenses/:licenseId/revoke',
    guard,
    async (request, reply) => {
      const params = request.params as Params;
      await revokeLicense(
        deps,
        currentUserId(request),
        uuidParam(params.orgId),
        uuidParam(params.licenseId),
      );
      return reply.status(204).send();
    },
  );

  api.delete('/admin/organizations/:orgId/seats/:userId', guard, async (request, reply) => {
    const params = request.params as Params;
    await revokeSeat(
      deps,
      currentUserId(request),
      uuidParam(params.orgId),
      uuidParam(params.userId),
    );
    return reply.status(204).send();
  });
}
